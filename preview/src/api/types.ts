// ---------------------------------------------------------------------------
// BRIEF API TYPES
//
// These types were written by inspecting ACTUAL server responses captured from
// a running instance -- not from a specification. Where the server does not
// expose something, it is absent here rather than invented.
//
// Source of truth: server/src/domain/{circle,block,signal,ledger,member}.js
//                  server/src/index.js
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CIRCLE
// ---------------------------------------------------------------------------

export type CircleType = 'gathering' | 'build' | 'study' | 'treasury' | 'match' | 'target';
export type CircleStatus = 'forming' | 'active' | 'completed' | 'dormant';
export type CircleVisibility = 'open' | 'invite_only';

/**
 * Fields the server persists. Note the ABSENCE of `currentValue` -- progress is
 * never stored, only derived. See CircleDerived below.
 */
export interface CircleStored {
  id: string;
  name: string;
  description: string;
  type: CircleType;
  status: CircleStatus;
  visibility: CircleVisibility;
  sourceId: string | null;
  goal: string | null;
  targetValue: number | null;
  deadline: string | null;
  completionCriteria: string | null;
  parentCircleId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * SERVER-DERIVED, READ-ONLY.
 *
 * Every field here is computed by the server from settled transactions and
 * row counts. The client displays them and must never submit them. They are
 * marked `readonly` so TypeScript rejects assignment at compile time.
 */
export interface CircleDerived {
  /** Sum of transactions linked to this circle whose status is 'settled'. */
  readonly currentValue: number;
  /** Distinct counterparties among those settled transactions. */
  readonly contributorCount: number;
  /** null when targetValue is null or 0 -- there is no target to measure. */
  readonly progressPct: number | null;
  readonly settledCount: number;
  readonly blockCount: number;
  readonly memberCount: number;
  /**
   * The VIEWER's role in this circle, or null when they are not a member.
   *
   * This is what makes an honest list possible. Without it every circle looks
   * identical and a list cannot tell "yours" from "open to join" -- which is
   * how the client ended up labelling all of them "communities you are part
   * of". Null is a stated answer, not a missing one.
   */
  readonly viewerRole: MemberRole | null;
  readonly isMember: boolean;
  /** Whether a self-join is permitted: an open circle, or one with nobody in it. */
  readonly canJoin: boolean;
}

export type Circle = CircleStored & CircleDerived;

/**
 * The ONLY fields a client may submit on update.
 *
 * `currentValue`, `progressPct`, `contributorCount` and `settledCount` are
 * deliberately excluded. The server also strips them, but excluding them here
 * means an attempt to fake progress fails to compile rather than failing
 * silently at runtime.
 */
export interface CircleUpdate {
  name?: string;
  description?: string;
  status?: CircleStatus;
  visibility?: CircleVisibility;
  goal?: string | null;
  targetValue?: number | null;
  deadline?: string | null;
  completionCriteria?: string | null;
}

export interface CircleCreate {
  name: string;
  description?: string;
  goal?: string | null;
  targetValue?: number | null;
  deadline?: string | null;
  completionCriteria?: string | null;
  /** Derive the circle from an already-connected source, preserving provenance. */
  sourceId?: string | null;
}

// ---------------------------------------------------------------------------
// TARGET
//
// TARGET is not a separate entity on the server. It is a Circle whose type is
// 'target' and which carries a targetValue. This view type exists so UI code
// can express "a target with real progress" without inventing a new primitive.
// ---------------------------------------------------------------------------

export interface TargetView {
  circleId: string;
  name: string;
  goal: string | null;
  readonly targetValue: number;
  readonly currentValue: number;
  readonly progressPct: number;
  readonly contributorCount: number;
  deadline: string | null;
}

/** Narrow a Circle to a TargetView, or null when it is not a measurable target. */
export function asTarget(circle: Circle): TargetView | null {
  if (circle.type !== 'target') return null;
  if (circle.targetValue === null || circle.targetValue <= 0) return null;
  if (circle.progressPct === null) return null;
  return {
    circleId: circle.id,
    name: circle.name,
    goal: circle.goal,
    targetValue: circle.targetValue,
    currentValue: circle.currentValue,
    progressPct: circle.progressPct,
    contributorCount: circle.contributorCount,
    deadline: circle.deadline
  };
}

// ---------------------------------------------------------------------------
// MEMBER + TRUST
//
// Trust is EVIDENCE. There is no score type here and none should be added.
// ---------------------------------------------------------------------------

export type MemberRole = 'coordinator' | 'contributor' | 'scout' | 'logistics' | 'observer';

export type VerificationKind =
  | 'phone_verified'
  | 'identity_verified'
  | 'business_verified'
  | 'moderator_verified';

/** A check that actually happened. */
export interface TrustEvidence {
  kind: VerificationKind;
  label: string;
}

/** A plain fact counted from real rows. Carries no rating. */
export interface TrustFact {
  kind: string;
  label: string;
}

export interface Trust {
  evidence: TrustEvidence[];
  /** How many checks passed. A count of evidence, NOT a score out of anything. */
  verifiedCount: number;
  facts: TrustFact[];
}

export interface Member {
  id: string;
  circleId: string;
  userId: string;
  role: MemberRole;
  verifications: VerificationKind[];
  joinedAt: string;
  updatedAt: string;
  trust: Trust;
}

// ---------------------------------------------------------------------------
// BLOCK
// ---------------------------------------------------------------------------

export type BlockType = 'note' | 'pin' | 'image' | 'voice' | 'task' | 'vote' | 'listing';

/** Provenance attached to a block that wraps an extracted object. */
export interface BlockSource {
  sourceId: string;
  sourceName: string | null;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
}

// --- Task state -------------------------------------------------------------
//
// A task IS a Block of type 'task'. There is no separate task entity: the
// server keeps this state inside block metadata and returns it hydrated, so
// the client never has to know where it is stored.

export type TaskStatus = 'open' | 'assigned' | 'completed';

export interface TaskState {
  status: TaskStatus;
  assigneeId: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

// --- Vote tally --------------------------------------------------------------
//
// DERIVED, never stored. The server recomputes this from the ballot rows on
// every read, so a tally cannot drift from the votes it claims to summarise.

export interface VoteResult {
  option: string;
  count: number;
  /** Share of ballots cast. null before anyone votes -- 0% would be a claim. */
  pct: number | null;
}

export interface VoteTally {
  blockId: string;
  circleId: string;
  closed: boolean;
  totalVotes: number;
  /** Members eligible to vote, counted from real membership rows. */
  eligibleCount: number;
  results: VoteResult[];
  /** Strictly-ahead option, or null. A tie has no leader. */
  leader: string | null;
}

export interface Block {
  id: string;
  circleId: string;
  /** Points at a canonical Brief object. null for directly-authored blocks. */
  objectId: string | null;
  type: BlockType;
  content: string;
  weight: number;
  validatedBy: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** The canonical object, when this block wraps one. Never a copy. */
  object: unknown | null;
  sources: BlockSource[];
  /** Present on task blocks only, hydrated by the server. */
  task?: TaskState;
  /** Present on vote blocks only. Recomputed server-side on every read. */
  tally?: VoteTally;
}

// ---------------------------------------------------------------------------
// SIGNAL
// ---------------------------------------------------------------------------

export type SignalType =
  | 'source_connected'
  | 'item_received'
  | 'object_created'
  | 'object_updated'
  | 'duplicate_merged'
  | 'circle_created'
  | 'block_added'
  | 'target_progressed'
  | 'member_joined'
  | 'task_assigned'
  | 'task_released'
  | 'task_completed'
  | 'vote_cast'
  | 'vote_closed'
  | 'sync_completed'
  | 'sync_failed';

export interface Signal {
  id: string;
  type: SignalType;
  circleId: string | null;
  blockId: string | null;
  sourceId: string | null;
  objectId: string | null;
  /** Numeric payload where meaningful, e.g. amount on target_progressed. */
  value: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  /** Who performed the act. null for system events (a sync has no actor). */
  actorId: string | null;
  /** Resolved server-side so the client never invents a label. */
  sourceName: string | null;
  circleName: string | null;
}

// ---------------------------------------------------------------------------
// MEMBER EVIDENCE
//
// TRUST IS EVIDENCE, NEVER A SCORE. These types deliberately carry no
// percentage, rating, reliability index or ranking -- only things that
// actually happened, each traceable back to the signal that recorded it.
// A member with no history has an empty array, and that is the honest answer.
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  kind: SignalType;
  label: string;
  circleId: string | null;
  circleName: string | null;
  blockId: string | null;
  /** The signal this evidence was derived from, so it can be inspected. */
  signalId: string;
  at: string;
}

export interface EvidenceCount {
  kind: SignalType;
  count: number;
  label: string;
}

export interface MemberEvidence {
  evidence: EvidenceItem[];
  summary: EvidenceCount[];
}

// ---------------------------------------------------------------------------
// ECONOMIC
// ---------------------------------------------------------------------------

/**
 * Statuses the server's state machine actually emits.
 *
 * CONTRACT NOTE: `disbursement_pending` is NOT in this union because the
 * server does not produce it. server/src/domain/ledger.js defines exactly
 * these seven, and GET /api/disbursements returns 404. Adding a
 * disbursement status here would be typing a fiction. See PHASE3.md.
 */
export type TransactionStatus =
  | 'created'
  | 'pending'
  | 'confirmed'
  | 'held'
  | 'settled'
  | 'failed'
  | 'refunded';

export interface TransactionHistoryEntry {
  status: TransactionStatus;
  at: string;
  note?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: TransactionStatus;
  description: string;
  counterparty: string | null;
  /** Links the transaction to a circle so target progress can derive from it. */
  circleId: string | null;
  objectId: string | null;
  /** Set when this payment is for a specific campaign registration. */
  campaignId?: string | null;
  /** Settling a transaction carrying this promotes the held spot. */
  registrationId?: string | null;
  metadata: Record<string, unknown>;
  history: TransactionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCreate {
  amount: number;
  type: string;
  currency?: string;
  description?: string;
  counterparty?: string | null;
  circleId?: string | null;
  objectId?: string | null;
  campaignId?: string | null;
  /** Must belong to `campaignId`; the server rejects a mismatch. */
  registrationId?: string | null;
}

/**
 * Result of an organiser confirming that payment for a held spot arrived.
 * The server creates AND settles the transaction, then promotes the
 * registration -- the client cannot do any of those three things itself.
 */
export interface PaymentConfirmation {
  registration: Registration;
  transaction: Transaction;
  analytics: CampaignMetrics;
}

/**
 * Whether real money can move. Currently always `configured: false` --
 * no payment provider is connected. `reason` is plain English intended for
 * display, so the UI states the limitation instead of implying payouts work.
 */
export interface ProviderStatus {
  configured: boolean;
  provider: string | null;
  reason: string;
}

/**
 * Balances are COMPUTED by the server from recorded rows. Zero transactions
 * means zero, never a placeholder.
 */
// ---------------------------------------------------------------------------
// TICKET RESALE MARKET (Tikiti T1)
//
// A ticket is one admitted seat born from a confirmed registration. Its scan
// code carries a version: every ownership change bumps the version and kills
// every previously printed QR. Money never moves here without a settled
// ledger row (see Wallet/Transaction — the ledger is the only truth).
// ---------------------------------------------------------------------------

export interface ResaleTicket {
  readonly id: string;
  readonly eventId: string;
  readonly eventTitle: string | null;
  readonly code: string;
  /** What the holder's QR must carry right now: "CODE#version". */
  readonly scanCode: string;
  readonly codeVersion: number;
  readonly status: 'valid' | 'void';
  readonly activeListingId: string | null;
  readonly issuedAt: string;
  readonly transfers: ReadonlyArray<{
    at: string;
    kind: 'purchase' | 'gift' | 'refund_revert';
    codeVersionAfter: number;
  }>;
}

export interface ResaleListing {
  readonly id: string;
  readonly eventId: string;
  readonly eventTitle: string | null;
  readonly price: number;
  currency: string;
  readonly note: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly cheapest: boolean;
  readonly seller: { displayName: string; joinedAt: string | null } | null;
  readonly transferCount: number;
}

export interface TicketOrder {
  readonly id: string;
  readonly reference: string;
  readonly status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  readonly unitPrice: number;
  readonly fee: number;
  readonly total: number;
  currency: string;
  readonly listingId: string;
  readonly ticketId: string;
  readonly eventId: string;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
}

export interface Wallet {
  readonly balance: number;
  readonly pending: number;
  currency: string;
  readonly transactionCount: number;
  provider: ProviderStatus;
}

// ---------------------------------------------------------------------------
// DISBURSEMENT -- NOT AVAILABLE
//
// The server exposes no disbursement endpoint. GET /api/disbursements -> 404,
// and no domain service produces disbursement records. Rather than inventing
// a shape, the capability is modelled explicitly as unavailable so calling
// code must handle it and the UI can say so honestly.
// ---------------------------------------------------------------------------

export interface CapabilityUnavailable {
  available: false;
  reason: string;
}

// ---------------------------------------------------------------------------
// AUTH
//
// Identity is currently assumed from a single-user deployment, not proven.
// `configured: false` is the honest state; the UI should not imply otherwise.
// ---------------------------------------------------------------------------

export interface AuthStatus {
  configured: boolean;
  method: string;
  callerId: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// REQUEST RESULT
//
// Every call returns this instead of throwing, so a dead server degrades the
// affected surface rather than breaking Brief (server spec 30).
// ---------------------------------------------------------------------------

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number | null; errorBody?: any };

/** UI-facing load state, so screens can render loading/empty/error honestly. */
export interface LoadState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
  error: string | null;
}

export const idleState = <T,>(): LoadState<T> => ({
  status: 'idle',
  data: null,
  error: null
});

// ---------------------------------------------------------------------------
// CAMPAIGN
//
// A creator-facing distribution wrapper over an existing Brief object. Shapes
// captured from the live server; metrics are all server-derived.
// ---------------------------------------------------------------------------

export type CampaignType = 'popup' | 'session' | 'drop' | 'event';
export type CampaignStatus =
  | 'draft' | 'published' | 'live' | 'closed' | 'cancelled' | 'completed';

export type RegistrationStatus =
  | 'started' | 'registered' | 'confirmed' | 'checked_in' | 'cancelled' | 'no_show';

/**
 * DERIVED, READ-ONLY. Every field is computed by the server from real rows on
 * each read. There is no stored counter, so the client cannot write these.
 */
export interface CampaignMetrics {
  /**
   * Server-side loads of the public page. NOT people: a refresh counts twice
   * and a link-preview crawler counts as one. Label it honestly in any UI.
   */
  readonly views: number;
  /**
   * Distinct coarse fingerprints among those loads. Closer to "people" than
   * `views`, still not an identity claim. null when nothing was recorded.
   */
  readonly viewers: number | null;
  /** Times the creator pressed Share. An intent to distribute, not a reach. */
  readonly shares: number;
  /** Registrations carrying a verified public ad tracking hash. */
  readonly attributedRegistrations?: number;
  readonly attributedByAsset?: Record<string, number>;
  readonly registrationsStarted: number;
  readonly registrations: number;
  readonly checkedIn: number;
  readonly noShows: number;
  readonly cancelled: number;
  readonly slotsTaken: number;
  readonly capacity: number | null;
  readonly remaining: number | null;
  readonly orders: number;
  readonly revenueSettled: number;
  readonly revenuePending: number;
  readonly currency: string;
  /** null until at least one view is recorded -- not zero. */
  readonly conversionPct: number | null;
}

/** Read-only projection of the wrapped object. Never a copy: recomputed. */
export interface CampaignObject {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly summary: string | null;
  readonly locationName: string | null;
  readonly publication: string;
  readonly verificationStatus: string | null;
}

export interface Campaign {
  id: string;
  ownerId: string;
  objectId: string;
  /** False when the campaign attached a pre-existing object it must not mutate. */
  ownsObject: boolean;
  object: CampaignObject | null;
  circleId: string | null;
  title: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  price: number;
  currency: string;
  publicSlug: string;
  createdAt: string;
  updatedAt: string;
  metrics: CampaignMetrics;
}

export interface CampaignCreate {
  title: string;
  type: CampaignType;
  /**
   * Attach an EXISTING Brief object instead of creating one. The server checks
   * authority against source membership and refuses otherwise. Attaching never
   * mutates or publishes the object.
   */
  objectId?: string | null;
  description?: string;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  capacity?: number | null;
  price?: number;
  currency?: string;
  circleId?: string | null;
}

/** Writable fields only. No metrics, no ownerId, no status, no slug. */
export interface CampaignUpdate {
  title?: string;
  description?: string;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  price?: number;
  /** Rejected by the server after publication. */
  capacity?: number | null;
  /**
   * Attach an EXISTING Brief object to this campaign. Authorised server-side
   * by the caller's existing access to the object's source -- objects carry no
   * ownerId. Attaching never publishes or mutates the object itself.
   */
  objectId?: string;
}

/** The allow-listed public projection. No ownerId, no internal ids. */
export interface PublicCampaign {
  slug: string;
  /** Display label only -- never the internal ownerId. Absent when unset. */
  creator?: string | null;
  image?: string | null;
  title: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  price: number;
  currency: string;
  capacity: number | null;
  remaining: number | null;
  soldOut: boolean;
  /** Aggregate social proof: HOW MANY are registered, never WHO. */
  registered: number;
}

export interface Registration {
  id: string;
  campaignId: string;
  attendeeRef: string;
  name: string | null;
  contact: string | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  /** The attendee's own gate credential, present on their own registration. */
  ticketCode?: string | null;
}


// ---------------------------------------------------------------------------
// DISTRIBUTION
// ---------------------------------------------------------------------------

/** Client-visible server config. Never carries secrets. */
export interface AppConfig {
  /** null when BRIEF_PUBLIC_ORIGIN is unset. Do NOT substitute a guess. */
  publicOrigin: string | null;
  campaignPathPrefix: string;
}

/** Small release handshake used to detect an older API before testing flows. */
export interface ReleaseStatus {
  apiContractVersion: string;
  serverTime: string;
}

/**
 * A shareable link, or an honest reason there isn't one. Modelled as a
 * discriminated union so a caller cannot read `.url` without first proving
 * the link is available -- "no origin configured" becomes a COMPILE-time
 * concern rather than a fabricated string.
 */
export type ShareLink =
  | { available: true; url: string; slug: string }
  | { available: false; reason: 'public_origin_not_configured'; slug: string };

/**
 * Share-intent URLs for the channels that genuinely publish one. These are
 * ordinary web links that pre-fill a compose box -- Brief holds no social
 * credentials and posts nothing on anyone's behalf.
 *
 * Instagram and TikTok are deliberately ABSENT rather than present-and-broken:
 * neither platform exposes a share-intent URL, so they are copy-link only.
 */
export interface ShareChannels {
  whatsapp: string;
  telegram: string;
  x: string;
}

/**
 * The server-built distribution payload. Same discriminated-union discipline
 * as ShareLink: `url` and `channels` are unreachable until `available` is
 * narrowed to true, so an unconfigured deployment cannot produce a link.
 */
export type CampaignShare =
  | { available: true; url: string; slug: string; channels: ShareChannels; copyOnly: readonly string[] }
  | {
      available: false;
      reason: 'public_origin_not_configured';
      slug: string;
      channels: Record<string, never>;
      copyOnly: readonly string[];
    };

/** A standalone, public presentation of a published campaign. */
export interface CampaignBanner {
  id: string;
  campaignId: string;
  title: string;
  body: string | null;
  location: string | null;
  startsAt: string | null;
  imageUrl: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  share:
    | { available: true; url: string; channels: { whatsapp: string } }
    | { available: false; reason: string };
}

/** Platforms with no share-intent URL. The link itself is the whole product. */
export const COPY_ONLY_CHANNELS = ['instagram', 'tiktok'] as const;

/** Where a share was sent. Recorded as creator intent, never as reach. */
export type ShareChannel =
  | 'link' | 'native' | 'whatsapp' | 'telegram' | 'x' | 'instagram' | 'tiktok';

// ---------------------------------------------------------------------------
// SOURCES
//
// A Source is where information came from: a Telegram group, a WhatsApp
// group, a webpage, an RSS feed, or something a person captured by hand.
//
// This is the SERVER's source model. Brief previously carried a second,
// client-only community type (`BriefGroup`) that described the same thing --
// a platform group with an access level -- but held invented member counts
// and invented indexing timestamps. That duplicate has been retired: a
// connected group is a Source, and a community is a Circle.
//
// Every count below is computed by the server from real rows. There is no
// client-side arithmetic on these, and no default that implies activity.
// ---------------------------------------------------------------------------

export type SourceAccessType =
  | 'public' | 'member_access' | 'manual' | 'owner' | 'authorised';

export type SourceConnectionStatus =
  | 'connected' | 'disconnected' | 'error' | 'pending';

export interface SourceMembership {
  sourceId: string;
  userId: string;
  role?: string | null;
  joinedAt?: string | null;
}

export interface Source {
  id: string;
  name: string;
  type: string;
  platform?: string | null;
  url?: string | null;
  externalId?: string | null;
  accessType?: SourceAccessType | string | null;
  connectionStatus?: SourceConnectionStatus | string | null;
  confidence?: number | null;
  lastSyncedAt?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  /** Server-derived counts. Absent means unknown, never zero-as-decoration. */
  itemsProcessed: number;
  itemsPending: number;
  itemsRejected: number;
  objectsCreated: number;
  membership: SourceMembership | null;
}

// ---------------------------------------------------------------------------
// RAW ITEMS (the inbound queue)
//
// A raw item is a message exactly as it arrived from a connected source,
// before anyone decided whether it means anything. It is NOT an object: the
// distinction is the whole point of the review boundary, so the type stays
// separate rather than being folded into BriefObject.
//
// `processingStatus` is the server's verdict, and `rejectionReason` is why --
// both are recorded facts about a real message, not client-side guesses.
// ---------------------------------------------------------------------------

export type RawItemStatus = 'pending' | 'processed' | 'rejected';

export interface RawItem {
  id: string;
  sourceId: string;
  externalId?: string | null;
  messageId?: string | null;
  author?: string | null;
  text: string;
  media?: unknown[];
  publishedAt?: string | null;
  retrievedAt?: string | null;
  rawUrl?: string | null;
  processingStatus: RawItemStatus | string;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// ---------------------------------------------------------------------------
// BRIEF-IT (manual capture)
//
// Two steps on purpose: preview extracts and shows what Brief *would* record,
// save is the only thing that writes. `worthy: false` is a real answer and
// must be shown as one -- it is how Brief says "this text has no time, place,
// price or contact, so there is nothing here worth keeping".
// ---------------------------------------------------------------------------

export interface BriefItPreview {
  worthy: boolean;
  fields: Record<string, unknown>;
  evidence: Record<string, unknown> | unknown[];
  confidence: number;
  vendors: unknown[];
  products: unknown[];
}

export interface BriefItSaved {
  rawItemId: string;
  duplicate: boolean;
  result: unknown;
}

// ---------------------------------------------------------------------------
// COMMERCE (Batch 3)
//
// The chain: Object -> Vendor -> Listing -> Order -> Fulfilment -> Transaction
//
// Deliberately absent from every type below: rating, stars, reviewCount,
// sellerScore, revenue, balance. A vendor carries evidence and counted facts;
// an order carries derived money and a payment status read from the ledger.
//
// Also absent: any writable price on an order. The create type carries a
// listingId and a quantity and nothing else economic, so attempting to send a
// total is a COMPILE error rather than a silently-ignored field.
// ---------------------------------------------------------------------------

export type VendorStatus = 'active' | 'paused' | 'closed';

/** One thing that was actually checked, or one thing that actually happened. */
export interface VendorEvidenceItem {
  kind: string;
  label: string;
}

export interface VendorVerification {
  /** Verification checks that really passed. Empty means unverified. */
  evidence: VendorEvidenceItem[];
  verifiedCount: number;
  /** Counted facts ("6 fulfilled orders"), never folded into a rating. */
  facts: VendorEvidenceItem[];
}

export interface Vendor {
  id: string;
  ownerId: string;
  displayName: string;
  description: string;
  contactMethod: string | null;
  /** The extracted identity object this seller came from, when there is one. */
  objectId: string | null;
  status: VendorStatus;
  verification: VendorVerification;
  activeListingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorCreate {
  displayName: string;
  description?: string;
  contactMethod?: string | null;
  objectId?: string | null;
}

/** ownerId is absent on purpose: the server takes it from the caller. */
export interface VendorUpdate {
  displayName?: string;
  description?: string;
  contactMethod?: string | null;
  status?: VendorStatus;
}

export type ListingType = 'product' | 'service' | 'experience' | 'event';
export type ListingStatus = 'draft' | 'active' | 'paused' | 'sold_out' | 'archived';

/** The seller summary carried inline on a listing, so browse needs one call. */
export interface ListingVendor {
  id: string;
  displayName: string;
  status: VendorStatus;
  contactMethod: string | null;
}

export interface Listing {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  type: ListingType;
  price: number;
  currency: string;
  /** null means not stock-tracked (a service), which is not the same as 0. */
  quantityAvailable: number | null;
  /** Optional: a mobile service has no single location. */
  locationName: string | null;
  objectId: string | null;
  media: string[];
  status: ListingStatus;
  vendor: ListingVendor | null;
  /** Server's answer to "can this be ordered right now", with the reason. */
  orderable: boolean;
  unorderableReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `status` is absent: a listing moves through the lifecycle endpoint only. */
export interface ListingCreate {
  title: string;
  description?: string;
  type?: ListingType;
  price: number;
  currency?: string;
  quantityAvailable?: number | null;
  locationName?: string | null;
  objectId?: string | null;
  media?: string[];
}

export interface ListingUpdate {
  title?: string;
  description?: string;
  type?: ListingType;
  price?: number;
  currency?: string;
  quantityAvailable?: number | null;
  locationName?: string | null;
  media?: string[];
}

export type OrderStatus =
  | 'offered' | 'ordered' | 'fulfilled' | 'settled' | 'disputed' | 'cancelled';

export interface OrderHistoryEntry {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface OrderTransaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
}

export interface OrderDispute {
  id: string;
  reason: string;
  status: 'open' | 'withdrawn';
  reportedBy: string;
  createdAt: string;
}

export interface Order {
  id: string;
  listingId: string;
  /** Snapshot: the listing may later be edited or archived. */
  listingTitle: string;
  listingType: ListingType;
  buyerId: string;
  vendorId: string;
  vendorOwnerId: string;
  quantity: number;
  /** Derived server-side from the listing row. Never client-supplied. */
  unitPrice: number;
  total: number;
  currency: string;
  note: string;
  status: OrderStatus;
  transactionId: string | null;
  /**
   * Derived from a SETTLED ledger row, never stored. An order being placed
   * does not mean anyone has paid.
   */
  paid: boolean;
  paymentStatus: TransactionStatus | 'unpaid';
  transaction: OrderTransaction | null;
  dispute: OrderDispute | null;
  fulfilledAt: string | null;
  settledAt: string | null;
  history: OrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * What a buyer may send. There is deliberately no price, unitPrice, total,
 * amount or currency field: the server reads price from the listing and does
 * the arithmetic, so a forged total cannot even be expressed here.
 */
export interface OrderCreate {
  listingId: string;
  quantity?: number;
  note?: string;
  /**
   * Duplicate-submission protection. Scoped to the authenticated buyer, so a
   * retried or double-tapped order returns the FIRST order rather than
   * creating a second commitment.
   */
  idempotencyKey?: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  reportedBy: string;
  vendorId: string;
  reason: string;
  status: 'open' | 'withdrawn';
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// PAYMENT (Batch 5 -- Tuma)
//
// A payment intent is Brief's record of ONE attempt to collect money for an
// order. The provider is Tuma (M-Pesa STK Push settling to the LOOP till);
// the amount is server-derived from the order row and never client-supplied.
//
// `providerRef` is Tuma's `checkout_request_id`; Brief's own transaction id
// is `transactionId`. Both are kept so reconciliation works across a provider
// migration. Status is a single state machine -- there is no second payment
// status system anywhere in the client.
// ---------------------------------------------------------------------------

export type PaymentStatus =
  | 'intent' | 'authorized' | 'confirmed' | 'failed' | 'cancelled' | 'reversed';

export interface PaymentIntent {
  id: string;
  orderId: string;
  payerId: string;
  vendorId: string | null;
  /** Server-derived from the order row. Never client-supplied. */
  amount: number;
  currency: string;
  phone: string | null;
  status: PaymentStatus;
  provider: string | null;
  /** Tuma's checkout_request_id. */
  providerRef: string | null;
  /** The M-Pesa receipt number, once paid. */
  receipt: string | null;
  /** Brief's own ledger transaction id, once the payment is confirmed. */
  transactionId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  failedAt?: string | null;
}

/**
 * What the server returns from initiating a payment. `charged:true` only means
 * the STK prompt was sent -- it is NOT a claim that money arrived. Success is
 * only ever asserted after the server verifies the provider callback.
 */
export interface PaymentInitiation {
  intent: PaymentIntent;
  reused: boolean;
  charged: boolean;
  customerMessage: string | null;
}

// ---------------------------------------------------------------------------
// SETTLEMENT & COMPLIANCE (Batch 4)
// ---------------------------------------------------------------------------

export interface SettlementSplit {
  orderId: string;
  transactionId: string;
  vendorId: string;
  currency: string;
  total: number;
  rate: number;
  /** Platform commission, rounded DOWN so the seller keeps the remainder. */
  commission: number;
  sellerAmount: number;
  settledAt: string | null;
}

/**
 * What a vendor has earned, derived by scanning settled orders.
 *
 * NOT a balance. `payoutAvailable` is false while no payment provider is
 * connected -- "earned" and "withdrawable" are different claims and the type
 * keeps them apart.
 */
export interface VendorEarnings {
  vendorId: string;
  currency: string;
  gross: number;
  commission: number;
  net: number;
  orderCount: number;
  rate: number;
  lines: SettlementSplit[];
  payoutAvailable: boolean;
  payoutReason: string;
}

export interface ComplianceRequirement {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

/** Why a regulated surface is unavailable, enumerated rather than implied. */
export interface ArenaMoneyStatus {
  enabled: boolean;
  requirements: ComplianceRequirement[];
  unmet: string[];
  reason: string | null;
}

// ---------------------------------------------------------------------------
// ARENA BETA PILOT
//
// The first Arena test is intentionally small and manual. These are aggregate
// counters derived from beta signups, matches and confirmed results; the client
// never submits or edits an attained figure.
// ---------------------------------------------------------------------------

export type ArenaBetaSegment = 'casual' | 'competitive';

export interface ArenaBetaSignup {
  id: string;
  betaId: string;
  gameId: string;
  userId: string;
  segment: ArenaBetaSegment;
  acquisitionSource: string | null;
  createdAt: string;
}

export interface ArenaBetaSummary {
  id: string;
  gameId: string;
  label: string;
  status: 'recruiting' | 'running' | 'closed';
  targets: {
    signups: number;
    playersWithFirstMatch: number;
    matchesCompleted: number;
    playersWithTwoMatches: number;
  };
  actual: {
    signups: number;
    playersWithFirstMatch: number;
    matchesStarted: number;
    matchesCompleted: number;
    playersWithTwoMatches: number;
  };
  segments: Record<ArenaBetaSegment, number>;
  joined: boolean;
  joinedSegment: ArenaBetaSegment | null;
}

// ---------------------------------------------------------------------------
// THE VAULT
//
// A Vault is a persistent context layer over a real-world activity. It is NOT
// a chat, CRM, inbox or AI assistant. Types here mirror the server's domain
// (server/src/domain/vault.js, footsteps.js, handoff.js).
//
// The `role` field on a Vault is the caller's scoped access, decided by the
// SERVER — never by the client. A host sees everything; a guest sees their own
// experience; a vendor sees only their scoped requests; the public sees a
// minimal projection. The client renders whatever the server returns and never
// fabricates access it was not granted.
// ---------------------------------------------------------------------------

export type VaultType = 'gathering' | 'event' | 'marketplace' | 'campaign' | 'service' | 'deal';
export type VaultStatus = 'active' | 'pending' | 'settled' | 'closed' | 'archived';
export type VaultVisibility = 'public' | 'private' | 'invite_only' | 'token_access';
export type VaultRole = 'host' | 'guest' | 'vendor' | 'admin' | 'public';

export interface VaultMetrics {
  readonly participantCount: number;
  readonly requestCount: number;
  readonly pendingRequests: number;
  readonly pendingKes: number;
  readonly orderCount: number;
  readonly settled: boolean;
}

export interface VaultParticipant {
  id: string;
  vaultId: string;
  userId: string | null;
  role: 'host' | 'guest' | 'vendor' | 'admin';
  name: string | null;
  phone: string | null;
  channel: string | null;
  joinedAt: string;
}

export interface VaultChannel {
  id: string;
  vaultId: string;
  channel: string;
  externalId: string | null;
  connectedAt: string;
}

export type VaultRequestStatus = 'open' | 'routed' | 'accepted' | 'declined' | 'fulfilled';

export interface VaultRequest {
  id: string;
  vaultId: string;
  from: string;
  kind: string;
  description: string;
  quantity: number;
  priceEstimate: number | null;
  location: string | null;
  notes: string | null;
  status: VaultRequestStatus;
  vendorId: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultLink {
  kind: 'order' | 'object' | 'campaign' | 'vendor' | 'transaction' | 'listing';
  id: string;
}

export interface Vault {
  id: string;
  slug: string;
  type: VaultType;
  title: string;
  description: string;
  status: VaultStatus;
  visibility: VaultVisibility;
  ownerId?: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  closedAt: string | null;
  /** The caller's scoped role, decided server-side. */
  role: VaultRole;
  metrics: VaultMetrics;
  // Scoped fields, present only for the roles the server grants:
  links?: VaultLink[];
  participants?: VaultParticipant[];
  channels?: VaultChannel[];
  requests?: VaultRequest[];
  participant?: { id: string; role: string; name: string | null; joinedAt: string } | null;
  metadata?: Record<string, unknown>;
}

export type FootstepCategory =
  | 'people' | 'messages' | 'commerce' | 'payments' | 'vendors' | 'system' | 'decisions';

export interface Footstep {
  id: string;
  vaultId: string;
  seq: number;
  kind: string;
  category: FootstepCategory;
  label: string;
  narrative: string;
  actorId: string | null;
  actorName: string | null;
  channel: string | null;
  value: string | number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FootstepPage {
  footsteps: Footstep[];
  nextCursor: number | null;
  total: number;
}

export interface VaultSearchResult {
  vaultId: string;
  title: string;
  status: string;
  matches: { where: string; snippet: string }[];
}

export interface ResolutionItem {
  vaultId: string;
  vaultTitle: string;
  kind: string;
  description?: string;
  requestId?: string;
  orderId?: string;
  failureReason?: string | null;
  providerRef?: string | null;
}

export interface VaultEntry {
  ok: boolean;
  vault?: Vault;
  participant?: { id: string; role: string; name: string | null; joinedAt: string };
  token?: string;
}

/** What a client may send to create a vault. No ownerId, role or slug. */
export interface VaultCreate {
  type?: VaultType;
  title: string;
  description?: string;
  visibility?: VaultVisibility;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  sourceId?: string | null;
}

// ---------------------------------------------------------------------------
// THE GATE — tickets & check-in
//
// A ticket is a campaign registration carrying an opaque code. The gate view is
// deliberately minimal: what an operator needs to admit someone, and nothing
// that leaks the roster (no contact details, no other attendees).
// ---------------------------------------------------------------------------

export interface Ticket {
  code: string;
  campaignId: string;
  campaignTitle: string | null;
  name: string | null;
  status: string;
  paid: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
}

export interface CheckInResult {
  ok: boolean;
  already?: boolean;
  ticket?: Ticket;
  checkedInCount?: number;
}

// ---------------------------------------------------------------------------
// HOST COMMAND CENTRE
//
// A host-facing projection derived from real rows: NOW / MONEY / PEOPLE /
// DISTRIBUTION / ACTION / NEXT. Every figure is server-derived; the client
// renders it and computes nothing.
// ---------------------------------------------------------------------------

export interface CommandCentre {
  money: {
    grossSettled: number;
    grossPending: number;
    currency: string;
    campaignCount: number;
  };
  people: { registered: number; checkedIn: number; cancelled: number };
  distribution: { views: number; shares: number };
  now: { kind: string; campaignId: string; campaignTitle: string; name: string; registrationId: string }[];
  upcoming: { id: string; title: string; startsAt: string; status: string }[];
  action: ResolutionItem[];
  campaigns: {
    id: string;
    title: string;
    type: string;
    status: string;
    startsAt: string | null;
    price: number;
    currency: string;
    capacity: number | null;
    remaining: number | null;
    soldOut: boolean;
    registered: number;
    checkedIn: number;
    revenueSettled: number;
    revenuePending: number;
    views: number;
    shares: number;
    conversionPct: number | null;
  }[];
  vaultCount: number;
}

export type TeaCategory =
  | 'live' | 'guide' | 'explainer' | 'culture' | 'useful'
  | 'trend' | 'weekend' | 'local_business' | 'opportunity' | 'howto';

export interface TeaArticle {
  id: string;
  slug: string;
  title: string;
  dek: string;
  category: TeaCategory | string;
  subCategory: string | null;
  location: string | null;
  heroImage: string | null;
  images: string[];
  author: string | null;
  source: string | null;
  sourceUrl: string | null;
  readingTime: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  tags: string[];
  entities: string[];
  relatedContent: string[];
  relatedPlaces: string[];
  relatedEvents: string[];
  body: string;
}

// --- real image uploads -----------------------------------------------------
//
// An upload is a file Brief holds, not a link to somebody else's server. The
// `url` the server returns is ROOT-relative (/api/media/file/<id>): the client
// must prefix it with the ingestion proxy before it can be used as an img src.
// See mediaFileUrl().
export interface MediaUpload {
  id: string;
  url: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  originalName: string | null;
  alt: string | null;
  createdAt: string;
  ownerId?: string;
}

/** What the deployment can honestly promise about uploaded images. */
export interface MediaStorageStatus {
  enabled: boolean;
  kind: string;
  persisted: boolean;
  dir: string;
  writable: boolean;
  dirError: string | null;
  maxBytes: number;
  allowedTypes: string[];
  count: number;
  missingBytes: number;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// THE WAITING-ON-YOU QUEUE
//
// One derived list of everything that is blocked on the person looking at it.
// Modelled as a discriminated union so the UI cannot read a task's circleId
// off an order, or offer an action a kind does not have.
//
// Nothing here is storable: there is no triage table on the server. The queue
// is computed from real rows on every read, which is why an item can never
// survive the work it describes.
// ---------------------------------------------------------------------------

export type TriageKind = 'task' | 'order' | 'checkin' | 'draft';

interface TriageBase {
  id: string;
  title: string;
  /** A second line, or null. Never a placeholder. */
  detail: string | null;
  at: string | null;
  /** How long this has waited, in days. 0 when unknown, never negative. */
  daysWaiting: number;
}

/** A circle task the viewer holds. Unassigned work is deliberately absent. */
export interface TriageTask extends TriageBase {
  kind: 'task';
  circleId: string;
  circleName: string;
  status: 'open' | 'assigned';
  actions: ('assign' | 'release' | 'complete')[];
}

/** An order on the viewer's shelf that is theirs to move forward. */
export interface TriageOrder extends TriageBase {
  kind: 'order';
  vendorId: string;
  vendorName: string | null;
  status: string;
  /** The next real stage, or null when there is no legal step. */
  nextStatus: string | null;
  actions: 'advance'[];
}

/** An event the viewer is running, with people still to check in. */
export interface TriageCheckIn extends TriageBase {
  kind: 'checkin';
  campaignId: string;
  status: 'open' | 'starting';
  pending: number;
  checkedIn: number;
  actions: 'checkin'[];
}

/** An inbound message nobody has reviewed yet. */
export interface TriageDraft extends TriageBase {
  kind: 'draft';
  sourceId: string | null;
  sourceName: string | null;
  channel: string | null;
  /** Reviewing is the only action: there is no silent auto-publishing. */
  actions: 'review'[];
}

export type TriageItem = TriageTask | TriageOrder | TriageCheckIn | TriageDraft;

export interface TriageQueue {
  items: TriageItem[];
  counts: { task: number; order: number; checkin: number; draft: number };
  total: number;
  viewer: string | null;
  /** How far ahead the queue looks for imminent events. Stated, not implied. */
  withinHours: number;
}

// ---------------------------------------------------------------------------
// SUBSCRIPTIONS — the follower's side
// ---------------------------------------------------------------------------

/**
 * A recurring plan. `subscriberCount` is SERVER-DERIVED: it is counted from
 * real membership rows, so it can never disagree with the list below it. It
 * used to be a stored field that nothing ever incremented.
 */
export interface Subscription {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  interval: 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  readonly subscriberCount: number;
  readonly settledCycles: number;
  readonly collected: number;
  /** Whether the viewer is a member, or null when nobody is signed in. */
  readonly viewerIsSubscriber: boolean | null;
}

export interface Subscriber {
  id: string;
  subscriptionId: string;
  memberId: string;
  status: 'active' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
}

export interface SubscriptionJoin {
  subscriber: Subscriber;
  /** The recorded cycle, or null when the caller was already a member. */
  transaction: { id: string; status: string; amount: number } | null;
  duplicate: boolean;
  /**
   * Always false while no payment provider is connected. Present so the UI
   * can say "recorded, not charged" rather than implying money moved.
   */
  charged: boolean;
  note: string;
}
