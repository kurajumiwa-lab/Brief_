// ---------------------------------------------------------------------------
// THE SHEET — the "All" drawer, and the one place the long list of destinations
// lives.
//
// The bottom dock carries five tabs; everything else used to be squeezed onto
// screens that were already full. This is Amazon's `nav-app-links` pattern
// borrowed for its one genuinely useful idea: a partial menu that takes the
// overflow OFF the working surfaces. The belt rule that comes with it is
// enforced by `appbelt.jsx`: a destination that lives here does not also get a
// shelf on Home, and a destination that has a shelf of its own is not listed
// twice in here.
//
// Deliberately absent:
//   * counts. A nav list with numbers is a nav list that has to keep those
//     numbers true, and every one of them would arrive before the member has
//     rows to fill it. So each entry is a word and an icon, nothing else;
//   * badges, "new" tags, unread dots, promotional chips;
//   * the weather. It is not a destination — it is a line on the day it matters
//     (see `features/home/PlannedWeather`).
// ---------------------------------------------------------------------------
import React, { useEffect } from 'react';
import { X, Coins, Users, Ticket, Search, ShieldCheck } from 'lucide-react';

export type SheetTarget =
  | { kind: 'tab'; tab: 'requests' | 'supply' | 'partners' }
  | { kind: 'you'; section: 'profile' | 'standing' | 'following' | 'subscriptions' | 'earn' | 'orders' | 'selling' | 'archive' | 'tableBanking' | 'network' | 'how' };

export interface SheetItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  target: SheetTarget;
}

const icon = (Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>, tone: 'ink' | 'muted' = 'muted') => (
  <Icon
    className="w-4 h-4"
    style={{ color: tone === 'ink' ? 'var(--color-text)' : 'var(--color-text-muted)' }}
  />
);

/**
 * The whole sheet, as data. `appbelt.jsx` asserts every `id` is unique and that
 * each group's entries are the ones it claims — a nav list that grows a
 * duplicate in a refactor is how two surfaces end up owning the same feature.
 */
/**
 * The sheet, as data. `appbelt.jsx` asserts every `id` is unique, that no
 * destination appears twice, and — the rule this list exists to honour — that
 * nothing in here is ALSO reachable from the band or the dock. That is why it is
 * seven entries and not sixteen: Home, Spaces, Activity and the four rooms the
 * band already carries were listed here too, which is how one purpose ends up
 * with three navigations and a first-time reader with eleven choices.
 *
 * So: the sheet holds the destinations that exist nowhere else. The band holds
 * the rooms. The dock holds the five tabs. A thing you can reach from two places
 * is a thing you will not find in either.
 *
 * Six entries. That number is asserted in `appbelt.jsx`, so the list cannot
 * quietly grow back into the eleven-item wall it replaced.
 */
export const SHEET_GROUPS: Array<{ id: string; label: string; items: SheetItem[] }> = [
  {
    id: 'work',
    label: 'Your work',
    items: [
      { id: 'requests', label: 'Requests', icon: icon(Ticket), target: { kind: 'tab', tab: 'requests' } },
      { id: 'supply', label: 'Supply', icon: icon(Users), target: { kind: 'tab', tab: 'supply' } },
      { id: 'partners', label: 'Partners', icon: icon(ShieldCheck), target: { kind: 'tab', tab: 'partners' } }
    ]
  },
  {
    id: 'you',
    label: 'You, your standing, your money',
    items: [
      // Two, not six. Profile is what You opens ON, so linking it would be a
      // button that goes where the tab already goes; Table banking and
      // Subscriptions are reached inside You's own Money group. Every entry here
      // has to earn its line by being nowhere else — that is the whole rule.
      { id: 'standing', label: 'Standing, commitments, reciprocity', icon: icon(ShieldCheck), target: { kind: 'you', section: 'standing' } },
      { id: 'earn', label: 'Earn', icon: icon(Coins, 'ink'), target: { kind: 'you', section: 'earn' } }
    ]
  },
  {
    id: 'reading',
    label: 'When you want it explained',
    items: [
      { id: 'how', label: 'How Trace works', icon: icon(Search), target: { kind: 'you', section: 'how' } }
    ]
  }
];

export interface NavSheetProps {
  open: boolean;
  onClose: () => void;
  onGo: (target: SheetTarget) => void;
  /** The member's stated area, or empty. Never a guessed location. */
  place: string;
  onSetPlace: (place: string) => void;
}

export const NavSheet: React.FC<NavSheetProps> = ({ open, onClose, onGo, place, onSetPlace }) => {
  const [draft, setDraft] = React.useState(place);
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
      <div
        className="absolute top-0 bottom-0 left-0 w-[min(86vw,20rem)] overflow-y-auto p-4 space-y-5"
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

        {SHEET_GROUPS.map((group) => (
          <nav key={group.id} aria-label={group.label} className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {group.label}
            </p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onGo(item.target); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] font-bold cursor-pointer"
                style={{ color: 'var(--color-text)' }}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        ))}
      </div>
    </div>
  );
};

export default NavSheet;
