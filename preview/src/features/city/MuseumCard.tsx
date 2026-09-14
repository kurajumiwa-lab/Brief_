// ---------------------------------------------------------------------------
// MUSEUM CARD — one "exhibit" in the swipe gallery. Frameless, edge-to-edge,
// full-bleed: the image (or a deterministic gradient) is the frame. The active
// card is the only one with an action; every other card recedes (scaled + dim).
//
// Every figure on the card is real, from the EventListing the server derived:
//   title / categoryLabel / location / startsAt / price / popularity (COUNTED
//   registrations) / tableBankingOverlap (the viewer's own group, derived).
// There is no seeded "going" count and no fabricated social proof.
// ---------------------------------------------------------------------------

import React from "react";
import type { EventListing } from "../../api/briefApi";
import { formatStartsAt } from "../../model/core";

// Deterministic two-tone gradients keyed by title, so the same event always
// gets the same identity and a cover-less event never renders a blank box.
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

export function MuseumCard({
  event,
  isActive,
  onOpen
}: {
  event: EventListing;
  isActive: boolean;
  onOpen: (slug: string) => void;
}) {
  const gradient = GRADIENTS[titleHash(event.title) % GRADIENTS.length];
  const initial = (event.title || "?").trim().charAt(0).toUpperCase();
  const price = event.goalAmount != null ? "Cause / pot" : money(event.price, event.currency);
  const date = formatStartsAt(event.startsAt);

  return (
    <article
      className={`snap-center shrink-0 w-[55vw] max-w-sm h-[45vh] max-h-[560px] relative overflow-hidden rounded-[28px] transition-all duration-500 ease-out ${
        isActive ? "scale-100 opacity-100" : "scale-[0.92] opacity-60"
      }`}
    >
      {/* Background — image OR deterministic gradient, frameless, edge-to-edge */}
      <div className="absolute inset-0">
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            draggable={false}
            className="w-full h-full object-cover"
            style={{ background: "var(--color-surface-elevated)" }}
          />
        ) : (
          <div className="w-full h-full" style={{ background: gradient }} />
        )}
      </div>

      {/* Scrim — makes the text legible over any photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35" />

      {/* Category chip — top-left */}
      <div className="absolute top-4 left-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/95 text-black px-3 py-1 rounded-full">
          {event.categoryLabel}
        </span>
      </div>

      {/* Featured mark */}
      {event.featured && (
        <div className="absolute top-4 right-4">
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}>
            ★ Featured
          </span>
        </div>
      )}

      {/* Fallback monogram — if no image, the title's initial, huge */}
      {!event.coverImageUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[80px] font-black text-white/25 select-none">{initial}</span>
        </div>
      )}

      {/* Content overlay — bottom of the card */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h3 className="text-[22px] font-extrabold leading-tight line-clamp-2">{event.title}</h3>

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-white/85">
          {date && <span>{date}</span>}
          {event.location && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/40" />
              <span className="truncate">{event.location}</span>
            </>
          )}
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span>{price}</span>
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span>{event.popularity} going</span>
        </div>

        {/* Social proof — the viewer's own group, derived. Real, not invented. */}
        {event.tableBankingOverlap && event.tableBankingOverlap.length > 0 && (
          <p className="mt-1.5 text-[12px] text-white/80">
            {event.tableBankingOverlap.map((o) => `${o.memberCount} from ${o.tableBankingName ?? "your Circle"}`).join(" · ")} going
          </p>
        )}

        {/* Action row — appears on the ACTIVE card only (rule #8). */}
        {isActive && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => onOpen(event.slug)}
              className="flex-1 font-extrabold text-[13px] py-3 rounded-2xl active:scale-[0.98] transition cursor-pointer"
              style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
            >
              View event
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default MuseumCard;
