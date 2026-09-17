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
//   * category chip, title, date · location · price, and the counted
//     "N going" — every figure derived, never seeded.
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
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide"
          style={{ background: "rgba(255,255,255,0.9)", color: "var(--color-text)" }}
        >
          {event.categoryLabel}
        </span>
        {event.featured && (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold"
            style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
          >
            ★ Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-extrabold text-[var(--color-text)] leading-snug line-clamp-2">
          {event.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)]">
          {event.startsAt && <span>{event.startsAt.slice(0, 10)}</span>}
          {event.location && <span className="truncate">{event.location}</span>}
          <span>{event.goalAmount != null ? "Cause / pot" : money(event.price, event.currency)}</span>
          <span>{event.popularity} going</span>
        </div>
        {/* Group overlap — the unique, derived social proof. Only shown when
            the viewer's own group genuinely has members going. */}
        {event.tableBankingOverlap && event.tableBankingOverlap.length > 0 && (
          <p className="text-[10px] font-bold" style={{ color: "var(--color-primary)" }}>
            {event.tableBankingOverlap.map((o) => `${o.memberCount} from ${o.tableBankingName ?? "your Circle"}`).join(" · ")} going
          </p>
        )}
      </div>
    </button>
  );
}
