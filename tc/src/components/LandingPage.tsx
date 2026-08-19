import React from 'react';

// ---------------------------------------------------------------------------
// LANDING PAGE — Brief's front door
//
// Adopts the PayPal landing *structure* (sticky header, split hero, features
// strip) translated into Brief's dark design system and its honest voice.
// Every claim maps to a real, tested capability; nothing overpromises a rail
// that needs credentials. The hero visual is the pipeline — the one thing
// Brief actually does — rendered as a living graphic, not a stock lifestyle
// photo.
// ---------------------------------------------------------------------------

export interface LandingPageProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    glyph: '🧭',
    title: 'Discover',
    body: 'Events, places and opportunities near you — ranked by what is real, verified and fresh, not what is promoted.'
  },
  {
    glyph: '🗓️',
    title: 'Organize',
    body: 'Start a gathering anywhere, sell tickets, and check people in at the gate with a scannable code.'
  },
  {
    glyph: '⚡',
    title: 'Transact',
    body: 'Orders and payments that settle on a real ledger. No pretend money, no fabricated success.'
  }
];

function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="9" fill="var(--signal-live)" opacity="0.15" />
        <circle cx="13" cy="13" r="4" fill="var(--signal-live)" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Brief</span>
    </span>
  );
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ground)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>
      {/* Sticky top navigation */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--hairline)', background: 'var(--ground)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-8">
            <BrandMark />
            <nav className="hidden items-center gap-6 sm:flex">
              <a href="#discover" className="text-[13px] font-medium" style={{ color: 'var(--ink-dim)' }}>Discover</a>
              <a href="#organize" className="text-[13px] font-medium" style={{ color: 'var(--ink-dim)' }}>Organize</a>
              <a href="#transact" className="text-[13px] font-medium" style={{ color: 'var(--ink-dim)' }}>Transact</a>
            </nav>
          </div>
          <button
            onClick={onEnter}
            className="rounded-full px-5 py-2 text-[13px] font-bold transition-transform active:scale-[0.97]"
            style={{ background: 'var(--signal-live)', color: 'var(--ground)' }}
          >
            Enter Brief
          </button>
        </div>
      </header>

      <main>
        {/* Split hero */}
        <section className="overflow-hidden px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
            <div className="brief-rise-in max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--signal-live)' }}>
                A live layer over your city
              </p>
              <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.1] sm:text-5xl" style={{ color: 'var(--ink)' }}>
                Know what's happening.<br />Act on it.<br /><span style={{ color: 'var(--signal-live)' }}>Get paid.</span>
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                Brief turns what your community already posts — on Telegram, WhatsApp, the web — into things you can find,
                trust and act on, and keeps the whole journey in one place.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={onEnter}
                  className="rounded-full px-7 py-3 text-[15px] font-bold transition-transform active:scale-[0.97]"
                  style={{ background: 'var(--signal-live)', color: 'var(--ground)' }}
                >
                  Get started — free
                </button>
                <a href="#how" className="px-5 py-3 text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  How it works →
                </a>
              </div>
            </div>

            {/* Hero visual: the pipeline, living. The one ambient loop allowed. */}
            <div className="brief-rise-in">
              <div
                id="how"
                className="brief-silk relative overflow-hidden rounded-2xl border p-6"
                style={{ borderColor: 'var(--hairline)', backgroundImage: 'linear-gradient(135deg, #0e1a12 0%, #0d3320 50%, #070a0e 100%)', backgroundSize: '220% 220%' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--signal-live)' }}>
                  The pipeline
                </p>
                <div className="mt-5 flex items-center gap-0">
                  {[
                    { g: '⇣', t: 'Message in' },
                    { g: '◇', t: 'Brief understands it' },
                    { g: '✓', t: 'Thing to act on' }
                  ].map((s, i) => (
                    <React.Fragment key={s.t}>
                      <div className="flex flex-1 flex-col items-center gap-2 text-center">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold"
                          style={{ borderColor: 'var(--signal-live)', color: 'var(--signal-live)', boxShadow: '0 0 16px rgba(67,209,122,0.25)' }}
                        >
                          {s.g}
                        </span>
                        <span className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{s.t}</span>
                      </div>
                      {i < 2 && <div className="brief-flow-connector mx-1 h-0.5 w-8 flex-none" />}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-6 rounded-lg px-3 py-2 font-mono text-[11px]" style={{ background: 'var(--ground)', color: 'var(--signal-live)' }}>
                  "Saturday popup at Kilimani Studio, KES 300 entry" → one findable, verifiable event
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features strip */}
        <section className="px-5 py-16" style={{ background: 'var(--surface)' }}>
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-6 md:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  id={f.title.toLowerCase()}
                  className="brief-rise-in rounded-2xl border p-6"
                  style={{ borderColor: 'var(--hairline)', animationDelay: `${i * 60}ms` }}
                >
                  <span className="text-2xl">{f.glyph}</span>
                  <h3 className="font-display mt-3 text-xl font-semibold" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--ink-dim)' }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest footer */}
        <footer className="border-t px-5 py-8" style={{ borderColor: 'var(--hairline)' }}>
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
            <BrandMark />
            <p className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              A context layer over the channels you already use. Telegram and WhatsApp connect when you do.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default LandingPage;
