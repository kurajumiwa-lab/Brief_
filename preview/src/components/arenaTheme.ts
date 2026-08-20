import type { ArenaGameId } from '../App';

// ---------------------------------------------------------------------------
// ARENA GAME THEME ENGINE
//
// The master-redesign core: each game carries its own visual identity and
// terminology, so selecting a game makes Arena feel like that game's world —
// while the platform underneath stays one Arena.
//
// Everything here is DATA, not per-component hardcoding. A game's theme drives
// its hero background, accent, tagline and vocabulary. Adding a game is one
// entry; the portal renders it without a code change.
//
// Honesty: these are cosmetic identities over the REAL Arena entities
// (players, challenges, matches, tournaments). They never invent a player
// count, a room, or a money rail — the portal reads live activity and the
// real compliance gate, exactly as the flat selector did.
// ---------------------------------------------------------------------------

export interface ArenaThemeConfig {
  id: ArenaGameId;
  /** The theme's name — the "world" the user is entering. */
  themeName: string;
  /** Primary accent (used for glows, borders, active state). */
  accent: string;
  /** Secondary accent (gradient partner). */
  accent2: string;
  /** Hero background: a CSS gradient — game-specific atmosphere. */
  background: string;
  /** One-line tagline under the game name. */
  tagline: string;
  /** Vocabulary: the live-state word and the two real CTAs. */
  liveLabel: string;
  enterCta: string;
  findCta: string;
}

export const ARENA_THEMES: Record<ArenaGameId, ArenaThemeConfig> = {
  efootball: {
    id: 'efootball',
    themeName: 'Neon Stadium',
    accent: '#43D17A',
    accent2: '#1E7A4B',
    background: 'linear-gradient(135deg, #06120B 0%, #0B2317 45%, #0A0F14 100%)',
    tagline: 'Ranked 1v1 and 2v2. Find a match, play, and record the result.',
    liveLabel: 'LIVE NOW',
    enterCta: 'Enter Stadium',
    findCta: 'Find Match'
  },
  fc_mobile: {
    id: 'fc_mobile',
    themeName: 'Player Cards',
    accent: '#3E8EFF',
    accent2: '#1D4FBF',
    background: 'linear-gradient(135deg, #060C1A 0%, #0B1E3E 45%, #0A0F14 100%)',
    tagline: 'Squad-based 1v1. Build a side and take on the next challenger.',
    liveLabel: 'LIVE EVENTS',
    enterCta: 'Enter Club',
    findCta: 'Find Opponent'
  },
  ea_fc: {
    id: 'ea_fc',
    themeName: 'Ultimate Club',
    accent: '#B98CE0',
    accent2: '#5B3E86',
    background: 'linear-gradient(135deg, #0E0A16 0%, #1A1130 45%, #0A0F14 100%)',
    tagline: 'Squad and career play. Restricted account transfer — see terms.',
    liveLabel: 'LIVE EVENTS',
    enterCta: 'Enter Club',
    findCta: 'Find Opponent'
  },
  pubg: {
    id: 'pubg',
    themeName: 'Battle Zone',
    accent: '#E8A33D',
    accent2: '#8A5A14',
    background: 'linear-gradient(135deg, #160F04 0%, #241A08 45%, #0A0F14 100%)',
    tagline: 'Squad play and scrims. Drop in, link up, and settle it on the map.',
    liveLabel: 'PLAYERS DEPLOYED',
    enterCta: 'Enter Zone',
    findCta: 'Find Squad'
  },
  cod: {
    id: 'cod',
    themeName: 'Tactical Ops',
    accent: '#FF6A4D',
    accent2: '#9E3317',
    background: 'linear-gradient(135deg, #170706 0%, #2A1008 45%, #0A0F14 100%)',
    tagline: 'Tactical 1v1 and team play. Coordinate, load in, and report.',
    liveLabel: 'OPS ACTIVE',
    enterCta: 'Enter Op',
    findCta: 'Find Op'
  },
  other: {
    id: 'other',
    themeName: 'Open Arena',
    accent: '#8A93A6',
    accent2: '#4B5162',
    background: 'linear-gradient(135deg, #0A0C11 0%, #11151D 45%, #0A0F14 100%)',
    tagline: 'Any game not listed. Set a mode, agree terms, and play.',
    liveLabel: 'OPEN',
    enterCta: 'Enter Arena',
    findCta: 'Find Match'
  }
};

export function themeFor(id: ArenaGameId): ArenaThemeConfig {
  return ARENA_THEMES[id] ?? ARENA_THEMES.other;
}
