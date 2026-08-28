// CIRCLES ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId, isSelf, isCoordinator, circleHasNoMembers, membershipOf, canOperate } from '../identity.js';
import * as circles from '../domain/circle.js';
import * as blocks from '../domain/block.js';
import * as signals from '../domain/signal.js';
import * as members from '../domain/member.js';
import { requireAuth } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/circles', requireFeature('circles'));
app.use('/api/blocks', requireFeature('circles'));
app.use('/api/signals', requireFeature('circles'));
// ---------------------------------------------------------------------------
// FEATURE SCHEMA: circles, blocks, signals, ledger
// ---------------------------------------------------------------------------


app.get('/api/circles', (req, res) => {
  // The viewer is passed so each row can say whether THEY are a member.
  // An anonymous caller still gets the list (circles are public), but every
  // row reports viewerRole: null -- the list never implies a membership the
  // caller does not have.
  res.json({ circles: circles.listCircles(callerId(req)) });
});



app.get('/api/circles/:id', (req, res) => {
  const circle = circles.getCircle(req.params.id, callerId(req));
  if (!circle) return res.status(404).json({ error: 'circle not found' });
  res.json({
    circle,
    blocks: blocks.listBlocks(circle.id),
    signals: signals.listSignals({ circleId: circle.id, limit: 20 })
  });
});



