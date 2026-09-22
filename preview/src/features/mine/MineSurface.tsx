import React, { useEffect, useState } from 'react';
import { Store, Package, Bookmark, Star, Plus } from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { splitSpaces, attentionQueue } from '../home/spaceSignals';
import { NoPhotoPlate } from '../city/NoPhotoPlate';
import { GlobysCard } from '../../ui/GlobysCard';
import { BannerButton } from '../../ui/BannerButton';
import { Marketplace } from '../../components/Marketplace';
import { FollowingSurface } from '../../components/FollowingSurface';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// MINE — the second door: your shops, your orders, what you kept.
//
// The reorg that owns this screen: the old bar gave five doors, three of them
// ("Spaces", "Discover", "Activity") were really "somewhere in my own stuff"
// and "somewhere in the world's stuff". Mine is the whole first half in one
// door:
//
//   BANNER   when the member owns a shop, the one dark-gradient banner
//            ("Your shop overview →") — the only loud thing on the screen
//   SHOPS    the shopfronts you operate, as a two-column grid of the ONE
//            product card: 1:1 cover or waiting plate, name, the lowest
//            real offer price, the place in mono, one action
//   ORDERS   the marketplace's personal rails — what you bought, what you sell
//   SAVED    the places and people you follow
//   REVIEWS  said as what it is: recorded, not yet a surface
//
// One shelf per thing, in order, with the real rows in each. Nothing here is
// a count that pretends to be a promise.
// ---------------------------------------------------------------------------

export interface MineSurfaceProps {
  onOpenSpace: (spaceId: string) => void;
  onOpenCreateSpace: () => void;
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
  className?: string;
}

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div className="flex items-center gap-2.5">
    <span
      className="w-8 h-8 rounded-xl grid place-items-center shrink-0"
      style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
    >
      {icon}
    </span>
    <div className="min-w-0">
      <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
    </div>
  </div>
);

export const MineSurface: React.FC<MineSurfaceProps> = ({
  onOpenSpace,
  onOpenCreateSpace,
  onOpenEntity,
  onRequireAuth,
  className = ''
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let live = true;
    void briefApi.listMySpaces().then((res) => {
      if (!live) return;
      if (res.ok && res.data?.spaces) setSpaces(res.data.spaces);
      setLoading(false);
    }).catch(() => { if (live) setLoading(false); });
    void briefApi.whoAmI().then((res) => { if (live) setAuthed(res.ok); });
    return () => { live = false; };
  }, []);

  const { active } = splitSpaces(spaces);
  const queue = attentionQueue(active);
  // The lowest real ACTIVE offer price — the row the card's price line reads.
  // No active offer with a price: no line, not a zero.
  const lowestOffer = (s: Space): string | null => {
    const prices = (s.offers ?? [])
      .filter((o) => o.status === 'active' && typeof o.price === 'number' && o.price > 0)
      .map((o) => o.price);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const cur = (s.offers ?? []).find((o) => o.price === min)?.currency ?? 'KES';
    return `from ${cur} ${min.toLocaleString('en-KE')}`;
  };

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
          Mine
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          Your shops, your orders, what you kept.
        </p>
      </header>

      {/* ── THE BANNER — only when the member owns a shop: the one loud
             thing on this screen, and the door into the shop itself. ── */}
      {active.length > 0 && (
        <section aria-label="Your shop overview">
          <BannerButton
            label="Your shop overview"
            sub={queue.length > 0 ? `${queue.length} ${queue.length === 1 ? 'shop' : 'shops'} need you` : null}
            onClick={() => { soundEngine.play('tap'); onOpenSpace(queue[0]?.space.id ?? active[0].id); }}
          />
        </section>
      )}

      {/* ── SHOPS ── */}
      <section aria-label="Your shops" className="space-y-2.5">
        <SectionHeading icon={<Store className="w-4 h-4" />} title="Shops" sub="The shopfronts you operate" />
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reading your shops…</p>
        ) : active.length === 0 ? (
          <div
            className="p-5 rounded-3xl border border-dashed text-center space-y-3"
            style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}
          >
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              No shop yet.
            </p>
            <button
              type="button"
              onClick={() => { soundEngine.play('heavyTap'); onOpenCreateSpace(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Plus className="w-4 h-4" /> Create your first space
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5" data-testid="mine-shop-grid">
            {active.map((s) => (
              <GlobysCard
                key={s.id}
                testId={`shop-${s.id}`}
                image={s.image}
                imageAlt={s.name}
                plate={<NoPhotoPlate mark={s.modeLabel ?? 'shop'} icon={<Store className="w-4 h-4" />} />}
                title={s.name}
                price={lowestOffer(s)}
                seller="You"
                mono={s.profileLabels?.where ?? null}
                actionLabel="View shop →"
                onAction={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                onOpen={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── ORDERS ── */}
      <section aria-label="Your orders" className="space-y-2.5">
        <SectionHeading icon={<Package className="w-4 h-4" />} title="Orders" sub="What you bought, what you sell" />
        {/* No frame here: the order list inside is already a card, and a card
            around a card is two borders doing one job. The screen's own ground is
            the canvas; the section heading is the separation. */}
        <Marketplace initialSection="orders" />
      </section>

      {/* ── SAVED ── */}
      <section aria-label="Saved and followed" className="space-y-2.5">
        <SectionHeading icon={<Bookmark className="w-4 h-4" />} title="Saved" sub="Places and people you follow" />
        <div>
          {/* Embedded, not overlaid: this used to mount the full-screen sheet
              INSIDE a card with an empty close handler, so the scrim covered the
              app and its Back, its X and its click-away all did nothing — a
              second screen you could not leave. `variant='embedded'` renders the
              same list in the page flow and offers no control that is not wired,
              and with no object surface in this shell the cards stay static
              rather than begging for a tap that leads nowhere. */}
          <FollowingSurface
            variant="embedded"
            authed={authed}
            onOpenEntity={(id) => { soundEngine.play('tap'); onOpenEntity(id); }}
            onRequireAuth={onRequireAuth}
          />
        </div>
      </section>

      {/* ── REVIEWS — said as what it is ── */}
      <section aria-label="Reviews" className="space-y-2.5">
        <SectionHeading icon={<Star className="w-4 h-4" />} title="Reviews" sub="On your offers" />
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Reviews are recorded in the series ledger but not yet a surface — so there is nothing to show here,
            and no five-star row that would pretend otherwise.
          </p>
        </div>
      </section>
    </div>
  );
};

export default MineSurface;
