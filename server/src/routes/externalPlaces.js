import * as places from "../domain/externalPlaces.js";
import { SupplyError } from "../domain/supplyValidation.js";
import { requireAuth } from "./helpers.js";

export function register(app) {
  const fail = (res, e) => {
    if (e instanceof SupplyError)
      return res.status(e.status).json({ error: e.message, code: e.code });
    console.error("External places operation failed", e);
    return res
      .status(503)
      .json({ error: "Could not save or load this record. Please retry.", code: "storage_unavailable" });
  };

  // An explicit search tap, never a render: upstream is slow and flaky, so
  // this runs only when the seeker asks, and answers from cache when it can.
  app.get("/api/places/search", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me || !req.auth?.userId) return;
    try {
      const snapshot = await places.searchPlaces(me, {
        location: req.query.location,
        category: req.query.category,
        limit: req.query.limit,
      });
      return res.status(200).json({ snapshot });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.get("/api/places/map", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me || !req.auth?.userId) return;
    try {
      return res.status(200).json({ places: places.listMapPlaces(me) });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.get("/api/places/price-claims", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me || !req.auth?.userId) return;
    try {
      return res.status(200).json({
        claims: places.listPlacePriceClaims(me, req.query.placeKey),
      });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.post("/api/places/price-claims", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const me = requireAuth(req, res);
    if (!me || !req.auth?.userId) return;
    try {
      return res.status(201).json(places.claimPlacePrice(me, req.body ?? {}));
    } catch (e) {
      return fail(res, e);
    }
  });
}
