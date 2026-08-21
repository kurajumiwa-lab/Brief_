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
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#4edea3]">Lobby Board</h3>
        <span className="text-[10px] text-[#86948a]">{rooms.length} room{rooms.length === 1 ? '' : 's'} open</span>
      </div>

      {/* Host a room — the 1-tap path */}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
          placeholder="Room code (4-8 digits)"
          className="flex-1 rounded-lg border border-[#3c4a42] bg-[#1c1f29] px-3 py-2 text-[12px] text-[#dfe2ef] outline-none focus:border-[#4edea3]"
        />
        <input
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          placeholder="Mode (e.g. S&D)"
          className="hidden sm:block w-32 rounded-lg border border-[#3c4a42] bg-[#1c1f29] px-3 py-2 text-[12px] text-[#dfe2ef] outline-none focus:border-[#4edea3]"
        />
        <button
          onClick={() => void host()}
          disabled={busy || code.length < 4}
          className="flex items-center gap-1 rounded-lg bg-[#10b981] px-3 py-2 text-[12px] font-bold text-[#00422b] disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Host
        </button>
      </div>

      {status === 'loading' ? (
        <p className="text-[11px] text-[#86948a]">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="text-[11px] text-[#86948a]">No rooms open. Host one and drop the code.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#3c4a42] bg-[#1c1f29] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[16px] font-bold text-[#dfe2ef]">{r.code}</span>
                  {r.mode && <span className="text-[10px] text-[#bbcabf]">· {r.mode}</span>}
                  {r.hostTrust?.verified && (
                    <span className="rounded-full bg-[#00a6e0]/20 px-2 py-0.5 text-[9px] font-bold text-[#7bd0ff]">✓ {r.hostTrust.label}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#86948a]">
                  <Users className="h-3 w-3" />
                  <span>{r.slotsTaken}/{r.maxSlots} filled</span>
                </div>
              </div>
              <button
                onClick={() => void copy(r.code ?? '')}
                className="rounded-lg border border-[#3c4a42] px-3 py-1.5 text-[11px] font-bold text-[#4edea3] hover:border-[#4edea3] cursor-pointer"
              >
                {copied === r.code ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => void claim(r)}
                className="rounded-lg border border-[#3c4a42] px-3 py-1.5 text-[11px] font-bold text-[#dfe2ef] hover:border-[#4edea3] cursor-pointer"
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
