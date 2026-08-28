// ---------------------------------------------------------------------------
// RUNTIME RESPONSE VALIDATION
//
// HTTP 200 + malformed JSON != valid application state.
//
// The Phase 3 client validated the ENVELOPE (is `circles` an array?) but not
// the ELEMENTS. A response of {"circles":[{}]} therefore parsed as success and
// handed the UI a circle whose currentValue was `undefined` and whose
// progressPct was the string "abc" -- which renders as "abc%".
//
// These guards check the fields the UI will actually read. Anything that fails
// is reported as an API error, so a surface shows an honest failure instead of
// "KES undefined".
//
// Deliberately hand-written: adding a schema library for ~8 shapes would be a
// dependency the repository does not otherwise need.
// ---------------------------------------------------------------------------

import type {
  AppConfig,
  MediaUpload,
  Vendor,
  Listing,
  Order,
  Dispute,
  Source,
  BriefItPreview,
  CampaignShare,
  CampaignBanner,
  PaymentConfirmation,
  Campaign,
  PublicCampaign,
  Registration,
  AuthStatus,
  Block,
  Circle,
  Member,
  ProviderStatus,
  RawItem,
  VoteTally,
  EvidenceItem,
  MemberEvidence,
  Signal,
  Transaction,
  Wallet,
  PaymentIntent,
  Vault,
  Footstep,
  VaultRequest,
  Ticket,
  CommandCentre,
  TeaArticle,
  TriageItem,
  TriageQueue,
  Subscription,
  Subscriber,
  SubscriptionJoin
} from './types';

// --- primitives -------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';

/** Rejects NaN and Infinity: both survive `typeof === 'number'` and both render as garbage. */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isBoolOrUndefined = (v: unknown): boolean => v === undefined || isBool(v);

/**
 * A viewer role is one of the five real roles, or null for "not a member".
 * An unknown string is rejected rather than rendered: a role the client does
 * not understand would be displayed as authority the member does not have.
 */
const isRoleOrNull = (v: unknown): boolean =>
  v === null || v === 'coordinator' || v === 'contributor' || v === 'scout'
  || v === 'logistics' || v === 'observer';

/**
 * Validate every element. Returns undefined if ANY element is malformed --
 * a partially-valid list is still a broken contract, and silently dropping
 * rows would hide the problem.
 */
function all<T>(v: unknown, guard: (x: unknown) => x is T): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  for (const item of v) if (!guard(item)) return undefined;
  return v as T[];
}

// --- circle -----------------------------------------------------------------

/**
 * Every field the UI reads is checked. `currentValue`, `contributorCount` and
 * `settledCount` are server-derived and must always be present numbers --
 * their absence is what produced "undefined" in the progress bar.
 */
export function isCircle(v: unknown): v is Circle {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.name) &&
    isStr(v.type) &&
    isStr(v.status) &&
    isStr(v.visibility) &&
    isNumOrNull(v.targetValue) &&
    isNum(v.currentValue) &&
    isNum(v.contributorCount) &&
    isNum(v.settledCount) &&
    isNum(v.blockCount) &&
    isNum(v.memberCount) &&
    // null is legitimate: a circle with no targetValue has no percentage.
    isNumOrNull(v.progressPct) &&
    isStr(v.createdAt) &&
    // Membership facts about the viewer. An API that predates these fields
    // cannot claim a membership for you either way, so a missing viewerRole
    // is read as "not shown as a member" -- the honest reading of silence --
    // while a role that is not one of the five is rejected outright.
    (v.viewerRole === undefined || isRoleOrNull(v.viewerRole)) &&
    isBoolOrUndefined(v.isMember) &&
    isBoolOrUndefined(v.canJoin)
  );
}

export const areCircles = (v: unknown) => all(v, isCircle);

// --- member + trust ---------------------------------------------------------

/** Evidence entries must carry a displayable label. */
function isEvidenceLike(v: unknown): boolean {
  return isObj(v) && isStr(v.kind) && isStr(v.label);
}

export function isMember(v: unknown): v is Member {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.circleId) || !isStr(v.userId) || !isStr(v.role)) return false;
  if (!isStr(v.joinedAt)) return false;
  // trust must exist: the UI reads member.trust.evidence directly and would throw.
  const t = v.trust;
  if (!isObj(t)) return false;
  if (!Array.isArray(t.evidence) || !t.evidence.every(isEvidenceLike)) return false;
  if (!Array.isArray(t.facts) || !t.facts.every(isEvidenceLike)) return false;
  if (!isNum(t.verifiedCount)) return false;
  // A numeric trust score must never appear. If a future server adds one,
  // fail loudly here rather than letting it reach the UI.
  if ('score' in t || 'trustScore' in v || 'reputation' in v) return false;
  return true;
}

