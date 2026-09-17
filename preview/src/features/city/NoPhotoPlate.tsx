// ---------------------------------------------------------------------------
// NO-PHOTO PLATE — what a card shows when the seller has not uploaded a picture.
//
// It used to be a blue-violet gradient with the words "NO PHOTO FROM JJ" in the
// middle: a cold, generic rectangle that looked like a different product had
// been left on top of the page. A card with no photograph is not a broken card,
// it is a card that is WAITING, so it now shows the room's own surface (the same
// plaster, the same light), a mark that means something, and the row's real
// timestamp.
//
// What it will not do:
//   * show a stock image, an emoji "food photo", or a pattern standing in for
//     goods nobody has photographed;
//   * invent a caption. `stamp` is the listing's own createdAt rendered by
//     listedAgo() — when the row has no timestamp, no line is printed;
//   * guess a category. `icon` comes from the flow the SELLER declared; a
//     listing that declared no flow gets the room mark, nothing more.
// ---------------------------------------------------------------------------

import React from 'react';
import { Package } from 'lucide-react';
import { PLASTER, plateGlow, listedAgo } from './room';

export interface NoPhotoPlateProps {
  /** Whose photo is missing, exactly as it is on the row. */
  seller?: string | null;
  /** Small uppercase mark, e.g. the declared flow. Null = no label at all. */
  mark?: string | null;
  /** The mark's icon: derived from what the seller declared, never hashed. */
  icon?: React.ReactNode;
  /** Real timestamp string from listedAgo(), or null when the row has none. */
  stamp?: string | null;
  /** Cover plates want no copy; a full card can carry the two quiet lines. */
  quiet?: boolean;
  /** The hue of the wing or flow the row declares. A colour that means
   *  something, never one derived from a title. */
  accent?: string | null;
  className?: string;
}

export function NoPhotoPlate({ seller, mark = null, icon = null, stamp = null, quiet = false, accent = null, className = '' }: NoPhotoPlateProps) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 flex flex-col justify-between p-3 ${className}`}
      style={{ background: PLASTER }}
    >
      {/* The plate is two layers: the room's plaster, then a corner of accent
          light. Painting the plaster first means a surface still looks right in
          a browser (or a test) that never parses a multi-layer background. */}
      <span className="absolute inset-0" style={{ background: plateGlow(accent ?? 'var(--color-primary)') }} />
      <span className="flex items-center justify-between gap-2">
        <span
          className="w-8 h-8 rounded-2xl grid place-items-center"
          style={{ background: 'rgba(255,255,255,0.72)', color: accent ?? 'var(--color-primary)' }}
        >
          {icon ?? <Package className="w-4 h-4" />}
        </span>
        {mark && (
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.14em] font-mono"
            style={{ background: 'rgba(24,19,12,0.055)', color: 'var(--brief-muted)' }}
          >
            {mark}
          </span>
        )}
      </span>
      {!quiet && (
        <span className="flex items-end justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-[11px] font-extrabold leading-tight" style={{ color: 'var(--brief-ink)' }}>
              Waiting on photo
            </span>
            <span className="block text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--brief-muted)' }}>
              {[seller ? `no photo from ${seller}` : 'no photo on this row', stamp].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

export { listedAgo };
export default NoPhotoPlate;
