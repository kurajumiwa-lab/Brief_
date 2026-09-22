// ---------------------------------------------------------------------------
// MUSEUM GALLERY — the events, as a two-column grid of the ONE card shape.
//
// The swipe case is gone: one card at a time with position dots and a
// "New" chip in the corner was a special shape among equal rows, and the
// card pattern's rule is one card shape with no corner badges. What the
// case keeps:
//   * every event is a REAL published campaign row from /api/events — nothing
//     is seeded to fill the case;
//   * no control row. This shelf used to carry a filter chip ("All exhibits",
//     then "All events") and a drawer of wing/place/date filters. The chip was
//     the third navigation for the events the board and Home already point at,
//     and the reorg deleted it: the case is everything published, soonest
//     first, and a reader who wants a narrower view goes to the board, where
//     the filters sit beside what they filter. Decision 6 removed the featured
//     toggle and the popularity sort for the same reason: a control the server
//     no longer has would visibly do nothing;
//   * no result counter — if you can see the exhibits, you can count them;
//   * every card carries the same lines — cover or waiting plate, title, the
//     real price, the where/when in mono, and the one action ("View event →")
//     on EVERY card, because a card that only gets a button when it is "the
//     active one" is two shapes pretending to be one;
//   * the case refreshes when the tab comes back to the foreground. No "New"
//     mark at all: a corner badge the device computes from its own memory of
//     last visit is decoration, not a fact, so it is gone rather than moved;
//   * an empty case says so plainly.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from "react";
import * as briefApi from "../../api/briefApi";
import type { EventListing } from "../../api/briefApi";
import { NoPhotoPlate } from "./NoPhotoPlate";
import { categoryAccent } from "./categoryPalette";
import { GlobysCard } from "../../ui/GlobysCard";
import { CalendarDays } from "lucide-react";

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function money(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString('en-KE')}`;
}

export function MuseumGallery({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setError(null);
    // The whole case: no category, no place, no window. The order is the
    // server's one order — startsAt ascending.
    const res = await briefApi.browseEvents({ limit: 50 });
    if (!res.ok) {
      if (!quiet) {
        setEvents([]);
        setError(res.error);
      }
      return;
    }
    setEvents(res.data.events);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Back to the tab -> re-read the ledger. A refresh on return, not a stream.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(true);
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', onVisible);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const open = (slug: string) => {
    if (typeof window !== "undefined") window.open(`/c/${slug}`, "_self");
  };

  const rows = events ?? [];

  return (
    <div className={className}>
      {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {events === null && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {events !== null && rows.length === 0 && !error && (
        <div className="p-5 rounded-3xl border border-dashed" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            Nothing is published yet.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            When an event goes live around you, it appears here.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {rows.map((e) => (
            <GlobysCard
              key={e.slug}
              testId={`exhibit-${e.slug}`}
              image={e.coverImageUrl}
              imageAlt={e.title}
              plate={
                <NoPhotoPlate
                  mark={e.categoryLabel ?? null}
                  icon={<CalendarDays className="w-4 h-4" />}
                  accent={categoryAccent(e.category)}
                />
              }
              title={e.title}
              price={e.goalAmount != null ? 'Contribution pot' : (e.price === 0 ? 'Free' : money(e.price, e.currency))}
              seller={null}
              mono={[timeOf(e.startsAt), e.location].filter(Boolean).join(' · ')}
              actionLabel="View event →"
              onAction={() => open(e.slug)}
              onOpen={() => open(e.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MuseumGallery;
