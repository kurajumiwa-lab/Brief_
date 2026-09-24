import { store, newId } from '../store.js';
import { isMember } from './groupDirectory.js';
import * as banking from './tableBanking.js';
import * as buys from './groupbuy.js';
import * as campaigns from './campaign.js';
import { isEnabled } from '../features.js';
import { checkIn } from './checkin.js';
import { workspaceParticipant } from './workspaceAccess.js';

const PURPOSES = ['table_banking', 'group_buy', 'events'];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function group(id, actorId) {
  const g = store.lookup('circles', id);
  if (!g) fail('Group not found.', 404);
  if (!isMember(id, actorId)) fail('Group membership is required to enter its private workspaces.', 403);
  return g;
}
function workspace(id, actorId) {
  const w = store.lookup('groupWorkspaces', id);
  if (!w) fail('Workspace not found.', 404);
  group(w.groupId, actorId);
  const feature = { table_banking: 'table_banking', group_buy: 'engine', events: 'campaigns' }[w.purpose];
  if (!isEnabled(feature)) fail('This workspace feature is disabled.', 503);
  return w;
}
function own(w, actorId) { if (w.ownerId !== actorId) fail('Only this workspace owner can operate it. Group and shop roles do not grant this authority.', 403); }
function note(text) { if (typeof text !== 'string' || !text.trim()) fail('Explain this action.'); return text.trim().slice(0, 1000); }
function audit(w, actorId, action, reason, before = null, after = null) {
  store.insert('auditLog', { id: newId('wsa'), objectType: 'groupWorkspace', objectId: w.id, actorId, action, reason, before, after, at: new Date().toISOString() });
}
function native(w) { return w.resourceId ? store.lookup(w.purpose === 'table_banking' ? 'tableBanking' : w.purpose === 'group_buy' ? 'groupBuys' : 'campaigns', w.resourceId) : null; }
function state(w) {
  const r = native(w);
  if (!r) return w.status;
  return w.purpose === 'group_buy' ? r.status === 'closed' ? 'closed' : r.stage : w.purpose === 'events' && r.endsAt && Date.parse(r.endsAt) <= Date.now() && ['published', 'live'].includes(r.status) ? 'ended' : r.status;
}
function participant(w, actorId) {
  const r = native(w);
  if (w.ownerId === actorId) return true;
  if (w.purpose === 'table_banking') return Boolean(r?.members?.some(m => m.userId === actorId));
  return Boolean(workspaceParticipant(w.id, actorId));
}
function projection(w, actorId) {
  const r = native(w), owner = w.ownerId === actorId, enrolled = participant(w, actorId);
  const request = store.find('workspaceParticipants', p => p.workspaceId === w.id && p.userId === actorId);
  return { id: w.id, groupId: w.groupId, purpose: w.purpose, name: w.name, state: state(w), owner,
    participation: enrolled ? 'active' : request?.status ?? 'none',
    // Metadata is for group members; resource IDs/config/ledger are separately scoped.
    resourceId: enrolled ? w.resourceId : null,
    config: owner && ((!r && w.status === 'setup') || (w.purpose === 'events' && r?.status === 'draft')) ? w.config : null,
    nativeState: r?.status ?? null,
    lifecycle: w.purpose === 'table_banking' ? ['setup', 'active', 'archived'] : w.purpose === 'group_buy' ? ['setup', 'funding', 'target_met', 'ordered', 'dispatched', 'delivered', 'closed'] : ['setup', 'draft', 'published', 'live', 'ended', 'closed'],
    requests: owner ? store.filter('workspaceParticipants', p => p.workspaceId === w.id && p.status === 'requested').map(p => ({ id: p.id, userId: p.userId, handle: store.lookup('users', p.userId)?.handle ?? 'Member' })) : [],
    event: w.purpose === 'events' && r && (owner || ['published', 'live', 'ended', 'closed'].includes(state(w))) ? { title: r.title, description: r.description, startsAt: r.startsAt, endsAt: r.endsAt, location: r.location, price: r.price, publicSlug: ['published', 'live'].includes(r.status) ? r.publicSlug : null } : null
  };
}
export function list(groupId, actorId) {
  const g = group(groupId, actorId);
  return { purposes: (g.directory?.purposes ?? []).filter(p => PURPOSES.includes(p)), canCreate: !['completed', 'dormant'].includes(g.status) && Boolean(store.find('members', m => m.circleId === groupId && m.userId === actorId && m.role === 'coordinator' && m.status !== 'ended')),
    workspaces: store.filter('groupWorkspaces', w => w.groupId === groupId).map(w => projection(w, actorId)) };
}
export function create(groupId, actorId, { purpose, name, requestId }) {
  const allowed = list(groupId, actorId);
  if (!allowed.canCreate) fail('An active group coordinator must set up the workspace.', 403);
  if (!allowed.purposes.includes(purpose)) fail('Enable this purpose in the group settings first.');
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 128) fail('A setup request ID is required.');
  const old = store.find('groupWorkspaces', w => w.groupId === groupId && w.ownerId === actorId && w.requestId === requestId);
  if (old) { if (old.purpose !== purpose) fail('Request ID already used.', 409); return projection(old, actorId); }
  if (typeof name !== 'string' || !name.trim()) fail('Name the workspace.');
  return store.transaction(() => {
    const w = store.insert('groupWorkspaces', { id: newId('gws'), groupId, ownerId: actorId, purpose, name: name.trim().slice(0, 120), requestId, status: 'setup', config: {}, resourceId: null, createdAt: new Date().toISOString() });
    audit(w, actorId, 'workspace.setup', 'Explicit purpose workspace setup.'); return projection(w, actorId);
  });
}
export function configure(id, actorId, input) {
  const w = workspace(id, actorId); own(w, actorId);
  const editableEvent = w.purpose === 'events' && native(w)?.status === 'draft';
  if ((w.resourceId || w.status !== 'setup') && !editableEvent) fail('Setup is closed; edit the native workspace instead.', 409);
  const allowed = w.purpose === 'table_banking' ? ['contributionAmount', 'cycleDays'] : w.purpose === 'group_buy' ? ['targetAmount'] : ['description', 'location', 'startsAt', 'endsAt', 'capacity', 'price'];
  if (!input || Object.keys(input).some(k => !allowed.includes(k))) fail('Unsupported setup field.');
  store.transaction(() => {
    const before = { ...w.config };
    if (editableEvent) campaigns.updateCampaign(w.resourceId, { ...input, ...(input.price !== undefined ? { price: Number(input.price) } : {}), ...(input.capacity !== undefined ? { capacity: input.capacity ? Number(input.capacity) : null } : {}) }, actorId);
    store.update('groupWorkspaces', w.id, { config: { ...w.config, ...input } });
    audit(w, actorId, 'workspace.configured', 'Owner edited setup.', before, w.config);
  });
  return projection(w, actorId);
}
export function activate(id, actorId) {
  const w = workspace(id, actorId); own(w, actorId);
  if (w.resourceId) return read(id, actorId); // retry never creates a second ledger/event/buy
  if (w.status !== 'setup') fail('A cancelled setup cannot be activated.', 409);
  if (['completed', 'dormant'].includes(group(w.groupId, actorId).status)) fail('This group is not accepting new workspace activations.', 409);
  if (w.status !== 'setup') fail('This setup was cancelled.', 409);
  const c = w.config;
  return store.transaction(() => {
    let r;
    if (w.purpose === 'table_banking') {
      if (!Number.isSafeInteger(Number(c.contributionAmount)) || Number(c.contributionAmount) <= 0 || !Number.isSafeInteger(Number(c.cycleDays)) || Number(c.cycleDays) < 1) fail('Set a positive whole contribution and cycle length.');
      r = banking.createTableBanking({ ownerId: actorId, name: w.name, contributionAmount: Number(c.contributionAmount), cycleDays: Number(c.cycleDays) });
    } else if (w.purpose === 'group_buy') {
      r = buys.createGroupBuy({ ownerId: actorId, title: w.name, targetAmount: c.targetAmount });
    } else {
      if (!c.startsAt || !c.endsAt || !Number.isFinite(Date.parse(c.startsAt)) || !Number.isFinite(Date.parse(c.endsAt)) || Date.parse(c.endsAt) <= Date.parse(c.startsAt)) fail('Set valid start and end times.');
      r = campaigns.createCampaign(actorId, { title: w.name, type: 'event', description: String(c.description ?? ''), location: String(c.location ?? ''), startsAt: c.startsAt, endsAt: c.endsAt, price: Number(c.price ?? 0), capacity: c.capacity ? Number(c.capacity) : null });
    }
    store.update('groupWorkspaces', w.id, { resourceId: r.id, status: 'active', activatedAt: new Date().toISOString() });
    audit(w, actorId, 'workspace.activated', 'Explicit native ownership accepted. No group members auto-enrolled.', null, { resourceId: r.id });
    return read(id, actorId);
  });
}
export function read(id, actorId) {
  const w = workspace(id, actorId), view = projection(w, actorId), r = native(w);
  if (!r) return view;
  if (w.purpose === 'group_buy' && participant(w, actorId)) {
    const buy = buys.getGroupBuy(r.id);
    view.buy = { title: buy.title, stage: buy.stage, targetAmount: buy.targetAmount,
      total: view.owner ? buy.total : null,
      contributions: buy.contributions.filter(c => view.owner || c.contributorId === actorId),
      history: buy.history };
  }
  if (w.purpose === 'events') {
    view.registration = store.find('registrations', x => x.campaignId === r.id && x.userId === actorId && x.status !== 'cancelled');
    if (view.owner) view.registrations = campaigns.listRegistrations(r.id);
  }
  return view;
}
export function requestParticipation(id, actorId) {
  const w = workspace(id, actorId);
  if (!w.resourceId || ['archived', 'cancelled', 'closed', 'delivered', 'ended'].includes(state(w))) fail('Workspace is not accepting participants.', 409);
  if (participant(w, actorId)) return read(id, actorId);
  return store.transaction(() => {
    const prior = store.find('workspaceParticipants', p => p.workspaceId === id && p.userId === actorId);
    if (w.purpose === 'events') {
      const r = native(w);
      campaigns.register(r, { attendeeRef: actorId, userId: actorId, name: store.lookup('users', actorId)?.handle });
    }
    const fields = { status: w.purpose === 'events' ? 'active' : 'requested', requestedAt: new Date().toISOString() };
    if (prior) store.update('workspaceParticipants', prior.id, fields);
    else store.insert('workspaceParticipants', { id: newId('wsp'), workspaceId: id, userId: actorId, ...fields });
    audit(w, actorId, 'workspace.participation_requested', 'Explicit participation request.'); return read(id, actorId);
  });
}
export function decideParticipation(id, actorId, { participantId, approve, reason }) {
  const w = workspace(id, actorId); own(w, actorId); const why = note(reason);
  const p = store.lookup('workspaceParticipants', participantId);
  if (!p || p.workspaceId !== id || p.status !== 'requested') fail('No pending request.', 409);
  if (typeof approve !== 'boolean') fail('Choose approve or decline.');
  if (['archived', 'closed', 'cancelled', 'delivered'].includes(state(w))) fail('Workspace is closed.', 409);
  if (!isMember(w.groupId, p.userId)) fail('Applicant is no longer a group member.', 409);
  return store.transaction(() => {
    store.update('workspaceParticipants', p.id, { status: approve ? 'active' : 'declined', decidedBy: actorId, decidedAt: new Date().toISOString() });
    if (approve && w.purpose === 'table_banking') banking.joinTableBanking(w.resourceId, p.userId);
    audit(w, actorId, 'workspace.participation_decided', why, null, { userId: p.userId, approve }); return read(id, actorId);
  });
}
export function action(id, actorId, input) {
  const w = workspace(id, actorId), r = native(w), why = note(input.reason);
  if (input.action === 'contribute') {
    if (!r || !participant(w, actorId)) fail('Workspace participation required.', 403);
    if (w.purpose !== 'group_buy') fail('Use the table-banking ledger for its contributions.');
    if (!['funding', 'target_met'].includes(state(w))) fail('Contribution recording is closed.', 409);
    return store.transaction(() => {
      const key = String(input.requestId ?? ''); if (key.length < 8 || key.length > 128) fail('A contribution request ID is required.');
      const old = store.find('auditLog', a => a.objectType === 'groupWorkspace' && a.objectId === id && a.actorId === actorId && a.requestId === key);
      if (old) { if (old.after?.amount !== Number(input.amount) || old.reason !== why) fail('Request ID already used.', 409); return read(id, actorId); }
      buys.contribute({ groupBuyId: r.id, memberRef: store.lookup('users', actorId)?.handle ?? actorId, amount: input.amount, source: input.source ?? 'cash', actorId });
      store.insert('auditLog', { id: newId('wsa'), objectType: 'groupWorkspace', objectId: id, actorId, requestId: key, action: 'workspace.contribution_recorded', reason: why, after: { amount: Number(input.amount) }, at: new Date().toISOString() }); return read(id, actorId);
    });
  }
  if (input.action === 'withdraw') {
    if (w.ownerId === actorId) fail('The workspace owner must close the workspace instead.', 409);
    return store.transaction(() => {
      if (w.purpose === 'table_banking' && participant(w, actorId)) banking.leaveTableBanking(r.id, actorId);
      if (w.purpose === 'group_buy' && store.find('groupBuyContributions', c => c.groupBuyId === r?.id && c.contributorId === actorId)) fail('Recorded contributions require a separate cancellation/refund decision; withdrawal is blocked.', 409);
      if (w.purpose === 'events') {
        const reg = store.find('registrations', x => x.campaignId === r?.id && x.userId === actorId && x.status !== 'cancelled');
        if (reg && r.price > 0) fail('Paid-event cancellation needs the separate refund policy; no payment state changed.', 409);
        if (reg) campaigns.setRegistrationStatus(reg.id, 'cancelled');
      }
      const p = store.find('workspaceParticipants', p => p.workspaceId === id && p.userId === actorId);
      if (p) store.update('workspaceParticipants', p.id, { status: 'withdrawn' });
      audit(w, actorId, 'workspace.withdrawn', why); return read(id, actorId);
    });
  }
  own(w, actorId);
  return store.transaction(() => {
    const before = state(w);
    if (!r && input.action === 'cancel_setup') store.update('groupWorkspaces', id, { status: 'cancelled' });
    else if (!r) fail('Activate this setup first.');
    else if (w.purpose === 'table_banking' && input.action === 'archive') banking.archiveTableBanking(r.id, actorId);
    else if (w.purpose === 'events' && input.action === 'checkin') {
      const reg = store.lookup('registrations', input.registrationId);
      if (!reg || reg.campaignId !== r.id) fail('Registration not in this event.', 404);
      const result = checkIn(reg.ticketCode, actorId);
      if (!result.ok) fail(`Check-in refused: ${result.reason}`, 409);
    } else if (w.purpose === 'events') {
      const next = { publish: 'published', start: 'live', close: 'closed', cancel: 'cancelled' }[input.action];
      if (!next) fail('Unsupported event action.');
      campaigns.transitionCampaign(r.id, next);
    } else if (w.purpose === 'group_buy' && input.action === 'close') {
      if (r.stage !== 'delivered') fail('Record delivery before closing. Unresolved money is never silently cancelled.', 409);
      store.update('groupBuys', r.id, { status: 'closed' });
    } else if (w.purpose === 'group_buy') buys.advanceStage({ groupBuyId: r.id, to: input.action, actorId, note: why });
    else fail('Unsupported action.');
    audit(w, actorId, 'workspace.transition', why, { state: before }, { state: state(w) }); return read(id, actorId);
  });
}
