import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// WIRE — a quiet, title-first fallback for the home surface.
//
// News is not seeded into the client. It is fetched server-side from the wire,
// labelled with its source/time, and can be retried. An empty response is kept
// visible as an operational state so a stale deployment or unavailable upstream
// cannot masquerade as a blank news shelf.
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
  source?: string;
  fetchedAt?: string;
  note?: string;
  error?: string | null;
};

function Row({ item }: { item: WireItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#222630] bg-[#12151A] p-2 transition-colors hover:border-[#22E6E0]"
    >
      {item.image && (
        <img src={item.image} alt="" aria-hidden="true" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      )}
      <h3 className="min-w-0 truncate px-1 text-[14px] font-semibold leading-snug text-[#F7F7F8]">
        {item.title}
      </h3>
    </a>
  );
}

function fetchedLabel(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
}

export function WireSection() {
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [state, setState] = React.useState<{ status: 'loading' | 'ready'; wire: WirePayload | null }>({
    status: 'loading',
    wire: null
  });

  React.useEffect(() => {
    let live = true;
    setRefreshing(refreshToken > 0);
    (async () => {
      const res = await briefApi.getWire();
      if (!live) return;
      setState({ status: 'ready', wire: res.ok ? res.data : null });
      setRefreshing(false);
    })();
    return () => { live = false; };
  }, [refreshToken]);

  if (state.status === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-3 animate-pulse" aria-label="Loading">
        <div className="h-16 rounded-2xl bg-[#12151A]" />
        <div className="h-16 rounded-2xl bg-[#12151A]" />
      </div>
    );
  }

  const wire = state.wire;
  const headlines = wire ? [...wire.kenya, ...wire.world] : [];
  const time = fetchedLabel(wire?.fetchedAt);

  return (
    <section className="space-y-3 rounded-2xl border border-[#222630] bg-[#171A20] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#F7F7F8]/60">News</h2>
          <p className="mt-1 px-1 text-[10px] leading-snug text-[#F7F7F8]/45">
            {wire?.source ? `Live from ${wire.source}` : 'Live news wire'}
            {time ? ` · checked ${time}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshToken((value) => value + 1)}
          disabled={refreshing}
          className="min-h-9 rounded-lg border border-[#222630] bg-[#12151A] px-3 py-1.5 text-[10px] font-extrabold text-[#F7F7F8] disabled:opacity-50"
        >
          {refreshing ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {wire?.error && (
        <p className="rounded-xl border border-dashed border-[#222630] bg-[#12151A] px-3 py-2 text-[10px] leading-snug text-[#F7F7F8]/60">
          The live news request returned an error: {wire.error}
        </p>
      )}

      {headlines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#222630] bg-[#12151A] px-3 py-3">
          <p className="text-[11px] font-extrabold text-[#F7F7F8]">No current news returned.</p>
          <p className="mt-1 text-[10px] leading-snug text-[#F7F7F8]/55">
            {wire?.note ?? 'The wire is empty right now. Brief will not fill it with old or invented news.'}
          </p>
        </div>
      ) : (
        <>
          {wire?.kenya?.length ? (
            <div className="space-y-2">
              <p className="px-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#F7F7F8]/45">Kenya</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {wire.kenya.slice(0, 6).map((item) => <Row key={item.id} item={item} />)}
              </div>
            </div>
          ) : null}
          {wire?.world?.length ? (
            <div className="space-y-2">
              <p className="px-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#F7F7F8]/45">World</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {wire.world.slice(0, 6).map((item) => <Row key={item.id} item={item} />)}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default WireSection;
