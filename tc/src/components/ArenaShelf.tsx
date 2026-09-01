import React from 'react';
import type { ArenaGame, ArenaGameId } from '../App';
import { themeFor } from './arenaTheme';
import { soundEngine } from '../utils/SoundEngine';

// ---------------------------------------------------------------------------
// ARENA SHELF — the minimalist, image-forward game selector.
//
// A tidy shelf of cover tiles. Each tile is KEY-ART FIRST and PROVIDER
// FORWARD: the publisher mark sits over the art as the highlight identity,
// with the title and live activity beneath. Tapping a tile opens the
// secondary match-setup screen (ArenaGameScreen).
//
// COLOUR SYSTEM (site-wide minimalist re-theme):
//   • the tile is IMAGERY carrying a dark veil — text over it is WHITE
//   • chrome (borders, provider badge) is strictly neutral: ink-black badge
//     with white type, hairline border at rest, black border when live
//   • the section header sits on the light page and is BLACK
//
// Honesty is unchanged: the LIVE/QUIET chip and the "N open" count come from
// real activity passed in; nothing here fabricates a player count or a room.
// ---------------------------------------------------------------------------

export interface ArenaShelfProps {
  games: ArenaGame[];
  activity: Record<string, number>;
  onOpen: (id: ArenaGameId) => void;
}

export function ArenaShelf({ games, activity, onOpen }: ArenaShelfProps) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#251045]">
            Your games
          </h3>
          <p className="text-[10px] text-[#251045]/60 mt-0.5">Tap a title to set up a match</p>
        </div>
      </div>

      {/* Horizontal scroll shelf on phones; tidy grid on larger screens. */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
        {games.map((g) => {
          const theme = themeFor(g.id);
          const count = activity[g.id] ?? 0;
          const live = count > 0;
          return (
            <button
              key={g.id}
              type="button"
              data-game-id={g.id}
              onClick={() => {
                soundEngine.play('tap');
                onOpen(g.id);
              }}
              aria-label={`Open ${g.name}`}
              className="group snap-start shrink-0 w-[150px] sm:w-[164px] md:w-auto text-left cursor-pointer focus:outline-none"
            >
              <div
                className="relative aspect-[3/4] rounded-2xl overflow-hidden border transition-all"
                style={{ borderColor: live ? '#251045' : '#D6CFE4' }}
              >
                <img
                  src={theme.art}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                />
                {/* legibility veil — heavier toward the bottom where text sits */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(9,11,16,0.10) 0%, rgba(9,11,16,0.05) 32%, rgba(9,11,16,0.55) 68%, rgba(9,11,16,0.94) 100%)'
                  }}
                />

                {/* provider mark — the highlight identity, ink on white rules
                    reversed: black badge, white type. */}
                <div className="absolute top-2.5 left-2.5">
                  <span
                    className="text-[8px] font-extrabold tracking-[0.2em] px-1.5 py-0.5 rounded-md"
                    style={{ color: '#FFFFFF', background: '#251045' }}
                  >
                    {theme.providerMark}
                  </span>
                </div>

                {/* live chip — real activity only; white type over the art */}
                <span
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide"
                  style={{
                    // Solid enough to keep white type readable over any art.
                    background: 'rgba(9,11,16,0.9)',
                    color: '#FFFFFF',
                    border: `1px solid ${live ? '#FFFFFF' : 'rgba(255,255,255,0.28)'}`
                  }}
                >
                  <span
                    className="inline-block h-1 w-1 rounded-full"
                    style={{ background: live ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }}
                  />
                  {live ? 'LIVE' : 'QUIET'}
                </span>

                {/* title block — white over the veiled art (dark surface) */}
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#FFFFFF]/75">
                    {theme.provider}
                  </p>
                  <h4 className="text-[13px] font-extrabold leading-tight text-[#FFFFFF]">
                    {g.shortName}
                  </h4>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-mono text-[#FFFFFF]/70">
                      {live ? `${count} open now` : 'no open matches'}
                    </span>
                    <span
                      className="text-[9px] font-extrabold text-[#FFFFFF] opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Open →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default ArenaShelf;
