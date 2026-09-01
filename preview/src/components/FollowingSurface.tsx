// ---------------------------------------------------------------------------
// FOLLOWING SURFACE — the viewer's Following feed + follow management.
//
// One lightweight surface, two tabs:
//   Following — recent information from followed entities, sections ranked by
//               the existing discovery system; expired content never active.
//   Manage   — the viewer's follows grouped Places / Businesses / Publishers
//              / Organizers / Communities, each with a direct unfollow.
// Everything is the caller's OWN data (self-scoped); no social mechanics.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, MapPin, Plus, Users, X } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { FollowingSection, FollowsGroups } from '../api/briefApi';

interface FollowingSurfaceProps {
  authed: boolean;
  onClose: () => void;
  onOpenObject: (object: any) => void;
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
  onFollowChanged?: () => void;
}

const KIND_LABELS: Record<string, string> = {
  venue: 'Places',
  business: 'Businesses',
  publisher: 'Publishers',
  organizer: 'Organizers',
  community: 'Communities'
};

const KIND_SINGULAR: Record<string, string> = {
  venue: 'Place',
  business: 'Business',
  publisher: 'Publisher',
  organizer: 'Organizer',
  community: 'Community'
};

function temporalLine(o: FollowingSection['objects'][number]): string | null {
  const t = o.temporal;
  if (!t) return null;
  if ((t.status === 'upcoming' || t.status === 'happening') && typeof t.startsAt === 'string') {
    const d = new Date(t.startsAt);
    if (Number.isFinite(d.getTime())) {
      return `On ${d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    }
    return 'Upcoming';
  }
  if (t.status === 'active' && typeof t.deadlineAt === 'string') {
    const d = new Date(t.deadlineAt);
    if (Number.isFinite(d.getTime())) return `Closes ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`;
    return 'Active';
  }
  if (t.status === 'happening') return 'Happening now';
  return null;
}

export function FollowingSurface({ authed, onClose, onOpenObject, onOpenEntity, onRequireAuth, onFollowChanged }: FollowingSurfaceProps) {
  const [tab, setTab] = useState<'following' | 'manage'>('following');
  const [feed, setFeed] = useState<FollowingSection[] | null>(null);
  const [follows, setFollows] = useState<FollowsGroups | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([briefApi.getMyFollowingFeed(), briefApi.getMyFollows()]).then(([f, m]) => {
      if (f.ok) setFeed(f.data.sections);
      if (m.ok) setFollows(m.data);
      setLoading(false);
    });
  }, [authed]);

  useEffect(() => { load(); }, [load]);

  const kindOrder = useMemo(() => {
    if (!follows) return [];
    return Object.keys(follows.groups).filter((k) => (follows.groups[k] ?? []).length > 0);
  }, [follows]);

  const unfollow = (id: string) => {
    if (!authed) { onRequireAuth(); return; }
    briefApi.unfollowEntity(id).then((res) => {
      if (res.ok) {
        setFollows((prev) => {
          if (!prev) return prev;
          const groups = { ...prev.groups };
          for (const k of Object.keys(groups)) {
            groups[k] = (groups[k] ?? []).filter((f) => f.id !== id);
          }
          return { ...prev, groups, total: Math.max(0, prev.total - 1) };
        });
        setFeed((prev) => prev ? prev.filter((s) => s.entityId !== id) : prev);
        onFollowChanged?.();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden bg-[#08090B]/85 backdrop-blur-md sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#222630] bg-[#12151A] shadow-2xl mb-safe sm:h-[88vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#222630] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-[#F7F7F8] transition-colors hover:bg-[#171A20]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-1 rounded-full border border-[#222630] bg-[#12151A] p-1">
            <button
              type="button"
              onClick={() => setTab('following')}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${tab === 'following' ? 'bg-[#FF5A1F] text-[#0D0F12]' : 'text-[#0D0F12] hover:bg-[#171A20]'}`}
            >
              Following
            </button>
            <button
              type="button"
              onClick={() => setTab('manage')}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${tab === 'manage' ? 'bg-[#FF5A1F] text-[#0D0F12]' : 'text-[#0D0F12] hover:bg-[#171A20]'}`}
            >
              Manage{follows && follows.total > 0 ? ` (${follows.total})` : ''}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-[#F7F7F8] transition-colors hover:bg-[#171A20]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-safe">
          {!authed && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <Users className="h-8 w-8 text-[#FF5A1F]" />
              <p className="max-w-xs text-[13px] font-semibold text-[#F7F7F8]">
                Sign in to follow places, businesses, publishers, organizers and communities.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="rounded-full bg-[#FF5A1F] px-5 py-2.5 text-[13px] font-bold text-[#0D0F12]"
              >
                Sign in
              </button>
            </div>
          )}

          {authed && loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-[rgba(247, 247, 248,0.62)]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22E6E0] border-t-transparent" />
              <p className="text-[12px] font-semibold">Loading…</p>
            </div>
          )}

          {authed && !loading && tab === 'following' && (
            <div className="space-y-5 px-4 pb-10 pt-4 sm:px-5">
              {(!feed || feed.length === 0) && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#222630] px-6 py-12 text-center">
                  <Plus className="h-6 w-6 text-[rgba(247, 247, 248,0.4)]" />
                  <p className="text-[13px] font-semibold text-[#F7F7F8]">Nothing followed yet</p>
                  <p className="max-w-xs text-[12px] leading-relaxed text-[rgba(247, 247, 248,0.62)]">
                    Open any place, business, publisher, organizer or community and follow it —
                    its new information will collect here.
                  </p>
                </div>
              )}
              {feed?.map((section) => (
                <section key={section.entityId} aria-label={section.name}>
                  <button
                    type="button"
                    onClick={() => onOpenEntity(section.entityId)}
                    className="group mb-2 flex w-full items-center gap-2 text-left"
                  >
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8] group-hover:text-[#FF5A1F]">
                      {section.name}
                    </span>
                    <span className="rounded-full bg-[#171A20] px-2 py-0.5 text-[10px] font-bold text-[#FF5A1F]">
                      {KIND_SINGULAR[section.kind] ?? section.kind}
                    </span>
                    {section.location?.area && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[rgba(247, 247, 248,0.62)]">
                        <MapPin className="h-3 w-3" /> {section.location.area}
                      </span>
                    )}
                  </button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.objects.map((o) => {
                      const line = temporalLine(o);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => onOpenObject(o)}
                          className="group flex items-stretch gap-2.5 rounded-2xl border border-[#222630] bg-[#12151A] p-2 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-[#22E6E0]"
                        >
                          {o.imageUrl ? (
                            <img src={o.imageUrl} alt="" aria-hidden="true" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1D2027] to-[#0D0F12] text-[10px] font-bold uppercase text-[#171A20]">
                              {o.type.slice(0, 4)}
                            </div>
                          )}
                          <div className="min-w-0 py-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#22E6E0]">{o.type}</span>
                              {line && <span className="text-[9px] font-semibold text-[rgba(247, 247, 248,0.62)]">{line}</span>}
                            </div>
                            <h4 className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug text-[#F7F7F8] group-hover:text-[#FF5A1F]">
                              {o.title}
                            </h4>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {authed && !loading && tab === 'manage' && (
            <div className="px-4 pb-10 pt-4 sm:px-5">
              {kindOrder.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#222630] px-6 py-12 text-center">
                  <Users className="h-6 w-6 text-[rgba(247, 247, 248,0.4)]" />
                  <p className="text-[13px] font-semibold text-[#F7F7F8]">You're not following anything yet</p>
                  <p className="max-w-xs text-[12px] leading-relaxed text-[rgba(247, 247, 248,0.62)]">
                    Follow a venue or business from its page and it will show up here.
                  </p>
                </div>
              )}
              {kindOrder.map((kind) => {
                const items = follows?.groups[kind] ?? [];
                if (items.length === 0) return null;
                return (
                  <section key={kind} aria-label={KIND_LABELS[kind]} className="mb-5">
                    <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8]">
                      {KIND_LABELS[kind]} <span className="text-[rgba(247, 247, 248,0.45)]">· {items.length}</span>
                    </h3>
                    <div className="grid gap-2">
                      {items.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 rounded-2xl border border-[#222630] bg-[#12151A] p-2.5 shadow-sm"
                        >
                          {f.imageUrl ? (
                            <img src={f.imageUrl} alt="" aria-hidden="true" className="h-10 w-10 rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5A1F] to-[#1D2027] text-[#F7F7F8]">
                              <Users className="h-4 w-4" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenEntity(f.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-[13px] font-bold text-[#F7F7F8] hover:text-[#FF5A1F]">{f.name}</p>
                            <p className="truncate text-[10px] font-semibold text-[rgba(247, 247, 248,0.62)]">
                              {f.objectCount} {f.objectCount === 1 ? 'item' : 'items'}
                              {f.location?.area ? ` · ${f.location.area}` : ''}
                              {f.sourceNames?.[0] ? ` · ${f.sourceNames[0]}` : ''}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => unfollow(f.id)}
                            className="flex items-center gap-1 rounded-full border border-[#222630] px-2.5 py-1.5 text-[10px] font-bold text-[#F7F7F8] transition-colors hover:border-[#FF5D6C] hover:bg-[#171A20] hover:text-[#FF5D6C]"
                          >
                            <X className="h-3 w-3" /> Unfollow
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {kindOrder.length > 0 && (
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[rgba(247, 247, 248,0.5)]">
                  <Check className="h-3 w-3" /> Your follows are private to you.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
