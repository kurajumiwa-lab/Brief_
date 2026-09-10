// ---------------------------------------------------------------------------
// ACQUISITION — client-side provenance capture (the distribution link's landing).
//
// A partner shares ONE join link (`/join?partner=…&program=…&cohort=…&utm_*`).
// This module captures that context the moment the page loads, holds it until
// the person signs up, and hands it to the register/sign-in calls so the server
// can record it once (first-touch-wins, in domain/attribution.js).
//
// It is deliberately tiny and dumb: it never invents a partner and never
// overwrites a context already captured in this browser (the FIRST link a
// person clicked is their true origin; a later visit must not rewrite it).
// ---------------------------------------------------------------------------

const KEY = 'brief.acquisition';

// The provenance fields the server accepts (mirrors attribution.CAPTURE_KEYS).
const FIELDS = [
  'partnerKey', 'partnerName', 'programKey', 'programName',
  'cohortKey', 'cohortName', 'inviteCode', 'channel', 'source',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent'
] as const;

export type AcquisitionContext = Partial<Record<(typeof FIELDS)[number], string>>;

// Map a URLSearchParams into the server's field names. Query keys are the
// friendly short names (?partner=, ?program=, ?cohort=, ?invite=, ?channel=)
// plus the standard utm_* set.
function contextFromParams(params: URLSearchParams): AcquisitionContext {
  const ctx: AcquisitionContext = {};
  const take = (src: string, dst: keyof AcquisitionContext) => {
    const v = params.get(src);
    if (v) ctx[dst] = v.slice(0, 128);
  };
  take('partner', 'partnerKey');
  take('partner_name', 'partnerName');
  take('program', 'programKey');
  take('program_name', 'programName');
  take('cohort', 'cohortKey');
  take('cohort_name', 'cohortName');
  take('invite', 'inviteCode');
  take('channel', 'channel');
  take('source', 'source');
  take('utm_source', 'utmSource');
  take('utm_medium', 'utmMedium');
  take('utm_campaign', 'utmCampaign');
  take('utm_content', 'utmContent');
  return ctx;
}

function hasAny(ctx: AcquisitionContext): boolean {
  return FIELDS.some((k) => Boolean(ctx[k]));
}

/** Capture the current page's acquisition context, first-touch-wins. Safe to
 *  call repeatedly; a context already held is never overwritten. */
export function captureAcquisitionFromUrl(): void {
  if (typeof window === 'undefined') return;
  const existing = pendingAcquisition();
  if (existing && hasAny(existing)) return; // first touch wins
  const ctx = contextFromParams(new URLSearchParams(window.location.search));
  if (!hasAny(ctx)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* storage may be unavailable (private mode); attribution just won't persist */
  }
}

/** The pending acquisition context, or null when none was captured. */
export function pendingAcquisition(): AcquisitionContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcquisitionContext;
    return hasAny(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Clear the captured context (after a successful sign-up forwards it). */
export function clearAcquisition(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
