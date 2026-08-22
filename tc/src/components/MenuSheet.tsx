import React from 'react';
import {
  BadgeCheck,
  Bookmark,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Copy,
  CreditCard,
  Crown,
  Database,
  Inbox,
  Landmark,
  MessageCircle,
  Newspaper,
  Plus,
  Send,
  Share2,
  ShoppingBag,
  Trophy,
  Users,
  Wallet,
  Zap
} from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { AuthedUser } from '../api/briefApi';
import type { CommandCentre, Wallet as WalletType } from '../api/types';

// ---------------------------------------------------------------------------
// MENU SHEET — a selectable bottom screen in place of a titled side menu.
//
// No product title. No "Brief" wordmark. The shelf is the menu: a host value
// card you can showcase, a quick-select row, then grouped lists in the same
// rhythm as a community drawer (community / host / coming soon / regional).
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
      | 'sources' | 'money' | 'vault' | 'gate' | 'tea' }
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

  const name = kit?.displayName || me?.displayName || 'Host';
  const handle = me?.handle ? `@${me.handle}` : null;
  const audience = kit?.audience;
  const contact = kit?.contactMethod ?? null;

  const standing = [
    command ? { label: 'Settled', value: money(command.money.grossSettled, command.money.currency) } : null,
    command ? { label: 'Arrived', value: String(command.people.checkedIn) } : null,
    audience && audience.views !== undefined ? { label: 'Views', value: String(audience.views) } : null,
    command ? { label: 'Hosted', value: String(command.campaigns.length) } : null
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
    <div className="px-2 pt-1">
      {expanded && (
        <button
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-[11px] font-bold text-[#3d4460] cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Shelf
        </button>
      )}

      <button
        type="button"
        onClick={expanded ? undefined : onExpand}
        className="w-full text-left rounded-2xl p-2.5 shadow-lg cursor-pointer"
        style={{
          background: 'linear-gradient(145deg, #141a28 0%, #0c1220 58%, #163528 100%)',
          border: '1px solid rgba(67,209,122,0.28)'
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-[12px] font-extrabold shrink-0"
            style={{ background: '#43D17A', color: '#090B10' }}
          >
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-[#F3F1E7] truncate">{name}</p>
            <p className="text-[10px] text-[#8A93A6] truncate">
              {handle ?? (kitKnown && !kit ? 'No vendor profile yet' : 'Your host card')}
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-1">
          {(standing.length > 0 ? standing : [
            { label: 'Settled', value: '—' },
            { label: 'Arrived', value: '—' },
            { label: 'Hosted', value: '—' }
          ]).slice(0, 3).map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-1 min-w-0">
              <p className="text-[9px] text-[#8A93A6]">{s.label}</p>
              <p className="text-[12px] font-extrabold text-[#F3F1E7] truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white border border-[#e6e8f0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5b6478]">Payments</p>
              <button
                onClick={() => onSelect({ tab: 'workflows', section: 'money' })}
                className="text-[11px] font-extrabold text-[#0f766e] cursor-pointer"
              >
                Open ledger
              </button>
            </div>
            {wallet ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[18px] font-extrabold text-[#0f766e]">
                    {money(wallet.balance, wallet.currency)}
                  </p>
                  <p className="text-[10px] text-[#6b7289]">Available · settled only</p>
                </div>
                <div>
                  <p className="text-[18px] font-extrabold text-[#b45309]">
                    {money(wallet.pending, wallet.currency)}
                  </p>
                  <p className="text-[10px] text-[#6b7289]">Pending</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[#6b7289]">Wallet not loaded. Nothing is assumed.</p>
            )}
            {wallet && !wallet.provider.configured && (
              <p className="mt-2 text-[10px] text-[#b45309] leading-snug">{wallet.provider.reason}</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-[#e6e8f0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5b6478]">
                Marketing
              </p>
              <button
                onClick={() => onSelect({ tab: 'workflows', section: 'command' })}
                className="text-[11px] font-extrabold text-[#0f766e] cursor-pointer"
              >
                Command
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <p className="text-[16px] font-extrabold text-[#16181f]">
                    {m.value === undefined ? '—' : m.value}
                  </p>
                  <p className="text-[9px] text-[#6b7289]">{m.label}</p>
                </div>
              ))}
            </div>
            {audience?.engagementRate != null && (
              <p className="mt-2 text-[10px] text-[#6b7289]">
                Engagement {Math.round(audience.engagementRate * 100)}% of views (saves + shares).
              </p>
            )}
            {kit?.note && <p className="mt-2 text-[10px] text-[#9aa0b4] leading-snug">{kit.note}</p>}
          </div>

          <div className="rounded-2xl bg-white border border-[#e6e8f0] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#5b6478] mb-3">
              Social
            </p>
            {contact ? (
              <p className="text-[12px] text-[#16181f] mb-2">
                Linked channel · <span className="font-bold">{contact}</span>
              </p>
            ) : (
              <p className="text-[12px] text-[#6b7289] mb-2">
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
                    className="rounded-full border border-[#d7dbe8] px-3 py-1.5 text-[11px] font-bold text-[#16181f]"
                  >
                    {ch.label}
                  </a>
                ) : (
                  <span
                    key={ch.id}
                    className="rounded-full border border-dashed border-[#d7dbe8] px-3 py-1.5 text-[11px] font-bold text-[#9aa0b4]"
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
              className="flex-1 h-11 rounded-xl bg-[#0f766e] text-white text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              Share card
            </button>
            <button
              onClick={() => void copyCard()}
              className="h-11 px-4 rounded-xl border border-[#d7dbe8] text-[#16181f] text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button
            onClick={() => onSelect({ tab: 'mylayer', section: 'mediakit' })}
            className="w-full h-11 rounded-xl border border-[#d7dbe8] text-[13px] font-extrabold text-[#16181f] cursor-pointer"
          >
            Open media kit
          </button>
        </div>
      )}
    </div>
  );
}

// --- Shelf lists ------------------------------------------------------------

function Section({
  title,
  children,
  tint
}: {
  title: string;
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <section className={tint ? '' : 'bg-white'}>
      <div className={`px-2.5 pt-3 pb-1.5 ${tint ?? 'bg-[#f3f5f8]'}`}>
        <h2 className="text-[12px] font-extrabold text-[#16181f] tracking-tight">{title}</h2>
      </div>
      <div className={tint ?? 'bg-white'}>{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  muted,
  onClick
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2.5 py-2.5 text-left cursor-pointer ${
        muted ? 'text-[#7b8194]' : 'text-[#1c2340]'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-[12px] font-semibold truncate">{label}</span>
    </button>
  );
}

const QUICK: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  target: MenuTarget;
}[] = [
  { id: 'new', label: 'New', icon: Plus, target: { tab: 'capture' } },
  { id: 'inbox', label: 'Inbox', icon: Inbox, target: { tab: 'workflows', section: 'inbox' } },
  { id: 'money', label: 'Money', icon: Wallet, target: { tab: 'workflows', section: 'money' } },
  { id: 'circles', label: 'Circles', icon: Users, target: { tab: 'mylayer', section: 'circles' } },
  { id: 'market', label: 'Market', icon: ShoppingBag, target: { tab: 'nearby', section: 'market' } },
  { id: 'command', label: 'Command', icon: Landmark, target: { tab: 'workflows', section: 'command' } },
  { id: 'tea', label: 'Tea', icon: Newspaper, target: { tab: 'nearby', section: 'tea' } },
  { id: 'groups', label: 'Groups', icon: Users, target: { tab: 'mylayer', section: 'groups' } }
];

export function MenuSheet({ open, onClose, onSelect, onSelectCity, selectedLocation }: MenuSheetProps) {
  const [cardOpen, setCardOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCardOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        aria-label="Dismiss menu"
        onClick={onClose}
        className="fixed inset-0 z-[45] bg-black/25 cursor-pointer"
      />
      <div
        role="dialog"
        aria-label="Menu"
        className="fixed top-0 bottom-0 left-0 z-[50] flex flex-col overflow-x-hidden overflow-y-auto border-r border-[#d7dbe8] shadow-[8px_0_24px_rgba(0,0,0,0.22)]"
        style={{
          background: '#f7f8fb',
          width: '33.333vw',
          maxWidth: '33.333vw',
          minWidth: 0
        }}
      >
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <HostValueCard
            expanded={cardOpen}
            onExpand={() => setCardOpen(true)}
            onBack={() => setCardOpen(false)}
            onSelect={onSelect}
          />

          {!cardOpen && (
            <>
              <div className="px-2 pt-3 pb-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK.map((q) => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(q.target)}
                        className="flex flex-col items-center gap-1 cursor-pointer min-w-0"
                      >
                        <span className="h-9 w-9 rounded-xl bg-white border border-[#e4e7ef] flex items-center justify-center text-[#0f766e] shadow-sm">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-[9px] font-bold text-[#3d4460] truncate w-full text-center">{q.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Section title="Community">
                <Row icon={CheckCircle2} label="Tea" onClick={() => onSelect({ tab: 'nearby', section: 'tea' })} />
                <Row icon={Circle} label="Circles" onClick={() => onSelect({ tab: 'mylayer', section: 'circles' })} />
                <Row icon={CalendarDays} label="Campaigns" onClick={() => onSelect({ tab: 'mylayer', section: 'campaigns' })} />
                <Row icon={Trophy} label="Play" onClick={() => onSelect({ tab: 'arena' })} />
                <div className="px-2 pb-3 pt-1">
                  <button
                    onClick={() => onSelect({ tab: 'capture' })}
                    className="w-full h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Start
                  </button>
                </div>
              </Section>

              <Section title="Host">
                <Row icon={Landmark} label="Command" onClick={() => onSelect({ tab: 'workflows', section: 'command' })} />
                <Row icon={CreditCard} label="Money" onClick={() => onSelect({ tab: 'workflows', section: 'money' })} />
                <Row icon={BadgeCheck} label="Media kit" onClick={() => onSelect({ tab: 'mylayer', section: 'mediakit' })} />
                <Row icon={MessageCircle} label="Messages" onClick={() => onSelect({ tab: 'mylayer', section: 'messages' })} />
                <Row icon={Inbox} label="Inbox" onClick={() => onSelect({ tab: 'workflows', section: 'inbox' })} />
                <Row icon={Zap} label="Cockpit" onClick={() => onSelect({ tab: 'workflows', section: 'cockpit' })} />
                <Row icon={Send} label="Sources" onClick={() => onSelect({ tab: 'workflows', section: 'sources' })} />
                <Row icon={Bookmark} label="Vault" onClick={() => onSelect({ tab: 'workflows', section: 'vault' })} />
              </Section>

              <Section title="Coming soon">
                <Row icon={BookOpen} label="Courses" muted onClick={() => undefined} />
                <Row icon={Database} label="Data desk" muted onClick={() => undefined} />
                <Row icon={Crown} label="Premium" muted onClick={() => undefined} />
              </Section>

              <Section title="Regional communities" tint="bg-[#d9dcf0]">
                {REGIONS.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => {
                      onSelectCity(r.city);
                      onSelect({ tab: 'nearby', section: 'stream' });
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left cursor-pointer"
                  >
                    <span className="text-[18px] leading-none w-6 text-center">{r.flag}</span>
                    <span className="text-[15px] font-semibold text-[#1c2340]">{r.label}</span>
                    {selectedLocation.toLowerCase().includes(r.city.label.toLowerCase()) ||
                    selectedLocation.toLowerCase() === r.label.toLowerCase() ? (
                      <span className="ml-auto text-[10px] font-extrabold text-[#0f766e]">Here</span>
                    ) : null}
                  </button>
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default MenuSheet;
