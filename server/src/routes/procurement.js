// Repeat procurement routes — private business memory, owner-scoped.
import * as procurement from "../domain/procurement.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { requireAuth } from "./helpers.js";
import { requireFeature } from "../features.js";

export function register(app) {
  app.use("/api/me/procurement", requireFeature("repeat_procurement"));
  const handle = (fn, status = 200) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me) return;
    if (!req.auth?.userId)
      return res
        .status(401)
        .json({ error: "Sign in to view your procurement history", code: "no_token" });
    try {
      res.status(status).json(fn(me, req));
    } catch (e) {
      if (e instanceof SupplyError)
        return res.status(e.status).json({ error: e.message, code: e.code });
      if (e && (e.code === "not_found" || e.code === "validation_error" || e.code === "invalid_transition"))
        return res.status(e.status ?? 400).json({ error: e.message, code: e.code });
      console.error("Procurement operation failed", e);
      res.status(503).json({
        error: "Procurement history could not be read or updated. Please retry.",
        code: "storage_unavailable",
      });
    }
  };

  // Procurement memory / dashboard (§4, §13).
  app.get(
    "/api/me/procurement",
    handle((me) => ({ procurements: procurement.list(me) })),
  );
  app.get(
    "/api/me/procurement/:id",
    handle((me, req) => ({
      procurement: procurement.get(me, req.params.id),
      prefill: procurement.prefill(me, req.params.id),
    })),
  );

  // The repeat action (§3, §6): creates a NEW Request from the memory.
  app.post(
    "/api/me/procurement/:id/repeat",
    handle(
      (me, req) => procurement.repeat(me, req.params.id, req.body ?? {}),
      201,
    ),
  );

  // A completed Work Order exposes its reusable memory (§2, §3).
  app.get(
    "/api/work-orders/:id/procurement",
    handle((me, req) => ({
      procurement: procurement.forWorkOrder(me, req.params.id),
    })),
  );
}
