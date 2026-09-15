import React, { useEffect } from 'react';

// ---------------------------------------------------------------------------
// FILTER SHEET — the drawer for controls that are used rarely.
//
// The rule it exists to enforce: a filter is not content. On the browse screen
// a four-row filter panel with two untouched date boxes read as "broken", not
// "empty", and spent a third of the viewport doing nothing. So the primary
// screen keeps ONE line of filters, and everything deeper lives in this sheet:
// it slides up from the bottom edge, closes on Escape, on the backdrop and on
// the single × in its header, and never covers the bottom navigation.
//
// Light theme only — it inherits the page tokens, no dark card.
// ---------------------------------------------------------------------------

export interface FilterSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional footer action, e.g. "Clear all". */
  footer?: React.ReactNode;
}

export function FilterSheet({ open, title, onClose, children, footer }: FilterSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="brief-sheet-up relative w-full max-w-lg rounded-t-3xl bg-white border-t border-black/5 shadow-2xl p-5 pb-7 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full text-sm font-bold cursor-pointer"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
          >
            ×
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-5 pt-4 border-t border-black/5">{footer}</div>}
      </div>
    </div>
  );
}

export default FilterSheet;
