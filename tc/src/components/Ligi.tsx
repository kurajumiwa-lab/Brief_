import React from 'react';
import { Activity, CheckCircle2, Clock, Coins, Flame, Lock, Trophy } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { LigiLine, LigiOverview, LigiPoolPlayer } from '../api/briefApi';

// ---------------------------------------------------------------------------
// LIGI — African fantasy football, on one screen.
//
// The screen is a report on a game that runs itself. There is no "settle" or
// "set the lines" button anywhere in here, because a person never does either:
// the server's tick opens, locks, prices and settles every gameweek on the
// clock. The only refresh control re-runs that same idempotent pass so a
// deployment without a long-lived process still moves.
//
// TWO SLOTS, STATED PLAINLY.
//   FREE   the whole game, staked in units. Units are a score, not money.
//   CASH   priced, listed, and REFUSED with the licence requirements it is
//          missing. A greyed-out button would be a suggestion; this is the
//          server's answer, printed.
//
// Nothing in here computes a score, a line or a standing. Every number shown
// is one the server derived, so the screen cannot drift from the game.
// ---------------------------------------------------------------------------

export interface LigiProps {
  /** Ranked by the caller: the signed-in user's id, for "you" markers. */
  meId?: string | null;
  onToast?: (message: string) => void;
}

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'];

