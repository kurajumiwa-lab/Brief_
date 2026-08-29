import React from 'react';
import { ChevronLeft, Copy, Share2, ShieldCheck, CheckCircle2, Sparkles, Plus, Briefcase, CalendarDays, FileText, ArrowRight, Lock } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { AuthedUser } from '../api/briefApi';
import type { CommandCentre } from '../api/types';
import { MainShelf } from './MainShelf';

export type MenuTarget =
  | { tab: 'nearby'; section?: 'stream' | 'tea' | 'market' | 'quests' | 'pursuits' | 'today' | 'events' }
  | { tab: 'arena'; section?: 'lobby' | 'ligi' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard' }
  | { tab: 'mylayer'; section?:
      | 'saved' | 'activity' | 'arena' | 'points' | 'circles' | 'groups'
      | 'campaigns' | 'mediakit' | 'opportunities' | 'messages' | 'subscriptions'
      | 'verification' }
  | { tab: 'workflows'; section?:
      | 'cockpit' | 'command' | 'active' | 'completed' | 'inbox'
      | 'sources' | 'money' | 'vault' | 'gate' | 'tea'
      | 'campaigns' | 'matches' | 'distribution' | 'calendar' | 'vendors' | 'ai' }
  | { tab: 'capture' };

export interface GeoCity {
  lat: number;
  lng: number;
  label: string;
}

export interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (target: MenuTarget) => void;
  onSelectCity: (city: GeoCity) => void;
  selectedLocation: string;
}

type MediaKit = {
  displayName?: string;
  description?: string | null;
  contactMethod?: string | null;
  audience?: {
    publishedObjects?: number;
    views?: number;
    saves?: number;
    shares?: number;
    contributions?: number;
    engagementRate?: number | null;
  };
  note?: string;
} | null;

const REGIONS: { flag: string; label: string; city: GeoCity }[] = [
  { flag: '🇰🇪', label: 'Kenya', city: { lat: -1.2921, lng: 36.8219, label: 'Nairobi' } },
  { flag: '🇹🇿', label: 'Tanzania', city: { lat: -6.7924, lng: 39.2083, label: 'Dar es Salaam' } },
  { flag: '🇺🇬', label: 'Uganda', city: { lat: 0.3476, lng: 32.5825, label: 'Kampala' } },
  { flag: '🇷🇼', label: 'Rwanda', city: { lat: -1.9441, lng: 30.0619, label: 'Kigali' } }
];

const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isPhone(value: string): boolean {
  return /^\+?[\d\s()-]{7,}$/.test(value.trim());
}

function socialHref(kind: 'whatsapp' | 'telegram' | 'x', contact: string | null): string | null {
  if (!contact) return null;
  const raw = contact.trim();
  if (kind === 'whatsapp' && isPhone(raw)) {
    return `https://wa.me/${raw.replace(/[^\d]/g, '')}`;
  }
  if (kind === 'telegram' && /^@?[a-zA-Z][\w]{3,}$/.test(raw)) {
    return `https://t.me/${raw.replace(/^@/, '')}`;
  }
  if (kind === 'x' && /^@?[a-zA-Z][\w]{1,}$/.test(raw)) {
    return `https://x.com/${raw.replace(/^@/, '')}`;
  }
  return null;
}

// --- Luxury Host Value Card ("Alexander Sterling / Concierge Hub") -----------

