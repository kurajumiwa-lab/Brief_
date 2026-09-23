import React from 'react';
import { ArrowLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// OVERLAY SCREEN — a second screen with a way out.
//
// A category on You, the inbox on a space: both used to expand in the page
// flow, so the operator had to scroll past the grid they just tapped to reach
// the thing they asked for. This is the natural state of those surfaces: a
// full screen, a Back, a title that is the category (not a door the bar
// already names). The host owns the URL; this component only paints.
// ---------------------------------------------------------------------------

export function OverlayScreen({
  title,
  onBack,
  children,
  label
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
      className="fixed inset-0 z-40 overflow-y-auto px-4 pt-4 pb-24"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold cursor-pointer"
          style={{ color: 'var(--color-text)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export default OverlayScreen;
