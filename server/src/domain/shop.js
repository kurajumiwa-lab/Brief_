// ---------------------------------------------------------------------------
// WHATSAPP SHOP — the builder, not the storefront.
//
// Architecture, stated honestly:
//   * Brief BUILDS the shop: name, tagline, order number, a price list.
//   * WhatsApp IS the shop. The output is a correctly-formatted WhatsApp
//     message (real formatting: *bold*, _italic_) plus a wa.me deep link
//     that opens a chat with the catalog pre-filled. The conversation is
//     where selling happens — Brief does not sit in the middle of it.
//   * NO WhatsApp payments, ever, by design. Buyers and sellers arrange
//     money the way they already do (Pochi la Biashara, till, send money).
//     Brief's own fee is the store service below, paid through the same
//     manual Pochi flow as every other Brief service.
//   * Drafting is free forever. PUBLISHING requires an active store service
//     (SERVICE_CATALOG.store_monthly), derived from CONFIRMED service
//     payment rows — never from a client-sent flag.
//
// Why a message and not the Business catalog? The WhatsApp Business app
// catalog (500 products, 10 images, free) is the right home for photos;
// this builder produces the PRICE LIST people actually forward — a text
// that survives a screenshot, a status post and a broadcast list.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { SERVICE_CATALOG } from './fees.js';
import { notify } from './notifications.js';

const MAX_ITEMS = 40; // a forwarded price list must stay readable
const STORE_DAYS = 30; // store_monthly is one calendar month of service

const PHONE_SHAPE = /^\+?[0-9][0-9\s()-]{6,19}$/;

function cleanItem(raw, index) {
  const name = String(raw?.name ?? '').trim().slice(0, 60);
  const priceKes = Math.round(Number(raw?.priceKes));
  const note = String(raw?.note ?? '').trim().slice(0, 40);
  if (!name) throw new Error(`item ${index + 1} needs a name`);
  if (!Number.isFinite(priceKes) || priceKes < 1 || priceKes > 1_000_000) {
    throw new Error(`item ${index + 1} (${name}) needs a price in whole shillings`);
  }
  return { id: raw?.id ?? newId('shopitem'), name, priceKes, note: note || null };
}

/** The member's single shop row, or a blank draft. One shop per member:
 *  this is "your shop", not a marketplace of anonymous fronts. */
export function myShop(userId) {
  return (
    store.find('shops', (s) => s.ownerId === userId) ?? {
      id: null,
      ownerId: userId,
      name: '',
      tagline: '',
      orderNumber: '',
      items: [],
      status: 'draft',
      publishedAt: null
    }
  );
}

/** The store service, DERIVED from confirmed payment rows. */
export function storeService(userId, now = new Date()) {
  const confirmed = store
    .filter('servicePayments', (f) => f.userId === userId && f.service === 'store_monthly' && f.status === 'confirmed')
    .sort((a, b) => (a.confirmedAt < b.confirmedAt ? 1 : -1));
  const latest = confirmed[0] ?? null;
  const activeUntil = latest ? new Date(new Date(latest.confirmedAt).getTime() + STORE_DAYS * 86400000) : null;
  return {
    priceKes: SERVICE_CATALOG.store_monthly.amountKes,
    active: Boolean(activeUntil && activeUntil > now),
    activeUntil: activeUntil ? activeUntil.toISOString() : null
  };
}

/** Save the draft. A published shop may edit its list in place — a price
 *  change is exactly what the forward is FOR — but must stay publishable. */
export function saveShop(userId, { name, tagline, orderNumber, items } = {}) {
  const clean = {
    name: String(name ?? '').trim().slice(0, 40),
    tagline: String(tagline ?? '').trim().slice(0, 60),
    orderNumber: String(orderNumber ?? '').trim().slice(0, 20)
  };
  if (clean.name.length < 2) throw new Error('the shop needs a name');
  if (!PHONE_SHAPE.test(clean.orderNumber)) throw new Error('the order number must be a phone number customers can reach on WhatsApp');
  const list = Array.isArray(items) ? items : [];
  if (list.length < 1) throw new Error('add at least one item to the price list');
  if (list.length > MAX_ITEMS) throw new Error(`keep the list at ${MAX_ITEMS} items — a forwarded message must stay readable`);
  const cleanedItems = list.map(cleanItem);

  const existing = store.find('shops', (s) => s.ownerId === userId);
  if (existing) {
    return store.update('shops', existing.id, { ...clean, items: cleanedItems });
  }
  return store.insert('shops', {
    id: newId('shop'),
    ownerId: userId,
    ...clean,
    items: cleanedItems,
    status: 'draft',
    publishedAt: null,
    createdAt: new Date().toISOString()
  });
}

/** Publish = the shareable state. Gated on a CONFIRMED store service. */
export function publishShop(userId) {
  const shop = store.find('shops', (s) => s.ownerId === userId);
  if (!shop) throw new Error('save the shop first');
  const service = storeService(userId);
  if (!service.active) {
    const e = new Error(`publishing needs the store service — KES ${service.priceKes}/month via Pochi la Biashara, confirmed by an operator`);
    e.status = 409;
    e.requiresService = 'store_monthly';
    throw e;
  }
  if (shop.status === 'published') return { shop, changed: false };
  const updated = store.update('shops', shop.id, { status: 'published', publishedAt: new Date().toISOString() });
  notify(userId, {
    kind: 'system',
    title: 'Your WhatsApp shop is live',
    body: `${shop.name} — share the wa.me link from the shop builder. Buyers reply in WhatsApp; money is arranged between you.`
  });
  return { shop: updated, changed: true };
}

export function unpublishShop(userId) {
  const shop = store.find('shops', (s) => s.ownerId === userId);
  if (!shop) throw new Error('save the shop first');
  if (shop.status !== 'published') return { shop, changed: false };
  return { shop: store.update('shops', shop.id, { status: 'draft' }), changed: true };
}

// --- The output: WhatsApp itself --------------------------------------------

/** WhatsApp's real formatting: *bold* and _italic_ (no underline exists).
 *  This is the exact text a member copies into a status or broadcast. */
export function whatsappText(shop) {
  const lines = [`*${shop.name}*`];
  if (shop.tagline) lines.push(`_${shop.tagline}_`);
  lines.push('', '🛒 *PRICE LIST*');
  shop.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} — *KES ${item.priceKes.toLocaleString('en-KE')}*${item.note ? ` _${item.note}_` : ''}`);
  });
  lines.push('', '📲 To order, reply with the item number');
  return lines.join('\n');
}

/** The deep link: opens a WhatsApp chat with the catalog pre-filled. */
export function waMeLink(shop) {
  const digits = shop.orderNumber.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappText(shop))}`;
}

/** Everything the builder screen renders, in one read. */
export function shopView(userId) {
  const shop = myShop(userId);
  const service = storeService(userId);
  const hasShop = Boolean(shop.id);
  return {
    shop,
    store: service,
    share: hasShop
      ? { text: whatsappText(shop), waMe: waMeLink(shop), shareable: shop.status === 'published' }
      : null
  };
}
