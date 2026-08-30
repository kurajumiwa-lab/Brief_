// ---------------------------------------------------------------------------
// BRIEF API CLIENT
//
// One place where the frontend talks to the ingestion + feature-schema server.
// App.tsx currently calls fetch() inline for connectors; this module is the
// layer those calls should migrate to, and the only layer Phase 4 UI will use.
//
// Design rules enforced here:
//
//   1. Nothing throws. Every function returns ApiResult<T> so one dead
//      endpoint degrades one surface instead of breaking Brief.
//   2. Authoritative economic values are never sent. The update/create types
//      exclude currentValue/progress, so attempting to fake progress is a
//      COMPILE error, not a silent runtime no-op.
//   3. Capabilities the server does not have are reported as unavailable
//      rather than stubbed.
// ---------------------------------------------------------------------------

import type {
  ApiResult,
  Block,
  ResaleTicket,
  ResaleListing,
  ResaleListingRow,
  TicketOrder,
  CapabilityUnavailable,
  Circle,
  CircleCreate,
  CircleUpdate,
  Member,
  Signal,
  TargetView,
  AppConfig,
  ReleaseStatus,
  AuthStatus,
  Campaign,
  CampaignCreate,
  CampaignUpdate,
  PublicCampaign,
  Registration,
  RegistrationStatus,
  ShareChannel,
  ShareLink,
  ShareChannels,
  CampaignShare,
  CampaignBanner,
  MediaUpload,
  MediaStorageStatus,
  TriageQueue,
  Subscription,
  Subscriber,
  SubscriptionJoin,
  PaymentConfirmation,
  Transaction,
  TransactionCreate,
  TransactionStatus,
  VerificationKind,
  Wallet,
  Source,
  RawItem,
  VoteTally,
  MemberEvidence,
  BriefItPreview,
  BriefItSaved,
  Vendor,
  VendorCreate,
  VendorUpdate,
  Listing,
  ListingCreate,
  ListingUpdate,
  ListingStatus,
  Order,
  OrderCreate,
  Dispute,
  VendorEarnings,
  ArenaMoneyStatus,
  ArenaBetaSegment,
  ArenaBetaSignup,
  ArenaBetaSummary,
  PaymentIntent,
  PaymentInitiation,
  Vault,
  VaultCreate,
  Footstep,
  FootstepPage,
  VaultRequest,
  VaultSearchResult,
  ResolutionItem,
  VaultEntry,
  Ticket,
  CheckInResult,
  CommandCentre
} from './types';
import { enqueue, replayQueue, queueDepth, type QueuedWrite } from './offlineQueue';
import { asTarget } from './types';
import {
  areBlocks, areCampaigns, areCircles, areMembers, areRegistrations,
  areSignals, areTransactions, isAuthStatus, isCampaign, isCircle, isBlock,
  isAppConfig, isMember, isProviderStatus, isPublicCampaign, isRegistration,
  isTransaction, isWallet, isCampaignShare, isCampaignBanner, areCampaignBanners, isPaymentConfirmation,
  areSources, areRawItems, isBriefItPreview, isVoteTally, isMemberEvidence,
  isVendor, areVendors, isListing, areListings, isOrder, areOrders,
  isDispute, areDisputes, isPaymentIntent, arePaymentIntents,
  isVault, areVaults, isFootstep, areFootsteps, isVaultRequest, areVaultRequests, isTicket, isCommandCentre,
  isTeaArticle, areTeaArticles, isMediaUpload, areMediaUploads,
  isTriageQueue, isSubscription, areSubscriptions, isSubscriber,
  areSubscribers, isSubscriptionJoin
} from './validate';

/**
 * The dev server proxies /ingest -> the API. The browser is not the sandbox,
 * so this must stay a relative path: never call localhost from client code.
 */
export const INGEST_API = '/ingest';
/** Shared with /api/config so a deployed frontend can detect an older API. */
export const CLIENT_API_CONTRACT = 'gallery-banners-v1';

// ---------------------------------------------------------------------------
// SESSION
//
// The token lives in ONE place and is attached by `request()`, so no call site
// can forget it and no component ever handles a credential directly.
//
// localStorage rather than a JS-readable cookie: the app is a single-page
// client talking to an API on another origin, and a cookie would not be sent
// cross-origin without further configuration. The trade-off (XSS can read it)
// is the same either way for a non-httpOnly cookie.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'brief_session';
let memoryToken: string | null = null;

export function setSessionToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing or a blocked store: the in-memory copy still works for
    // this session rather than the app failing to sign in at all.
  }
}

export function getSessionToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

/** Called when the server reports a dead session, so the UI can re-prompt. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  // Returning undefined is how a selector reports "the server answered 200 but
  // the body is not the shape we expect". Narrowed below into a real error.
  select?: (raw: any) => T | undefined
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {})
  };
  if (init?.body !== undefined) headers['content-type'] = 'application/json';
  return send<T>(path, { ...init, headers }, select);
}

/**
 * The same request path, for a MULTIPART body.
 *
 * The content-type is deliberately NOT set: the browser has to add its own
 * `multipart/form-data; boundary=...`, and setting the header by hand is the
 * classic way to produce an unparseable body. Everything else — the session
 * token, the 401 handling, the "unexpected response shape" rule — is shared
 * with every other call, because this file is the only place that fetches.
 */
async function requestForm<T>(
  path: string,
  form: FormData,
  select?: (raw: any) => T | undefined
): Promise<ApiResult<T>> {
  return send<T>(path, { method: 'POST', body: form }, select);
}

async function send<T>(
  path: string,
  init: RequestInit,
  select?: (raw: any) => T | undefined
): Promise<ApiResult<T>> {
  try {
    const token = getSessionToken();
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string> | undefined) ?? {})
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${INGEST_API}${path}`, {
      ...init,
      headers
    });

    // A dead session must clear itself rather than leaving the client
    // retrying with a token the server has already rejected.
    if (res.status === 401) {
      const stale = getSessionToken();
      if (stale) {
        setSessionToken(null);
        onSessionExpired?.();
      }
    }

    // Read the body once, defensively: an HTML error page or an empty body
    // must not throw a raw SyntaxError at the call site.
    const text = await res.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: res.status,
          error: 'server returned a non-JSON response'
        };
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          (parsed && typeof parsed.error === 'string' && parsed.error) ||
          `request failed with status ${res.status}`,
        // The parsed body rides along for callers that need the server's
        // structured refusal (e.g. the engine tier's honest 402 detail).
        errorBody: parsed ?? undefined
      };
    }

    const data: T | undefined = select ? select(parsed) : (parsed as T);
    // A 200 whose body is missing the expected key is a contract mismatch,
    // not success. Surface it rather than handing `undefined` to the UI.
    if (data === undefined || data === null) {
      return { ok: false, status: res.status, error: 'unexpected response shape' };
    }
    return { ok: true, data };
  } catch (e) {
    // Network failure, offline server, aborted request. A WRITE is not lost:
    // it is parked with a clientKey and replays after reconnect — the
    // server-side idempotency makes the replay safe. A read is just offline.
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const body = typeof init.body === 'string' ? init.body : null;
      const token = getSessionToken();
      enqueue({
        path,
        method,
        body,
        // The key travels in the body itself; a re-tap replaces, not doubles.
        clientKey: (body ? clientKeyOf(body) : null) ?? `auto_${method}_${path}_${Date.now().toString(36)}`,
        headers: token ? { authorization: `Bearer ${token}` } : undefined
      });
      return {
        ok: false,
        status: null,
        queued: true,
        error: 'You are offline — this change is queued and will send itself when you reconnect.'
      };
    }
    return {
      ok: false,
      status: null,
      error: e instanceof Error ? e.message : 'network error'
    };
  }
}

/** Pull a clientKey out of a JSON body, if the caller sent one. */
function clientKeyOf(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.clientKey === 'string' ? parsed.clientKey : null;
  } catch {
    return null;
  }
}

/**
 * Replay the offline queue through the same fetch contract. Called on the
 * browser's 'online' event. Idempotent server keys make double-sends harmless.
 */
export async function flushOfflineQueue(): Promise<number> {
  return replayQueue(async (w: QueuedWrite) => {
    const headers: Record<string, string> = {};
    if (w.body) headers['content-type'] = 'application/json';
    const token = getSessionToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${INGEST_API}${w.path}`, {
      method: w.method,
      headers,
      body: w.body ?? undefined
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => '');
    let errMsg = `replay failed with status ${res.status}`;
    try {
      errMsg = JSON.parse(text)?.error ?? errMsg;
    } catch {}
    return { ok: false, error: errMsg };
  });
}

/** How many writes are parked, for a badge if a surface wants one. */
export function offlineQueueDepth(): number {
  return queueDepth();
}

// ---------------------------------------------------------------------------
// CIRCLES
// ---------------------------------------------------------------------------

export function getCircles(): Promise<ApiResult<Circle[]>> {
  return request('/api/circles', undefined, (r) => areCircles(r?.circles));
}

export interface CircleDetail {
  circle: Circle;
  blocks: Block[];
  signals: Signal[];
}

export function getCircle(id: string): Promise<ApiResult<CircleDetail>> {
  return request(`/api/circles/${encodeURIComponent(id)}`, undefined, (r) => {
    if (!isCircle(r?.circle)) return undefined;
    const blocks = areBlocks(r.blocks ?? []);
    const signals = areSignals(r.signals ?? []);
    if (!blocks || !signals) return undefined;
    return { circle: r.circle, blocks, signals };
  });
}

export function createCircle(body: CircleCreate): Promise<ApiResult<Circle>> {
  return request(
    '/api/circles',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (isCircle(r?.circle) ? r.circle : undefined)
  );
}

/**
 * `patch` is typed CircleUpdate, which has no progress fields. A caller
 * writing `updateCircle(id, { currentValue: 33750 })` fails to compile.
 */
export function updateCircle(id: string, patch: CircleUpdate): Promise<ApiResult<Circle>> {
  return request(
    `/api/circles/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    (r) => (isCircle(r?.circle) ? r.circle : undefined)
  );
}

// ---------------------------------------------------------------------------
// TARGETS -- a view over circles, not a separate endpoint
// ---------------------------------------------------------------------------

/** Circles that are measurable targets, with server-derived progress. */
export async function getTargets(): Promise<ApiResult<TargetView[]>> {
  const res = await getCircles();
  if (!res.ok) return res;
  const targets = res.data
    .map(asTarget)
    .filter((t): t is TargetView => t !== null);
  return { ok: true, data: targets };
}

// ---------------------------------------------------------------------------
// MEMBERS + TRUST
// ---------------------------------------------------------------------------

export function getMembers(circleId: string): Promise<ApiResult<Member[]>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    undefined,
    (r) => areMembers(r?.members)
  );
}

/**
 * Join the circle AS THE AUTHENTICATED CALLER.
 *
 * There is deliberately no userId parameter. The server derives identity from
 * the request, so a userId here would be a forgeable claim that the server
 * ignores -- an API that invites callers to write code the server rejects.
 */
export function joinCircle(
  circleId: string,
  role?: Member['role']
): Promise<ApiResult<Member>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    { method: 'POST', body: JSON.stringify({ role }) },
    (r) => (isMember(r?.member) ? r.member : undefined)
  );
}

/**
 * Add SOMEBODY ELSE to a circle. Requires coordinator authority; the server
 * returns 403 otherwise. Named separately from joinCircle so the privileged
 * act is visible at the call site.
 */
export function inviteMember(
  circleId: string,
  userId: string,
  role?: Member['role']
): Promise<ApiResult<Member>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    { method: 'POST', body: JSON.stringify({ userId, role }) },
    (r) => (isMember(r?.member) ? r.member : undefined)
  );
}

/** Record a verification for another member. Coordinator-only; self-verification is refused. */
export function recordVerification(
  circleId: string,
  userId: string,
  kind: VerificationKind
): Promise<ApiResult<Member>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}/verify`,
    { method: 'POST', body: JSON.stringify({ kind }) },
    (r) => (isMember(r?.member) ? r.member : undefined)
  );
}

/** Change a member's role. Coordinator-only. */
export function setMemberRole(
  circleId: string,
  userId: string,
  role: Member['role']
): Promise<ApiResult<Member>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}/role`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
    (r) => (isMember(r?.member) ? r.member : undefined)
  );
}

/** Whether caller identity is genuinely verified. Currently false. */
export function getAuthStatus(): Promise<ApiResult<AuthStatus>> {
  return request('/api/auth/status', undefined, (r) => (isAuthStatus(r) ? r : undefined));
}

// ---------------------------------------------------------------------------
// BLOCKS
// ---------------------------------------------------------------------------

export function getBlocks(circleId?: string): Promise<ApiResult<Block[]>> {
  const q = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
  return request(`/api/blocks${q}`, undefined, (r) => areBlocks(r?.blocks));
}

export interface BlockCreate {
  circleId: string;
  type?: Block['type'];
  content?: string;
  /** Promote an existing extracted object into the circle. */
  objectId?: string;
}

export function createBlock(body: BlockCreate): Promise<ApiResult<Block>> {
  return request(
    '/api/blocks',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (isBlock(r?.block) ? r.block : undefined)
  );
}

// ---------------------------------------------------------------------------
// CIRCLE OPERATIONS: tasks and votes
//
// These act on Blocks, addressed through their circle. The circle in the path
// is not decoration -- the server refuses a block that does not belong to it,
// which is what stops one circle operating on another's work.
//
// Authority is enforced server-side. These bindings do not pre-check roles:
// a client-side check is a convenience, and treating it as protection is how
// authorisation holes are born. The UI hides what you cannot do; the SERVER
// is what makes it impossible.
// ---------------------------------------------------------------------------

/** Take on a task, or (as coordinator) assign it to another member. */
export function assignTask(
  circleId: string,
  blockId: string,
  assigneeId?: string
): Promise<ApiResult<{ block: Block; changed: boolean }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/assign`,
    { method: 'POST', body: JSON.stringify(assigneeId ? { assigneeId } : {}) },
    (r) => (isBlock(r?.block) ? { block: r.block, changed: Boolean(r.changed) } : undefined)
  );
}

/** Put a task back in the pool. */
export function releaseTask(
  circleId: string,
  blockId: string
): Promise<ApiResult<{ block: Block; changed: boolean }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/release`,
    { method: 'POST', body: JSON.stringify({}) },
    (r) => (isBlock(r?.block) ? { block: r.block, changed: Boolean(r.changed) } : undefined)
  );
}

/**
 * Mark a task done. `changed: false` means it was already complete -- a
 * harmless no-op, not a second completion.
 */
export function completeTask(
  circleId: string,
  blockId: string
): Promise<ApiResult<{ block: Block; changed: boolean }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/complete`,
    { method: 'POST', body: JSON.stringify({}) },
    (r) => (isBlock(r?.block) ? { block: r.block, changed: Boolean(r.changed) } : undefined)
  );
}

/**
 * Cast a ballot. The voter is the authenticated caller -- deliberately not a
 * parameter, because a client-supplied voter id would be a forgeable claim.
 * A second attempt returns a 409 conflict rather than replacing the first.
 */
export function castVote(
  circleId: string,
  blockId: string,
  option: string
): Promise<ApiResult<{ option: string; tally: VoteTally }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/vote`,
    { method: 'POST', body: JSON.stringify({ option }) },
    (r) =>
      isVoteTally(r?.tally)
        ? { option: String(r?.vote?.option ?? option), tally: r.tally }
        : undefined
  );
}

/** Close a vote to further ballots. Coordinator only, enforced server-side. */
export function closeVote(
  circleId: string,
  blockId: string
): Promise<ApiResult<{ block: Block; tally: VoteTally }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/close-vote`,
    { method: 'POST', body: JSON.stringify({}) },
    (r) => (isBlock(r?.block) && isVoteTally(r?.tally) ? { block: r.block, tally: r.tally } : undefined)
  );
}

export function getTally(circleId: string, blockId: string): Promise<ApiResult<VoteTally>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/blocks/${encodeURIComponent(blockId)}/tally`,
    undefined,
    (r) => (isVoteTally(r?.tally) ? r.tally : undefined)
  );
}

/**
 * A member's evidence history. Returns things that happened -- never a score.
 * An empty list means this member has done nothing yet, which is a real and
 * useful answer, not a gap to fill with a default rating.
 */
export function getMemberEvidence(
  circleId: string,
  userId: string
): Promise<ApiResult<MemberEvidence>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}/evidence`,
    undefined,
    (r) => (isMemberEvidence(r) ? r : undefined)
  );
}

// ---------------------------------------------------------------------------
// SIGNALS
// ---------------------------------------------------------------------------

export function getSignals(opts: { circleId?: string; limit?: number } = {}): Promise<
  ApiResult<Signal[]>
> {
  const p = new URLSearchParams();
  if (opts.circleId) p.set('circleId', opts.circleId);
  if (opts.limit) p.set('limit', String(opts.limit));
  const q = p.toString();
  return request(`/api/signals${q ? `?${q}` : ''}`, undefined, (r) => areSignals(r?.signals));
}

