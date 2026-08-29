import type { ArenaGameId } from '../App';

// The game key art. Atmospheric, non-trademarked cover tiles — one per title —
// so the shelf reads "image first, provider forward". They are cosmetic identity
// over the REAL Arena entities; nothing here invents a player count or a money rail.
import efootballArt from '../assets/arena/efootball.webp';
import fcMobileArt from '../assets/arena/fc_mobile.webp';
import eaFcArt from '../assets/arena/ea_fc.webp';
import pubgArt from '../assets/arena/pubg.webp';
import codArt from '../assets/arena/cod.webp';
import otherArt from '../assets/arena/other.webp';

// ---------------------------------------------------------------------------
// ARENA GAME THEME ENGINE
//
// The master-redesign core: each game carries its own identity and
// terminology, so selecting a game makes Arena feel like that game's world —
// while the platform underneath stays one Arena.
//
// MINIMALIST RE-THEME: the platform surface is now strictly neutral (the
// site-wide white/off-white system). A game's identity is carried by its KEY
// ART and vocabulary, not by coloured chrome — accents are ink-black, card
// and page backgrounds are the neutral surfaces. Typography across the
// platform is strictly black or white: black on light surfaces, white over
// key art's dark veil and on black fills.
//
// Everything here is DATA, not per-component hardcoding. Adding a game is one
// entry; the shelf renders it without a code change.
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
  /** The game's publisher/provider — the shelf highlight identity. */
  provider: string;
  /** Short provider mark shown over the art when space is tight. */
  providerMark: string;
  /** Key-art cover tile (imported asset URL). */
  art: string;
  /** Primary accent. Neutral ink — the platform carries no coloured chrome. */
  accent: string;
  /** Secondary accent (kept neutral for the same reason). */
  accent2: string;
  /** Hero/page background: the neutral surface, not a per-game colour wash. */
  background: string;
  /** One-line tagline under the game name. */
  tagline: string;
  /** Vocabulary: the live-state word and the two real CTAs. */
  liveLabel: string;
  enterCta: string;
  findCta: string;
}

// One neutral system for every title: identity comes from the art + words.
const NEUTRAL = {
  accent: '#251045',
  accent2: '#251045',
  background: '#F1EDF7'
};

export const ARENA_THEMES: Record<ArenaGameId, ArenaThemeConfig> = {
  efootball: {
    id: 'efootball',
    themeName: 'Neon Stadium',
    provider: 'Konami',
    providerMark: 'KONAMI',
    art: efootballArt,
    ...NEUTRAL,
    tagline: 'Ranked 1v1 and 2v2. Find a match, play, and record the result.',
    liveLabel: 'Live',
    enterCta: 'Enter Stadium',
    findCta: 'Find Match'
  },
  fc_mobile: {
    id: 'fc_mobile',
    themeName: 'Player Cards',
    provider: 'EA Sports',
    providerMark: 'EA',
    art: fcMobileArt,
    ...NEUTRAL,
    tagline: 'Squad-based 1v1. Build a side and take on the next challenger.',
    liveLabel: 'Live',
    enterCta: 'Enter Club',
    findCta: 'Find Opponent'
  },
  ea_fc: {
    id: 'ea_fc',
    themeName: 'Ultimate Club',
    provider: 'EA Sports',
    providerMark: 'EA',
    art: eaFcArt,
    ...NEUTRAL,
    tagline: 'Squad and career play. Restricted account transfer — see terms.',
    liveLabel: 'Live',
    enterCta: 'Enter Club',
    findCta: 'Find Opponent'
  },
  pubg: {
    id: 'pubg',
    themeName: 'Battle Zone',
    provider: 'Krafton',
    providerMark: 'KRAFTON',
    art: pubgArt,
    ...NEUTRAL,
    tagline: 'Squad play and scrims. Drop in, link up, and settle it on the map.',
    liveLabel: 'Live',
    enterCta: 'Enter Zone',
    findCta: 'Find Squad'
  },
  cod: {
    id: 'cod',
    themeName: 'Tactical Ops',
    provider: 'Activision',
    providerMark: 'ACTIVISION',
    art: codArt,
    ...NEUTRAL,
    tagline: 'Tactical 1v1 and team play. Coordinate, load in, and report.',
    liveLabel: 'Live',
    enterCta: 'Enter Op',
    findCta: 'Find Op'
  },
  other: {
    id: 'other',
    themeName: 'Open Arena',
    provider: 'Open Arena',
    providerMark: 'OPEN',
    art: otherArt,
    ...NEUTRAL,
    tagline: 'Any game not listed. Set a mode, agree terms, and play.',
    liveLabel: 'Open',
    enterCta: 'Enter Arena',
    findCta: 'Find Match'
  }
};

export function themeFor(id: ArenaGameId): ArenaThemeConfig {
  return ARENA_THEMES[id] ?? ARENA_THEMES.other;
}
