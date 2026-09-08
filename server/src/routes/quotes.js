import * as quotes from "../domain/quotes.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { RequestError } from "../domain/requests.js";
import { requireAuth } from "./helpers.js";
import { requireFeature } from "../features.js";
export function register(app) {
  app.use(
    [
      "/api/requests/:id/quotes",
      "/api/matches/:id/quote-request",
      "/api/quote-requests",
      "/api/request-quotes",
      "/api/supply/quotes",
    ],
    requireFeature("requests"),
    requireFeature("supply"),
    requireFeature("request_quotes"),
  );
  const handle = (fn) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const user = requireAuth(req, res);
    if (!user) return;
    if (!req.auth?.userId)
      return res
        .status(401)
        .json({ error: "Sign in to manage quotes", code: "no_token" });
    try {
      res.json(fn(user, req));
    } catch (e) {
      if (e instanceof SupplyError || e instanceof RequestError)
        return res.status(e.status).json({ error: e.message, code: e.code });
      console.error("Commercial operation failed", e);
      res
        .status(503)
        .json({
          error: "Could not load or save the commercial record. Retry safely.",
          code: "storage_unavailable",
        });
    }
  };
  app.post(
    "/api/matches/:id/quote-request",
    handle((u, r) => ({
      invitation: quotes.requestQuote(u, r.params.id, r.body),
    })),
  );
  app.get(
    "/api/requests/:id/quotes",
    handle((u, r) => quotes.listForRequest(u, r.params.id)),
  );
  app.get(
    "/api/supply/quotes",
    handle((u) => quotes.workspace(u)),
  );
  app.post(
    "/api/quote-requests/:id/quote",
    handle((u, r) => ({ quote: quotes.start(u, r.params.id, r.body) })),
  );
  app.get(
    "/api/request-quotes/:id",
    handle((u, r) => ({ quote: quotes.get(u, r.params.id) })),
  );
  app.post(
    "/api/request-quotes/:id/actions",
    handle((u, r) => ({ quote: quotes.mutate(u, r.params.id, r.body) })),
  );
}
