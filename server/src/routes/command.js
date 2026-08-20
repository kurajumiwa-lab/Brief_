// COMMAND ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { callerId } from '../identity.js';
import * as command from '../domain/command.js';
import { requireAuth } from './helpers.js';

export function register(app) {
/**
 * The host command centre: NOW / MONEY / PEOPLE / DISTRIBUTION / ACTION / NEXT,
 * derived from real rows. Host-only, and scoped to the caller's own campaigns
 * and vaults — a host never sees another host's figures.
 */

app.get('/api/host/command', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ command: command.commandCentre(me) });
});
}

