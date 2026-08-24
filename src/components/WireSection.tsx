import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// WIRE — a quiet, title-first fallback for the home surface.
// ---------------------------------------------------------------------------

type WireItem = {
  id: string;
  title: string;
  url: string;
  image: string | null;
};

type WirePayload = {
  kenya: WireItem[];
  world: WireItem[];
};

function Row({ item }: { item: WireItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#232A38] bg-[#10141C] p-2 transition-colors hover:border-[#43D17A]"
    >
      {item.image && (
        <img src={item.image} alt="" aria-hidden="true" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      )}
      <h3 className="min-w-0 truncate px-1 text-[14px] font-semibold leading-snug text-[#F3F1E7]">
        {item.title}
      </h3>
    </a>
  );
}

export function WireSection() {
  const [state, setState] = React.useState<{ status: 'loading' | 'ready'; wire: WirePayload | null }>({
    status: 'loading',
    wire: null
  });

  React.useEffect(() => {
    let live = true;
    (async () => {
      const res = await briefApi.getWire();
      if (!live) return;
      setState({ status: 'ready', wire: res.ok ? res.data : null });
    })();
    return () => { live = false; };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-3 animate-pulse" aria-label="Loading">
        <div className="h-16 rounded-2xl bg-[#10141C]" />
        <div className="h-16 rounded-2xl bg-[#10141C]" />
      </div>
    );
  }

  const wire = state.wire;
  if (!wire || (wire.kenya.length === 0 && wire.world.length === 0)) return null;

  return (
    <section className="space-y-4">
      <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8A93A6]">News</h2>
      {wire.kenya.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {wire.kenya.slice(0, 6).map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
      {wire.world.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {wire.world.slice(0, 6).map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}

export default WireSection;
