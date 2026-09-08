import * as work from "../domain/workOrders.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { requireAuth } from "./helpers.js";
import { requireFeature } from "../features.js";
export function register(app) {
  app.use(
    [
      "/api/work-orders",
      "/api/requests/:id/work-orders",
      "/api/request-quotes/:id/work-order",
      "/api/supply/work-orders",
    ],
    requireFeature("work_orders"),
    requireFeature("requests"),
    requireFeature("supply"),
  );
  const handle = (fn) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const user = requireAuth(req, res);
    if (!user) return;
    if (!req.auth?.userId)
      return res
        .status(401)
        .json({ error: "Sign in to manage work", code: "no_token" });
    try {
      res.json(fn(user, req));
    } catch (e) {
      if (e instanceof SupplyError)
        return res.status(e.status).json({ error: e.message, code: e.code });
      console.error("Work operation failed", e);
      res
        .status(503)
        .json({
          error: "Could not save or load work. Retry the same action safely.",
          code: "storage_unavailable",
        });
    }
  };
  app.get(
    "/api/work-orders/:id",
    handle((u, r) => ({ workOrder: work.get(u, r.params.id) })),
  );
  app.get(
    "/api/requests/:id/work-orders",
    handle((u, r) => work.forRequest(u, r.params.id)),
  );
  app.get(
    "/api/supply/work-orders",
    handle((u) => work.forParticipant(u)),
  );
  app.post(
    "/api/request-quotes/:id/work-order",
    handle((u, r) => ({ workOrder: work.createFromAccepted(u, r.params.id) })),
  );
  app.post(
    "/api/work-orders/:id/actions",
    handle((u, r) => ({ workOrder: work.mutate(u, r.params.id, r.body) })),
  );
}
