import React from 'react';
import * as briefApi from '../api/briefApi';
import type { EplRoomRow, EplCatalogPlayer } from '../api/briefApi';

// ---------------------------------------------------------------------------
// EPL CONTEST DESK (Tikiti T5) — Arena's English-football room.
//
// Licensed-data honesty is the spine of this surface:
//   * the catalog states where its rows come from (source: seed vs provider)
//     and the provider panel says plainly when no provider is configured —
//     SEED rows only, never an invented player,
//   * a room's lobby state (waiting/open/full/in_progress/…) is DERIVED by
//     the server from real bounds and a live entry count,
//   * the waiting-room wall: settle cancels an underfilled room with the
//     reason, and locks a filled one. No walkover scoring.
//   * seats are priced by nobody here — the budget is whole shillings and the
//     server does the arithmetic; cash entry stays behind the compliance gate.
// ---------------------------------------------------------------------------

const LOBBY_STYLE: Record<string, string> = {
  waiting_for_players: 'bg-[#E5E8EC] text-[#0D1117]/60',
  open: 'bg-[#FF5A1F] text-[#0D1117]',
  full: 'bg-[#E5E8EC] text-[#0D1117]',
  in_progress: 'bg-[#FF5A1F] text-[#0D1117]',
  completed: 'bg-[#FFFFFF] text-[#0D1117]',
  cancelled: 'bg-[#E5E8EC] text-[#0D1117]/60'
};
const LOBBY_LABEL: Record<string, string> = {
  waiting_for_players: 'waiting for players',
  open: 'open',
  full: 'full',
  in_progress: 'in progress',
  completed: 'completed',
  cancelled: 'cancelled'
};