function when(value: string | null | undefined): string {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusChip({ status }: { status: string }) {
  const label: Record<string, string> = {
    scheduled: 'Scheduled',
    open: 'Open now',
    locked: 'Locked',
    awaiting_results: 'Awaiting results',
    settled: 'Settled',
    void: 'Void'
  };
  const dark = status === 'open' || status === 'settled';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] ${
        dark ? 'bg-[#111111] text-[#FFFFFF]' : 'border border-[#E5E7EB] text-[#111111]/60'
      }`}
    >
      {status === 'open' ? <Activity className="h-2.5 w-2.5" /> : status === 'settled' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
      {label[status] ?? status}
    </span>
  );
}

export function Ligi({ meId = null, onToast }: LigiProps) {
  const [data, setData] = React.useState<LigiOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState<string[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [captain, setCaptain] = React.useState<string | null>(null);
  const [wagerUnits, setWagerUnits] = React.useState(25);
  const [ladder, setLadder] = React.useState<'season' | 'streak'>('season');

  const load = React.useCallback(async () => {
    const res = await briefApi.getLigi();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const gw = data?.gameweek ?? null;
  const me = gw?.me ?? null;
  const pool: LigiPoolPlayer[] = gw?.pool ?? [];
  const lines: LigiLine[] = gw?.houseLines ?? [];
  const lineFor = (playerId: string) => lines.find((l) => l.playerId === playerId) ?? null;


  const takeSeat = async (slot: 'free' | 'cash') => {
    if (!gw) return;
    setBusy(slot);
    setGate(null);
    const res = await briefApi.enterLigi(gw.gameweek.id, slot);
    setBusy(null);
    if (res.ok) {
      onToast?.('Seat taken. 100 units for the week.');
      void load();
      return;
    }
    // The gate is the product working. Print what it said.
    const body: any = res.errorBody;
    if (Array.isArray(body?.requirements)) {
      setGate(body.requirements.filter((r: any) => !r.met).map((r: any) => r.label));
    }
    onToast?.(res.error);
  };

  const togglePick = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev.length >= 11 ? prev : [...prev, id]));
  };

  const submitTeam = async () => {
    if (!gw || !captain) return;
    setBusy('team');
    const res = await briefApi.submitLigiTeam(gw.gameweek.id, picked, captain);
    setBusy(null);
    onToast?.(res.ok ? 'Eleven locked in.' : res.error);
    if (res.ok) void load();
  };

  const stake = async (mode: 'over_under' | 'confidence', playerId?: string, side?: 'over' | 'under') => {
    if (!gw) return;
    setBusy('wager');
    const res = await briefApi.placeLigiWager(gw.gameweek.id, { mode, units: wagerUnits, playerId, side });
    setBusy(null);
    onToast?.(res.ok ? `${wagerUnits} units staked. ${res.data.unitsRemaining} left.` : res.error);
    if (res.ok) void load();
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FFFFFF] px-4 py-4">
        <p className="text-[11px] font-extrabold text-[#111111]">Ligi is not reachable</p>
        <p className="mt-1 text-[10px] leading-snug text-[#111111]/55">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="px-1 py-6 text-[11px] text-[#111111]/45">Loading Ligi…</p>;
  }

  return (
    <section className="space-y-3" data-testid="ligi">
      {/* Header ------------------------------------------------------------ */}
      <div className="rounded-2xl border border-[#111111] bg-[#111111] px-4 py-3.5 text-[#FFFFFF]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#FFFFFF]/60">
              Priority · African fantasy football
            </p>
            <h2 className="mt-0.5 font-display text-[20px] font-semibold tracking-tight">{data.game.name}</h2>
            <p className="mt-0.5 text-[11px] text-[#FFFFFF]/70">{data.game.tagline}</p>
          </div>
        </div>
        <p className="mt-2 text-[9.5px] leading-snug text-[#FFFFFF]/55">
          Weeks open, lock, price and settle on their own — on the system clock, not on a button. No commissioner sets a line and nobody scores a week by hand.
        </p>
      </div>

      {/* No season yet ------------------------------------------------------ */}
      {!data.season && (
        <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FFFFFF] px-4 py-4">
          <p className="text-[11px] font-extrabold text-[#111111]">No season is running yet</p>
          <p className="mt-1 text-[10px] leading-snug text-[#111111]/55">
            Ligi runs over real African competitions — {data.leagues.slice(0, 4).map((l) => l.name).join(', ')} and{' '}
            {data.leagues.length - 4} more. A season schedules its gameweeks the moment it is opened, and nothing is
            invented before real squads and real match stats arrive.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {data.leagues.map((l) => (
              <span key={l.id} className="rounded-full border border-[#E5E7EB] px-2 py-1 text-[9.5px] font-bold text-[#111111]/70">
                {l.name} · {l.country}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Season + gameweek -------------------------------------------------- */}
      {data.season && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#111111]/45">
                {data.season.leagueName} · {data.season.country}
              </p>
              <h3 className="mt-0.5 text-[14px] font-extrabold tracking-tight text-[#111111]">{data.season.name}</h3>
            </div>
            <StatusChip status={gw?.gameweek.status ?? data.season.status} />
          </div>

          {gw && (
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Gameweek', `${gw.gameweek.index} of ${data.season.gameweekCount}`],
                ['Kickoff', when(gw.gameweek.kickoffAt)],
                ['Managers in', String(gw.entryCount)],
                ['Results', gw.readiness.ready ? 'Complete' : `${gw.readiness.missing} missing`]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#E5E7EB] px-2.5 py-2">
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-[#111111]/40">{label}</p>
                  <p className="mt-0.5 text-[11.5px] font-extrabold text-[#111111]">{value}</p>
                </div>
              ))}
            </div>
          )}

          {gw && !gw.readiness.ready && gw.gameweek.status !== 'open' && gw.readiness.reason && (
            <p className="mt-2 text-[10px] leading-snug text-[#111111]/55">
              Not settled: {gw.readiness.reason}. Nothing is scored until the real numbers land.
            </p>
          )}
        </div>
      )}

      {/* Slots -------------------------------------------------------------- */}
      <div className="grid gap-2 sm:grid-cols-2">
        {data.slots.map((slot) => (
          <div
            key={slot.id}
            data-slot={slot.id}
            className={`rounded-2xl border px-4 py-3.5 ${slot.available ? 'border-[#111111] bg-[#FFFFFF]' : 'border-[#E5E7EB] bg-[#FAFAFA]'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-extrabold text-[#111111]">{slot.label}</p>
              {slot.available ? (
                <Coins className="h-3.5 w-3.5 text-[#111111]" />
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#111111]/45">
                  <Lock className="h-3 w-3" /> Refused
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-[#111111]/60">{slot.detail}</p>
            {slot.id === 'cash' && typeof slot.priceKes === 'number' && slot.priceKes > 0 && (
              <p className="mt-1 text-[10px] font-bold text-[#111111]/50">Would be KES {slot.priceKes.toLocaleString()}.</p>
            )}
            {slot.id === 'cash' && slot.compliance && !slot.compliance.enabled && (
              <ul className="mt-2 space-y-0.5">
                {slot.compliance.requirements.filter((r) => !r.met).map((r) => (
                  <li key={r.id} className="text-[9.5px] leading-snug text-[#111111]/55">• {r.label}</li>
                ))}
              </ul>
            )}
            {gw && gw.gameweek.status === 'open' && !me && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void takeSeat(slot.id)}
                className={`mt-2.5 w-full rounded-xl px-3 py-2 text-[11px] font-extrabold disabled:opacity-40 cursor-pointer ${
                  slot.available ? 'bg-[#111111] text-[#FFFFFF]' : 'border border-[#E5E7EB] text-[#111111]/60'
                }`}
              >
                {busy === slot.id ? 'Asking…' : slot.available ? 'Take the free seat' : 'Try the cash seat'}
              </button>
            )}
          </div>
        ))}
      </div>

      {gate && (
        <div className="rounded-2xl border border-[#111111] bg-[#FFFFFF] px-4 py-3">
          <p className="text-[11px] font-extrabold text-[#111111]">The house cannot take a cash stake here</p>
          <ul className="mt-1 space-y-0.5">
            {gate.map((g) => <li key={g} className="text-[10px] text-[#111111]/60">• {g}</li>)}
          </ul>
        </div>
      )}

      {/* Pick the eleven ----------------------------------------------------- */}
      {gw && me && !gw.locked && pool.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-extrabold text-[#111111]">Your eleven</p>
            <p className="text-[10px] font-bold text-[#111111]/50">{picked.length}/11 picked</p>
          </div>
          <div className="mt-2 space-y-2">
            {POSITION_ORDER.map((position) => (
              <div key={position}>
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/40">{position}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {pool.filter((p) => p.position === position).map((p) => {
                    const on = picked.includes(p.id);
                    const line = lineFor(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-player={p.id}
                        onClick={() => togglePick(p.id)}
                        className={`rounded-xl border px-2.5 py-1.5 text-left text-[10.5px] font-bold transition cursor-pointer ${
                          on ? 'border-[#111111] bg-[#111111] text-[#FFFFFF]' : 'border-[#E5E7EB] text-[#111111]'
                        }`}
                      >
                        <span className="block">{p.name}</span>
                        <span className={`block text-[9px] ${on ? 'text-[#FFFFFF]/65' : 'text-[#111111]/45'}`}>
                          {p.club}{line ? ` · line ${line.line}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <select
              value={captain ?? ''}
              onChange={(e) => setCaptain(e.target.value || null)}
              aria-label="Captain"
              className="rounded-xl border border-[#E5E7EB] px-2.5 py-2 text-[11px] font-bold text-[#111111]"
            >
              <option value="">Choose a captain (x2)</option>
              {pool.filter((p) => picked.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null || picked.length !== 11 || !captain}
              onClick={() => void submitTeam()}
              className="rounded-xl bg-[#111111] px-3.5 py-2 text-[11px] font-extrabold text-[#FFFFFF] disabled:opacity-40 cursor-pointer"
            >
              {busy === 'team' ? 'Submitting…' : 'Submit eleven'}
            </button>
          </div>
        </div>
      )}

      {/* The house lines ------------------------------------------------------ */}
      {gw && me && lines.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-extrabold text-[#111111]">The house line</p>
              <p className="mt-0.5 text-[9.5px] leading-snug text-[#111111]/55">
                Median of the player's settled weeks this season, or the published baseline if they have none. Derived,
                not decided.
              </p>
            </div>
            <p className="text-[10px] font-extrabold text-[#111111]">{me.unitsRemaining} units left</p>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label className="text-[10px] font-bold text-[#111111]/55" htmlFor="ligi-units">Stake</label>
            <input
              id="ligi-units"
              type="number"
              min={1}
              max={me.unitsRemaining}
              value={wagerUnits}
              onChange={(e) => setWagerUnits(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-xl border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] font-bold text-[#111111]"
            />
            <button
              type="button"
              disabled={busy !== null || !me.team}
              onClick={() => void stake('confidence')}
              title="Ride the units on your own eleven"
              className="rounded-xl border border-[#111111] px-2.5 py-1.5 text-[10px] font-extrabold text-[#111111] disabled:opacity-40 cursor-pointer"
            >
              Confidence stack
            </button>
          </div>

          <div className="mt-2 divide-y divide-[#E5E7EB]">
            {lines.slice(0, 12).map((l) => (
              <div key={l.playerId} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-extrabold text-[#111111]">{l.name}</p>
                  <p className="text-[9px] text-[#111111]/45">{l.position} · {l.club} · {l.basis.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-[#111111]">{l.line}</span>
                  <button
                    type="button"
                    disabled={busy !== null || gw.locked}
                    onClick={() => void stake('over_under', l.playerId, 'over')}
                    className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9.5px] font-extrabold text-[#111111] disabled:opacity-40 cursor-pointer"
                  >
                    Over
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || gw.locked}
                    onClick={() => void stake('over_under', l.playerId, 'under')}
                    className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9.5px] font-extrabold text-[#111111] disabled:opacity-40 cursor-pointer"
                  >
                    Under
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This week's wagers ---------------------------------------------------- */}
      {me && me.wagers.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5">
          <p className="text-[12px] font-extrabold text-[#111111]">Your week</p>
          <div className="mt-1.5 space-y-1">
            {me.wagers.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="font-bold text-[#111111]">
                  {w.mode.replace(/_/g, '/')} · {w.units} units
                </span>
                <span className={`font-extrabold ${w.outcome === 'won' ? 'text-[#0F7B4F]' : w.outcome === 'lost' ? 'text-[#B42318]' : 'text-[#111111]/50'}`}>
                  {w.settled ? `${w.outcome} · ${w.unitsReturned} back` : 'running'}
                </span>
              </div>
            ))}
          </div>
          {me.entry.settledAt && (
            <p className="mt-2 text-[10px] font-bold text-[#111111]/60">
              {me.entry.teamPoints} points · {me.entry.netUnits! >= 0 ? '+' : ''}{me.entry.netUnits} units
              {me.entry.won ? ' · week won' : ''}
            </p>
          )}
        </div>
      )}

      {/* The two ladders -------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {([['season', 'Season'], ['streak', 'Week streaks']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLadder(id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold cursor-pointer ${
                ladder === id ? 'bg-[#111111] text-[#FFFFFF]' : 'bg-[#FAFAFA] text-[#111111]/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {ladder === 'season' && (
          <div className="mt-2">
            {data.table.length === 0 ? (
              <p className="text-[10px] text-[#111111]/50">
                No week has settled yet, so there is no table. It fills itself the moment one does.
              </p>
            ) : (
              data.table.map((row) => (
                <div key={row.userId} className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] py-1.5 last:border-0">
                  <span className="flex items-center gap-2 text-[11px] font-extrabold text-[#111111]">
                    <span className="w-5 text-[#111111]/40">{row.rank}</span>
                    {row.userId === meId ? 'You' : row.userId.slice(0, 12)}
                  </span>
                  <span className="flex items-center gap-3 text-[10.5px] font-bold text-[#111111]/70">
                    <span><Trophy className="mr-1 inline h-3 w-3" />{row.points}</span>
                    <span>{row.netUnits >= 0 ? '+' : ''}{row.netUnits} u</span>
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {ladder === 'streak' && (
          <div className="mt-2">
            {data.streaks.length === 0 ? (
              <p className="text-[10px] text-[#111111]/50">
                Streaks start at the first settled week. {data.rules.house.streakWinRule}.
              </p>
            ) : (
              data.streaks.map((row) => (
                <div key={row.userId} className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] py-1.5 last:border-0">
                  <span className="text-[11px] font-extrabold text-[#111111]">
                    {row.userId === meId ? 'You' : row.userId.slice(0, 12)}
                  </span>
                  <span className="flex items-center gap-3 text-[10.5px] font-bold text-[#111111]/70">
                    <span><Flame className="mr-1 inline h-3 w-3" />{row.current} now</span>
                    <span>{row.longest} best</span>
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="px-1 text-[9.5px] leading-snug text-[#111111]/45">
        Units are a scoring device: {data.rules.house.weeklyUnits} a week, they do not roll over, and they are not money.
        Real-money seats stay refused until this deployment holds a gaming licence.
      </p>
    </section>
  );
}

export default Ligi;
