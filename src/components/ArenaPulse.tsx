import React from 'react';
import { Flame, Target } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { MyArenaProgress, ArenaLive } from '../api/briefApi';

// ARENA PULSE — the retention layer rendered into the existing lobby.
// The design language does not change; the lobby simply comes alive:
// a live strip of REAL counts, the member's Arena identity (level + XP bar),
// today's missions with claim, and rivals derived from repeated play.
// Honest empties everywhere: a quiet arena says it is quiet.
export function ArenaPulse() {
  const [live, setLive] = React.useState<ArenaLive | null>(null);
  const [me, setMe] = React.useState<MyArenaProgress | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [l, m] = await Promise.all([briefApi.arenaLive(), briefApi.myArenaProgress()]);
    if (l.ok) setLive(l.data);
    if (m.ok) setMe(m.data);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const claim = async (key: string) => {
    if (busy) return;
    setBusy(true); setNote(null);
    const res = await briefApi.claimArenaMission(key);
    setBusy(false);
    if (!res.ok) { setNote(res.error); return; }
    const r = res.data.claimed;
    setNote(`Claimed${r.xp ? ` +${r.xp} XP` : ''}${r.coins ? ` +${r.coins} Arena Coins` : ''}.`);
    await load();
  };

  const quiet = live ? live.playersActiveLastHour === 0 && live.matchesAwaitingConfirmation === 0 : false;

  return (
    <div className="space-y-3">
      {/* The tagline + the honest live strip */}
      <div>
        <h2 className="text-lg font-extrabold text-[#0D1117]">Arena</h2>
        <p className="text-[11px] text-[#0D1117]/60 leading-snug mt-0.5">Play. Compete. Build your record.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {live ? (
          <>
            <span className="px-2 py-0.5 rounded-lg bg-[#F0F2F5] text-[10px] font-bold text-[#0D1117]/70">
              {quiet ? 'Quiet right now' : `🟢 ${live.playersActiveLastHour} active in the last hour`}
            </span>
            {live.matchesAwaitingConfirmation > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-[#F0F2F5] text-[10px] font-bold text-[#0D1117]/70">
                {live.matchesAwaitingConfirmation} awaiting confirmation
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg bg-[#F0F2F5] text-[10px] font-bold text-[#0D1117]/70">
              {live.season.label} · {live.season.daysRemaining}d left
            </span>
          </>
        ) : (
          <span className="px-2 py-0.5 rounded-lg bg-[#F0F2F5] text-[10px] font-bold text-[#0D1117]/70">…</span>
        )}
      </div>

      {/* The member's Arena identity */}
      {me && (
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#0D1117]/70">Your Arena record</span>
            <span className="text-[11px] font-extrabold text-[#FF5A1F]">Level {me.profile.level}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F0F2F5] overflow-hidden" role="progressbar" aria-valuenow={me.profile.xpIntoLevel} aria-valuemax={me.profile.xpPerLevel}>
            <div className="h-full rounded-full bg-[#FF5A1F]" style={{ width: `${Math.min(100, (me.profile.xpIntoLevel / me.profile.xpPerLevel) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-[#0D1117]/60">
            {me.profile.xpIntoLevel} / {me.profile.xpPerLevel} XP · {me.profile.totalCoins.toLocaleString()} Arena Coins
            {me.profile.totalXp === 0 && ' — no confirmed matches yet; a result both players confirm is what earns'}
          </p>
          {me.seasonRank && (
            <p className="text-[10px] font-bold text-[#0D1117]">Season rank #{me.seasonRank.rank} · {me.seasonRank.xp} XP</p>
          )}
        </div>
      )}

      {/* Today's missions — daily, derived, claim once */}
      {me && (
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#FF5A1F]" aria-hidden="true" />
            <h3 className="text-[13px] font-extrabold text-[#0D1117]">Today in Arena</h3>
          </div>
          {me.missions.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E8EC] px-3 py-2">
              <div>
                <p className="text-[11px] font-bold text-[#0D1117]">{m.label}</p>
                <p className="text-[9px] text-[#0D1117]/55">
                  {m.progress}/{m.target} · {m.reward.xp ? `+${m.reward.xp} XP` : `+${m.reward.coins} Coins`}
                </p>
              </div>
              {m.claimed ? (
                <span className="text-[9px] font-extrabold uppercase text-[#16A34A]">Claimed</span>
              ) : m.claimable ? (
                <button type="button" onClick={() => void claim(m.key)} disabled={busy}
                  className="rounded-lg bg-[#FF5A1F] px-2.5 py-1 text-[10px] font-extrabold text-[#0D1117] disabled:opacity-40">Claim</button>
              ) : (
                <span className="text-[9px] font-bold text-[#0D1117]/60">{m.progress}/{m.target}</span>
              )}
            </div>
          ))}
          {note && <p className="text-[10px] font-bold text-[#0D1117]" role="status">{note}</p>}
        </div>
      )}

      {/* Rivals — from repeated confirmed play only */}
      {me && me.rivals.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#FF5A1F]" aria-hidden="true" />
            <h3 className="text-[13px] font-extrabold text-[#0D1117]">Your rivals</h3>
          </div>
          {me.rivals.map((r) => (
            <div key={r.userId} className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-[#0D1117]">{r.displayName}</p>
              <p className="text-[10px] text-[#0D1117]/60">{r.iWon} — {r.theyWon} head to head</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Season strip + the caller's own row, above the existing per-game list. */
type SeasonBoard = { season: briefApi.ArenaSeason; rows: { rank: number; userId: string; displayName: string; xp: number; coins: number }[]; you: { rank: number; xp: number; coins: number } | null };

export function SeasonStrip() {
  const [data, setData] = React.useState<SeasonBoard | null>(null);
  React.useEffect(() => {
    void briefApi.arenaSeasonLeaderboard().then((r) => { if (r.ok) setData(r.data); });
  }, []);
  if (!data) return null;
  return (
    <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3 space-y-1.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0D1117]/70">
        {data.season.label} · {data.season.daysRemaining} days remaining
      </p>
      {data.you ? (
        <p className="text-[11px] font-bold text-[#0D1117]">
          YOU — #{data.you.rank} · {data.you.xp} XP this season
        </p>
      ) : (
        <p className="text-[10px] text-[#0D1117]/60">You have no season points yet — a confirmed match earns.</p>
      )}
      {data.rows.slice(0, 3).map((row) => (
        <p key={row.userId} className="text-[10px] text-[#0D1117]/70">
          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'} {row.displayName} — {row.xp} XP
        </p>
      ))}
    </div>
  );
}
