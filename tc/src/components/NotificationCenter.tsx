// ---------------------------------------------------------------------------
// NOTIFICATION CENTER — the in-app return loop surface.
//
// Sections: NEW (unread, newest first) then EARLIER (read). Every row shows
// type, title, concise context, image when the object has one, freshness,
// source where real, and unread state. Opened rows deep-link into the
// EXISTING destinations (object detail / entity page / location page) — no
// duplicate detail pages.
//
// Honesty rules, same as the rest of Brief:
//   * only server rows render; nothing is invented client-side;
//   * an expired/ended object keeps its notification but the row shows the
//     CURRENT object status (expired/ended), never a verification claim;
//   * preferences are simple category toggles; the API decides what is kept.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, CircleAlert, ImageOff, Settings2, X } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { Notification, NotificationPrefs } from '../api/briefApi';

const TYPE_LABELS: Record<string, string> = {
  following: 'Following',
  location: 'Location',
  event: 'Event',
  offer: 'Offer',
  alert: 'Alert',
  collection: 'Saved',
  correction: 'Corrected',
  source_update: 'News',
  confirmed: 'Confirmed',
  challenge: 'Arena',
  saved_changed: 'Saved',
  event_soon: 'Event',
  system: 'Brief',
  workflow: 'Workflow',
  coop: 'Co-op'
};

const TYPE_COLORS: Record<string, string> = {
  following: '#5B2EA6',
  location: '#2E6B3E',
  event: '#5B2EA6',
  offer: '#8A5A00',
  alert: '#B3261E',
  collection: '#251045',
  correction: '#B3261E',
  source_update: '#2E6B3E',
  confirmed: '#2E6B3E',
  challenge: '#5B2EA6',
  saved_changed: '#251045',
  event_soon: '#5B2EA6',
  system: '#251045',
  workflow: '#251045',
  coop: '#2E6B3E'
};

const CATEGORY_LABELS: Record<string, string> = {
  following: 'Following',
  events: 'Events',
  offers: 'Offers',
  alerts: 'Alerts',
  news: 'News',
  locations: 'Locations',
  saved: 'Saved items'
};

const DEFAULT_PREFS: Record<string, boolean> = {
  following: true, events: true, offers: true, alerts: true,
  news: true, locations: true, saved: true
};

function freshness(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type ?? 'Update';
}

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#251045';
}

interface NotificationCenterProps {
  authed: boolean;
  onClose: () => void;
  /** Deep-link dispatch: the App routes dest → existing destinations. */
  onOpen: (n: Notification) => void;
  /** Unread badge refresh after any read-state or preference change. */
  onChanged?: (unread: number) => void;
}

