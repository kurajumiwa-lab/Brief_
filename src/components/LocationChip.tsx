import React from 'react';
import { MapPin, Compass } from 'lucide-react';

// ---------------------------------------------------------------------------
// LOCATION CHIP — the single home for location control.
//
// The standalone relative-map card and the "What's happening around you" hero
// bar were removed from the home screen. The one structure that other code
// truly depends on — the viewer's coarse location, which scopes the ranked
// feed (distance ranking) — moved HERE, into the header chip.
//
// Tapping the chip opens a small menu with the same honest options the map
// used to carry: device location, a city, or "show everywhere". Null location
// still means "everywhere" (the global ranked feed); nothing is ever inferred
// or fabricated.
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface LocationChipProps {
  label: string;
  locating: boolean;
  locError: string | null;
  hasLocation: boolean;
  onLocate: () => void;
  onSelectCity: (c: GeoPoint) => void;
  onClearLocation: () => void;
}

const CITIES: GeoPoint[] = [
  { lat: -1.2921, lng: 36.8219, label: 'Nairobi' },
  { lat: -4.0435, lng: 39.6682, label: 'Mombasa' },
  { lat: -0.0917, lng: 34.768, label: 'Kisumu' },
  { lat: -0.3031, lng: 36.08, label: 'Nakuru' }
];

export function LocationChip({ label, locating, locError, hasLocation, onLocate, onSelectCity, onClearLocation }: LocationChipProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 bg-[#FBFAFD] text-[#251045] text-xs font-bold px-3 py-1.5 rounded-full border border-[#D6CFE4] hover:border-[#6C3EC9] transition-colors cursor-pointer"
      >
        <MapPin className="w-3.5 h-3.5 text-[#251045]" />
        <span>{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl border border-[#D6CFE4] bg-[#FBFAFD] p-2 shadow-2xl">
            <button
              onClick={() => { onLocate(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#251045] hover:bg-[#E9E4F2] cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-[#251045]" />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            {locError && <p className="px-3 py-1 text-[10px] text-[#251045]">{locError}</p>}

            <div className="my-1 h-px bg-[#D6CFE4]" />
            <p className="px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-[#251045]/60">Or tap a city</p>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {CITIES.map((c) => (
                <button
                  key={c.label}
                  onClick={() => { onSelectCity(c); setOpen(false); }}
                  className="rounded-full border border-[#D6CFE4] px-3 py-1 text-[11px] font-semibold text-[#251045]/60 hover:border-[#6C3EC9] hover:text-[#251045] cursor-pointer"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {hasLocation && (
              <>
                <div className="my-1 h-px bg-[#D6CFE4]" />
                <button
                  onClick={() => { onClearLocation(); setOpen(false); }}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#251045]/60 hover:bg-[#E9E4F2] cursor-pointer"
                >
                  Show everywhere
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default LocationChip;
