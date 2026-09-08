import * as supply from "../domain/supply.js";
import * as verification from "../domain/supplyVerification.js";
import * as links from "../domain/requestParticipants.js";
import { RequestError } from "../domain/requests.js";
import { requireAuth, requireCap } from "./helpers.js";
import { requireFeature } from "../features.js";
export function register(app) {
  app.use(
    [
      "/api/enterprises",
      "/api/me/enterprise",
      "/api/public/enterprises",
      "/api/public/capabilities",
      "/api/capabilities/search",
      "/api/supply",
      "/api/ops/supply-verification",
      "/api/requests/:id/participants",
    ],
    requireFeature("supply"),
  );
  const handle =
    (fn, { publicRead = false, reviewer = false, status = 200 } = {}) =>
    (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const me = publicRead
        ? null
        : reviewer
          ? requireCap(req, res, "moderate")
          : requireAuth(req, res);
      if (!publicRead && (!me || !req.auth?.userId)) {
        if (!res.headersSent)
          res
            .status(401)
            .json({
              error: "Sign in to use the supply network",
              code: "no_token",
            });
        return;
      }
      try {
        res.status(status).json(fn(me, req));
      } catch (e) {
        if (e instanceof supply.SupplyError || e instanceof RequestError)
          return res.status(e.status).json({ error: e.message, code: e.code });
        console.error("Supply operation failed", e);
        res
          .status(503)
          .json({
            error: "Could not save or load this record. Please retry.",
            code: "storage_unavailable",
          });
      }
    };
  app.get(
    "/api/me/enterprise",
    handle((me) => ({ enterprise: supply.myEnterprise(me) })),
  );
  app.post(
    "/api/enterprises",
    handle((me, r) => ({ enterprise: supply.createEnterprise(me, r.body) }), {
      status: 201,
    }),
  );
  app.get(
    "/api/enterprises/:id",
    handle((me, r) => ({ enterprise: supply.getEnterprise(me, r.params.id) })),
  );
  app.patch(
    "/api/enterprises/:id",
    handle((me, r) => ({
      enterprise: supply.updateEnterprise(me, r.params.id, r.body),
    })),
  );
  app.get(
    "/api/public/enterprises/:id",
    handle(
      (_, r) => ({ enterprise: supply.getEnterprise(null, r.params.id) }),
      { publicRead: true },
    ),
  );
  app.get(
    "/api/public/capabilities/:id",
    handle(
      (_, r) => ({ capability: supply.getCapability(null, r.params.id) }),
      { publicRead: true },
    ),
  );
  app.get(
    "/api/enterprises/:id/capabilities",
    handle((me, r) => ({
      capabilities: supply.listCapabilities(me, r.params.id),
    })),
  );
  app.post(
    "/api/enterprises/:id/capabilities",
    handle(
      (me, r) => ({
        capability: supply.createCapability(me, r.params.id, r.body),
      }),
      { status: 201 },
    ),
  );
  app.get(
    "/api/supply/capabilities/:id",
    handle((me, r) => ({ capability: supply.getCapability(me, r.params.id) })),
  );
  app.patch(
    "/api/supply/capabilities/:id",
    handle((me, r) => ({
      capability: supply.updateCapability(me, r.params.id, r.body),
    })),
  );
  app.delete(
    "/api/supply/capabilities/:id",
    handle((me, r) => ({
      capability: supply.updateCapability(me, r.params.id, {
        ...r.body,
        operatingStatus: "archived",
      }),
    })),
  );
  app.get(
    "/api/enterprises/:id/sourcing",
    handle((me, r) => ({
      sourcingProfile: supply.getEnterprise(me, r.params.id).sourcingProfile,
    })),
  );
  app.put(
    "/api/enterprises/:id/sourcing",
    handle((me, r) => ({
      enterprise: supply.saveSourcing(me, r.params.id, r.body),
    })),
  );
  app.get(
    "/api/capabilities/search",
    handle((me, r) => supply.searchCapabilities(me, r.query)),
  );
  app.get(
    "/api/enterprises/:id/verification",
    handle((me, r) => ({ records: verification.myRecords(me, r.params.id) })),
  );
  app.post(
    "/api/enterprises/:id/verification",
    handle(
      (me, r) => ({ record: verification.submit(me, r.params.id, r.body) }),
      { status: 201 },
    ),
  );
  app.get(
    "/api/ops/supply-verification",
    handle((me) => ({ records: verification.queue(me) }), { reviewer: true }),
  );
  app.get(
    "/api/ops/supply-verification/:id",
    handle((me, r) => ({ record: verification.record(me, r.params.id) }), {
      reviewer: true,
    }),
  );
  app.patch(
    "/api/ops/supply-verification/:id",
    handle(
      (me, r) => ({ record: verification.review(me, r.params.id, r.body) }),
      { reviewer: true },
    ),
  );
  app.get(
    "/api/requests/:id/participants",
    handle((me, r) => ({ participants: links.list(me, r.params.id) })),
  );
  app.post(
    "/api/requests/:id/participants",
    handle((me, r) => ({ participant: links.add(me, r.params.id, r.body) }), {
      status: 201,
    }),
  );
  app.delete(
    "/api/requests/:id/participants/:linkId",
    handle((me, r) => links.remove(me, r.params.id, r.params.linkId, r.body)),
  );
}