// ---------------------------------------------------------------------------
// ECONOMIC
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TICKET RESALE MARKET (Tikiti T1). All fetches live here (§4); the UI never
// sees a raw response shape. The scan code version is part of the ticket
// object, so a stale QR is impossible to render by accident.
// ---------------------------------------------------------------------------

export function getEventResaleListings(eventId: string): Promise<ApiResult<{ listings: ResaleListing[] }>> {
  return request(`/api/ticket-market/events/${encodeURIComponent(eventId)}/listings`, undefined, (r) =>
    Array.isArray(r?.listings) ? r : undefined);
}

export function getMyTickets(): Promise<ApiResult<{ tickets: ResaleTicket[] }>> {
  return request('/api/ticket-market/me/tickets', undefined, (r) =>
    Array.isArray(r?.tickets) ? r : undefined);
}

export function getMyResaleDesk(): Promise<ApiResult<{ listings: ResaleListingRow[]; orders: TicketOrder[] }>> {
  return request('/api/ticket-market/me/listings', undefined, (r) =>
    Array.isArray(r?.listings) && Array.isArray(r?.orders)
      ? { listings: r.listings, orders: r.orders }
      : undefined);
}

export function createResaleListing(
  ticketId: string,
  price: number,
  note?: string
): Promise<ApiResult<{ listing: ResaleListing }>> {
  return request('/api/ticket-market/listings', {
    method: 'POST',
    body: JSON.stringify({ ticketId, price, note: note ?? null })
  });
}

export function cancelResaleListing(listingId: string): Promise<ApiResult<{ listing: ResaleListing; changed: boolean }>> {
  return request(`/api/ticket-market/listings/${encodeURIComponent(listingId)}/cancel`, { method: 'POST', body: '{}' });
}

export function openTicketOrder(listingId: string): Promise<ApiResult<{ order: TicketOrder }>> {
  return request('/api/ticket-market/orders', {
    method: 'POST',
    body: JSON.stringify({ listingId })
  });
}

export function cancelTicketOrder(orderId: string): Promise<ApiResult<{ order: TicketOrder; changed: boolean }>> {
  return request(`/api/ticket-market/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: '{}' });
}

/**
 * Pay for a ticket order. With no payment provider configured the server
 * answers 503 charged:false — an honest refusal, surfaced here as the error
 * result with the server's own detail, never a fake success.
 */
export function payTicketOrder(orderId: string): Promise<ApiResult<{ charged: boolean }>> {
  return request(`/api/ticket-market/orders/${encodeURIComponent(orderId)}/pay`, { method: 'POST', body: '{}' });
}

export function settleTicketOrder(orderId: string, transactionId: string): Promise<ApiResult<{ order: TicketOrder; changed: boolean }>> {
  return request(`/api/ticket-market/orders/${encodeURIComponent(orderId)}/settle`, {
    method: 'POST',
    body: JSON.stringify({ transactionId })
  });
}

export function refundTicketOrder(orderId: string): Promise<ApiResult<{ order: TicketOrder; changed: boolean }>> {
  return request(`/api/ticket-market/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST', body: '{}' });
}

export function giftTicket(ticketId: string, toUserId: string): Promise<ApiResult<{ ticket: ResaleTicket }>> {
  return request(`/api/ticket-market/tickets/${encodeURIComponent(ticketId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ toUserId })
  });
}

/** Gifting in the UI addresses people by handle — what people actually know. */
export function giftTicketToHandle(ticketId: string, toHandle: string): Promise<ApiResult<{ ticket: ResaleTicket }>> {
  return request(`/api/ticket-market/tickets/${encodeURIComponent(ticketId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ toHandle })
  });
}

/**
 * The seller confirms receiving the money out-of-band. Brief records a real
 * settled ledger row and moves the seat — this is how a sale completes while
 * no payment provider is connected, and it is the seller's attestation, never
 * Brief pretending it collected the money.
 */
export function confirmTicketOrderReceived(orderId: string): Promise<ApiResult<{ order: TicketOrder; changed: boolean }>> {
  return request(`/api/ticket-market/orders/${encodeURIComponent(orderId)}/confirm-received`, { method: 'POST', body: '{}' });
}

export function getWallet(currency = 'KES'): Promise<ApiResult<Wallet>> {
  // Validated rather than passed through: a 200 with an empty body would
  // otherwise reach the UI as a wallet with `undefined` balance, which is
  // exactly the kind of silent nonsense that turns into a fake zero on screen.
  return request(
    `/api/economic/wallet?currency=${encodeURIComponent(currency)}`,
    undefined,
    (r) => (isWallet(r) ? r : undefined)
  );
}

export interface TransactionList {
  transactions: Transaction[];
  provider: Wallet['provider'];
}

export function getTransactions(limit?: number): Promise<ApiResult<TransactionList>> {
  const q = limit ? `?limit=${limit}` : '';
  return request(`/api/transactions${q}`, undefined, (r) => {
    const transactions = areTransactions(r?.transactions);
    if (!transactions || !isProviderStatus(r?.provider)) return undefined;
    return { transactions, provider: r.provider };
  });
}

export function createTransaction(body: TransactionCreate): Promise<ApiResult<Transaction>> {
  return request(
    '/api/transactions',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (isTransaction(r?.transaction) ? r.transaction : undefined)
  );
}

/**
 * Advance a transaction. The SERVER owns the state machine and rejects
 * illegal hops -- notably created -> settled, which is how a UI would fake a
 * settlement. This client cannot bypass that; it only relays the request and
 * reports what the server decided.
 *
 * This is deliberately NOT named `settle`. There is no client-side settle.
 */
export function requestTransactionTransition(
  id: string,
  status: TransactionStatus,
  note?: string
): Promise<ApiResult<Transaction>> {
  return request(
    `/api/transactions/${encodeURIComponent(id)}/transition`,
    { method: 'POST', body: JSON.stringify({ status, note }) },
    (r) => (isTransaction(r?.transaction) ? r.transaction : undefined)
  );
}

/**
 * Disbursements are NOT implemented server-side (GET /api/disbursements -> 404,
 * no domain service, no payment provider). This returns the reason so the UI
 * can state the limitation instead of rendering an empty list that implies
 * "no payouts yet" when the truth is "payouts do not exist".
 */
export function getDisbursements(): CapabilityUnavailable {
  return {
    available: false,
    reason:
      'Disbursements are not implemented. No payment provider is connected, ' +
      'so Brief cannot pay anyone out and does not record disbursement state.'
  };
}

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------

export function getCampaigns(): Promise<ApiResult<Campaign[]>> {
  return request('/api/campaigns', undefined, (r) => areCampaigns(r?.campaigns));
}

export function getCampaign(id: string): Promise<ApiResult<Campaign>> {
  return request(`/api/campaigns/${encodeURIComponent(id)}`, undefined, (r) =>
    isCampaign(r?.campaign) ? r.campaign : undefined
  );
}

/** ownerId is NOT a parameter: the server derives it from the caller. */
export function createCampaign(body: CampaignCreate): Promise<ApiResult<Campaign>> {
  return request(
    '/api/campaigns',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (isCampaign(r?.campaign) ? r.campaign : undefined)
  );
}

export function updateCampaign(id: string, patch: CampaignUpdate): Promise<ApiResult<Campaign>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    (r) => (isCampaign(r?.campaign) ? r.campaign : undefined)
  );
}

/**
 * Lifecycle transitions. The SERVER owns the state machine and refuses
 * illegal hops; this only relays the request.
 */
export type CampaignAction = 'publish' | 'golive' | 'close' | 'cancel' | 'complete';

export function campaignAction(id: string, action: CampaignAction): Promise<ApiResult<Campaign>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', body: JSON.stringify({}) },
    (r) => (isCampaign(r?.campaign) ? r.campaign : undefined)
  );
}

export function getCampaignRegistrations(id: string): Promise<ApiResult<Registration[]>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/registrations`,
    undefined,
    (r) => areRegistrations(r?.registrations)
  );
}

/**
 * The organiser confirms that payment for a held spot actually arrived.
 *
 * Deliberately takes no amount: the server uses the campaign price, so this
 * call cannot mint revenue of the caller's choosing. The server creates the
 * transaction, settles it, and promotes the registration in one step -- there
 * is no client-side settlement anywhere in this flow.
 */
export function confirmRegistrationPayment(
  campaignId: string,
  registrationId: string
): Promise<ApiResult<PaymentConfirmation>> {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/registrations/${encodeURIComponent(registrationId)}/confirm-payment`,
    { method: 'POST', body: JSON.stringify({}) },
    (r) => (isPaymentConfirmation(r) ? r : undefined)
  );
}

export function setRegistrationStatus(
  campaignId: string,
  registrationId: string,
  status: RegistrationStatus
): Promise<ApiResult<Registration>> {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/registrations/${encodeURIComponent(registrationId)}/status`,
    { method: 'POST', body: JSON.stringify({ status }) },
    (r) => (isRegistration(r?.registration) ? r.registration : undefined)
  );
}

export function deleteCampaign(
  id: string
): Promise<ApiResult<{ ok: boolean }>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    (r) => (r?.ok ? { ok: true } : undefined)
  );
}

// --- public (no authentication) ---------------------------------------------

export function getPublicCampaign(slug: string): Promise<ApiResult<PublicCampaign>> {
  return request(`/api/public/campaigns/${encodeURIComponent(slug)}`, undefined, (r) =>
    isPublicCampaign(r?.campaign) ? r.campaign : undefined
  );
}

export interface PublicRegisterResult {
  registration: { id: string; status: RegistrationStatus; createdAt: string; ticketCode?: string | null };
  campaign: PublicCampaign;
}

export function registerForCampaign(
  slug: string,
  body: { attendeeRef: string; name?: string; contact?: string; trackingHash?: string; amount?: number }
): Promise<ApiResult<PublicRegisterResult>> {
  return request(
    `/api/public/campaigns/${encodeURIComponent(slug)}/register`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) =>
      isRegistration(r?.registration) && isPublicCampaign(r?.campaign)
        ? { registration: r.registration, campaign: r.campaign }
        : undefined
  );
}

export type { ShareChannel, ShareChannels, ShareLink, CampaignShare } from './types';
export { COPY_ONLY_CHANNELS } from './types';

/** Client-visible server configuration, including the canonical public origin. */
export function getConfig(): Promise<ApiResult<AppConfig>> {
  return request('/api/config', undefined, (r) => (isAppConfig(r) ? r : undefined));
}

/** Detect that the frontend and API came from the same current deployment. */
export function getRelease(): Promise<ApiResult<ReleaseStatus>> {
  return request('/api/release', undefined, (r) =>
    typeof r?.apiContractVersion === 'string' && typeof r?.serverTime === 'string'
      ? r as ReleaseStatus
      : undefined
  );
}

/**
 * Build the canonical share link, or report honestly that there isn't one.
 *
 * The origin MUST come from server config. Deriving it from
 * `window.location.origin` was the previous behaviour and was wrong: a creator
 * on a preview host would distribute a link tied to that host. When no origin
 * is configured the caller gets a structured unavailable state and shows the
 * slug instead of a fabricated URL.
 */
export function campaignShareLink(slug: string, publicOrigin: string | null): ShareLink {
  if (!publicOrigin) {
    return { available: false, reason: 'public_origin_not_configured', slug };
  }
  return {
    available: true,
    url: `${publicOrigin.replace(/\/+$/, '')}/c/${slug}`,
    slug
  };
}

/**
 * The server's canonical distribution payload for one campaign. Owner-only.
 *
 * Prefer this over composing a link locally: the origin lives in server
 * config, so the server is the only party that can answer authoritatively.
 */
export function getCampaignShare(id: string): Promise<ApiResult<CampaignShare>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/share`,
    undefined,
    (r) => (isCampaignShare(r?.share) ? r.share : undefined)
  );
}

/** Public home-shelf banners over already-published campaigns. */
export function getCampaignBanners(): Promise<ApiResult<CampaignBanner[]>> {
  return request('/api/banners', undefined, (r) => areCampaignBanners(r?.banners) ? r.banners : undefined);
}

export function getCampaignBanner(id: string): Promise<ApiResult<CampaignBanner | null>> {
  return request(`/api/campaigns/${encodeURIComponent(id)}/banner`, undefined, (r) =>
    r?.banner === null ? null : (isCampaignBanner(r?.banner) ? r.banner : undefined)
  );
}

/** Create a standalone banner; the server requires a published campaign. */
export function createCampaignBanner(
  id: string,
  fields: { headline?: string; body?: string; imageUrl?: string | null } = {}
): Promise<ApiResult<{ banner: CampaignBanner; reused: boolean }>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/banner`,
    { method: 'POST', body: JSON.stringify(fields) },
    (r) => isCampaignBanner(r?.banner)
      ? { banner: r.banner, reused: Boolean(r.reused) }
      : undefined
  );
}

export function archiveCampaignBanner(id: string): Promise<ApiResult<CampaignBanner>> {
  return request(`/api/banners/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' }, (r) =>
    isCampaignBanner(r?.banner) ? r.banner : undefined
  );
}

/**
 * Build the share-intent URLs for a canonical campaign link.
 *
 * This mirrors the server's `shareView()` byte-for-byte and is asserted to do
 * so by the contract suite. It exists client-side so the share sheet needs no
 * extra round-trip, NOT as a second source of truth: if the two ever diverge,
 * the contract test fails rather than a creator quietly distributing a
 * differently-shaped link on one channel.
 */
export function campaignShareChannels(url: string, title: string): ShareChannels {
  const enc = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${enc}&text=${text}`,
    x: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`
  };
}

/**
 * Records that the creator distributed the link. Emits a signal server-side
 * and moves no money. Only meaningful once published.
 */
export function shareCampaign(
  id: string,
  channel: ShareChannel = 'link'
): Promise<ApiResult<Campaign>> {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/share`,
    { method: 'POST', body: JSON.stringify({ channel }) },
    (r) => (isCampaign(r?.campaign) ? r.campaign : undefined)
  );
}

/** A single Brief object. 404s for objects the caller may not see. */
export function getObject(id: string): Promise<ApiResult<Record<string, unknown>>> {
  return request(`/api/objects/${encodeURIComponent(id)}`, undefined, (r) =>
    r && typeof r.object === 'object' && r.object !== null ? r.object : undefined
  );
}

/** Objects the caller may attach to a campaign. */
export function getObjects(publication?: string): Promise<ApiResult<any[]>> {
  const q = publication ? `?publication=${encodeURIComponent(publication)}` : '';
  return request(`/api/objects${q}`, undefined, (r) =>
    Array.isArray(r?.objects) ? r.objects : undefined
  );
}

/** The ranked discovery feed: freshness + trust + engagement, optionally geo-scoped. */
export function discoverObjects(opts: { lat?: number; lng?: number; radiusKm?: number; limit?: number } = {}): Promise<ApiResult<any[]>> {
  const params = new URLSearchParams({ rank: '1' });
  if (opts.lat !== undefined) params.set('lat', String(opts.lat));
  if (opts.lng !== undefined) params.set('lng', String(opts.lng));
  if (opts.radiusKm !== undefined) params.set('radiusKm', String(opts.radiusKm));
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  return request(`/api/objects?${params.toString()}`, undefined, (r) =>
    Array.isArray(r?.objects) ? r.objects : undefined
  );
}

/** Confirm an object as accurate. Idempotent per user. */
export function confirmObject(id: string): Promise<ApiResult<{ verificationStatus: string; confirmationCount: number }>> {
  return request(`/api/objects/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: '{}' }, (r) =>
    typeof r?.verificationStatus === 'string' ? r : undefined
  );
}

/** Report an object as wrong/spam/offensive. */
export function reportObject(id: string, reason: string): Promise<ApiResult<any>> {
  return request(`/api/objects/${encodeURIComponent(id)}/report`, { method: 'POST', body: JSON.stringify({ reason }) }, (r) => (r?.report ? r : undefined));
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  objectId: string | null;
  read: boolean;
  createdAt: string;
}

export function getNotifications(unreadOnly = false): Promise<ApiResult<{ notifications: Notification[]; unread: number }>> {
  const q = unreadOnly ? '?unread=1' : '';
  return request(`/api/notifications${q}`, undefined, (r) =>
    Array.isArray(r?.notifications) ? r : undefined
  );
}

export function markNotificationsRead(idOrAll?: string): Promise<ApiResult<any>> {
  const body = idOrAll === undefined ? { all: true } : { id: idOrAll };
  return request('/api/notifications/read', { method: 'POST', body: JSON.stringify(body) }, (r) => r);
}

// ---------------------------------------------------------------------------
// SOURCES
//
// Where Brief's information comes from. The server computes every count from
// real rows (items processed/pending/rejected, objects created), so this
// binding is a pass-through: the client adds no arithmetic of its own.
// ---------------------------------------------------------------------------

export function getSources(): Promise<ApiResult<Source[]>> {
  return request('/api/sources', undefined, (r) => areSources(r?.sources));
}