export const areMembers = (v: unknown) => all(v, isMember);

// --- block ------------------------------------------------------------------

export function isBlock(v: unknown): v is Block {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.circleId) &&
    isStr(v.type) &&
    isStr(v.content) &&
    isStrOrNull(v.objectId) &&
    Array.isArray(v.sources) &&
    isStr(v.createdAt)
  );
}

export const areBlocks = (v: unknown) => all(v, isBlock);

// --- signal -----------------------------------------------------------------

export function isSignal(v: unknown): v is Signal {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.type) &&
    isStrOrNull(v.circleId) &&
    isNumOrNull(v.value) &&
    isStr(v.createdAt)
  );
}

export const areSignals = (v: unknown) => all(v, isSignal);

// --- economic ---------------------------------------------------------------

export function isProviderStatus(v: unknown): v is ProviderStatus {
  return isObj(v) && isBool(v.configured) && isStr(v.reason);
}

export function isTransaction(v: unknown): v is Transaction {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isNum(v.amount) &&
    isStr(v.currency) &&
    isStr(v.type) &&
    isStr(v.status) &&
    isStrOrNull(v.circleId) &&
    isStrOrNull(v.counterparty) &&
    Array.isArray(v.history) &&
    isStr(v.createdAt)
  );
}

export const areTransactions = (v: unknown) => all(v, isTransaction);

export function isWallet(v: unknown): v is Wallet {
  if (!isObj(v)) return false;
  return (
    isNum(v.balance) &&
    isNum(v.pending) &&
    isStr(v.currency) &&
    isNum(v.transactionCount) &&
    isProviderStatus(v.provider)
  );
}

export function isAuthStatus(v: unknown): v is AuthStatus {
  return isObj(v) && isBool(v.configured) && isStr(v.reason) && isStr(v.method);
}

// --- campaign ---------------------------------------------------------------

function isMetrics(v: unknown): boolean {
  if (!isObj(v)) return false;
  return (
    isNum(v.views) && isNumOrNull(v.viewers) && isNum(v.shares) &&
    isNum(v.registrations) && isNum(v.checkedIn) &&
    isNum(v.slotsTaken) && isNum(v.revenueSettled) && isNum(v.revenuePending) &&
    isStr(v.currency) && isNumOrNull(v.capacity) && isNumOrNull(v.remaining) &&
    isNumOrNull(v.conversionPct)
  );
}

export function isCampaign(v: unknown): v is Campaign {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) && isStr(v.ownerId) && isStr(v.title) && isStr(v.type) &&
    isStr(v.status) && isStr(v.publicSlug) && isNum(v.price) &&
    isStr(v.currency) && isNumOrNull(v.capacity) && isMetrics(v.metrics)
  );
}

export const areCampaigns = (v: unknown) => all(v, isCampaign);

/**
 * The public projection must NOT carry private fields. If a future server
 * change starts leaking ownerId or internal ids, fail here rather than
 * rendering them.
 */
export function isPublicCampaign(v: unknown): v is PublicCampaign {
  if (!isObj(v)) return false;
  if ('ownerId' in v || 'id' in v || 'objectId' in v || 'metrics' in v) return false;
  return (
    isStr(v.slug) && isStr(v.title) && isStr(v.status) &&
    isNum(v.price) && isStr(v.currency) && isNumOrNull(v.remaining) &&
    isNum(v.registered)
  );
}

export function isRegistration(v: unknown): v is Registration {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.status) && isStr(v.createdAt);
}

export const areRegistrations = (v: unknown) => all(v, isRegistration);


/**
 * Validates the server share payload. A malformed or partial response must
 * NOT degrade into a half-built URL: anything unexpected is rejected outright
 * so the UI falls back to the honest "no link yet" state.
 */
/**
 * A confirmation is only trusted if the transaction really came back settled
 * AND the registration really came back promoted. A partial or optimistic
 * response is rejected rather than shown to the creator as success.
 */
export function isPaymentConfirmation(v: unknown): v is PaymentConfirmation {
  if (!isObj(v)) return false;
  if (!isRegistration(v.registration) || !isTransaction(v.transaction)) return false;
  if (!isObj(v.analytics)) return false;
  return v.transaction.status === 'settled';
}

