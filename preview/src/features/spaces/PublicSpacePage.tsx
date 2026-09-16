import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, MessageCircle, Radio } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { PublicSpace } from '../../api/types';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// PUBLIC SPACE PAGE — what a shared link actually opens.
//
// This page is why the "views" number on a vendor's header can be true: opening
// it writes a `space_viewed` row, and nothing else does. A fetch of the API or
// a scroll past the directory is not a view of the shop.
//
// It shows only what the server put in the public projection: the name, the
// stated place and hours, the live update, the offers with prices, the follower
// count. No revenue, no customer list, no order book, no owner id — and no
// invented "trusted seller" badge, since there is nothing to compute one from.
//
// Following requires a session: a follow is a row with a person in it. A
// signed-out visitor is told so, rather than getting a button that silently
// no-ops.
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
  const [space, setSpace] = useState<PublicSpace | null>(null);
  const [audience, setAudience] = useState<{ followers: number; broadcasts: number; followable: boolean; iAmFollowing: boolean } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void briefApi.getPublicSpace(slug).then(async (res) => {
      if (!live) return;
      if (!res.ok) {
        setStatus(res.status === 404 ? 'gone' : 'error');
        return;
      }
      setSpace(res.data.space);
      setStatus('ready');
      // The follow state is a session fact, so it is read separately and simply
      // omitted when there is no session. No guessing.
      // The server tells a signed-in caller their own follow state; a signed-out
      // visitor gets no followable affordance rather than a button that no-ops.
      setAudience({
        followers: res.data.space.followers ?? 0,
        broadcasts: res.data.space.broadcasts?.length ?? 0,
        followable: true,
        iAmFollowing: res.data.space.following === true
      });
      if (!live) return;
      const who = await briefApi.whoAmI();
      if (!who.ok) setAudience(null);
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
    const res = audience?.iAmFollowing
      ? await briefApi.unfollowSpace(space.id)
      : await briefApi.followSpace(space.id);
    setBusy(false);
    if (!res.ok) { setNotice(res.error ?? 'That did not go through.'); return; }
    const following = !audience?.iAmFollowing;
    setAudience((a) => ({ ...(a ?? { broadcasts: 0, followable: true }), followers: res.data.followers, iAmFollowing: following }));
    setNotice(following
      ? 'You will get this space\u2019s updates in your notifications. You can turn them off under Alerts.'
      : 'Unfollowed.');
    soundEngine.play('tap');
  };

  if (status === 'loading') {
    return <p className="text-xs" style={{ color: '#6B7280' }}>Opening the shop…</p>;
  }
  if (status === 'gone' || status === 'error') {
    return (
      <div className={`p-6 text-center space-y-2 ${className}`}>
        <p className="text-sm font-bold">This shop is not open here.</p>
        <p className="text-[12px]" style={{ color: '#6B7280' }}>
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
  const live = s.broadcasts ?? [];

  return (
    <div className={`max-w-2xl mx-auto space-y-4 ${className}`}>
      <header className="rounded-3xl overflow-hidden border" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
        <div className="h-[152px]" style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)' }}>
          {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="p-4 -mt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold leading-tight truncate" style={{ color: '#0A0A0A' }}>{s.name}</h1>
              <p className="text-[13px]" style={{ color: '#6B7280' }}>{s.goal || `${s.type} on Brief`}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: '#6B7280' }}>
                {[s.where, s.when].filter(Boolean).join(' · ') || 'Place and hours not stated'}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: '#EEEAFF', color: '#5B4CFF' }}>
              {s.visibility}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <p className="text-[13px] font-mono" style={{ color: '#0A0A0A' }}>
              {audience?.followers ?? s.followers ?? 0} follow
            </p>
            <span className="text-[13px] font-mono" style={{ color: '#0A0A0A' }}>
              {s.activeOfferCount} offer{s.activeOfferCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleFollow()}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Bell className="w-4 h-4" /> {audience?.iAmFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
          {notice && <p role="status" className="text-[11px] font-bold mt-2" style={{ color: '#6B7280' }}>{notice}</p>}
        </div>
      </header>

      {live.length > 0 && (
        <section className="p-4 rounded-2xl" style={{ background: '#F4F4F7' }} aria-label="Latest update">
          <p className="text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
            <Radio className="w-3 h-3" /> {live[0].kind}
          </p>
          <p className="text-[14px] leading-snug mt-1" style={{ color: '#0A0A0A' }}>{live[0].text}</p>
        </section>
      )}

      <section className="space-y-2" aria-label="On the counter">
        <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
          On the counter
        </h2>
        {s.sampleOffers.length === 0 ? (
          <p className="text-[12px]" style={{ color: '#6B7280' }}>
            Nothing is listed yet. The shop is open; the counter is empty.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {s.sampleOffers.map((o) => (
              <button
                key={o.id ?? o.title}
                type="button"
                onClick={() => o.id && onOpenOffer?.(o.id)}
                disabled={!o.id}
                className="text-left p-3 rounded-2xl border-2 bg-white cursor-pointer disabled:cursor-default"
                style={{ borderColor: '#E5E7EB' }}
              >
                {o.featured && (
                  <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    Pinned
                  </span>
                )}
                <p className="text-[13px] font-bold leading-snug" style={{ color: '#0A0A0A' }}>{o.title}</p>
                <p className="text-[13px] font-mono mt-1" style={{ color: '#0A0A0A' }}>
                  {o.currency} {Number(o.price).toLocaleString('en-KE')}
                </p>
                {o.id && <p className="text-[10px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                  <MessageCircle className="w-3 h-3" /> ask about this
                </p>}
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] leading-snug" style={{ color: '#6B7280' }}>
          What you see here is what {s.name} chose to make public: prices and words. Their orders, customers and
          money stay in their own space.
        </p>
      </section>
    </div>
  );
}

export default PublicSpacePage;
