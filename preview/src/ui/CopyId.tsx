import React, { useState } from 'react';
import { Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// COPY ID — copy-on-tap for a server reference (Stripe / GitHub pattern).
//
// This exists because every derived figure in Brief says "traces to a row".
// That promise is only worth something if the row reference can be taken to
// whoever you are arguing with — a counterparty, a dispute, your own notes. So
// the id sits next to the number, in mono, truncated to one line, and one tap
// puts it on the clipboard.
//
// Honesty rules, the same ones everywhere else here:
//   * it says "copied" only after the clipboard actually accepted the write;
//   * where the browser refuses (no permission, insecure context, old Android
//     WebView) it does NOT claim success — it reveals the full value so it can
//     be selected and copied by hand;
//   * it never copies anything the server didn't send. No prefixes, no
//     decoration, no "Brief-" vanity wrapper.
// ---------------------------------------------------------------------------

export interface CopyIdProps {
  /** The exact string to place on the clipboard. */
  value: string;
  /** Short label rendered before the id, e.g. "row". Optional. */
  label?: string;
  className?: string;
}

export function CopyId({ value, label, className = '' }: CopyIdProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const [revealed, setRevealed] = useState(false);

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setState('copied');
        setTimeout(() => setState('idle'), 1800);
        return;
      }
    } catch {
      /* fall through to the honest reveal below */
    }
    setState('unavailable');
    setRevealed(true);
  };

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      {label && (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label ?? 'reference'} ${value}`}
        title={state === 'unavailable' ? 'Copy it by hand — the text is shown' : 'Copy'}
        className="inline-flex items-center gap-1 max-w-full min-w-0 px-1.5 py-0.5 rounded-md cursor-pointer font-mono text-[10px] transition-colors"
        style={{
          background: state === 'copied' ? 'var(--color-primary-subtle)' : 'transparent',
          color: state === 'copied' ? 'var(--color-primary)' : 'var(--color-text-muted)',
          border: '1px solid var(--color-border)'
        }}
      >
        {state === 'copied' ? <Check className="w-3 h-3 shrink-0" /> : null}
        <span className={revealed ? 'break-all' : 'truncate'}>{state === 'copied' ? 'copied' : value}</span>
      </button>
    </span>
  );
}

export default CopyId;
