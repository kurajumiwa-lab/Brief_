import React from 'react';
import * as briefApi from '../api/briefApi';
import type { Listing, Order, Vendor, VendorEarnings } from '../api/types';
import { ListingCard } from './marketplace/ListingCard';
import { ListingDetail } from './marketplace/ListingDetail';
import { VendorProfile } from './marketplace/VendorProfile';
import { OrderStatus } from './marketplace/OrderStatus';
import { PayOrder } from './marketplace/PayOrder';
import { VendorPanel } from './marketplace/VendorPanel';

/**
 * MARKETPLACE -- standalone local commerce.
 *
 *     Vendor -> Listing -> Order -> Fulfilment -> Transaction
 *
 * Commerce here does NOT require a campaign. A campaign is an organised
 * activity with registration; a listing is something a seller is offering.
 * Both exist, and buying a hoodie does not create an event.
 *
 * Rules held throughout:
 *
 *   - MONEY IS SERVER-DERIVED. The order total displayed anywhere in this
 *     tree is the number the server returned. The quantity picker shows an
 *     estimate and says so.
 *   - AN ORDER IS NOT A PAYMENT. `paid` comes from a settled ledger row.
 *     Fulfilment and payment are rendered as two separate facts.
 *   - Authority is enforced by the SERVER. Actions are hidden when they
 *     would be refused, which is courtesy, not protection.
 *   - Empty means empty. Nothing is seeded to make the marketplace look busy.
 */

type Section = 'browse' | 'orders' | 'selling';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'orders', label: 'My orders' },
  { id: 'selling', label: 'Selling' }
];

type View =
  | { kind: 'list' }
  | { kind: 'listing'; id: string }
  | { kind: 'vendor'; id: string };

export interface MarketplaceProps {
  currentUserId?: string;
}

