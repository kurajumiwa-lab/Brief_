// Participant trust routes — public, privacy-safe aggregates derived from
// canonical economic records. No customer identities, prices or evidence ever
// cross this boundary.
import * as trust from "../domain/participantTrust.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { requireFeature } from "../features.js";

export function register(app) {
  app.use("/api/public/enterprises/:id/trust", requireFeature("participant_trust"));
  const handle =
    (fn) =>
    (req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      try {
        res.json(fn(req));
      } catch (e) {
        if (e instanceof SupplyError)
          return res.status(e.status).json({ error: e.message, code: e.code });
        // A participant with no public visibility has no public trust profile.
        if (e?.code === "not_found")
          return res.status(404).json({ error: e.message, code: e.code });
        console.error("Trust read failed", e);
        res.status(503).json({
          error: "Trust information could not be read. Please retry.",
          code: "storage_unavailable",
        });
      }
    };

  // Full public trust profile (§2): verification + economic history + signals.
  app.get(
    "/api/public/enterprises/:id/trust",
    handle((req) => ({ trust: trust.trustProfile(req.params.id) })),
  );

  // Capability-scoped trust (§11): verification + history + signals for ONE
  // capability, so a strong packaging record is never blurred into logistics.
  app.get(
    "/api/public/enterprises/:id/capabilities/:capabilityId/trust",
    handle((req) => ({
      trust: trust.capabilityTrust(req.params.id, req.params.capabilityId),
    })),
  );
}