function HostValueCard({
  expanded,
  onExpand,
  onBack,
  onSelect
}: {
  expanded: boolean;
  onExpand: () => void;
  onBack: () => void;
  onSelect: (target: MenuTarget) => void;
}) {
  const [me, setMe] = React.useState<AuthedUser | null>(null);
  const [kit, setKit] = React.useState<MediaKit>(null);
  const [command, setCommand] = React.useState<CommandCentre | null>(null);
  const [kitKnown, setKitKnown] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    (async () => {
      const [who, media, centre] = await Promise.all([
        briefApi.whoAmI(),
        briefApi.getMyMediaKit(),
        briefApi.getCommandCentre()
      ]);
      if (!live) return;
      setMe(who.ok ? who.data : null);
      setKit(media.ok ? (media.data as MediaKit) : null);
      setKitKnown(true);
      setCommand(centre.ok ? centre.data : null);
    })();
    return () => {
      live = false;
    };
  }, []);

  const [standingExtra, setStandingExtra] = React.useState<{ bought: number } | null>(null);

  React.useEffect(() => {
    let live = true;
    briefApi.getPersonMe().then((res) => {
      if (!live || !res.ok) return;
      setStandingExtra({ bought: res.data.standing?.bought ?? 0 });
    });
    return () => { live = false; };
  }, []);

  const displayName = kit?.displayName || me?.displayName || 'Alexander Sterling';
  const handle = me?.handle ? `@${me.handle}` : null;
  const audience = kit?.audience;
  const contact = kit?.contactMethod ?? null;

  const standing = [
    command ? { label: 'Settled', value: money(command.money.grossSettled, command.money.currency) } : null,
    command ? { label: 'Arrived', value: String(command.people.checkedIn) } : null,
    audience && audience.views !== undefined ? { label: 'Views', value: String(audience.views) } : null,
    command ? { label: 'Hosted', value: String(command.campaigns.length) } : null,
    standingExtra && standingExtra.bought > 0
      ? { label: 'Bought', value: String(standingExtra.bought) }
      : null
  ].filter(Boolean) as { label: string; value: string }[];

  const copyCard = async () => {
    const lines = [
      displayName,
      handle ?? '',
      standing.map((s) => `${s.label}: ${s.value}`).join(' · '),
      contact ? `Contact: ${contact}` : ''
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const shareCard = async () => {
    const text = `${displayName}${handle ? ` (${handle})` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: displayName, text });
        return;
      }
    } catch {}
    void copyCard();
  };

  const channels = [
    { id: 'whatsapp', label: 'WhatsApp', href: socialHref('whatsapp', contact) },
    { id: 'telegram', label: 'Telegram', href: socialHref('telegram', contact) },
    { id: 'x', label: 'X', href: socialHref('x', contact) }
  ];

  return (
    <div className="pt-1">
      {expanded && (
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-[12px] font-extrabold text-[#7E8B9B] hover:text-white cursor-pointer transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Menu
        </button>
      )}

      {/* Alexander Sterling Concierge Hub Card */}
      <div
        className="relative w-full rounded-2xl border border-[#28354A] bg-gradient-to-b from-[#162030] via-[#101724] to-[#0A0E17] p-4 shadow-xl overflow-hidden cursor-pointer"
        onClick={expanded ? undefined : onExpand}
      >
        {/* Diagonal wireframe background pattern in top-right */}
        <svg
          className="absolute -top-3 -right-3 w-48 h-32 pointer-events-none opacity-20"
          viewBox="0 0 160 100"
          fill="none"
          aria-hidden="true"
        >
          <line x1="0" y1="0" x2="160" y2="100" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="35" y1="0" x2="160" y2="78" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="70" y1="0" x2="160" y2="56" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="105" y1="0" x2="160" y2="34" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="20" x2="130" y2="100" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="45" x2="90" y2="100" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="70" x2="50" y2="100" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="100" x2="160" y2="0" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="75" x2="120" y2="0" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="50" x2="80" y2="0" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="0" y1="25" x2="40" y2="0" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="40" y1="100" x2="160" y2="25" stroke="#8C9BAE" strokeWidth="0.8" />
          <line x1="80" y1="100" x2="160" y2="50" stroke="#8C9BAE" strokeWidth="0.8" />
        </svg>

        {/* Top Row: Avatar + Title + Profile Avatar */}
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-[#090C12] border border-[#1F2B3B] flex items-center justify-center text-white font-black text-[14px] tracking-wide shrink-0 shadow-inner">
              {displayName === 'Alexander Sterling' ? 'LO' : initials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-[#7E8B9B] truncate">
                PREMIUM CONCIERGE HUB
              </p>
              <h2 className="text-[17px] sm:text-[18px] font-black text-white tracking-tight truncate mt-0.5">
                {displayName}
              </h2>
            </div>
          </div>

          <div className="h-8 w-8 rounded-full border border-[#3A4B64] overflow-hidden shrink-0 shadow-sm bg-[#1E293B] flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Profile"
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Bottom Row: My Account & My Hub */}
        <div className="grid grid-cols-2 gap-2.5 mt-3.5 pt-3 border-t border-[#1C2738] relative z-10">
          {/* Left: My Account */}
          <div className="rounded-xl border border-[#1F2B3D] bg-[#0E1522] p-3 flex flex-col justify-between">
            <div>
              <p className="text-[10.5px] font-medium text-[#7E8B9B]">My Account</p>
              <p className="text-[16px] font-black text-[#E5B558] mt-0.5 tracking-tight">
                {money(command?.money.grossSettled ?? 0, command?.money.currency ?? 'KES')}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1 text-[9.5px] text-[#7E8B9B]">
              <span>Settled</span>
              <span>{command?.campaigns.length || 1} Hosted</span>
            </div>
          </div>

          {/* Right: My Hub */}
          <div className="rounded-xl border border-[#1F2B3D] bg-[#0E1522] p-3 flex flex-col justify-between">
            <p className="text-[10.5px] font-medium text-[#7E8B9B]">My Hub</p>
            <div className="mt-1.5 flex items-center">
              <div className="w-full py-1.5 px-3 rounded-full bg-gradient-to-r from-[#D6A24D] via-[#ECC880] to-[#C99540] text-[#2C1C04] font-black text-[11px] text-center shadow-md tracking-wide">
                Platinum Member
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Profile Details */}
      {expanded && (
        <div className="mt-4 space-y-3 pt-1">
          <div className="rounded-2xl bg-[#111724] border border-[#202B3C] p-4 text-white">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7E8B9B] mb-2">
              Standing
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {standing.map((s) => (
                <div key={s.label} className="rounded-xl border border-[#1C2738] bg-[#0E1522] p-2.5">
                  <p className="text-[10px] text-[#7E8B9B]">{s.label}</p>
                  <p className="text-[13px] font-extrabold text-white mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void shareCard()}
              className="flex-1 h-10 rounded-xl bg-white text-[#0A0D14] text-[12px] font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-gray-100"
            >
              <Share2 className="h-4 w-4" />
              Share profile
            </button>
            <button
              onClick={() => void copyCard()}
              className="h-10 px-4 rounded-xl border border-[#28354A] bg-[#141A26] text-white text-[12px] font-extrabold flex items-center justify-center gap-2 cursor-pointer hover:border-[#7E8B9B] transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Sign out: the end of the session loop. The token is revoked
              server-side; the local copy is cleared inside logout() either
              way, and the app re-opens signed out. */}
          {me && (
            <button
              onClick={() => void briefApi.logout().then(() => window.location.reload())}
              className="mt-3 w-full h-10 rounded-xl border border-[#28354A] bg-transparent text-white/70 text-[12px] font-extrabold cursor-pointer hover:border-[#7E8B9B] transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Luxury Quick Actions ("QUICK ACTIONS") ---------------------------------

function QuickActions({ onSelect }: { onSelect: (target: MenuTarget) => void }) {
  const actions: { label: string; detail: string; target: MenuTarget }[] = [
    { label: 'New', detail: 'Capture something useful', target: { tab: 'capture' } },
    { label: 'Dashboard', detail: 'See what is moving', target: { tab: 'workflows', section: 'command' } },
    { label: 'Inbox', detail: 'Review what needs you', target: { tab: 'workflows', section: 'inbox' } },
    { label: 'Records', detail: 'Open your vaults', target: { tab: 'workflows', section: 'vault' } },
    { label: 'Calendar', detail: 'Keep a date in view', target: { tab: 'workflows', section: 'calendar' } }
  ];

  return (
    <section className="rounded-2xl border border-[#26354A] bg-[#121926]/90 backdrop-blur-md p-4 shadow-xl">
      <div className="mb-3 px-0.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7E8B9B]">
          QUICK ACTIONS
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onSelect(action.target)}
            className="group rounded-xl border border-[#2C3B52] bg-gradient-to-b from-[#222E42] to-[#151E2C] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-[#425575] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-black text-white">{action.label}</p>
              <span className="text-[13px] text-[#7E8B9B] transition-transform group-hover:translate-x-1">→</span>
            </div>
            <p className="mt-1 text-[9.5px] leading-snug text-[#7E8B9B] truncate">{action.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

// --- More To Come Section ("MORE TO COME") ----------------------------------

function MoreToCome() {
  const items = ['Courses', 'Data desk', 'Premium'];
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7E8B9B]">
          MORE TO COME
        </p>
        <span className="text-[10px] font-bold text-[#64748B]">Not active yet</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((label) => (
          <div
            key={label}
            className="rounded-xl border border-[#202B3C] bg-[#111724] p-3 shadow-md"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[12px] font-black text-white">{label}</span>
              <Lock className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
            </div>
            <p className="mt-1 text-[9.5px] font-bold text-[#64748B]">Not built</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Region Gallery Section ("YOUR REGION") ---------------------------------

function RegionGallery({
  selectedLocation,
  onSelect,
  onSelectCity
}: {
  selectedLocation: string;
  onSelect: (target: MenuTarget) => void;
  onSelectCity: (city: GeoCity) => void;
}) {
  return (
    <section className="space-y-2 pb-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7E8B9B]">
          YOUR REGION
        </p>
        <span className="text-[10px] font-bold text-[#64748B]">Your area</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {REGIONS.map((region) => {
          const selected =
            selectedLocation.toLowerCase().includes(region.city.label.toLowerCase()) ||
            selectedLocation.toLowerCase() === region.label.toLowerCase();
          return (
            <button
              key={region.label}
              type="button"
              onClick={() => {
                onSelectCity(region.city);
                onSelect({ tab: 'nearby', section: 'stream' });
              }}
              className={`rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                selected
                  ? 'border-[#7E8B9B] bg-[#1A2333] shadow-md'
                  : 'border-[#202B3C] bg-[#111724] hover:border-[#384A66]'
              }`}
            >
              <span className="block text-[22px] leading-none">{region.flag}</span>
              <span className="mt-1.5 block truncate text-[10px] font-black text-white">
                {region.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- MenuSheet Main Dialog --------------------------------------------------

export function MenuSheet({ open, onClose, onSelect, onSelectCity, selectedLocation }: MenuSheetProps) {
  const [cardOpen, setCardOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCardOpen(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Dismiss menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
      />
      <aside
        role="dialog"
        aria-label="Explore gallery"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-[#202B3C] shadow-2xl"
        style={{
          maxHeight: 'calc(100vh - 12px)',
          background: 'linear-gradient(180deg, #101622 0%, #0A0E17 100%)'
        }}
      >
        {/* Top Header: MAIN SHEET / Explore by shelf */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1A2333] bg-[#0E1420]/80 backdrop-blur-md px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7E8B9B]">
              MAIN SHEET
            </p>
            <h1 className="mt-0.5 text-[19px] sm:text-[21px] font-black tracking-tight text-white">
              Explore by shelf
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2A374C] bg-gradient-to-b from-[#222E42] to-[#141C2A] text-white text-[22px] font-light shadow-md hover:border-[#425575] transition-all cursor-pointer"
            aria-label="Close explore gallery"
          >
            ×
          </button>
        </header>

        {/* Scrollable Body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 space-y-4"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {/* 1. Alexander Sterling Concierge Hub Card */}
          <HostValueCard
            expanded={cardOpen}
            onExpand={() => setCardOpen(true)}
            onBack={() => setCardOpen(false)}
            onSelect={onSelect}
          />

          {!cardOpen && (
            <>
              {/* 2. Main Shelf with "What do you want to do?" and horizontal swipe */}
              <MainShelf onSelect={onSelect} compact={false} theme="dark" />

              {/* 3. Quick Actions glass container */}
              <QuickActions onSelect={onSelect} />

              {/* 4. More To Come section */}
              <MoreToCome />

              {/* 5. Your Region section */}
              <RegionGallery
                selectedLocation={selectedLocation}
                onSelect={onSelect}
                onSelectCity={onSelectCity}
              />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default MenuSheet;
