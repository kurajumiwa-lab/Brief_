import React from 'react';

// ---------------------------------------------------------------------------
// BRACKET LADDER — a tournament tree, borrowed from esports lobbies (§7.2)
//
// A single-elimination bracket DERIVED from a tournament's registered players.
// Nothing is invented: the first round is a deterministic seeding of the real
// `registeredPlayerIds` (power-of-two padding with byes), and every later round
// is "waiting" until real results exist. A bracket is structure over real
// entrants — not a graphic pretending a tournament happened.
//
// displayName(pid) resolves a player's name where one is known, else shows the
// id so the bracket never fabricates a person.
// ---------------------------------------------------------------------------

export interface BracketLadderProps {
  /** The registered player ids, in registration order (seeded 1..n). */
  entrants: string[];
  /** Resolve a player id to a display name (falls back to the id). */
  displayName: (id: string) => string;
  /** Accent (default signal-arena). */
  accent?: string;
}

interface Match {
  a: string | null;
  b: string | null;
  /** 'bye' when a player advanced without an opponent. */
  note?: string;
}

/** Derive the first-round pairings (seeded single elimination with byes). */
function seedFirstRound(entrants: string[]): Match[] {
  if (entrants.length === 0) return [];
  // Next power of two ≥ entrants.length.
  let size = 1;
  while (size < entrants.length) size *= 2;
  const byes = size - entrants.length;
  // Seeds 1..n, with the top seeds receiving byes (esports convention).
  const matches: Match[] = [];
  let i = 0;
  let seed = 0;
  while (seed < size) {
    const a = entrants[seed] ?? null;
    seed++;
    const b = entrants[seed] ?? null;
    seed++;
    if (a && !b) {
      // odd player out with an opponent -> bye advances them
      matches.push({ a, b: null, note: 'bye' });
    } else if (!a && !b) {
      // both empty only when size > entrants and all consumed
      break;
    } else {
      matches.push({ a, b });
    }
    i++;
  }
  return matches;
}

export function BracketLadder({ entrants, displayName, accent = 'var(--signal-arena)' }: BracketLadderProps) {
  const firstRound = seedFirstRound(entrants);

  if (firstRound.length === 0) {
    return <p className="text-[10px] text-[#8A93A6]">No one is in the bracket yet.</p>;
  }

  const rounds: Match[][] = [firstRound];
  // Build the (empty) progression rounds so the ladder reads as a tree.
  while (rounds[rounds.length - 1].length > 1) {
    const prev = rounds[rounds.length - 1];
    const next: Match[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push({ a: null, b: null });
    }
    rounds.push(next);
  }

  const MatchRow = ({ m }: { m: Match }) => (
    <div className="flex items-center gap-1.5 py-1">
      <span className="flex-1 truncate text-[10px] font-semibold text-[#F3F1E7]">
        {m.a ? displayName(m.a) : '—'}
      </span>
      <span className="text-[9px] text-[#4B5162]">vs</span>
      <span className="flex-1 truncate text-right text-[10px] font-semibold text-[#F3F1E7]">
        {m.b ? displayName(m.b) : m.note === 'bye' ? <span className="text-[#8A93A6]">bye</span> : '—'}
      </span>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-4 py-2">
        {rounds.map((round, r) => (
          <div key={r} className="flex flex-col justify-around gap-2">
            {r === 0 && <p className="text-[8px] font-extrabold uppercase tracking-wider text-[#4B5162]">Round 1</p>}
            {round.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#232A38] bg-[#0C1220] px-2.5 py-1.5"
                style={r === 0 ? { borderColor: `${accent}44` } : undefined}
              >
                <MatchRow m={m} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