export function isCampaignShare(v: unknown): v is CampaignShare {
  if (!isObj(v)) return false;
  if (!isStr(v.slug)) return false;
  if (v.available === false) return v.reason === 'public_origin_not_configured';
  if (v.available !== true) return false;
  if (!isStr(v.url) || !isObj(v.channels)) return false;
  return isStr(v.channels.whatsapp) && isStr(v.channels.telegram) && isStr(v.channels.x);
}

export function isCampaignBanner(v: unknown): v is CampaignBanner {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.campaignId) || !isStr(v.title) || !isStr(v.status) || !isStr(v.createdAt)) return false;
  if (!['active', 'archived'].includes(v.status)) return false;
  if (!(v.body === null || isStr(v.body)) || !(v.location === null || isStr(v.location))) return false;
  if (!(v.startsAt === null || isStr(v.startsAt)) || !(v.imageUrl === null || isStr(v.imageUrl))) return false;
  if (!isObj(v.share)) return false;
  if (v.share.available === true) {
    return isStr(v.share.url) && isObj(v.share.channels) && isStr(v.share.channels.whatsapp);
  }
  return v.share.available === false && isStr(v.share.reason);
}

export const areCampaignBanners = (v: unknown) => all(v, isCampaignBanner);

export function isAppConfig(v: unknown): v is AppConfig {
  if (!isObj(v)) return false;
  return (
    (v.publicOrigin === null || isStr(v.publicOrigin)) && isStr(v.campaignPathPrefix)
  );
}

// --- source -----------------------------------------------------------------
//
// The derived counts are required to be real numbers. A source whose server
// row is missing them is a contract mismatch, not a source with zero activity:
// "0 items processed" and "we do not know" are different claims and Brief must
// never silently turn the second into the first.

export function isSource(v: unknown): v is Source {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.name) &&
    isStr(v.type) &&
    isNum(v.itemsProcessed) &&
    isNum(v.itemsPending) &&
    isNum(v.itemsRejected) &&
    isNum(v.objectsCreated)
  );
}

export const areSources = (v: unknown) => all(v, isSource);

// --- raw items --------------------------------------------------------------
//
// `text` is required and must be a string: a raw item with no text is not a
// message that arrived, it is a broken row, and showing it in the review queue
// would invite a reviewer to accept nothing into the graph.

export function isRawItem(v: unknown): v is RawItem {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.sourceId) && isStr(v.text) && isStr(v.processingStatus);
}

export const areRawItems = (v: unknown) => all(v, isRawItem);

// --- circle operations -------------------------------------------------------
//
// A tally is only trustworthy if it is shaped correctly: `results` must be a
// real array and `totalVotes` a real number. A malformed tally reaching the UI
// would render as a confident-looking result computed from nothing.

export function isVoteTally(v: unknown): v is VoteTally {
  if (!isObj(v)) return false;
  return (
    isStr(v.blockId) &&
    isNum(v.totalVotes) &&
    Array.isArray(v.results) &&
    v.results.every(
      (r: any) => isObj(r) && isStr(r.option) && isNum(r.count)
    )
  );
}

export function isEvidenceItem(v: unknown): v is EvidenceItem {
  if (!isObj(v)) return false;
  return isStr(v.kind) && isStr(v.label) && isStr(v.signalId) && isStr(v.at);
}

export function isMemberEvidence(v: unknown): v is MemberEvidence {
  if (!isObj(v)) return false;
  return (
    Array.isArray(v.evidence) &&
    v.evidence.every(isEvidenceItem) &&
    Array.isArray(v.summary) &&
    v.summary.every((x: any) => isObj(x) && isStr(x.kind) && isNum(x.count) && isStr(x.label))
  );
}

// --- brief-it ---------------------------------------------------------------
//
// `worthy` must be a real boolean. If the server did not say, the UI must not
// guess -- claiming "nothing worth keeping" about text that was never assessed
// is exactly the kind of invented certainty this layer exists to prevent.

export function isBriefItPreview(v: unknown): v is BriefItPreview {
  if (!isObj(v)) return false;
  return isBool(v.worthy) && isObj(v.fields) && isNum(v.confidence);
}

// --- commerce (Batch 3) -----------------------------------------------------
//
// These guard the fields the marketplace UI actually reads. A malformed price
// or total is the dangerous case: "KES undefined" is embarrassing, but a
// total that parses as NaN and renders as a blank is worse, because a buyer
// could commit to it. isNum() rejects NaN and Infinity for exactly that reason.

function isEvidenceList(v: unknown): boolean {
  return Array.isArray(v) && v.every((e) => isObj(e) && isStr(e.kind) && isStr(e.label));
}

