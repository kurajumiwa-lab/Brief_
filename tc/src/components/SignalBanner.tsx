import React from 'react';

// ---------------------------------------------------------------------------
// SIGNAL BANNER — the one banner pattern (§5)
//
// A Signal Banner does one of three jobs (four with the Arena Jumbotron). If a
// banner can't be sorted into one of these, it doesn't ship. Every variant is
// either wired to a real number/state, opens a real detail on tap, or is the
// whole call-to-action for an empty section — never a dead graphic.
// ---------------------------------------------------------------------------

/* --- 5.1 PULSE: a live number or state. Tap always expands to detail. ------ */
export interface PulseBannerProps {
  /** The live headline number/word, in mono. */
  value: string;
  /** What the number is. */
  label: string;
  /** A small sparkline path string (SVG points). */
  spark?: string;
  accent?: string;
  /** Expanded detail children (shown after tap). */
  detail?: React.ReactNode;
  live?: boolean;
}

export function PulseBanner({ value, label, spark, accent = 'var(--signal-live)', detail, live = true }: PulseBannerProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="brief-banner-in rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
      <button
        onClick={() => detail && setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {live && <span className="brief-breathe h-2 w-2 rounded-full" style={{ background: accent }} />}
            <span className="font-mono-live text-2xl font-semibold" style={{ color: accent }}>{value}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--ink-dim)]">{label}</p>
        </div>
        {spark && (
          <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0 opacity-80" aria-hidden="true">
            <polyline points={spark} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && detail && (
        <div className="brief-rise-in border-t border-[var(--hairline)] px-4 py-3">{detail}</div>
      )}
    </div>
  );
}

/* --- 5.2 TICKER: horizontal auto-scroll of tappable items. Pauses on touch. */
export interface TickerBannerProps {
  items: { id: string; label: string; accent?: string }[];
  onOpen: (id: string) => void;
}

export function TickerBanner({ items, onOpen }: TickerBannerProps) {
  if (items.length === 0) return null;
  // Duplicate the strip once so the 50% translate loops seamlessly.
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] py-2.5">
      <div className="brief-marquee">
        {loop.map((it, i) => (
          <button
            key={`${it.id}-${i}`}
            onClick={() => onOpen(it.id)}
            className="mx-1.5 shrink-0 rounded-full border border-[var(--hairline)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-dim)] transition-colors active:border-[var(--ink)]"
            style={it.accent ? { color: it.accent, borderColor: `${it.accent}55` } : undefined}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --- 5.3 PROMPT: the empty state as a full-surface CTA. Dry, non-apologetic. */
export interface PromptBannerProps {
  line1: string;
  line2: string;
  action: string;
  onAction: () => void;
}

export function PromptBanner({ line1, line2, action, onAction }: PromptBannerProps) {
  return (
    <button
      onClick={onAction}
      className="brief-banner-in w-full rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)] px-5 py-6 text-left transition-transform active:scale-[0.97]"
    >
      <p className="font-display text-lg font-semibold text-[var(--ink)]">{line1}</p>
      <p className="mt-1 text-[12px] text-[var(--ink-dim)]">{line2}</p>
      <span className="mt-4 inline-block rounded-full bg-[var(--signal-live)] px-4 py-1.5 text-[12px] font-bold text-[var(--ground)]">
        {action}
      </span>
    </button>
  );
}

/* --- 5.4 JUMBOTRON (Arena-only): rotating full-width banners on the static bg. */
export interface JumbotronItem {
  id: string;
  glyph: string;
  title: string;
  meta: string;
  urgent?: boolean;
}

export interface JumbotronBannerProps {
  items: JumbotronItem[];
  onOpen: (id: string) => void;
}

export function JumbotronBanner({ items, onOpen }: JumbotronBannerProps) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (items.length === 0) return null;
  const item = items[index];

  return (
    <div
      className="relative h-36 w-full overflow-hidden rounded-2xl border border-[var(--hairline)]"
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 80% 20%, rgba(62,142,255,0.22), transparent 60%), var(--overlay-scrim)' }}
      />
      <button onClick={() => onOpen(item.id)} className="absolute inset-0 flex items-center justify-between px-5 text-left">
        <div className="min-w-0">
          <p className="font-mono-live text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: item.urgent ? 'var(--signal-urgent)' : 'var(--signal-arena)' }}>
            {item.urgent ? 'Closing soon' : 'Now in the lobby'}
          </p>
          <p className="font-display mt-1 text-xl font-semibold text-[var(--ink)]">{item.title}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-dim)]">{item.meta}</p>
        </div>
        <span className="brief-banner-in text-5xl drop-shadow-[0_0_18px_rgba(62,142,255,0.5)]">{item.glyph}</span>
      </button>
      {/* rotation dots */}
      {items.length > 1 && (
        <div className="absolute bottom-2.5 right-4 flex gap-1.5">
          {items.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === index ? 16 : 6, background: i === index ? 'var(--signal-arena)' : 'var(--hairline)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Sparkline — a live-updating readout line (§7.5). The one ambient motion
   element Pulse is allowed in addition to a pulse dot. It draws a moving line
   that "sweeps" a live data stream; the points are supplied, the sweep is CSS. */
export interface SparklineProps {
  points: string;
  accent?: string;
  height?: number;
  live?: boolean;
}

export function Sparkline({ points, accent = 'var(--today)', height = 40, live = true }: SparklineProps) {
  // A CSS-only "live" line: the sweep is a stroke-dash draw that repeats, so it
  // reads as a readout that is always mid-update. Killed by prefers-reduced-motion.
  return (
    <svg viewBox="0 0 100 40" className="w-full" style={{ height }} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${points} 100,40`} fill="url(#sparkFill)" />
      <polyline
        points={points}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="220"
        className={live ? 'brief-spark-sweep' : ''}
      />
      <circle r="2" fill={accent} className={live ? 'brief-spark-dot' : ''} />
    </svg>
  );
}
