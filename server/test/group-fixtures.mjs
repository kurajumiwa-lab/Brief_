// Explicit setup for tests whose subject is not the group-creation gate.
// Production has no bypass: these are real shop + approved-identity rows in
// the isolated test store. The refusal paths live in groups.mjs.
import { store } from '../src/store.js';
import { createSpace } from '../src/domain/space.js';
import { standingOf, submitVerification, decide } from '../src/domain/verification.js';
export function qualifyGroupCreator(userId) {
  if (standingOf(userId).identity !== 'verified') {
    const { record } = submitVerification(userId, { kind: 'identity', note: 'Isolated test fixture, not a real verification.' });
    decide('test_reviewer', record.id, { decision: 'approved', reason: 'Identity reviewed in isolated fixture' });
  }
  if (!store.find('spaces', s => s.ownerId === userId && s.status === 'active')) {
    createSpace({ ownerId: userId, name: 'Group host test shop', type: 'business' });
  }
}
