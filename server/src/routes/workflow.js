// WORKFLOW ROUTES — the automation engine (CCS §3.1).
import { callerId } from '../identity.js';
import * as workflow from '../domain/workflow.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/workflows', requireFeature('workflows'));

  /** The creator's workflows + what has fired. */
  app.get('/api/workflows', (req, res) => {
    const me = callerId(req);
    res.json({
      workflows: workflow.listWorkflows({ ownerId: me ?? undefined }),
      runs: workflow.listRuns({ limit: Number(req.query.runs) || 50 }),
      stats: workflow.runStats()
    });
  });

  app.post('/api/workflows', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({ workflow: workflow.createWorkflow({ ...req.body, ownerId: me }) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.patch('/api/workflows/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ workflow: workflow.updateWorkflow(req.params.id, req.body ?? {}) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  /** Manually trigger a sweep (idempotent). */
  app.post('/api/workflows/sweep', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const result = await workflow.sweep();
    res.json(result);
  });
}
