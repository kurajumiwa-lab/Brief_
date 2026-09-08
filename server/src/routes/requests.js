import { SupplyError } from "../domain/supplyValidation.js";
import * as requests from "../domain/requests.js";
import { requireAuth } from "./helpers.js";
import { requireFeature } from "../features.js";

export function register(app) {
  app.use(["/api/requests", "/api/me/requests"], requireFeature("requests"));
  const handle =
    (fn, status = 200) =>
    (req, res) => {
      const me = requireAuth(req, res);
      if (!me) return;
      // Private economic demand requires a verified session even in dev mode.
      if (!req.auth?.userId)
        return res
          .status(401)
          .json({ error: "Sign in to use Requests", code: "no_token" });
      res.setHeader("Cache-Control", "no-store");
      try {
        res.status(status).json(fn(me, req));
      } catch (e) {
        if (!(e instanceof requests.RequestError) && !(e instanceof SupplyError)) {
          console.error("Request persistence failed", e);
          return res
            .status(503)
            .json({
              error: "Request could not be saved or loaded. Please retry.",
              code: "storage_unavailable",
            });
        }
        res.status(e.status).json({ error: e.message, code: e.code });
      }
    };
  app.get(
    "/api/me/requests",
    handle((me) => ({ requests: requests.listRequests(me) })),
  );
  app.post(
    "/api/requests",
    handle(
      (me, req) => ({ request: requests.createRequest(me, req.body) }),
      201,
    ),
  );
  // Reads are owner-scoped even for a future public visibility preference.
  // Public distribution will need a separate, privacy-safe projection.
  app.get(
    "/api/requests/:id",
    handle((me, req) => ({ request: requests.getRequest(me, req.params.id) })),
  );
  app.patch(
    "/api/requests/:id",
    handle((me, req) => ({
      request: requests.updateRequest(me, req.params.id, req.body),
    })),
  );
  app.patch(
    "/api/requests/:id/status",
    handle((me, req) => ({
      request: requests.changeRequestStatus(me, req.params.id, req.body),
    })),
  );
}
