import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as api from "../../api/briefApi";

// ---------------------------------------------------------------------------
// VENDOR + DIRECTORY MAP — pins for real rows with real coordinates, and
// nothing else.
//
// Deliberately NOT the "red to green" game: there are no red unknowns (we
// do not know what is in an unwalked area, so we draw nothing there), no
// zone totals (no denominator exists to complete), no heatmap (no density
// truth), no live couriers (no GPS feed), and no ranks or revenue (refused
// outright). A blank patch of map is an honest statement: unwalked.
//
// Tiles: CARTO basemaps (free, no key). Pins: the scout's own leads that
// carry coordinates, plus cached directory places that do.
// ---------------------------------------------------------------------------

const STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const LEAD_COLORS = {
  captured: "#F59E0B",
  validated: "#2F8F68",
  claimed: "#2563EB",
};
const PLACE_COLOR = "#0E1B2A";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function VendorLeadMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [counts, setCounts] = useState({ leads: 0, places: 0 });

  useEffect(() => {
    let live = true;
    let map: maplibregl.Map | null = null;
    (async () => {
      const [lr, pr] = await Promise.all([api.listVendorLeads(), api.listMapPlaces()]);
      if (!live || !hostRef.current) return;
      if (!lr.ok || !pr.ok) {
        setStatus("error");
        return;
      }
      const leads = (lr.data.leads ?? []).filter(
        (l) => typeof l.lat === "number" && typeof l.lon === "number" && l.status !== "dropped",
      );
      const places = (pr.data.places ?? []).filter(
        (p) => typeof p.lat === "number" && typeof p.lon === "number",
      );
      setCounts({ leads: leads.length, places: places.length });
      try {
        map = new maplibregl.Map({
          container: hostRef.current,
          style: STYLE,
          center: [36.8172, -1.2864],
          zoom: 11,
        });
      } catch {
        setStatus("error");
        return;
      }
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", () => {
        if (live) setStatus("error");
      });
      map.on("load", () => {
        if (!live || !map) return;
        const m = map;
        m.addSource("leads", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: leads.map((l) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [l.lon as number, l.lat as number] },
              properties: {
                name: l.name,
                detail: `${l.category} · ${l.contact} · ${l.status}`,
              },
            })),
          },
        } as any);
        m.addLayer({
          id: "lead-pins",
          type: "circle",
          source: "leads",
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "match",
              ["get", "status"],
              "validated",
              LEAD_COLORS.validated,
              "claimed",
              LEAD_COLORS.claimed,
              LEAD_COLORS.captured,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        m.addSource("places", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: places.map((p) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lon, p.lat] },
              properties: {
                name: p.name,
                detail: `${p.category || "place"} · ${p.claimCount === 0 ? "no claimed prices" : `${p.claimCount} claimed price${p.claimCount === 1 ? "" : "s"}`}`,
              },
            })),
          },
        } as any);
        m.addLayer({
          id: "place-pins",
          type: "circle",
          source: "places",
          paint: {
            "circle-radius": 7,
            "circle-color": PLACE_COLOR,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        const showPopup = (e: any) => {
          const f = e.features?.[0];
          if (!f) return;
          const coords = (f.geometry as any).coordinates as [number, number];
          new maplibregl.Popup({ closeButton: false })
            .setLngLat(coords)
            .setHTML(
              `<strong>${esc(String(f.properties?.name ?? ""))}</strong><br/>${esc(String(f.properties?.detail ?? ""))}`,
            )
            .addTo(m);
        };
        m.on("click", "lead-pins", showPopup);
        m.on("click", "place-pins", showPopup);
        m.on("mouseenter", "lead-pins", () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseenter", "place-pins", () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", "lead-pins", () => { m.getCanvas().style.cursor = ""; });
        m.on("mouseleave", "place-pins", () => { m.getCanvas().style.cursor = ""; });
        setStatus("ready");
      });
    })();
    return () => {
      live = false;
      try {
        map?.remove();
      } catch {
        /* already gone */
      }
    };
  }, []);

  if (status === "error") {
    return (
      <section className="request-panel">
        <h2>Map unavailable</h2>
        <p role="alert">The map or its rows could not be read. Nothing is drawn in their place.</p>
      </section>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        ref={hostRef}
        style={{ width: "100%", height: 420, borderRadius: 16, overflow: "hidden", background: "var(--color-well)" }}
        aria-label="Vendor and directory map"
      />
      <p className="request-hint" style={{ margin: 0 }}>
        {status === "loading"
          ? "Reading pinned rows…"
          : `${counts.leads} lead${counts.leads === 1 ? "" : "s"} · ${counts.places} directory places. Only rows with coordinates appear — blank areas are unwalked, not empty.`}
      </p>
      <p style={{ margin: 0, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          ["Captured lead", LEAD_COLORS.captured],
          ["Validated lead", LEAD_COLORS.validated],
          ["Claimed lead", LEAD_COLORS.claimed],
          ["Directory place", PLACE_COLOR],
        ].map(([label, color]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </p>
    </div>
  );
}

export default VendorLeadMap;
