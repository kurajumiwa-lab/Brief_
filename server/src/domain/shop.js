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
import { createGroupBuy, contribute, getGroupBuy } from './groupbuy.js';

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
  const stockQty = raw?.stockQty == null || raw?.stockQty === '' ? null : Math.round(Number(raw.stockQty));
  if (stockQty != null && (!Number.isInteger(stockQty) || stockQty < 0 || stockQty > 100000)) {
    throw new Error(`item ${index + 1} (${name}): stock must be a whole number of units, or left blank`);
  }
  return { id: raw?.id ?? newId('shopitem'), name, priceKes, note: note || null, stockQty };
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
// --- The Duka Book (the paper-ledger replacement) ----------------------------
//
// HONESTY FIRST: orders that happen inside WhatsApp are not seen by Brief and
// it never pretends otherwise. The Book is what the shopkeeper logs — a
// 3-field sale record (item, qty, price) — and everything else is derived:
// today, yesterday, the week, top items, low stock. Ten seconds a day beats a
// shoebox of paper, and the logged rows are the only sales truth there is.
//
// clientKey: sales may arrive from the offline queue (see the PWA shell), so
// recordSale is idempotent per (owner, clientKey) — a replayed write is a
// no-op that returns the original row, never a second sale.

const CHANNELS = ['counter', 'whatsapp', 'other'];

/** Kenya-local calendar day (YYYY-MM-DD). The duka's "today" is Nairobi's. */
function nairobiDay(iso = new Date().toISOString()) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export function recordSale(userId, { name, qty, unitKes, channel = 'counter', clientKey = null } = {}) {
  const shop = store.find('shops', (s) => s.ownerId === userId);
  if (!shop) throw new Error('save the shop first — the book belongs to it');
  const cleanName = String(name ?? '').trim().slice(0, 60);
  if (!cleanName) throw new Error('what sold? the item name is required');
  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1 || q > 1000) throw new Error('quantity must be a whole number between 1 and 1000');
  const unit = Math.round(Number(unitKes));
  if (!Number.isFinite(unit) || unit < 1 || unit > 1_000_000) throw new Error('the unit price must be whole shillings');
  if (!CHANNELS.includes(channel)) throw new Error(`channel must be one of ${CHANNELS.join(', ')}`);
  const key = clientKey ? String(clientKey).trim().slice(0, 80) : null;

  if (key) {
    const existing = store.find('shopSales', (r) => r.ownerId === userId && r.clientKey === key);
    if (existing) return { sale: existing, replayed: true };
  }

  const sale = store.insert('shopSales', {
    id: newId('sale'),
    ownerId: userId,
    shopId: shop.id,
    name: cleanName,
    qty: q,
    unitKes: unit,
    amountKes: q * unit,
    channel,
    day: nairobiDay(),
    clientKey: key,
    createdAt: new Date().toISOString()
  });
  return { sale, replayed: false };
}

/** The whole book, derived. Nothing here is stored. */
export function bookView(userId) {
  const shop = myShop(userId);
  const rows = store
    .filter('shopSales', (r) => r.ownerId === userId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const today = nairobiDay();
  const yesterday = nairobiDay(new Date(Date.now() - 86400000).toISOString());
  const weekStart = nairobiDay(new Date(Date.now() - 6 * 86400000).toISOString());

  const sumOf = (list) => ({
    sales: list.length,
    items: list.reduce((t, r) => t + r.qty, 0),
    kes: list.reduce((t, r) => t + r.amountKes, 0)
  });
  const dayRows = (d) => rows.filter((r) => r.day === d);
  const weekRows = rows.filter((r) => r.day >= weekStart);

  // Per-item movement, joined against the price list so low stock is real.
  const soldByItem = new Map();
  for (const r of weekRows) soldByItem.set(r.name, (soldByItem.get(r.name) ?? 0) + r.qty);
  const items = (shop.items ?? []).map((it) => ({
    name: it.name,
    priceKes: it.priceKes,
    stockQty: it.stockQty ?? null,
    soldWeek: soldByItem.get(it.name) ?? 0,
    remaining: it.stockQty != null ? Math.max(0, it.stockQty - (soldByItem.get(it.name) ?? 0)) : null
  }));

  const topItems = [...soldByItem.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    shop: { id: shop.id, name: shop.name, status: shop.status },
    today: sumOf(dayRows(today)),
    yesterday: sumOf(dayRows(yesterday)),
    week: sumOf(weekRows),
    topItems,
    items,
    lowStock: items.filter((it) => it.remaining != null && it.remaining <= 2),
    recent: rows.slice(0, 8),
    note: 'The book holds what you log. Sales that happen inside WhatsApp are yours to record — ten seconds keeps the book true.'
  };
}

// --- Pool a restock (the Shop ↔ Group Buy bridge) ----------------------------
//
// "Wholesale aggregation" on the existing engine: the shopkeeper picks an
// item THEY SELL, declares the bulk unit cost and a goal, pledges their own
// units, and Brief opens a Group Buy whose target is the bulk cost of the
// goal. Other shops contribute toward the same target; the money records,
// escrow stages and receipts are the Group Buy engine's, unchanged. The
// share text is the forwardable WhatsApp call for other shopkeepers.

export function poolRestock(userId, { itemName, unitCostKes, goalUnits, myUnits, note = null } = {}) {
  const shop = store.find('shops', (s) => s.ownerId === userId);
  if (!shop) throw new Error('save the shop first');
  const item = (shop.items ?? []).find((it) => it.name === String(itemName ?? '').trim());
  if (!item) throw new Error('pool an item that is on your price list');

  const unitCost = Math.round(Number(unitCostKes));
  if (!Number.isFinite(unitCost) || unitCost < 1 || unitCost > 1_000_000) throw new Error('the bulk unit cost must be whole shillings');
  const goal = Number(goalUnits);
  if (!Number.isInteger(goal) || goal < 2 || goal > 1000) throw new Error('the goal must be at least 2 units (a pool needs others)');
  const mine = Number(myUnits);
  if (!Number.isInteger(mine) || mine < 1 || mine > goal) throw new Error('your pledge must be between 1 unit and the goal');

  const target = unitCost * goal;
  const buy = createGroupBuy({
    ownerId: userId,
    title: `Restock pool: ${item.name}`,
    targetAmount: target,
    note: note ? String(note).trim().slice(0, 200) : `Bulk ${unitCost.toLocaleString('en-KE')}/unit · goal ${goal} · pool by ${shop.name}`
  });
  contribute({ groupBuyId: buy.id, memberRef: `${shop.name} (owner)`, amount: unitCost * mine, source: 'mpesa' });

  const poolText = [
    '*RESTOCK POOL*',
    `_${item.name} — pooled by ${shop.name}_`,
    '',
    `Bulk price: *KES ${unitCost.toLocaleString('en-KE')}/unit*`,
    `Goal: ${goal} units (KES ${target.toLocaleString('en-KE')})`,
    `Pledged so far: ${mine} units`,
    '',
    'Pool with me and we all buy at the bulk price.',
    'Join in Brief → Workflows → Group Buy'
  ].join('\n');

  const view = getGroupBuy(buy.id);
  return {
    pool: view,
    share: { text: poolText, waMe: `${waMeLink(shop).split('?')[0]}?text=${encodeURIComponent(poolText)}` }
  };
}
