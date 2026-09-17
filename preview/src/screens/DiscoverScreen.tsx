import React from 'react';
import { CityFeedView } from '../features/city/CityFeedView';
import { DiscoverFeed } from '../features/city/DiscoverFeed';
import type { DiscoverRoom } from '../features/city/taxonomy';

// ---------------------------------------------------------------------------
// LEGACY DISCOVER ENTRY — now a wrapper, not a second app.
//
// This file used to own its own Discover: `INITIAL_DISCOVER_POSTS`, a hardcoded
// array of invented listings and events (a "Kilimani Weekend Creators Market"
// claiming "over 40 verified creative vendors", Unsplash photographs of other
// people's goods, phone numbers like +254700000000 and Telegram handles nobody
// runs), plus its own create-post loop that wrote to nothing but component
// state and then toasted "Published!". The cards, the detail sheet and the
// contact buttons all drew from that fiction.
//
// The layout was better than what the production screen had become, so the
// LAYOUT moved into features/city/DiscoverFeed.tsx and the fiction stayed here
// to be deleted. Both entries now render the same component against the same
// rows, which means:
//   * there is one Discover, not a production one and a demo one;
//   * a card exists only because a listing or a published event exists;
//   * the seller's photo is their upload or nothing at all;
//   * "message on WhatsApp" appears only when the seller put that contact on
//     their own listing — it is never defaulted, never looked up, never typed
//     in by us;
//   * the Create pill leads to the flows that actually write rows.
//
// DiscoverSection is kept as a name because NearbyScreen embeds the shelf
// inside its own page and passes a selection callback.
// ---------------------------------------------------------------------------

export interface DiscoverPost {
  id: string;
  title: string;
  kind?: 'listing' | 'event';
}

export function DiscoverSection({
  onSelectPost,
  room,
  onRoomChange
}: {
  onSelectPost?: (post: DiscoverPost) => void;
  room?: DiscoverRoom;
  onRoomChange?: (room: string) => void;
}) {
  return (
    <DiscoverFeed
      room={room ?? 'all'}
      onRoomChange={(r) => {
        onSelectPost?.({ id: r, title: r });
        onRoomChange?.(r);
      }}
    />
  );
}

/**
 * The full production Discover, mounted where the legacy shell used to show its
 * own copy — tiles, routes, the gap board, the counter, and the two create
 * loops (publish an event, open the selling form). Deliberately the same
 * component rather than a look-alike: two Discover screens is how one of them
 * ends up drift-rendering data the other never fetched.
 */
export function DiscoverScreen() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-36">
        <CityFeedView />
      </div>
    </div>
  );
}

export default DiscoverScreen;
