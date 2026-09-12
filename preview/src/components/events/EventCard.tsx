// ---------------------------------------------------------------------------
// EVENT CARD — the emotional first impression, honest about what exists.
//
// The critique's sharpest point: the feed card was text-only, so a cover-less
// event read as a void. This card gives every event a visual identity:
//
//   * a REAL cover image when the campaign carries one (metadata.image), lazy
//     loaded with a solid placeholder so it never flashes;
//   * otherwise a DETERMINISTIC gradient derived from the title (stable per
//     event, two-tone, never a black box) with the title's initial overlaid;
//   * category chip, title, date · location · price, and the counted
//     "N going" — every figure derived, never seeded.
// ---------------------------------------------------------------------------

import React from "react";
import type { EventListing } from "../../api/briefApi";

// Two-tone gradients keyed by a stable hash of the title, so the same event
// always gets the same visual identity and no event renders a blank box.
const GRADIENTS = [
  "linear-gradient(135deg, #4F46E5, #06B6D4)",
  "linear-gradient(135deg, #06B6D4, #10B981)",
  "linear-gradient(135deg, #8B5CF6, #4F46E5)",
  "linear-gradient(135deg, #0EA5E9, #4F46E5)",
  "linear-gradient(135deg, #14B8A6, #06B6D4)"
];

function titleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const money = (n: number, c: string) => (n === 0 ? "Free" : `${c} ${n.toLocaleString()}`);

export function EventCard({ event, onOpen }: { event: EventListing; onOpen: (slug: string) => void }) {
  const gradient = GRADIENTS[titleHash(event.title) % GRADIENTS.length];
  const initial = (event.title || "?").trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onOpen(event.slug)}
      className="w-full text-left rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer hover:border-[var(--color-accent)] transition-colors"
    >
      {/* Cover — real image, or a deterministic gradient fallback. Never black. */}
      <div className="relative h-28 w-full">
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ background: "var(--color-surface-elevated)" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: gradient }}
          >
            <span className="text-4xl font-black text-white/80">{initial}</span>
          </div>
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
        {/* Chama overlap — the unique, derived social proof. Only shown when
            the viewer's own group genuinely has members going. */}
        {event.chamaOverlap && event.chamaOverlap.length > 0 && (
          <p className="text-[10px] font-bold" style={{ color: "var(--color-primary)" }}>
            {event.chamaOverlap.map((o) => `${o.memberCount} from ${o.chamaName ?? "your chama"}`).join(" · ")} going
          </p>
        )}
      </div>
    </button>
  );
}