// Connector capability + ingestion status. These were the last two fetch()
// calls living outside this file (inlined in App.tsx "until they earn a
// binding"): they have earned one. Same proxy prefix, same session header,
// same response guards as everything else.
export type ConnectorCapabilities = {
  telegram?: Record<string, unknown>;
  web?: Record<string, unknown>;
  rss?: Record<string, unknown>;
  whatsapp?: Record<string, unknown>;
  manual?: Record<string, unknown>;
  payments?: Record<string, unknown>;
  arenaMoney?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  outbound?: Record<string, unknown>;
  features?: Record<string, unknown>;
};

export function getConnectorCapabilities(): Promise<ApiResult<ConnectorCapabilities>> {
  return request('/api/capabilities', undefined, (r) =>
    r && typeof r === 'object' && typeof r.manual === 'object'
      ? (r as ConnectorCapabilities)
      : undefined);
}

export type IngestStatus = {
  sources: number;
  connected: number;
  rawItems: number;
  objects: number;
  relationships: number;
  errors: number;
  queue: Record<string, unknown>;
  lastSyncRuns: unknown[];
};

export function getIngestStatus(): Promise<ApiResult<IngestStatus>> {
  return request('/api/status', undefined, (r) =>
    typeof r?.sources === 'number' && typeof r?.objects === 'number'
      ? (r as IngestStatus)
      : undefined);
}

export interface SourceCreate {
  name: string;
  type: string;
  url?: string;
  description?: string;
  accessType?: string;
  externalId?: string;
  ownerName?: string;
}

/**
 * The create response is the stored row only. It deliberately does NOT carry
 * the derived counts: a source created one millisecond ago has processed
 * nothing, and returning `itemsProcessed: 0` here would be indistinguishable
 * from a real measurement. Callers that need counts re-read getSources().
 */
export type CreatedSource = Omit<
  Source,
  'itemsProcessed' | 'itemsPending' | 'itemsRejected' | 'objectsCreated' | 'membership'
>;

export function createSource(input: SourceCreate): Promise<ApiResult<CreatedSource>> {
  return request('/api/sources', {
    method: 'POST',
    body: JSON.stringify(input)
  }, (r) =>
    r?.source && typeof r.source.id === 'string'
      ? (r.source as CreatedSource)
      : undefined);
}

// ---------------------------------------------------------------------------
// RAW ITEMS
//
// The inbound queue: messages as they actually arrived from connected sources.
// This is what the review inbox reads. If no source has been connected the
// list is genuinely empty, and the inbox must say so rather than showing
// invented sample traffic -- an empty queue is a true statement about the
// system, a fabricated one is not.
// ---------------------------------------------------------------------------

export function getRawItems(
  opts: { sourceId?: string; status?: string } = {}
): Promise<ApiResult<RawItem[]>> {
  const qs = new URLSearchParams();
  if (opts.sourceId) qs.set('sourceId', opts.sourceId);
  if (opts.status) qs.set('status', opts.status);
  const q = qs.toString();
  return request(`/api/raw-items${q ? `?${q}` : ''}`, undefined, (r) =>
    areRawItems(r?.rawItems) ? r.rawItems : undefined);
}

// ---------------------------------------------------------------------------
// BRIEF-IT
//
// Manual capture, deliberately two steps. `preview` is read-only: it shows
// what Brief would extract and whether the text is worth keeping at all.
// `save` is the only call that writes. A caller cannot accidentally ingest by
// previewing, which is why these are not collapsed into one function.
// ---------------------------------------------------------------------------

export function previewBriefIt(text: string): Promise<ApiResult<BriefItPreview>> {
  return request('/api/brief-it/preview', {
    method: 'POST',
    body: JSON.stringify({ text })
  }, (r) => (isBriefItPreview(r?.preview) ? r.preview : undefined));
}

export function saveBriefIt(
  text: string,
  meta: { sourceUrl?: string; sourceName?: string } = {}
): Promise<ApiResult<BriefItSaved>> {
  return request('/api/brief-it/save', {
    method: 'POST',
    body: JSON.stringify({ text, ...meta })
  }, (r) =>
    r && typeof r.rawItemId === 'string'
      ? { rawItemId: r.rawItemId, duplicate: Boolean(r.duplicate), result: r.result }
      : undefined);
}

// ---------------------------------------------------------------------------
// COMMERCE (Batch 3)
//
// Vendor -> Listing -> Order -> Fulfilment -> Transaction.
//
// Two things are deliberately impossible to express through these bindings:
//
//   1. An identity. No function takes an ownerId, buyerId or vendorId for the
//      acting party -- the server resolves the caller. A client-supplied
//      identity is a claim, and claims do not belong in an API surface.
//
//   2. A price. createOrder takes a listingId and a quantity. OrderCreate has
//      no total/unitPrice/amount field, so a forged total is a TYPE error
//      here and an ignored field at the server. Two independent refusals.
//
// Authority is enforced server-side. These bindings do not pre-check whether
// you own a listing; the UI hides what you cannot do, the SERVER is what makes
// it impossible.
// ---------------------------------------------------------------------------

/** Every active seller. */
export function getVendors(): Promise<ApiResult<Vendor[]>> {
  return request('/api/vendors', undefined, (r) => (areVendors(r?.vendors) ? r.vendors : undefined));
}

/**
 * The caller's own seller identity, or null. Null is a real answer -- most
 * people are not vendors -- so it resolves as success, not an error.
 */
export function getMyVendor(): Promise<ApiResult<Vendor | null>> {
  return request('/api/vendors/me', undefined, (r) => {
    if (r?.vendor === null) return null;
    return isVendor(r?.vendor) ? r.vendor : undefined;
  });
}

/** A public seller profile plus their active listings. */
export function getVendor(
  id: string
): Promise<ApiResult<{ vendor: Vendor; listings: Listing[] }>> {
  return request(`/api/vendors/${encodeURIComponent(id)}`, undefined, (r) =>
    isVendor(r?.vendor) && areListings(r?.listings)
      ? { vendor: r.vendor, listings: r.listings }
      : undefined
  );
}

/** Become a seller. Ownership comes from the caller, never from this payload. */
export function createVendor(body: VendorCreate): Promise<ApiResult<Vendor>> {
  return request('/api/vendors', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isVendor(r?.vendor) ? r.vendor : undefined
  );
}

export function updateVendor(id: string, body: VendorUpdate): Promise<ApiResult<Vendor>> {
  return request(
    `/api/vendors/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    (r) => (isVendor(r?.vendor) ? r.vendor : undefined)
  );
}

/**
 * Browse. Active listings only unless a status is named. An empty array means
 * an empty marketplace, which the UI must show as empty rather than fill.
 */
export function getListings(
  opts: { vendorId?: string; type?: string; status?: string } = {}
): Promise<ApiResult<Listing[]>> {
  const q = new URLSearchParams();
  if (opts.vendorId) q.set('vendorId', opts.vendorId);
  if (opts.type) q.set('type', opts.type);
  if (opts.status) q.set('status', opts.status);
  const qs = q.toString();
  return request(`/api/listings${qs ? `?${qs}` : ''}`, undefined, (r) =>
    areListings(r?.listings) ? r.listings : undefined
  );
}

/** The caller's own shelf, including drafts and archived rows. */
export function getMyListings(): Promise<ApiResult<{ vendor: Vendor | null; listings: Listing[] }>> {
  return request('/api/listings/mine', undefined, (r) => {
    if (!areListings(r?.listings)) return undefined;
    const vendor = r?.vendor === null || r?.vendor === undefined ? null : r.vendor;
    if (vendor !== null && !isVendor(vendor)) return undefined;
    return { vendor, listings: r.listings };
  });
}

export function getListing(id: string): Promise<ApiResult<Listing>> {
  return request(`/api/listings/${encodeURIComponent(id)}`, undefined, (r) =>
    isListing(r?.listing) ? r.listing : undefined
  );
}

export function createListing(body: ListingCreate): Promise<ApiResult<Listing>> {
  return request('/api/listings', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isListing(r?.listing) ? r.listing : undefined
  );
}

export function updateListing(id: string, body: ListingUpdate): Promise<ApiResult<Listing>> {
  return request(
    `/api/listings/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    (r) => (isListing(r?.listing) ? r.listing : undefined)
  );
}

/**
 * Move a listing through its lifecycle. `changed: false` means it was already
 * in that state -- a harmless no-op, not a second publication.
 */
export function setListingStatus(
  id: string,
  status: ListingStatus
): Promise<ApiResult<{ listing: Listing; changed: boolean }>> {
  return request(
    `/api/listings/${encodeURIComponent(id)}/status`,
    { method: 'POST', body: JSON.stringify({ status }) },
    (r) => (isListing(r?.listing) ? { listing: r.listing, changed: Boolean(r.changed) } : undefined)
  );
}

/** What I bought. */
export function getMyOrders(status?: string): Promise<ApiResult<Order[]>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/orders${qs}`, undefined, (r) => (areOrders(r?.orders) ? r.orders : undefined));
}

/** What I sold. */
export function getVendorOrders(status?: string): Promise<ApiResult<Order[]>> {
  const q = new URLSearchParams({ role: 'vendor' });
  if (status) q.set('status', status);
  return request(`/api/orders?${q.toString()}`, undefined, (r) =>
    areOrders(r?.orders) ? r.orders : undefined
  );
}

export function getOrder(id: string): Promise<ApiResult<Order>> {
  return request(`/api/orders/${encodeURIComponent(id)}`, undefined, (r) =>
    isOrder(r?.order) ? r.order : undefined
  );
}

/**
 * Place an order. The server derives unitPrice, total and currency from the
 * listing -- OrderCreate cannot carry them.
 */
export function createOrder(body: OrderCreate): Promise<ApiResult<Order>> {
  return request('/api/orders', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isOrder(r?.order) ? r.order : undefined
  );
}

/**
 * Start paying for an order. The phone number is the only input the buyer
 * supplies; the amount is read from the order row by the server and is never
 * sent. `charged:true` means the STK prompt was dispatched, NOT that money
 * arrived -- the client must never treat this as a successful payment. The
 * server returns the intent, whose `status` is the single source of truth;
 * poll getOrderPayments() until it leaves `intent`/`authorized`.
 */
export function payOrder(
  orderId: string,
  phone: string,
  idempotencyKey?: string
): Promise<ApiResult<PaymentInitiation>> {
  const body: Record<string, unknown> = { phone };
  if (idempotencyKey) body.idempotencyKey = idempotencyKey;
  return request(
    `/api/orders/${encodeURIComponent(orderId)}/pay`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) =>
      isPaymentIntent(r?.intent)
        ? {
            intent: r.intent,
            reused: Boolean(r.reused),
            charged: Boolean(r.charged),
            customerMessage: typeof r.customerMessage === 'string' ? r.customerMessage : null
          }
        : undefined
  );
}

/**
 * Payment intents for an order. The buyer polls this to discover the verified
 * state -- success is only ever the server's word, never the client's guess.
 */
export function getOrderPayments(orderId: string): Promise<ApiResult<PaymentIntent[]>> {
  return request(`/api/orders/${encodeURIComponent(orderId)}/payments`, undefined, (r) =>
    arePaymentIntents(r?.payments) ? r.payments : undefined
  );
}

/**
 * Vendor marks an order delivered. Fulfilment says nothing about payment:
 * an order can be fulfilled and still unpaid, and the UI shows both facts.
 */
export function fulfilOrder(
  id: string,
  note = ''
): Promise<ApiResult<{ order: Order; changed: boolean }>> {
  return request(
    `/api/orders/${encodeURIComponent(id)}/fulfil`,
    { method: 'POST', body: JSON.stringify({ note }) },
    (r) => (isOrder(r?.order) ? { order: r.order, changed: Boolean(r.changed) } : undefined)
  );
}

export function cancelOrder(
  id: string,
  reason = ''
): Promise<ApiResult<{ order: Order; changed: boolean }>> {
  return request(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason }) },
    (r) => (isOrder(r?.order) ? { order: r.order, changed: Boolean(r.changed) } : undefined)
  );
}

/**
 * Settlement requires a settled ledger transaction matching the order total.
 * No payment provider is connected, so this currently refuses -- deliberately.
 * The shape is ready for Batch 4; the money is not pretended in the meantime.
 */
export function settleOrder(
  id: string,
  transactionId?: string
): Promise<ApiResult<{ order: Order; changed: boolean }>> {
  return request(
    `/api/orders/${encodeURIComponent(id)}/settle`,
    { method: 'POST', body: JSON.stringify(transactionId ? { transactionId } : {}) },
    (r) => (isOrder(r?.order) ? { order: r.order, changed: Boolean(r.changed) } : undefined)
  );
}

/**
 * Contest an order. Establishes one fact -- this is contested and must not be
 * read as clean fulfilment. No refund is implied, because no money has moved.
 */
export function disputeOrder(
  id: string,
  reason: string
): Promise<ApiResult<{ dispute: Dispute; order: Order }>> {
  return request(
    `/api/orders/${encodeURIComponent(id)}/dispute`,
    { method: 'POST', body: JSON.stringify({ reason }) },
    (r) => (isDispute(r?.dispute) && isOrder(r?.order) ? { dispute: r.dispute, order: r.order } : undefined)
  );
}

/** Disputes against my listings (role='vendor') or ones I raised. */
export function getDisputes(role?: 'vendor'): Promise<ApiResult<Dispute[]>> {
  const qs = role ? `?role=${role}` : '';
  return request(`/api/disputes${qs}`, undefined, (r) =>
    areDisputes(r?.disputes) ? r.disputes : undefined
  );
}


// ---------------------------------------------------------------------------
// EARNINGS & COMPLIANCE (Batch 4)
// ---------------------------------------------------------------------------

/**
 * What this seller has actually earned, derived server-side from settled
 * orders. Deliberately NOT called "balance": `payoutAvailable` is false while
 * no payment provider is connected, and the UI must show that distinction.
 */
export function getMyEarnings(): Promise<ApiResult<VendorEarnings>> {
  return request('/api/vendors/me/earnings', undefined, (r) => {
    const e = r?.earnings;
    if (!e || typeof e.gross !== 'number' || typeof e.net !== 'number') return undefined;
    if (typeof e.payoutAvailable !== 'boolean') return undefined;
    return e as VendorEarnings;
  });
}

/**
 * Whether real-money contests are legally available in this deployment.
 * Returns the unmet requirements so the client states the actual reason
 * instead of "coming soon".
 */
export function getArenaMoneyStatus(): Promise<ApiResult<ArenaMoneyStatus>> {
  return request('/api/arena/status', undefined, (r) =>
    r?.arenaMoney && typeof r.arenaMoney.enabled === 'boolean'
      ? (r.arenaMoney as ArenaMoneyStatus)
      : undefined
  );
}


// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export interface AuthedUser {
  id: string;
  handle: string | null;
  displayName: string;
  personId?: string;
  devFallback?: boolean;
  /** Platform roles + derived capabilities (operator surface). Server truth. */
  platformRoles?: string[];
  capabilities?: string[];
}

export interface PersonStanding {
  personId: string;
  displayName: string;
  hosted: number;
  bought: number;
  arrived: number;
  registered: number;
  vendor: { id: string; displayName: string } | null;
  gameTags: { id: string; gameId: string; gamerTag: string; verified: boolean }[];
}

export interface PersonAvailability {
  userId: string;
  personId: string | null;
  state: 'available' | 'offline';
  gameId: string | null;
  mode: string | null;
  format: string | null;
  window: string | null;
  locationKind: string | null;
  updatedAt: string | null;
}

export interface PersonMe {
  person: { id: string; displayName: string | null; tags: string[]; aliases: any[] };
  standing: PersonStanding | null;
  availability: PersonAvailability;
}

/** Register and sign in. The token is stored centrally on success. */
export async function register(
  handle: string,
  password: string,
  displayName?: string
): Promise<ApiResult<AuthedUser>> {
  const res = await request<{ user: AuthedUser; token: string }>(
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ handle, password, displayName }) },
    (r) => (r?.user && r?.token ? { user: r.user, token: r.token } : undefined)
  );
  if (!res.ok) return res;
  setSessionToken(res.data.token);
  return { ok: true, data: res.data.user };
}

export async function login(handle: string, password: string): Promise<ApiResult<AuthedUser>> {
  const res = await request<{ user: AuthedUser; token: string }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ handle, password }) },
    (r) => (r?.user && r?.token ? { user: r.user, token: r.token } : undefined)
  );
  if (!res.ok) return res;
  setSessionToken(res.data.token);
  return { ok: true, data: res.data.user };
}

export async function logout(): Promise<ApiResult<{ ok: boolean }>> {
  const res = await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' },
    (r) => (r ? { ok: Boolean(r.ok) } : undefined));
  // Clear locally regardless: a failed logout must not leave the user stuck
  // in a signed-in UI they cannot leave.
  setSessionToken(null);
  return res;
}

/** Who the server says we are. Used on boot to restore a session. */
export function whoAmI(): Promise<ApiResult<AuthedUser>> {
  return request('/api/auth/me', undefined, (r) => (r?.user ? (r.user as AuthedUser) : undefined));
}

// ---------------------------------------------------------------------------
// FEDERATED SIGN-IN + ONBOARDING
//
// The first screen leads with Google and falls back to a handle. Telegram is
// never required. Everything here is a thin binding over routes that verify
// the claim server-side; the client asserts no identity of its own.
// ---------------------------------------------------------------------------

export interface AuthProviderStatus {
  configured: boolean;
  label: string;
  reason?: string | null;
  clientId?: string | null;
  required?: boolean;
}

export interface AuthProviders {
  password: AuthProviderStatus;
  google: AuthProviderStatus;
  telegram: AuthProviderStatus;
  emailLink: AuthProviderStatus;
}

/** What this deployment can honestly offer on the sign-in screen. */
export function getAuthProviders(): Promise<ApiResult<AuthProviders>> {
  return request('/api/auth/providers', undefined, (r) =>
    r?.providers ? (r.providers as AuthProviders) : undefined
  );
}

/** Exchange a Google ID token for a Brief session. The server verifies it. */
export async function googleSignIn(
  credential: string,
  source?: string | null
): Promise<ApiResult<AuthedUser>> {
  const res = await request<{ user: AuthedUser; token: string }>(
    '/api/auth/google',
    { method: 'POST', body: JSON.stringify({ credential, source: source ?? null }) },
    (r) => (r?.user && r?.token ? { user: r.user, token: r.token } : undefined)
  );
  if (!res.ok) return res;
  setSessionToken(res.data.token);
  return { ok: true, data: res.data.user };
}

/**
 * Continue from a link that carries a Brief-signed email token.
 *
 * This is the "arrived from a TikTok link and was already recognised" path.
 * The token is verified server-side; a bare email in a query string is not an
 * identity and is refused there.
 */
export async function continueFromLinkToken(
  token: string,
  source?: string | null
): Promise<ApiResult<AuthedUser>> {
  const res = await request<{ user: AuthedUser; token: string }>(
    '/api/auth/email-link',
    { method: 'POST', body: JSON.stringify({ token, source: source ?? null }) },
    (r) => (r?.user && r?.token ? { user: r.user, token: r.token } : undefined)
  );
  if (!res.ok) return res;
  setSessionToken(res.data.token);
  return { ok: true, data: res.data.user };
}

/** Mint a one-tap link token for someone you are inviting by email. */
export function mintEmailLinkToken(
  email: string,
  source?: string | null
): Promise<ApiResult<{ token: string; expiresInMs: number }>> {
  return request(
    '/api/auth/email-link/mint',
    { method: 'POST', body: JSON.stringify({ email, source: source ?? null }) },
    (r) => (typeof r?.token === 'string' ? { token: r.token, expiresInMs: Number(r.expiresInMs ?? 0) } : undefined)
  );
}

export type LadderRungId = 'identity' | 'orient' | 'value' | 'contribute' | 'reach';

export interface LadderRung {
  id: LadderRungId;
  label: string;
  detail: string;
  cta: string;
  index: number;
  done: boolean;
  reached: boolean;
  at: string | null;
  how: string | null;
}

export interface LadderService {
  id: string;
  label: string;
  requires: LadderRungId;
  surface: { tab: string; section?: string };
  unlocked: boolean;
  unlocksAfter: string | null;
  /** True when the segmentation answer moved this service one rung earlier. */
  promoted?: boolean;
}

export interface Ladder {
  rungs: LadderRung[];
  reached: LadderRungId[];
  currentRungId: LadderRungId | null;
  nextStep: { id: LadderRungId; label: string; detail: string; cta: string } | null;
  complete: boolean;
  activated: boolean;
  activatedAt: string | null;
  services: LadderService[];
}

export interface OnboardingGoal {
  id: string;
  label: string;
  leadsTo: { tab: string; section?: string };
}

export interface OnboardingState {
  profile: {
    goal: string | null;
    place: string | null;
    source: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    skippedAt: string | null;
  } | null;
  goals: OnboardingGoal[];
  ladder: Ladder;
}

export type ActivationEventName =
  | 'onboarding_started'
  | 'signed_in'
  | 'goal_chosen'
  | 'place_chosen'
  | 'feed_seen'
  | 'object_opened'
  | 'object_saved'
  | 'object_confirmed'
  | 'capture_saved'
  | 'onboarding_skipped'
  | 'onboarding_finished'
  | 'service_locked_tapped';

function isOnboardingState(raw: any): OnboardingState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (!raw.ladder || !Array.isArray(raw.ladder.rungs)) return undefined;
  return raw as OnboardingState;
}

export function getOnboarding(): Promise<ApiResult<OnboardingState>> {
  return request('/api/onboarding', undefined, isOnboardingState);
}

export function getLadder(): Promise<ApiResult<Ladder>> {
  return request('/api/ladder', undefined, (r) =>
    r?.ladder && Array.isArray(r.ladder.rungs) ? (r.ladder as Ladder) : undefined
  );
}

export function setOnboardingGoal(goal: string): Promise<ApiResult<OnboardingState>> {
  return request('/api/onboarding/goal', { method: 'POST', body: JSON.stringify({ goal }) }, isOnboardingState);
}

export function setOnboardingPlace(place: string): Promise<ApiResult<OnboardingState>> {
  return request('/api/onboarding/place', { method: 'POST', body: JSON.stringify({ place }) }, isOnboardingState);
}

export function setOnboardingSource(source: string): Promise<ApiResult<OnboardingState>> {
  return request('/api/onboarding/source', { method: 'POST', body: JSON.stringify({ source }) }, isOnboardingState);
}

export function finishOnboarding(skipped = false): Promise<ApiResult<OnboardingState>> {
  return request('/api/onboarding/finish', { method: 'POST', body: JSON.stringify({ skipped }) }, isOnboardingState);
}

/**
 * Report a real step someone took. Only the steps that leave no server row of
 * their own are reported this way; everything else is derived from rows.
 */
export function recordActivation(
  name: ActivationEventName,
  meta: Record<string, unknown> = {}
): Promise<ApiResult<{ ladder: Ladder }>> {
  return request(
    '/api/onboarding/event',
    { method: 'POST', body: JSON.stringify({ name, meta }) },
    (r) => (r?.ladder ? { ladder: r.ladder as Ladder } : undefined)
  );
}

export interface ActivationMetrics {
  started: number;
  activated: number;
  activationRate: number | null;
  medianSecondsToActivate: number | null;
  perRung: Record<string, number>;
  dropOff: { from: string; to: string; lost: number }[];
  note: string | null;
}

export function getActivationMetrics(): Promise<ApiResult<ActivationMetrics>> {
  return request('/api/onboarding/metrics', undefined, (r) =>
    r && typeof r.started === 'number' ? (r as ActivationMetrics) : undefined
  );
}

// ---------------------------------------------------------------------------
// THE VAULT
//
// The client never decides a vault's access level: every call returns the
// SERVER's scoped `role` and the fields that role is allowed to see. Money is
// never accepted from the client; requests carry a description, not a price.
// ---------------------------------------------------------------------------

export function createVault(body: VaultCreate): Promise<ApiResult<Vault>> {
  return request('/api/vaults', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isVault(r?.vault) ? r.vault : undefined
  );
}

export function listVaults(status?: string): Promise<ApiResult<Vault[]>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/vaults${q}`, undefined, (r) =>
    areVaults(r?.vaults) ? r.vaults : undefined
  );
}

