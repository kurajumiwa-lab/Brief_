// src/api/types.ts
function asTarget(circle) {
  if (circle.type !== "target") return null;
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
var COPY_ONLY_CHANNELS = ["instagram", "tiktok"];

// src/api/validate.ts
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isStr = (v) => typeof v === "string";
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var isNumOrNull = (v) => v === null || isNum(v);
var isStrOrNull = (v) => v === null || isStr(v);
var isBool = (v) => typeof v === "boolean";
function all(v, guard) {
  if (!Array.isArray(v)) return void 0;
  for (const item of v) if (!guard(item)) return void 0;
  return v;
}
function isCircle(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.name) && isStr(v.type) && isStr(v.status) && isStr(v.visibility) && isNumOrNull(v.targetValue) && isNum(v.currentValue) && isNum(v.contributorCount) && isNum(v.settledCount) && isNum(v.blockCount) && isNum(v.memberCount) && // null is legitimate: a circle with no targetValue has no percentage.
  isNumOrNull(v.progressPct) && isStr(v.createdAt);
}
var areCircles = (v) => all(v, isCircle);
function isEvidenceLike(v) {
  return isObj(v) && isStr(v.kind) && isStr(v.label);
}
function isMember(v) {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.circleId) || !isStr(v.userId) || !isStr(v.role)) return false;
  if (!isStr(v.joinedAt)) return false;
  const t = v.trust;
  if (!isObj(t)) return false;
  if (!Array.isArray(t.evidence) || !t.evidence.every(isEvidenceLike)) return false;
  if (!Array.isArray(t.facts) || !t.facts.every(isEvidenceLike)) return false;
  if (!isNum(t.verifiedCount)) return false;
  if ("score" in t || "trustScore" in v || "reputation" in v) return false;
  return true;
}
var areMembers = (v) => all(v, isMember);
function isBlock(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.circleId) && isStr(v.type) && isStr(v.content) && isStrOrNull(v.objectId) && Array.isArray(v.sources) && isStr(v.createdAt);
}
var areBlocks = (v) => all(v, isBlock);
function isSignal(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.type) && isStrOrNull(v.circleId) && isNumOrNull(v.value) && isStr(v.createdAt);
}
var areSignals = (v) => all(v, isSignal);
function isProviderStatus(v) {
  return isObj(v) && isBool(v.configured) && isStr(v.reason);
}
function isTransaction(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isNum(v.amount) && isStr(v.currency) && isStr(v.type) && isStr(v.status) && isStrOrNull(v.circleId) && isStrOrNull(v.counterparty) && Array.isArray(v.history) && isStr(v.createdAt);
}
var areTransactions = (v) => all(v, isTransaction);
function isWallet(v) {
  if (!isObj(v)) return false;
  return isNum(v.balance) && isNum(v.pending) && isStr(v.currency) && isNum(v.transactionCount) && isProviderStatus(v.provider);
}
function isAuthStatus(v) {
  return isObj(v) && isBool(v.configured) && isStr(v.reason) && isStr(v.method);
}
function isMetrics(v) {
  if (!isObj(v)) return false;
  return isNum(v.views) && isNumOrNull(v.viewers) && isNum(v.shares) && isNum(v.registrations) && isNum(v.checkedIn) && isNum(v.slotsTaken) && isNum(v.revenueSettled) && isNum(v.revenuePending) && isStr(v.currency) && isNumOrNull(v.capacity) && isNumOrNull(v.remaining) && isNumOrNull(v.conversionPct);
}
function isCampaign(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.ownerId) && isStr(v.title) && isStr(v.type) && isStr(v.status) && isStr(v.publicSlug) && isNum(v.price) && isStr(v.currency) && isNumOrNull(v.capacity) && isMetrics(v.metrics);
}
var areCampaigns = (v) => all(v, isCampaign);
function isPublicCampaign(v) {
  if (!isObj(v)) return false;
  if ("ownerId" in v || "id" in v || "objectId" in v || "metrics" in v) return false;
  return isStr(v.slug) && isStr(v.title) && isStr(v.status) && isNum(v.price) && isStr(v.currency) && isNumOrNull(v.remaining);
}
function isRegistration(v) {
  if (!isObj(v)) return false;
  return isStr(v.id) && isStr(v.status) && isStr(v.createdAt);
}
var areRegistrations = (v) => all(v, isRegistration);
function isPaymentConfirmation(v) {
  if (!isObj(v)) return false;
  if (!isRegistration(v.registration) || !isTransaction(v.transaction)) return false;
  if (!isObj(v.analytics)) return false;
  return v.transaction.status === "settled";
}
function isCampaignShare(v) {
  if (!isObj(v)) return false;
  if (!isStr(v.slug)) return false;
  if (v.available === false) return v.reason === "public_origin_not_configured";
  if (v.available !== true) return false;
  if (!isStr(v.url) || !isObj(v.channels)) return false;
  return isStr(v.channels.whatsapp) && isStr(v.channels.telegram) && isStr(v.channels.x);
}
function isAppConfig(v) {
  if (!isObj(v)) return false;
  return (v.publicOrigin === null || isStr(v.publicOrigin)) && isStr(v.campaignPathPrefix);
}