app.post('/api/circles', (req, res) => {
  // Creating a circle is a durable act with an owner, so it needs an identity.
  // Previously an anonymous POST succeeded and produced a circle that belonged
  // to nobody and could never be administered.
  const me = requireAuth(req, res);
  if (!me) return;

  const { name, description, goal, targetValue, deadline, completionCriteria, sourceId } = req.body ?? {};
  try {
    // Deriving from a source keeps the provenance chain intact.
    if (sourceId) {
      const c = circles.findOrCreateCircleFromSource(sourceId, { name, description });
      // The creator joins their own circle. Without this the loop broke at the
      // first step: you could create a circle and then be told you were not a
      // member of it, with no way in except an invitation from a coordinator
      // who did not exist.
      const membership = members.addMember(c.id, me, 'coordinator');
      signals.emitSignal({ type: 'circle_created', circleId: c.id, sourceId, actorId: me });
      return res.status(201).json({ circle: circles.getCircle(c.id, me), membership });
    }
    const c = circles.createTargetCircle({
      name, description, goal,
      targetValue: targetValue === undefined || targetValue === null || targetValue === ''
        ? null : Number(targetValue),
      deadline, completionCriteria
    });
    const membership = members.addMember(c.id, me, 'coordinator');
    signals.emitSignal({ type: 'circle_created', circleId: c.id, actorId: me });
    res.status(201).json({ circle: circles.getCircle(c.id, me), membership });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.patch('/api/circles/:id', (req, res) => {
  // Once a circle has members it belongs to them: only a coordinator may
  // change its terms (name, goal, targetValue, deadline).
  if (!circleHasNoMembers(store, req.params.id) && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may update this circle' });
  }
  try {
    const c = circles.updateCircle(req.params.id, req.body ?? {});
    if (!c) return res.status(404).json({ error: 'circle not found' });
    res.json({ circle: c });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/circles/:id/members', (req, res) => {
  if (!circles.getCircle(req.params.id)) return res.status(404).json({ error: 'circle not found' });
  res.json({ members: members.listMembers(req.params.id) });
});


// AUTHORITY (spec 32): a caller must not be able to claim membership for
// another user. `userId` is NOT read from the body -- it is the authenticated
// caller. Adding somebody else requires coordinator authority on that circle.

app.post('/api/circles/:id/members', (req, res) => {
  // JOINING REQUIRES AN IDENTITY.
  //
  // An anonymous self-join used to be accepted and stored a membership row
  // with userId: null. That row is not a member: it cannot be listed as one,
  // cannot be counted, and two anonymous joins collapse into a single null
  // row that then blocks the real join (addMember returns the first match).
  // Requiring auth is the fix -- a membership must belong to somebody.
  const me = requireAuth(req, res);
  if (!me) return;

  const requested = req.body?.userId;

  // Naming a different user is an act of authority, not a self-join.
  if (requested && requested !== me) {
    if (!isCoordinator(store, req, req.params.id)) {
      return res.status(403).json({
        error: 'only a coordinator of this circle may add another user'
      });
    }
  }

  // A self-join is allowed while the circle is still open, or when the caller
  // already coordinates it. Otherwise membership is by coordinator only.
  const target = requested && requested !== me ? requested : me;
  if (target === me) {
    const circle = circles.getCircle(req.params.id);
    if (!circle) return res.status(404).json({ error: 'circle not found' });
    const open = circle.visibility === 'open' || circleHasNoMembers(store, circle.id);
    if (!open && !isCoordinator(store, req, circle.id)) {
      return res.status(403).json({ error: 'this circle is invite only' });
    }
  }

  // Only a coordinator may mint another coordinator.
  const role = req.body?.role;
  if (role === 'coordinator' && !circleHasNoMembers(store, req.params.id)
      && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may grant the coordinator role' });
  }

  try {
    const m = members.addMember(req.params.id, target, role);
    // Attributed to the member who joined, not to the coordinator who may
    // have added them -- otherwise "joined" would appear in the wrong
    // person's evidence history.
    signals.emitSignal({ type: 'member_joined', circleId: req.params.id, actorId: target });
    res.status(201).json({ member: m });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


// LEAVE A CIRCLE.
//
// The join loop had no exit. A user could be added -- or could self-join an
// open circle -- and then had no way to stop being a member short of asking a
// coordinator to delete a row nobody could reach. Leaving is self-service and
// scoped: you may always remove YOUR OWN membership.
//
// Removing SOMEBODY ELSE is a different act and stays coordinator-only, on the
// same authority check as every other member mutation here.

app.delete('/api/circles/:id/members/me', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const circle = circles.getCircle(req.params.id);
  if (!circle) return res.status(404).json({ error: 'circle not found' });

  const { left, reason } = members.removeMember(req.params.id, me);
  if (!left) return res.status(404).json({ error: reason ?? 'you are not a member of this circle' });

  signals.emitSignal({ type: 'member_left', circleId: req.params.id, actorId: me });
  res.json({ left: true, circleId: req.params.id, userId: me });
});


app.delete('/api/circles/:id/members/:userId', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;

  const target = req.params.userId;
  // Removing yourself is the /members/me route above. Reaching it here would
  // mean the authority check had been applied to a self-service action.
  if (target === me) {
    return res.status(400).json({ error: 'use DELETE /api/circles/:id/members/me to leave' });
  }

  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may remove another member' });
  }

  const { left, reason } = members.removeMember(req.params.id, target);
  if (!left) return res.status(404).json({ error: reason ?? 'not a member of this circle' });

  signals.emitSignal({ type: 'member_removed', circleId: req.params.id, actorId: me });
  res.json({ left: true, circleId: req.params.id, userId: target });
});


// Role changes are coordinator-only. Previously unexposed; adding it without
// an authority check would have been a wider hole than the one being closed.

app.patch('/api/circles/:id/members/:userId/role', (req, res) => {
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may change roles' });
  }
  try {
    res.json({ member: members.setRole(req.params.id, req.params.userId, req.body?.role) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


// Trust is recorded evidence of a check that happened -- never a score.

app.post('/api/circles/:id/members/:userId/verify', (req, res) => {
  // Evidence must be recorded BY somebody, not self-asserted: a member cannot
  // mark their own identity verified. Trust would be worthless otherwise.
  if (isSelf(req, req.params.userId)) {
    return res.status(403).json({ error: 'a member cannot verify themselves' });
  }
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may record verification' });
  }
  try {
    res.json({ member: members.recordVerification(req.params.id, req.params.userId, req.body?.kind) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


// ---------------------------------------------------------------------------
// CIRCLE OPERATIONS (Batch 2): tasks and votes.
//
// Every route below enforces authority SERVER-SIDE. Hiding a button in the
// client is presentation, not security -- these endpoints reject the request
// itself. Identity always comes from callerId(), never from the body.
// ---------------------------------------------------------------------------

/** Shared guard: the block must exist and belong to the named circle. */
function loadCircleBlock(req, res) {
  const block = store.find('blocks', (b) => b.id === req.params.blockId);
  if (!block) {
    res.status(404).json({ error: 'block not found' });
    return null;
  }
  // A block is reachable only through ITS circle. Without this a caller could
  // operate on another circle's task by naming their own circle in the path.
  if (block.circleId !== req.params.id) {
    res.status(404).json({ error: 'block not found in this circle' });
    return null;
  }
  return block;
}


app.post('/api/circles/:id/blocks/:blockId/assign', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const me = callerId(req);
  const requested = req.body?.assigneeId;
  const assignee = requested ?? me;

  // Taking work yourself needs an operational role. Handing work to someone
  // else is an act of authority and needs a coordinator.
  if (assignee !== me) {
    if (!isCoordinator(store, req, req.params.id)) {
      return res.status(403).json({ error: 'only a coordinator may assign a task to another member' });
    }
  } else if (!canOperate(store, req, req.params.id)) {
    const row = membershipOf(store, req, req.params.id);
    return res.status(403).json({
      error: row
        ? `role '${row.role}' may not take on tasks in this circle`
        : 'only members of this circle may take on tasks'
    });
  }

  try {
    const { block: updated, changed } = blocks.assignTask(block.id, assignee);
    // Only a real change emits a signal. Re-assigning to the same person is a
    // no-op and must not manufacture a second piece of activity evidence.
    if (changed) {
      signals.emitSignal({
        type: 'task_assigned',
        circleId: block.circleId,
        blockId: block.id,
        actorId: assignee,
        metadata: { assignedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/circles/:id/blocks/:blockId/release', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const state = blocks.taskState(block);
  const me = callerId(req);
  // You may put down your own work; releasing someone else's is a
  // coordinator's call.
  if (state?.assigneeId && state.assigneeId !== me && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only the assignee or a coordinator may release this task' });
  }

  try {
    const { block: updated, changed } = blocks.releaseTask(block.id);
    if (changed) {
      signals.emitSignal({
        type: 'task_released',
        circleId: block.circleId,
        blockId: block.id,
        actorId: state?.assigneeId ?? me,
        metadata: { releasedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/circles/:id/blocks/:blockId/complete', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const state = blocks.taskState(block);
  const me = callerId(req);

  // Completion is a claim that work was done. Only the person holding the
  // task, or a coordinator confirming on their behalf, may make it.
  if (state?.assigneeId !== me && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({
      error: 'only the assignee or a coordinator may complete this task'
    });
  }

  try {
    const { block: updated, changed } = blocks.completeTask(block.id, state?.assigneeId ?? me);
    // Attribute completion to whoever did the work, not to the coordinator
    // who confirmed it -- otherwise the evidence history would credit the
    // wrong member.
    if (changed) {
      signals.emitSignal({
        type: 'task_completed',
        circleId: block.circleId,
        blockId: block.id,
        actorId: state?.assigneeId ?? me,
        metadata: { confirmedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.post('/api/circles/:id/blocks/:blockId/vote', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const me = callerId(req);
  // A ballot is cast by the caller. `voterId` in a body would be a forgeable
  // claim, so it is ignored entirely.
  if (!canOperate(store, req, req.params.id)) {
    const row = membershipOf(store, req, req.params.id);
    return res.status(403).json({
      error: row
        ? `role '${row.role}' may not vote in this circle`
        : 'only members of this circle may vote'
    });
  }

  try {
    const ballot = blocks.castVote(block.id, me, req.body?.option);
    signals.emitSignal({
      type: 'vote_cast',
      circleId: block.circleId,
      blockId: block.id,
      actorId: me,
      // The CHOICE is deliberately not recorded on the signal: the activity
      // feed shows that someone voted, not how. The ballot row holds the
      // option for the tally.
      metadata: {}
    });
    res.status(201).json({ vote: { id: ballot.id, option: ballot.option }, tally: blocks.tallyVote(block.id) });
  } catch (e) {
    const msg = String(e.message ?? e);
    // Already-voted is a conflict, not a malformed request.
    const status = /already voted/.test(msg) ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});



app.post('/api/circles/:id/blocks/:blockId/close-vote', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may close a vote' });
  }
  try {
    const { block: updated, changed } = blocks.closeVote(block.id);
    if (changed) {
      signals.emitSignal({
        type: 'vote_closed',
        circleId: block.circleId,
        blockId: block.id,
        actorId: callerId(req)
      });
    }
    res.json({ block: updated, changed, tally: blocks.tallyVote(block.id) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/circles/:id/blocks/:blockId/tally', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;
  try {
    res.json({ tally: blocks.tallyVote(block.id) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


/**
 * A member's evidence history, derived from the signals they caused.
 * Never a score -- see memberEvidence() for why.
 */

app.get('/api/circles/:id/members/:userId/evidence', (req, res) => {
  if (!circles.getCircle(req.params.id)) {
    return res.status(404).json({ error: 'circle not found' });
  }
  res.json({
    evidence: signals.memberEvidence(req.params.userId, { circleId: req.params.id }),
    summary: signals.memberEvidenceSummary(req.params.userId, { circleId: req.params.id })
  });
});



app.get('/api/blocks', (req, res) => {
  res.json({ blocks: blocks.listBlocks(req.query.circleId || null) });
});



app.post('/api/blocks', (req, res) => {
  const { circleId, objectId, type, content, metadata } = req.body ?? {};
  // Contribution requires belonging. An open circle admits anyone; an
  // invite-only circle admits members only.
  const circle = circles.getCircle(circleId);
  if (!circle) return res.status(404).json({ error: 'circle not found' });
  const mine = store.find(
    'members',
    (m) => m.circleId === circleId && m.userId === callerId(req)
  );
  if (!mine && circle.visibility !== 'open') {
    return res.status(403).json({ error: 'only members may add blocks to this circle' });
  }
  try {
    // metadata carries the type-specific payload -- vote options above all.
    // Dropping it here meant a vote could never be created through the API:
    // createBlock() saw no options and refused every request.
    const b = objectId
      ? blocks.createBlockFromObject(objectId, circleId, { type, content })
      : blocks.createBlock({ circleId, type, content, metadata: metadata ?? {} });
    signals.emitSignal({
      type: 'block_added',
      circleId,
      blockId: b.id,
      objectId: objectId ?? null,
      actorId: callerId(req)
    });
    res.status(201).json({ block: b });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});



app.get('/api/signals', (req, res) => {
  res.json({
    signals: signals.listSignals({
      circleId: req.query.circleId || null,
      limit: Math.min(Number(req.query.limit) || 50, 200)
    })
  });
});
}

