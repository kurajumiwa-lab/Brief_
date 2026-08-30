// ---------------------------------------------------------------------------
// NOTIFICATIONS — the in-app inbox
//
// A notification is a REAL, derived event, written by the code that produced
// the underlying change — never a marketing broadcast. It is local-only: the
// inbox is the product surface; push (FCM/APNs) is a separate, still-
// unconnected rail that this module deliberately does not fake.
//
// Kinds are typed so a client can render them without guessing:
//   confirmed     someone confirmed your object/report
//   challenge     your challenge was accepted
//   saved_changed a place you saved changed
//   event_soon    an event you follow starts soon
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const NOTIFICATION_KINDS = ['confirmed', 'challenge', 'saved_changed', 'event_soon', 'system', 'workflow', 'coop'];

export function notify(userId, { kind = 'system', title, body = null, objectId = null, challengeId = null, metadata = {} }) {
  if (!userId) return null;
  if (!NOTIFICATION_KINDS.includes(kind)) throw new Error(`unknown notification kind: ${kind}`);
  if (!title) throw new Error('title is required');

  return store.insert('notifications', {
    id: newId('ntf'),
    userId,
    kind,
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 300) : null,
    objectId,
    challengeId,
    metadata,
    read: false,
    createdAt: new Date().toISOString()
  });
}

export function listNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
  let rows = store.filter('notifications', (n) => n.userId === userId);
  if (unreadOnly) rows = rows.filter((n) => !n.read);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}

export function unreadCount(userId) {
  return store.filter('notifications', (n) => n.userId === userId && !n.read).length;
}

export function markRead(userId, notificationId) {
  const n = store.find('notifications', (x) => x.id === notificationId && x.userId === userId);
  if (!n) return null;
  return store.update('notifications', notificationId, { read: true });
}

export function markAllRead(userId) {
  let n = 0;
  for (const x of store.filter('notifications', (i) => i.userId === userId && !i.read)) {
    store.update('notifications', x.id, { read: true });
    n++;
  }
  return { marked: n };
}