// src/api/briefApi.ts
var INGEST_API = "/ingest";
async function request(path, init, select) {
  try {
    const res = await fetch(`${INGEST_API}${path}`, {
      ...init,
      headers: init?.body !== void 0 ? { "content-type": "application/json", ...init?.headers ?? {} } : init?.headers
    });
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: res.status,
          error: "server returned a non-JSON response"
        };
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parsed && typeof parsed.error === "string" && parsed.error || `request failed with status ${res.status}`
      };
    }
    const data = select ? select(parsed) : parsed;
    if (data === void 0 || data === null) {
      return { ok: false, status: res.status, error: "unexpected response shape" };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: null,
      error: e instanceof Error ? e.message : "network error"
    };
  }
}
function getCircles() {
  return request("/api/circles", void 0, (r) => areCircles(r?.circles));
}
function getCircle(id) {
  return request(`/api/circles/${encodeURIComponent(id)}`, void 0, (r) => {
    if (!isCircle(r?.circle)) return void 0;
    const blocks = areBlocks(r.blocks ?? []);
    const signals = areSignals(r.signals ?? []);
    if (!blocks || !signals) return void 0;
    return { circle: r.circle, blocks, signals };
  });
}
function createCircle(body) {
  return request(
    "/api/circles",
    { method: "POST", body: JSON.stringify(body) },
    (r) => isCircle(r?.circle) ? r.circle : void 0
  );
}
function updateCircle(id, patch) {
  return request(
    `/api/circles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    (r) => isCircle(r?.circle) ? r.circle : void 0
  );
}
async function getTargets() {
  const res = await getCircles();
  if (!res.ok) return res;
  const targets = res.data.map(asTarget).filter((t) => t !== null);
  return { ok: true, data: targets };
}
function getMembers(circleId) {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    void 0,
    (r) => areMembers(r?.members)
  );
}
function joinCircle(circleId, role) {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    { method: "POST", body: JSON.stringify({ role }) },
    (r) => isMember(r?.member) ? r.member : void 0
  );
}
function inviteMember(circleId, userId, role) {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members`,
    { method: "POST", body: JSON.stringify({ userId, role }) },
    (r) => isMember(r?.member) ? r.member : void 0
  );
}
function recordVerification(circleId, userId, kind) {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}/verify`,
    { method: "POST", body: JSON.stringify({ kind }) },
    (r) => isMember(r?.member) ? r.member : void 0
  );
}
function setMemberRole(circleId, userId, role) {
  return request(
    `/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}/role`,
    { method: "PATCH", body: JSON.stringify({ role }) },
    (r) => isMember(r?.member) ? r.member : void 0
  );
}
function getAuthStatus() {
  return request("/api/auth/status", void 0, (r) => isAuthStatus(r) ? r : void 0);
}
function getBlocks(circleId) {
  const q = circleId ? `?circleId=${encodeURIComponent(circleId)}` : "";
  return request(`/api/blocks${q}`, void 0, (r) => areBlocks(r?.blocks));
}
function createBlock(body) {
  return request(
    "/api/blocks",
    { method: "POST", body: JSON.stringify(body) },
    (r) => isBlock(r?.block) ? r.block : void 0
  );
}
function getSignals(opts = {}) {
  const p = new URLSearchParams();
  if (opts.circleId) p.set("circleId", opts.circleId);
  if (opts.limit) p.set("limit", String(opts.limit));
  const q = p.toString();
  return request(`/api/signals${q ? `?${q}` : ""}`, void 0, (r) => areSignals(r?.signals));
}
function getWallet(currency = "KES") {
  return request(
    `/api/economic/wallet?currency=${encodeURIComponent(currency)}`,
    void 0,
    (r) => isWallet(r) ? r : void 0
  );
}
function getTransactions(limit) {
  const q = limit ? `?limit=${limit}` : "";
  return request(`/api/transactions${q}`, void 0, (r) => {
    const transactions = areTransactions(r?.transactions);
    if (!transactions || !isProviderStatus(r?.provider)) return void 0;
    return { transactions, provider: r.provider };
  });
}
function createTransaction(body) {
  return request(
    "/api/transactions",
    { method: "POST", body: JSON.stringify(body) },
    (r) => isTransaction(r?.transaction) ? r.transaction : void 0
  );
}
function requestTransactionTransition(id, status, note) {
  return request(
    `/api/transactions/${encodeURIComponent(id)}/transition`,
    { method: "POST", body: JSON.stringify({ status, note }) },
    (r) => isTransaction(r?.transaction) ? r.transaction : void 0
  );
}
function getDisbursements() {
  return {
    available: false,
    reason: "Disbursements are not implemented. No payment provider is connected, so Brief cannot pay anyone out and does not record disbursement state."
  };
}
function getCampaigns() {
  return request("/api/campaigns", void 0, (r) => areCampaigns(r?.campaigns));
}
function getCampaign(id) {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}`,
    void 0,
    (r) => isCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function createCampaign(body) {
  return request(
    "/api/campaigns",
    { method: "POST", body: JSON.stringify(body) },
    (r) => isCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function updateCampaign(id, patch) {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    (r) => isCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function campaignAction(id, action) {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: JSON.stringify({}) },
    (r) => isCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function getCampaignRegistrations(id) {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/registrations`,
    void 0,
    (r) => areRegistrations(r?.registrations)
  );
}
function confirmRegistrationPayment(campaignId, registrationId) {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/registrations/${encodeURIComponent(registrationId)}/confirm-payment`,
    { method: "POST", body: JSON.stringify({}) },
    (r) => isPaymentConfirmation(r) ? r : void 0
  );
}
function setRegistrationStatus(campaignId, registrationId, status) {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/registrations/${encodeURIComponent(registrationId)}/status`,
    { method: "POST", body: JSON.stringify({ status }) },
    (r) => isRegistration(r?.registration) ? r.registration : void 0
  );
}
function getPublicCampaign(slug) {
  return request(
    `/api/public/campaigns/${encodeURIComponent(slug)}`,
    void 0,
    (r) => isPublicCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function registerForCampaign(slug, body) {
  return request(
    `/api/public/campaigns/${encodeURIComponent(slug)}/register`,
    { method: "POST", body: JSON.stringify(body) },
    (r) => isRegistration(r?.registration) && isPublicCampaign(r?.campaign) ? { registration: r.registration, campaign: r.campaign } : void 0
  );
}
function getConfig() {
  return request("/api/config", void 0, (r) => isAppConfig(r) ? r : void 0);
}
function campaignShareLink(slug, publicOrigin) {
  if (!publicOrigin) {
    return { available: false, reason: "public_origin_not_configured", slug };
  }
  return {
    available: true,
    url: `${publicOrigin.replace(/\/+$/, "")}/c/${slug}`,
    slug
  };
}
function getCampaignShare(id) {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/share`,
    void 0,
    (r) => isCampaignShare(r?.share) ? r.share : void 0
  );
}
function campaignShareChannels(url, title) {
  const enc = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${enc}&text=${text}`,
    x: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`
  };
}
function shareCampaign(id, channel = "link") {
  return request(
    `/api/campaigns/${encodeURIComponent(id)}/share`,
    { method: "POST", body: JSON.stringify({ channel }) },
    (r) => isCampaign(r?.campaign) ? r.campaign : void 0
  );
}
function getObject(id) {
  return request(
    `/api/objects/${encodeURIComponent(id)}`,
    void 0,
    (r) => r && typeof r.object === "object" && r.object !== null ? r.object : void 0
  );
}
function getObjects(publication) {
  const q = publication ? `?publication=${encodeURIComponent(publication)}` : "";
  return request(
    `/api/objects${q}`,
    void 0,
    (r) => Array.isArray(r?.objects) ? r.objects : void 0
  );
}
export {
  COPY_ONLY_CHANNELS,
  INGEST_API,
  campaignAction,
  campaignShareChannels,
  campaignShareLink,
  confirmRegistrationPayment,
  createBlock,
  createCampaign,
  createCircle,
  createTransaction,
  getAuthStatus,
  getBlocks,
  getCampaign,
  getCampaignRegistrations,
  getCampaignShare,
  getCampaigns,
  getCircle,
  getCircles,
  getConfig,
  getDisbursements,
  getMembers,
  getObject,
  getObjects,
  getPublicCampaign,
  getSignals,
  getTargets,
  getTransactions,
  getWallet,
  inviteMember,
  joinCircle,
  recordVerification,
  registerForCampaign,
  requestTransactionTransition,
  setMemberRole,
  setRegistrationStatus,
  shareCampaign,
  updateCampaign,
  updateCircle
};
