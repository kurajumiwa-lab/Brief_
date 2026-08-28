// ---------------------------------------------------------------------------
// ROUTE AUTHORIZATION AUDIT
//
//   node scripts/audit-routes.mjs
//
// Answers one question: which mutating routes carry NO authorization check of
// their own? It reads every route module and reports the ones whose handler
// body contains no guard at all -- no requireAuth, no ownership check, no
// signed-webhook verification.
//
// This is a TRIAGE tool, not a verdict. A route on the list is not
// automatically a defect:
//
//   * /api/auth/* and /api/public/* are meant to be reachable without a
//     session.
//   * webhooks prove themselves with an HMAC over the raw body.
//   * many routes delegate to a domain-level ownership check and answer 403 or
//     404 to a stranger, which is closed even though this scan cannot see it.
//
// What it is for is catching the third kind: a route that writes a row with no
// actor behind it. That is how POST /api/campaigns, POST /api/transactions and
// POST /api/transactions/:id/transition were found -- each accepted an
// anonymous caller and stored a row whose owner was null.
//
// Read the output, then read the route.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'server', 'src', 'routes');

// Anything that looks like a proof of who the caller is, or of their right to
// the specific row they named.
const GUARD = /requireAuth|authMiddleware|ownedCampaign|owned[A-Z]|requireOps|requireRole|requireMember|requireAdmin|isCoordinator|canGovernObject|vaultActor|vaultTokenParticipant|internalSecret|verifySignature|verifyInitData|verifySubscription|resolveHandoff|webhookSecret|requireFeature\(/;

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const mutating = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = src.split('\n');
  const re = /app\.(post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    const start = src.slice(0, m.index).split('\n').length - 1;
    // Collect the handler body by counting parentheses until they balance.
    let depth = 0;
    let body = '';
    for (let i = start; i < lines.length; i++) {
      body += lines[i] + '\n';
      depth += (lines[i].match(/\(/g) ?? []).length - (lines[i].match(/\)/g) ?? []).length;
      if (i > start && depth <= 0) break;
    }
    mutating.push({
      file: f,
      method: m[1].toUpperCase(),
      route: m[2],
      line: start + 1,
      guarded: GUARD.test(body)
    });
  }
}

const flagged = mutating.filter((x) => !x.guarded);

console.log(`mutating routes scanned: ${mutating.length}`);
console.log(`with no guard visible in the handler: ${flagged.length}\n`);
for (const r of flagged) {
  console.log(`  ${r.method.padEnd(6)} ${r.route.padEnd(52)} ${r.file}:${r.line}`);
}
console.log('\nTriage each one: public by design, signed webhook, delegated');
console.log('ownership check (403/404), or a write with no actor behind it.');
