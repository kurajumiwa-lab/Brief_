import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// WIRE — Kenya + major world desks, last 24h.
//
// Not Tea. Tea is editorial. These are other people's headlines, fetched
// through /api/wire, and labelled as such. A dead upstream is an empty
// shelf with a reason, never invented copy.
// ---------------------------------------------------------------------------

type WireItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string | null;
  sitename: string;
  image: string | null;
};

type WirePayload = {
  kenya: WireItem[];
  world: WireItem[];
  note: string;
  error: string | null;
  fetchedAt: string;
};

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString();
}

function Row({ item }: { item: WireItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-[#232A38] bg-[#10141C] p-3 hover:border-[#43D17A] transition"
    >
      <p className="text-[13px] font-semibold leading-snug text-[#F3F1E7] line-clamp-2">{item.title}</p>
      <p className="mt-1 text-[10px] text-[#8A93A6] truncate">
        {item.sitename}
        {item.publishedAt ? ` · ${when(item.publishedAt)}` : ''}
      </p>
    </a>
  );
}

export function WireSection() {
  const [state, setState] = React.useState<{
    status: 'loading' | 'ready';
    wire: WirePayload | null;
  }>({ status: 'loading', wire: null });

  React.useEffect(() => {
    let live = true;
    (async () => {
      const res = await briefApi.getWire();
      if (!live) return;
      setState({ status: 'ready', wire: res.ok ? res.data : null });
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4 animate-pulse">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#43D17A]">The Wire</p>
        <div className="mt-3 h-12 rounded-xl bg-[#090B10]" />
      </div>
    );
  }

  const wire = state.wire;
  if (!wire || (wire.kenya.length === 0 && wire.world.length === 0)) {
    return (
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#43D17A]">The Wire</p>
        <p className="mt-2 text-[13px] text-[#8A93A6]">
          {wire?.error ? `Wire is quiet. ${wire.error}.` : 'No Kenya or world headlines in the last 24 hours.'}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#43D17A]">The Wire</p>
        <p className="mt-0.5 text-[11px] text-[#4B5162]">Kenya and major world desks · last 24h</p>
      </div>

      {wire.kenya.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold text-[#F3F1E7]">Kenya</p>
          {wire.kenya.slice(0, 5).map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      )}

      {wire.world.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold text-[#F3F1E7]">World</p>
          {wire.world.slice(0, 5).map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      )}

      <p className="text-[9px] leading-snug text-[#4B5162]">{wire.note}</p>
    </section>
  );
}

export default WireSection;
