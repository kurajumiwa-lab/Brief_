// ---------------------------------------------------------------------------
// KENYAN PHONE NORMALISATION — one rule, one place.
//
// This lived inside the Tuma connector, which meant four domain modules
// imported a *payment provider* just to validate a phone number. That is the
// wrong dependency direction: the M-Pesa MSISDN rule belongs to the country,
// not to whoever is holding the money this month.
//
// Refuses rather than guesses. A number that is not a valid Kenyan mobile
// returns null, and every caller turns that into a named reason — because an
// STK push or a payout sent to a garbled number is money leaving a building.
// ---------------------------------------------------------------------------

export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already correct */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  if (!/^254[71][0-9]{8}$/.test(n)) return null;
  return n;
}

/** E.164 with the plus, for the channels that want it (Twilio, wa.me). */
export function toE164(input) {
  const n = normalisePhone(input);
  return n ? `+${n}` : null;
}
