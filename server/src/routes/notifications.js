// ---------------------------------------------------------------------------
// NOTIFICATIONS ROUTES — the authenticated in-app notification center.
//
//   GET    /api/notifications                 list + unread count (generates
//                                             opportunistically on read, like
//                                             the expiry sweep)
//   POST   /api/notifications/read            { id } | { all } with optional
//                                             `read: false` (mark unread)
//   POST   /api/notifications/:id/open        a tap: marks read + analytics
//   GET    /api/notifications/preferences     the seven category toggles
//   PUT    /api/notifications/preferences     update category toggles
//
// Every route is authed (requireAuth) and scoped to the CALLER's own rows —
// there is no way to read or mutate another user's notification state.
// ---------------------------------------------------------------------------

import * as notifications from '../domain/notifications.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

function json(res, value) {
  res.json(value);
}

export function register(app) {
  app.use('/api/notifications', requireFeature('objects'));

  /** List the caller's notifications (opportunistically generated) + unread. */
  app.get('/api/notifications', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      notifications.generateForUser(me);
    } catch (e) {
      // Generation must never break reading the inbox: log and continue.
      res.locals.notificationGenerationError = String(e?.message ?? e);
    }
    json(res, {
      notifications: notifications.listNotifications(me, { unreadOnly: req.query.unread === '1' }),
      unread: notifications.unreadCount(me),
      preferences: notifications.getPreferences(me),
      generatedAt: notifications.getPreferences(me).generatedAt
    });
  });

  /**
   * Mark read (default), mark unread (`read: false`), or mark all read
   * (`all: true`). One endpoint, no variants.
   */
  app.post('/api/notifications/read', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    if (req.body?.all) {
      json(res, notifications.markAllRead(me));
      return;
    }
    const id = String(req.body?.id ?? '').slice(0, 120);
    if (!id) return res.status(400).json({ error: 'notification id is required' });
    const read = req.body?.read !== false;
    const n = read
      ? notifications.markRead(me, id)
      : notifications.markUnread(me, id);
    if (!n) return res.status(404).json({ error: 'notification not found' });
    json(res, { notification: n, unread: notifications.unreadCount(me) });
  });

  /** A tap: marks read and records `notification_opened` for analytics. */
  app.post('/api/notifications/:id/open', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const n = notifications.openNotification(me, req.params.id);
    if (!n) return res.status(404).json({ error: 'notification not found' });
    json(res, { notification: n, unread: notifications.unreadCount(me) });
  });

  /** The caller's notification preferences. */
  app.get('/api/notifications/preferences', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    json(res, { preferences: notifications.getPreferences(me) });
  });

  /** Update category toggles (partial patch; defaults are ON by design). */
  app.put('/api/notifications/preferences', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const patch = req.body?.categories ?? req.body ?? {};
    const result = notifications.setPreferences(me, patch);
    json(res, { ok: true, preferences: result.categories, changed: result.changed });
  });
}