export function isVendor(v: unknown): v is Vendor {
  if (!isObj(v)) return false;
  const ver = v.verification;
  return (
    isStr(v.id) &&
    isStr(v.ownerId) &&
    isStr(v.displayName) &&
    isStr(v.status) &&
    isObj(ver) &&
    isEvidenceList(ver.evidence) &&
    isEvidenceList(ver.facts) &&
    isNum(ver.verifiedCount) &&
    // A score must never appear. If a future server starts sending one, the
    // client refuses the payload instead of quietly rendering it.
    !('score' in ver) && !('rating' in ver) && !('trustScore' in v)
  );
}

export const areVendors = (v: unknown) => all(v, isVendor);

export function isListing(v: unknown): v is Listing {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.vendorId) &&
    isStr(v.title) &&
    isStr(v.type) &&
    isNum(v.price) &&
    isStr(v.currency) &&
    isNumOrNull(v.quantityAvailable) &&
    isStrOrNull(v.locationName) &&
    isStr(v.status) &&
    isBool(v.orderable) &&
    isStrOrNull(v.unorderableReason)
  );
}

export const areListings = (v: unknown) => all(v, isListing);

export function isOrder(v: unknown): v is Order {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.listingId) &&
    isStr(v.listingTitle) &&
    isStr(v.buyerId) &&
    isStr(v.vendorId) &&
    isNum(v.quantity) &&
    isNum(v.unitPrice) &&
    isNum(v.total) &&
    isStr(v.currency) &&
    isStr(v.status) &&
    isBool(v.paid) &&
    isStr(v.paymentStatus) &&
    Array.isArray(v.history)
  );
}

export const areOrders = (v: unknown) => all(v, isOrder);

export function isDispute(v: unknown): v is Dispute {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) && isStr(v.orderId) && isStr(v.reportedBy) &&
    isStr(v.reason) && isStr(v.status) && isStr(v.createdAt)
  );
}

export const areDisputes = (v: unknown) => all(v, isDispute);

export function isPaymentIntent(v: unknown): v is PaymentIntent {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.orderId) &&
    isStr(v.payerId) &&
    isNum(v.amount) &&
    isStr(v.currency) &&
    isStr(v.status) &&
    isStrOrNull(v.providerRef) &&
    isStrOrNull(v.receipt) &&
    isStrOrNull(v.transactionId) &&
    isStrOrNull(v.failureReason) &&
    isStr(v.createdAt) &&
    isStr(v.updatedAt)
  );
}

export const arePaymentIntents = (v: unknown) => all(v, isPaymentIntent);

// --- The Vault ---------------------------------------------------------------

export function isVault(v: unknown): v is Vault {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) && isStr(v.slug) && isStr(v.type) && isStr(v.title) &&
    isStr(v.status) && isStr(v.visibility) && isStr(v.role) && isStr(v.createdAt) &&
    isObj(v.metrics)
  );
}

export const areVaults = (v: unknown) => all(v, isVault);

export function isFootstep(v: unknown): v is Footstep {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) && isStr(v.vaultId) && isNum(v.seq) && isStr(v.kind) &&
    isStr(v.category) && isStr(v.narrative) && isStr(v.createdAt)
  );
}

export const areFootsteps = (v: unknown) => all(v, isFootstep);

export function isVaultRequest(v: unknown): v is VaultRequest {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.vaultId) && isStr(v.description) && isStr(v.status);
}

export const areVaultRequests = (v: unknown) => all(v, isVaultRequest);

export function isTicket(v: unknown): v is Ticket {
  if (!isObj(v)) return false;
  return (
    isStr(v.code) && isStr(v.campaignId) && isStr(v.status) && isBool(v.paid) &&
    isStrOrNull(v.checkedInAt) && isStrOrNull(v.checkedInBy)
  );
}

export function isCommandCentre(v: unknown): v is CommandCentre {
  if (!isObj(v)) return false;
  return (
    isObj(v.money) && isNum(v.money.grossSettled) && isNum(v.money.grossPending) &&
    isObj(v.people) && isNum(v.people.registered) &&
    isObj(v.distribution) && isNum(v.distribution.views) &&
    Array.isArray(v.now) && Array.isArray(v.upcoming) && Array.isArray(v.action) &&
    Array.isArray(v.campaigns) && isNum(v.vaultCount)
  );
}

export function isTeaArticle(v: unknown): v is TeaArticle {
  return (
    isObj(v) && isStr(v.id) && isStr(v.slug) && isStr(v.title) &&
    isStr(v.dek) && isStr(v.category) && isNum(v.readingTime)
  );
}
export const areTeaArticles = (v: unknown) => all(v, isTeaArticle);

