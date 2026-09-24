import * as admissions from '../domain/groupAdmissions.js';
import * as workspaces from '../domain/groupWorkspaces.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/group-workspaces', requireFeature('circles'));
  app.use('/api/groups/:groupId/workspaces', requireFeature('circles'));
  const handle = fn => (req, res) => {
    const me = requireAuth(req, res); if (!me) return;
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(fn(req, me)); } catch (e) { res.status(e.status ?? 400).json({ error: e.message }); }
  };
  app.post('/api/groups/:groupId/admission', handle((req, me) => admissions.request(req.params.groupId, me)));
  app.get('/api/groups/:groupId/admission', handle((req, me) => ({ requests: admissions.list(req.params.groupId, me) })));
  app.post('/api/groups/:groupId/admission/decide', handle((req, me) => admissions.decide(req.params.groupId, me, req.body ?? {})));
  app.get('/api/groups/:groupId/workspaces', handle((req, me) => workspaces.list(req.params.groupId, me)));
  app.post('/api/groups/:groupId/workspaces', handle((req, me) => ({ workspace: workspaces.create(req.params.groupId, me, req.body ?? {}) })));
  app.get('/api/group-workspaces/:id', handle((req, me) => ({ workspace: workspaces.read(req.params.id, me) })));
  app.patch('/api/group-workspaces/:id/setup', handle((req, me) => ({ workspace: workspaces.configure(req.params.id, me, req.body ?? {}) })));
  app.post('/api/group-workspaces/:id/activate', handle((req, me) => ({ workspace: workspaces.activate(req.params.id, me) })));
  app.post('/api/group-workspaces/:id/participation', handle((req, me) => ({ workspace: workspaces.requestParticipation(req.params.id, me) })));
  app.post('/api/group-workspaces/:id/participation/decide', handle((req, me) => ({ workspace: workspaces.decideParticipation(req.params.id, me, req.body ?? {}) })));
  app.post('/api/group-workspaces/:id/actions', handle((req, me) => ({ workspace: workspaces.action(req.params.id, me, req.body ?? {}) })));
}