export function getVault(id: string): Promise<ApiResult<Vault>> {
  return request(`/api/vaults/${encodeURIComponent(id)}`, undefined, (r) =>
    isVault(r?.vault) ? r.vault : undefined
  );
}

export function closeVault(id: string): Promise<ApiResult<Vault>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/close`, { method: 'POST', body: '{}' }, (r) =>
    isVault(r?.vault) ? r.vault : undefined
  );
}

export function getFootsteps(id: string, category?: string, cursor?: number): Promise<ApiResult<FootstepPage>> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (cursor !== undefined) params.set('cursor', String(cursor));
  const qs = params.toString();
  return request(`/api/vaults/${encodeURIComponent(id)}/footsteps${qs ? `?${qs}` : ''}`, undefined, (r) =>
    r && areFootsteps(r.footsteps) ? { footsteps: r.footsteps, nextCursor: r.nextCursor ?? null, total: r.total ?? r.footsteps.length } : undefined
  );
}

export function recordFootstep(
  id: string,
  body: { kind: string; narrative?: string; actorName?: string; value?: string | number | null }
): Promise<ApiResult<Footstep>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/footsteps`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isFootstep(r?.footstep) ? r.footstep : undefined
  );
}

export function addVaultParticipant(id: string, body: { role?: string; name?: string; phone?: string; userId?: string }): Promise<ApiResult<{ id: string; role: string }>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/participants`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.participant && typeof r.participant.id === 'string' ? r.participant : undefined
  );
}

export function createVaultRequest(id: string, body: { description: string; kind?: string; quantity?: number; notes?: string }): Promise<ApiResult<VaultRequest>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/requests`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    isVaultRequest(r?.request) ? r.request : undefined
  );
}

export function listVaultRequests(id: string): Promise<ApiResult<VaultRequest[]>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/requests`, undefined, (r) =>
    areVaultRequests(r?.requests) ? r.requests : undefined
  );
}

export function routeVaultRequest(id: string, requestId: string, vendorId: string): Promise<ApiResult<VaultRequest>> {
  return request(
    `/api/vaults/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}/route`,
    { method: 'POST', body: JSON.stringify({ vendorId }) },
    (r) => (isVaultRequest(r?.request) ? r.request : undefined)
  );
}

export function acceptVaultRequest(id: string, requestId: string): Promise<ApiResult<VaultRequest>> {
  return request(
    `/api/vaults/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}/accept`,
    { method: 'POST', body: '{}' },
    (r) => (isVaultRequest(r?.request) ? r.request : undefined)
  );
}

export function createHandoff(id: string, body: { participantId: string; toChannel?: string }): Promise<ApiResult<{ token: string; expiresAt: string }>> {
  return request(`/api/vaults/${encodeURIComponent(id)}/handoff`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    typeof r?.token === 'string' ? { token: r.token, expiresAt: r.expiresAt } : undefined
  );
}

export function searchVaults(q: string): Promise<ApiResult<VaultSearchResult[]>> {
  return request(`/api/vaults/search?q=${encodeURIComponent(q)}`, undefined, (r) =>
    Array.isArray(r?.results) ? r.results : undefined
  );
}

export function getResolution(): Promise<ApiResult<ResolutionItem[]>> {
  return request('/api/vaults/resolution', undefined, (r) =>
    Array.isArray(r?.items) ? r.items : undefined
  );
}

export function getPublicVault(slug: string): Promise<ApiResult<Vault>> {
  return request(`/api/public/vaults/${encodeURIComponent(slug)}`, undefined, (r) =>
    isVault(r?.vault) ? r.vault : undefined
  );
}

export function publicEnter(slug: string, body: { name?: string; phone?: string }): Promise<ApiResult<VaultEntry>> {
  return request(`/api/public/vaults/${encodeURIComponent(slug)}/enter`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r && typeof r === 'object' ? (r as VaultEntry) : undefined
  );
}

// ---------------------------------------------------------------------------
// THE GATE — ticket lookup + check-in (host/gate operator)
// ---------------------------------------------------------------------------

export function getTicket(code: string): Promise<ApiResult<Ticket>> {
  return request(`/api/tickets/${encodeURIComponent(code)}`, undefined, (r) =>
    isTicket(r?.ticket) ? r.ticket : undefined
  );
}

export function checkInTicket(code: string): Promise<ApiResult<CheckInResult>> {
  return request(`/api/tickets/${encodeURIComponent(code)}/check-in`, { method: 'POST', body: '{}' }, (r) =>
    r && typeof r === 'object' ? (r as CheckInResult) : undefined
  );
}

/** The host command centre: derived figures across the caller's campaigns + vaults. */
export function getCommandCentre(): Promise<ApiResult<CommandCentre>> {
  return request('/api/host/command', undefined, (r) =>
    isCommandCentre(r?.command) ? r.command : undefined
  );
}

// ---------------------------------------------------------------------------
// ARENA — real backend
//
// The server Arena is the single source of truth for challenges and matches.
// These functions return the server's actual rows; App.tsx maps them onto its
// display model. Creating/accepting/cancelling all go through the server so a
// challenge is real, persisted, and attributable.
// ---------------------------------------------------------------------------

export function getArenaGames(): Promise<ApiResult<{ games: any[]; activity: Record<string, number> }>> {
  return request('/api/arena/games', undefined, (r) =>
    Array.isArray(r?.games)
      ? {
          games: r.games,
          activity: r.activity && typeof r.activity === 'object' ? r.activity : {}
        }
      : undefined
  );
}

/** Aggregate pilot counters. A missing server is an unavailable scoreboard, not zero players. */
export function getArenaBeta(): Promise<ApiResult<ArenaBetaSummary>> {
  return request('/api/arena/beta', undefined, (r) => {
    const beta = r?.beta;
    if (!beta || typeof beta.id !== 'string' || typeof beta.gameId !== 'string') return undefined;
    if (!beta.targets || !beta.actual || !beta.segments) return undefined;
    return beta as ArenaBetaSummary;
  });
}

export function joinArenaBeta(body: {
  segment: ArenaBetaSegment;
  acquisitionSource?: string | null;
}): Promise<ApiResult<{ signup: ArenaBetaSignup; reused: boolean }>> {
  return request(
    '/api/arena/beta/join',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => r?.signup && typeof r.signup.id === 'string'
      ? { signup: r.signup as ArenaBetaSignup, reused: Boolean(r.reused) }
      : undefined
  );
}

export function getArenaChallenges(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/arena/challenges${q}`, undefined, (r) =>
    Array.isArray(r?.challenges) ? r.challenges : undefined
  );
}

export function createArenaChallenge(body: {
  gameId: string; mode?: string; stake?: string; entryFeeKes?: number | null;
  note?: string; venue?: string | null; openMinutes?: number;
}): Promise<ApiResult<any>> {
  return request('/api/arena/challenges', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.challenge ? r.challenge : undefined
  );
}

export function acceptArenaChallenge(id: string): Promise<ApiResult<any>> {
  return request(`/api/arena/challenges/${encodeURIComponent(id)}/accept`, { method: 'POST', body: '{}' }, (r) =>
    r?.match || r?.challenge ? r : undefined
  );
}

export function cancelArenaChallenge(id: string): Promise<ApiResult<any>> {
  return request(`/api/arena/challenges/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' }, (r) =>
    r?.challenge ? r : undefined
  );
}

export function getArenaMatches(): Promise<ApiResult<any[]>> {
  return request('/api/arena/matches', undefined, (r) =>
    Array.isArray(r?.matches) ? r.matches : undefined
  );
}

export function reportArenaMatch(
  id: string,
  body: { winnerPlayerId?: string | null; scoreLine?: string | null }
): Promise<ApiResult<any>> {
  return request(
    `/api/arena/matches/${encodeURIComponent(id)}/report`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.match ? r.match : undefined)
  );
}

export function confirmArenaMatch(
  id: string,
  body: { winnerPlayerId?: string | null } = {}
): Promise<ApiResult<any>> {
  return request(
    `/api/arena/matches/${encodeURIComponent(id)}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.match ? r : undefined)
  );
}

export function abandonArenaMatch(id: string, reason = ''): Promise<ApiResult<any>> {
  return request(
    `/api/arena/matches/${encodeURIComponent(id)}/abandon`,
    { method: 'POST', body: JSON.stringify({ reason }) },
    (r) => (r?.match ? r.match : undefined)
  );
}

// ---------------------------------------------------------------------------
// DEMO SEED — in-process, authenticated. Lets an authorised user populate or
// clear demo content from within the running server (the CLI wrote to a file
// the server never re-read).
// ---------------------------------------------------------------------------

export function seedDemo(): Promise<ApiResult<{ seeded: any }>> {
  return request('/api/ops/seed', { method: 'POST', body: '{}' }, (r) => (r?.seeded ? { seeded: r.seeded } : undefined));
}

export function clearDemo(): Promise<ApiResult<{ cleared: any }>> {
  return request('/api/ops/seed/clear', { method: 'POST', body: '{}' }, (r) => (r?.cleared ? { cleared: r.cleared } : undefined));
}

/** Kenya + major world headlines, last 24h. Empty lists if the wire is down. */
export function getWire(): Promise<ApiResult<{
  kenya: any[];
  world: any[];
  note: string;
  error: string | null;
  fetchedAt: string;
  source: string;
}>> {
  return request('/api/wire', undefined, (r) =>
    r?.wire && Array.isArray(r.wire.kenya) && Array.isArray(r.wire.world) ? r.wire : undefined
  );
}

