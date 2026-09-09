// Work Order payment routes — payer/payee scoped, admin reconciliation.
import * as workPayment from "../domain/workPayment.js";
import * as workOrders from "../domain/workOrders.js";
import { requireAuth, requireCap } from "./helpers.js";
import { requireFeature } from "../features.js";

export function register(app) {
  app.use("/api/work-orders/:id/pay", requireFeature("payments"), requireFeature("work_orders"));
  app.use("/api/work-orders/:id/payments", requireFeature("payments"), requireFeature("work_orders"));
  app.use("/api/me/work-payments", requireFeature("payments"));
  app.use("/api/ops/work-payments", requireFeature("payments"));

  const handle = (fn, status = 200) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me) return;
    if (!req.auth?.userId)
      return res.status(401).json({ error: "Sign in to manage payments", code: "no_token" });
    try {
      res.status(status).json(fn(me, req));
    } catch (e) {
      if (e?.code === "not_found")
        return res.status(404).json({ error: e.message, code: e.code });
      console.error("Work payment operation failed", e);
      res.status(503).json({
        error: "Could not save or load this payment. Retry the same action safely.",
        code: "storage_unavailable",
      });
    }
  };

  // Pay a Work Order. The amount is derived server-side from the accepted
  // agreement; the client supplies only the phone number and an idempotency
  // key. When no provider is configured this returns an honest
  // "Payment unavailable" state rather than a fabricated charge.
  app.post(
    "/api/work-orders/:id/pay",
    async (req, res) => {
      const me = requireAuth(req, res);
      if (!me) return;
      if (!req.auth?.userId) return res.status(401).json({ error: "Sign in to pay", code: "no_token" });
      res.setHeader("Cache-Control", "no-store");
      try {
        const { intent, reused } = workPayment.createIntent({
          workOrderId: req.params.id,
          payerId: me,
          phone: req.body?.phone ?? null,
          idempotencyKey: req.body?.idempotencyKey ?? null,
        });
        if (!workPayment.activeProvider()) {
          return res.status(503).json({
            intent,
            reused,
            charged: false,
            state: workPayment.paymentState(req.params.id),
            ...workPayment.providerStatus(),
          });
        }
        const result = await workPayment.requestPayment(intent.id);
        if (!result.ok) {
          return res.status(502).json({
            intent: workPayment.getIntent(intent.id),
            error: result.reason,
            detail: result.detail ?? null,
          });
        }
        res.status(reused ? 200 : 201).json({
          intent: workPayment.getIntent(intent.id),
          reused,
          charged: true,
          customerMessage: result.customerMessage ?? null,
        });
      } catch (e) {
        res.status(e?.code === "not_found" ? 404 : 400).json({ error: String(e.message ?? e), code: e?.code ?? null });
      }
    },
  );

  // Payment state for a Work Order — payer and payee only.
  app.get(
    "/api/work-orders/:id/payments",
    handle((me, req) => ({
      payments: workPayment.listPaymentsForWorkOrder(me, req.params.id),
      state: workPayment.paymentState(req.params.id),
      breakdown: workPayment.agreementBreakdown(req.params.id),
    })),
  );

  // The caller's own payment history (payer or payee), privacy-scoped.
  app.get(
    "/api/me/work-payments",
    handle((me) => ({ payments: workPayment.listPaymentsForUser(me) })),
  );

  // Minimal operational reconciliation view for authorized administrators.
  app.get(
    "/api/ops/work-payments",
    (req, res) => {
      const me = requireCap(req, res, "moderate");
      if (!me) return;
      res.setHeader("Cache-Control", "no-store");
      res.json({ reconciliation: workPayment.reconcileWorkPayments() });
    },
  );
}
