import React, { useState } from 'react';
import type { ArenaGame, ArenaChallenge } from '../App';
import { themeFor } from './arenaTheme';

// ---------------------------------------------------------------------------
// ARENA GAME SCREEN — the secondary screen behind a shelf tile.
//
// Tapping a game on the minimalist shelf opens THIS: an immersive surface
// populated with everything needed to create a match or a staked game:
//
//   • a provider-forward hero (key art + publisher + supported modes)
//   • your identity + availability in this game
//   • a match composer (mode · friendly / ranked / staked · note · open window)
//   • the open matches for this title, ready to accept
//   • quick links to this title's leaderboard and tournaments
//
// COLOUR SYSTEM (site-wide minimalist re-theme): strictly neutral surfaces and
// strictly black/white typography. The hero is IMAGERY under a dark veil, so
// everything on it is white; the body sits on the off-white page with white
// cards, hairline borders, black type — and black fills (buttons, active
// chips) carry white type.
//
// HONESTY: "Staked" records an agreed entry fee on the challenge; Arena has NO
// live money rail (the compliance gate blocks real payouts), so the screen says
// that plainly rather than implying cash is held. All figures (activity, your
// tag) are passed in from real state — nothing is invented here.
// ---------------------------------------------------------------------------

export type ArenaStakeKind = 'friendly' | 'ranked' | 'entry_fee';

export interface ArenaGameScreenProps {
  game: ArenaGame;
  activity: number;
  challenges: ArenaChallenge[];
  myTag: string | null;
  availabilityOn: boolean;
  availabilityBusy: boolean;
  busyId: string | null;
  myPlayerId: string | null;
  onClose: () => void;
  onCreateChallenge: (params: {
    mode: string;
    stake: ArenaStakeKind;
    entryFeeKes?: number;
    note?: string;
    openMinutes: number;
  }) => void;
  onAcceptChallenge: (c: ArenaChallenge) => void;
  onCancelChallenge: (c: ArenaChallenge) => void;
  onToggleAvailability: () => void;
  onViewLeaderboard: () => void;
  onViewTournaments: () => void;
}

const WINDOWS: { label: string; minutes: number }[] = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Today', minutes: 360 }
];

const STAKES: { id: ArenaStakeKind; label: string; hint: string }[] = [
  { id: 'friendly', label: 'Friendly', hint: 'Play for fun · no fee' },
  { id: 'ranked', label: 'Ranked', hint: 'Counts on your record' },
  { id: 'entry_fee', label: 'Staked', hint: 'Agreed entry fee' }
];

// The one neutral system the whole screen speaks.
const INK = '#111111';
const PAGE = '#FAFAFA';
const CARD = '#FFFFFF';
const LINE = '#E5E7EB';

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer"
      style={{
        // Active: black fill, white type. Inactive: recessed neutral on the card.
        background: active ? INK : PAGE,
        color: active ? '#FFFFFF' : INK,
        borderColor: active ? INK : LINE
      }}
    >
      {children}
    </button>
  );
}