export function Marketplace({ currentUserId = 'usr_me' }: MarketplaceProps = {}) {
  const [section, setSection] = React.useState<Section>('browse');
  const [view, setView] = React.useState<View>({ kind: 'list' });

  const [listings, setListings] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: Listing[];
    error: string | null;
  }>({ status: 'idle', data: [], error: null });

  const [detail, setDetail] = React.useState<Listing | null>(null);
  const [vendorView, setVendorView] = React.useState<{ vendor: Vendor; listings: Listing[] } | null>(null);
  const [myOrders, setMyOrders] = React.useState<Order[]>([]);
  const [myVendor, setMyVendor] = React.useState<Vendor | null>(null);
  const [myListings, setMyListings] = React.useState<Listing[]>([]);
  const [vendorOrders, setVendorOrders] = React.useState<Order[]>([]);
  const [earnings, setEarnings] = React.useState<VendorEarnings | null>(null);

  const [quantity, setQuantity] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Survives re-renders without causing one: the key must stay stable across
  // a retry, and changing it must never trigger a refetch.
  const orderKeyRef = React.useRef<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [vendorDraft, setVendorDraft] = React.useState({
    displayName: '', description: '', contactMethod: ''
  });
  const [listingDraft, setListingDraft] = React.useState<{
    title: string; description: string; price: string;
    type: Listing['type']; quantity: string; location: string;
  }>({ title: '', description: '', price: '', type: 'product', quantity: '', location: '' });

  // --- loaders -------------------------------------------------------------

  const loadBrowse = React.useCallback(async () => {
    setListings((s) => ({ ...s, status: 'loading' }));
    const res = await briefApi.getListings();
    if (res.ok) setListings({ status: 'ready', data: res.data, error: null });
    else setListings({ status: 'error', data: [], error: res.error });
  }, []);

  const loadOrders = React.useCallback(async () => {
    const res = await briefApi.getMyOrders();
    if (res.ok) setMyOrders(res.data);
  }, []);

  const loadSelling = React.useCallback(async () => {
    const mine = await briefApi.getMyListings();
    if (mine.ok) {
      setMyVendor(mine.data.vendor);
      setMyListings(mine.data.listings);
    }
    const ords = await briefApi.getVendorOrders();
    if (ords.ok) setVendorOrders(ords.data);
    // Derived server-side from settled orders only. Absent for a seller who
    // has not sold anything -- not rendered as a zero balance.
    const earn = await briefApi.getMyEarnings();
    setEarnings(earn.ok ? earn.data : null);
  }, []);

  React.useEffect(() => {
    if (section === 'browse') void loadBrowse();
    if (section === 'orders') void loadOrders();
    if (section === 'selling') void loadSelling();
  }, [section, loadBrowse, loadOrders, loadSelling]);

  /**
   * Run a mutation, then REFETCH rather than patching local state. The server
   * is authoritative about status, stock and money; a local guess would be a
   * second source of truth that drifts.
   */
  const run = React.useCallback(
    async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, after: () => Promise<void>) => {
      setBusyId(id);
      setNotice(null);
      const res = await fn();
      // A server refusal is surfaced verbatim -- the reason is the useful part.
      if (!res.ok) setNotice(res.error ?? 'That did not work.');
      await after();
      setBusyId(null);
      return res.ok;
    },
    []
  );

  // --- actions -------------------------------------------------------------

  const openListing = async (id: string) => {
    setQuantity(1);
    setNotice(null);
    orderKeyRef.current = null;
    const res = await briefApi.getListing(id);
    if (res.ok) {
      setDetail(res.data);
      setView({ kind: 'listing', id });
    } else {
      setNotice(res.error);
    }
  };

  const openVendor = async (id: string) => {
    const res = await briefApi.getVendor(id);
    if (res.ok) {
      setVendorView(res.data);
      setView({ kind: 'vendor', id });
    } else {
      setNotice(res.error);
    }
  };

  const placeOrder = async () => {
    if (!detail) return;
    // One key per (listing, quantity) attempt on this screen. A double-tap,
    // a retry or a flaky connection therefore resolves to the SAME order
    // rather than committing the buyer twice. Regenerated once an order
    // succeeds, so deliberately buying the same thing again still works.
    const key = orderKeyRef.current ?? (orderKeyRef.current = `${detail.id}:${quantity}:${Date.now()}`);
    const ok = await run(
      detail.id,
      // Only listingId, quantity and the key are sent. There is no price
      // field: the server derives the money from the listing row.
      () => briefApi.createOrder({ listingId: detail.id, quantity, idempotencyKey: key }),
      async () => {
        await loadBrowse();
        await loadOrders();
        const again = await briefApi.getListing(detail.id);
        if (again.ok) setDetail(again.data);
      }
    );
    if (ok) {
      orderKeyRef.current = null;
      setNotice('Order placed. It is not paid yet - arrange payment with the seller.');
      setSection('orders');
      setView({ kind: 'list' });
    }
  };

  const createVendor = () =>
    run(
      'vendor',
      () =>
        briefApi.createVendor({
          displayName: vendorDraft.displayName,
          description: vendorDraft.description,
          contactMethod: vendorDraft.contactMethod || null
        }),
      loadSelling
    );

  const createListing = async () => {
    const price = Number(listingDraft.price);
    const qty = listingDraft.quantity.trim() === '' ? null : Number(listingDraft.quantity);
    const ok = await run(
      'listing',
      () =>
        briefApi.createListing({
          title: listingDraft.title,
          description: listingDraft.description,
          price,
          type: listingDraft.type,
          quantityAvailable: qty,
          locationName: listingDraft.location || null
        }),
      loadSelling
    );
    if (ok) {
      setListingDraft({ title: '', description: '', price: '', type: 'product', quantity: '', location: '' });
    }
  };

  const setStatus = (id: string, status: Listing['status']) =>
    run(id, () => briefApi.setListingStatus(id, status), loadSelling);

  const fulfil = (id: string) => run(id, () => briefApi.fulfilOrder(id), loadSelling);

  const cancel = (id: string) => run(id, () => briefApi.cancelOrder(id), loadOrders);

  const dispute = (id: string) =>
    run(
      id,
      // A fixed reason keeps this batch's dispute primitive small. The reason
      // is stored and shown; arbitration and refunds are deliberately absent.
      () => briefApi.disputeOrder(id, 'Reported a problem with this order'),
      loadOrders
    );

  // --- render --------------------------------------------------------------

  const tabs = (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-4">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          onClick={() => {
            setSection(s.id);
            setView({ kind: 'list' });
            setNotice(null);
          }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
            section === s.id
              ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
              : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B]'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  if (view.kind === 'listing' && detail) {
    return (
      <div>
        {tabs}
        <ListingDetail
          listing={detail}
          quantity={quantity}
          onQuantityChange={(q) => { orderKeyRef.current = null; setQuantity(q); }}
          onOrder={placeOrder}
          onBack={() => setView({ kind: 'list' })}
          onViewVendor={openVendor}
          busy={busyId === detail.id}
          notice={notice}
        />
      </div>
    );
  }

  if (view.kind === 'vendor' && vendorView) {
    return (
      <div>
        {tabs}
        <VendorProfile
          vendor={vendorView.vendor}
          listings={vendorView.listings}
          onBack={() => setView({ kind: 'list' })}
          onOpenListing={openListing}
        />
      </div>
    );
  }

  return (
    <div>
      {tabs}

      {section === 'browse' && (
        <div className="space-y-2">
          {listings.status === 'loading' && (
            <p className="text-xs text-[#8E8E93]">Loading listings...</p>
          )}
          {listings.status === 'error' && (
            <p className="text-xs text-[#C2A24A]">{listings.error}</p>
          )}
          {listings.status === 'ready' && listings.data.length === 0 && (
            // Honest empty state. Nothing is invented to fill the screen.
            <p className="text-xs text-[#8E8E93]">
              Nothing is listed yet. When someone nearby offers something, it appears here.
            </p>
          )}
          {listings.data.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={openListing} />
          ))}
        </div>
      )}

      {section === 'orders' && (
        <div className="space-y-2">
          {notice && <p className="text-[10px] text-[#C2A24A]">{notice}</p>}
          {myOrders.length === 0 ? (
            <p className="text-xs text-[#8E8E93]">You have not ordered anything yet.</p>
          ) : (
            myOrders.map((o) => (
              <React.Fragment key={o.id}>
                <OrderStatus
                  order={o}
                  perspective="buyer"
                  busy={busyId === o.id}
                  onDispute={dispute}
                  onCancel={cancel}
                />
                {/* Checkout lives here, only for an unpaid, uncancelled order.
                    A paid order shows no pay form; a cancelled one is final. */}
                {!o.paid && o.status !== 'cancelled' && o.status !== 'disputed' && (
                  <PayOrder order={o} onPaid={loadOrders} />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      )}

      {section === 'selling' && (
        <VendorPanel
          vendor={myVendor}
          listings={myListings}
          orders={vendorOrders}
          earnings={earnings}
          busyId={busyId}
          notice={notice}
          draft={vendorDraft}
          onDraftChange={(p) => setVendorDraft((d) => ({ ...d, ...p }))}
          onCreateVendor={createVendor}
          listingDraft={listingDraft}
          onListingDraftChange={(p) => setListingDraft((d) => ({ ...d, ...p }))}
          onCreateListing={createListing}
          onSetStatus={setStatus}
          onFulfil={fulfil}
        />
      )}
    </div>
  );
}
