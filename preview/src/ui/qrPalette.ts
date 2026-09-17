// ---------------------------------------------------------------------------
// QR COLOURS — the two values a QR encoder must be given as LITERAL hex.
//
// A QR is drawn on a canvas, not in the document, so `var(--brief-ink)` is not a
// colour to `qrcode`'s parser — it throws, the promise rejects, and the component
// falls back to its placeholder box. That is how a ticket code silently stops
// being scannable. So these two stay literals, deliberately outside the room's
// token system, and there is a test that keeps them that way.
//
// FOREGROUND is the room's ink (#241C12) so the code looks like it belongs on a
// warm page. BACKGROUND is #FFFFFF and MUST stay white: a scannable symbol needs
// a light quiet zone with the maximum luminance difference, and "warm plaster"
// behind a QR is how you end up with a code a door reader cannot lock onto.
// ---------------------------------------------------------------------------

export const QR_FOREGROUND = '#241C12';
export const QR_BACKGROUND = '#FFFFFF';

export const QR_COLORS = { dark: QR_FOREGROUND, light: QR_BACKGROUND } as const;

export default QR_COLORS;