/** Published Tea articles (ranked), optionally filtered by category/location. */
export function getTea(opts: { category?: string; location?: string; limit?: number } = {}): Promise<ApiResult<any[]>> {
  const params = new URLSearchParams();
  if (opts.category) params.set('category', opts.category);
  if (opts.location) params.set('location', opts.location);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  const q = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/tea${q}`, undefined, (r) =>
    Array.isArray(r?.tea) ? (r.tea as unknown[]).filter((x) => isTeaArticle(x)) : undefined
  );
}

/** One published Tea article by slug. */
export function getTeaArticle(slug: string): Promise<ApiResult<any>> {
  return request(`/api/tea/${encodeURIComponent(slug)}`, undefined, (r) =>
    isTeaArticle(r?.article) ? r.article : undefined
  );
}

/** The composed home feed (hero/discovery/opportunities/more + featured tea). */
export function getFeed(opts: { lat?: number; lng?: number; radiusKm?: number } = {}): Promise<ApiResult<any>> {
  const params = new URLSearchParams();
  if (opts.lat !== undefined) params.set('lat', String(opts.lat));
  if (opts.lng !== undefined) params.set('lng', String(opts.lng));
  if (opts.radiusKm !== undefined) params.set('radiusKm', String(opts.radiusKm));
  const q = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/feed${q}`, undefined, (r) => (
    r?.feed
      ? { ...r.feed, _meta: r.meta ?? null, _mediaProvider: r.mediaProvider ?? null }
      : undefined
  ));
}

/**
 * Anonymous feed contract for external consumers. It returns the same
 * title/media composition as getFeed, but uses the explicit public URL so
 * integrations do not depend on the first-party alias.
 */
export function getPublicFeed(opts: { lat?: number; lng?: number; radiusKm?: number; limit?: number } = {}): Promise<ApiResult<any>> {
  const params = new URLSearchParams();
  if (opts.lat !== undefined) params.set('lat', String(opts.lat));
  if (opts.lng !== undefined) params.set('lng', String(opts.lng));
  if (opts.radiusKm !== undefined) params.set('radiusKm', String(opts.radiusKm));
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  const q = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/public/feed${q}`, undefined, (r) => (r?.feed ? r.feed : undefined));
}

// --- Tea Desk (editorial admin) ---------------------------------------------

/** All Tea articles including drafts, for the desk. */
export function listTeaAll(status?: string): Promise<ApiResult<any[]>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/admin/tea${q}`, undefined, (r) =>
    Array.isArray(r?.articles) ? r.articles : undefined
  );
}

/** Create a Tea article (draft by default). */
export function createTeaArticle(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/admin/tea', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.article ?? undefined);
}

/** Edit a Tea article. */
export function updateTeaArticle(id: string, patch: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/admin/tea/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }, (r) => r?.article ?? undefined);
}

/** Drive a status transition: submit/approve/publish/schedule/unpublish/expire/archive. */
export function transitionTea(id: string, action: string): Promise<ApiResult<any>> {
  return request(`/api/admin/tea/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: 'POST', body: '{}' }, (r) => r?.article ?? undefined);
}

/** Published editorial collections (metadata). */
export function getCollections(): Promise<ApiResult<any[]>> {
  return request('/api/collections', undefined, (r) =>
    Array.isArray(r?.collections) ? r.collections : undefined
  );
}

/** One published collection resolved to its current member objects. */
export function getCollection(key: string): Promise<ApiResult<any>> {
  return request(`/api/collections/${encodeURIComponent(key)}`, undefined, (r) =>
    r?.collection ? r.collection : undefined
  );
}

/** Cross-entity search: objects + Tea + vendors + collections. */
export function searchAll(q: string): Promise<ApiResult<any>> {
  return request(`/api/search?q=${encodeURIComponent(q)}`, undefined, (r) => (r?.results ? r.results : undefined));
}

// --- Lobby (Arena: 1-tap room codes) ----------------------------------------

export function getLobbyRooms(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/lobby/rooms${q}`, undefined, (r) => Array.isArray(r?.rooms) ? r.rooms : undefined);
}

export function hostLobbyRoom(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/lobby/rooms', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.room ?? undefined);
}

export function claimLobbySlot(roomId: string): Promise<ApiResult<any>> {
  return request(`/api/lobby/rooms/${encodeURIComponent(roomId)}/claim`, { method: 'POST', body: '{}' }, (r) => r?.room ?? undefined);
}

export function startLobbyRoom(roomId: string): Promise<ApiResult<any>> {
  return request(`/api/lobby/rooms/${encodeURIComponent(roomId)}/start`, { method: 'POST', body: '{}' }, (r) => r?.room ?? undefined);
}

export function vouchHost(hostId: string, up: boolean): Promise<ApiResult<any>> {
  return request(`/api/lobby/hosts/${encodeURIComponent(hostId)}/vouch`, { method: 'POST', body: JSON.stringify({ up }) }, (r) => r?.trust ?? undefined);
}

// --- Telegram Mini App -------------------------------------------------------

/**
 * Exchange Telegram Mini App initData for a Brief session. Only callable from
 * inside Telegram, where the WebApp SDK injects a signed initData string; the
 * server verifies the HMAC and binds the Telegram user to a Brief account.
 */
export async function telegramInit(initData: string): Promise<ApiResult<AuthedUser>> {
  const res = await request<{ user: AuthedUser; token: string }>(
    '/api/telegram/init',
    { method: 'POST', body: JSON.stringify({ initData }) },
    (r) => (r?.user && r?.token ? { user: r.user, token: r.token } : undefined)
  );
  if (!res.ok) return res;
  setSessionToken(res.data.token);
  return { ok: true, data: res.data.user };
}

/** Are we running inside a Telegram Mini App (WebApp SDK present)? */
export function isTelegramMiniApp(): boolean {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    return Boolean(tg && typeof tg.initData === 'string' && tg.initData.length > 0);
  } catch {
    return false;
  }
}

// --- Automation engine (creator cockpit) -------------------------------------

export function getWorkflows(): Promise<ApiResult<any>> {
  return request('/api/workflows', undefined, (r) => (r?.workflows ? { workflows: r.workflows, runs: r.runs, stats: r.stats } : undefined));
}

export function createWorkflow(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/workflows', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.workflow ?? undefined);
}

export function updateWorkflow(id: string, patch: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/workflows/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }, (r) => r?.workflow ?? undefined);
}

export function runWorkflowSweep(): Promise<ApiResult<any>> {
  return request('/api/workflows/sweep', { method: 'POST', body: '{}' }, (r) => r ?? undefined);
}

// --- AI seam ---------------------------------------------------------------

export function getAssistStatus(): Promise<ApiResult<any>> {
  return request('/api/assist/status', undefined, (r) => r?.assist ?? undefined);
}

export function requestAssist(task: string, input: unknown): Promise<ApiResult<any>> {
  return request('/api/assist', { method: 'POST', body: JSON.stringify({ task, input }) }, (r) => r ?? undefined);
}

// --- Creator workspace (profile, rate cards, media kit, partnership, inbox) ---

export function getCreatorProfile(): Promise<ApiResult<any>> {
  return request('/api/creator/profile', undefined, (r) => r?.profile ?? undefined);
}

export function updateCreatorProfile(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/creator/profile', { method: 'PATCH', body: JSON.stringify(fields) }, (r) => r?.profile ?? undefined);
}

export function getCreatorRateCards(): Promise<ApiResult<any[]>> {
  return request('/api/creator/rate-cards', undefined, (r) => Array.isArray(r?.rateCards) ? r.rateCards : undefined);
}

export function createCreatorRateCard(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/creator/rate-cards', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.rateCard ?? undefined);
}

export function updateCreatorRateCard(id: string, fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/creator/rate-cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(fields) }, (r) => r?.rateCard ?? undefined);
}

export function getMyMediaKit(): Promise<ApiResult<any>> {
  return request('/api/creator/mediakit/mine', undefined, (r) => (r?.mediaKit ? r.mediaKit : null));
}

export function getOpportunities(): Promise<ApiResult<any[]>> {
  return request('/api/creator/opportunities', undefined, (r) => Array.isArray(r?.opportunities) ? r.opportunities : undefined);
}

export function respondOpportunity(id: string, action: string): Promise<ApiResult<any>> {
  return request(`/api/creator/opportunities/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: 'POST', body: '{}' }, (r) => r?.opportunity ?? undefined);
}

export function getInboxContacts(): Promise<ApiResult<any[]>> {
  return request('/api/inbox/contacts', undefined, (r) => Array.isArray(r?.contacts) ? r.contacts : undefined);
}

export function getInboxThread(key: string): Promise<ApiResult<any[]>> {
  return request(`/api/inbox/thread/${encodeURIComponent(key)}`, undefined, (r) => Array.isArray(r?.messages) ? r.messages : undefined);
}

export function getSubscriptions(): Promise<ApiResult<any[]>> {
  return request('/api/subscriptions', undefined, (r) => Array.isArray(r?.subscriptions) ? r.subscriptions : undefined);
}

export function createSubscription(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/subscriptions', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.subscription ?? undefined);
}

export function subscriptionAction(id: string, action: string): Promise<ApiResult<any>> {
  return request(`/api/subscriptions/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: 'POST', body: '{}' }, (r) => r?.subscription ?? r?.transaction ?? undefined);
}

// --- Yard Engine: advertising, matching and distribution --------------------

export function getAdvertiserProfile(): Promise<ApiResult<any>> {
  return request('/api/advertising/advertiser', undefined, (r) => r?.advertiser ?? undefined);
}

export function updateAdvertiserProfile(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/advertising/advertiser', { method: 'PATCH', body: JSON.stringify(fields) }, (r) => r?.advertiser ?? undefined);
}

export function getAdvertiserCampaigns(status?: string): Promise<ApiResult<any[]>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/advertising/campaigns${q}`, undefined, (r) => Array.isArray(r?.campaigns) ? r.campaigns : undefined);
}

export function createAdvertiserCampaign(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/advertising/campaigns', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.campaign ?? undefined);
}

export function updateAdvertiserCampaign(id: string, fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/advertising/campaigns/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(fields) }, (r) => r?.campaign ?? undefined);
}

export function submitAdvertiserCampaign(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/campaigns/${encodeURIComponent(id)}/submit`, { method: 'POST', body: '{}' }, (r) => r?.campaign ?? undefined);
}

export function confirmAdvertiserFunding(id: string, reference?: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/campaigns/${encodeURIComponent(id)}/confirm-funding`, { method: 'POST', body: JSON.stringify({ confirmation: true, reference: reference ?? null }) }, (r) => r?.campaign ?? undefined);
}

export function allocateAdvertiserCampaign(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/campaigns/${encodeURIComponent(id)}/allocate`, { method: 'POST', body: '{}' }, (r) => r ?? undefined);
}

export function getAdvertiserMatches(id: string): Promise<ApiResult<any[]>> {
  return request(`/api/advertising/campaigns/${encodeURIComponent(id)}/matches`, undefined, (r) => Array.isArray(r?.matches) ? r.matches : undefined);
}

export function getMyAdvertiserMatches(): Promise<ApiResult<any[]>> {
  return request('/api/advertising/matches/mine', undefined, (r) => Array.isArray(r?.matches) ? r.matches : undefined);
}

export function acceptAdvertiserMatch(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/matches/${encodeURIComponent(id)}/accept`, { method: 'POST', body: '{}' }, (r) => r?.match ?? undefined);
}

export function declineAdvertiserMatch(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/matches/${encodeURIComponent(id)}/decline`, { method: 'POST', body: '{}' }, (r) => r?.match ?? undefined);
}

export function verifyAdvertiserFulfillment(id: string, proofUrl?: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/matches/${encodeURIComponent(id)}/verify-fulfillment`, { method: 'POST', body: JSON.stringify({ performanceVerified: true, proofUrl: proofUrl ?? null }) }, (r) => r ?? undefined);
}

export function retryAdvertiserSettlement(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/matches/${encodeURIComponent(id)}/retry-settlement`, { method: 'POST', body: '{}' }, (r) => r ?? undefined);
}

export function getAdAssets(advertiserCampaignId?: string): Promise<ApiResult<any[]>> {
  const q = advertiserCampaignId ? `?advertiserCampaignId=${encodeURIComponent(advertiserCampaignId)}` : '';
  return request(`/api/advertising/assets${q}`, undefined, (r) => Array.isArray(r?.assets) ? r.assets : undefined);
}

export function createAdAsset(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/advertising/assets', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.asset ?? undefined);
}

export function approveAdAsset(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/assets/${encodeURIComponent(id)}/approve`, { method: 'POST', body: '{}' }, (r) => r?.asset ?? undefined);
}

export function issueAdAsset(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/assets/${encodeURIComponent(id)}/issue`, { method: 'POST', body: '{}' }, (r) => r?.asset ?? undefined);
}

export function getDistributionKit(id: string): Promise<ApiResult<any>> {
  return request(`/api/advertising/assets/${encodeURIComponent(id)}/distribution-kit`, undefined, (r) => r?.kit ?? undefined);
}

// --- Calendar and waiting lists ---------------------------------------------

export function getCalendarEntries(): Promise<ApiResult<any[]>> {
  return request('/api/calendar', undefined, (r) => Array.isArray(r?.entries) ? r.entries : undefined);
}

export function createCalendarEntry(fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request('/api/calendar', { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.entry ?? undefined);
}

export function sweepCalendar(): Promise<ApiResult<any>> {
  return request('/api/calendar/sweep', { method: 'POST', body: '{}' }, (r) => r ?? undefined);
}

export function getCampaignWaitlist(slug: string): Promise<ApiResult<any[]>> {
  return request(`/api/calendar/campaigns/${encodeURIComponent(slug)}/waitlist`, undefined, (r) => Array.isArray(r?.waitlist) ? r.waitlist : undefined);
}

export function joinCampaignWaitlist(slug: string, fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/calendar/campaigns/${encodeURIComponent(slug)}/waitlist`, { method: 'POST', body: JSON.stringify(fields) }, (r) => r?.entry ?? undefined);
}

export function acceptWaitlistOffer(id: string, attendeeRef?: string): Promise<ApiResult<any>> {
  return request(`/api/waitlist/${encodeURIComponent(id)}/accept`, { method: 'POST', body: JSON.stringify({ attendeeRef: attendeeRef ?? null }) }, (r) => r ?? undefined);
}

// --- Vendor capability shelf -----------------------------------------------

export function getVendorCapabilities(id: string): Promise<ApiResult<any>> {
  return request(`/api/vendors/${encodeURIComponent(id)}/capabilities`, undefined, (r) => r ?? undefined);
}

export function updateVendorCapabilities(id: string, fields: Record<string, unknown>): Promise<ApiResult<any>> {
  return request(`/api/vendors/${encodeURIComponent(id)}/capabilities`, { method: 'PUT', body: JSON.stringify(fields) }, (r) => r?.capabilities ?? undefined);
}

// --- Arena: real server entities (players/venues/tournaments/leaderboard) ----

export function getArenaPlayers(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/arena/players${q}`, undefined, (r) => Array.isArray(r?.players) ? r.players : undefined);
}

export function getArenaVenues(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/arena/venues${q}`, undefined, (r) => Array.isArray(r?.venues) ? r.venues : undefined);
}

export function getArenaTournaments(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/arena/tournaments${q}`, undefined, (r) => Array.isArray(r?.tournaments) ? r.tournaments : undefined);
}

export function getArenaLeaderboard(gameId: string): Promise<ApiResult<any[]>> {
  return request(`/api/arena/leaderboard?gameId=${encodeURIComponent(gameId)}`, undefined, (r) => Array.isArray(r?.leaderboard) ? r.leaderboard : undefined);
}

export function createArenaPlayer(body: {
  gameId: string;
  gamerTag: string;
  platform?: string | null;
  region?: string | null;
}): Promise<ApiResult<any>> {
  return request('/api/arena/players', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.player ? r.player : undefined
  );
}

export function getMyArenaPlayers(): Promise<ApiResult<any[]>> {
  return request('/api/arena/players/me', undefined, (r) =>
    Array.isArray(r?.players) ? r.players : undefined
  );
}

export function getPersonMe(): Promise<ApiResult<PersonMe>> {
  return request('/api/person/me', undefined, (r) =>
    r?.person && r.person.id ? (r as PersonMe) : undefined
  );
}

export function setMyAvailability(body: {
  state: 'available' | 'offline';
  gameId?: string | null;
  mode?: string | null;
  format?: string | null;
  window?: string | null;
  locationKind?: string | null;
}): Promise<ApiResult<PersonAvailability>> {
  return request(
    '/api/person/me/availability',
    { method: 'PUT', body: JSON.stringify(body) },
    (r) => (r?.availability ? (r.availability as PersonAvailability) : undefined)
  );
}

export function getAvailablePlayers(gameId?: string): Promise<ApiResult<any[]>> {
  const q = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return request(`/api/arena/available${q}`, undefined, (r) =>
    Array.isArray(r?.available) ? r.available : undefined
  );
}

// ---------------------------------------------------------------------------
// ENGINE — the power-plant layer: sync pipeline, universal router, tiers.
// Every response is the server's honest shape; nothing here simulates a
// capability the server did not report.
// ---------------------------------------------------------------------------

export interface EngineGuardrail {
  tier: string;
  label: string;
  caps: { syncIntervalMs: number; maxRoutes: number | null; pipelineDepth: string };
  micro: string;
  next: { tier: string; label: string; micro: string } | null;
  billingConfigured: boolean;
}

export interface EngineStatus {
  engine: string;
  version: string;
  watermark: string | null;
  collections: Record<string, number>;
  guardrail: EngineGuardrail | null;
  router: { signingConfigured: boolean; channels: { kind: string; configured: boolean }[] };
  billingConfigured: boolean;
}

