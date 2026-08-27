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
  isTeaArticle, areTeaArticles
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
  try {
    const token = getSessionToken();
    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string> | undefined) ?? {})
    };
    if (init?.body !== undefined) headers['content-type'] = 'application/json';
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
    // Network failure, offline server, aborted request.
    return {
      ok: false,
      status: null,
      error: e instanceof Error ? e.message : 'network error'
    };
  }
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
  body: { attendeeRef: string; name?: string; contact?: string; trackingHash?: string }
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
