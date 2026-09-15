// ---------------------------------------------------------------------------
// OFFER VALUE — the ONE way a money figure is derived from a quote row.
//
// A quote's price lives in `offers[].terms` as minor units (unitPriceMinor ×
// quotedQuantity, plus delivery, sourcing fee and itemised other costs). The
// canonical arithmetic is `quoteValidation.calculate` — the same function the
// accept path validated with. This module only wraps it so a read path can
// never crash on a partial row and never invent a figure when the row does not
// carry one.
//
// Rules:
//   * returns null unless the row genuinely holds a unit price AND a quantity;
//   * returns the raw minor figure alongside the currency unit, so a caller can
//     show exactly what the row said rather than a rounded "estimate";
//   * an incomplete/invalid row yields null, and null renders as "—" or is
//     omitted. A missing price is never shown as zero.
// ---------------------------------------------------------------------------

import { calculate } from './quoteValidation.js';

/** The value of ONE offer version's terms, derived — never stored. */
export function offerValue(offer) {
  const t = offer?.terms;
  if (!t || t.unitPriceMinor == null || t.quotedQuantity == null) return null;
  try {
    const { totalMinor } = calculate({
      quotedQuantity: t.quotedQuantity,
      unitPriceMinor: t.unitPriceMinor,
      deliveryCostMinor: t.deliveryCostMinor ?? 0,
      sourcingFeeMinor: t.sourcingFeeMinor ?? 0,
      otherCosts: Array.isArray(t.otherCosts) ? t.otherCosts : [],
      currency: t.currency ?? 'KES',
      unit: t.unit ?? ''
    });
    return {
      minor: totalMinor,
      amount: totalMinor / 100,
      currency: t.currency ?? 'KES'
    };
  } catch {
    // A row whose terms were never completed has no price. There is nothing
    // to report, and reporting a guess would be a fabrication.
    return null;
  }
}

/** The offer the requester actually accepted (falls back to the latest). */
export function acceptedOffer(quote, acceptedQuote) {
  if (!quote) return null;
  const offers = quote.offers ?? [];
  if (!offers.length) return null;
  const revision = acceptedQuote?.offerRevision;
  return offers.find((o) => o.revision === revision) ?? offers.at(-1);
}

/** Mean of a list of derived values: null when there is nothing to average. */
export function meanAmount(values) {
  const nums = values.filter((v) => typeof v?.amount === 'number' && Number.isFinite(v.amount));
  if (!nums.length) return null;
  const sum = nums.reduce((s, v) => s + v.amount, 0);
  return {
    amount: Math.round((sum / nums.length) * 100) / 100,
    currency: nums[0].currency,
    sampleCount: nums.length
  };
}