export function getEngineStatus(): Promise<ApiResult<EngineStatus>> {
  return request('/api/engine/status', undefined, (r) =>
    r?.engine && r?.guardrail ? (r as EngineStatus) : undefined
  );
}

export interface EngineRouteChannel {
  kind: 'webhook' | 'discord' | 'slack' | 'whatsapp' | 'sms';
  to: string;
}

export interface EngineRoute {
  id: string;
  name: string;
  match: { signalType: string; objectId: string | null };
  channels: EngineRouteChannel[];
  enabled: boolean;
  createdAt: string;
}

export function getEngineRoutes(): Promise<ApiResult<EngineRoute[]>> {
  return request('/api/engine/routes', undefined, (r) =>
    Array.isArray(r?.routes) ? (r.routes as EngineRoute[]) : undefined
  );
}

export function createEngineRoute(body: {
  name: string;
  match?: { signalType?: string; objectId?: string | null };
  channels: EngineRouteChannel[];
}): Promise<ApiResult<EngineRoute>> {
  return request(
    '/api/engine/routes',
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.route ? (r.route as EngineRoute) : undefined)
  );
}

export function deleteEngineRoute(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return request(`/api/engine/routes/${encodeURIComponent(id)}`, { method: 'DELETE' }, (r) =>
    r?.ok ? { ok: true } : undefined
  );
}

export function requestEngineTier(tier: string): Promise<ApiResult<any>> {
  // The server answers 402 with the honest refusal payload; request() folds
  // non-2xx into { ok:false, error } — the detail fields ride on errorBody.
  return request('/api/engine/tier', { method: 'POST', body: JSON.stringify({ tier }) }, (r) => r);
}

export function getEngineDeliveries(): Promise<ApiResult<any[]>> {
  return request('/api/engine/deliveries', undefined, (r) =>
    Array.isArray(r?.deliveries) ? r.deliveries : undefined
  );
}

// --- Story likes (the public rating) ------------------------------------------

export function likeTeaArticle(id: string): Promise<ApiResult<{ liked: boolean; likeCount: number }>> {
  return request(
    `/api/tea/${encodeURIComponent(id)}/like`,
    { method: 'POST', body: '{}' },
    (r) => (typeof r?.likeCount === 'number' ? r : undefined)
  );
}

export function unlikeTeaArticle(id: string): Promise<ApiResult<{ liked: boolean; likeCount: number }>> {
  return request(
    `/api/tea/${encodeURIComponent(id)}/like`,
    { method: 'DELETE' },
    (r) => (typeof r?.likeCount === 'number' ? r : undefined)
  );
}

// --- Group Buy engine (Chama & group-order pipelines) ---------------------------

export interface GroupBuyContribution {
  id: string;
  memberRef: string;
  amount: number;
  source: string;
  receiptHash: string;
  createdAt: string;
}

export interface GroupBuy {
  id: string;
  title: string;
  note: string | null;
  targetAmount: number;
  stage: string;
  stages: { id: string; label: string; blurb: string }[];
  stageIndex: number;
  total: number;
  remaining: number;
  progressPct: number;
  contributionCount: number;
  contributions: GroupBuyContribution[];
  history: { stage: string; at: string; note: string }[];
}

export function listGroupBuys(): Promise<ApiResult<GroupBuy[]>> {
  return request('/api/engine/group-buys', undefined, (r) =>
    Array.isArray(r?.groupBuys) ? (r.groupBuys as GroupBuy[]) : undefined
  );
}

export function createGroupBuy(body: { title: string; targetAmount: number; note?: string }): Promise<ApiResult<GroupBuy>> {
  return request('/api/engine/group-buys', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.groupBuy ? (r.groupBuy as GroupBuy) : undefined
  );
}

export function contributeGroupBuy(id: string, body: { memberRef: string; amount: number; source: string }): Promise<ApiResult<{
  receipt: { contributionId: string; memberRef: string; amount: number; source: string; receiptHash: string; createdAt: string };
  total: number;
  progressPct: number;
  stageChanged: boolean;
}>> {
  return request(`/api/engine/group-buys/${encodeURIComponent(id)}/contribute`, { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.receipt ? r : undefined
  );
}

export function advanceGroupBuyStage(id: string, to: string): Promise<ApiResult<GroupBuy>> {
  return request(`/api/engine/group-buys/${encodeURIComponent(id)}/stage`, { method: 'POST', body: JSON.stringify({ to }) }, (r) =>
    r?.groupBuy ? (r.groupBuy as GroupBuy) : undefined
  );
}

// --- Priced bargains (Tikiti T2) -----------------------------------------------

export interface BargainTier {
  min: number;
  max: number | null;
  pricePerHead: number;
  label: string | null;
}

/**
 * The honest price view the server derives: what a joiner pays NOW, the next
 * band and what it needs, and what everyone settles at if the room fills.
 * Nothing here is client-computed.
 */
export interface BargainView {
  participants: number;
  requiredParticipants: number | null;
  maxParticipants: number | null;
  spotsLeft: number | null;
  currentPricePerHead: number | null;
  currentTierLabel: string | null;
  nextTier: { at: number; pricePerHead: number; needs: number } | null;
  settlesAt: number;
  expiresAt: string | null;
  expired: boolean;
  minimumMet: boolean;
}

export interface GroupBuyWithBargain {
  groupBuy: GroupBuy;
  bargain: BargainView | null;
}

/** One buy with its derived bargain view (owner-only route). */
export function getGroupBuy(id: string): Promise<ApiResult<GroupBuyWithBargain>> {
  return request(`/api/engine/group-buys/${encodeURIComponent(id)}`, undefined, (r) =>
    r?.groupBuy ? { groupBuy: r.groupBuy as GroupBuy, bargain: (r.bargain ?? null) as BargainView | null } : undefined
  );
}

/**
 * Attach per-head pricing bands to a buy. The ladder must climb down in price
 * as participation climbs up; the server refuses anything else, and the
 * refusal text is the useful part.
 */
export function priceGroupBuyBargain(
  id: string,
  body: {
    tiers: { min: number; pricePerHead: number; max?: number | null; label?: string | null }[];
    minParticipants?: number | null;
    maxParticipants?: number | null;
    expiresAt?: string | null;
  }
): Promise<ApiResult<GroupBuy>> {
  return request(
    `/api/engine/group-buys/${encodeURIComponent(id)}/pricing`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.buy ? (r.buy as GroupBuy) : undefined)
  );
}

/**
 * Join a priced bargain. There is deliberately no price argument: the price is
 * derived server-side from the live count at the moment of joining.
 */
export function joinBargain(id: string): Promise<ApiResult<{
  participant: { id: string; priceAtJoin: number; tierLabelAtJoin: string; status: string };
  changed: boolean;
}>> {
  return request(
    `/api/engine/group-buys/${encodeURIComponent(id)}/join`,
    { method: 'POST', body: '{}' },
    (r) => (r?.participant ? { participant: r.participant, changed: Boolean(r.changed) } : undefined)
  );
}

/** Leave before the bargain executes; the spot opens again. */
export function leaveBargain(id: string): Promise<ApiResult<{
  participant: { id: string; status: string };
  changed: boolean;
}>> {
  return request(
    `/api/engine/group-buys/${encodeURIComponent(id)}/leave`,
    { method: 'POST', body: '{}' },
    (r) => (r?.participant ? { participant: r.participant, changed: Boolean(r.changed) } : undefined)
  );
}

// --- Campaign updates (Tikiti T3) ----------------------------------------------

export interface CampaignUpdatePost {
  id: string;
  campaignId: string;
  title: string;
  body: string;
  createdAt: string;
}

/** Updates on a published campaign, addressed by its PUBLIC slug. */
export function getCampaignUpdatesBySlug(slug: string): Promise<ApiResult<CampaignUpdatePost[]>> {
  return request(
    `/api/public/campaigns/${encodeURIComponent(slug)}/updates`,
    undefined,
    (r) => (Array.isArray(r?.updates) ? (r.updates as CampaignUpdatePost[]) : undefined)
  );
}

/** The organiser authors an update; supporters read it on the public page. */
export function postCampaignUpdate(
  campaignId: string,
  body: { title: string; body: string }
): Promise<ApiResult<CampaignUpdatePost>> {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/updates`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.update ? (r.update as CampaignUpdatePost) : undefined)
  );
}

// --- Verification (Tikiti T6) ----------------------------------------------------

export type AccountVerificationKind = 'email' | 'phone' | 'identity';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface VerificationRecord {
  id: string;
  kind: AccountVerificationKind;
  status: VerificationStatus;
  providerRef: string | null;
  note: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  /** The reviewer's own reason, shown verbatim. */
  reason: string | null;
}

export function submitVerification(body: {
  kind: AccountVerificationKind; providerRef?: string | null; note?: string | null;
}): Promise<ApiResult<{ record: VerificationRecord; changed: boolean }>> {
  return request('/api/verification', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.record ? { record: r.record as VerificationRecord, changed: Boolean(r.changed) } : undefined
  );
}

/** My records and my DERIVED standing (never a stored second truth). */
export function getMyVerification(): Promise<ApiResult<{
  records: VerificationRecord[];
  standing: Record<string, 'verified' | 'pending' | 'unverified'>;
}>> {
  return request('/api/verification/me', undefined, (r) =>
    Array.isArray(r?.records) ? { records: r.records as VerificationRecord[], standing: r.standing ?? {} } : undefined
  );
}

// --- Email topic subscriptions (Tikiti T7) -----------------------------------------

export const EMAIL_TOPICS = [
  'event_announcements', 'new_ticket_listings', 'bargain_alerts',
  'contribution_updates', 'arena_announcements', 'product_updates'
] as const;
export type EmailTopic = typeof EMAIL_TOPICS[number];

export const EMAIL_TOPIC_LABELS: Record<EmailTopic, string> = {
  event_announcements: 'Events',
  new_ticket_listings: 'Ticket resale',
  bargain_alerts: 'Bargain bands',
  contribution_updates: 'Causes you back',
  arena_announcements: 'Arena',
  product_updates: 'Brief itself'
};

export function subscribeEmailTopics(email: string, topics: string[]): Promise<ApiResult<{
  subscription: { email: string; status: string; topics: string[]; token?: string };
  delivery: string;
  changed: boolean;
}>> {
  return request('/api/email-subscriptions', { method: 'POST', body: JSON.stringify({ email, topics }) }, (r) =>
    r?.subscription ? { subscription: r.subscription, delivery: String(r.delivery ?? ''), changed: Boolean(r.changed) } : undefined
  );
}

export function confirmEmailSubscription(token: string): Promise<ApiResult<{ ok: true; already: boolean; topics: string[] }>> {
  return request(`/api/email-subscriptions/confirm?token=${encodeURIComponent(token)}`, undefined, (r) =>
    r?.ok === true ? { ok: true, already: Boolean(r.already), topics: r.topics ?? [] } : undefined
  );
}

/** Leaving a list needs no account: the token (or the address) is enough. */
export function unsubscribeEmail(tokenOrEmail: string): Promise<ApiResult<{ ok: true; already: boolean }>> {
  return request('/api/email-subscriptions/unsubscribe', { method: 'POST', body: JSON.stringify({ token: tokenOrEmail }) }, (r) =>
    r?.ok === true ? { ok: true, already: Boolean(r.already) } : undefined
  );
}

// ---------------------------------------------------------------------------
// OPERATOR SURFACE (F4 / Tikiti T8). Every call here is capability-gated
// server-side (ops.read / ops.run / moderate / finance / admin); the client
// mirrors the gating only to decide what to OFFER. 403 bodies name
// `requiredCapability`, which the desk shows verbatim.
// ---------------------------------------------------------------------------

/** True when the session may operate at all (any operator capability). */
export const OPERATOR_CAPABILITIES = ['ops.read', 'ops.run', 'moderate', 'finance', 'admin'] as const;

export function isOperator(user: { capabilities?: string[] | null } | null | undefined): boolean {
  const caps = user?.capabilities ?? [];
  return OPERATOR_CAPABILITIES.some((c) => caps.includes(c));
}

const isRowArray = (v: unknown): v is Record<string, any>[] => Array.isArray(v);

export function getOpsDiagnostics(): Promise<ApiResult<Record<string, any>>> {
  return request('/api/ops/diagnostics', undefined, (r) => (r && typeof r === 'object' && 'counts' in r ? r : undefined));
}

export function opsBackup(): Promise<ApiResult<{ ok: boolean; file?: string; size?: number }>> {
  return request('/api/ops/backup', { method: 'POST', body: '{}' }, (r) => (r?.ok === true ? r : undefined));
}

export function getOpsAnalytics(): Promise<ApiResult<{ analytics: Record<string, any> }>> {
  return request('/api/ops/analytics', undefined, (r) => (r && typeof r.analytics === 'object' ? r as { analytics: Record<string, any> } : undefined));
}

export function getOpsReports(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/reports', undefined, (r) => (isRowArray(r?.reports) ? r.reports : undefined));
}

export function resolveOpsReport(id: string, action: 'dismiss' | 'remove', reason: string): Promise<ApiResult<Record<string, any>>> {
  return request(`/api/ops/reports/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify({ action, reason }) }, (r) => r ?? undefined);
}

export function getOpsUnverified(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/unverified', undefined, (r) => (isRowArray(r?.objects) ? r.objects : undefined));
}

export function getOpsContributors(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/contributors', undefined, (r) => (isRowArray(r?.contributors) ? r.contributors : undefined));
}

export function getOpsDisputes(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/disputes', undefined, (r) => (isRowArray(r?.disputes) ? r.disputes : undefined));
}

export function getOpsTicketListings(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/ticket-listings', undefined, (r) => (isRowArray(r?.listings) ? r.listings : undefined));
}

export function getOpsVerificationQueue(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/ops/verification', undefined, (r) => (isRowArray(r?.queue) ? r.queue : undefined));
}

export function opsVerificationDecision(id: string, decision: 'approved' | 'rejected', reason: string): Promise<ApiResult<Record<string, any>>> {
  return request(`/api/ops/verification/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) }, (r) => r ?? undefined);
}

export function opsVerificationRevoke(id: string, reason: string): Promise<ApiResult<Record<string, any>>> {
  return request(`/api/ops/verification/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }, (r) => r ?? undefined);
}

export function getOpsEmailLog(limit = 50): Promise<ApiResult<Record<string, any>[]>> {
  return request(`/api/ops/email-log?limit=${limit}`, undefined, (r) => (isRowArray(r?.log) ? r.log : undefined));
}

export function getOpsAudit(limit = 100): Promise<ApiResult<{ audit: Record<string, any>[]; total: number }>> {
  return request(`/api/ops/audit?limit=${limit}`, undefined, (r) => (isRowArray(r?.audit) && Number.isFinite(r?.total) ? r : undefined));
}

export function setPlatformRoles(userId: string, roles: string[], reason: string): Promise<ApiResult<Record<string, any>>> {
  return request('/api/ops/roles', { method: 'POST', body: JSON.stringify({ userId, roles, reason }) }, (r) => r ?? undefined);
}

export function getEconomicReconcile(): Promise<ApiResult<Record<string, any>>> {
  return request('/api/economic/reconcile', undefined, (r) => (r && typeof r.reconciliation === 'object' ? r : undefined));
}

export function getPaymentsReconcile(): Promise<ApiResult<Record<string, any>>> {
  return request('/api/economic/payments/reconcile', undefined, (r) => (r && typeof r.reconciliation === 'object' ? r : undefined));
}


/** Editorial collections (moderate capability). */
export function getAdminCollections(): Promise<ApiResult<Record<string, any>[]>> {
  return request('/api/admin/collections', undefined, (r) => (isRowArray(r?.collections) ? r.collections : undefined));
}

export function transitionAdminCollection(key: string, action: string): Promise<ApiResult<Record<string, any>>> {
  return request(`/api/admin/collections/${encodeURIComponent(key)}/${encodeURIComponent(action)}`, { method: 'POST', body: '{}' }, (r) => r ?? undefined);
}

/** Record an editorial/library image (ops.run). Validation is the server's. */
export function recordAdminMedia(fields: {
  kind?: string; key?: string; url?: string; alt?: string | null; attribution?: string | null; status?: string;
}): Promise<ApiResult<Record<string, any>>> {
  return request('/api/admin/media', { method: 'POST', body: JSON.stringify(fields) }, (r) => r ?? undefined);
}

// --- Events hub (Tikiti T4) ------------------------------------------------------

export interface EventListing {
  /** The public identity; internal ids stay private. */
  slug: string;
  title: string;
  category: string;
  categoryLabel: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  price: number;
  currency: string;
  goalAmount: number | null;
  featured: boolean;
  /** COUNTED registrations, never a seeded number. */
  popularity: number;
}

export function browseEvents(opts: {
  category?: string; location?: string; from?: string; to?: string;
  featured?: boolean; sort?: 'date' | 'popularity'; limit?: number;
} = {}): Promise<ApiResult<{ events: EventListing[]; total: number }>> {
  const q = new URLSearchParams();
  if (opts.category) q.set('category', opts.category);
  if (opts.location) q.set('location', opts.location);
  if (opts.from) q.set('from', opts.from);
  if (opts.to) q.set('to', opts.to);
  if (opts.featured) q.set('featured', '1');
  if (opts.sort) q.set('sort', opts.sort);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return request(`/api/events${qs ? `?${qs}` : ''}`, undefined, (r) =>
    Array.isArray(r?.events) ? { events: r.events as EventListing[], total: Number(r.total ?? r.events.length) } : undefined
  );
}

