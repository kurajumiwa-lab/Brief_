import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { StageStepper } from './StageStepper';
import type { ArenaChallenge, ArenaMatch } from '../App';
import { soundEngine } from '../utils/SoundEngine';

// ---------------------------------------------------------------------------
// MATCH QUEUE PANEL — the "High-Frequency Gaming State" package.
//
// Inline queue toggles (Casual/Ranked, Touch/Controller) with immediate
// feedback, an "Instant Queue Matching" badge when the player is marked
// available, and the pipeline visualizer — which reflects the REAL Arena
// lifecycle, not a fake loading screen:
//
//   Queue Entered -> Opponent Found -> Match Live -> Result Reported ->
//   Result Confirmed
//
// Each dot maps to genuine state on the player's own challenge/match rows.
// Nothing animates for show: an idle player sees an idle pipeline.
// ---------------------------------------------------------------------------

export interface MatchQueuePanelProps {
  gameName: string;
  latestChallenge: ArenaChallenge | null;
  latestMatch: ArenaMatch | null;
  availabilityOn: boolean;
  busy: boolean;
  onEnterQueue: (params: { stake: 'friendly' | 'ranked'; note: string }) => void;
  onToggleAvailability: () => void;
}

const MATCH_STAGES = [
  { id: 'queued', label: 'Queue Entered', blurb: 'Your challenge is open.' },
  { id: 'opponent', label: 'Opponent Found', blurb: 'Someone accepted.' },
  { id: 'live', label: 'Match Live', blurb: 'Play it out.' },
  { id: 'reported', label: 'Result Reported', blurb: 'One side has spoken.' },
  { id: 'confirmed', label: 'Result Confirmed', blurb: 'Both sides agreed.' }
];

function deriveStage(challenge: ArenaChallenge | null, match: ArenaMatch | null): number {
  if (!challenge && !match) return -1; // idle — nothing in flight
  if (match) {
    if (match.status === 'confirmed' || (match.confirmedByA && match.confirmedByB)) return 4;
    if (match.status === 'reported' || match.winnerPlayerId) return 3;
    if (match.status === 'disputed') return 3;
    return 2; // scheduled = live
  }
  if (challenge && (challenge.status === 'accepted' || challenge.acceptedByPlayerId)) return 1;
  return 0; // open challenge = searching
}

export function MatchQueuePanel({
  gameName,
  latestChallenge,
  latestMatch,
  availabilityOn,
  busy,
  onEnterQueue,
  onToggleAvailability
}: MatchQueuePanelProps) {
  const [mode, setMode] = useState<'friendly' | 'ranked'>('friendly');
  const [iface, setIface] = useState<'touch' | 'controller'>('touch');

  const stageIndex = deriveStage(latestChallenge, latestMatch);
  const inFlight = stageIndex >= 0;

  return (
    <div className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-4 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">Match queue</p>
          <p className="text-[10px] text-[#0D1117]/60 truncate">{gameName} · open play or ranked</p>
        </div>
        {/* Instant Queue Matching badge: real availability state */}
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); onToggleAvailability(); }}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold cursor-pointer disabled:opacity-40 transition-all"
          style={{
            background: availabilityOn ? '#FF5A1F' : '#F0F2F5',
            color: availabilityOn ? '#0D1117' : '#0D1117',
            border: '1px solid #FF5A1F'
          }}
          title={availabilityOn ? 'You are listed as available — turn off' : 'Go available for instant queue matching'}
        >
          <Zap className="h-3 w-3" style={{ fill: availabilityOn ? '#0D1117' : 'none' }} />
          {availabilityOn ? 'Instant Queue Matching' : 'Go Instant'}
        </button>
      </div>

      {/* inline queue toggles — immediate feedback, no submit step */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#0D1117]/60">Mode</span>
          {(['friendly', 'ranked'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { soundEngine.play('tap'); setMode(m); }}
              className="rounded-lg border px-2.5 py-1 text-[10px] font-extrabold cursor-pointer transition-all"
              style={{
                background: mode === m ? '#FF5A1F' : '#FFFFFF',
                color: mode === m ? '#0D1117' : '#0D1117',
                borderColor: mode === m ? '#FF5A1F' : '#E5E8EC'
              }}
            >
              {m === 'friendly' ? 'Casual' : 'Ranked'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#0D1117]/60">Interface</span>
          {(['touch', 'controller'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { soundEngine.play('tap'); setIface(v); }}
              className="rounded-lg border px-2.5 py-1 text-[10px] font-extrabold cursor-pointer transition-all"
              style={{
                background: iface === v ? '#FF5A1F' : '#FFFFFF',
                color: iface === v ? '#0D1117' : '#0D1117',
                borderColor: iface === v ? '#FF5A1F' : '#E5E8EC'
              }}
            >
              {v === 'touch' ? 'Touch' : 'Controller'}
            </button>
          ))}
        </div>
      </div>

      {/* the visualizer: the REAL pipeline of the player's own flow */}
      <div className="rounded-xl border border-[#E5E8EC] bg-[#F0F2F5] p-3">
        {inFlight ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#0D1117]/60">Your pipeline</p>
              <span className="text-[9px] font-mono text-[#0D1117]/60">
                {latestMatch ? 'match' : 'challenge'} {latestMatch?.id ?? latestChallenge?.id}
              </span>
            </div>
            <StageStepper stages={MATCH_STAGES} currentIndex={stageIndex} compact />
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-[#0D1117]/60">
              Idle — no open queue. Enter with {mode === 'friendly' ? 'Casual' : 'Ranked'} · {iface === 'touch' ? 'Touch' : 'Controller'}.
            </p>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('heavyTap');
                onEnterQueue({ stake: mode, note: `${iface} interface` });
              }}
              disabled={busy}
              className="shrink-0 rounded-lg bg-[#FF5A1F] px-3.5 py-2 text-[11px] font-extrabold text-[#0D1117] cursor-pointer disabled:opacity-40"
            >
              {busy ? 'Entering…' : 'Enter queue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MatchQueuePanel;
