// ---------------------------------------------------------------------------
// RELATED CONTENT — the object graph rendered on detail pages.
//
// Every section is a REAL relationship (structured venue/organizer/business
// fields, provenance, or persisted relationship rows) — nothing is matched by
// keywords and nothing weak is ever shown as certain. The location edge links
// into the public /explore/:name surface, keeping the wander inside Brief.
// ---------------------------------------------------------------------------

import React from 'react';
import { ArrowUpRight, CalendarDays, Clock, Flame, MapPin, ShoppingBag, Newspaper } from 'lucide-react';
import type { GraphEdge, GraphObject } from '../api/briefApi';

const EDGE_ICON: Record<string, React.ReactNode> = {
  happening_at: <CalendarDays className="h-3 w-3" />,
  organized_by: <CalendarDays className="h-3 w-3" />,
  hosted_by: <CalendarDays className="h-3 w-3" />,
  published_by: <Newspaper className="h-3 w-3" />,
  offered_by: <ShoppingBag className="h-3 w-3" />,
  located_at: <MapPin className="h-3 w-3" />,
  related_to: <Flame className="h-3 w-3" />
};

function line(o: GraphObject): string | null {
  const t = o.temporal;
  if (!t) return null;
  if ((t.status === 'upcoming' || t.status === 'happening') && typeof t.startsAt === 'string') {
    const d = new Date(t.startsAt);
    if (Number.isFinite(d.getTime())) {
      return `On ${d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return 'Upcoming';
  }
  if (t.status === 'active' && typeof t.deadlineAt === 'string') {
    const d = new Date(t.deadlineAt);
    if (Number.isFinite(d.getTime())) return `Closes ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`;
    return 'Active';
  }
  if (t.status === 'happening') return 'Happening now';
  return null;
}

export function RelatedContent({ edges, onOpenObject, onOpenLocation }: {
  edges: GraphEdge[];
  onOpenObject: (o: any) => void;
  onOpenLocation?: (name: string) => void;
}) {
  if (!edges || edges.length === 0) return null;
  return (
    <div className="space-y-5">
      {edges.map((edge) => (
        <section key={`${edge.verb}_${edge.label}`} aria-label={edge.label} className="rounded-2xl border border-[#222630] bg-[#12151A] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8]">
              {EDGE_ICON[edge.verb]}
              {edge.label}
              <span className="text-[#F7F7F8]/40">· {edge.objects.length}</span>
            </h4>
            {edge.location && onOpenLocation && (
              <button
                type="button"
                onClick={() => onOpenLocation(edge.location?.name ?? '')}
                className="flex items-center gap-1 rounded-full bg-[#FF5A1F] px-2.5 py-1 text-[9px] font-extrabold text-[#0D0F12] transition-colors hover:bg-[#E04D15]"
              >
                View area <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {edge.objects.slice(0, 6).map((o) => {
              const image = o.imageUrl ?? o.media?.url ?? o.gallery?.[0]?.url ?? null;
              const l = line(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onOpenObject(o)}
                  className="group flex items-center gap-2.5 rounded-xl border border-[#222630] bg-[#12151A] p-2 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-[#22E6E0]"
                >
                  {image ? (
                    <img src={image} alt="" aria-hidden="true" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1D2027] to-[#0D0F12] text-[9px] font-bold uppercase text-[#171A20]">
                      {o.type.slice(0, 4)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-[#F7F7F8] group-hover:text-[#FF5A1F]">{o.title}</span>
                    <span className="flex flex-wrap items-center gap-1 text-[9px] font-semibold text-[#F7F7F8]/55">
                      {l && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{l}</span>}
                      {(o.area || o.county) && <span>{[o.area, o.county].filter(Boolean).join(', ')}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default RelatedContent;