export function getEventCategories(): Promise<ApiResult<{ categories: string[]; labels: Record<string, string> }>> {
  return request('/api/events/categories', undefined, (r) =>
    Array.isArray(r?.categories) ? { categories: r.categories, labels: r.labels ?? {} } : undefined
  );
}

// --- EPL contest rooms (Tikiti T5) ------------------------------------------------

export interface EplProviderStatus {
  configured: boolean;
  reason?: string;
}

export interface EplClubRow { id: string; name: string; shortName?: string | null }

export interface EplCatalogPlayer {
  id: string;
  name: string;
  club: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  /** 'seed' or a provider name -- never invented. */
  source: string;
}

export function getEplClubs(): Promise<ApiResult<{ clubs: EplClubRow[]; provider: EplProviderStatus }>> {
  return request('/api/epl/clubs', undefined, (r) =>
    Array.isArray(r?.clubs) ? { clubs: r.clubs, provider: r.provider ?? { configured: false } } : undefined
  );
}

export function getEplCatalog(opts: { club?: string; position?: string } = {}): Promise<ApiResult<{ players: EplCatalogPlayer[]; provider: EplProviderStatus }>> {
  const q = new URLSearchParams();
  if (opts.club) q.set('club', opts.club);
  if (opts.position) q.set('position', opts.position);
  const qs = q.toString();
  return request(`/api/epl/catalog${qs ? `?${qs}` : ''}`, undefined, (r) =>
    Array.isArray(r?.players) ? { players: r.players, provider: r.provider ?? { configured: false } } : undefined
  );
}

export type EplLobbyState =
  | 'waiting_for_players' | 'open' | 'full' | 'in_progress'
  | 'completed' | 'cancelled';

export interface EplRoomRow {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  kickoffAt: string;
  budgetKes: number | null;
  minEntries: number | null;
  maxEntries: number | null;
  mine: boolean;
  lobbyState: EplLobbyState;
  entries: number;
}

export function listEplRooms(): Promise<ApiResult<EplRoomRow[]>> {
  return request('/api/epl/competitions', undefined, (r) =>
    Array.isArray(r?.competitions) ? (r.competitions as EplRoomRow[]) : undefined
  );
}

export function createEplRoom(body: {
  title: string; kickoffAt: string;
  budgetKes?: number | null; minEntries?: number | null; maxEntries?: number | null;
}): Promise<ApiResult<{ competition: { id: string; title: string; status: string; budgetKes: number | null; minEntries: number | null; maxEntries: number | null }; lobbyState: EplLobbyState }>> {
  return request('/api/epl/competitions', { method: 'POST', body: JSON.stringify(body) }, (r) =>
    r?.competition ? { competition: r.competition, lobbyState: r.lobbyState } : undefined
  );
}

/** A room's imported pool -- the rows picks are validated against. */
export function getEplPool(competitionId: string): Promise<ApiResult<{ players: EplCatalogPlayer[] }>> {
  return request(
    `/api/epl/competitions/${encodeURIComponent(competitionId)}/pool`,
    undefined,
    (r) => (Array.isArray(r?.players) ? { players: r.players as EplCatalogPlayer[] } : undefined)
  );
}

/** Import the (seed or provider) catalog into a room's pool. Organiser-only. */
export function importEplPool(competitionId: string, club?: string): Promise<ApiResult<{ imported: number; opened: boolean; openNote: string | null }>> {
  return request(
    `/api/epl/competitions/${encodeURIComponent(competitionId)}/pool/import`,
    { method: 'POST', body: JSON.stringify(club ? { club } : {}) },
    (r) => (typeof r?.imported === 'number'
      ? { imported: r.imported, opened: Boolean(r?.opened), openNote: (r?.openNote as string | null) ?? null }
      : undefined)
  );
}

/**
 * Seat a team in a room. No price is sent; the server derives everything and
 * a refusal carries the arithmetic.
 */
export function submitEplEntry(
  competitionId: string,
  body: { playerIds: string[]; captainId: string }
): Promise<ApiResult<{
  created: boolean;
  entry: { id: string; playerIds: string[]; captainId: string | null; points: number | null };
  lobbyState: EplLobbyState;
  entries: number;
}>> {
  return request(
    `/api/epl/competitions/${encodeURIComponent(competitionId)}/entries`,
    { method: 'POST', body: JSON.stringify(body) },
    (r) => (r?.entry ? { created: Boolean(r.created), entry: r.entry, lobbyState: r.lobbyState, entries: Number(r.entries ?? 0) } : undefined)
  );
}

/** The waiting-room wall: cancel an underfilled room, or lock a filled one. */
export function settleEplLobby(competitionId: string): Promise<ApiResult<{
  competition: { id: string; status: string; cancelledReason?: string | null };
  changed: boolean;
  lobbyState: EplLobbyState;
}>> {
  return request(
    `/api/epl/competitions/${encodeURIComponent(competitionId)}/settle-lobby`,
    { method: 'POST', body: '{}' },
    (r) => (r?.competition ? { competition: r.competition, changed: Boolean(r.changed), lobbyState: r.lobbyState } : undefined)
  );
}

export function getEplStandings(competitionId: string): Promise<ApiResult<{
  competition: { id: string; title: string; status: string };
  standings: { entryId: string; userId: string; points: number | null; rank: number | null }[];
}>> {
  return request(`/api/epl/competitions/${encodeURIComponent(competitionId)}/standings`, undefined, (r) =>
    r?.competition ? { competition: r.competition, standings: r.standings ?? [] } : undefined
  );
}

// --- The dynamic ticket bar ------------------------------------------------------

export interface EngineTicketBar {
  active: boolean;
  ticket?: {
    eventTitle: string;
    ticketCode: string;
    registrationId: string;
    entryState: 'active' | 'upcoming' | 'checked-in';
    startsAt: string | null;
    checkedIn: boolean;
  };
  deltas?: { kind: string; at: string }[];
  reason?: string;
}

export function getEngineTicketBar(): Promise<ApiResult<EngineTicketBar>> {
  return request('/api/engine/ticket-bar', undefined, (r) =>
    typeof r?.active === 'boolean' ? (r as EngineTicketBar) : undefined
  );
}

// ---------------------------------------------------------------------------
// REAL IMAGE UPLOADS
//
// The editorial surfaces used to accept only a URL, so every photo was
// somebody else's asset on somebody else's server: free to rot, free to
// hotlink-block, free to change under a published story. These calls put an
// actual file in Brief instead.
//
// The link route is NOT removed -- an editor may still have a legitimately
// attributed external image -- but it is no longer the only way in, and it is
// no longer the default.
// ---------------------------------------------------------------------------

/**
 * Turn a server image reference into something an <img> can load.
 *
 * The server returns a ROOT-relative path (`/api/media/file/<id>`) because it
 * does not know how the client reaches it. In the browser that path has to go
 * through the ingestion proxy; an absolute http(s) link passes straight
 * through. Deciding this here keeps the proxy detail out of every component.
 */
export function mediaFileUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${INGEST_API}${url}` : url;
}

/**
 * Upload one image file.
 *
 * The server decides what the file really is from its magic bytes, so a
 * refusal here is worth showing to the person verbatim: "only JPEG, PNG, WebP
 * and GIF images can be uploaded" is a better message than a generic failure.
 */
export function uploadMediaFile(
  file: File,
  opts: { alt?: string } = {}
): Promise<ApiResult<{ upload: MediaUpload; duplicate: boolean }>> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (opts.alt) form.append('alt', opts.alt.slice(0, 240));
  return requestForm('/api/media/upload', form, (r) =>
    isMediaUpload(r?.upload)
      ? { upload: r.upload as MediaUpload, duplicate: Boolean(r.duplicate) }
      : undefined
  );
}

/** Your own uploads, newest first. */
export function listMyMedia(): Promise<ApiResult<MediaUpload[]>> {
  return request('/api/media/mine', undefined, (r) => areMediaUploads(r?.uploads ?? []));
}

/** Remove one of your own uploads, bytes and all. */
export function deleteMedia(id: string): Promise<ApiResult<{ removed: true }>> {
  return request(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' }, (r) =>
    r?.removed === true ? { removed: true as const } : undefined
  );
}

/**
 * What this deployment can promise about uploads.
 *
 * Local disk, so `persisted` is false: images survive a restart but not a
 * redeploy to a fresh container. The editor says that out loud instead of
 * letting somebody discover it.
 */
export function getMediaStatus(): Promise<ApiResult<{ media: any; uploads: MediaStorageStatus }>> {
  return request('/api/media/status', undefined, (r) =>
    r?.uploads && typeof r.uploads === 'object'
      ? { media: r.media ?? null, uploads: r.uploads as MediaStorageStatus }
      : undefined
  );
}

// ---------------------------------------------------------------------------
// THE WAITING-ON-YOU QUEUE
// ---------------------------------------------------------------------------

/**
 * Everything currently blocked on the signed-in person: the circle tasks they
 * hold, the orders on their shelf, the events they are running, and the
 * messages nobody has reviewed.
 *
 * Derived on the server from real rows, per caller. There is no cache and no
 * local merging, so the list cannot disagree with the work it points at.
 */
export function getTriageQueue(withinHours?: number): Promise<ApiResult<TriageQueue>> {
  const q = withinHours ? `?withinHours=${encodeURIComponent(String(withinHours))}` : '';
  return request(`/api/triage${q}`, undefined, (r) => (isTriageQueue(r) ? r : undefined));
}

// ---------------------------------------------------------------------------
// CIRCLE MEMBERSHIP: JOIN, LEAVE, REMOVE
// ---------------------------------------------------------------------------

/**
 * Leave a circle as the signed-in caller.
 *
 * The loop had no exit: you could be added to a circle, or self-join an open
 * one, and then had no way to stop being a member. Leaving is self-service --
 * it removes YOUR row and nobody else's.
 */
export function leaveCircle(circleId: string): Promise<ApiResult<{ left: true; circleId: string }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/me`,
    { method: 'DELETE' },
    (r) => (r?.left === true ? { left: true as const, circleId } : undefined)
  );
}

/**
 * Remove SOMEBODY ELSE from a circle. Coordinator-only; the server returns
 * 403 otherwise. Separate from leaveCircle so the privileged act is visible
 * at the call site -- and so you cannot "remove" yourself by accident.
 */
export function removeMember(
  circleId: string,
  userId: string
): Promise<ApiResult<{ left: true; userId: string }>> {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    (r) => (r?.left === true ? { left: true as const, userId } : undefined)
  );
}

// ---------------------------------------------------------------------------
// SUBSCRIPTIONS: THE FOLLOWER'S HALF
// ---------------------------------------------------------------------------

/** The plans I publish. */
export function getMySubscriptions(): Promise<ApiResult<Subscription[]>> {
  return request('/api/subscriptions', undefined, (r) => areSubscriptions(r?.subscriptions ?? []));
}

/**
 * Public plans by other creators. This is the discovery the follower side was
 * missing: without it a plan could exist but be unreachable by anybody except
 * the person who wrote it.
 */
export function browseSubscriptions(): Promise<ApiResult<Subscription[]>> {
  return request('/api/subscriptions?browse=1', undefined, (r) => areSubscriptions(r?.subscriptions ?? []));
}

/** One creator's public plans. */
export function getCreatorSubscriptions(creatorId: string): Promise<ApiResult<Subscription[]>> {
  return request(
    `/api/subscriptions?creator=${encodeURIComponent(creatorId)}`,
    undefined,
    (r) => areSubscriptions(r?.subscriptions ?? [])
  );
}

/**
 * Join a plan AS THE AUTHENTICATED CALLER.
 *
 * The response says `charged: false` while no payment provider is connected.
 * The UI must show that rather than implying money moved.
 */
export function subscribeToPlan(id: string): Promise<ApiResult<SubscriptionJoin>> {
  return request(
    `/api/subscriptions/${encodeURIComponent(id)}/subscribe`,
    { method: 'POST', body: '{}' },
    (r) => (isSubscriptionJoin(r) ? r : undefined)
  );
}

export function unsubscribeFromPlan(id: string): Promise<ApiResult<{ subscriber: Subscriber; changed: boolean }>> {
  return request(
    `/api/subscriptions/${encodeURIComponent(id)}/unsubscribe`,
    { method: 'POST', body: '{}' },
    (r) => (isSubscriber(r?.subscriber)
      ? { subscriber: r.subscriber, changed: r.changed === true }
      : undefined)
  );
}

/** Who is subscribed. Creator-only; the server refuses everybody else with 403. */
export function getPlanSubscribers(id: string): Promise<ApiResult<Subscriber[]>> {
  return request(
    `/api/subscriptions/${encodeURIComponent(id)}/subscribers`,
    undefined,
    (r) => areSubscribers(r?.subscribers ?? [])
  );
}

/**
 * Move an order to the next fulfilment stage as its vendor.
 *
 * The stage is the server's vocabulary (accepted / preparing / ready) because
 * those are the only stages a vendor may set: settlement is economic and needs
 * a settled transaction, so it has its own guarded endpoint.
 */
export function stageOrder(
  id: string,
  stage: string,
  note = ''
): Promise<ApiResult<{ order: Order; changed: boolean }>> {
  return request(
    `/api/orders/${encodeURIComponent(id)}/stage`,
    { method: 'POST', body: JSON.stringify({ stage, note }) },
    (r) => (isOrder(r?.order) ? { order: r.order, changed: Boolean(r.changed) } : undefined)
  );
}
// ---------------------------------------------------------------------------
// MSHIKANO — the peer-to-peer cooperation network. Four intents, complementary
// matching, two-party-confirmed cooperations, evidence-based trust.
// ---------------------------------------------------------------------------

export type CoopIntent = 'have' | 'need' | 'can_help' | 'looking_for';

export interface CoopTrust {
  userId: string;
  level: 'new' | 'cooperating' | 'proven' | 'established';
  levelWords: string;
  evidence: {
    confirmedCooperations: number;
    repeatPartners: number;
    recommendations: number;
    identityVerified: boolean;
    disputes: number;
  };
  recommendationNotes: { by: { displayName: string }; note: string; at: string }[];
}

export interface CoopPost {
  id: string;
  intent: CoopIntent;
  intentLabel: string;
  title: string;
  body: string | null;
  category: string | null;
  town: string | null;
  county: string | null;
  createdAt: string;
  status: string;
  mine: boolean;
  author: { id: string; handle: string | null; displayName: string };
  trust: CoopTrust | null;
}

export interface CoopMatch {
  post: CoopPost;
  sharedCount: number;
  reasons: string[];
  score: number;
}

export interface CoopCooperation {
  id: string;
  postId: string | null;
  fromUserId: string;
  toUserId: string;
  summary: string | null;
  status: 'pending' | 'confirmed' | 'declined' | 'disputed';
  recommendations: { byUserId: string; forUserId: string; note: string; at: string }[];
  createdAt: string;
  confirmedAt: string | null;
  disputedAt?: string | null;
  dispute?: { byUserId: string; note: string; at: string } | null;
  direction?: 'outgoing' | 'incoming';
  partner?: { id: string; displayName: string };
}

export function createCoopPost(body: {
  intent: CoopIntent; title: string; body?: string | null;
  category?: string | null; town?: string | null; county?: string | null;
}): Promise<ApiResult<{ post: CoopPost }>> {
  return request('/api/mshikano/posts', { method: 'POST', body: JSON.stringify(body) }, (r) => (r?.post ? { post: r.post as CoopPost } : undefined));
}