export function EplDesk({ meId, onToast }: { meId: string | null; onToast: (msg: string) => void }) {
  const [rooms, setRooms] = React.useState<EplRoomRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [providerNote, setProviderNote] = React.useState<string | null>(null);
  const [clubs, setClubs] = React.useState<string[]>([]);

  // Create-room form.
  const [title, setTitle] = React.useState('');
  const [kickoff, setKickoff] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [minEntries, setMinEntries] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [formNote, setFormNote] = React.useState<string | null>(null);

  // Selected room: pool + standings.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pool, setPool] = React.useState<EplCatalogPlayer[] | null>(null);
  const [picks, setPicks] = React.useState<string[]>([]);
  const [captainId, setCaptainId] = React.useState<string | null>(null);
  const [seatNote, setSeatNote] = React.useState<string | null>(null);
  const [standings, setStandings] = React.useState<{ userId: string; points: number | null; rank: number | null }[] | null>(null);

  const loadRooms = React.useCallback(async () => {
    setError(null);
    const res = await briefApi.listEplRooms();
    if (res.ok) setRooms(res.data);
    else { setRooms([]); setError(res.error); }
  }, []);

  React.useEffect(() => { void loadRooms(); }, [loadRooms]);

  React.useEffect(() => {
    void briefApi.getEplClubs().then((res) => {
      if (res.ok) {
        setClubs(res.data.clubs.map((c) => c.name));
        const p = res.data.provider;
        setProviderNote(p.configured
          ? 'Live provider configured.'
          : (p.reason ?? 'No EPL data provider configured; SEED rows only.'));
      }
    });
  }, []);

  const selected = (rooms ?? []).find((r) => r.id === selectedId) ?? null;

  const loadRoomDetail = React.useCallback(async (id: string) => {
    setSeatNote(null);
    // THE PICKER READS THE ROOM'S OWN POOL. Its rows are distinct from the
    // catalog rows they were imported from; picking catalog ids was refused
    // by the server as 'unknown player' -- the last link in the dead-end.
    const [poolRes, st] = await Promise.all([
      briefApi.getEplPool(id),
      briefApi.getEplStandings(id)
    ]);
    if (poolRes.ok) setPool(poolRes.data.players);
    if (st.ok) setStandings(st.data.standings);
  }, []);

  React.useEffect(() => {
    setPicks([]); setCaptainId(null); setStandings(null);
    if (selectedId) void loadRoomDetail(selectedId);
  }, [selectedId, loadRoomDetail]);

  const createRoom = async () => {
    if (!title.trim() || !kickoff || busy) return;
    setBusy(true);
    setFormNote(null);
    const res = await briefApi.createEplRoom({
      title: title.trim(),
      kickoffAt: new Date(kickoff).toISOString(),
      budgetKes: budget.trim() ? Number(budget) : null,
      minEntries: minEntries.trim() ? Number(minEntries) : null
    });
    setBusy(false);
    if (!res.ok) { setFormNote(res.error); return; }
    setTitle(''); setKickoff(''); setBudget(''); setMinEntries('');
    setFormNote(`Room created (${res.data.lobbyState.replace(/_/g, ' ')}). Import its player pool next.`);
    await loadRooms();
    setSelectedId(res.data.competition.id);
  };

  const importPool = async (id: string) => {
    setBusy(true);
    setFormNote(null);
    const res = await briefApi.importEplPool(id);
    setBusy(false);
    if (!res.ok) { setFormNote(res.error); return; }
    setFormNote(
      `${res.data.imported} catalog players imported — the room is ${res.data.opened ? 'OPEN for picking' : 'still a draft'}`
      + (res.data.openNote ? ` (${res.data.openNote})` : '')
    );
    await loadRooms();
    if (selectedId === id) await loadRoomDetail(id);
  };

  const settle = async (id: string) => {
    setBusy(true);
    setFormNote(null);
    const res = await briefApi.settleEplLobby(id);
    setBusy(false);
    if (!res.ok) { setFormNote(res.error); return; }
    onToast(res.data.competition.status === 'cancelled'
      ? `Room cancelled — ${res.data.competition.cancelledReason ?? 'underfilled'}.`
      : `Room ${res.data.lobbyState.replace(/_/g, ' ')}.`);
    await loadRooms();
  };

  const togglePick = (id: string) => {
    setPicks((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    setCaptainId((c) => (c === id ? null : c));
  };

  const seat = async () => {
    if (!selectedId || !captainId) return;
    setBusy(true);
    setSeatNote(null);
    const res = await briefApi.submitEplEntry(selectedId, { playerIds: picks, captainId });
    setBusy(false);
    if (!res.ok) { setSeatNote(res.error); return; }
    setSeatNote(res.data.created
      ? `Seated — your XI is in (${res.data.entries} in the room).`
      : 'Your XI was updated in place.');
    await loadRooms();
  };

  const pickCount = picks.length;
  const spend = (pool ?? []).filter((p) => picks.includes(p.id)).reduce((t, p) => t + p.price, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#0D1117]">EPL contest rooms</h2>
        <p className="text-[10px] text-[#0D1117]/60 leading-snug">
          Pick an XI from the licensed catalog under a budget; the room fills or
          it is cancelled honestly at kickoff — no walkover scoring, no cash
          seats until the deployment is licensed.
        </p>
        {providerNote && (
          <p className="mt-1 text-[9px] leading-snug text-[#0D1117]/60">{providerNote}</p>
        )}
        {!meId && (
          <p className="mt-1 text-[10px] font-bold text-[#0D1117]/70">
            Browsing is open — sign in to open a room or seat an XI.
          </p>
        )}
      </div>

      {/* create a room */}
      <div className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">Open a room</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Room name (e.g. GW4 Nairobi)"
            aria-label="room name"
            className="min-w-[160px] flex-1 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117]"
          />
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            aria-label="kickoff"
            className="rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-2 text-[12px] text-[#0D1117]"
          />
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            inputMode="numeric"
            placeholder="Budget KSh"
            aria-label="squad budget"
            className="w-28 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117]"
          />
          <input
            value={minEntries}
            onChange={(e) => setMinEntries(e.target.value)}
            inputMode="numeric"
            placeholder="Min managers"
            aria-label="minimum managers"
            className="w-28 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117]"
          />
          <button
            type="button"
            onClick={() => void createRoom()}
            disabled={busy || !title.trim() || !kickoff}
            className="rounded-lg bg-[#FF5A1F] px-4 py-2 text-[11px] font-extrabold text-[#0D1117] cursor-pointer disabled:opacity-40"
          >
            {busy ? '…' : 'Open room'}
          </button>
        </div>
        {formNote && <p className="text-[11px] text-[#0D1117]">{formNote}</p>}
      </div>

      {error && <p className="text-xs text-[#0D1117]">{error}</p>}
      {rooms === null && <p className="text-xs text-[#0D1117]/60">Loading rooms…</p>}
      {rooms !== null && rooms.length === 0 && !error && (
        <p className="text-xs text-[#0D1117]/60">No rooms yet. Open one — the waiting room is honest about being empty.</p>
      )}

      {/* rooms */}
      <div className="space-y-2">
        {(rooms ?? []).map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border bg-[#FFFFFF] p-3.5 space-y-2 ${selectedId === r.id ? 'border-[#2563EB]' : 'border-[#E5E8EC]'}`}
          >
            <button
              type="button"
              onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
              className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#0D1117] truncate">
                  {r.title}{r.mine ? ' · yours' : ''}
                </p>
                <p className="text-[10px] text-[#0D1117]/60">
                  kickoff {r.kickoffAt.slice(0, 16).replace('T', ' ')}
                  {r.budgetKes != null ? ` · budget KSh ${r.budgetKes.toLocaleString()}` : ''}
                  {r.minEntries != null ? ` · needs ${r.minEntries}` : ''}
                  {` · ${r.entries} seated`}
                </p>
              </div>
              <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${LOBBY_STYLE[r.lobbyState] ?? LOBBY_STYLE.open}`}>
                {LOBBY_LABEL[r.lobbyState] ?? r.lobbyState}
              </span>
            </button>

            {selectedId === r.id && (
              <div className="space-y-2 border-t border-[#E5E8EC] pt-2">
                {r.mine && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void importPool(r.id)}
                      disabled={busy}
                      className="rounded-lg border border-[#2563EB] px-3 py-1.5 text-[10px] font-extrabold text-[#0D1117] cursor-pointer disabled:opacity-40"
                    >
                      Import catalog pool
                    </button>
                    <button
                      type="button"
                      onClick={() => void settle(r.id)}
                      disabled={busy}
                      className="rounded-lg bg-[#FF5A1F] px-3 py-1.5 text-[10px] font-extrabold text-[#0D1117] cursor-pointer disabled:opacity-40"
                    >
                      Settle the waiting room
                    </button>
                  </div>
                )}

                {/* seat picker: the catalog the room drew from */}
                {pool !== null && pool.length > 0 && r.status !== 'cancelled' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#0D1117]/60">
                      <span>Pick 11 (1 GK · 3+ DEF · 2+ MID · 1+ FWD · max 3 per club)</span>
                      <span className={spend > (r.budgetKes ?? Infinity) ? 'font-extrabold text-[#0D1117]' : ''}>
                        {pickCount}/11 · KSh {spend.toLocaleString()}{r.budgetKes != null ? ` of ${r.budgetKes.toLocaleString()}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {pool.slice(0, 60).map((p) => {
                        const picked = picks.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePick(p.id)}
                            className={`text-left rounded-lg border px-2 py-1.5 cursor-pointer ${picked ? 'border-[#2563EB] bg-[#FF5A1F] text-[#0D1117]' : 'border-[#E5E8EC] bg-[#F0F2F5] text-[#0D1117]/70'}`}
                          >
                            <p className="text-[10px] font-extrabold truncate">{p.name}</p>
                            <p className={`text-[9px] ${picked ? 'text-[#0D1117]/70' : 'text-[#0D1117]/60'}`}>
                              {p.position} · {p.club} · {p.price}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={captainId ?? ''}
                        onChange={(e) => setCaptainId(e.target.value || null)}
                        aria-label="captain"
                        className="rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-2 text-[11px] text-[#0D1117]"
                      >
                        <option value="">Choose captain (×2)</option>
                        {pool.filter((p) => picks.includes(p.id)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void seat()}
                        disabled={busy || pickCount !== 11 || !captainId}
                        className="rounded-lg bg-[#FF5A1F] px-4 py-2 text-[11px] font-extrabold text-[#0D1117] cursor-pointer disabled:opacity-40"
                      >
                        {busy ? '…' : 'Seat my XI'}
                      </button>
                    </div>
                    {seatNote && <p className="text-[10px] text-[#0D1117] break-words">{seatNote}</p>}
                    <p className="text-[9px] leading-snug text-[#0D1117]/60">
                      Catalog rows are {pool[0]?.source === 'seed' ? 'SEED data (no provider configured) — real licensed data arrives when a provider is connected' : `from ${pool[0]?.source}`}.
                      Squad rules, the budget and the lock are enforced server-side.
                    </p>
                  </div>
                )}

                {standings !== null && standings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#0D1117]/60">Standings</p>
                    {standings.map((s) => (
                      <div key={s.userId} className="flex items-center justify-between text-[10px] text-[#0D1117]">
                        <span className="truncate">{s.userId === meId ? 'You' : s.userId}</span>
                        <span className="font-mono">{s.points ?? '—'} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[9px] leading-snug text-[#0D1117]/60">
        {clubs.length > 0 ? `${clubs.length} licensed EPL clubs in the catalog. ` : ''}
        Cash entry stays refused until this deployment holds a gaming licence — the compliance gate names what is missing.
      </p>
    </div>
  );
}

export default EplDesk;
