// ---------------------------------------------------------------------------
// THE BELT — the top band, borrowed for its geometry and nothing else.
//
// Amazon's header works because of three structural decisions, and those are
// what this copies:
//
//   1. a hamburger owns the LONG list, so the always-visible band can stay short
//      (see `NavSheet`; the sheet rule that comes with it is that anything the
//      sheet holds does not also get a shelf on Home);
//   2. a departments rail of one-word links under the band, so a category is one
//      tap from anywhere. The words here are imported from the app's own
//      taxonomy (`features/city/taxonomy`) — a belt that typed its own category
//      list would be a second taxonomy, and the second one always loses;
//   3. a site-wide message slot ABOVE the content.
//
// Everything else in that header is refused, on purpose:
//   * no "Delivering to <city>" that was inferred from an IP. The chip says the
//     area the member typed, or says it is unset;
//   * no cart badge, no "X people viewed this", no deal countdown, no "Early
//     Prime Deals" urgency, no Sponsored label, no ad beacon. Those are the
//     parts of that design that make people act against their own interest, and
//     this product's whole claim is the opposite;
//   * the search box resolves. It is not decoration: it writes `#search/<q>`,
//     which the shell answers with the real `/api/search` surface. A box that
//     filtered nothing would be the worst thing on this screen, because it
//     would teach the member that nothing here can be trusted.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { Menu, Search, MapPin, ArrowRight } from 'lucide-react';
import { TraceMark } from '../components/TraceMark';
import { FLOW_ORDER, SIDE_ORDER } from '../features/city/taxonomy';
import type { DiscoverRoom } from '../features/city/taxonomy';
import * as briefApi from '../api/briefApi';
import type { CampaignBanner } from '../api/types';
import { soundEngine } from '../utils/SoundEngine';

export const PLACE_KEY = 'brief.world.place';
export const readPlace = () => {
  try { return typeof localStorage !== 'undefined' ? String(localStorage.getItem(PLACE_KEY) ?? '').trim() : ''; }
  catch { return ''; }
};

const DAY = new Intl.DateTimeFormat('en-KE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
const dayWords = (iso: string | null): string | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? DAY.format(new Date(ms)) : null;
};

export interface AppBeltProps {
  onOpenSheet: () => void;
  onHome: () => void;
  onOpenRoom: (room: DiscoverRoom) => void;
  onSearch: (q: string) => void;
  activeRoom?: DiscoverRoom | null;
  className?: string;
}

export const AppBelt: React.FC<AppBeltProps> = ({
  onOpenSheet,
  onHome,
  onOpenRoom,
  onSearch,
  activeRoom = null,
  className = ''
}) => {
  const [q, setQ] = useState('');
  const [place] = useState(readPlace);
  const [banners, setBanners] = useState<CampaignBanner[] | null>(null);

  // One read per mount. A failure leaves `banners` null, and a null list renders
  // no slot at all: an empty promotional frame would be a placeholder claiming a
  // campaign exists.
  useEffect(() => {
    let live = true;
    void briefApi.getCampaignBanners().then((res) => {
      if (live && res.ok) setBanners(res.data ?? []);
    });
    return () => { live = false; };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    soundEngine.play('tap');
    onSearch(term);
  };

  return (
    <div
      className={`sticky top-0 z-40 ${className}`}
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), 0 1px 0 0 var(--brief-line)' }}
    >
      {/* ── band ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); onOpenSheet(); }}
          aria-label="Open all sections"
          aria-haspopup="dialog"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl shrink-0 cursor-pointer"
          style={{ color: 'var(--color-text)' }}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[12px] font-black uppercase tracking-wider">All</span>
        </button>

        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); onHome(); }}
          aria-label="Trace home"
          className="flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}>
            <TraceMark size={14} title="" />
          </span>
          <span className="text-[15px] font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
            Trace
          </span>
        </button>

        <form onSubmit={submit} role="search" className="flex-1 min-w-0 flex items-center gap-1.5">
          <label htmlFor="belt-search" className="sr-only">Search Trace</label>
          <input
            id="belt-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search listings, vendors, places"
            aria-label="Search Trace"
            className="min-w-0 flex-1 px-3 py-2 rounded-xl text-[13px] border"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}
          />
          <button
            type="submit"
            aria-label="Search"
            className="shrink-0 p-2 rounded-xl cursor-pointer disabled:opacity-40"
            disabled={!q.trim()}
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ── the area chip. Only ever what the member typed. ── */}
      <div className="px-3 pb-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); onOpenSheet(); }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <MapPin className="w-3.5 h-3.5" />
          {place ? `Your area: ${place}` : 'Set your area'}
        </button>
        <span className="text-[11px]" style={{ color: 'var(--color-quiet)' }}>
          {place ? 'A weather line appears on a day you have something planned.' : 'Used for the forecast. Optional.'}
        </span>
      </div>

      {/* ── departments rail: flows, then the rooms. Both lists come from the
             taxonomy module, so the belt cannot invent a category. ── */}
      <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto" role="navigation" aria-label="Departments">
        {FLOW_ORDER.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { soundEngine.play('tap'); onOpenRoom(f.key); }}
            aria-current={activeRoom === f.key ? 'page' : undefined}
            className="shrink-0 px-2.5 py-1 rounded-full text-[12px] font-bold cursor-pointer"
            style={{
              background: activeRoom === f.key ? 'var(--color-text)' : 'var(--color-bg)',
              color: activeRoom === f.key ? 'var(--color-primary)' : 'var(--color-text)'
            }}
          >
            {f.key[0].toUpperCase() + f.key.slice(1)}
          </button>
        ))}
        <span aria-hidden="true" className="shrink-0 w-px h-4" style={{ background: 'var(--brief-line)' }} />
        {SIDE_ORDER.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { soundEngine.play('tap'); onOpenRoom(s.key); }}
            aria-current={activeRoom === s.key ? 'page' : undefined}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold cursor-pointer"
            style={{
              background: activeRoom === s.key ? 'var(--color-text)' : 'transparent',
              color: activeRoom === s.key ? 'var(--color-primary)' : 'var(--color-text-muted)'
            }}
          >
            {s.label}
            {s.key === 'all' && <ArrowRight className="w-3 h-3" />}
          </button>
        ))}
      </div>

      {/* ── the message slot. Nothing to say, nothing rendered. ── */}
      {banners && banners.length > 0 && (
        <div className="px-3 pb-2 space-y-1.5" aria-label="Announcements">
          {banners.slice(0, 2).map((b) => {
            const when = dayWords(b.startsAt);
            return (
              <div
                key={b.id}
                className="flex items-start gap-2 rounded-xl px-3 py-2"
                style={{ background: 'var(--color-primary-subtle)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
              >
                <p className="min-w-0 flex-1 text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
                  <span className="font-black">{b.title}</span>
                  {b.body ? <span className="font-normal"> — {b.body}</span> : null}
                  {when ? <span className="font-bold"> · {when}</span> : null}
                  {b.location ? <span> · {b.location}</span> : null}
                </p>
                {/* Only a real, configured link gets a button. `share.available`
                    is false when no public origin is set, and then the banner is
                    words with no CTA rather than a URL that 404s. */}
                {b.share.available ? (
                  <a
                    href={b.share.url}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black"
                    style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                  >
                    Open
                  </a>
                ) : (
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    no public link yet
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppBelt;
