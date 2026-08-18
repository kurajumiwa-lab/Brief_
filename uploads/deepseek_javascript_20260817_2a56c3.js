// ---------------------------------------------------------------------------
// MEMBER SERVICE
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const MEMBER_ROLES = {
  COORDINATOR: 'coordinator',
  CONTRIBUTOR: 'contributor',
  SCOUT: 'scout',
  LOGISTICS: 'logistics',
  OBSERVER: 'observer'
};

export const CHECK_IN_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ARRIVED: 'arrived',
  NO_SHOW: 'no-show'
};

export function addMember(circleId, userId, role = MEMBER_ROLES.CONTRIBUTOR) {
  const existing = store.find('members', m => m.circleId === circleId && m.userId === userId);
  if (existing) return existing;

  const member = {
    id: newId('memb'),
    circleId,
    userId,
    role,
    trust_signal: null,
    check_in_status: CHECK_IN_STATUS.PENDING,
    joined_at: new Date().toISOString()
  };
  store.insert('members', member);
  return member;
}

export function getMember(circleId, userId) {
  return store.find('members', m => m.circleId === circleId && m.userId === userId);
}

export function updateMemberCheckIn(circleId, userId, status) {
  const member = getMember(circleId, userId);
  if (!member) return null;
  member.check_in_status = status;
  member.updated_at = new Date().toISOString();
  store.update('members', member.id, member);
  return member;
}

export function updateMemberTrust(circleId, userId, trustValue) {
  const member = getMember(circleId, userId);
  if (!member) return null;
  member.trust_signal = trustValue;
  member.updated_at = new Date().toISOString();
  store.update('members', member.id, member);
  return member;
}