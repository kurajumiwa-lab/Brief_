import React from 'react';
import type { ArenaGame, ArenaGameId } from '../App';
import { themeFor } from './arenaTheme';

// ---------------------------------------------------------------------------
// ARENA PORTAL — the immersive game selector.
//
// Replaces the flat pill row with themed game portals. Each game renders its
// own world (background, accent, vocabulary) from the Game Theme Engine, and
// shows REAL activity — the open-matchroom + check-in count — never a
// fabricated "42 players online". "LIVE" appears only when activity is real.
//
// The whole portal is the "enter" affordance; a secondary "find" action maps
// to the real find-match view. Nothing here invents a money rail or a room.
// ---------------------------------------------------------------------------

export interface ArenaPortalProps {
  games: ArenaGame[];
  activity: Record<string, number>;
  selectedId: ArenaGameId;
  onSelect: (id: ArenaGameId) => void;
  onFind: () => void;
}

export function ArenaPortal({ games, activity, selectedId, onSelect, onFind }: ArenaPortalProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {games.map((g) => {
        const theme = themeFor(g.id);
        const live = (activity[g.id] ?? 0) > 0;
        const isSelected = selectedId === g.id;
        const count = activity[g.id] ?? 0;
        return (
          <button
            key={g.id}
            data-game-id={g.id}
            onClick={() => onSelect(g.id)}
            aria-pressed={isSelected}
            className="group relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer"
            style={{
              background: theme.background,
              borderColor: isSelected ? theme.accent : 'var(--hairline)',
              boxShadow: isSelected ? `0 0 0 1px ${theme.accent}, 0 0 28px ${theme.accent}33` : undefined
            }}
          >
            {/* ambient glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
              style={{ background: theme.accent }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
                  {theme.themeName}
                </p>
                <h3 className="mt-1 text-lg font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                  {g.name}
                </h3>
                <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--ink-dim)' }}>
                  {theme.tagline}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold"
                style={{
                  borderColor: live ? theme.accent : 'var(--hairline)',
                  color: live ? theme.accent : 'var(--ink-faint)'
                }}
              >
                {live ? theme.liveLabel : 'QUIET'}
              </span>
            </div>

            <div className="relative mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px]" style={{ color: live ? theme.accent : 'var(--ink-faint)' }}>
                {live
                  ? `${count} open now`
                  : 'Nothing open right now'}
              </span>
              <span
                className="text-[11px] font-bold underline-offset-2 group-hover:underline"
                style={{ color: isSelected ? theme.accent : 'var(--ink)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(g.id);
                  onFind();
                }}
              >
                {theme.findCta} →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ArenaPortal;
