import * as matching from "../domain/matching.js";
import * as requests from "../domain/requests.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { requireAuth } from "./helpers.js";
import { requireFeature } from "../features.js";
export function register(app) {
  app.use(
    [
      "/api/requests/:id/matches",
      "/api/matches",
      "/api/supply/relevant-requests",
    ],
    requireFeature("request_matching"),
    requireFeature("supply"),
  );
  const handle = (fn) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me) return;
    if (!req.auth?.userId)
      return res
        .status(401)
        .json({ error: "Sign in to use matching", code: "no_token" });
    try {
      res.json(fn(me, req));
    } catch (e) {
      if (e instanceof SupplyError || e instanceof requests.RequestError)
        return res.status(e.status).json({ error: e.message, code: e.code });
      console.error("Matching operation failed", e);
      res
        .status(503)
        .json({
          error: "Could not save or load matches. Please retry.",
          code: "storage_unavailable",
        });
    }
  };
  app.get(
    "/api/requests/:id/matches",
    handle((me, r) => matching.list(me, r.params.id, r.query)),
  );
  app.post(
    "/api/requests/:id/matches",
    handle((me, r) => matching.generate(me, r.params.id, r.body)),
  );
  app.get(
    "/api/matches/:id",
    handle((me, r) => ({ match: matching.get(me, r.params.id) })),
  );
  app.patch(
    "/api/matches/:id",
    handle((me, r) => ({ match: matching.act(me, r.params.id, r.body) })),
  );
  app.get(
    "/api/supply/relevant-requests",
    handle((me) => matching.relevantRequests(me)),
  );
  app.post(
    "/api/matches/:id/interest",
    handle((me, r) => ({
      request: matching.expressInterest(me, r.params.id, r.body),
    })),
  );
  app.delete(
    "/api/matches/:id/interest",
    handle((me, r) => matching.withdrawInterest(me, r.params.id, r.body)),
  );
}