export function listCoopPosts(opts: { intent?: string; q?: string; county?: string; mine?: boolean } = {}): Promise<ApiResult<{ posts: CoopPost[] }>> {
  const qs = new URLSearchParams();
  if (opts.intent) qs.set('intent', opts.intent);
  if (opts.q) qs.set('q', opts.q);
  if (opts.county) qs.set('county', opts.county);
  if (opts.mine) qs.set('mine', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/api/mshikano/posts${suffix}`, undefined, (r) => (Array.isArray(r?.posts) ? { posts: r.posts as CoopPost[] } : undefined));
}

export function coopMatches(postId: string): Promise<ApiResult<{ matches: CoopMatch[] }>> {
  return request(`/api/mshikano/posts/${encodeURIComponent(postId)}/matches`, undefined, (r) => (Array.isArray(r?.matches) ? { matches: r.matches as CoopMatch[] } : undefined));
}

export function proposeCooperation(body: { postId?: string | null; partnerUserId: string; summary?: string | null }): Promise<ApiResult<{ cooperation: CoopCooperation }>> {
  return request('/api/mshikano/cooperations', { method: 'POST', body: JSON.stringify(body) }, (r) => (r?.cooperation ? { cooperation: r.cooperation as CoopCooperation } : undefined));
}

export interface CoopCooperations {
  pending: CoopCooperation[];
  confirmed: CoopCooperation[];
  declined: CoopCooperation[];
  disputed: CoopCooperation[];
}

export function listCooperations(): Promise<ApiResult<CoopCooperations>> {
  return request('/api/mshikano/cooperations', undefined, (r): CoopCooperations | undefined =>
    Array.isArray(r?.pending) && Array.isArray(r?.confirmed) && Array.isArray(r?.declined) && Array.isArray(r?.disputed)
      ? { pending: r.pending, confirmed: r.confirmed, declined: r.declined, disputed: r.disputed }
      : undefined);
}

export function respondCooperation(id: string, accept: boolean): Promise<ApiResult<{ cooperation: CoopCooperation }>> {
  return request(`/api/mshikano/cooperations/${encodeURIComponent(id)}/respond`, { method: 'POST', body: JSON.stringify({ accept }) }, (r) => (r?.cooperation ? { cooperation: r.cooperation as CoopCooperation } : undefined));
}

export function recommendCooperation(id: string, note: string): Promise<ApiResult<{ cooperation: CoopCooperation }>> {
  return request(`/api/mshikano/cooperations/${encodeURIComponent(id)}/recommend`, { method: 'POST', body: JSON.stringify({ note }) }, (r) => (r?.cooperation ? { cooperation: r.cooperation as CoopCooperation } : undefined));
}

export function disputeCooperation(id: string, reason: string): Promise<ApiResult<{ cooperation: CoopCooperation }>> {
  return request(`/api/mshikano/cooperations/${encodeURIComponent(id)}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }, (r) => (r?.cooperation ? { cooperation: r.cooperation as CoopCooperation } : undefined));
}

export interface CoopGraph {
  totals: { confirmed: number; helped: number; received: number; repeatPartners: number };
  helped: { with: { displayName: string }; at: string; summary: string | null }[];
  received: { with: { displayName: string }; at: string; summary: string | null }[];
}

export function coopGraph(): Promise<ApiResult<CoopGraph>> {
  return request('/api/mshikano/graph', undefined, (r): CoopGraph | undefined =>
    r?.totals && Array.isArray(r?.helped) && Array.isArray(r?.received)
      ? { totals: r.totals, helped: r.helped, received: r.received }
      : undefined);
}

export function coopTrust(userId: string): Promise<ApiResult<CoopTrust>> {
  return request(`/api/mshikano/trust/${encodeURIComponent(userId)}`, undefined, (r) => (r?.evidence ? r as CoopTrust : undefined));
}

export interface WhoCanHelpAnswer {
  query: string;
  counts: { people: number; businesses: number; groups: number; guides: number };
  people: CoopPost[];
  businesses: CoopPost[];
  groups: { id: string; name: string; description: string | null; visibility: string | null; members: number }[];
  guides: { slug: string; title: string }[];
}

export function whoCanHelp(q: string): Promise<ApiResult<WhoCanHelpAnswer>> {
  return request(`/api/mshikano/who-can-help?q=${encodeURIComponent(q)}`, undefined, (r): WhoCanHelpAnswer | undefined =>
    r?.counts && Array.isArray(r?.people) && Array.isArray(r?.guides) && Array.isArray(r?.groups)
      ? {
          query: r.query ?? q,
          counts: r.counts,
          people: r.people,
          businesses: r.businesses ?? [],
          groups: r.groups,
          guides: r.guides
        }
      : undefined);
}

// ---------------------------------------------------------------------------
// Service fees — paying Brief through Pochi la Biashara (manual M-Pesa code
// flow; Pochi has no developer API). Amounts come from the server catalog.
// ---------------------------------------------------------------------------

export interface ServiceCatalogItem { key: string; label: string; amountKes: number }
export interface ServiceFee {
  id: string; userId: string; service: string; label: string; amountKes: number;
  mpesaCode: string; status: 'pending' | 'confirmed' | 'refused';
  refusedReason: string | null; confirmedAt: string | null; createdAt: string; ledgerId: string;
}
export interface MyServiceFees { pochi: string | null; services: ServiceCatalogItem[]; fees: ServiceFee[] }

const isServiceFee = (f: any): f is ServiceFee =>
  typeof f?.id === 'string' && typeof f?.amountKes === 'number' &&
  typeof f?.mpesaCode === 'string' && (['pending', 'confirmed', 'refused'] as const).includes(f?.status);

export function myServiceFees(): Promise<ApiResult<MyServiceFees>> {
  return request('/api/fees/mine', undefined, (r): MyServiceFees | undefined =>
    Array.isArray(r?.services) && Array.isArray(r?.fees) && r.fees.every(isServiceFee)
      ? { pochi: r.pochi ?? null, services: r.services, fees: r.fees }
      : undefined);
}

export function payServiceFee(service: string, mpesaCode: string): Promise<ApiResult<{ fee: ServiceFee }>> {
  return request('/api/fees/pay', { method: 'POST', body: JSON.stringify({ service, mpesaCode }) }, (r) =>
    isServiceFee(r?.fee) ? { fee: r.fee } : undefined);
}

// ---------------------------------------------------------------------------
// Referrals — rewards with a mathematical edge, not a pyramid: depth is ONE
// level, there is no entry fee, and points become cash only from a pool
// backed by real confirmed revenue.
// ---------------------------------------------------------------------------

export interface ReferralPool { backingKes: number; paidOrPromisedKes: number; availableKes: number }
export interface ReferralBalance { earned: number; locked: number; available: number }
export interface ReferralEvent { id: string; kind: string; points: number; valueKes: number; at: string }
export interface ReferralConversion { id: string; points: number; kes: number; status: 'pending' | 'confirmed' | 'refused'; refusedReason: string | null; createdAt: string }
export interface MyReferrals {
  code: string; maxDepth: number; link: string;
  balance: ReferralBalance; pool: ReferralPool;
  conversion: { ptsToKes: number; minPoints: number };
  events: ReferralEvent[]; conversions: ReferralConversion[];
}
export interface ShareMessage { code: string; slug: string | null; url: string; message: string; waMe: string }

export function myReferrals(): Promise<ApiResult<MyReferrals>> {
  return request('/api/referrals/mine', undefined, (r): MyReferrals | undefined =>
    typeof r?.code === 'string' && r?.balance?.available >= 0 && Array.isArray(r?.events) && Array.isArray(r?.conversions)
      ? r as MyReferrals
      : undefined);
}

export function referralShare(slug?: string): Promise<ApiResult<ShareMessage>> {
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  return request(`/api/referrals/share${q}`, undefined, (r): ShareMessage | undefined =>
    typeof r?.code === 'string' && typeof r?.message === 'string' && typeof r?.waMe === 'string'
      ? { code: r.code, slug: r.slug ?? null, url: r.url, message: r.message, waMe: r.waMe }
      : undefined);
}

export function convertReferralPoints(points: number): Promise<ApiResult<{ conversion: ReferralConversion }>> {
  return request('/api/referrals/convert', { method: 'POST', body: JSON.stringify({ points }) }, (r) =>
    typeof r?.conversion?.id === 'string' && typeof r?.conversion?.kes === 'number'
      ? { conversion: r.conversion as ReferralConversion }
      : undefined);
}

// ---------------------------------------------------------------------------
// ARENA PROGRESSION — the retention layer. XP and Arena Coins are POINTS:
// they buy nothing and cash out nowhere. Totals are derived server-side from
// confirmed matches and claimed missions; ratings/streaks are replays.
// ---------------------------------------------------------------------------

export interface ArenaProfile {
  userId: string; level: number; xpIntoLevel: number; xpPerLevel: number;
  seasonXp: number; seasonCoins: number; totalXp: number; totalCoins: number; matchesToday: number;
}
export interface ArenaMission {
  key: string; label: string; target: number; hint: string;
  reward: { xp: number; coins: number }; progress: number; complete: boolean; claimed: boolean; claimable: boolean;
}
export interface ArenaRival { userId: string; displayName: string; played: number; iWon: number; theyWon: number }
export interface ArenaPlayerStats { playerId: string; rating: number; streak: number; played: number; won: number; winRate: number | null }
export interface ArenaSeason { id: string; label: string; startedAt: string; endsAt: string; daysRemaining: number }
export interface MyArenaProgress {
  profile: ArenaProfile; missions: ArenaMission[]; rivals: ArenaRival[];
  seasonRank: { rank: number; xp: number; coins: number } | null;
  players: (ArenaPlayerStats & { gamerTag: string })[];
}
export interface ArenaLive {
  playersActiveLastHour: number; matchesAwaitingConfirmation: number; openChallenges: number; season: ArenaSeason;
}

export function myArenaProgress(): Promise<ApiResult<MyArenaProgress>> {
  return request('/api/arena/progress/me', undefined, (r): MyArenaProgress | undefined =>
    r?.profile?.xpPerLevel > 0 && Array.isArray(r?.missions) && Array.isArray(r?.players)
      ? r as MyArenaProgress
      : undefined);
}

export function arenaLive(): Promise<ApiResult<ArenaLive>> {
  return request('/api/arena/live', undefined, (r): ArenaLive | undefined =>
    r?.season?.daysRemaining >= 0 && typeof r?.playersActiveLastHour === 'number'
      ? r as ArenaLive
      : undefined);
}

export function claimArenaMission(key: string): Promise<ApiResult<{ claimed: { xp: number; coins: number }; missions: ArenaMission[]; profile: ArenaProfile }>> {
  return request(`/api/arena/missions/${encodeURIComponent(key)}/claim`, { method: 'POST', body: '{}' }, (r) =>
    r?.claimed && Array.isArray(r?.missions) ? r as { claimed: { xp: number; coins: number }; missions: ArenaMission[]; profile: ArenaProfile } : undefined);
}

export function arenaSeasonLeaderboard(): Promise<ApiResult<{ season: ArenaSeason; rows: { rank: number; userId: string; displayName: string; xp: number; coins: number }[]; you: { rank: number; xp: number; coins: number } | null }>> {
  return request('/api/arena/season/leaderboard', undefined, (r) =>
    Array.isArray(r?.rows) ? r as { season: ArenaSeason; rows: { rank: number; userId: string; displayName: string; xp: number; coins: number }[]; you: { rank: number; xp: number; coins: number } | null } : undefined);
}

// ---------------------------------------------------------------------------
// WHATSAPP SHOP — build on Brief, sell in WhatsApp. The shop row is the
// builder state; the storefront is the WhatsApp conversation itself. The
// share (formatted text + wa.me link) is DERIVED server-side, and publishing
// is gated on a confirmed store-service payment (Pochi la Biashara).
// ---------------------------------------------------------------------------

export interface ShopItem { id: string; name: string; priceKes: number; note: string | null }
export interface Shop {
  id: string | null; ownerId: string; name: string; tagline: string; orderNumber: string;
  items: ShopItem[]; status: 'draft' | 'published'; publishedAt: string | null;
}
export interface ShopStoreService { priceKes: number; active: boolean; activeUntil: string | null }
export interface ShopView {
  shop: Shop;
  store: ShopStoreService;
  share: { text: string; waMe: string; shareable: boolean } | null;
}

export function getMyShop(): Promise<ApiResult<ShopView>> {
  return request('/api/shop/mine', undefined, (r): ShopView | undefined =>
    r?.shop && typeof r?.store?.active === 'boolean' ? r as ShopView : undefined);
}

export function saveMyShop(body: { name: string; tagline: string; orderNumber: string; items: { name: string; priceKes: number; note?: string }[] }): Promise<ApiResult<ShopView>> {
  return request('/api/shop/mine', { method: 'PUT', body: JSON.stringify(body) }, (r): ShopView | undefined =>
    r?.shop?.id ? r as ShopView : undefined);
}

export function publishMyShop(): Promise<ApiResult<ShopView & { changed: boolean }>> {
  return request('/api/shop/mine/publish', { method: 'POST', body: '{}' }, (r): (ShopView & { changed: boolean }) | undefined =>
    r?.shop ? r as ShopView & { changed: boolean } : undefined);
}

export function unpublishMyShop(): Promise<ApiResult<ShopView & { changed: boolean }>> {
  return request('/api/shop/mine/unpublish', { method: 'POST', body: '{}' }, (r): (ShopView & { changed: boolean }) | undefined =>
    r?.shop ? r as ShopView & { changed: boolean } : undefined);
}

// ---------------------------------------------------------------------------
// THE DUKA BOOK + POOLED RESTOCKS + ESCROW RECORDS
//
// The book holds what the shopkeeper LOGS (Brief never claims to see inside
// WhatsApp); every total is derived server-side. Sales carry a clientKey so
// the offline queue can replay them safely. Escrow rows are RECORDS of funds
// held between two sides — Brief moves no money itself.
// ---------------------------------------------------------------------------

export interface ShopSale { id: string; name: string; qty: number; unitKes: number; amountKes: number; channel: string; day: string; createdAt: string; clientKey: string | null }
export interface ShopBook {
  shop: { id: string | null; name: string; status: string };
  today: { sales: number; items: number; kes: number };
  yesterday: { sales: number; items: number; kes: number };
  week: { sales: number; items: number; kes: number };
  topItems: { name: string; qty: number }[];
  items: { name: string; priceKes: number; stockQty: number | null; soldWeek: number; remaining: number | null }[];
  lowStock: { name: string; remaining: number }[];
  recent: ShopSale[];
  note: string;
}
export interface EscrowRow { id: string; kind: 'group_buy' | 'ticket'; refId: string; title: string; role: string; state: 'pending' | 'locked' | 'released' | 'refunded'; amountKes: number; updatedAt: string }
export interface MyEscrows { rows: EscrowRow[]; totals: { heldKes: number; releasedKes: number; heldCount: number }; note: string }

export function getMyBook(): Promise<ApiResult<ShopBook>> {
  return request('/api/shop/mine/book', undefined, (r): ShopBook | undefined =>
    r?.today && Array.isArray(r?.topItems) ? r as ShopBook : undefined);
}

export function logShopSale(body: { name: string; qty: number; unitKes: number; channel?: string; clientKey?: string }): Promise<ApiResult<{ sale: ShopSale; replayed: boolean }>> {
  return request('/api/shop/mine/sales', { method: 'POST', body: JSON.stringify(body) }, (r): { sale: ShopSale; replayed: boolean } | undefined =>
    r?.sale ? r as { sale: ShopSale; replayed: boolean } : undefined);
}

export function poolRestock(body: { itemName: string; unitCostKes: number; goalUnits: number; myUnits: number }): Promise<ApiResult<{ pool: { id: string; title: string; targetAmount: number; total: number; stage: string }; share: { text: string; waMe: string } }>> {
  return request('/api/shop/mine/pool', { method: 'POST', body: JSON.stringify(body) }, (r): { pool: { id: string; title: string; targetAmount: number; total: number; stage: string }; share: { text: string; waMe: string } } | undefined =>
    r?.pool ? r as { pool: { id: string; title: string; targetAmount: number; total: number; stage: string }; share: { text: string; waMe: string } } : undefined);
}

export function getMyEscrows(): Promise<ApiResult<MyEscrows>> {
  return request('/api/escrows/mine', undefined, (r): MyEscrows | undefined =>
    Array.isArray(r?.rows) && r?.totals ? r as MyEscrows : undefined);
}

// ---------------------------------------------------------------------------
// MEMBERS (admin) — the directory for onboarding real people. Derived rows;
// suspension is immediate and audited server-side.
// ---------------------------------------------------------------------------

export interface MemberOnboarding { rung: string | null; latestEvent: string | null; latestAt: string | null; finished: boolean }
export interface MemberRow {
  id: string; handle: string; displayName: string; createdAt: string | null;
  status: 'active' | 'suspended' | string; platformRoles: string[];
  verification: 'approved' | 'pending' | 'none' | string;
  onboarding: MemberOnboarding; shop: { name: string } | null;
}
export interface MembersPage { rows: MemberRow[]; total: number; page: number; pageSize: number }
export interface OnboardingFunnel {
  funnel: Record<string, number>;
  members: MemberRow[];
  totals: { members: number; withAnyEvent: number; finishedOnboarding: number };
  rungs: { id: string; label: string }[];
  note: string;
}

export function listMembers(query = '', page = 0): Promise<ApiResult<MembersPage>> {
  return request(`/api/ops/members?q=${encodeURIComponent(query)}&page=${page}`, undefined, (r): MembersPage | undefined =>
    Array.isArray(r?.rows) && typeof r?.total === 'number' ? r as MembersPage : undefined);
}

export function onboardingFunnel(): Promise<ApiResult<OnboardingFunnel>> {
  return request('/api/ops/onboarding', undefined, (r): OnboardingFunnel | undefined =>
    r?.totals && r?.rungs ? r as OnboardingFunnel : undefined);
}

export function setMemberStatus(id: string, status: 'active' | 'suspended', reason = ''): Promise<ApiResult<{ user: MemberRow; changed: boolean; sessionsRevoked: number }>> {
  return request(`/api/ops/members/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }, (r): { user: MemberRow; changed: boolean; sessionsRevoked: number } | undefined =>
    r?.user ? r as { user: MemberRow; changed: boolean; sessionsRevoked: number } : undefined);
}
