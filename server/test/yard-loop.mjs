// ---------------------------------------------------------------------------
// YARD ENGINE LOOP SMOKE
//
// This is intentionally an HTTP walk, not a domain-only unit test. It proves
// that the new shelves do not stop at a form or a provider error:
// campaign -> funding -> matching -> creator acceptance -> asset kit -> click
// -> attributed registration -> fulfilment -> honest provider block -> retry
// -> settlement, plus an expiration-bounded wait list.
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = '/tmp/brief-yard-loop-http';
process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example';
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const person = await import('../src/domain/person.js');
const providers = await import('../src/providers.js');
const { default: app } = await import('../src/index.js');

store._reset();
const server = app.listen(0);
const port = server.address().port;

const request = async (path, method = 'GET', body, token, options = {}) => {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: options.redirect ?? 'follow'
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* redirect/html */ }
  return { response, body: parsed, text };
};

const expect = (condition, message, detail = '') => {
  if (!condition) throw new Error(`${message}${detail ? `: ${detail}` : ''}`);
};

try {
  const register = async (handle, displayName) => {
    const result = await request('/api/auth/register', 'POST', { handle, password: 'a strong passphrase', displayName });
    expect(result.response.status === 201, `${handle} registration failed`, result.text);
    return result.body.token;
  };

  const advertiserToken = await register('yard_advertiser', 'Yard Advertiser');
  const creatorToken = await register('yard_creator', 'Yard Creator');

  let result = await request('/api/creator/profile', 'GET', undefined, creatorToken);
  expect(result.response.status === 200, 'creator profile unavailable', result.text);
  result = await request('/api/creator/profile', 'PATCH', {
    fullName: 'Yard Creator', regions: ['KE'], nicheTags: ['events'], status: 'active'
  }, creatorToken);
  expect(result.response.status === 200, 'creator profile update failed', result.text);
  result = await request('/api/creator/rate-cards', 'POST', {
    serviceType: 'DEDICATED_CAMPAIGN', basePrice: 1000, currency: 'KES', regions: ['KE'], status: 'published'
  }, creatorToken);
  expect(result.response.status === 201, 'rate card creation failed', result.text);

  // Create the public destination that the ad asset will point to.
  result = await request('/api/campaigns', 'POST', {
    title: 'Yard Showcase', type: 'event', description: 'A public showcase', price: 0, capacity: 10
  }, advertiserToken);
  expect(result.response.status === 201, 'public campaign creation failed', result.text);
  const publicCampaignId = result.body.campaign.id;
  const publicSlug = result.body.campaign.publicSlug;
  result = await request(`/api/campaigns/${publicCampaignId}/publish`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200, 'public campaign publish failed', result.text);

  // Advertiser path: draft -> submitted -> manually attested funding -> matching.
  result = await request('/api/advertising/campaigns', 'POST', {
    title: 'Yard launch', budget: 1000, targetRegions: ['KE'], targetNiches: ['events'],
    requiredServiceType: 'DEDICATED_CAMPAIGN', campaignId: publicCampaignId
  }, advertiserToken);
  expect(result.response.status === 201, 'advertiser campaign creation failed', result.text);
  const adCampaignId = result.body.campaign.id;
  result = await request(`/api/advertising/campaigns/${adCampaignId}/submit`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200, 'advertiser campaign submit failed', result.text);
  result = await request(`/api/advertising/campaigns/${adCampaignId}/confirm-funding`, 'POST', { confirmation: true, reference: 'manual-test-funding' }, advertiserToken);
  expect(result.response.status === 200 && result.body.campaign.status === 'funded', 'funding did not become held', result.text);
  result = await request(`/api/advertising/campaigns/${adCampaignId}/allocate`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200 && result.body.matches.length === 1, 'matching did not allocate one creator', result.text);
  const matchId = result.body.matches[0].id;

  result = await request('/api/advertising/matches/mine', 'GET', undefined, creatorToken);
  expect(result.response.status === 200 && result.body.matches.some((match) => match.id === matchId), 'creator did not receive the match', result.text);
  result = await request(`/api/advertising/matches/${matchId}/accept`, 'POST', {}, creatorToken);
  expect(result.response.status === 200 && result.body.match.status === 'accepted', 'creator acceptance failed', result.text);

  // Asset path: draft -> approved -> issued -> kit. The kit explicitly says
  // personal Status auto-publishing is not claimed.
  result = await request('/api/advertising/assets', 'POST', {
    advertiserCampaignId: adCampaignId,
    creatorId: result.body.match.creatorId,
    targetPlatform: 'WHATSAPP_STATUS',
    baseRedirectUrl: `https://brief.example/c/${publicSlug}`,
    mediaAssetUrl: 'https://cdn.example/yard-banner.jpg',
    optimizedCopyText: 'Join the Yard showcase'
  }, advertiserToken);
  expect(result.response.status === 201, 'asset creation failed', result.text);
  const assetId = result.body.asset.id;
  const trackingHash = result.body.asset.uniqueTrackingHash;
  result = await request(`/api/advertising/assets/${assetId}/approve`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200, 'asset approval failed', result.text);
  result = await request(`/api/advertising/assets/${assetId}/issue`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200, 'asset issue failed', result.text);
  result = await request(`/api/advertising/assets/${assetId}/distribution-kit`, 'GET', undefined, advertiserToken);
  expect(result.response.status === 200 && result.body.kit.available === true, 'distribution kit is not ready', result.text);
  expect(result.body.kit.distributionKits.whatsappStatus.autoPublish === false, 'Status publishing was falsely claimed');

  // The tracked redirect records a click and carries the hash into the public
  // campaign URL so the eventual registration can be attributed.
  result = await request(`/api/public/ad/${trackingHash}`, 'GET', undefined, undefined, { redirect: 'manual' });
  expect(result.response.status === 302, 'tracked redirect did not redirect', result.text);
  expect(result.response.headers.get('location')?.includes(`trackingHash=${trackingHash}`), 'redirect lost tracking hash', result.response.headers.get('location') ?? '');
  result = await request(`/api/public/campaigns/${publicSlug}/register`, 'POST', { attendeeRef: 'yard-attendee', trackingHash }, undefined);
  expect(result.response.status === 201 && result.body.registration.status === 'registered', 'attributed registration failed', result.text);
  expect(result.body.campaign.metrics === undefined, 'public registration leaked private metrics');

  // Fulfilment is an explicit advertiser action. With no payout provider the
  // endpoint terminates in a retryable state, never a fake success.
  result = await request(`/api/advertising/matches/${matchId}/verify-fulfillment`, 'POST', { performanceVerified: true, proofUrl: 'https://proof.example/yard' }, advertiserToken);
  expect(result.response.status === 202 && result.body.settlement.reason === 'provider_unavailable', 'missing payout provider was not explicit', result.text);
  expect(result.body.match.settlementStatus === 'blocked', 'blocked settlement was not persisted', result.text);

  // Register a test provider only to prove the provider seam can complete the
  // final leg. This is test infrastructure, not a production provider.
  const creatorUser = store.find('users', (user) => user.handle === 'yard_creator');
  const creatorPerson = person.personIdForUser(creatorUser.id);
  person.linkAlias(creatorPerson, 'phone', '0722000111', { verified: true, source: 'yard-test' });
  providers.DISBURSEMENT_PROVIDERS.testyard = {
    isPayoutConfigured: () => true,
    status: () => ({ provider: 'testyard', configured: true }),
    disburse: async ({ amount }) => ({ ok: true, providerRef: `YARD-${amount}` })
  };
  result = await request(`/api/advertising/matches/${matchId}/retry-settlement`, 'POST', {}, advertiserToken);
  expect(result.response.status === 200 && result.body.ok === true, 'retry did not settle through provider seam', result.text);
  result = await request(`/api/advertising/campaigns/${adCampaignId}`, 'GET', undefined, advertiserToken);
  expect(result.response.status === 200 && result.body.campaign.status === 'completed', 'advertiser campaign did not complete', result.text);
  expect(result.body.campaign.budgetSummary.paidOut === 950, 'five percent split was not derived', JSON.stringify(result.body.campaign.budgetSummary));
  delete providers.DISBURSEMENT_PROVIDERS.testyard;

  // Waiting-list path: full campaign -> wait list -> cancellation -> sweep ->
  // offer -> acceptance. No dead-end "full" state remains.
  result = await request('/api/campaigns', 'POST', {
    title: 'Yard Full Event', type: 'event', price: 0, capacity: 1
  }, advertiserToken);
  const waitCampaign = result.body.campaign;
  await request(`/api/campaigns/${waitCampaign.id}/publish`, 'POST', {}, advertiserToken);
  await request(`/api/public/campaigns/${waitCampaign.publicSlug}/register`, 'POST', { attendeeRef: 'first-attendee' });
  result = await request(`/api/calendar/campaigns/${waitCampaign.publicSlug}/waitlist`, 'POST', { attendeeRef: 'backup-attendee', name: 'Backup' });
  expect(result.response.status === 201 && result.body.entry.status === 'waiting', 'wait-list join failed', result.text);
  const waitId = result.body.entry.id;
  const firstReg = store.find('registrations', (row) => row.attendeeRef === 'first-attendee');
  await request(`/api/campaigns/${waitCampaign.id}/registrations/${firstReg.id}/status`, 'POST', { status: 'cancelled' }, advertiserToken);
  result = await request('/api/calendar/sweep', 'POST', {}, advertiserToken);
  expect(result.response.status === 200 && result.body.offered >= 1, 'sweep did not offer the next wait-list slot', result.text);
  result = await request(`/api/waitlist/${waitId}/accept`, 'POST', { attendeeRef: 'backup-attendee' });
  expect(result.response.status === 201 && result.body.entry.status === 'registered', 'wait-list offer did not complete', result.text);

  // Vendor syndication path: declare capabilities without allowing a vendor
  // to self-verify its own license or manufacture a rating.
  result = await request('/api/vendors', 'POST', { displayName: 'Yard Logistics', description: 'Transport and print support' }, advertiserToken);
  expect(result.response.status === 201, 'vendor creation failed', result.text);
  const vendorId = result.body.vendor.id;
  result = await request(`/api/vendors/${vendorId}/capabilities`, 'PUT', { services: ['transport', 'printing'], regions: ['KE'], escrowSupported: true }, advertiserToken);
  expect(result.response.status === 200 && result.body.capabilities.escrowSupported === true, 'vendor capabilities failed', result.text);
  result = await request(`/api/vendors/${vendorId}/capabilities`);
  expect(result.response.status === 200 && result.body.capabilities.services.includes('transport'), 'public vendor capabilities failed', result.text);
  expect(result.body.capabilities.isVerifiedLicense === false, 'vendor self-verified a license');

  console.log('Yard Engine HTTP loop: passed');
} finally {
  delete providers.DISBURSEMENT_PROVIDERS.testyard;
  server.close();
}
