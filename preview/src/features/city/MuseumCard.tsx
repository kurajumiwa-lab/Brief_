// ---------------------------------------------------------------------------
// MUSEUM CARD — one "exhibit" in the swipe gallery. Frameless, edge-to-edge,
// full-bleed: the photo is the frame. The active card is the only one with an
// action; every other card recedes (scaled + dim).
//
// The monogram is gone. A giant "W" for "Wedding" mapped to nothing the user
// knows, so it read as a placeholder. A cover-less exhibit now carries its
// CATEGORY's tint instead — a colour that means something (the same wing is
// always the same colour) rather than a letter that means nothing.
//
// Every figure on the card is real, from the EventListing the server derived:
//   title / categoryLabel / location / startsAt / price / popularity (COUNTED
//   registrations) / tableBankingOverlap (the viewer's own group, derived).
// "Opened 2d ago" is also real, but local: it is this device's own record of
// opening the event (viewMemory). Nothing else about the viewer is claimed.
// ---------------------------------------------------------------------------

import React from "react";
import { Eye, Sparkles } from "lucide-react";
import type { EventListing } from "../../api/briefApi";
import { formatStartsAt } from "../../model/core";
import { categoryAccent, categoryWash } from "./categoryPalette";
import { PLASTER } from "./room";
import { PHOTO_FILTER, PHOTO_SCRIM } from "./room";

const money = (n: number, c: string) => (n === 0 ? "Free" : `${c} ${n.toLocaleString()}`);

export interface MuseumCardProps {
  event: EventListing;
  isActive: boolean;
  onOpen: (slug: string) => void;
  /** Real: this exhibit appeared in the case after you last looked at it. */
  isNew?: boolean;
  /** Real: days since THIS DEVICE opened it. Null when it never did. */
  openedAgoDays?: number | null;
}

export function MuseumCard({ event, isActive, onOpen, isNew = false, openedAgoDays = null }: MuseumCardProps) {
  // The wing's colour as a light on the room, not as a fill behind the text.
  const wash = categoryWash(event.category);
  const accent = categoryAccent(event.category);
  const price = event.goalAmount != null ? "Cause / pot" : money(event.price, event.currency);
  const date = formatStartsAt(event.startsAt);

  return (
    <article
      className={`snap-center shrink-0 w-[55vw] max-w-sm h-[45vh] max-h-[560px] relative overflow-hidden rounded-[28px] transition-all duration-500 ease-out brief-lift-3 ${
        isActive ? "scale-100 opacity-100" : "scale-[0.92] opacity-60"
      }`}
    >
      {/* Background — real image, or the category's tint. Never a letter. */}
      <div className="absolute inset-0">
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            draggable={false}
            className="w-full h-full object-cover"
            style={{ background: PLASTER, filter: PHOTO_FILTER }}
          />
        ) : (
          // No cover: the wing's colour at wash strength over the room's own
          // plaster, plus a mark that means something. Never a stock photo,
          // never a letter, never a dark panel.
          <div className="w-full h-full relative" style={{ background: PLASTER }}>
            <span className="absolute inset-0" style={{ background: wash }} />
            <span
              className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {event.categoryLabel ?? 'the case'} · waiting on a cover
            </span>
          </div>
        )}
      </div>

      {/* Scrim — keeps the text legible over any photo */}
      <div className="absolute inset-0" style={{ background: PHOTO_SCRIM }} />

      {/* Breathing accent — one pixel at the foot of the active exhibit. It is
          decoration, not data: no count, no claim, and reduced-motion kills it. */}
      {isActive && (
        <div
          className="brief-card-breathe absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "rgba(255,255,255,0.9)" }}
          aria-hidden="true"
        />
      )}

      {/* Category wing + the honest "new" mark (a row that appeared since you
          last looked — derived from the listing set, not pushed to you) */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[var(--paper-95)] text-black px-3 py-1 rounded-full">
          {event.categoryLabel}
        </span>
        {isNew && (
          <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-[var(--paper-95)] text-black flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            New
          </span>
        )}
      </div>

      {/* Featured mark — the organiser's explicit choice, never a ranking */}
      {event.featured && (
        <div className="absolute top-4 right-4">
          <span
            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
            style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
          >
            ★ Featured
          </span>
        </div>
      )}

      {/* Content overlay — bottom of the card */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h3 className="text-[22px] font-extrabold leading-tight line-clamp-2">{event.title}</h3>

        {/* Meta line — the format that worked, kept verbatim */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-white/85">
          {date && <span>{date}</span>}
          {event.location && (
            <>
              <span className="w-1 h-1 rounded-full bg-[var(--paper-40)]" />
              <span className="truncate">{event.location}</span>
            </>
          )}
          <span className="w-1 h-1 rounded-full bg-[var(--paper-40)]" />
          <span>{price}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--paper-40)]" />
          <span>{event.popularity} going</span>
        </div>

        {/* Social proof — the viewer's own group, derived. Real, not invented. */}
        {event.tableBankingOverlap && event.tableBankingOverlap.length > 0 && (
          <p className="mt-1.5 text-[12px] text-white/80">
            {event.tableBankingOverlap.map((o) => `${o.memberCount} from ${o.tableBankingName ?? "your Circle"}`).join(" · ")} going
          </p>
        )}

        {/* A real local fact: this device opened this exhibit. */}
        {openedAgoDays != null && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/70">
            <Eye className="w-3 h-3" />
            you opened this {openedAgoDays === 0 ? "today" : `${openedAgoDays}d ago`}
          </p>
        )}

        {/* Action row — the ACTIVE card only (the exhibit gets the price tag). */}
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
