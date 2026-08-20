import React from 'react';
import type { BriefObject } from '../App';

// ---------------------------------------------------------------------------
// NEARBY MAP — a relative map of real coordinates.
//
// This is NOT a street map: it projects each located object's real lat/lng
// onto a north-up plane centred on the viewer's position (equirectangular
// approximation — accurate to within ~1% at city scale). Every dot is a real
// coordinate the object carries; distance and bearing fall out of the same
// projection, so position and distance can never disagree.
//
// It is deliberately self-contained (no tile service, no network): coarse
// neighbourhood coordinates have no business being pinned to a street grid,
// and a relative map says the true thing — "these are around you, roughly
// here" — without pretending to be navigation.
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface NearbyMapProps {
  objects: BriefObject[];
  center: GeoPoint | null;
  onSelect: (o: BriefObject) => void;
  onLocate: () => void;
  locating: boolean;
  onClearLocation: () => void;
  onSelectCity: (c: GeoPoint) => void;
}

interface PlotPoint {
  obj: BriefObject;
  xKm: number; // east of centre
  yKm: number; // north of centre
  distKm: number;
}

// Earth radius in km; planar projection for a small window.
const R_KM = 6371;

function project(lat0: number, lng0: number, lat: number, lng: number): { xKm: number; yKm: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const xKm = (toRad(lng - lng0) * Math.cos(toRad(lat0))) * R_KM;
  const yKm = toRad(lat - lat0) * R_KM;
  return { xKm, yKm };
}

function readCoords(o: BriefObject): { lat: number; lng: number } | null {
  const lat = o.metadata?.lat;
  const lng = o.metadata?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

const VIEW = 300;
const CX = VIEW / 2;
const CY = VIEW / 2;
const PLOT_R = 120; // px from centre to outer ring

export function NearbyMap({ objects, center, onSelect, onLocate, locating, onClearLocation, onSelectCity }: NearbyMapProps) {
  if (!center) {
    return (
      <div
        className="rounded-2xl border border-[#232A38] bg-[#10141C] p-5 text-center"
        style={{ borderColor: 'var(--hairline)', background: 'var(--surface)' }}
      >
        <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-dim)' }}>
          See what's actually around you
        </p>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          Brief plots the things near you using real coordinates. Allow your device location, or tap a city.
        </p>
        <button
          onClick={onLocate}
          disabled={locating}
          className="mt-3 rounded-full px-4 py-2 text-[11px] font-bold transition-transform active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'var(--signal-live)', color: 'var(--ground)' }}
        >
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        <p className="mt-3 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          Tap a city instead:
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {CITIES.map((c) => (
            <button
              key={c.label}
              onClick={() => onSelectCity(c)}
              className="rounded-full border px-3 py-1.5 text-[10px] font-semibold"
              style={{ borderColor: 'var(--hairline)', color: 'var(--ink-dim)' }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const located: PlotPoint[] = [];
  for (const o of objects) {
    // The server marks an object "within range" with a finite distanceKm;
    // anything farther (or unlocated) comes back without one. Plot only the
    // within-range ones — a point 400 km away is not "around you".
    const distKm = o.metadata?.distanceKm;
    if (typeof distKm !== 'number' || !Number.isFinite(distKm)) continue;
    const c = readCoords(o);
    if (!c) continue;
    const { xKm, yKm } = project(center.lat, center.lng, c.lat, c.lng);
    located.push({ obj: o, xKm, yKm, distKm });
  }
  located.sort((a, b) => a.distKm - b.distKm);

  const withoutCoords = objects.length - located.length;
  const maxExtent = Math.max(1, ...located.map((p) => Math.max(Math.abs(p.xKm), Math.abs(p.yKm), p.distKm)), 1);
  const scale = PLOT_R / maxExtent;

  return (
    <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4" style={{ borderColor: 'var(--hairline)', background: 'var(--surface)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-dim)' }}>
            Around {center.label}
          </p>
          <p className="text-[9px]" style={{ color: 'var(--ink-faint)' }}>
            {located.length} {located.length === 1 ? 'thing' : 'things'} near {center.label}
            {withoutCoords > 0 ? ` · ${withoutCoords} farther or unlocated` : ''}
          </p>
        </div>
        <button
          onClick={onClearLocation}
          className="shrink-0 text-[10px] font-bold underline"
          style={{ color: 'var(--ink-dim)' }}
        >
          Show everywhere
        </button>
      </div>

      {located.length === 0 ? (
        <p className="py-6 text-center text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          Nothing near {center.label} carries a known location yet.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="w-full"
            role="img"
            aria-label={`Relative map of ${located.length} located things around ${center.label}`}
          >
            {/* distance rings */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle
                key={f}
                cx={CX}
                cy={CY}
                r={PLOT_R * f}
                fill="none"
                stroke="var(--hairline)"
                strokeWidth="1"
                strokeDasharray={f === 1 ? '0' : '2 3'}
              />
            ))}
            {/* north marker */}
            <text x={CX} y={CY - PLOT_R - 6} textAnchor="middle" fontSize="9" fill="var(--ink-faint)">N</text>
            <path d={`M ${CX} ${CY - PLOT_R - 1} l -3 6 h 6 z`} fill="var(--ink-faint)" />
            {/* centre = you */}
            <circle cx={CX} cy={CY} r="7" fill="var(--signal-live)" opacity="0.18" />
            <circle cx={CX} cy={CY} r="3.5" fill="var(--signal-live)" />

            {located.map((p) => {
              const px = CX + p.xKm * scale;
              const py = CY - p.yKm * scale; // north up
              const verified = p.obj.isVerified;
              return (
                <g
                  key={p.obj.id}
                  onClick={() => onSelect(p.obj)}
                  className="cursor-pointer"
                  role="button"
                >
                  <title>{`${p.obj.title} · ${Math.round(p.distKm * 10) / 10} km`}</title>
                  <circle cx={px} cy={py} r="9" fill="transparent" />
                  <circle
                    cx={px}
                    cy={py}
                    r={verified ? 4 : 3}
                    fill={verified ? 'var(--signal-live)' : 'var(--ink)'}
                    opacity={verified ? 1 : 0.75}
                  />
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: 'var(--ink-faint)' }}>
            <span>You</span>
            <span>outer ring ≈ {Math.round(maxExtent * 10) / 10} km</span>
          </div>
        </>
      )}

      <p className="mt-2 text-[9px] leading-snug" style={{ color: 'var(--ink-faint)' }}>
        Positions are approximate — coarse neighbourhood coordinates, for "what's around me", not turn-by-turn.
      </p>
    </div>
  );
}

// Manual fallback when the user declines device location. Real city centres.
const CITIES: GeoPoint[] = [
  { lat: -1.2921, lng: 36.8219, label: 'Nairobi' },
  { lat: -4.0435, lng: 39.6682, label: 'Mombasa' },
  { lat: -0.0917, lng: 34.768, label: 'Kisumu' },
  { lat: -0.3031, lng: 36.08, label: 'Nakuru' }
];

export default NearbyMap;
