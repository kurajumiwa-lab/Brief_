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
          <h2 className="text-lg font-extrabold text-[#F7F7F8]">Inbox</h2>
          <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
            Messages from connected sources, parsed into draft objects.
            Nothing here is in Brief until you publish it.
          </p>
        </div>

        <button
          onClick={handleReceiveInbound}
          disabled={inboundBusy}
          className="shrink-0 px-3 py-2 rounded-xl bg-[#12151A] border border-[#222630] text-[#F7F7F8] font-extrabold text-[11px] cursor-pointer disabled:opacity-50"
        >
          {inboundBusy ? 'Fetching...' : 'Fetch messages'}
        </button>
      </div>

      {pendingCandidates.length === 0 && (
        <div className="border border-dashed border-[#222630] rounded-2xl p-8 text-center">
          <p className="text-xs text-[#F7F7F8]/60">
            No messages awaiting review.
          </p>
          <p className="text-[10px] text-[#F7F7F8]/40 mt-1">
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
            className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-[#F7F7F8]/60 truncate">
                {candidate.message.sourceLabel}
              </span>
              <span
                className={`text-[9px] shrink-0 ${
                  lowConfidence ? 'text-[#F7F7F8]' : 'text-[#F7F7F8]'
                }`}
              >
                {confidencePct}% parsed
              </span>
            </div>

            {/* The raw message, always visible next to what was made of it. */}
            <p className="text-[11px] text-[#F7F7F8]/40 italic leading-snug border-l-2 border-[#222630] pl-2">
              {candidate.message.text}
            </p>

            <div>
              <p className="text-[9px] text-[#F7F7F8]">
                {candidate.typeConfident
                  ? getObjectTypeMeta(candidate.draft.type).label
                  : 'Type unclear'}
              </p>
              <p className="text-sm font-extrabold text-[#F7F7F8] leading-snug mt-0.5">
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
                      <span className="text-[10px] text-[#F7F7F8]/60 shrink-0">
                        {f.field}
                      </span>
                      <span className="text-[10px] text-[#F7F7F8]/60 truncate">
                        {f.value}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {candidate.suggestedLinks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-[#F7F7F8]/40">
                  Connects to
                </p>
                {candidate.suggestedLinks.map((link) => (
                  <p
                    key={link.objectId + link.relation}
                    className="text-[10px] text-[#F7F7F8]"
                  >
                    {link.why}
                  </p>
                ))}
              </div>
            )}

            {candidate.warnings.map((w) => (
              <p key={w} className="text-[10px] text-[#F7F7F8]">
                {w}
              </p>
            ))}

            {candidate.duplicates.length > 0 && (
              <div className="border border-[#22E6E0] bg-[#12151A] rounded-xl p-2 space-y-0.5">
                <p className="text-[9px] text-[#F7F7F8]">
                  Possible duplicate
                </p>
                {candidate.duplicates.slice(0, 2).map((d) => (
                  <p key={d.item.id} className="text-[10px] text-[#F7F7F8]/60">
                    {d.item.title} ({Math.round(d.similarity * 100)}% similar)
                  </p>
                ))}
              </div>
            )}

            <p className="text-[9px] text-[#F7F7F8]/40">
              Unverified. No trust score until reviewed.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleRejectCandidate(candidate)}
                className="flex-1 py-2 rounded-xl bg-[#12151A] border border-[#222630] text-[#F7F7F8]/60 font-bold text-[11px] cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={() => handleAcceptCandidate(candidate)}
                className="flex-[2] py-2 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[11px] cursor-pointer"
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
