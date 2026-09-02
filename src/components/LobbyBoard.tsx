import React from 'react';
import { Copy, Plus, Users } from 'lucide-react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// LOBBY BOARD — the 1-tap private-lobby code board (Arena integration).
//
// The market-standard "invite code + join" pattern for private game rooms. A
// host drops their in-game room code; players tap to copy it and join. The
// host flags it "started" and the code disappears so nobody wastes time on a
// closed room. Host reputation (Verified Lobby Master) is DERIVED from real
// vouches and shown beside their rooms.
//
// Nothing here invents game state — Brief carries the code the host's own
// lobby produced; the game owns the match. Rooms are real server rows.
// ---------------------------------------------------------------------------

interface Room {
  id: string;
  gameId: string;
  code: string | null;
  mode: string | null;
  maxSlots: number;
  slotsTaken: number;
  slotsOpen: number;
  status: string;
  hostId: string;
  hostTrust: { up: number; down: number; verified: boolean; label: string | null };
}

export function LobbyBoard({ gameId }: { gameId: string }) {
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready'>('loading');
  const [code, setCode] = React.useState('');
  const [mode, setMode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await briefApi.getLobbyRooms(gameId);
    if (res.ok) { setRooms(res.data as Room[]); setStatus('ready'); }
    else setStatus('ready');
  }, [gameId]);

  React.useEffect(() => { void load(); }, [load]);

  const copy = async (c: string) => {
    try { await navigator.clipboard.writeText(c); } catch { /* clipboard unavailable */ }
    setCopied(c);
    setTimeout(() => setCopied(null), 1500);
  };

  const [vouchBusy, setVouchBusy] = React.useState<string | null>(null);
  const vouch = async (hostId: string, up: boolean) => {
    setVouchBusy(hostId);
    await briefApi.vouchHost(hostId, up);
    setVouchBusy(null);
    await load();
  };

  const host = async () => {
    if (!code.trim()) return;
    setBusy(true);
    await briefApi.hostLobbyRoom({ gameId, code: code.trim(), mode: mode.trim() || null, maxSlots: 8 });
    setBusy(false);
    setCode(''); setMode('');
    await load();
  };

  const claim = async (r: Room) => {
    await briefApi.claimLobbySlot(r.id);
    await load();
  };

  const start = async (r: Room) => {
    await briefApi.startLobbyRoom(r.id);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[var(--brief-green)]">Rooms</h3>
        <span className="text-[10px] text-[#0D1117]/60">{rooms.length} room{rooms.length === 1 ? '' : 's'} open</span>
      </div>

      {/* Host a room — the 1-tap path */}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
          placeholder="Room code (4-8 digits)"
          className="flex-1 rounded-lg border border-[#E5E8EC] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0D1117] outline-none focus:border-[#2563EB]"
        />
        <input
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          placeholder="Mode (e.g. S&D)"
          className="hidden sm:block w-32 rounded-lg border border-[#E5E8EC] bg-[#FFFFFF] px-3 py-2 text-[12px] text-[#0D1117] outline-none focus:border-[#2563EB]"
        />
        <button
          onClick={() => void host()}
          disabled={busy || code.length < 4}
          className="flex items-center gap-1 rounded-lg bg-[#FF5A1F] px-3 py-2 text-[12px] font-bold text-[#0D1117] disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Host
        </button>
      </div>

      {status === 'loading' ? (
        <p className="text-[11px] text-[#0D1117]/60">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="text-[11px] text-[#0D1117]/60">No rooms open. Host one and drop the code.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#E5E8EC] bg-[#FFFFFF] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[16px] font-bold text-[#0D1117]">{r.code}</span>
                  {r.mode && <span className="text-[10px] text-[#0D1117]/60">· {r.mode}</span>}
                  {r.hostTrust?.verified && (
                    <span className="rounded-full bg-[#FF5A1F]/10 px-2 py-0.5 text-[9px] font-bold text-[#0D1117]">✓ {r.hostTrust.label}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#0D1117]/60">
                  <Users className="h-3 w-3" />
                  <span>{r.slotsTaken}/{r.maxSlots} filled</span>
                </div>
                {/* Host trust is a tally of real vouches, never a score. The
                    buttons record YOUR vouch either way; the totals come back
                    from the server. */}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#0D1117]/60">
                  <span>host vouches:</span>
                  <button
                    onClick={() => void vouch(r.hostId, true)}
                    disabled={vouchBusy === r.hostId}
                    className="rounded-md border border-[#E5E8EC] px-1.5 py-0.5 text-[10px] font-bold text-[#0D1117] cursor-pointer disabled:opacity-50"
                    aria-label="vouch for this host"
                  >
                    ▲ {r.hostTrust?.up ?? 0}
                  </button>
                  <button
                    onClick={() => void vouch(r.hostId, false)}
                    disabled={vouchBusy === r.hostId}
                    className="rounded-md border border-[#E5E8EC] px-1.5 py-0.5 text-[10px] font-bold text-[#0D1117]/60 cursor-pointer disabled:opacity-50"
                    aria-label="vouch against this host"
                  >
                    ▼ {r.hostTrust?.down ?? 0}
                  </button>
                </div>
              </div>
              <button
                onClick={() => void copy(r.code ?? '')}
                className="brief-tap rounded-lg border border-[var(--brief-line)] px-3 py-1.5 text-[12px] font-bold text-[var(--brief-green)] hover:border-[var(--brief-green)] cursor-pointer"
              >
                {copied === r.code ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => void claim(r)}
                className="rounded-lg border border-[#E5E8EC] px-3 py-1.5 text-[11px] font-bold text-[#0D1117] hover:border-[#2563EB] cursor-pointer"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LobbyBoard;
