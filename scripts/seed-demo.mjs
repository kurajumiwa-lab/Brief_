#!/usr/bin/env node
// ---------------------------------------------------------------------------
// TEMPORARY DEMO SEED
//
// This is a release-testing aid, not product content. It calls the same
// server-side seed service as the authenticated in-process /api/ops/seed route
// so the CLI and the running app cannot drift apart.
//
// The cohort gets a seven-day expiry window from the moment it is first seeded.
// After that window the public objects, campaigns, listings, stories and
// collections are withdrawn/expired; the seed marker remains so a later boot
// cannot silently resurrect them. Use --clear for an explicit reset.
// ---------------------------------------------------------------------------

import { runSeed, clearSeed } from '../server/src/domain/seed.js';

const result = process.argv.includes('--clear') ? clearSeed() : runSeed();
console.log(process.argv.includes('--clear') ? 'Demo seed cleared:' : 'Demo seed status:');
for (const [key, value] of Object.entries(result)) {
  if (value !== undefined) console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
}
