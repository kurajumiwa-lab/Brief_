// ---------------------------------------------------------------------------
// DERIVATION NOTE — one line in the way, the whole reasoning behind a tap.
//
// Brief's honesty layer is a real asset and it became a real problem: screens
// were carrying two-, three- and four-sentence paragraphs explaining what is NOT
// measured. A user does not read those; they feel them, as weight without
// movement. So the rule this component enforces:
//
//   * the surface states ONE line — what is true right now, in plain words;
//   * the full derivation (what was scanned, what is absent and why) is still
//     shipped, behind an explicit control, so nothing is hidden: it is
//     deferrable, never deleted. A number you cannot audit is a number you
//     should not show, and a number you can audit should not eat the screen.
//
// It is a disclosure, not a tooltip: keyboard reachable, labelled, and the
// summary is visible whether or not the detail ever opens. `prefers-reduced-motion`
// is irrelevant here — nothing animates beyond the browser's own disclosure.
// ---------------------------------------------------------------------------

import React from 'react';

export interface DerivationNoteProps {
  /** One line. What is true. No hedging, no paragraph. */
  summary: React.ReactNode;
  /** The full explanation, revealed on demand. */
  detail: React.ReactNode;
  label?: string;
  tone?: 'quiet' | 'warn';
  className?: string;
}

export function DerivationNote({ summary, detail, label = 'How this is derived', tone = 'quiet', className = '' }: DerivationNoteProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`space-y-1 ${className}`}>
      <p
        className="text-[12px] leading-snug"
        style={{ color: tone === 'warn' ? 'var(--color-warning)' : 'var(--brief-muted)' }}
      >
        {summary}{' '}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-bold underline decoration-dotted underline-offset-2 cursor-pointer whitespace-nowrap"
          style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
        >
          {open ? 'hide' : label}
        </button>
      </p>
      {open && (
        <p
          className="text-[11px] leading-relaxed rounded-xl px-2.5 py-2"
          style={{ background: 'var(--color-well)', color: 'var(--brief-muted)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

export default DerivationNote;