export function NotificationCenter({ authed, onClose, onOpen, onChanged }: NotificationCenterProps) {
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError(null);
    const [list, prefRes] = await Promise.all([
      briefApi.getNotifications(false),
      briefApi.getNotificationPreferences().catch(() => null)
    ]);
    if (list.ok) {
      setRows(list.data.notifications);
      setUnread(list.data.unread);
    } else {
      setError(list.error ?? 'Notifications could not be loaded.');
      setRows([]);
    }
    if (prefRes?.ok) {
      setPrefs({ ...DEFAULT_PREFS, ...(prefRes.data.preferences.categories ?? {}) });
    }
    setLoading(false);
  }, [authed]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    onChanged?.(unread);
  }, [unread, onChanged]);

  const setRead = async (n: Notification, read: boolean) => {
    setBusyId(n.id);
    const res = await briefApi.markNotificationsRead(n.id, read);
    if (res.ok) {
      setRows((prev) => (prev ?? []).map((r) => {
        if (r.id !== n.id) return r;
        return { ...r, read, readAt: read ? r.readAt ?? new Date().toISOString() : null };
      }));
      setUnread((u) => Math.max(0, u + (read ? (n.read ? 0 : -1) : (n.read ? 0 : 1))));
    }
    setBusyId(null);
  };

  const markAll = async () => {
    const res = await briefApi.markNotificationsRead();
    if (res.ok) {
      setRows((prev) => (prev ?? []).map((r) => ({ ...r, read: true, readAt: r.readAt ?? new Date().toISOString() })));
      setUnread(0);
    }
  };

  const togglePref = async (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    const res = await briefApi.updateNotificationPreferences(next);
    if (!res.ok) {
      setPrefs(prefs); // revert
      setError('Preferences could not be saved.');
    }
  };

  const open = async (n: Notification) => {
    setBusyId(n.id);
    if (!n.read) {
      const res = await briefApi.openNotification(n.id);
      if (res.ok) {
        setUnread((u) => Math.max(0, u - 1));
        setRows((prev) => (prev ?? []).map((r) => (r.id === n.id ? { ...r, read: true, readAt: r.readAt ?? new Date().toISOString() } : r)));
      }
    }
    setBusyId(null);
    onOpen(n);
  };

  const now = useMemo(() => new Date(), []);
  const newRows = (rows ?? []).filter((n) => !n.read);
  const earlierRows = (rows ?? []).filter((n) => n.read);

  const Row = ({ n }: { n: Notification }) => {
    const status = n.object?.status ?? null;
    const statusLine = status
      ? status === 'expired' ? 'Expired'
        : status === 'past' ? 'Ended'
          : status === 'upcoming' ? 'Upcoming'
            : status
      : null;
    return (
      <button
        type="button"
        onClick={() => void open(n)}
        className={`group flex w-full items-stretch gap-2.5 rounded-2xl border p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#6C3EC9] ${
          n.read ? 'border-[#E6E1EF] bg-white' : 'border-[#6C3EC9]/40 bg-white shadow-sm'
        }`}
      >
        {/* Unread marker */}
        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#5B2EA6]" aria-label="Unread" />}
        {n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" aria-hidden="true" />}

        {n.imageUrl ? (
          <img src={n.imageUrl} alt="" aria-hidden="true" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F1EDF7]">
            <ImageOff className="h-4 w-4 text-[#251045]/30" />
          </div>
        )}

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white" style={{ backgroundColor: typeColor(n.type) }}>
              {typeLabel(n.type)}
            </span>
            {n.priority === 'important' && (
              <span className="flex items-center gap-0.5 rounded-full bg-[#FDF0EE] px-1.5 py-0.5 text-[9px] font-extrabold text-[#B3261E]">
                <CircleAlert className="h-2.5 w-2.5" /> Important
              </span>
            )}
            {statusLine && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                status === 'expired' || status === 'past' ? 'bg-[#F1EDF7] text-[#251045]/60' : 'bg-[#EAF4EC] text-[#2E6B3E]'
              }`}>
                {statusLine}
              </span>
            )}
            <span className="text-[9px] font-semibold text-[#251045]/40">{freshness(n.createdAt)}</span>
          </div>
          <p className={`mt-1 line-clamp-2 text-[12.5px] leading-snug ${n.read ? 'text-[#251045]/70' : 'font-bold text-[#251045]'}`}>
            {n.title}
          </p>
          {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#251045]/55">{n.body}</p>}
          {n.sourceName && (
            <p className="mt-1 text-[9.5px] font-semibold text-[#251045]/45">{n.sourceName}</p>
          )}
          {n.context && (
            <p className="mt-0.5 text-[9.5px] font-semibold text-[#5B2EA6]/70">{n.context}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden bg-[#150826]/85 backdrop-blur-md sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#D6CFE4] bg-[#FBFAFD] shadow-2xl mb-safe sm:h-[88vh] sm:rounded-3xl"
        role="dialog"
        aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#D6CFE4] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-[#251045] transition-colors hover:bg-[#F1EDF7]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[13px] font-extrabold text-[#251045]">Notifications</p>
            {unread > 0 && (
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#5B2EA6]">
                {unread} unread
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPrefsOpen((v) => !v)}
              aria-label="Notification preferences"
              aria-expanded={prefsOpen}
              className="rounded-full p-2 text-[#251045]/60 transition-colors hover:bg-[#F1EDF7] hover:text-[#251045]"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-[#251045] transition-colors hover:bg-[#F1EDF7]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preferences (simple category toggles) */}
        {prefsOpen && (
          <div className="shrink-0 border-b border-[#D6CFE4] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#251045]/60">
                What reaches you
              </p>
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#5B2EA6] hover:bg-[#F1EDF7]"
              >
                Done
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {Object.keys(CATEGORY_LABELS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void togglePref(key)}
                  aria-pressed={prefs[key] !== false}
                  className={`flex items-center justify-between gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                    prefs[key] !== false
                      ? 'border-[#6C3EC9]/40 bg-[#F1EDF7] text-[#251045]'
                      : 'border-[#D6CFE4] bg-[#FBFAFD] text-[#251045]/40'
                  }`}
                >
                  <span className="truncate">{CATEGORY_LABELS[key]}</span>
                  <span className="shrink-0 text-[#5B2EA6]">{prefs[key] !== false ? 'On' : 'Off'}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[9.5px] leading-snug text-[#251045]/45">
              Categories you turn off stop new notifications; everything already here stays until you dismiss it.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-safe">
          {!authed && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <Bell className="h-8 w-8 text-[#5B2EA6]" />
              <p className="max-w-xs text-[13px] font-semibold text-[#251045]">
                Sign in to see what changed while you were away.
              </p>
            </div>
          )}

          {authed && loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-[rgba(37,16,69,0.62)]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6C3EC9] border-t-transparent" />
              <p className="text-[12px] font-semibold">Checking what changed…</p>
            </div>
          )}

          {authed && !loading && error && rows?.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <BellOff className="h-8 w-8 text-[#251045]/30" />
              <p className="max-w-xs text-[12px] font-semibold text-[#251045]/60">{error}</p>
            </div>
          )}

          {authed && !loading && rows && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D6CFE4] px-6 py-14 text-center">
              <Bell className="h-6 w-6 text-[rgba(37,16,69,0.4)]" />
              <p className="text-[13px] font-semibold text-[#251045]">Nothing new yet</p>
              <p className="max-w-xs text-[12px] leading-relaxed text-[rgba(37,16,69,0.62)]">
                Follow a place, save something, or pick a location in My Brief —
                when something that matters changes, it lands here.
              </p>
            </div>
          )}

          {authed && !loading && rows && rows.length > 0 && (
            <div className="space-y-5 px-4 pb-10 pt-4 sm:px-5">
              {unread > 0 && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void markAll()}
                    className="flex items-center gap-1 rounded-full border border-[#D6CFE4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5B2EA6] transition-colors hover:border-[#6C3EC9]"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                </div>
              )}

              {newRows.length > 0 && (
                <section aria-label="New">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#251045]">New</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {newRows.map((n) => <Row key={n.id} n={n} />)}
                  </div>
                </section>
              )}

              {earlierRows.length > 0 && (
                <section aria-label="Earlier">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#251045]/50">
                    Earlier {now.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {earlierRows.map((n) => (
                      <div key={n.id} className="group relative">
                        <Row n={n} />
                        <button
                          type="button"
                          aria-label="Mark unread"
                          title="Mark unread"
                          onClick={(e) => { e.stopPropagation(); void setRead(n, false); }}
                          className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-[#251045]/40 opacity-0 transition-opacity hover:text-[#5B2EA6] group-hover:opacity-100"
                        >
                          <Bell className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {busyId && (
                <p className="flex items-center gap-2 text-[10px] font-semibold text-[#251045]/45">
                  <Check className="h-3 w-3" /> Updating…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
