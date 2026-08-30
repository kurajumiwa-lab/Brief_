import React from 'react';
import { Plus, Trash2, Copy, ExternalLink, Send, ShieldCheck, Store } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { ShopView, ShopItem } from '../api/briefApi';

// WHATSAPP SHOP BUILDER — Brief builds the shop, WhatsApp IS the shop.
// The preview on the right is the EXACT text (real WhatsApp formatting:
// *bold*, _italic_) that Copy puts on the clipboard and the wa.me link
// pre-fills. No payments flow through WhatsApp by design: buyers and
// sellers arrange money the way they already do. Brief's own fee is the
// store service, paid through the same manual Pochi flow as everything
// else and confirmed by an operator before publishing unlocks.
export function WhatsAppShopBuilder({ onOpenFees }: { onOpenFees: () => void }) {
  const [view, setView] = React.useState<ShopView | null>(null);
  const [name, setName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [orderNumber, setOrderNumber] = React.useState('');
  const [items, setItems] = React.useState<{ name: string; priceKes: string; note: string }[]>([{ name: '', priceKes: '', note: '' }]);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void briefApi.getMyShop().then((r) => {
      if (!r.ok) return;
      const v = r.data;
      setView(v);
      if (v.shop.id) {
        setName(v.shop.name);
        setTagline(v.shop.tagline);
        setOrderNumber(v.shop.orderNumber);
        setItems(v.shop.items.map((i: ShopItem) => ({ name: i.name, priceKes: String(i.priceKes), note: i.note ?? '' })));
      }
    });
  }, []);

  const payload = () => ({
    name,
    tagline,
    orderNumber,
    items: items
      .filter((i) => i.name.trim() || i.priceKes.trim())
      .map((i) => ({ name: i.name.trim(), priceKes: Number(i.priceKes), note: i.note.trim() || undefined }))
  });

  const apply = (v: ShopView, when: string) => {
    setView(v);
    setNote(when);
    setError(null);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true); setNote(null); setError(null);
    const res = await briefApi.saveMyShop(payload());
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    apply(res.data, 'Saved. The preview is exactly what customers will receive.');
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true); setNote(null); setError(null);
    const res = await briefApi.publishMyShop();
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    apply(res.data, res.data.changed ? 'Published — the wa.me link is live to share.' : 'Already published.');
  };

  const unpublish = async () => {
    if (busy) return;
    setBusy(true);
    const res = await briefApi.unpublishMyShop();
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    apply(res.data, 'Back to draft. Old forwards keep working; new shares say draft.');
  };

  const copyText = async () => {
    if (!view?.share) return;
    try {
      await navigator.clipboard.writeText(view.share.text);
      setNote('Copied. Paste it into a WhatsApp status, broadcast or chat.');
    } catch {
      setError('Could not reach the clipboard — select the preview text and copy manually.');
    }
  };

  const published = view?.shop.status === 'published';
  const storeActive = view?.store.active === true;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[#5B2EA6]" aria-hidden="true" />
          <h1 className="text-lg font-extrabold text-[#251045]">WhatsApp shop</h1>
          {published && (
            <span className="px-2 py-0.5 rounded-full bg-[#5B2EA6] text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#FFFFFF]">Live</span>
          )}
        </div>
        <p className="text-[11px] text-[#251045]/60 leading-snug">
          Build the price list here; sell in the conversation. Copy the message or share the wa.me link — buyers reply in WhatsApp, and money is arranged between you (Pochi, till, send money). Brief never touches it.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* The builder */}
        <div className="space-y-3">
          <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">Shop name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Mama Njeria Fresh"
                className="w-full rounded-xl border border-[#D6CFE4] bg-[#FFFFFF] px-3 py-2 text-[13px] font-bold text-[#251045] outline-none focus:border-[#5B2EA6]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">One line about it</span>
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={60} placeholder="Fresh groceries, Kilimani"
                className="w-full rounded-xl border border-[#D6CFE4] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#251045] outline-none focus:border-[#5B2EA6]" />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">WhatsApp number customers order on</span>
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} maxLength={20} placeholder="+254 712 345 678" inputMode="tel"
                className="w-full rounded-xl border border-[#D6CFE4] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#251045] outline-none focus:border-[#5B2EA6]" />
            </label>
          </div>

          <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">Price list</span>
              <span className="text-[9px] text-[#251045]/45">{items.length} item{items.length === 1 ? '' : 's'} · keep it forwardable</span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input value={item.name} onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))} placeholder="Sukuma Wiki" maxLength={60}
                  className="flex-1 min-w-0 rounded-lg border border-[#D6CFE4] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] font-bold text-[#251045] outline-none focus:border-[#5B2EA6]" />
                <input value={item.priceKes} onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, priceKes: e.target.value.replace(/[^\d]/g, '') } : it))} placeholder="50" inputMode="numeric"
                  className="w-16 rounded-lg border border-[#D6CFE4] bg-[#FFFFFF] px-2 py-1.5 text-[12px] text-[#251045] outline-none focus:border-[#5B2EA6]" aria-label={`price of item ${idx + 1} in shillings`} />
                <input value={item.note} onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, note: e.target.value } : it))} placeholder="note (optional)" maxLength={40}
                  className="w-24 rounded-lg border border-[#D6CFE4] bg-[#FFFFFF] px-2 py-1.5 text-[11px] text-[#251045]/70 outline-none focus:border-[#5B2EA6]" aria-label={`note on item ${idx + 1}`} />
                <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1}
                  className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-[#251045]/40 hover:text-[#B3261E] disabled:opacity-30 cursor-pointer" aria-label={`remove item ${idx + 1}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { name: '', priceKes: '', note: '' }])} disabled={items.length >= 40}
              className="w-full rounded-xl border border-dashed border-[#D6CFE4] py-1.5 text-[11px] font-extrabold text-[#5B2EA6] hover:border-[#5B2EA6] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add an item
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy}
              className="rounded-xl bg-[#5B2EA6] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF] disabled:opacity-40 cursor-pointer">Save</button>
            {published ? (
              <button type="button" onClick={() => void unpublish()} disabled={busy}
                className="rounded-xl border border-[#D6CFE4] bg-[#FBFAFD] px-4 py-2 text-[12px] font-extrabold text-[#251045] disabled:opacity-40 cursor-pointer">Unpublish</button>
            ) : (
              <button type="button" onClick={() => void publish()} disabled={busy}
                className="rounded-xl border border-[#5B2EA6] bg-[#FBFAFD] px-4 py-2 text-[12px] font-extrabold text-[#5B2EA6] disabled:opacity-40 cursor-pointer">Publish</button>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-[#D6CFE4] bg-[#FBFAFD] px-3 py-2 flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B3261E] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-[11px] text-[#251045] leading-snug">
                {error}
                {!storeActive && /store service/i.test(error) && (
                  <>
                    {' '}
                    <button type="button" onClick={onOpenFees} className="font-extrabold text-[#5B2EA6] underline cursor-pointer">
                      Pay the store service (KES {view?.store.priceKes ?? 250}/month via Pochi) →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {note && <p role="status" className="text-[11px] font-bold text-[#2E6B3F]">{note}</p>}
        </div>

        {/* The output, exactly as WhatsApp will render the source */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Store className="w-3.5 h-3.5 text-[#5B2EA6]" aria-hidden="true" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">What customers receive</p>
          </div>
          {view?.share ? (
            <>
              <div className="rounded-2xl bg-[#E9E5F0] border border-[#D6CFE4] p-3">
                <div className="rounded-xl rounded-tl-sm bg-[#FFFFFF] border border-[#D6CFE4]/60 p-3 max-h-[380px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-[#251045] select-all">{view.share.text}</pre>
                </div>
                <p className="mt-1.5 px-1 text-[9px] text-[#251045]/50">*stars* render bold and _underscores_ italic in WhatsApp — this is the exact text.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyText()}
                  className="rounded-xl bg-[#5B2EA6] px-3.5 py-2 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copy message
                </button>
                <a href={view.share.waMe} target="_blank" rel="noreferrer"
                  className="rounded-xl border border-[#D6CFE4] bg-[#FBFAFD] px-3.5 py-2 text-[11px] font-extrabold text-[#251045] cursor-pointer flex items-center gap-1.5 no-underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Open the wa.me link
                </a>
              </div>
              {!view.share.shareable && (
                <p className="px-1 text-[10px] text-[#251045]/55 leading-snug">
                  Draft preview. Copying is yours to use, but the link is marked live only after you publish — publishing needs the store service below.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#D6CFE4] p-4 text-[11px] text-[#251045]/55">
              Save the shop and the exact WhatsApp message appears here.
            </div>
          )}

          <div className="rounded-2xl bg-[#FBFAFD] border border-[#D6CFE4] p-3.5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#251045]/50">Store service</p>
            {view?.store.active ? (
              <p className="text-[11px] font-bold text-[#2E6B3F]">Active until {new Date(view.store.activeUntil ?? '').toLocaleDateString()} — publishing is unlocked.</p>
            ) : (
              <>
                <p className="text-[11px] text-[#251045]/70 leading-snug">
                  Drafting is free. Publishing needs the store service — KES {view?.store.priceKes ?? 250}/month, paid via Pochi la Biashara and confirmed by an operator.
                </p>
                <button type="button" onClick={onOpenFees} className="text-[11px] font-extrabold text-[#5B2EA6] underline cursor-pointer">
                  Pay the store service →
                </button>
              </>
            )}
            <p className="text-[9.5px] text-[#251045]/50 leading-snug pt-1 border-t border-[#D6CFE4]">
              Photos belong in the free WhatsApp Business catalog (500 items, 10 images) — this builder makes the price list people forward.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppShopBuilder;