export function isMediaUpload(v: unknown): v is MediaUpload {
  return (
    isObj(v) && isStr(v.id) && isStr(v.url) && isStr(v.mimeType) &&
    isNum(v.bytes) && isStr(v.sha256) && isStr(v.createdAt) &&
    (v.originalName === null || isStr(v.originalName)) &&
    (v.alt === null || isStr(v.alt))
  );
}
export const areMediaUploads = (v: unknown) => all(v, isMediaUpload);

// --- the waiting-on-you queue -----------------------------------------------

const isStrList = (v: unknown, allowed: readonly string[]): boolean =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && allowed.includes(x));

function isTriageBase(v: Record<string, unknown>): boolean {
  return (
    isStr(v.id) && isStr(v.title) &&
    (v.detail === null || isStr(v.detail)) &&
    (v.at === null || isStr(v.at)) &&
    isNum(v.daysWaiting) && v.daysWaiting >= 0
  );
}

/**
 * Each kind is checked against the fields the UI actually reads. A queue item
 * that is missing its circle, or offers an action it cannot perform, fails
 * here rather than rendering a button that does nothing.
 */
export function isTriageItem(v: unknown): v is TriageItem {
  if (!isObj(v) || !isTriageBase(v)) return false;
  switch (v.kind) {
    case 'task':
      return isStr(v.circleId) && isStr(v.circleName) &&
        (v.status === 'open' || v.status === 'assigned') &&
        isStrList(v.actions, ['assign', 'release', 'complete']);
    case 'order':
      return isStr(v.vendorId) && (v.vendorName === null || isStr(v.vendorName)) &&
        isStr(v.status) && (v.nextStatus === null || isStr(v.nextStatus)) &&
        isStrList(v.actions, ['advance']);
    case 'checkin':
      return isStr(v.campaignId) && (v.status === 'open' || v.status === 'starting') &&
        isNum(v.pending) && isNum(v.checkedIn) &&
        isStrList(v.actions, ['checkin']);
    case 'draft':
      return (v.sourceId === null || isStr(v.sourceId)) &&
        (v.sourceName === null || isStr(v.sourceName)) &&
        (v.channel === null || isStr(v.channel)) &&
        isStrList(v.actions, ['review']);
    default:
      return false;
  }
}

export const areTriageItems = (v: unknown) => all(v, isTriageItem);

export function isTriageQueue(v: unknown): v is TriageQueue {
  if (!isObj(v)) return false;
  const c = v.counts;
  return (
    areTriageItems(v.items ?? []) !== undefined &&
    isNum(v.total) && (v.viewer === null || isStr(v.viewer)) &&
    isNum(v.withinHours) && isObj(c) &&
    isNum(c.task) && isNum(c.order) && isNum(c.checkin) && isNum(c.draft)
  );
}

// --- subscriptions -----------------------------------------------------------

export function isSubscription(v: unknown): v is Subscription {
  return (
    isObj(v) && isStr(v.id) && isStr(v.creatorId) && isStr(v.title) &&
    isNum(v.price) && isStr(v.currency) &&
    ['weekly', 'monthly', 'yearly'].includes(String(v.interval)) &&
    ['active', 'paused', 'cancelled'].includes(String(v.status)) &&
    isStr(v.createdAt) &&
    // Derived counts, never stored. Their absence would be the old bug: a
    // permanent confident zero next to a list of real members.
    isNum(v.subscriberCount) && isNum(v.settledCycles) && isNum(v.collected) &&
    (v.viewerIsSubscriber === null || isBool(v.viewerIsSubscriber))
  );
}

export const areSubscriptions = (v: unknown) => all(v, isSubscription);

export function isSubscriber(v: unknown): v is Subscriber {
  return (
    isObj(v) && isStr(v.id) && isStr(v.subscriptionId) && isStr(v.memberId) &&
    ['active', 'cancelled'].includes(String(v.status)) &&
    isStr(v.startedAt) && (v.endedAt === null || isStr(v.endedAt))
  );
}

export const areSubscribers = (v: unknown) => all(v, isSubscriber);

export function isSubscriptionJoin(v: unknown): v is SubscriptionJoin {
  return (
    isObj(v) && isSubscriber(v.subscriber) && isBool(v.duplicate) &&
    isBool(v.charged) && isStr(v.note) &&
    (v.transaction === null || (isObj(v.transaction) && isStr(v.transaction.id) &&
      isStr(v.transaction.status) && isNum(v.transaction.amount)))
  );
}
