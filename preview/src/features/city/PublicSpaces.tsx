// ---------------------------------------------------------------------------
// PUBLIC SPACES — the directory of spaces owners chose to make discoverable.
//
// A public space is a deliberate act (visibility: public), so this is the
// collaboration surface: "here are projects you can find." Every card is a
// real public space; the projection carries no private economics (no revenue,
// no customers, no owner). Empty is honest: no one has gone public yet.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import * as briefApi from "../../api/briefApi";
import type { PublicSpace } from "../../api/types";
import { soundEngine } from "../../utils/SoundEngine";

const TYPE_LABEL: Record<string, string> = {
  business: "Business", side_hustle: "Side hustle", creator: "Creator",
  community: "Community", event: "Event", project: "Project", other: "Project"
};

export function PublicSpaces({ onOpenSpace }: { onOpenSpace: (spaceId: string) => void }) {
  const [spaces, setSpaces] = useState<PublicSpace[] | null>(null);

  useEffect(() => {
    let live = true;
    void briefApi.discoverPublicSpaces(12).then((res) => {
      if (live) setSpaces(res.ok ? res.data : []);
    });
    return () => { live = false; };
  }, []);

  if (spaces === null) {
    return <p className="text-xs text-[color:var(--color-text-muted)]">Reading public spaces…</p>;
  }
  if (spaces.length === 0) {
    return <p className="text-xs text-[color:var(--color-text-muted)]">No public spaces yet — make yours public to be found.</p>;
  }

  return (
    <div className="space-y-2">
      {spaces.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
          className="w-full text-left p-3.5 rounded-2xl bg-[color:var(--color-paper)] border border-black/5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[color:var(--color-text)] truncate">{s.name}</span>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] px-1.5 py-0.5 rounded-full">
                {TYPE_LABEL[s.type] ?? s.type}
              </span>
            </div>
            {s.goal && <p className="text-[11px] text-[color:var(--color-text-muted)] truncate">{s.goal}</p>}
            <p className="text-[11px] text-[color:var(--color-text-muted)]">
              {s.activeOfferCount} active offer{s.activeOfferCount === 1 ? '' : 's'}
              {s.sampleOffers.length > 0 && ` · ${s.sampleOffers.map((o) => o.title).join(', ')}`}
            </p>
            {/* The declared operating facts. A buyer is told how old these
                answers are, because that is true — not that the seller is
                worse, and not a rank, because no rank exists. */}
            {s.operating && Object.keys(s.operating.fields).length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {(['what', 'capacity', 'availability', 'coverage', 'constraints'] as const)
                  .flatMap((k) => {
                    const f = s.operating?.fields[k];
                    return f?.answer ? [{ key: k, answer: f.answer }] : [];
                  })
                  .map(({ key, answer }) => (
                    <p key={key} className="text-[11px] leading-snug" style={{ color: 'var(--color-text)' }}>
                      {answer}
                    </p>
                  ))}
                {s.operating.staleDays !== null && (
                  <p className="text-[11px] font-bold" style={{ color: 'var(--color-warning)' }}>
                    Answers last confirmed {s.operating.staleDays} days ago
                  </p>
                )}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default PublicSpaces;
