import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Copy, ExternalLink, MessageCircle, Radio } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { SpacePublicPageView } from '../../api/types';
import { soundEngine } from '../../utils/SoundEngine';
import { roomSurface, PHOTO_FILTER } from '../city/room';
import { NoPhotoPlate } from '../city/NoPhotoPlate';

// ---------------------------------------------------------------------------
// PUBLIC SPACE PAGE — the in-app rendering of the same mirror the server paints
// at /s/:slug.
//
// One rule governs this whole file: it may show a fact the space holds, or
// nothing. The page exists because a shared link needs a face, and every number
// on it is a row count from the projection the server built. So:
//   * no revenue, no customer list, no order book, no owner id;
//   * no "trusted seller", no stars, no tick — Brief stores no completed-order
//     reviews, so there would be nothing to average and nothing to award;
//   * no view count, which the owner sees in their own header strip and a buyer
//     has no business seeing at all;
//   * a WhatsApp button appears only when the owner published a number, and it
//     links to that number;
//   * an empty space reads as empty ("being set up"), because a page that looks
//     like a shop while selling nothing is the one thing that would break the
//     loop between the Space and its face.
//
// The number an owner publishes is shown as text here exactly as the server's
// /s/:slug page shows it — one mirror, not a prettier one. Anyone on a laptop
// without WhatsApp can still dial it, and hiding the digits from a page whose
// button is a link to them would be theatre.
//
// Opening this page records a view — that is what a view row means — and
// nothing else in the app writes one.
// ---------------------------------------------------------------------------

