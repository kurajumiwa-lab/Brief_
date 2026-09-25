// ---------------------------------------------------------------------------
// THE SHEET — the "All" drawer, and the one place the long list of
// destinations lives.
//
// The reorg that owns this file: the bottom bar holds exactly three doors
// (Home · Mine · You) plus one action ([+]). Everything else lives HERE, in
// groups, or as a section on Home. The rule that keeps the two from growing
// back into each other: a destination the sheet owns does not also get a door
// in the bar, and `doorways.jsx` asserts the overlap is zero.
//
// A second rule, from the operator: the sheet does not repeat the primary
// shelves either. Shops, Events, Groups, Errands and Group Buys already sit
// on Home's mode tiles, so they are NOT listed again here. What stays is
// board rooms with no tile of their own: the full marketplace, wholesale,
// and source-direct.
//
// The groups, top to bottom:
//   PULSE — the check-in surface. It used to be a fourth door; a place you
//           visit to see what happened is a shelf, not a room of its own.
//   BOARD ROOMS — marketplace, wholesale, source-direct. Rooms, not shelves.
//   YOUR WORK — Requests, Supply, Partners. Real shelves, kept.
//   YOU, YOUR STANDING, YOUR MONEY — Standing, Earn, Table Banking.
//   SETTINGS — Language, Notifications, Privacy.
//   How Wairo works · Sign out.
//
// Icons are ShelfIcon marks: a filled gradient squircle per shelf theme, so
// the eye can tell which room a row belongs to before reading a word. No
// thin line icons in this drawer.
//
// Deliberately absent: counts, badges, "new" tags, unread dots. A nav list
// with numbers is a nav list that has to keep those numbers true, and every
// one of them would arrive before the member has rows to fill it.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CategoryArt } from '../ui/CategoryArt';
import { ShelfIcon } from '../ui/ShelfIcon';
import { MenuTile, SectionHeader } from '../ui/MenuTile';

export type SheetTarget =
  | { kind: 'tab'; tab: 'requests' | 'supply' | 'partners' | 'pulse' | 'mine' }
  | {
      kind: 'you';
      section:
        | 'profile' | 'standing' | 'following' | 'subscriptions'
        | 'earn' | 'orders' | 'selling' | 'archive' | 'tableBanking'
        | 'network' | 'how' | 'notifications' | 'privacy' | 'language';
    }
  | { kind: 'discover'; room: 'all' | 'events' | 'circles' | 'errands' | 'bulk' | 'direct' | 'group' }
  | { kind: 'moderation' }
  | { kind: 'signout' };

export interface SheetItem {
  id: string;
  label: string;
  /** A second, quieter line under the label — what the shelf holds, in the
      app's own words. */
  sub?: string;
  icon: React.ReactNode;
  target: SheetTarget;
}

/**
 * The sheet, as data. `doorways.jsx` asserts every `id` is unique, that Pulse
 * is in the first group, that the settings group is Language / Notifications /
 * Privacy, and that nothing here repeats a label from the bottom bar.
 */