export function ArenaGameScreen({
  game,
  activity,
  challenges,
  myTag,
  availabilityOn,
  availabilityBusy,
  busyId,
  myPlayerId,
  onClose,
  onCreateChallenge,
  onAcceptChallenge,
  onCancelChallenge,
  onToggleAvailability,
  onViewLeaderboard,
  onViewTournaments
}: ArenaGameScreenProps) {
  const theme = themeFor(game.id);
  const [mode, setMode] = useState<string>(game.modes[0] ?? '1v1');
  const [stake, setStake] = useState<ArenaStakeKind>('friendly');
  const [entryFee, setEntryFee] = useState<string>('100');
  const [note, setNote] = useState<string>('');
  const [windowMinutes, setWindowMinutes] = useState<number>(120);

  const feeNum = Number(entryFee);
  const feeValid = Number.isFinite(feeNum) && Number.isInteger(feeNum) && feeNum > 0;
  const creating = busyId === 'create';
  const canCreate = !creating && (stake !== 'entry_fee' || feeValid);

  const handleCreate = () => {
    if (!canCreate) return;
    onCreateChallenge({
      mode,
      stake,
      entryFeeKes: stake === 'entry_fee' ? feeNum : undefined,
      note: note.trim() ? note.trim() : undefined,
      openMinutes: windowMinutes
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: PAGE }}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} match setup`}
    >
      {/* ---------- HERO (imagery under a dark veil — white type only) ---------- */}
      <div className="relative h-52 overflow-hidden">
        <img src={theme.art} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(9,11,16,0.55) 0%, rgba(9,11,16,0.10) 40%, rgba(9,11,16,0.55) 78%, rgba(9,11,16,0.96) 100%)'
          }}
        />

        {/* top bar */}
        <div className="relative flex items-center justify-between px-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer"
            style={{ background: 'rgba(9,11,16,0.6)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.28)' }}
          >
            <span aria-hidden="true">‹</span> Back
          </button>
          <span
            className="rounded-full px-2 py-1 text-[9px] font-extrabold tracking-wide"
            style={{
              background: 'rgba(9,11,16,0.8)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.28)'
            }}
          >
            {activity > 0 ? `${theme.liveLabel} · ${activity} open` : 'QUIET'}
          </span>
        </div>

        {/* title block */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
          <span
            className="text-[9px] font-extrabold tracking-[0.2em] px-1.5 py-0.5 rounded-md"
            style={{ color: '#FFFFFF', background: INK }}
          >
            {theme.providerMark}
          </span>
          <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#FFFFFF]/75">
            {theme.provider} · {theme.themeName}
          </p>
          <h2 className="text-2xl font-extrabold leading-none text-[#FFFFFF]">{game.name}</h2>
        </div>
      </div>

      {/* ---------- BODY (light surfaces — black type) ---------- */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* modes + availability summary */}
        <div className="flex flex-wrap items-center gap-2">
          {game.modes.map((m) => (
            <span
              key={m}
              className="rounded-lg border px-2 py-1 text-[10px] font-bold"
              style={{ borderColor: LINE, color: 'rgba(17,17,17,0.6)' }}
            >
              {m}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-[#111111]/40">
            {game.accountTransferPolicy === 'not_supported'
              ? 'Account transfer: not supported'
              : game.accountTransferPolicy === 'restricted'
              ? 'Account transfer: restricted'
              : 'Account transfer: unknown'}
          </span>
        </div>

        {/* you in this game */}
        <div className="rounded-2xl border p-3.5 flex items-center justify-between gap-3" style={{ borderColor: LINE, background: CARD }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#111111]/60">You in {game.shortName}</p>
            <p className="text-sm font-extrabold text-[#111111] truncate">
              {myTag ? myTag : 'No tag set yet'}
            </p>
            <p className="text-[10px] text-[#111111]/40 mt-0.5">
              {availabilityOn ? 'Available to play now' : 'Showing as offline'}
            </p>
          </div>
          <button
            type="button"
            disabled={availabilityBusy}
            onClick={onToggleAvailability}
            className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
            style={{
              background: availabilityOn ? INK : PAGE,
              color: availabilityOn ? '#FFFFFF' : INK,
              border: `1px solid ${availabilityOn ? INK : LINE}`
            }}
          >
            {availabilityBusy ? '…' : availabilityOn ? 'Online' : 'Go online'}
          </button>
        </div>

        {/* ---------- MATCH COMPOSER ---------- */}
        <div className="rounded-2xl border p-3.5 space-y-3.5" style={{ borderColor: LINE, background: CARD }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">
              Set up a match
            </h3>
            <span className="text-[10px] font-mono text-[#111111]">
              {mode} · {STAKES.find((s) => s.id === stake)?.label}
            </span>
          </div>

          {/* mode */}
          <div>
            <p className="text-[10px] text-[#111111]/60 mb-1.5">Mode</p>
            <div className="flex flex-wrap gap-1.5">
              {game.modes.map((m) => (
                <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>

          {/* stake */}
          <div>
            <p className="text-[10px] text-[#111111]/60 mb-1.5">Stake</p>
            <div className="flex flex-wrap gap-1.5">
              {STAKES.map((s) => (
                <Chip key={s.id} active={stake === s.id} onClick={() => setStake(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <p className="text-[10px] text-[#111111]/40 mt-1.5">
              {STAKES.find((s) => s.id === stake)?.hint}
            </p>
          </div>

          {/* entry fee (only when staked) */}
          {stake === 'entry_fee' && (
            <div>
              <p className="text-[10px] text-[#111111]/60 mb-1.5">Entry fee (KES)</p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold text-[#111111]/60">KES</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="w-28 rounded-lg border px-2.5 py-1.5 text-[12px] font-extrabold text-[#111111] focus:outline-none"
                  style={{ background: PAGE, borderColor: feeValid ? INK : LINE }}
                />
                {[50, 100, 200].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEntryFee(String(v))}
                    className="rounded-lg border px-2 py-1 text-[10px] font-bold text-[#111111]/60 cursor-pointer"
                    style={{ borderColor: LINE }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {/* Honesty-critical caveat: rendered in the readable secondary tier
                  so "no money is taken" is never missed. */}
              <p className="text-[10px] text-[#111111]/60 mt-1.5 leading-snug">
                Staked matches record the agreed fee. Prize payouts are not active until Arena's
                compliance rail is enabled — no money is taken now.
              </p>
            </div>
          )}

          {/* open window */}
          <div>
            <p className="text-[10px] text-[#111111]/60 mb-1.5">Open for</p>
            <div className="flex flex-wrap gap-1.5">
              {WINDOWS.map((w) => (
                <Chip
                  key={w.minutes}
                  active={windowMinutes === w.minutes}
                  onClick={() => setWindowMinutes(w.minutes)}
                >
                  {w.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* note */}
          <div>
            <p className="text-[10px] text-[#111111]/60 mb-1.5">Note (optional)</p>
            <input
              type="text"
              maxLength={80}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Westlands, PS5, friendly lobby"
              className="w-full rounded-lg border px-2.5 py-2 text-[12px] text-[#111111] focus:outline-none"
              style={{ background: PAGE, borderColor: LINE, color: INK }}
            />
          </div>

          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreate}
            className="w-full h-11 rounded-xl text-[13px] font-extrabold cursor-pointer disabled:opacity-40"
            style={{ background: INK, color: '#FFFFFF' }}
          >
            {creating
              ? 'Opening…'
              : stake === 'entry_fee'
              ? `Open staked ${mode} · KES ${feeValid ? feeNum : '—'}`
              : `Open ${stake === 'ranked' ? 'ranked' : 'friendly'} ${mode}`}
          </button>
        </div>

        {/* ---------- OPEN MATCHES FOR THIS TITLE ---------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">
              Open matches
            </h3>
            <span className="text-[10px] text-[#111111]/40">{challenges.length}</span>
          </div>
          {challenges.length === 0 && (
            <p className="text-xs text-[#111111]/60">No open challenges for {game.name}. Be the first.</p>
          )}
          {challenges.map((c) => {
            const mine = Boolean(myPlayerId) && c.createdByPlayerId === myPlayerId;
            const expired = Boolean(c.openUntil) && c.openUntil <= new Date().toISOString();
            const taken = c.status === 'accepted' || Boolean(c.acceptedByPlayerId);
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-2xl p-3 flex items-center justify-between gap-2"
                style={{ borderColor: LINE, background: CARD, border: `1px solid ${LINE}` }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#111111]">
                    {c.mode} ·{' '}
                    {c.stake === 'friendly'
                      ? 'Friendly'
                      : c.stake === 'ranked'
                      ? 'Ranked'
                      : 'Staked'}
                  </p>
                  {c.entryFeeKes ? (
                    <p className="text-[10px] font-mono text-[#111111]">
                      KES {c.entryFeeKes}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-[#111111]/60 mt-0.5">
                    {mine ? 'Your challenge' : 'Open challenge'}
                    {expired ? ' · expired' : ''}
                    {taken ? ' · taken' : ''}
                  </p>
                </div>
                {mine ? (
                  <button
                    type="button"
                    disabled={busy || taken || c.status === 'cancelled'}
                    onClick={() => onCancelChallenge(c)}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    style={{ border: `1px solid ${LINE}`, color: INK }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || expired || taken}
                    onClick={() => onAcceptChallenge(c)}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    style={{ background: INK, color: '#FFFFFF' }}
                    title={expired ? 'This challenge has expired' : taken ? 'Already accepted' : undefined}
                  >
                    Accept
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ---------- QUICK LINKS ---------- */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onViewLeaderboard}
            className="rounded-xl py-2.5 text-[11px] font-extrabold cursor-pointer"
            style={{ border: `1px solid ${LINE}`, background: CARD, color: INK }}
          >
            🏆 Leaderboard
          </button>
          <button
            type="button"
            onClick={onViewTournaments}
            className="rounded-xl py-2.5 text-[11px] font-extrabold cursor-pointer"
            style={{ border: `1px solid ${LINE}`, background: CARD, color: INK }}
          >
            ⚔️ Tournaments
          </button>
        </div>

        <p className="text-center text-[10px] text-[#111111]/40 pt-1">
          Arena is for gathering to play — not gambling. Stake terms are agreed between players.
        </p>
      </div>
    </div>
  );
}

export default ArenaGameScreen;
