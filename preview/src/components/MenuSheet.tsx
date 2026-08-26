import React from 'react';
import { ChevronLeft, Copy, Share2 } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { AuthedUser } from '../api/briefApi';
import type { CommandCentre, Wallet as WalletType } from '../api/types';
import { MainShelf } from './MainShelf';

// ---------------------------------------------------------------------------
// MENU SHEET — a selectable bottom screen in place of a titled side menu.
//
// No product title. No "Brief" wordmark. The shelf is the menu: a host value
// card, visual destination tiles, quick actions, and compact region cards. The
// long community/host row drawer is deliberately gone.
//
// Honesty: every figure is server-derived. Missing data is said, not zeroed.
// There is no star rating — standing is what actually happened.
// ---------------------------------------------------------------------------

export type MenuTarget =
  | { tab: 'nearby'; section?: 'stream' | 'tea' | 'market' | 'quests' | 'pursuits' | 'today' }
  | { tab: 'arena' }
  | { tab: 'mylayer'; section?:
      | 'saved' | 'activity' | 'arena' | 'points' | 'circles' | 'groups'
      | 'campaigns' | 'mediakit' | 'opportunities' | 'messages' | 'subscriptions' }
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
  if (parts.length === 0) return '•';
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

// --- Host value card --------------------------------------------------------

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
  const [wallet, setWallet] = React.useState<WalletType | null>(null);
  const [kitKnown, setKitKnown] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    (async () => {
      const [who, media, centre, pay] = await Promise.all([
        briefApi.whoAmI(),
        briefApi.getMyMediaKit(),
        briefApi.getCommandCentre(),
        briefApi.getWallet()
      ]);
      if (!live) return;
      setMe(who.ok ? who.data : null);
      setKit(media.ok ? (media.data as MediaKit) : null);
      setKitKnown(true);
      setCommand(centre.ok ? centre.data : null);
      setWallet(pay.ok ? pay.data : null);
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

  const name = kit?.displayName || me?.displayName || 'Host';
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

  const metrics = [
    { label: 'Views', value: audience?.views ?? command?.distribution.views, hint: 'page loads' },
    { label: 'Shares', value: audience?.shares ?? command?.distribution.shares, hint: 'intents recorded' },
    { label: 'Saves', value: audience?.saves, hint: 'kept by people' },
    { label: 'Registered', value: command?.people.registered, hint: 'on your gatherings' }
  ];

  const copyCard = async () => {
    const lines = [
      name,
      handle ?? '',
      standing.map((s) => `${s.label}: ${s.value}`).join(' · '),
      contact ? `Contact: ${contact}` : '',
      'Standing is derived from real activity. No rating is invented.'
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
    const text = `${name}${handle ? ` (${handle})` : ''} — host standing from real activity.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text });
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    void copyCard();
  };

  const channels = [
    { id: 'whatsapp', label: 'WhatsApp', href: socialHref('whatsapp', contact) },
    { id: 'telegram', label: 'Telegram', href: socialHref('telegram', contact) },
    { id: 'x', label: 'X', href: socialHref('x', contact) }
  ];

  return (
    <div className="px-3 pt-3">
      {expanded && (
        <button
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-[12px] font-bold text-[#111111] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          Shelf
        </button>
      )}

      <button
        type="button"
        onClick={expanded ? undefined : onExpand}
        className="w-full text-left rounded-2xl p-3.5 shadow-lg cursor-pointer"
        style={{
          background: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFA 58%, #F3F4F6 100%)',
          border: '1px solid rgba(17,17,17,0.28)'
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-11 w-11 rounded-2xl flex items-center justify-center text-[14px] font-extrabold shrink-0"
            style={{ background: '#111111', color: '#FFFFFF' }}
          >
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold text-[#111111] truncate">{name}</p>
            <p className="text-[11px] text-[#111111]/60 truncate">
              {handle ?? (kitKnown && !kit ? 'No vendor profile yet' : 'Your host card')}
            </p>
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#111111] shrink-0">
            Card
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {(standing.length > 0 ? standing : [
            { label: 'Settled', value: '—' },
            { label: 'Arrived', value: '—' },
            { label: 'Hosted', value: '—' }
          ]).slice(0, 4).map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[14px] font-extrabold text-[#111111] truncate">{s.value}</p>
              <p className="text-[9px] text-[#111111]/60">{s.label}</p>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#111111]/60">Payments</p>
              <button
                onClick={() => onSelect({ tab: 'workflows', section: 'money' })}
                className="text-[11px] font-extrabold text-[#111111] cursor-pointer"
              >
                Open ledger
              </button>
            </div>
            {wallet ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[18px] font-extrabold text-[#111111]">
                    {money(wallet.balance, wallet.currency)}
                  </p>
                  <p className="text-[10px] text-[#111111]/60">Available · settled only</p>
                </div>
                <div>
                  <p className="text-[18px] font-extrabold text-[#111111]">
                    {money(wallet.pending, wallet.currency)}
                  </p>
                  <p className="text-[10px] text-[#111111]/60">Pending</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[#111111]/60">Wallet not loaded. Nothing is assumed.</p>
            )}
            {wallet && !wallet.provider.configured && (
              <p className="mt-2 text-[10px] text-[#111111] leading-snug">{wallet.provider.reason}</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#111111]/60">
                Marketing
              </p>
              <button
                onClick={() => onSelect({ tab: 'workflows', section: 'command' })}
                className="text-[11px] font-extrabold text-[#111111] cursor-pointer"
              >
                Command
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <p className="text-[16px] font-extrabold text-[#111111]">
                    {m.value === undefined ? '—' : m.value}
                  </p>
                  <p className="text-[9px] text-[#111111]/60">{m.label}</p>
                </div>
              ))}
            </div>
            {audience?.engagementRate != null && (
              <p className="mt-2 text-[10px] text-[#111111]/60">
                Engagement {Math.round(audience.engagementRate * 100)}% of views (saves + shares).
              </p>
            )}
            {kit?.note && <p className="mt-2 text-[10px] text-[#111111]/60 leading-snug">{kit.note}</p>}
          </div>

          <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#111111]/60 mb-3">
              Social
            </p>
            {contact ? (
              <p className="text-[12px] text-[#111111] mb-2">
                Linked channel · <span className="font-bold">{contact}</span>
              </p>
            ) : (
              <p className="text-[12px] text-[#111111]/60 mb-2">
                No social channel linked on the vendor profile.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) =>
                ch.href ? (
                  <a
                    key={ch.id}
                    href={ch.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[11px] font-bold text-[#111111]"
                  >
                    {ch.label}
                  </a>
                ) : (
                  <span
                    key={ch.id}
                    className="rounded-full border border-dashed border-[#E5E7EB] px-3 py-1.5 text-[11px] font-bold text-[#111111]/60"
                  >
                    {ch.label} · not linked
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void shareCard()}
              className="flex-1 h-11 rounded-xl bg-[#111111] text-white text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              Share card
            </button>
            <button
              onClick={() => void copyCard()}
              className="h-11 px-4 rounded-xl border border-[#E5E7EB] text-[#111111] text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button
            onClick={() => onSelect({ tab: 'mylayer', section: 'mediakit' })}
            className="w-full h-11 rounded-xl border border-[#E5E7EB] text-[13px] font-extrabold text-[#111111] cursor-pointer"
          >
            Open media kit
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main sheet gallery -----------------------------------------------------

function MoreToCome() {
  return (
    <section className="px-4 pb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/50">More to come</p>
        <span className="text-[9px] text-[#111111]/45">Not active yet</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Courses', 'Data desk', 'Premium'].map((label) => (
          <div key={label} className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-3">
            <p className="text-[11px] font-extrabold text-[#111111]">{label}</p>
            <p className="mt-1 text-[9px] font-bold text-[#111111]/45">Not built</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ onSelect }: { onSelect: (target: MenuTarget) => void }) {
  const actions: { label: string; detail: string; target: MenuTarget }[] = [
    { label: 'New', detail: 'Capture something useful', target: { tab: 'capture' } },
    { label: 'Dashboard', detail: 'See what is moving', target: { tab: 'workflows', section: 'command' } },
    { label: 'Inbox', detail: 'Review what needs you', target: { tab: 'workflows', section: 'inbox' } },
    { label: 'Records', detail: 'Open your vaults', target: { tab: 'workflows', section: 'vault' } },
    { label: 'Calendar', detail: 'Keep a date in view', target: { tab: 'workflows', section: 'calendar' } }
  ];
  return (
    <section className="px-4 pb-4">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/50">Quick actions</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onSelect(action.target)}
            className="group rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-3 text-left transition-colors hover:border-[#111111]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-extrabold text-[#111111]">{action.label}</p>
              <span className="text-[14px] text-[#111111]/35 transition-transform group-hover:translate-x-0.5">→</span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-[#111111]/55">{action.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

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
    <section className="px-4 pb-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/50">Your region</p>
        <span className="text-[9px] text-[#111111]/45">{selectedLocation}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {REGIONS.map((region) => {
          const selected = selectedLocation.toLowerCase().includes(region.city.label.toLowerCase()) ||
            selectedLocation.toLowerCase() === region.label.toLowerCase();
          return (
            <button
              key={region.label}
              type="button"
              onClick={() => {
                onSelectCity(region.city);
                onSelect({ tab: 'nearby', section: 'stream' });
              }}
              className="rounded-xl border bg-[#FFFFFF] px-2 py-2.5 text-center transition-colors hover:border-[#111111]"
              style={{ borderColor: selected ? '#111111' : '#E5E7EB' }}
            >
              <span className="block text-[20px] leading-none">{region.flag}</span>
              <span className="mt-1 block truncate text-[10px] font-extrabold text-[#111111]">{region.label}</span>
              {selected && <span className="mt-0.5 block text-[8px] font-bold text-[#111111]/50">Selected</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

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
    <div className="fixed inset-0 z-[45] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Dismiss menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px] cursor-pointer"
      />
      <aside
        role="dialog"
        aria-label="Explore gallery"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-[#E5E7EB] bg-[#FAFAFA] shadow-2xl sm:max-h-[min(860px,calc(100vh-24px))] sm:rounded-[28px]"
        style={{ maxHeight: 'calc(100vh - 12px)' }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#111111]/50">Main sheet</p>
            <h1 className="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em] text-[#111111]">Explore by shelf</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-[20px] leading-none text-[#111111] cursor-pointer"
            aria-label="Close explore gallery"
          >
            ×
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <HostValueCard
            expanded={cardOpen}
            onExpand={() => setCardOpen(true)}
            onBack={() => setCardOpen(false)}
            onSelect={onSelect}
          />

          {!cardOpen && (
            <>
              <MainShelf onSelect={onSelect} compact />
              <QuickActions onSelect={onSelect} />
              <MoreToCome />
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