export const SHEET_GROUPS: Array<{ id: string; label: string; items: SheetItem[] }> = [
  {
    id: 'pulse',
    label: 'Pulse',
    items: [
      {
        id: 'pulse',
        label: 'Pulse',
        sub: 'What’s moving today',
        icon: <ShelfIcon glyph="bolt" theme="pulse" />,
        target: { kind: 'tab', tab: 'pulse' }
      }
    ]
  },
  {
    id: 'explore', label: 'Board rooms', items: [
      ...([
        ['all', 'Offers & marketplace', 'Products, services and sellers'],
        ['bulk', 'Wholesale', 'Buy in volume for your shop'],
        ['direct', 'Source direct', 'Buy closer to the producer'],
      ] as const).map(([room, label, sub]) => ({ id: `explore-${room}`, label, sub, icon: <CategoryArt kind={room} className="!w-8 !h-8" />, target: { kind: 'discover' as const, room } }))
    ]
  },
  {
    id: 'work',
    label: 'Your work',
    items: [
      { id: 'requests', label: 'Requests', sub: 'Asks on the board that need a seller', icon: <ShelfIcon glyph="ticket" theme="work" />, target: { kind: 'tab', tab: 'requests' } },
      { id: 'supply', label: 'Supply', sub: 'Sellers and what they move', icon: <ShelfIcon glyph="users" theme="work" />, target: { kind: 'tab', tab: 'supply' } },
      { id: 'partners', label: 'Partners', sub: 'Programs and networks behind the rows', icon: <ShelfIcon glyph="shield" theme="work" />, target: { kind: 'tab', tab: 'partners' } }
    ]
  },
  {
    id: 'you',
    label: 'You, your standing, your money',
    items: [
      { id: 'standing', label: 'Standing', sub: 'What you owe, what is owed you', icon: <ShelfIcon glyph="shield" theme="money" />, target: { kind: 'you', section: 'standing' } },
      { id: 'earn', label: 'Earn', sub: 'Your money, the real way', icon: <ShelfIcon glyph="coins" theme="money" />, target: { kind: 'you', section: 'earn' } },
      { id: 'tableBanking', label: 'Table Banking', sub: 'Shared pots, kept in the open', icon: <ShelfIcon glyph="pot" theme="money" />, target: { kind: 'you', section: 'tableBanking' } }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'language', label: 'Language', sub: 'One language, said plainly', icon: <ShelfIcon glyph="globe" theme="system" />, target: { kind: 'you', section: 'language' } },
      { id: 'notifications', label: 'Notifications', sub: 'The real bell for this device', icon: <ShelfIcon glyph="bell" theme="system" />, target: { kind: 'you', section: 'notifications' } },
      { id: 'privacy', label: 'Privacy', sub: 'What this device keeps, and how to clear it', icon: <ShelfIcon glyph="lock" theme="system" />, target: { kind: 'you', section: 'privacy' } }
    ]
  },
  {
    // No group label: these two stand on their own, like the mock it came
    // from. The renderer skips the header for an empty label.
    id: 'closing',
    label: '',
    items: [
      { id: 'how', label: 'How Wairo works', sub: 'How a row becomes trust', icon: <ShelfIcon glyph="search" theme="system" />, target: { kind: 'you', section: 'how' } },
      { id: 'signout', label: 'Sign out', sub: 'End the session on this device', icon: <ShelfIcon glyph="cross" theme="danger" />, target: { kind: 'signout' } }
    ]
  }
];

export interface NavSheetProps {
  canModerate?: boolean;
  open: boolean;
  onClose: () => void;
  onGo: (target: SheetTarget) => void;
  /** The member's stated area, or empty. Never a guessed location. */
  place: string;
  onSetPlace: (place: string) => void;
}

export const NavSheet: React.FC<NavSheetProps> = ({ open, onClose, onGo, place, onSetPlace, canModerate = false }) => {
  const [draft, setDraft] = useState(place);
  useEffect(() => { if (open) setDraft(place); }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="All sections">
      <button
        type="button"
        aria-label="Close the menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      {/* bottom-14 = the 56px bar. The drawer stops ABOVE the floor it is
          drawn over: on a phone the two must not share a pixel. On md+ the bar
          is gone (it is the sidebar rail), so the drawer takes the full
          height there. `doorways.jsx` asserts the gap class, which is the
          geometric claim in a test that has no layout engine. */}
      <div
        data-testid="nav-sheet-panel"
        className="absolute top-0 bottom-14 md:bottom-0 left-0 w-[min(86vw,20rem)] overflow-y-auto p-4 space-y-5"
        style={{ background: 'var(--color-bg)', boxShadow: 'var(--lift-3)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            All sections
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the menu"
            className="p-2 rounded-full cursor-pointer"
            style={{ background: 'var(--color-paper)', color: 'var(--color-text)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {canModerate && <MenuTile icon={<ShelfIcon glyph="shield" theme="system" />} title="Page moderation" description="Review reports and reinstate hidden pages" testId="page-moderation" onClick={() => { onGo({ kind: 'moderation' }); onClose(); }} />}

        {SHEET_GROUPS.map((group) => (
          <nav key={group.id} aria-label={group.label || 'More'} className="space-y-1.5 pt-3 border-t border-black/5 first:pt-0 first:border-t-0">
            {group.label ? <SectionHeader>{group.label}</SectionHeader> : null}
            {/* The ONE tile shape: a themed mark, bold 15px title, grey 13px
                description. */}
            {group.items.map((item) => (
              <MenuTile
                key={item.id}
                icon={item.icon}
                title={item.label}
                description={item.sub}
                testId={item.id}
                onClick={() => { onGo(item.target); onClose(); }}
              />
            ))}
          </nav>
        ))}

        {/* The area, set once and used by the only weather line this app shows.
            An empty field stays described as unset rather than defaulted to a
            city the member may not be in. */}
        <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}>
          <label htmlFor="belt-place" className="block text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Your area
          </label>
          <input
            id="belt-place"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Kisii"
            className="w-full px-3 py-2 rounded-xl text-[13px] border"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onSetPlace(draft.trim()); onClose(); }}
              className="px-3 py-1.5 rounded-full text-[12px] font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { onSetPlace(''); onClose(); }}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer border"
              style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text-muted)' }}
            >
              Clear it
            </button>
          </div>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            Used to read the forecast. A weather line appears only on a day you have something planned.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NavSheet;
