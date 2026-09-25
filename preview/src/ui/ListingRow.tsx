import React from 'react';
import { ChevronRight } from 'lucide-react';
import { PHOTO_FILTER } from '../features/city/room';

// ---------------------------------------------------------------------------
// LISTING ROW — the quiet shelf line. Title, one money-or-measure line, one
// dim sub-line, a chevron. The whole row is the tap: no button per card.
// A photo, when the row has one, is a small graded thumb — never the design.
// ---------------------------------------------------------------------------

export const ListingRow: React.FC<{
  /** Resolved image URL, or null for a text-only row. */
  image?: string | null;
  imageAlt?: string;
  title: string;
  /** The money or measure line: price, member count, Free. */
  meta?: string | null;
  /** The dim line: seller, where/when, role. */
  sub?: string | null;
  onOpen?: () => void;
  testId?: string;
}> = ({ image = null, imageAlt = '', title, meta = null, sub = null, onOpen, testId }) => (
  <button
    type="button"
    onClick={onOpen}
    data-testid={testId ? `globys-card-${testId}` : 'listing-row'}
    className="w-full flex items-center gap-3 py-3 text-left cursor-pointer"
    style={{ borderBottom: '1px solid var(--divider)' }}
  >
    {image ? (
      <img
        src={image}
        alt={imageAlt}
        loading="lazy"
        className="w-14 h-14 rounded-xl object-cover shrink-0"
        style={{ filter: PHOTO_FILTER }}
      />
    ) : null}
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold leading-snug truncate" style={{ color: 'var(--brief-ink)' }}>
        {title}
      </span>
      {meta ? (
        <span className="block text-[13px] font-bold mt-0.5" style={{ color: 'var(--brief-ink)' }}>
          {meta}
        </span>
      ) : null}
      {sub ? (
        <span className="block text-[12px] truncate" style={{ color: 'var(--muted-ink)' }}>
          {sub}
        </span>
      ) : null}
    </span>
  </button>
);

export default ListingRow;
