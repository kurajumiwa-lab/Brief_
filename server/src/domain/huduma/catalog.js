// ---------------------------------------------------------------------------
// HUDUMALINK — SERVICE CATALOG
//
// The single source of truth for WHAT HudumaLink sells and HOW MUCH it costs.
//
// THE CENTRAL RULE (inherited from the rest of this codebase):
//
//     Money is derived here, on the server. It is never read from a client
//     payload. A WhatsApp button carries a service *id*; the router looks the
//     id up in this catalog and the price is arithmetic on these rows.
//
// The blueprint's pricing model is three parts, made explicit rather than
// hidden inside a single number:
//
//   govFee            what the government portal itself charges (passed
//                     through, never marked up as profit)
//   platformFee       HudumaLink's margin for the automation work
//   processingMargin  the STK/Payout rail + float margin
//
//   total = govFee + platformFee + processingMargin   (always whole shillings)
//
// Each service declares its EXECUTION KIND, because that decides which
// back-end loop fulfils it:
//
//   software  headless document automation (a compiled PDF returned in chat)
//   runner    a geo-fenced gig dispatched to a verified field operator
//
// And each service declares the free-text INPUTS the chat must capture before
// an order is placed, so the router knows how many conversational turns to run
// before it can confirm.
// ---------------------------------------------------------------------------

export const EXECUTION = {
  SOFTWARE: 'software',
  RUNNER: 'runner'
};

export const CATEGORIES = [
  { id: 'business',  title: 'Business & Corporate' },
  { id: 'lands',     title: 'Lands & Property' },
  { id: 'delivery',  title: 'Document Delivery' }
];

/**
 * The catalog. Fees are whole KES. The first input is the field the chat asks
 * for first; subsequent inputs are asked in order until none remain.
 */
const SERVICES = [
  {
    id: 'cr12',
    title: 'Fetch Official CR12 Document',
    category: 'business',
    execution: EXECUTION.SOFTWARE,
    govFee: 350,
    platformFee: 100,
    processingMargin: 50,
    blurb: 'Official CR12 (company directors) — delivered as a stamped PDF.',
    inputs: [{ key: 'companyRef', label: 'Company Name or Registration Number' }]
  },
  {
    id: 'tenancy',
    title: 'Draft & Digitally Sign Tenancy Agreement',
    category: 'business',
    execution: EXECUTION.SOFTWARE,
    govFee: 0,
    platformFee: 1300,
    processingMargin: 200,
    blurb: 'A ready-to-sign tenancy agreement, compiled and digitally stamped.',
    inputs: [
      { key: 'tenantName', label: 'Tenant full name' },
      { key: 'landlordName', label: 'Landlord full name' },
      { key: 'propertyAddress', label: 'Property address' },
      { key: 'monthlyRent', label: 'Monthly rent in KES' }
    ]
  },
  {
    id: 'company_reg',
    title: 'Start Full Company Registration',
    category: 'business',
    execution: EXECUTION.RUNNER,
    govFee: 1500,
    platformFee: 1500,
    processingMargin: 500,
    blurb: 'End-to-end company registration, handled by a verified runner.',
    inputs: [
      { key: 'proposedName', label: 'Proposed company name' },
      { key: 'directorName', label: 'Director full name' },
      { key: 'idNumber', label: 'Director ID number' }
    ]
  },
  {
    id: 'title_search',
    title: 'Lands Title Search',
    category: 'lands',
    execution: EXECUTION.SOFTWARE,
    govFee: 500,
    platformFee: 450,
    processingMargin: 50,
    blurb: 'Official lands title search, returned as a PDF.',
    inputs: [{ key: 'titleNumber', label: 'Title number' }]
  },
  {
    id: 'rate_clearance',
    title: 'Land Rate Clearance Certificate',
    category: 'lands',
    execution: EXECUTION.RUNNER,
    govFee: 0,
    platformFee: 900,
    processingMargin: 100,
    blurb: 'County rate clearance, picked up and delivered by a runner.',
    inputs: [
      { key: 'plotNumber', label: 'Plot / LR number' },
      { key: 'county', label: 'County' }
    ]
  },
  {
    id: 'logbook',
    title: 'NTSA Logbook Pickup',
    category: 'delivery',
    execution: EXECUTION.RUNNER,
    govFee: 0,
    platformFee: 800,
    processingMargin: 200,
    blurb: 'Your processed NTSA logbook, picked up and delivered.',
    inputs: [{ key: 'vehicleReg', label: 'Vehicle registration number' }]
  },
  {
    id: 'passport',
    title: 'Passport Pickup / Delivery',
    category: 'delivery',
    execution: EXECUTION.RUNNER,
    govFee: 0,
    platformFee: 1200,
    processingMargin: 300,
    blurb: 'Your ready passport, collected and delivered to you.',
    inputs: [{ key: 'applicationRef', label: 'Application / receipt number' }]
  }
];

const BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

export function getService(id) {
  return BY_ID.get(id) ?? null;
}

export function servicesByCategory(categoryId) {
  return SERVICES.filter((s) => s.category === categoryId);
}

export function categoryById(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) ?? null;
}

/**
 * Derive the full price picture for a service. Pure arithmetic — never accepts
 * an amount from the caller. Used by the order domain so the totals written
 * to the escrow ledger are guaranteed to match the catalog.
 */
export function priceFor(serviceOrId) {
  const svc = typeof serviceOrId === 'string' ? getService(serviceOrId) : serviceOrId;
  if (!svc) throw new Error('unknown service');
  const govFee = Math.trunc(svc.govFee);
  const platformFee = Math.trunc(svc.platformFee);
  const processingMargin = Math.trunc(svc.processingMargin);
  const total = govFee + platformFee + processingMargin;
  // A total that is not a positive whole number can never back a real STK push,
  // so it is rejected here rather than at the payment rail.
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error(`service ${svc.id} has an invalid total (${total})`);
  }
  return { govFee, platformFee, processingMargin, total, currency: 'KES' };
}

/** Human-readable fee breakdown for the chat reply. */
export function feeBreakdown(serviceOrId) {
  const svc = typeof serviceOrId === 'string' ? getService(serviceOrId) : serviceOrId;
  const p = priceFor(svc);
  return [
    `Gov fee: KES ${p.govFee}`,
    `Service fee: KES ${p.platformFee + p.processingMargin}`,
    `Total: KES ${p.total}`
  ].join('\n');
}

export function allServices() {
  return SERVICES.slice();
}
