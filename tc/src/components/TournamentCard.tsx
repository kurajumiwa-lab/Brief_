import React from 'react';
import { BracketLadder } from './BracketLadder';

// ---------------------------------------------------------------------------
// TOURNAMENT CARD — one tournament, with an expandable bracket ladder.
//
// Extracted from App.tsx so the bracket's open/close state lives in a real
// component (a React hook inside a .map() callback is a crash). Everything it
// shows is computed upstream and passed in; nothing here invents a number.
// ---------------------------------------------------------------------------

export interface TournamentCardProps {
  id: string;
  name: string;
  status: string;
  registered: number;
  capacity: number;
  organizerName: string;
  prizeDescription?: string;
  rewardPoints: number;
  rewardReason: string;
  rewardLines: { label: string; points: number }[];
  marginalValue: number;
  entrants: string[];
  displayName: (id: string) => string;
}

export function TournamentCard({
  id,
  name,
  status,
  registered,
  capacity,
  organizerName,
  prizeDescription,
  rewardPoints,
  rewardReason,
  rewardLines,
  marginalValue,
  entrants,
  displayName
}: TournamentCardProps) {
  const [bracketOpen, setBracketOpen] = React.useState(false);

  return (
    <div className="bg-[#10141C] border border-[#232A38] rounded-2xl p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-extrabold text-[#F3F1E7]">{name}</p>
        <span className="text-[9px] text-[#4B5162] shrink-0">
          {registered}/{capacity}
        </span>
      </div>
      <p className="text-[9px] text-[#4B5162] mt-0.5">
        Hosted by {organizerName} - {status}
      </p>
      {prizeDescription && (
        <p className="text-[10px] text-[#E8A33D] mt-1">{prizeDescription}</p>
      )}

      {/* Organizer reward, itemised. Shown honestly, including zero. */}
      {rewardPoints > 0 ? (
        <div className="mt-2 pt-2 border-t border-[#10141C]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[9px] text-[#4B5162]">Organizer earned</span>
            <span className="text-xs font-extrabold text-[#43D17A]">
              {rewardPoints.toLocaleString()}
            </span>
          </div>
          {rewardLines.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-3">
              <span className="text-[9px] text-[#8A93A6]">{l.label}</span>
              <span className="text-[9px] text-[#8A93A6]">+{l.points.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[9px] text-[#8A93A6] mt-1">Organizer reward: none - {rewardReason}</p>
      )}

      {status !== 'completed' && (
        <p className="text-[9px] text-[#43D17A] mt-1">
          Each player who completes adds {marginalValue} points for the organizer.
        </p>
      )}

      {/* The bracket ladder (§7.2) — a real seeded tree over actual entrants. */}
      <button
        onClick={() => setBracketOpen((o) => !o)}
        aria-expanded={bracketOpen}
        className="mt-2 w-full rounded-lg border border-[#232A38] px-3 py-1.5 text-[10px] font-bold text-[#3E8EFF] transition-colors active:border-[#F3F1E7]"
      >
        {bracketOpen ? 'Hide bracket' : 'View bracket'}
      </button>
      {bracketOpen && (
        <div className="brief-rise-in mt-2 border-t border-[#10141C] pt-2">
          <BracketLadder entrants={entrants} displayName={displayName} />
        </div>
      )}
    </div>
  );
}
