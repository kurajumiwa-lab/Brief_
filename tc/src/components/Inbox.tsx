import React from 'react';
import { getObjectTypeMeta } from '../App';
import type {
  BriefObject,
  CandidateStatus,
  IngestionCandidate,
  Source
} from '../App';

/**
 * INBOX -- parsed messages awaiting review.
 *
 * Messages from connected sources are parsed into DRAFT objects. Extracted
 * from App.tsx unchanged.
 *
 * The rule this surface exists to enforce: parsing is not publishing. A draft
 * shows what Brief extracted, its confidence, its provenance and any possible
 * duplicate -- and nothing reaches the stream until a person publishes it.
 * Drafts are explicitly marked unverified; Brief never assigns a trust score
 * to something nobody has reviewed.
 */

export interface InboxProps {
  pendingCandidates: IngestionCandidate[];
  reviewed: Record<string, CandidateStatus>;
  objects: BriefObject[];
  sources: Source[];
  handleAcceptCandidate: (c: IngestionCandidate) => void;
  handleRejectCandidate: (c: IngestionCandidate) => void;
  handleReceiveInbound: () => void;
  /** True while the real inbound queue is being read from the server. */
  inboundBusy?: boolean;
}

export function Inbox({
  pendingCandidates,
  reviewed,
  objects,
  sources,
  handleAcceptCandidate,
  handleRejectCandidate,
  handleReceiveInbound,
  inboundBusy = false
}: InboxProps) {
  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[#E2ECE5]">Inbox</h2>
          <p className="text-[11px] text-[#86935C] leading-snug mt-1">
            Messages from connected sources, parsed into draft objects.
            Nothing here is in Brief until you publish it.
          </p>
        </div>

        <button
          onClick={handleReceiveInbound}
          disabled={inboundBusy}
          className="shrink-0 px-3 py-2 rounded-xl bg-[#172D20] border border-[#235F45] text-[#8DCF74] font-extrabold text-[11px] cursor-pointer disabled:opacity-50"
        >
          {inboundBusy ? 'Fetching...' : 'Fetch messages'}
        </button>
      </div>

      {pendingCandidates.length === 0 && (
        <div className="border border-dashed border-[#1E3A2A] rounded-2xl p-8 text-center">
          <p className="text-xs text-[#86935C]">
            No messages awaiting review.
          </p>
          <p className="text-[10px] text-[#5C6B52] mt-1">
            Connected sources appear here as drafts, never as published objects.
          </p>
        </div>
      )}

      {pendingCandidates.map((candidate) => {
        const confidencePct = Math.round(candidate.confidence * 100);
        const lowConfidence = candidate.confidence < 0.5;

        return (
          <div
            key={candidate.id}
            className="bg-[#102117] border border-[#1E3A2A] rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono uppercase text-[#86935C] truncate">
                {candidate.message.sourceLabel}
              </span>
              <span
                className={`text-[9px] font-mono shrink-0 ${
                  lowConfidence ? 'text-[#C9A227]' : 'text-[#8DCF74]'
                }`}
              >
                {confidencePct}% parsed
              </span>
            </div>

            {/* The raw message, always visible next to what was made of it. */}
            <p className="text-[11px] text-[#5C6B52] italic leading-snug border-l-2 border-[#1E3A2A] pl-2">
              {candidate.message.text}
            </p>

            <div>
              <p className="text-[9px] font-mono uppercase text-[#00FF42]">
                {candidate.typeConfident
                  ? getObjectTypeMeta(candidate.draft.type).label
                  : 'Type unclear'}
              </p>
              <p className="text-sm font-extrabold text-[#E2ECE5] leading-snug mt-0.5">
                {candidate.draft.title}
              </p>
            </div>

            {candidate.extracted.length > 0 && (
              <div className="space-y-1">
                {candidate.extracted
                  .filter((f) => f.field !== 'title')
                  .map((f) => (
                    <div
                      key={f.field}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[10px] text-[#86935C] shrink-0">
                        {f.field}
                      </span>
                      <span className="text-[10px] font-mono text-[#A9BDA0] truncate">
                        {f.value}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {candidate.suggestedLinks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase text-[#5C6B52]">
                  Connects to
                </p>
                {candidate.suggestedLinks.map((link) => (
                  <p
                    key={link.objectId + link.relation}
                    className="text-[10px] text-[#8DCF74]"
                  >
                    {link.why}
                  </p>
                ))}
              </div>
            )}

            {candidate.warnings.map((w) => (
              <p key={w} className="text-[10px] text-[#C9A227]">
                {w}
              </p>
            ))}

            {candidate.duplicates.length > 0 && (
              <div className="border border-[#3A3416] bg-[#1A1708] rounded-xl p-2 space-y-0.5">
                <p className="text-[9px] font-mono uppercase text-[#C9A227]">
                  Possible duplicate
                </p>
                {candidate.duplicates.slice(0, 2).map((d) => (
                  <p key={d.item.id} className="text-[10px] text-[#A9BDA0]">
                    {d.item.title} ({Math.round(d.similarity * 100)}% similar)
                  </p>
                ))}
              </div>
            )}

            <p className="text-[9px] font-mono text-[#5C6B52]">
              Unverified. No trust score until reviewed.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleRejectCandidate(candidate)}
                className="flex-1 py-2 rounded-xl bg-[#0D1F15] border border-[#1E3A2A] text-[#86935C] font-bold text-[11px] cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={() => handleAcceptCandidate(candidate)}
                className="flex-[2] py-2 rounded-xl bg-[#00FF42] text-[#09150E] font-extrabold text-[11px] cursor-pointer"
              >
                Publish to Brief
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
