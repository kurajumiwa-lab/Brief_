import React, { useState } from 'react';
import { DiscoverFeed } from './DiscoverFeed';
import { DiscoveryHead } from './DiscoveryHead';
import type { DiscoverRoom } from './taxonomy';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// DISCOVER — the one shop window.
//
// This file used to hold its own room state, its own tile grid, its own
// featured card, its own host-event modal, its own floating create pill and
// its own copy of the marketplace / gallery / circles / errands surfaces.
//
// What is gone, and where it went:
//   * the floating "Host an event / Post a listing" pill → the bar's [+]
//     (one create door for the whole app; see `app/CreateSheet`);
//   * the host-event modal → `HostEventSheet`, rendered by the shell, opened
//     from the Create sheet;
//   * the room chip row above the board → it was never here; it lived in the
//     belt and was deleted with the belt's departments rail (Home's mode tiles
//     and the board's own picker are the navigation now).
//
// What this file holds now: the legacy Discover screen's composition (one
// entry that opens the taxonomy, big full-bleed cards, a detail sheet) fed by
// real rows, plus the rooms that are not supply flows (events, circles,
// errands) and the market's own shelf.
//
// What did NOT come across from the legacy screen: its data. INITIAL_DISCOVER_
// POSTS was a fiction array (an invented market claiming "over 40 verified
// creative vendors", Unsplash photographs of other people's goods, phone numbers
// and Telegram handles that reach nobody). The shape was worth keeping; the
// invented content was not, and it is gone from the tree.
// ---------------------------------------------------------------------------

export interface CityFeedViewProps {
  /**
   * Which room the board opens on. 'all' is the default: the mixed supply view
   * with the four flow tiles on top of it, so the marketplace is the first thing
   * on screen either way. The taxonomy's own note is that All exists for the
   * person who does not yet know which flow they want.
   */
  initialSubTab?: DiscoverRoom;
  /** Kept for the shell's contract; a space is opened from Mine now. */
  onOpenSpace?: (spaceId: string) => void;
  /**
   * The Create sheet's "Post an offer" lands on the counter's Selling tab —
   * the counter is where a listing (and the shop it belongs to) is actually
   * written, so this screen opens the tab instead of mimicking it with a
   * half-copied form. The shell bumps the nonce; the board answers once.
   */
  sellingSignal?: number;
  /**
   * "Start a run" (kind 'delivery') and "Post an errand" (kind null) from
   * Home's tile or the bar's [+]: both land on the errands board with the
   * composer open. The nonce is the answer-once contract; the kind is the
   * tile's choice, and a null kind leaves the member's own kind to the tiles.
   */
  errandSignal?: { nonce: number; kind: string | null } | null;
  className?: string;
}

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'all',
  sellingSignal = 0,
  errandSignal = null,
  className = ''
}) => {
  const [room, setRoom] = useState<DiscoverRoom>(initialSubTab);

  // No second create-form. The counter is where a listing (and the shop it
  // belongs to) is actually written, so "Post an offer" lands on its Selling
  // tab instead of mimicking it with a half-copied form.
  const [counterSection, setCounterSection] = useState<'browse' | 'orders' | 'selling'>('browse');
  const [counterKey, setCounterKey] = useState(0);

  const openSelling = () => {
    soundEngine.play('tap');
    setRoom('all');
    setCounterSection('selling');
    setCounterKey((k) => k + 1);
  };

  // The shell's Create sheet asked for the Selling tab. Answer once per bump.
  React.useEffect(() => {
    if (sellingSignal > 0) openSelling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellingSignal]);

  // "Start a run" / "Post an errand": the errands board, the caller's kind,
  // composer open.
  const [composerSig, setComposerSig] = React.useState<{ nonce: number; kind: string | null } | null>(null);
  React.useEffect(() => {
    if (errandSignal) {
      setComposerSig(errandSignal);
      setRoom('errands');
    }
  }, [errandSignal]);

  return (
    <div className={`space-y-5 max-w-xl mx-auto ${className}`}>
      <DiscoveryHead
        eyebrow="Discover"
        title="What's happening nearby"
        subtitle="What people are selling, hosting and needing carried"
        segments={[]}
        activeSegmentId={room}
        onSegmentChange={() => {}}
      />

      <DiscoverFeed
        room={room}
        onRoomChange={(r) => setRoom(r)}
        onPostListing={openSelling}
        counterSection={counterSection}
        counterKey={counterKey}
        composerSignal={composerSig}
      />
    </div>
  );
};

export default CityFeedView;