export function PublicSpacePage({
  slug,
  onBack,
  onOpenOffer,
  className = ''
}: {
  slug: string;
  onBack?: () => void;
  onOpenOffer?: (id: string) => void;
  className?: string;
}) {
  const [space, setSpace] = useState<SpacePublicPageView | null>(null);
  const [following, setFollowing] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void briefApi.getPublicSpacePage(slug).then(async (res) => {
      if (!live) return;
      if (!res.ok) {
        setStatus(res.status === 404 ? 'gone' : 'error');
        return;
      }
      setSpace(res.data.space);
      setFollowing(res.data.space.following === true);
      setStatus('ready');
    });
    return () => { live = false; };
  }, [slug]);

  const toggleFollow = async () => {
    if (!space) return;
    const who = await briefApi.whoAmI();
    if (!who.ok) {
      setNotice('Sign in to follow a space — a follow is a row with a person in it, not a counter.');
      return;
    }
    setBusy(true);
    const res = following ? await briefApi.unfollowSpace(space.id) : await briefApi.followSpace(space.id);
    setBusy(false);
    if (!res.ok) { setNotice(res.error ?? 'That did not go through.'); return; }
    const next = !following;
    setFollowing(next);
    setSpace((s) => (s ? { ...s, followers: res.data.followers } : s));
    setNotice(next
      ? 'You will get this space\u2019s updates in your notifications. You can turn them off under Alerts.'
      : 'Unfollowed.');
    soundEngine.play('tap');
  };

  const share = async () => {
    const url = space?.pageUrl ?? window.location.href;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: space?.name ?? 'A shop on Brief', text: space?.goal ?? '', url });
        return;
      } catch {
        /* a cancelled sheet is normal; fall through to the copy */
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
      setNotice('Link copied.');
    } catch {
      setNotice(`Copy it yourself: ${url}`);
    }
  };

  if (status === 'loading') {
    return <p className="text-xs" style={{ color: 'var(--brief-muted)' }}>Opening the shop…</p>;
  }
  if (status === 'gone' || status === 'error') {
    return (
      <div className={`p-6 text-center space-y-2 ${className}`}>
        <p className="text-sm font-bold">This shop is not open here.</p>
        <p className="text-[12px]" style={{ color: 'var(--brief-muted)' }}>
          {status === 'gone'
            ? 'That space is private, unlisted, archived, or the link is wrong. A private space is not hidden-but-findable — it is not here.'
            : 'Brief could not read it just now. Nothing is shown in its place.'}
        </p>
        {onBack && (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
      </div>
    );
  }

  const s = space!;
  const updates = s.updates ?? [];
  const offers = s.offers ?? [];

  return (
    <div className={`max-w-2xl mx-auto space-y-4 ${className}`} data-public-mirror="true">
      <header className="rounded-3xl overflow-hidden brief-lift-2" style={{ background: 'var(--color-paper)' }}>
        <div className="relative h-[152px]" style={{ background: roomSurface() }}>
          {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" style={{ filter: PHOTO_FILTER }} /> : (
            <NoPhotoPlate quiet />
          )}
        </div>
        <div className="p-4 -mt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold leading-tight truncate" style={{ color: 'var(--brief-ink)' }}>{s.name}</h1>
              <p className="text-[13px]" style={{ color: 'var(--brief-muted)' }}>{s.goal || `${s.type.replace(/_/g, ' ')} on Brief`}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--brief-muted)' }}>
                {[s.where, s.when].filter(Boolean).join(' · ') || 'Place and hours not stated'}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
              {s.visibility}
            </span>
          </div>

          {/* The open/closed mark, only when their own hours answer supports it. */}
          {s.open?.label && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--brief-ink)' }}>
              <span
                className="brief-dot"
                style={{ background: s.open.tone === 'live' ? 'var(--state-live)' : 'var(--state-quiet)' }}
                aria-hidden="true"
              />
              {s.open.label}
              {s.open.closesAt ? ` until ${s.open.closesAt}` : ''}
              <span className="font-medium" style={{ color: 'var(--brief-faint)' }}>· {s.clock}</span>
            </p>
          )}

          {/* The page's one real action: reach the shop. Only if they published
              a number. No dead button, and no fabricated "call now". */}
          <div className="mt-3 flex flex-wrap gap-2">
            {s.contact ? (
              <>
                <a
                  href={s.contact.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-black"
                  style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-2)' }}
                >
                  <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
                </a>
                {/* The same number, dialable, exactly as the server mirror prints
                    it — two renderings of one page must not disagree. */}
                <a
                  href={`tel:${s.contact.digits ? `+${s.contact.digits}` : s.contact.display}`}
                  className="inline-flex items-center px-3.5 py-2.5 rounded-full text-[12px] font-mono"
                  style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
                >
                  {s.contact.display}
                </a>
              </>
            ) : (
              <p className="text-[11px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
                No contact number on this page — the shop takes inquiries through Brief.
              </p>
            )}
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[13px] font-bold cursor-pointer"
              style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
            >
              <Copy className="w-4 h-4" /> Share
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <p className="text-[13px] font-mono" style={{ color: 'var(--brief-ink)' }}>
              {s.followers > 0 ? `${s.followers} follow` : `${s.offerCount} offer${s.offerCount === 1 ? '' : 's'}`}
            </p>
            {s.lastStamp && (
              <p className="text-[11px] font-mono" style={{ color: 'var(--color-quiet)' }}>
                last written {s.lastStamp.text}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleFollow()}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
              style={following
                ? { background: 'var(--color-well)', color: 'var(--brief-ink)' }
                : { background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Bell className="w-4 h-4" /> {following ? 'Following' : 'Follow'}
            </button>
          </div>
          {notice && <p role="status" className="text-[11px] font-bold mt-2" style={{ color: 'var(--brief-muted)' }}>{notice}</p>}
        </div>
      </header>

      {updates.length > 0 && (
        <section className="p-4 rounded-2xl" style={{ background: 'var(--color-well)' }} aria-label="Latest update">
          <p className="text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
            <Radio className="w-3 h-3" /> {updates[0].kind}
          </p>
          <p className="text-[14px] leading-snug mt-1" style={{ color: 'var(--brief-ink)' }}>{updates[0].text}</p>
          {updates.slice(1).map((b) => (
            <p key={`${b.kind}-${b.createdAt}`} className="text-[12px] leading-snug mt-2" style={{ color: 'var(--brief-muted)' }}>
              {b.text}
            </p>
          ))}
        </section>
      )}

      <section className="space-y-2" aria-label="On the counter">
        <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
          On the counter
        </h2>
        {offers.length === 0 ? (
          <div className="p-5 rounded-2xl text-center" style={{ background: 'var(--color-well)' }}>
            <p className="text-[13px] font-bold" style={{ color: 'var(--brief-ink)' }}>This shop is being set up</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--brief-muted)' }}>
              Nothing is listed yet. When they publish an offer, it appears here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {offers.map((o) => (
              <button
                key={o.id ?? o.title}
                type="button"
                onClick={() => o.id && onOpenOffer?.(o.id)}
                disabled={!o.id}
                className="text-left p-3 rounded-2xl bg-[color:var(--color-paper)] cursor-pointer disabled:cursor-default brief-lift-1"
              >
                {o.featured && (
                  <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    Pinned
                  </span>
                )}
                <p className="text-[13px] font-bold leading-snug" style={{ color: 'var(--brief-ink)' }}>{o.title}</p>
                {o.blurb && (
                  <p className="text-[11px] leading-snug mt-1" style={{ color: 'var(--brief-muted)' }}>{o.blurb}</p>
                )}
                <p className="text-[13px] font-mono mt-1" style={{ color: 'var(--brief-ink)' }}>
                  {o.priceLabel ?? 'Price not listed'}
                  {o.unit ? ` / ${o.unit}` : ''}
                </p>
                {o.minimum ? <p className="text-[10px] mt-0.5" style={{ color: 'var(--brief-muted)' }}>min {o.minimum}</p> : null}
                {/* Stock is a number the owner chose to track. Untracked is not 0. */}
                {o.stock !== null && o.stock !== undefined && (
                  <p className="text-[10px] mt-0.5" style={{ color: o.stock > 0 ? 'var(--state-live-ink)' : 'var(--state-stale-ink)' }}>
                    {o.stock > 0 ? `${o.stock} in hand` : 'sold out for now'}
                  </p>
                )}
                {o.id && <p className="text-[10px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                  <MessageCircle className="w-3 h-3" /> ask about this
                </p>}
              </button>
            ))}
          </div>
        )}
        {s.moreOffers > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--brief-muted)' }}>
            Plus {s.moreOffers} more on their Brief counter.
          </p>
        )}
        {s.facts.length > 0 && (
          <div className="p-3.5 rounded-2xl space-y-2" style={{ background: 'var(--color-well)' }}>
            {s.facts.map((f) => (
              <p key={f.key} className="text-[12px] leading-snug" style={{ color: 'var(--brief-ink)' }}>
                <span className="text-[10px] font-black uppercase tracking-wider block" style={{ color: 'var(--brief-faint)' }}>{f.label}</span>
                {f.answer}
              </p>
            ))}
          </div>
        )}
        <p className="text-[10px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
          What you see here is what {s.name} chose to make public: prices and words. Their orders, customers and
          money stay in their own space.
        </p>
        {s.pageUrl && (
          <a href={s.pageUrl} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--brief-faint)' }}>
            <ExternalLink className="w-3 h-3" /> The address of this page
          </a>
        )}
      </section>
    </div>
  );
}

export default PublicSpacePage;
