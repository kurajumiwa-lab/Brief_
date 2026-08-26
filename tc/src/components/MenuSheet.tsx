import React from 'react';
import {
  BadgeCheck,
  Bookmark,
  Briefcase,
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
import { MENU_QUICK } from '../ui/names';

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
      <div className={`px-2.5 pt-3 pb-1.5 ${tint ?? 'bg-[#F3F4F6]'}`}>
        <h2 className="text-[15px] font-extrabold text-[#111111] tracking-tight">{title}</h2>
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
        muted ? 'text-[#111111]/60' : 'text-[#111111]'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-[14px] font-semibold truncate">{label}</span>
    </button>
  );
}

const QUICK: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  target: MenuTarget;
}[] = [
  { id: 'new', label: MENU_QUICK.new, icon: Plus, target: { tab: 'capture' } },
  { id: 'inbox', label: MENU_QUICK.inbox, icon: Inbox, target: { tab: 'workflows', section: 'inbox' } },
  { id: 'money', label: MENU_QUICK.money, icon: Wallet, target: { tab: 'workflows', section: 'money' } },
  { id: 'circles', label: MENU_QUICK.circles, icon: Users, target: { tab: 'mylayer', section: 'circles' } },
  { id: 'market', label: MENU_QUICK.market, icon: ShoppingBag, target: { tab: 'nearby', section: 'market' } },
  { id: 'command', label: MENU_QUICK.command, icon: Landmark, target: { tab: 'workflows', section: 'command' } },
  { id: 'tea', label: MENU_QUICK.tea, icon: Newspaper, target: { tab: 'nearby', section: 'tea' } },
  { id: 'groups', label: MENU_QUICK.groups, icon: Users, target: { tab: 'mylayer', section: 'groups' } }
];

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
    <div
      className="fixed inset-x-0 top-0 z-[45] flex"
      style={{ bottom: 56 }}
    >
      <aside
        role="dialog"
        aria-label="Menu"
        aria-modal="true"
        className="h-full w-[min(20rem,78vw)] max-w-[78vw] min-w-0 shrink-0 overflow-y-auto overflow-x-hidden border-r border-[#E5E7EB] shadow-[8px_0_24px_rgba(0,0,0,0.22)]"
        style={{
          background: '#FFFFFF',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch'
        }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
          <HostValueCard
            expanded={cardOpen}
            onExpand={() => setCardOpen(true)}
            onBack={() => setCardOpen(false)}
            onSelect={onSelect}
          />

          {!cardOpen && (
            <>
              <div className="px-2 pt-3 pb-2">
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((q) => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(q.target)}
                        className="flex flex-col items-center gap-1 cursor-pointer min-w-0"
                      >
                        <span className="h-9 w-9 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#111111] shadow-sm">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-[9px] font-bold text-[#111111] truncate w-full text-center">{q.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Section title="Community">
                <Row icon={CheckCircle2} label="Stories" onClick={() => onSelect({ tab: 'nearby', section: 'tea' })} />
                <Row icon={Circle} label="Groups" onClick={() => onSelect({ tab: 'mylayer', section: 'circles' })} />
                <Row icon={CalendarDays} label="Events" onClick={() => onSelect({ tab: 'mylayer', section: 'campaigns' })} />
                <Row icon={Trophy} label="Play" onClick={() => onSelect({ tab: 'arena' })} />
                <div className="px-2 pb-3 pt-1">
                  <button
                    onClick={() => onSelect({ tab: 'capture' })}
                    className="w-full h-9 rounded-lg bg-[#111111] text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Start
                  </button>
                </div>
              </Section>

              <Section title="Host">
                <Row icon={Landmark} label="Dashboard" onClick={() => onSelect({ tab: 'workflows', section: 'command' })} />
                <Row icon={CreditCard} label="Payments" onClick={() => onSelect({ tab: 'workflows', section: 'money' })} />
                <Row icon={BadgeCheck} label="Profile" onClick={() => onSelect({ tab: 'mylayer', section: 'mediakit' })} />
                <Row icon={MessageCircle} label="Messages" onClick={() => onSelect({ tab: 'mylayer', section: 'messages' })} />
                <Row icon={Inbox} label="Inbox" onClick={() => onSelect({ tab: 'workflows', section: 'inbox' })} />
                <Row icon={Zap} label="Create" onClick={() => onSelect({ tab: 'workflows', section: 'cockpit' })} />
                <Row icon={Briefcase} label="Advertise" onClick={() => onSelect({ tab: 'workflows', section: 'campaigns' })} />
                <Row icon={Users} label="Matches" onClick={() => onSelect({ tab: 'workflows', section: 'matches' })} />
                <Row icon={Send} label="Distribution" onClick={() => onSelect({ tab: 'workflows', section: 'distribution' })} />
                <Row icon={CalendarDays} label="Calendar" onClick={() => onSelect({ tab: 'workflows', section: 'calendar' })} />
                <Row icon={Send} label="Feeds" onClick={() => onSelect({ tab: 'workflows', section: 'sources' })} />
                <Row icon={Bookmark} label="Records" onClick={() => onSelect({ tab: 'workflows', section: 'vault' })} />
              </Section>

              <Section title="Coming soon">
                {[
                  { icon: BookOpen, label: 'Courses' },
                  { icon: Database, label: 'Data desk' },
                  { icon: Crown, label: 'Premium' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex w-full items-center gap-2 px-2.5 py-2.5 text-[#111111]/60"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-[14px] font-semibold truncate">{item.label}</span>
                      <span className="ml-auto text-[10px] font-bold shrink-0">Not built</span>
                    </div>
                  );
                })}
              </Section>

              <Section title="Regional communities" tint="bg-[#F3F4F6]">
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
                    <span className="text-[13px] font-semibold text-[#111111] truncate">{r.label}</span>
                    {selectedLocation.toLowerCase().includes(r.city.label.toLowerCase()) ||
                    selectedLocation.toLowerCase() === r.label.toLowerCase() ? (
                      <span className="ml-auto text-[10px] font-extrabold text-[#111111]">Here</span>
                    ) : null}
                  </button>
                ))}
              </Section>
            </>
          )}
      </aside>
      <button
        type="button"
        aria-label="Dismiss menu"
        onClick={onClose}
        className="h-full min-w-0 flex-1 bg-black/20 cursor-pointer"
        style={{ touchAction: 'none' }}
        onTouchMove={(e) => e.preventDefault()}
      />
    </div>
  );
}

export default MenuSheet;
