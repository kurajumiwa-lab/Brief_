// ---------------------------------------------------------------------------
// EVENT CARD — the emotional first impression, honest about what exists.
//
// The critique's sharpest point: the feed card was text-only, so a cover-less
// event read as a void. This card gives every event a visual identity:
//
//   * a REAL cover image when the campaign carries one (metadata.image), lazy
//     loaded with a solid placeholder so it never flashes;
//   * otherwise the CATEGORY's tint — the same wing is always the same colour.
//     The oversized title initial is gone: "W" for "Wedding" mapped to nothing
//     the reader knows, so it read as a placeholder rather than a design;
//   * category chip, title, date · location · price. That is the whole card.
//
// DECISION 6 (docs/DECISIONS.md) removed three things this card used to carry,
// and server/test/decisions.mjs fails if the server starts serving them again:
// the "★ Featured" badge (no featured slot anywhere), the counted "N going"
// (no social proof — "No 'X going.' No attendee names. No view count."), and
// the "N from your Circle going" line (the decision's supersession note ends
// the per-viewer overlap explicitly). The only number an event may print is
// seats, and the listing projection carries none — capacity and remaining live
// on the detail page, which is where "27 of 40 seats remaining" belongs.
//
// What is left is not a thinner card by accident. The rationale is the
// operator's: these mechanics drive FOMO, and FOMO does not pay the host.
// ---------------------------------------------------------------------------

import React from "react";
import type { EventListing } from "../../api/briefApi";
import { categoryWash } from "../../features/city/categoryPalette";
import { PLASTER } from "../../features/city/room";
import { PHOTO_FILTER } from "../../features/city/room";

const money = (n: number, c: string) => (n === 0 ? "Free" : `${c} ${n.toLocaleString()}`);

export function EventCard({ event, onOpen }: { event: EventListing; onOpen: (slug: string) => void }) {
  const wash = categoryWash(event.category);

  return (
    <button
      type="button"
      onClick={() => onOpen(event.slug)}
      className="w-full text-left rounded-2xl overflow-hidden bg-[color:var(--color-paper)] brief-lift-2 cursor-pointer transition-shadow"
    >
      {/* Cover — a real photograph, or the room's own plaster carrying the wing's
          colour as light. Never black, never a stock image, never a cold swatch. */}
      <div className="relative h-28 w-full">
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ background: PLASTER, filter: PHOTO_FILTER }}
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: PLASTER }} />
            <div className="absolute inset-0" style={{ background: wash }} />
          </>
        )}
        {/* Category chip over the cover */}
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide"
          style={{ background: "rgba(255,255,255,0.9)", color: "var(--color-text)" }}
        >
          {event.categoryLabel}
        </span>
        {/* No "★ Featured" badge — Decision 6: no featured slot anywhere. The
            server no longer sends `featured`, and the route that set it is
            retired (404), so there is nothing this badge could honestly mean. */}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-extrabold text-[var(--color-text)] leading-snug line-clamp-2">
          {event.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
          {event.startsAt && <span>{event.startsAt.slice(0, 10)}</span>}
          {event.location && <span className="truncate">{event.location}</span>}
          <span>{event.goalAmount != null ? "Cause / pot" : money(event.price, event.currency)}</span>
          {/* No "{popularity} going" and no "N from your Circle going".
              Decision 6 forbids both: no "X going", no attendee names, no view
              count. The circle line was derived from real rows and was still
              social proof — the decision says so explicitly. */}
        </div>
      </div>
    </button>
  );
}
