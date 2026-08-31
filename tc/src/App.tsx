import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as briefApi from './api/briefApi';
import {
  parsePath,
  toPath,
  objectShareUrl,
  isBriefRoute,
  DEFAULT_ROUTE,
  type BriefRoute
} from './nav/routes';
import type { ArenaMoneyStatus } from './api/types';
import QRCode from 'qrcode';
import { deriveDestinationAlerts, readLastSeen, writeLastSeen, alertLabel, type DestinationAlerts } from './nav/alerts';
import { CampaignDistribution } from './components/CampaignDistribution';
import { AwaitingPayment } from './components/AwaitingPayment';
import { SourcesPanel } from './components/SourcesPanel';
import { ConnectedGroups } from './components/ConnectedGroups';
import { MoneyPanel } from './components/MoneyPanel';
import { ResaleDesk } from './components/ResaleDesk';
import { MyTickets } from './components/MyTickets';
import { EventResale } from './components/EventResale';
import { EventsHub } from './components/EventsHub';
import { MshikanoDesk } from './components/MshikanoDesk';
import { VerificationPanel } from './components/VerificationPanel';
import { EplDesk } from './components/EplDesk';
import { Vault } from './components/vault/Vault';
import ServiceFees from './components/ServiceFees';
import { WhatsAppShopBuilder } from './components/WhatsAppShopBuilder';
import RewardsDesk from './components/RewardsDesk';
import { CheckIn } from './components/CheckIn';
import { HostCommand } from './components/HostCommand';
import { TickerBanner, PromptBanner, JumbotronBanner } from './components/SignalBanner';
import { BracketLadder } from './components/BracketLadder';
import { TournamentCard } from './components/TournamentCard';
import { ActionsEngine } from './components/ActionsEngine';
import { Circles } from './components/Circles';
import { Marketplace } from './components/Marketplace';
import { Pursuits } from './components/Pursuits';
import { Inbox } from './components/Inbox';
import { TriageQueue } from './components/TriageQueue';
import { Quests } from './components/Quests';
import { LocationChip } from './components/LocationChip';
import type { GeoPoint } from './components/LocationChip';
import { ArenaShelf } from './components/ArenaShelf';
import { ArenaPulse, SeasonStrip } from './components/ArenaPulse';
import { MainShelf } from './components/MainShelf';
import { Onboarding } from './components/Onboarding';
import { NextStep } from './components/NextStep';
import { isSurfaceUnlocked, shouldOpenFirstRun, showsLadder, unlockHint } from './components/ladder';
import { arrivalSource, linkTokenFrom, urlWithoutArrivalParams, type ArrivalChannel } from './components/arrival';
import { ArenaBetaPilot } from './components/ArenaBetaPilot';
import type { ArenaBetaSegment, ArenaBetaSummary } from './api/types';
import { EnginePanel } from './components/EnginePanel';
import { GroupBuyPortal } from './components/GroupBuyPortal';
import { MatchQueuePanel } from './components/MatchQueuePanel';
import { TicketBar } from './components/TicketBar';
import { ArenaGameScreen } from './components/ArenaGameScreen';
import type { ArenaStakeKind } from './components/ArenaGameScreen';
import { LobbyBoard } from './components/LobbyBoard';
import { FeedComposer } from './components/FeedComposer';
import { WireSection } from './components/WireSection';
import { TeaDesk } from './components/TeaDesk';
import { CreatorCockpit } from './components/CreatorCockpit';
import { CreatorProfilePanel, OpportunitiesPanel, MessagesPanel, SubscriptionsPanel } from './components/CreatorPanels';
import { SearchResults } from './components/SearchResults';
import { YardEngineDesk } from './components/YardEngineDesk';
import type { YardSection } from './components/YardEngineDesk';
import { TeaReader } from './components/TeaReader';
import type { CircleDetail as ApiCircleDetail } from './api/briefApi';
import type {
  Campaign as ApiCampaign,
  CampaignType as ApiCampaignType,
  PublicCampaign as ApiPublicCampaign,
  Registration as ApiRegistration
} from './api/types';
import {
  Building2,
  Search,
  Sparkles,
  Plus,
  Terminal,
  Activity,
  MapPin,
  Users,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Bookmark,
  Share2,
  Bell,
  Flag,
  MoreHorizontal,
  Clock,
  Tag,
  Megaphone,
  AlertTriangle,
  BadgePercent,
  Globe,
  Trash2,
  Circle,
  Award,
  TrendingUp,
  User,
  Store,
  Landmark,
  Sun,
  Sunset,
  CalendarDays,
  Newspaper,
  Heart,
  MessageCircle,
  ExternalLink,
  Eye,
  X,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { MenuSheet } from './components/MenuSheet';
import { AdminDesk } from './components/AdminDesk';
import type { MenuTarget } from './components/MenuSheet';
import { PlayAs } from './components/PlayAs';
import type { LucideIcon } from 'lucide-react';
import {
  ROOM, HOME_MORE, SAVED_TABS, INBOX_TABS, FILTERS,
  WORKFLOW_BUNDLES, SAVED_BUNDLES, QUEUE_LABEL, QUEUE_CHIP, QUEUE_HINT
} from './ui/names';

const bootRoute: BriefRoute = (() => {
  try {
    if (typeof window === 'undefined') return DEFAULT_ROUTE;
    return parsePath(window.location.pathname, window.location.search);
  } catch {
    return DEFAULT_ROUTE;
  }
})();

// ============================================================================
// 1. TYPES & ENUMS
// ============================================================================

export type ObjectType =
  | 'place'
  | 'identity'
  | 'experience'
  | 'opportunity'
  | 'knowledge'
  | 'community'
  | 'product'
  | 'service'
  | 'document'
  | 'conversation'
  | 'business'
  | 'offer'
  | 'alert'
  | 'announcement'
  | 'news';

export type ProtocolAction =
  | 'discover'
  | 'read'
  | 'save'
  | 'share'
  | 'contact'
  | 'book'
  | 'buy'
  | 'report'
  | 'verify'
  | 'follow';

// --- Navigation -------------------------------------------------------------
// Four screens. Menu is an overlay, not a fifth room. Pulse was removed by
// product decision (2026-08-29): its change-feed read duplicated what the
// surfaces themselves now say. The notifications API remains server-complete;
// it simply has no dedicated page any more.
export type Destination =
  | 'nearby'
  | 'arena'
  | 'mylayer'
  | 'workflows';

// The four screens, defined once and consumed by both the desktop rail and the
// mobile dock so the two can never drift apart.
export const DESTINATIONS: {
  id: Destination;
  label: string;
  hint: string;
}[] = [
  { id: 'nearby', label: ROOM.nearby.label, hint: ROOM.nearby.hint },
  { id: 'arena', label: ROOM.arena.label, hint: ROOM.arena.hint },
  { id: 'mylayer', label: ROOM.mylayer.label, hint: ROOM.mylayer.hint },
  { id: 'workflows', label: ROOM.workflows.label, hint: ROOM.workflows.hint }
];

// The red activity dot for a sidebar title. Dot for 1 update, dot + count
// from 2 (capped at 9+). Pure presentation; counts come from real data only.
function ActivityDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="brief-alert-dot inline-flex items-center justify-center min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#B42318] text-[#FFFFFF] text-[8px] font-extrabold leading-none shadow-[0_0_0_1.5px_#FBFAFD]"
    >
      {n > 1 ? alertLabel(n) : ''}
    </span>
  );
}

// Icons kept separate from DESTINATIONS so the data stays plain and the
// component layer owns the visuals.
const DESTINATION_ICONS: Record<Destination, LucideIcon> = {
  nearby: MapPin,
  arena: Award,
  mylayer: Bookmark,
  workflows: Briefcase
};

export type NearbySection = 'stream' | 'tea' | 'today' | 'pursuits' | 'quests' | 'market' | 'events' | 'mshikano';
export type MyLayerSection =
  | 'saved' | 'activity' | 'arena' | 'points' | 'circles' | 'groups' | 'campaigns'
  | 'mediakit' | 'opportunities' | 'messages' | 'subscriptions' | 'tickets'
  | 'verification';
// Workflows secondary: a Journey is either in progress or finished. Inbox and
// Sources are kept -- they are existing workflow surfaces, not new screens.
export type WorkflowSection = 'cockpit' | 'command' | 'active' | 'completed' | 'inbox' | 'sources' | 'money' | 'vault' | 'gate' | 'tea' | 'campaigns' | 'matches' | 'distribution' | 'calendar' | 'vendors' | 'shop' | 'ai' | 'engine' | 'groupbuy' | 'resale' | 'fees';
// Pulse secondary. Pulse is the information layer: freshness, local signals,
// what groups are surfacing, and emerging activity. It is not an assistant.
export type PulseSection = 'now' | 'local' | 'groups' | 'signals';

export type FlowState = 'discovered' | 'engaged' | 'committed' | 'completed' | 'archived';
export type AccessPortal = 'citizen' | 'merchant' | 'civic_admin' | 'moderator';

export interface BriefObject {
  id: string;
  type: ObjectType;
  title: string;
  category: string;
  summary: string;
  locationName?: string;
  creatorName?: string;
  // NO trustScore. Trust is an evidence list -- who provided this, when it
  // was last verified, what it is linked to -- never a single invented
  // percentage. The server stores no such score and Brief does not compute
  // one, so the field is gone rather than left dangling as dead UI.
  lastVerifiedAt?: string;
  validityWindowDays?: number;
  isVerified?: boolean;
  imageUrl?: string;
  /** A provider image reference (e.g. a Telegram file_id) awaiting server-side
   *  resolution; the render URL is derived from it, never the raw id. */
  imageReference?: string;
  imageNeedsResolution?: boolean;
  /** Real additional source images (news galleries, event photo sets). Never
   *  fabricated — the server only projects images that exist in provenance. */
  gallery?: { url: string; alt?: string; attribution?: string | null }[];
  /** When the story was first published anywhere in its provenance. */
  publishedAt?: string;
  /** The server's temporal lifecycle projection (status/startsAt/deadlineAt). */
  temporal?: {
    status?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    deadlineAt?: string | null;
    dayOfWeek?: string | null;
  };
  /** Real source names for attribution ("From Telegram" = the actual name). */
  sourceNames?: string[];
  sourceCount?: number;
  /** Server-labelled temporary demo content; never a client-side fixture flag. */
  testContent?: { label: string; expiresAt: string | null };

  // --- Provenance ------------------------------------------------------------
  // Where this record came from: the listing, register entry or page an
  // ingestor scraped or a contributor cited. Distinct from actionUrl -- this
  // answers "how do we know this?", not "where do we send the user?".
  //
  // sourceType names the channel it arrived through, so an ingestor can be
  // attributed, rate-limited and trust-weighted per channel: a county register
  // is not a Telegram forward.
  sourceType?: SourceType | 'user';
  sourceUrl?: string;

  // Ingestion plumbing (prompt 22). Not rendered anywhere yet -- these exist so
  // a future pipeline can attribute, de-duplicate and re-fetch a record without
  // another migration. No seed object sets them; none are back-filled.
  sourceId?: string;
  sourceMessageId?: string;
  ingestedAt?: string;

  // --- Destination / action layer -------------------------------------------
  // How Brief routes a user to the real thing. When absent, the destination is
  // derived from locationName / metadata.contactPhone where possible; when
  // nothing can be derived, the UI says so instead of faking a transaction.
  //   'external' -- opens a URL in a new tab (checkout, application portal, doc)
  //   'phone'    -- tel: link, uses actionUrl or falls back to contactPhone
  //   'map'      -- Maps search, uses actionUrl or falls back to locationName
  //   'internal' -- stays in Brief and pivots the stream to this object's type
  actionUrl?: string;
  actionType?: 'internal' | 'external' | 'phone' | 'map';
  actionLabel?: string;

  // --- Explicit object graph --------------------------------------------------
  // Only ever set deliberately (by a curator or an ingestor that genuinely
  // knows the link). Discovery ranks these above inferred similarity, so a
  // wrong value here is worse than no value. Never populate by guessing.
  //   parentObjectId   -- this belongs to / is part of that
  //   providerObjectId -- the identity that sells or operates this
  //   locationObjectId -- the place this physically happens at
  //   relatedObjectIds -- hand-curated siblings
  parentObjectId?: string;
  providerObjectId?: string;
  locationObjectId?: string;
  relatedObjectIds?: string[];
  metadata?: {
    price?: number;
    currency?: string;
    deadline?: string;
    capacity?: number;
    attendeesCount?: number;
    contactPhone?: string;
    operatingHours?: string;
    rating?: number;
    reviewsCount?: number;
    distanceKm?: number;
    statusBadge?: string;
    [key: string]: any;
  };
  createdAt: string;
}

export interface ObjectRelationship {
  id: string;
  sourceType: ObjectType;
  sourceId: string;
  verb: string;
  targetType: ObjectType;
  targetId: string;
  state: FlowState;
  updatedAt: string;
  // Optional personal note on WHY this was saved (prompt 10). Lives on the
  // relationship, not on a parallel saved-object store. Absent on every
  // pre-existing edge, and everything must keep working when it is.
  label?: SaveLabel;
}

// Deliberately a closed list: freeform tags become a taxonomy nobody maintains.
export type SaveLabel = 'Later' | 'Important' | 'Visit' | 'Buy' | 'Apply' | 'Follow up';

export const SAVE_LABELS: SaveLabel[] = [
  'Later',
  'Important',
  'Visit',
  'Buy',
  'Apply',
  'Follow up'
];

export interface JourneyStep {
  id: string;
  order: number;
  title: string;
  description: string;
  targetObjectType: ObjectType;
  targetObjectId?: string;
  isCompleted: boolean;
  statusLabel?: string;
}

export interface Journey {
  id: string;
  title: string;
  category: string;
  description: string;
  estimatedDays: number;
  steps: JourneyStep[];
  progressPercent: number;
  isCompleted: boolean;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Tea / news layer.
//
// Posts are deliberately NOT BriefObjects. An object is a durable local thing
// (a market exists for years); a post is a moment (true for hours). They carry
// different fields, age differently, and are moderated differently -- but they
// link: a post can point at the object it is about via relatedObjectId.
// ---------------------------------------------------------------------------
export type TeaEdition = 'morning' | 'evening' | 'weekend';

export type PostKind = 'news' | 'chatter' | 'notice' | 'question' | 'promo';

export interface BriefPost {
  id: string;
  edition: TeaEdition;
  kind: PostKind;
  title: string;
  body: string;
  authorName: string;
  authorHandle?: string;
  authorIsVerified?: boolean;
  publishedAt: string;
  reactionsCount: number;
  commentsCount: number;
  /** Paid distribution. Always surfaced in the UI, never disguised as editorial. */
  isPromoted?: boolean;
  promotedBy?: string;
  /** Links this post to the durable object it is about. */
  relatedObjectId?: string;
  tags?: string[];
}

/**
 * A single civic metric.
 *
 * Brief used to hardcode these ("412 businesses helped", "97.4% fresh") and
 * render them as measured civic activity. They were invented. The type now
 * makes that impossible to repeat: a metric is EITHER derived from records
 * Brief actually holds, or it is explicitly unavailable and says why.
 *
 * There is no third case, and no numeric default. `available: false` carries
 * no `value` field at all, so a surface cannot read a number that was never
 * measured -- it is a compile error, not a runtime 0.
 */
// ----------------------------------------------------------------------------
// Type-derived helpers (must live BELOW the type declarations above)
// ----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DESTINATIONS (as distinct from ordinary objects).
//
// Brief is not a marketplace. It is the information layer that tells you
// something is happening near you; the commerce lives INSIDE that context.
// A destination is a place-in-time with people and vendors in it: a popup, a
// market day, a meetup, a fair. A government office is not a destination --
// it is a service you transact with, and inflating it into a "hub" would be
// a lie about what is there.
//
// This is entirely derived from data the objects already carry. No object
// gained a new stored field, and nothing here invents vendors, attendance,
// prices or live status. If the data is not there, the UI says so.
// ---------------------------------------------------------------------------

/** Categories that describe a controlled, vendor-bearing gathering. */
const DESTINATION_CATEGORIES = [
  'event',
  'popup',
  'market',
  'marketplace',
  'fair',
  'festival',
  'meetup',
  'exhibition',
  'activation',
  'networking'
];

/**
 * A destination is either an experience (an event is always a destination) or
 * a place whose category says it is a trading/gathering venue. Civic spaces,
 * offices and co-working desks stay ordinary objects.
 *
 * Deliberately conservative: when in doubt, an object stays LEVEL 1.
 */
export const isDestinationObject = (object: BriefObject): boolean => {
  if (object.type === 'experience') return true;
  if (object.type !== 'place') return false;
  const category = object.category.toLowerCase();
  return DESTINATION_CATEGORIES.some((word) => category.includes(word));
};

export type DestinationState =
  | 'live'
  | 'today'
  | 'upcoming'
  | 'scheduled'
  | 'ended';

/**
 * Live state, read from statusBadge and operatingHours only.
 *
 * Rule from the brief: never claim "LIVE" without real timing data. When the
 * record only says "Upcoming", that is what we show. When it says nothing at
 * all we fall back to 'scheduled', which promises nothing.
 */
export const getDestinationState = (
  object: BriefObject,
  now: Date = new Date()
): DestinationState => {
  const badge = (object.metadata?.statusBadge ?? '').toLowerCase();
  if (badge.includes('ended') || badge.includes('closed')) return 'ended';
  if (badge.includes('live') || badge.includes('now')) return 'live';

  const hours = (object.metadata?.operatingHours ?? '').toLowerCase();
  const today = now
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();

  // "Saturdays, 06:00-18:30" on a Saturday is genuinely on today. This is a
  // real reading of a real field, not a guess.
  if (hours.includes(today) || hours.includes(today.slice(0, 3))) {
    return 'today';
  }

  if (badge.includes('upcoming')) return 'upcoming';
  if (badge.includes('open')) return 'today';
  return 'scheduled';
};

const DESTINATION_STATE_LABELS: Record<DestinationState, string> = {
  live: 'Live now',
  today: 'Today',
  upcoming: 'Upcoming',
  scheduled: 'Scheduled',
  ended: 'Ended'
};

/**
 * Visual weight. LEVEL 3 is reserved for a destination that is actually on
 * today AND has something inside it worth walking to; LEVEL 2 is an upcoming
 * destination; everything else stays LEVEL 1 so the stream does not turn into
 * a wall of billboards.
 */
/**
 * Who is trading at this destination, read from real graph edges only.
 *
 * An identity counts as a vendor here when it explicitly states it is located
 * at, part of, or related to this destination -- or at the place the
 * destination happens at (a market day inherits the market's traders, which
 * is how the world actually works). Nothing is inferred from keywords, so a
 * destination with no stated vendors correctly reports zero and the UI says
 * "Vendor information unavailable" instead of inventing a line-up.
 */
export const getDestinationVendors = (
  object: BriefObject,
  all: BriefObject[]
): BriefObject[] => {
  const hostIds = new Set<string>([object.id]);
  if (object.locationObjectId) hostIds.add(object.locationObjectId);
  if (object.parentObjectId) hostIds.add(object.parentObjectId);

  return all.filter((item) => {
    if (item.id === object.id) return false;
    if (item.type !== 'identity') return false;
    return (
      (item.locationObjectId && hostIds.has(item.locationObjectId)) ||
      (item.parentObjectId && hostIds.has(item.parentObjectId)) ||
      (item.relatedObjectIds ?? []).some((id) => hostIds.has(id)) ||
      (object.relatedObjectIds ?? []).includes(item.id)
    );
  });
};

/** What a vendor actually sells: products and services that name it as provider. */
const getVendorOfferings = (
  vendor: BriefObject,
  all: BriefObject[]
): BriefObject[] =>
  all.filter(
    (item) =>
      item.providerObjectId === vendor.id &&
      (item.type === 'product' || item.type === 'service')
  );

/**
 * Where a vendor can be found. Powers the vendor -> destinations hop, so
 * discovering a trader at one popup can lead you to the next one.
 */
const getVendorDestinations = (
  vendor: BriefObject,
  all: BriefObject[]
): BriefObject[] => {
  const anchors = new Set<string>(
    [
      vendor.locationObjectId,
      vendor.parentObjectId,
      ...(vendor.relatedObjectIds ?? [])
    ].filter(Boolean) as string[]
  );
  if (anchors.size === 0) return [];

  return all.filter((item) => {
    if (item.id === vendor.id) return false;
    if (!isDestinationObject(item)) return false;
    return (
      anchors.has(item.id) ||
      (item.locationObjectId ? anchors.has(item.locationObjectId) : false) ||
      (item.parentObjectId ? anchors.has(item.parentObjectId) : false)
    );
  });
};

/** Distinct vendor categories, for the horizontal strip. */
const getVendorCategories = (vendors: BriefObject[]): string[] =>
  Array.from(new Set(vendors.map((v) => v.category)));

export type CardLevel = 1 | 2 | 3;

const getCardLevel = (
  object: BriefObject,
  vendorCount: number,
  now: Date = new Date()
): CardLevel => {
  if (!isDestinationObject(object)) return 1;
  const state = getDestinationState(object, now);
  if (state === 'ended') return 1;
  if ((state === 'live' || state === 'today') && vendorCount > 0) return 3;
  if (state === 'live' || state === 'today' || state === 'upcoming') return 2;
  return 1;
};

/**
 * Access model, read from what the record already states. Most objects say
 * nothing, and silence is not "public" -- we return undefined and render
 * nothing rather than asserting an access policy Brief does not know.
 */
const getDestinationAccess = (object: BriefObject): string | undefined => {
  const badge = object.metadata?.statusBadge ?? '';
  const lowered = badge.toLowerCase();
  if (lowered.includes('open access')) return 'Open';
  if (lowered.includes('ticket')) return 'Ticketed';
  if (lowered.includes('invite')) return 'Invite';
  if (lowered.includes('member')) return 'Members';
  if (lowered.includes('private')) return 'Private';
  return undefined;
};

const getObjectActionLabel = (type: ObjectType): string => {
  switch (type) {
    case 'place':
      return 'Find More';
    case 'experience':
      return 'Join';
    case 'opportunity':
      return 'Apply';
    case 'service':
      return 'Book';
    case 'product':
      return 'Buy';
    case 'knowledge':
      return 'Read';
    case 'identity':
      return 'View';
    case 'community':
      return 'Join';
    case 'conversation':
      return 'Discuss';
    case 'document':
      return 'Open';
    case 'business':
      return 'View';
    case 'offer':
      return 'View';
    case 'alert':
      return 'Read';
    case 'announcement':
      return 'Read';
    case 'news':
      return 'Read';
    default:
      return 'View';
  }
};

// Real, derivable destination for an object -- or null when Brief genuinely
// has nowhere to send the user yet. Never invent a route.
// --- Tea helpers -----------------------------------------------------------

const TEA_EDITIONS: {
  edition: TeaEdition;
  label: string;
  Icon: typeof Sun;
}[] = [
  { edition: 'morning', label: 'Morning', Icon: Sun },
  { edition: 'evening', label: 'Evening', Icon: Sunset },
  { edition: 'weekend', label: 'Weekend', Icon: CalendarDays }
];

// Which edition is "live" right now. Weekend wins on Sat/Sun; otherwise the
// clock decides. Editions are windows over one feed, not separate publications,
// so a reader can always page back to the others.
const getCurrentEdition = (now: Date = new Date()): TeaEdition => {
  const day = now.getDay();
  if (day === 0 || day === 6) return 'weekend';
  return now.getHours() < 14 ? 'morning' : 'evening';
};

const getEditionMeta = (
  edition: TeaEdition
): { label: string; window: string } => {
  switch (edition) {
    case 'morning':
      return { label: 'Morning Tea', window: 'Weekdays before 2pm' };
    case 'evening':
      return { label: 'Evening Tea', window: 'Weekdays after 2pm' };
    case 'weekend':
      return { label: 'Weekend Tea', window: 'Saturday and Sunday' };
  }
};

const getPostKindMeta = (
  kind: PostKind
): { label: string; tone: string } => {
  switch (kind) {
    case 'news':
      return { label: 'News', tone: 'text-[#251045] border-[#D6CFE4]' };
    case 'notice':
      return { label: 'Notice', tone: 'text-[#251045] border-[#6C3EC9]' };
    case 'chatter':
      return { label: 'Chatter', tone: 'text-[#251045] border-[#D6CFE4]' };
    case 'question':
      return { label: 'Question', tone: 'text-[#251045] border-[#6C3EC9]' };
    case 'promo':
      return { label: 'Promoted', tone: 'text-[#251045] border-[#6C3EC9]' };
  }
};

// Compact relative time: 40m, 6h, 3d.
const getRelativeTime = (iso: string, now: Date = new Date()): string => {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const formatCount = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

// Types whose primary action navigates the stream instead of leaving Brief.
const PIVOT_TYPES: ObjectType[] = ['place', 'product', 'service'];

const buildMapsHref = (query: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const buildTelHref = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, '')}`;

export type ResolvedAction =
  | { kind: 'external'; href: string; label: string }
  | { kind: 'phone'; href: string; label: string }
  | { kind: 'map'; href: string; label: string }
  | { kind: 'internal'; label: string }
  | { kind: 'none'; label: string };

// Single source of truth for "what does the primary button do?".
// Explicit actionType on the object always wins; otherwise we derive what we
// safely can from existing data; otherwise we admit there is no route.
const resolveAction = (object: BriefObject): ResolvedAction => {
  const phone = object.metadata?.contactPhone;
  // `||` not `??` on purpose: an empty-string actionLabel from an ingestor
  // should fall back to the generic label, not render a blank button.
  const label = object.actionLabel || getObjectActionLabel(object.type);

  switch (object.actionType) {
    case 'external':
      // A URL is mandatory here -- fall through to 'none' rather than
      // rendering a link that goes nowhere.
      if (object.actionUrl) {
        return { kind: 'external', href: object.actionUrl, label };
      }
      break;

    case 'phone': {
      const number = object.actionUrl ?? phone;
      if (number) {
        return { kind: 'phone', href: buildTelHref(number), label };
      }
      break;
    }

    case 'map': {
      const query = object.actionUrl ?? object.locationName;
      if (query) {
        const href = query.startsWith('http') ? query : buildMapsHref(query);
        return { kind: 'map', href, label };
      }
      break;
    }

    case 'internal':
      return { kind: 'internal', label };
  }

  // --- No explicit routing: derive what we can ------------------------------
  if (PIVOT_TYPES.includes(object.type)) {
    return { kind: 'internal', label };
  }

  if (phone && (object.type === 'identity' || object.type === 'service')) {
    return { kind: 'phone', href: buildTelHref(phone), label: 'Call' };
  }

  if (
    object.locationName &&
    (object.type === 'place' ||
      object.type === 'experience' ||
      object.type === 'identity')
  ) {
    return { kind: 'map', href: buildMapsHref(object.locationName), label };
  }

  return { kind: 'none', label };
};

// Types that belong to the same real-world errand. Buying a stall kit,
// booking the inspection and applying for the grant are one job to the user,
// even though Brief models them as three different object types.
const TYPE_AFFINITY: Partial<Record<ObjectType, ObjectType[]>> = {
  product: ['service', 'opportunity', 'identity'],
  service: ['product', 'opportunity', 'knowledge', 'identity'],
  opportunity: ['service', 'product', 'knowledge'],
  knowledge: ['service', 'opportunity', 'identity'],
  experience: ['place', 'community', 'identity'],
  identity: ['product', 'service', 'knowledge'],
  place: ['experience', 'identity'],
  business: ['product', 'service', 'opportunity', 'identity'],
  offer: ['product', 'service', 'opportunity', 'knowledge'],
  alert: ['knowledge', 'announcement', 'news'],
  announcement: ['knowledge', 'news', 'experience', 'opportunity'],
  news: ['announcement', 'alert', 'knowledge', 'experience', 'opportunity']
};

const areTypesAffine = (a: ObjectType, b: ObjectType): boolean =>
  (TYPE_AFFINITY[a] ?? []).includes(b);

// Plural noun for a type, used when the stream pivots to it.
const getTypePlural = (type: ObjectType): string => {
  switch (type) {
    case 'place':
      return 'places';
    case 'product':
      return 'items';
    case 'service':
      return 'services';
    case 'experience':
      return 'events';
    case 'opportunity':
      return 'opportunities';
    case 'knowledge':
      return 'guides';
    case 'identity':
      return 'organisations';
    case 'business':
      return 'businesses';
    case 'offer':
      return 'offers';
    case 'alert':
      return 'alerts';
    case 'announcement':
      return 'announcements';
    case 'news':
      return 'updates';
    default:
      return 'objects';
  }
};

// Message shown when the primary action retargets the stream.
// `others` is how many OTHER objects share this type -- if none, say so
// rather than announcing a list that turns out to be just this object.
const getPivotMessage = (object: BriefObject, others: number): string => {
  const plural = getTypePlural(object.type);
  if (others === 0) {
    return `No other ${plural} listed nearby yet.`;
  }
  return `Showing ${others} more ${others === 1 ? plural.replace(/s$/, '') : plural} nearby.`;
};

// Why an object was surfaced. Drives the section heading and per-tile chips,
// so the rail can explain itself instead of being an unlabelled grid.
export type RelationReason =
  | 'linked'
  | 'provider'
  | 'location'
  | 'nearby'
  | 'complementary'
  | 'similar';

export interface ScoredRelation {
  item: BriefObject;
  score: number;
  reason: RelationReason;
}

// Any explicit relationship must beat any inferred one. The inferred signals in
// getRelatedObjects sum to at most ~24, so this floor is deliberately clear of
// that ceiling rather than tuned to it.
const EXPLICIT_LINK_FLOOR = 100;

const STOP_WORDS = new Set([
  'and','the','for','with','from','this','that','their','are','was','not',
  'open','new','all','any','out','use','via','per','its','has','you','your'
]);

// Words worth matching on, drawn from the fields a human would skim.
const getKeywords = (object: BriefObject): Set<string> => {
  const raw = `${object.title} ${object.category} ${object.summary} ${
    object.metadata?.statusBadge ?? ''
  }`.toLowerCase();

  return new Set(
    raw
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  );
};

const countKeywordOverlap = (a: Set<string>, b: Set<string>): number => {
  let n = 0;
  a.forEach((word) => {
    if (b.has(word)) n += 1;
  });
  return n;
};

// Heading reflects what the rail actually contains, not just the source type.
const getRelatedHeading = (
  object: BriefObject,
  relations: ScoredRelation[]
): string => {
  if (relations.length === 0) return 'Related';

  const reasons = relations.map((relation) => relation.reason);

  if (reasons.every((reason) => reason === 'nearby')) return 'Nearby';
  if (reasons.some((reason) => reason === 'linked' || reason === 'provider')) {
    switch (object.type) {
      case 'product':
        return 'Sellers and related services';
      case 'service':
        return 'Providers and related places';
      case 'knowledge':
        return 'Related services and guides';
      case 'opportunity':
        return 'Guides and services to apply';
      default:
        return 'Directly related';
    }
  }

  switch (object.type) {
    case 'place':
      return 'Nearby places and vendors';
    case 'product':
      return 'More products and sellers';
    case 'service':
      return 'Other providers nearby';
    case 'opportunity':
      return 'Related opportunities';
    case 'experience':
      return 'Related places and events';
    case 'identity':
      return 'Other vendors and organisations';
    case 'knowledge':
      return 'Related guides';
    default:
      return 'More like this';
  }
};

const getReasonChip = (reason: RelationReason): string | null => {
  switch (reason) {
    case 'provider':
      return 'Provider';
    case 'location':
      return 'Location';
    case 'linked':
      return 'Related';
    case 'complementary':
      return 'Goes with this';
    case 'nearby':
      return 'Nearby';
    default:
      return null;
  }
};

// STEP 5 Proximity: only ever from real distanceKm. Never computed, never guessed.
export const getDistanceLabel = (object: BriefObject): string | null => {
  const distance = object.metadata?.distanceKm;
  if (distance === undefined) return null;
  if (distance < 0.1) return 'Right here';
  if (distance < 1) return `${Math.round(distance * 1000)} m away`;
  return `${distance} km away`;
};

// STEP 2 Key facts, generated from whatever metadata exists. Adding a metadata key
// to an object surfaces it here without touching the JSX.
export interface KeyFact {
  key: string;
  label: string;
  value: string;
}

const buildKeyFacts = (object: BriefObject): KeyFact[] => {
  const meta = object.metadata ?? {};
  const facts: KeyFact[] = [];
  const push = (key: string, label: string, value?: string | null) => {
    if (value) facts.push({ key, label, value });
  };

  if (meta.price !== undefined) {
    push(
      'price',
      object.type === 'opportunity' ? 'Value' : 'Price',
      `${meta.currency || 'KES'} ${meta.price.toLocaleString()}`
    );
  }

  push('operatingHours', object.type === 'experience' ? 'When' : 'Hours', meta.operatingHours);
  push('deadline', 'Deadline', meta.deadline);

  if (!meta.deadline) {
    push(
      'statusBadge',
      object.type === 'product' ? 'Availability' : 'Status',
      meta.statusBadge
    );
  }

  if (meta.rating !== undefined) {
    push('rating', 'Rating', `${meta.rating} / 5`);
  }
  if (meta.reviewsCount !== undefined) {
    push('reviewsCount', 'Reviews', `${meta.reviewsCount.toLocaleString()}`);
  }
  if (meta.capacity !== undefined) {
    push('capacity', 'Capacity', meta.capacity.toLocaleString());
  }
  if (meta.attendeesCount !== undefined) {
    push('attendeesCount', 'Attending', meta.attendeesCount.toLocaleString());
  }

  push('distanceKm', 'Distance', getDistanceLabel(object));

  return facts;
};

// Honest description of what pressing the primary button will do.
// Describes what the primary button will actually do, derived from the
// resolved action so the caption can never drift from the behaviour.
const getActionNote = (object: BriefObject): string => {
  const action = resolveAction(object);

  switch (action.kind) {
    case 'phone':
      return 'Opens your phone dialler.';
    case 'map':
      return 'Opens this location in Maps.';
    case 'external':
      return 'Opens the official page in a new tab.';
    case 'internal':
      switch (object.type) {
        case 'place':
          return 'Shows other places like this one.';
        case 'product':
          return 'No online checkout yet. Shows other items in the Market.';
        case 'service':
          return 'No online booking yet. Shows other services nearby.';
        default:
          return `Shows other ${getTypePlural(object.type)} nearby.`;
      }
    default:
      return 'Brief has no direct route for this yet. Details are below.';
  }
};

// ----------------------------------------------------------------------------
// Freshness (prompt 13). Derived ONLY from lastVerifiedAt + validityWindowDays.
// If either is missing we return null and the UI shows nothing -- an unverified
// record must never be dressed up as a fresh one.
// ----------------------------------------------------------------------------
export type FreshnessLevel = 'recent' | 'verified' | 'aging' | 'stale';

export interface Freshness {
  level: FreshnessLevel;
  label: string;
  verifiedOn: string;
  daysAgo: number;
}

const DAY_MS = 86400000;

const getFreshness = (
  object: BriefObject,
  now: Date = new Date()
): Freshness | null => {
  if (!object.lastVerifiedAt || object.validityWindowDays === undefined) {
    return null;
  }

  const verified = new Date(object.lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return null;

  const daysAgo = Math.max(0, Math.floor((now.getTime() - verified.getTime()) / DAY_MS));
  const windowDays = object.validityWindowDays;
  const ratio = windowDays > 0 ? daysAgo / windowDays : 1;

  // "stale" is only ever claimed when the supplied dates actually prove it.
  const level: FreshnessLevel =
    ratio > 1 ? 'stale' : ratio > 0.66 ? 'aging' : daysAgo <= 7 ? 'recent' : 'verified';

  const label =
    level === 'stale'
      ? 'Verification expired'
      : level === 'aging'
      ? 'Verification aging'
      : level === 'recent'
      ? 'Recently verified'
      : 'Verified';

  const verifiedOn = verified.toISOString().slice(0, 10);

  return { level, label, verifiedOn, daysAgo };
};

// ----------------------------------------------------------------------------
// Change detection (prompt 23). Pure: compares two versions of the same object
// and reports meaningful differences. Timestamps and unrelated metadata are
// deliberately ignored. This is what Watch will eventually consume.
// ----------------------------------------------------------------------------
export interface ObjectChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

const CHANGE_FIELDS: { key: string; label: string; fromMeta?: boolean }[] = [
  { key: 'title', label: 'Title' },
  { key: 'summary', label: 'Summary' },
  { key: 'locationName', label: 'Location' },
  { key: 'price', label: 'Price', fromMeta: true },
  { key: 'statusBadge', label: 'Status', fromMeta: true },
  { key: 'deadline', label: 'Deadline', fromMeta: true },
  { key: 'operatingHours', label: 'Hours', fromMeta: true },
  { key: 'capacity', label: 'Capacity', fromMeta: true },
  { key: 'contactPhone', label: 'Contact', fromMeta: true }
];

const readField = (object: BriefObject, key: string, fromMeta?: boolean): string | null => {
  const raw = fromMeta
    ? object.metadata?.[key]
    : (object as unknown as Record<string, unknown>)[key];
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
};

const diffObjects = (before: BriefObject, after: BriefObject): ObjectChange[] => {
  const changes: ObjectChange[] = [];
  for (const field of CHANGE_FIELDS) {
    const from = readField(before, field.key, field.fromMeta);
    const to = readField(after, field.key, field.fromMeta);
    if (from !== to) {
      changes.push({ field: field.key, label: field.label, from, to });
    }
  }
  return changes;
};

// ----------------------------------------------------------------------------
// Duplicate detection (prompt 15). Returns candidates only -- never deletes,
// never merges. Pure string work, no dependencies.
// ----------------------------------------------------------------------------
export interface DuplicateCandidate {
  item: BriefObject;
  similarity: number;
}

const normaliseTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Dice coefficient over character bigrams: cheap, dependency-free, and much
// steadier on short business names than raw edit distance.
const titleSimilarity = (a: string, b: string): number => {
  const x = normaliseTitle(a);
  const y = normaliseTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (v: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < v.length - 1; i++) {
      const g = v.slice(i, i + 2);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };

  const ax = bigrams(x);
  const by = bigrams(y);
  let shared = 0;
  ax.forEach((count, g) => {
    const other = by.get(g);
    if (other) shared += Math.min(count, other);
  });

  const total = x.length - 1 + (y.length - 1);
  return total > 0 ? (2 * shared) / total : 0;
};

const findPotentialDuplicates = (
  object: BriefObject,
  pool: BriefObject[],
  threshold = 0.82
): DuplicateCandidate[] =>
  pool
    .filter((item) => item.id !== object.id && item.type === object.type)
    .map((item) => {
      let similarity = titleSimilarity(object.title, item.title);
      // Same stated location corroborates; it cannot manufacture a match.
      if (
        similarity > 0.5 &&
        object.locationName &&
        item.locationName &&
        normaliseTitle(object.locationName) === normaliseTitle(item.locationName)
      ) {
        similarity = Math.min(1, similarity + 0.08);
      }
      return { item, similarity };
    })
    .filter(({ similarity }) => similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

// ----------------------------------------------------------------------------
// Contextual actions (prompt 8). Every suggestion is derived from data the
// object actually carries and routed through resolveAction where it maps to a
// real destination. Nothing here invents a URL or a number.
// ----------------------------------------------------------------------------
export interface SuggestedAction {
  key: string;
  label: string;
  kind: 'primary' | 'link' | 'internal';
  href?: string;
}

const getSuggestedActions = (object: BriefObject): SuggestedAction[] => {
  const out: SuggestedAction[] = [];
  const primary = resolveAction(object);
  const phone = object.metadata?.contactPhone;

  if (primary.kind !== 'none') {
    out.push({
      key: 'primary',
      label: primary.label,
      kind: 'primary',
      href: 'href' in primary ? primary.href : undefined
    });
  }

  // Directions: only when this object has a real place to point at, and only
  // when it is not already the primary action.
  if (object.locationName && primary.kind !== 'map') {
    out.push({
      key: 'directions',
      label: 'Get directions',
      kind: 'link',
      href: buildMapsHref(object.locationName)
    });
  }

  if (phone && primary.kind !== 'phone') {
    const label = object.type === 'product' ? 'Contact seller' : 'Call';
    out.push({ key: 'call', label, kind: 'link', href: buildTelHref(phone) });
  }

  if (object.sourceUrl) {
    out.push({ key: 'source', label: 'View source', kind: 'link', href: object.sourceUrl });
  }

  return out;
};

// ----------------------------------------------------------------------------
// The Brief graph (prompt 24). Pure functions over the objects and
// relationships that already exist -- no graph database, no new state, no UI.
// Every question the product asks about an object is answered in one place, so
// the components stay dumb and the rules stay testable.
// ----------------------------------------------------------------------------
export interface BriefGraph {
  get: (id: string) => BriefObject | undefined;
  providerOf: (object: BriefObject) => BriefObject | undefined;
  locationOf: (object: BriefObject) => BriefObject | undefined;
  offeringsBy: (provider: BriefObject) => BriefObject[];
  eventsAt: (place: BriefObject) => BriefObject[];
  nearby: (object: BriefObject, limit?: number) => BriefObject[];
  saved: () => BriefObject[];
  watching: () => BriefObject[];
  savedLabel: (id: string) => SaveLabel | undefined;
  activity: (limit?: number) => { object: BriefObject; verb: string; updatedAt: string }[];
  duplicatesOf: (object: BriefObject) => DuplicateCandidate[];
  changes: (before: BriefObject, after: BriefObject) => ObjectChange[];
}

// Verbs that represent a deliberate user commitment, in the order we would
// narrate them. 'discovered' is passive noise and stays out of Activity.
const ACTIVITY_VERBS: Record<string, string> = {
  saved: 'Saved',
  watched: 'Watching',
  engaged_with: 'Opened',
  interacted_with: 'Opened',
  contacted: 'Contacted',
  booked: 'Booked',
  bought: 'Bought',
  shared: 'Shared'
};

const createBriefGraph = (
  objects: BriefObject[],
  relationships: ObjectRelationship[]
): BriefGraph => {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const get = (id: string) => byId.get(id);

  const edgesWith = (verb: string) =>
    relationships.filter((r) => r.verb === verb);

  const targetsOf = (verb: string): BriefObject[] =>
    edgesWith(verb)
      .map((r) => byId.get(r.targetId))
      .filter((o): o is BriefObject => Boolean(o));

  return {
    get,

    providerOf: (object) =>
      object.providerObjectId ? byId.get(object.providerObjectId) : undefined,

    locationOf: (object) =>
      object.locationObjectId ? byId.get(object.locationObjectId) : undefined,

    // Everything this identity is recorded as providing, either by explicit
    // link or by carrying its name. No inference beyond an exact name match.
    offeringsBy: (provider) =>
      objects.filter(
        (o) =>
          o.id !== provider.id &&
          (o.providerObjectId === provider.id ||
            (Boolean(o.creatorName) && o.creatorName === provider.creatorName))
      ),

    eventsAt: (place) =>
      objects.filter(
        (o) =>
          o.type === 'experience' &&
          (o.locationObjectId === place.id || o.parentObjectId === place.id)
      ),

    // Same stated location first, then genuine distance. Objects with no
    // distance data are simply absent -- never sorted as if they were at 0 km.
    nearby: (object, limit = 4) => {
      const here = object.locationName?.toLowerCase() ?? null;
      return objects
        .filter((o) => o.id !== object.id)
        .map((o) => {
          const sameLocation =
            here && o.locationName && o.locationName.toLowerCase() === here ? 1 : 0;
          const distance = o.metadata?.distanceKm;
          return { o, sameLocation, distance };
        })
        .filter(({ sameLocation, distance }) => sameLocation === 1 || distance !== undefined)
        .sort((a, b) => {
          if (a.sameLocation !== b.sameLocation) return b.sameLocation - a.sameLocation;
          const da = a.distance ?? Number.MAX_SAFE_INTEGER;
          const db = b.distance ?? Number.MAX_SAFE_INTEGER;
          return da - db;
        })
        .slice(0, limit)
        .map(({ o }) => o);
    },

    saved: () => targetsOf('saved'),
    watching: () => targetsOf('watched'),

    savedLabel: (id) =>
      relationships.find((r) => r.targetId === id && r.verb === 'saved')?.label,

    activity: (limit = 6) =>
      relationships
        .filter((r) => ACTIVITY_VERBS[r.verb] && byId.has(r.targetId))
        .slice()
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, limit)
        .map((r) => ({
          object: byId.get(r.targetId) as BriefObject,
          verb: ACTIVITY_VERBS[r.verb],
          updatedAt: r.updatedAt
        })),

    duplicatesOf: (object) => findPotentialDuplicates(object, objects),

    changes: (before, after) => diffObjects(before, after)
  };
};

// ============================================================================
// PURSUITS
// ----------------------------------------------------------------------------
// A Pursuit is something the user has asked Brief to find, monitor or keep
// organising -- "a good plumber near me", "cattle auctions this week", "watch
// the green grant". It is the standing intent; objects are what satisfy it.
//
// Brief only ever matches a Pursuit against information it actually holds. It
// does not search the internet, does not invent results, and an empty Pursuit
// is reported as empty rather than padded with weak guesses.
// ============================================================================

export type PursuitStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Pursuit {
  id: string;
  query: string;
  status: PursuitStatus;
  createdAt: string;
  lastUpdatedAt: string;
  // Which channels this pursuit is allowed to draw on. Present so an ingestion
  // pipeline can scope a pursuit to, say, one Telegram group later.
  sourceTypes: NonNullable<BriefObject['sourceType']>[];
  matchedObjectIds: string[];
  // When true, the pursuit should re-check as new information arrives. The
  // monitoring loop is not built yet; this records the intent.
  watchChanges: boolean;
  // Which changes matter. Optional so every pursuit created before this
  // existed keeps working; absent means "any new match".
  watchConditions?: WatchCondition[];
}

// ----------------------------------------------------------------------------
// One scoring brain, shared by the search box and by pursuit matching, so a
// phrase means the same thing in both places.
// ----------------------------------------------------------------------------
export const scoreObjectForPhrase = (object: BriefObject, phrase: string): number => {
  const query = phrase.trim().toLowerCase();
  if (query === '') return 0;

  const title = object.title.toLowerCase();
  const category = object.category.toLowerCase();
  const summary = object.summary.toLowerCase();
  const location = (object.locationName ?? '').toLowerCase();
  const creator = (object.creatorName ?? '').toLowerCase();
  const status = (object.metadata?.statusBadge ?? '').toLowerCase();

  let score = 0;
  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 60;
  else if (title.includes(query)) score += 40;

  if (category === query) score += 30;
  else if (category.includes(query)) score += 18;

  if (object.type.includes(query)) score += 16;
  if (creator.includes(query)) score += 12;
  if (location.includes(query)) score += 10;
  if (status.includes(query)) score += 6;
  if (summary.includes(query)) score += 4;

  return score;
};

// Words that carry intent rather than subject matter. They tell us HOW to
// pursue, so they must not also be matched as if they were search terms --
// otherwise "find a plumber" scores every object containing "find".
const PURSUIT_INTENT_WORDS = new Set([
  'find',
  'show',
  'get',
  'look',
  'looking',
  'search',
  'watch',
  'monitor',
  'track',
  'want',
  'need',
  'me',
  'my',
  'a',
  'an',
  'the',
  'for',
  'near',
  'nearby',
  'around',
  'this',
  'that',
  'week',
  'today',
  'tomorrow',
  'good',
  'best',
  'cheapest',
  'cheap',
  'any',
  'some',
  'one',
  'ones',
  'thing',
  'things',
  'please',
  'where',
  'what',
  'is',
  'are',
  'in',
  'on',
  'at',
  'to',
  'of',
  'and'
]);

export const getPursuitTerms = (query: string): string[] =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !PURSUIT_INTENT_WORDS.has(w))
    )
  );

// A pursuit query is natural language, so we score the whole phrase AND its
// meaningful terms. Requiring a real term hit is what stops "find me anything"
// from matching the entire graph.
// Deliberately minimal stemming -- enough that "lights" finds "Lighting" and
// "auctions" finds "Auction", without pulling in a linguistics library that
// would start making decisions nobody can audit.
export const singularise = (word: string): string => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
};

// A stem hit is real but weaker than the word the user actually typed.
const scoreTerm = (object: BriefObject, term: string): number => {
  const direct = scoreObjectForPhrase(object, term);
  if (direct > 0) return direct;

  const stem = singularise(term);
  if (stem !== term && stem.length > 2) {
    return scoreObjectForPhrase(object, stem) * 0.9;
  }
  return 0;
};

export interface PursuitMatch {
  item: BriefObject;
  score: number;
  matchedTerms: string[];
}

export const matchPursuit = (
  pursuit: Pursuit,
  pool: BriefObject[],
  limit = 8
): PursuitMatch[] => {
  const terms = getPursuitTerms(pursuit.query);
  if (terms.length === 0) return [];

  const allowed =
    pursuit.sourceTypes.length > 0
      ? pool.filter(
          (o) =>
            o.sourceType === undefined ||
            pursuit.sourceTypes.includes(o.sourceType)
        )
      : pool;

  return allowed
    .map((item) => {
      const matchedTerms = terms.filter((term) => scoreTerm(item, term) > 0);

      // Every term must contribute; a single incidental word is not a match.
      if (matchedTerms.length === 0) return { item, score: 0, matchedTerms };

      let score = matchedTerms.reduce(
        (sum, term) => sum + scoreTerm(item, term),
        0
      );

      // Reward breadth: an object hitting more of the query is a better answer
      // than one hitting a single term very strongly.
      score *= matchedTerms.length / terms.length;

      // Exact phrase presence is the strongest possible signal.
      score += scoreObjectForPhrase(item, pursuit.query.trim());

      const distance = item.metadata?.distanceKm;
      if (distance !== undefined) score += Math.max(0, 2 - distance / 2);

      return { item, score, matchedTerms };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

// "watch the green grant" is a standing instruction, not a one-off lookup.
const queryImpliesWatch = (query: string): boolean =>
  /\b(watch|monitor|track|keep an eye|notify|alert)\b/i.test(query);

const createPursuit = (query: string, now: string): Pursuit => ({
  id: `pur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  query: query.trim(),
  status: 'active',
  createdAt: now,
  lastUpdatedAt: now,
  sourceTypes: [],
  matchedObjectIds: [],
  watchChanges: queryImpliesWatch(query)
});

// ----------------------------------------------------------------------------
// Capture: the same parser, pointed at something the user pasted in. Forwarding
// is the easiest way into Brief, so it must go through exactly the same rules
// as an ingested message -- no privileged path, no extra trust.
// ----------------------------------------------------------------------------
const URL_RE = /https?:\/\/[^\s<>"]+/i;

const buildCaptureMessage = (raw: string, now: string): InboundMessage => {
  const text = raw.trim();
  const url = text.match(URL_RE);

  return {
    id: `cap_${Date.now()}`,
    channel: 'manual',
    sourceId: 'src_manual_capture',
    sourceLabel: 'Captured by you',
    // A bare URL has no text to parse. We keep it verbatim rather than
    // inventing a description of a page Brief has never fetched.
    text,
    receivedAt: now,
    sourceUrl: url ? url[0] : undefined
  };
};

// ----------------------------------------------------------------------------
// Watch conditions: which changes actually matter to this user, for this thing.
// The matching logic is real; the background loop that would call it is not
// built, so nothing here claims to be monitoring anything.
// ----------------------------------------------------------------------------
export type WatchCondition =
  | 'new_match'
  | 'price'
  | 'deadline'
  | 'location'
  | 'availability'
  | 'time';

export const WATCH_CONDITION_LABELS: Record<WatchCondition, string> = {
  new_match: 'New matching information',
  price: 'Price changes',
  deadline: 'Deadline changes',
  location: 'Location changes',
  availability: 'Availability changes',
  time: 'Event time changes'
};

// Maps a detected field change onto the condition a user would have asked for.
const CHANGE_FIELD_TO_CONDITION: Record<string, WatchCondition> = {
  price: 'price',
  deadline: 'deadline',
  locationName: 'location',
  statusBadge: 'availability',
  operatingHours: 'time',
  capacity: 'availability',
  contactPhone: 'availability',
  title: 'new_match',
  summary: 'new_match'
};

// Given two versions of an object and the conditions a user cares about,
// return only the changes they asked to hear about.
const filterChangesByConditions = (
  changes: ObjectChange[],
  conditions: WatchCondition[]
): ObjectChange[] => {
  if (conditions.length === 0) return [];
  return changes.filter((change) => {
    const mapped = CHANGE_FIELD_TO_CONDITION[change.field];
    return mapped !== undefined && conditions.includes(mapped);
  });
};

// ----------------------------------------------------------------------------
// Why this appeared (prompt 7). Reasons are computed from actual state, so a
// reason can never be shown unless it is literally true.
// ----------------------------------------------------------------------------
export interface AppearanceReason {
  key: string;
  label: string;
}

const getAppearanceReasons = (
  object: BriefObject,
  context: {
    pursuits: Pursuit[];
    pursuitResults: Record<string, PursuitMatch[]>;
    savedIds: Set<string>;
    watchedIds: Set<string>;
    relatedToSavedIds: Set<string>;
  }
): AppearanceReason[] => {
  const reasons: AppearanceReason[] = [];

  for (const pursuit of context.pursuits) {
    const hit = (context.pursuitResults[pursuit.id] ?? []).some(
      (m) => m.item.id === object.id
    );
    if (hit) {
      reasons.push({
        key: `pursuit_${pursuit.id}`,
        label: `Matches your pursuit: ${pursuit.query}`
      });
    }
  }

  if (context.savedIds.has(object.id)) {
    reasons.push({ key: 'saved', label: 'You saved this' });
  }

  if (context.watchedIds.has(object.id)) {
    reasons.push({ key: 'watched', label: 'You are watching this' });
  }

  if (context.relatedToSavedIds.has(object.id)) {
    reasons.push({ key: 'related', label: 'Related to something you saved' });
  }

  if (object.sourceType === 'manual') {
    reasons.push({ key: 'captured', label: 'You captured this yourself' });
  } else if (object.sourceType) {
    reasons.push({ key: 'source', label: 'Arrived from a connected source' });
  }

  if (object.metadata?.distanceKm !== undefined) {
    reasons.push({
      key: 'nearby',
      label: `Near you (${getDistanceLabel(object)})`
    });
  }

  return reasons;
};

// ----------------------------------------------------------------------------
// Daily Brief (prompt 6). Strictly derived from what the user already cares
// about. No generic news, no filler, no commentary. Empty sections are dropped
// entirely rather than padded.
// ----------------------------------------------------------------------------
export interface DailyBriefSection {
  key: 'new' | 'changed' | 'today' | 'open';
  title: string;
  objects: BriefObject[];
  pursuits: Pursuit[];
  note?: string;
}

// "Today" means the object itself says it is time-sensitive, using words the
// data actually contains. Nothing is inferred from the clock.
const TIME_SENSITIVE_RE = /\b(today|tonight|now|closing|last day|upcoming|deadline)\b/i;

const isTimeSensitive = (object: BriefObject): boolean => {
  const status = object.metadata?.statusBadge ?? '';
  const deadline = object.metadata?.deadline ?? '';
  return (
    TIME_SENSITIVE_RE.test(status) ||
    deadline !== '' ||
    TIME_SENSITIVE_RE.test(object.metadata?.operatingHours ?? '')
  );
};

const buildDailyBrief = (input: {
  objects: BriefObject[];
  pursuits: Pursuit[];
  pursuitResults: Record<string, PursuitMatch[]>;
  savedIds: Set<string>;
  watchedIds: Set<string>;
  seenIds: Set<string>;
}): DailyBriefSection[] => {
  const activePursuits = input.pursuits.filter((p) => p.status === 'active');

  // NEW: pursuit matches the user has not opened yet.
  const newMatches: BriefObject[] = [];
  const newIds = new Set<string>();
  for (const pursuit of activePursuits) {
    for (const match of input.pursuitResults[pursuit.id] ?? []) {
      if (!input.seenIds.has(match.item.id) && !newIds.has(match.item.id)) {
        newIds.add(match.item.id);
        newMatches.push(match.item);
      }
    }
  }

  // CHANGED: watched or saved objects that have been re-ingested since the
  // user last looked. Requires a genuine ingestedAt stamp -- no guessing.
  const changed = input.objects.filter(
    (o) =>
      (input.watchedIds.has(o.id) || input.savedIds.has(o.id)) &&
      o.ingestedAt !== undefined
  );

  // TODAY: things the user cares about that say they are time-sensitive.
  const today = input.objects.filter(
    (o) =>
      (input.savedIds.has(o.id) || input.watchedIds.has(o.id) || newIds.has(o.id)) &&
      isTimeSensitive(o)
  );

  const stillOpen = activePursuits.filter(
    (p) => (input.pursuitResults[p.id] ?? []).length === 0
  );

  const sections: DailyBriefSection[] = [
    { key: 'new', title: 'New', objects: newMatches, pursuits: [] },
    { key: 'changed', title: 'Changed', objects: changed, pursuits: [] },
    { key: 'today', title: 'Today', objects: today, pursuits: [] },
    { key: 'open', title: 'Still open', objects: [], pursuits: stillOpen }
  ];

  return sections.filter(
    (section) => section.objects.length > 0 || section.pursuits.length > 0
  );
};

// ============================================================================
// DISCOVERY DAILY BRIEF — TODAY / NEAR YOU / NOW / COMING UP
// ----------------------------------------------------------------------------
// The compact "Today's Brief" layer of the discovery experience. Every row
// comes from a REAL persisted object's temporal projection (the server's
// lifecycle fields, never the wall clock guessing). Sections appear only when
// they have data — no hardcoded samples, no padding.
// ============================================================================

export interface DiscoveryBriefSection {
  key: 'today' | 'near' | 'now' | 'coming';
  title: string;
  objects: BriefObject[];
}

const startOfLocalDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isEventType = (o: BriefObject) => o.type === 'experience' || String(o.type) === 'event';

export const buildDiscoveryBrief = (input: {
  objects: BriefObject[];
  area?: string | null;
  geo?: { lat: number; lng: number } | null;
}): DiscoveryBriefSection[] => {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const parsed = (v: unknown): Date | null => {
    if (typeof v !== 'string') return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const today: BriefObject[] = [];
  const near: BriefObject[] = [];
  const nowSection: BriefObject[] = [];
  const coming: BriefObject[] = [];
  const placed = new Set<string>();

  for (const o of input.objects) {
    const t = o.temporal;
    const status = t?.status ?? '';
    const startsAt = parsed(t?.startsAt ?? o.metadata?.eventStart ?? o.metadata?.dateCanonical);
    const deadlineAt = parsed(t?.deadlineAt ?? o.metadata?.deadlineCanonical);

    // TODAY — events actually happening today, and things expiring today.
    if (isEventType(o) && startsAt && startsAt >= yesterdayStart && startsAt < tomorrowStart) {
      if (!placed.has(o.id)) { placed.add(o.id); today.push(o); }
      continue;
    }
    if ((o.type === 'offer' || o.type === 'opportunity') && deadlineAt && deadlineAt >= todayStart && deadlineAt < tomorrowStart) {
      if (!placed.has(o.id)) { placed.add(o.id); today.push(o); }
      continue;
    }
    if (status === 'happening') {
      if (!placed.has(o.id)) { placed.add(o.id); today.push(o); }
      continue;
    }

    // NOW — current alerts, fresh news, active offers. Places and businesses
    // are "current" too, but they are not breaking activity: they belong in
    // NEAR YOU, not NOW.
    const isNowType = o.type === 'alert' || o.type === 'news' || o.type === 'offer'
      || o.type === 'opportunity' || o.type === 'announcement';
    if (isNowType && (status === 'current' || status === 'active' || status === 'no_deadline')) {
      if (!placed.has(o.id)) { placed.add(o.id); nowSection.push(o); }
      continue;
    }

    // COMING UP — important upcoming events (ranked, so the most relevant
    // ones surface here).
    if (isEventType(o) && status === 'upcoming') {
      if (!placed.has(o.id)) { placed.add(o.id); coming.push(o); }
      continue;
    }

    // NEAR YOU — everything else with a real locality signal.
    const dist = o.metadata?.distanceKm;
    const area = String(o.metadata?.area ?? o.metadata?.county ?? '').trim();
    if (typeof dist === 'number' || area || o.locationName) {
      if (!placed.has(o.id)) { placed.add(o.id); near.push(o); }
    }
  }

  const sections: DiscoveryBriefSection[] = [];
  if (today.length > 0) sections.push({ key: 'today', title: 'TODAY', objects: today });
  if (near.length > 0) sections.push({ key: 'near', title: 'NEAR YOU', objects: near });
  if (nowSection.length > 0) sections.push({ key: 'now', title: 'NOW', objects: nowSection });
  if (coming.length > 0) sections.push({ key: 'coming', title: 'COMING UP', objects: coming });
  return sections;
};

/** A compact WHEN line for Today's Brief rows, from real temporal data. */
const briefWhenLabel = (o: BriefObject): string | null => {
  const t = o.temporal;
  const fmt = (v: unknown) => {
    if (typeof v !== 'string') return null;
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    const now = new Date();
    if (isSameLocalDay(d, now)) {
      return `Today ${d.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  if (t?.status === 'happening') return 'Happening now';
  if (t?.status === 'upcoming') return fmt(t.startsAt) ?? 'Upcoming';
  if (t?.status === 'active') {
    const dl = fmt(t.deadlineAt);
    return dl ? `Ends ${dl.replace('Today ', 'today ')}` : 'Ongoing';
  }
  if (t?.status === 'current' || t?.status === 'no_deadline') return 'Now';
  if (t?.status === 'past' && t.startsAt) return `Ended ${fmt(t.startsAt)}`;
  if (o.metadata?.eventStart) return fmt(o.metadata.eventStart);
  if (o.metadata?.deadlineCanonical) return `Ends ${fmt(o.metadata.deadlineCanonical)}`;
  return null;
};

// ============================================================================
// GROUP UTILITY LAYER
// ----------------------------------------------------------------------------
// Brief does not arrive in a group asking for its customers. It arrives making
// the group's own conversation more useful: findable, remembered, and honest
// about where every fact came from.
//
// A critical distinction from the ingestion boundary: parseInboundMessage asks
// "should this become an object?" and deliberately rejects questions as
// conversation. That is right for the object graph and WRONG here. In a group,
// an unanswered question is the single most valuable thing on the wall --
// groups are terrible at preserving them. So classification is a separate job
// with its own rules, and it keeps things the object parser throws away.
// ============================================================================

export type MessageClass =
  | 'job'
  | 'event'
  | 'business'
  | 'product'
  | 'service'
  | 'place'
  | 'opportunity'
  | 'question'
  | 'resource'
  | 'chatter';

export const MESSAGE_CLASS_LABELS: Record<MessageClass, string> = {
  job: 'Jobs',
  event: 'Events',
  business: 'Businesses',
  product: 'Products',
  service: 'Services',
  place: 'Places',
  opportunity: 'Opportunities',
  question: 'Questions',
  resource: 'Useful information',
  chatter: 'Conversation'
};

export interface GroupMessage {
  id: string;
  groupId: string;
  // Display name only, and only where the group permits it. Never a phone
  // number, never an internal account id.
  authorLabel?: string;
  text: string;
  sentAt: string;
  // Set when the platform tells us this is a reply. Used to decide whether a
  // question was ever answered -- inferred, never assumed.
  replyToId?: string;
  url?: string;
  // Multimodal: an image or document is just another way information arrived.
  // It produces the same entry shape as text.
  mediaKind?: 'message' | 'image' | 'document' | 'link';
  mediaReference?: string;
  // Text Brief can legitimately read: a caption, a filename, or text a
  // processor has already extracted. Brief performs NO image recognition, so
  // nothing is ever read out of pixels.
  mediaExtractedText?: string;
  mediaAnalysisStatus?: ImageAnalysisStatus;
}

// Access is the spine of this layer. A group EXISTING in Brief's data and a
// group being VISIBLE to this user are different facts, and conflating them is
// the one failure mode that would make Brief feel like surveillance.
//
//   member     -- the user is in this group
//   authorised -- not a member, but explicitly granted Brief access
//   pending    -- requested, not yet granted. Not readable.
//   revoked    -- access withdrawn. Not readable, and nothing new is taken.
export type GroupAccess = 'member' | 'authorised' | 'pending' | 'revoked';

// The ONLY states that may reach a user's Groups layer.
const READABLE_ACCESS: GroupAccess[] = ['member', 'authorised'];

export const canUserAccessGroup = (group: ConnectedSource): boolean =>
  READABLE_ACCESS.includes(group.access);

// Four separate permissions, because "Brief can see it" must never silently
// imply "Brief may keep it" or "Brief may show it elsewhere".
export interface GroupPermissions {
  canRead: boolean;
  canProcess: boolean;
  canRetain: boolean;
  canShareBeyondGroup: boolean;
  canReply: boolean;
  canPostDigest: boolean;
}

const DEFAULT_PERMISSIONS: GroupPermissions = {
  canRead: true,
  canProcess: true,
  canRetain: true,
  // Off by default: information from a private group stays in that group
  // unless someone deliberately opts in.
  canShareBeyondGroup: false,
  canReply: false,
  canPostDigest: false
};

/**
 * A messaging group Brief has been given access to read.
 *
 * This replaces the retired `BriefGroup`. The rename is the point: Brief used
 * to carry TWO community primitives -- client-only `BriefGroup` and the real,
 * server-backed `Circle` -- which is the duplicate the coverage map flagged.
 *
 * They are not the same thing and this one is not a community:
 *
 *   Circle          a community. People, purpose, place, blocks, signals,
 *                   targets, economic activity. Lives on the server.
 *   ConnectedSource a pipe Brief reads. A WhatsApp or Telegram group whose
 *                   messages are classified into knowledge entries.
 *
 * Collapsing this into Circle would have made Circle "Groups 2.0". Instead it
 * maps onto the primitive the server already has for exactly this: a Source.
 * `id` here IS a server source id.
 *
 * The invented fields are gone: memberCount/memberCountLabel/lastIndexedAt
 * were hardcoded ("312 members") and measured nothing.
 */
export interface ConnectedSource {
  id: string;
  name: string;
  platform: 'telegram' | 'whatsapp' | 'other';
  description?: string;
  access: GroupAccess;
  /** Whether the group has allowed author names to be retained. */
  retainAuthors: boolean;
  lastActivityAt?: string;
  permissions?: GroupPermissions;
}

// Where a single piece of information came from. Attached to every extracted
// record so nothing Brief shows is ever unattributable.
export interface SourceReference {
  groupId: string;
  platform: string;
  messageId?: string;
  authorLabel?: string;
  timestamp: string;
  sourceType: 'message' | 'image' | 'document' | 'link';
}

// An entry in the group's knowledge index. It is a POINTER to a message, not a
// replacement for it: the original text is always carried alongside Brief's
// interpretation so a member can check the machine's work.
export interface GroupKnowledgeEntry {
  id: string;
  groupId: string;
  messageId: string;
  // The literal message, shown verbatim so Brief's reading never stands in
  // for what was actually said.
  originalText: string;
  // Everything Brief may legitimately read, including a caption or text a
  // document processor already extracted. Used for search only.
  searchableText: string;
  mediaKind?: 'message' | 'image' | 'document' | 'link';
  mediaReference?: string;
  mediaAnalysisStatus?: ImageAnalysisStatus;
  // Text a processor genuinely extracted. Never read from pixels by Brief.
  mediaExtractedText?: string;
  authorLabel?: string;
  sentAt: string;
  url?: string;
  messageClass: MessageClass;
  // Why the classifier chose this class -- the literal words it matched.
  evidence: string;
  confidence: number;
  entities: ExtractedField[];
  // Full provenance. Brief must always be able to say where this came from.
  source: SourceReference;
  // Populated only when a member publishes the entry into the object graph.
  linkedObjectId?: string;
  // Questions only. The ids AND the resolved replies -- a question without its
  // answer is exactly the archaeology Brief exists to prevent.
  answeredByMessageIds: string[];
  answers: { messageId: string; text: string; authorLabel?: string }[];
}

// --- Classification ---------------------------------------------------------
// Question detection runs FIRST and wins. A message asking for something is a
// question even when it also mentions a product, because the useful record is
// "someone needs this", not "someone is selling this".
const QUESTION_RE =
  /\?\s*$|\?\s|^\s*(?:anyone|does anyone|any one|who|where|how|what|when|which|is there|are there|can (?:i|anyone|someone)|looking for|need|nataka|naomba|kuna)\b/i;

// Asking for a recommendation is still a question even without a question mark.
const REQUEST_RE =
  /\b(?:anyone (?:know|selling|got|have)|looking for|in need of|recommend|suggestions?|help me find|where can i)\b/i;

const CLASS_SIGNALS: { cls: MessageClass; words: RegExp }[] = [
  { cls: 'job', words: /\b(vacancy|vacancies|hiring|job|position|recruit|cv|applicants?|apply now|internship)\b/i },
  { cls: 'opportunity', words: /\b(grant|scholarship|funding|tender|bursary|call for|application(?:s)? open|deadline)\b/i },
  { cls: 'event', words: /\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar|kesho|this saturday|this sunday)\b/i },
  { cls: 'service', words: /\b(service|repair|installation|fundi|plumber|electrician|mechanic|cleaning|delivery|booking)\b/i },
  { cls: 'product', words: /\b(for sale|selling|on sale|in stock|brand new|second hand|pieces|units|kilo|bei)\b/i },
  { cls: 'place', words: /\b(shop|stall|market|centre|center|hub|premises|branch|located at|opposite)\b/i },
  { cls: 'business', words: /\b(supplier|vendor|company|enterprise|ltd|limited|dealer|distributor|wholesaler)\b/i },
  { cls: 'resource', words: /\b(guide|how to|steps|requirements|link|website|document|form|notice|announcement|price list|menu|catalogue|catalog|rate card)\b/i }
];

export interface Classification {
  messageClass: MessageClass;
  evidence: string;
  confidence: number;
}

const classifyGroupMessage = (
  text: string,
  media?: { kind?: GroupMessage['mediaKind']; status?: ImageAnalysisStatus }
): Classification => {
  const trimmed = text.trim();

  // Questions win. In a group this is the record worth keeping.
  const questionHit = trimmed.match(QUESTION_RE) ?? trimmed.match(REQUEST_RE);
  if (questionHit) {
    return {
      messageClass: 'question',
      evidence: questionHit[0].trim().slice(0, 40),
      // A question mark is unambiguous; a phrasing match is weaker.
      confidence: trimmed.endsWith('?') ? 0.9 : 0.7
    };
  }

  for (const signal of CLASS_SIGNALS) {
    const hit = trimmed.match(signal.words);
    if (hit) {
      return {
        messageClass: signal.cls,
        evidence: hit[0].trim(),
        confidence: 0.75
      };
    }
  }

  // Someone deliberately attaching a document or poster is not chatter, even
  // when the caption is only "Flyer". The attachment itself is the signal.
  // Confidence stays modest because the wording gave Brief nothing to go on.
  if (
    (media?.kind === 'document' || media?.kind === 'image') &&
    media.status === 'processed'
  ) {
    return {
      messageClass: 'resource',
      evidence: `shared ${media.kind}`,
      confidence: 0.5
    };
  }

  return { messageClass: 'chatter', evidence: '', confidence: 0.2 };
};

// --- Building the index ------------------------------------------------------
// Entity extraction reuses the ingestion parser's field extractors so a price
// means the same thing here as it does there. Chatter is classified but never
// indexed: Brief should not turn every message into a database record.
const extractEntities = (text: string): ExtractedField[] => {
  const out: ExtractedField[] = [];

  const money = text.match(MONEY_RE);
  if (money) {
    const value = cleanMoney(money[1] ?? money[2] ?? '');
    if (value !== null) {
      out.push({ field: 'price', value: String(value), evidence: money[0].trim() });
    }
  }

  const phone = text.match(PHONE_RE);
  if (phone) {
    out.push({ field: 'contact', value: phone[0].trim(), evidence: phone[0].trim() });
  }

  const hours = text.match(HOURS_RE);
  if (hours) {
    out.push({
      field: 'hours',
      value: `${hours[1]}:${hours[2]}-${hours[3]}:${hours[4]}`,
      evidence: hours[0].trim()
    });
  }

  const deadline = text.match(DEADLINE_RE);
  if (deadline) {
    out.push({
      field: 'deadline',
      value: deadline[1].trim().replace(/[,.]$/, ''),
      evidence: deadline[0].trim()
    });
  }

  const location = text.match(LOCATION_RE);
  if (location) {
    out.push({ field: 'location', value: location[1].trim(), evidence: location[0].trim() });
  }

  return out;
};

export const buildGroupIndex = (
  messages: GroupMessage[],
  group: ConnectedSource
): GroupKnowledgeEntry[] => {
  const entries: GroupKnowledgeEntry[] = [];

  // Access and permission are enforced HERE, at the point information is
  // created -- not later in the UI. A component cannot forget to filter
  // something that was never built. Revoked or pending access yields an empty
  // index, so nothing lingers from a group the user can no longer reach.
  if (!canUserAccessGroup(group)) return entries;
  if (group.permissions && (!group.permissions.canRead || !group.permissions.canProcess)) {
    return entries;
  }

  // Belt and braces: never index a message that claims a different group.
  const own = messages.filter((m) => m.groupId === group.id);

  for (const message of own) {
    // One pipeline for every input kind. An event poster contributes whatever
    // text is genuinely available (caption, filename, or text a processor has
    // already extracted) and nothing more -- Brief does not read pixels.
    const readable = [message.text, message.mediaExtractedText]
      .filter(Boolean)
      .join(' ')
      .trim();

    const classification = classifyGroupMessage(readable, {
      kind: message.mediaKind,
      status: message.mediaAnalysisStatus
    });

    // Conversation stays conversation. Indexing it would recreate the noise
    // Brief exists to cut through.
    if (classification.messageClass === 'chatter') continue;

    entries.push({
      id: `gke_${message.id}`,
      groupId: group.id,
      messageId: message.id,
      originalText: message.text,
      searchableText: readable,
      mediaKind: message.mediaKind,
      mediaReference: message.mediaReference,
      mediaAnalysisStatus: message.mediaAnalysisStatus,
      mediaExtractedText: message.mediaExtractedText,
      // Author retention is the group's decision, not Brief's.
      authorLabel: group.retainAuthors ? message.authorLabel : undefined,
      sentAt: message.sentAt,
      url: message.url,
      messageClass: classification.messageClass,
      evidence: classification.evidence,
      confidence: classification.confidence,
      entities: extractEntities(readable),
      source: {
        groupId: group.id,
        platform: group.platform,
        messageId: message.id,
        authorLabel: group.retainAuthors ? message.authorLabel : undefined,
        timestamp: message.sentAt,
        sourceType: message.mediaKind ?? 'message'
      },
      answeredByMessageIds: [],
      answers: []
    });
  }

  // A question counts as answered when a later message replies to it. We only
  // ever infer this from an explicit replyToId -- never from timing or
  // keyword similarity, which would produce confident nonsense.
  for (const entry of entries) {
    if (entry.messageClass !== 'question') continue;
    const replies = own.filter((m) => m.replyToId === entry.messageId);
    entry.answeredByMessageIds = replies.map((m) => m.id);
    entry.answers = replies.map((m) => ({
      messageId: m.id,
      text: m.text,
      authorLabel: group.retainAuthors ? m.authorLabel : undefined
    }));
  }

  return entries;
};

export const getUnansweredQuestions = (
  entries: GroupKnowledgeEntry[]
): GroupKnowledgeEntry[] =>
  entries
    .filter(
      (e) => e.messageClass === 'question' && e.answeredByMessageIds.length === 0
    )
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));

// --- Weekly group brief ------------------------------------------------------
// Counts of useful things. Deliberately NOT engagement metrics: no message
// totals per member, no "most active" leaderboard, no streaks.
export interface GroupBriefLine {
  label: string;
  count: number;
  messageClass: MessageClass;
}

export interface WeeklyGroupBrief {
  from: string;
  to: string;
  lines: GroupBriefLine[];
  unanswered: GroupKnowledgeEntry[];
  totalIndexed: number;
}

const WEEK_MS = 7 * 86400000;

const buildWeeklyGroupBrief = (
  entries: GroupKnowledgeEntry[],
  now: Date = new Date()
): WeeklyGroupBrief => {
  const cutoff = now.getTime() - WEEK_MS;
  const recent = entries.filter((e) => new Date(e.sentAt).getTime() >= cutoff);

  const order: MessageClass[] = [
    'opportunity',
    'job',
    'event',
    'business',
    'product',
    'service',
    'place',
    'resource'
  ];

  const lines = order
    .map((cls) => ({
      label: MESSAGE_CLASS_LABELS[cls],
      count: recent.filter((e) => e.messageClass === cls).length,
      messageClass: cls
    }))
    // Empty categories are dropped rather than reported as zero.
    .filter((line) => line.count > 0);

  return {
    from: new Date(cutoff).toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    lines,
    unanswered: getUnansweredQuestions(recent),
    totalIndexed: recent.length
  };
};

// --- Group commands ----------------------------------------------------------
// Deliberately tiny. The interface is the group everyone already uses.
export type GroupCommandName = 'find' | 'jobs' | 'events' | 'brief' | 'ask' | 'saved';

export interface GroupCommandResult {
  command: GroupCommandName;
  argument: string;
  // Results found inside this group's own messages.
  fromGroup: GroupKnowledgeEntry[];
  // Results from the wider Brief knowledge layer, used ONLY when the group
  // itself could not answer. Always presented separately.
  fromElsewhere: BriefObject[];
  brief?: WeeklyGroupBrief;
  // Plain text shown when nothing was found. Brief says so rather than
  // padding the answer.
  emptyNote?: string;
}

const searchGroupEntries = (
  entries: GroupKnowledgeEntry[],
  phrase: string
): GroupKnowledgeEntry[] => {
  const terms = getPursuitTerms(phrase);
  if (terms.length === 0) return [];

  return entries
    .map((entry) => {
      // Include the answers: someone asking "a 50W solar kit?" and someone
      // replying "Kikao Hardware has 50W systems" is one useful record.
      // searchableText, not originalText: a price list's contents must be
      // findable even though the message body only said "Price List".
      const haystack = `${entry.searchableText} ${entry.answers
        .map((a) => a.text)
        .join(' ')} ${entry.entities.map((e) => e.value).join(' ')}`.toLowerCase();
      const hits = terms.filter((t) => haystack.includes(t));
      return { entry, hits: hits.length };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.entry.sentAt < b.entry.sentAt ? 1 : -1;
    })
    .map(({ entry }) => entry);
};

// "Aug 12" - light provenance, no clutter.
export const formatSourceDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

export const runGroupCommand = (
  raw: string,
  context: {
    entries: GroupKnowledgeEntry[];
    objects: BriefObject[];
    savedObjects: BriefObject[];
    now?: Date;
  }
): GroupCommandResult | null => {
  const match = raw.trim().match(/^\/(find|jobs|events|brief|ask|saved)\b\s*(.*)$/i);
  if (!match) return null;

  const command = match[1].toLowerCase() as GroupCommandName;
  const argument = match[2].trim();
  const base: GroupCommandResult = {
    command,
    argument,
    fromGroup: [],
    fromElsewhere: []
  };

  if (command === 'brief') {
    return { ...base, brief: buildWeeklyGroupBrief(context.entries, context.now) };
  }

  if (command === 'jobs' || command === 'events') {
    const cls: MessageClass = command === 'jobs' ? 'job' : 'event';
    const found = context.entries
      .filter((e) => e.messageClass === cls)
      .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    return {
      ...base,
      fromGroup: found,
      emptyNote: found.length === 0 ? `No ${cls}s posted here yet.` : undefined
    };
  }

  if (command === 'saved') {
    return {
      ...base,
      fromElsewhere: context.savedObjects,
      emptyNote:
        context.savedObjects.length === 0 ? 'You have not saved anything yet.' : undefined
    };
  }

  // /find and /ask: search THIS group first. Only if the group cannot answer
  // do we reach into the wider knowledge layer, and the two are never mixed.
  if (argument === '') {
    return { ...base, emptyNote: `Try ${'/' + command} followed by what you need.` };
  }

  const fromGroup = searchGroupEntries(context.entries, argument);
  if (fromGroup.length > 0) {
    return { ...base, fromGroup };
  }

  const fromElsewhere = matchPursuit(
    {
      id: 'tmp',
      query: argument,
      status: 'active',
      createdAt: '',
      lastUpdatedAt: '',
      sourceTypes: [],
      matchedObjectIds: [],
      watchChanges: false
    },
    context.objects,
    4
  ).map((m) => m.item);

  return {
    ...base,
    fromElsewhere,
    emptyNote:
      fromElsewhere.length === 0
        ? 'Nothing in this group, and nothing elsewhere in Brief yet.'
        : undefined
  };
};

// --- Business utility mode ---------------------------------------------------
// A business connected to Brief maintains the answers it is already typing out
// by hand twenty times a week. This is an answering aid, not an advert: there
// is no promotional copy field, and nothing here is pushed at anyone.
export interface BusinessProfile {
  id: string;
  // Ties the profile to an identity object already in the graph when one
  // exists. Absent for a business Brief only knows from a group.
  objectId?: string;
  name: string;
  hours?: string;
  location?: string;
  contact?: string;
  services: string[];
  // Question-and-answer pairs the business has confirmed. Brief answers ONLY
  // with these words -- it never composes a reply on the business's behalf.
  faqs: { question: string; answer: string }[];
  lastConfirmedAt?: string;
}

/** No seeded business profiles. */
const INITIAL_BUSINESS_PROFILES: BusinessProfile[] = [];

// Brief's full group table. Crucially this includes groups the current user
// must NEVER see -- they exist here precisely so the access filter is tested
// against real data rather than against an empty list.
/**
 * No seeded groups. Connected sources come from the server
 * (`GET /api/sources`): a group Brief is not actually connected to must never
 * appear in the list of groups Brief reads.
 *
 * The retired seed invented six groups with invented member counts. Access
 * state (member/authorised/pending/revoked) is still modelled and still
 * enforced in buildGroupIndex -- it is the data that was fake, not the rule.
 */
const ALL_GROUPS: ConnectedSource[] = [];

// A week of ordinary group traffic: useful posts, questions, and noise.
/**
 * No seeded group traffic.
 *
 * This was 171 lines of invented WhatsApp/Telegram messages -- fake vacancies,
 * fake grants, fake plumber requests -- which the group index then classified
 * and presented as real extracted local knowledge. It is the most misleading
 * kind of seed: the output looks like genuine analysis of a real community.
 *
 * Real messages arrive through the connectors as raw items. Until a source is
 * connected there is nothing to classify, and the UI says so.
 */
const GROUP_MESSAGES: GroupMessage[] = [];

// ============================================================================
// SOURCES
// ----------------------------------------------------------------------------
// A source is where information arrives from -- a Telegram group, a WhatsApp
// community, a site. It is deliberately NOT a BriefObject: the channel is the
// river, and Brief extracts the useful fish. Conflating the two would make
// "the group" a thing users discover, which it is not.
// ============================================================================

export type SourceType = 'telegram' | 'whatsapp' | 'web' | 'rss' | 'api' | 'manual';

export type SourceHealth = 'healthy' | 'quiet' | 'error' | 'inactive';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url?: string;
  description?: string;
  active: boolean;
  lastSeenAt?: string;
  lastSuccessfulIngestionAt?: string;
  ingestionCount: number;
  errorCount: number;
  // Operator-facing only. Never rendered to ordinary users.
  lastErrorDetail?: string;
}

const QUIET_AFTER_HOURS = 48;

// Health is derived, never stored, so it cannot drift out of date.
const getSourceHealth = (source: Source, now: Date = new Date()): SourceHealth => {
  if (!source.active) return 'inactive';

  // A source that has errored more recently than it has succeeded is broken,
  // regardless of how healthy its history looks.
  if (source.errorCount > 0) {
    const lastOk = source.lastSuccessfulIngestionAt
      ? new Date(source.lastSuccessfulIngestionAt).getTime()
      : 0;
    const lastSeen = source.lastSeenAt ? new Date(source.lastSeenAt).getTime() : 0;
    if (lastSeen > lastOk) return 'error';
  }

  if (!source.lastSuccessfulIngestionAt) return 'quiet';

  const hours =
    (now.getTime() - new Date(source.lastSuccessfulIngestionAt).getTime()) / 3600000;

  return hours > QUIET_AFTER_HOURS ? 'quiet' : 'healthy';
};

// Plain-language health, safe to show anyone. Technical detail stays in
// lastErrorDetail and is only surfaced in the operator view.
const getSourceHealthLabel = (health: SourceHealth): string => {
  switch (health) {
    case 'healthy':
      return 'Receiving information normally';
    case 'quiet':
      return 'No recent information';
    case 'error':
      return 'Not receiving information';
    case 'inactive':
      return 'Paused';
  }
};

/**
 * Sources come from the server (`GET /api/sources`), which reports real
 * per-source counts. The seeded list is gone: a source Brief is not actually
 * connected to must never appear in the list of sources Brief reads.
 */
const INITIAL_SOURCES: Source[] = [];

// ============================================================================
// INGESTION BOUNDARY
// ----------------------------------------------------------------------------
// The rule this layer exists to enforce: a message does NOT become a post.
//
// A raw inbound message is parsed into a *candidate* object, stamped with where
// it came from and when, checked against what Brief already knows, and then
// held for review. Nothing enters the object graph automatically. Everything
// below is pure -- no network, no timers, no side effects -- so the parsing
// rules can be tested without a pipeline attached.
//
// The parser's job is to extract what is literally present in the text. When a
// field is not stated, it stays undefined. A low-confidence candidate is a
// correct outcome, not a failure to be papered over with guesses.
// ============================================================================

export interface InboundMessage {
  id: string;
  channel: SourceType;
  // Which feed/group/page it arrived from. Becomes sourceId on the object.
  sourceId: string;
  sourceLabel: string;
  text: string;
  receivedAt: string;
  sourceUrl?: string;
  media?: InboundMedia[];
}

// An image is retained as evidence, never as a source of claims. Brief does no
// image recognition, so nothing is ever read out of a flyer or price list --
// the reference is kept so a later processor can attach real extractions.
export interface InboundMedia {
  kind: 'image' | 'document' | 'audio' | 'video';
  reference: string;
  caption?: string;
}

export type ImageAnalysisStatus = 'pending' | 'processed' | 'unavailable';

export interface CandidateMedia extends InboundMedia {
  sourceId: string;
  sourceMessageId: string;
  receivedAt: string;
  imageAnalysisStatus: ImageAnalysisStatus;
}

// Review lifecycle for anything Brief did not author. 'candidate' is the only
// state ingestion may produce; a human moves it from there.
export type ReviewState = 'candidate' | 'confirmed' | 'rejected';

export type CandidateStatus = 'pending' | 'accepted' | 'rejected';

export interface ExtractedField {
  field: string;
  value: string;
  // The exact substring the value came from, so a reviewer can audit the
  // parser instead of trusting it.
  evidence: string;
}

export interface IngestionCandidate {
  id: string;
  message: InboundMessage;
  draft: BriefObject;
  extracted: ExtractedField[];
  // 0..1, derived only from how much was actually extracted.
  confidence: number;
  typeConfident: boolean;
  duplicates: DuplicateCandidate[];
  suggestedLinks: { objectId: string; relation: string; why: string }[];
  status: CandidateStatus;
  reviewState: ReviewState;
  media: CandidateMedia[];
  // Some messages are just conversation. When this is false there is nothing
  // to review and nothing to publish -- Brief must not manufacture a record.
  isObjectWorthy: boolean;
  rejectionReason?: string;
  warnings: string[];
}

// --- Field extractors --------------------------------------------------------
// Each returns null when the field is not clearly present. None of them fall
// back to a default; a missing field must stay missing.

const MONEY_RE = /(?:ksh|kes|sh)\s*\.?\s*([0-9][0-9,\.]*)\s*(?:\/=|\/-)?|([0-9][0-9,]{2,})\s*(?:\/=|\/-)/i;
const PHONE_RE = /(?:\+254|0)7[0-9]{8}\b|\+254\s?7[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}/;
const HOURS_RE = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])\s*(?:-|to|until|till)\s*([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i;
const DEADLINE_RE = /\b(?:deadline|closes|closing|apply by|last day|ends)\b[:\s]*([A-Za-z0-9 ,]{3,24})/i;
const LOCATION_RE = /\b(?:at|located at|location|venue|along|opposite|near)\b[:\s]+([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*){0,4})/;

// Chatter markers: questions, greetings, replies. Presence alone is not
// disqualifying -- a real advert can contain a question -- so this is only
// decisive when the message also carries no concrete detail at all.
const CONVERSATION_RE = /^(?:\s*(?:hi|hey|hello|habari|sasa|niaje|thanks|asante|ok|okay|yes|no|lol|haha)\b|.*\?\s*$)/i;

const cleanMoney = (raw: string): number | null => {
  const n = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Type inference from explicit vocabulary only. Each rule needs a word that
// genuinely signals the category; ambiguity returns null rather than 'place'.
const TYPE_SIGNALS: { type: ObjectType; words: RegExp; label: string }[] = [
  { type: 'opportunity', words: /\b(grant|scholarship|apply|application|funding|vacancy|hiring|job|tender|bursary)\b/i, label: 'application language' },
  { type: 'experience', words: /\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar|tournament|match|gathering|party|concert|show)\b/i, label: 'event language' },
  { type: 'service', words: /\b(service|repair|installation|booking|book a|consultation|inspection|delivery|plumber|fundi)\b/i, label: 'service language' },
  { type: 'product', words: /\b(for sale|selling|stock|in stock|price|buy|brand new|second hand|pieces|units)\b/i, label: 'sale language' },
  { type: 'knowledge', words: /\b(guide|how to|steps|requirements|explainer|notice|announcement|news|update|alert|advisory|report|post|brief|bulletin|traffic|outage|power|water|road|weather|community|statement|release|info)\b/i, label: 'informational language' },
  { type: 'place', words: /\b(shop|stall|market|centre|center|hub|office|premises|located at|branch|station|venue|avenue|street)\b/i, label: 'premises language' }
];

const inferType = (text: string): { type: ObjectType; why: string } | null => {
  for (const signal of TYPE_SIGNALS) {
    const hit = text.match(signal.words);
    if (hit) return { type: signal.type, why: `${signal.label} ("${hit[0]}")` };
  }
  return null;
};

// A title is the first meaningful line, trimmed. We never synthesise one from
// keywords -- if there is no usable line the candidate is flagged instead.
const extractTitle = (text: string): string | null => {
  const line = text
    .split(/\n|(?<=[.!])\s+/)
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && l.length <= 90 && /[a-z]/i.test(l));
  if (line) return line.replace(/^[^A-Za-z0-9]+/, '').slice(0, 80);
  const fallback = text
    .split(/\n|(?<=[.!])\s+/)
    .map((l) => l.trim())
    .find((l) => l.length >= 4 && /[a-z0-9]/i.test(l));
  if (!fallback) return null;
  return fallback.replace(/^[^A-Za-z0-9]+/, '').slice(0, 80);
};

const parseInboundMessage = (
  message: InboundMessage,
  existing: BriefObject[]
): IngestionCandidate => {
  const text = message.text;
  const extracted: ExtractedField[] = [];
  const warnings: string[] = [];
  const metadata: BriefObject['metadata'] = {};

  const title = extractTitle(text);
  if (title) {
    extracted.push({ field: 'title', value: title, evidence: title });
  } else {
    warnings.push('No usable title line found.');
  }

  const typed = inferType(text);
  if (!typed) {
    warnings.push('Object type could not be determined from the text.');
  }

  const money = text.match(MONEY_RE);
  if (money) {
    const value = cleanMoney(money[1] ?? money[2] ?? '');
    if (value !== null) {
      metadata.price = value;
      metadata.currency = 'KES';
      extracted.push({ field: 'price', value: String(value), evidence: money[0].trim() });
    }
  }

  const phone = text.match(PHONE_RE);
  if (phone) {
    metadata.contactPhone = phone[0].trim();
    extracted.push({ field: 'contactPhone', value: phone[0].trim(), evidence: phone[0].trim() });
  }

  const hours = text.match(HOURS_RE);
  if (hours) {
    const value = `${hours[1]}:${hours[2]}-${hours[3]}:${hours[4]}`;
    metadata.operatingHours = value;
    extracted.push({ field: 'operatingHours', value, evidence: hours[0].trim() });
  }

  const deadline = text.match(DEADLINE_RE);
  if (deadline) {
    const value = deadline[1].trim().replace(/[,.]$/, '');
    metadata.deadline = value;
    extracted.push({ field: 'deadline', value, evidence: deadline[0].trim() });
  }

  const location = text.match(LOCATION_RE);
  const locationName = location ? location[1].trim() : undefined;
  if (locationName) {
    extracted.push({ field: 'locationName', value: locationName, evidence: location![0].trim() });
  }

  // Confidence is a description of the evidence, not a marketing number.
  // Type and title are the load-bearing fields; details add smaller increments.
  let confidence = 0;
  if (title) confidence += 0.35;
  if (typed) confidence += 0.35;
  if (locationName) confidence += 0.1;
  if (metadata.contactPhone) confidence += 0.08;
  if (metadata.price !== undefined) confidence += 0.06;
  if (metadata.operatingHours || metadata.deadline) confidence += 0.06;
  confidence = Math.min(1, Number(confidence.toFixed(2)));

  const draft: BriefObject = {
    id: `ing_${message.id}`,
    type: typed?.type ?? 'knowledge',
    title: title ?? '(untitled inbound message)',
    category: 'Unreviewed',
    summary: text.replace(/\s+/g, ' ').trim().slice(0, 160),
    locationName,
    // No creatorName: the sender of a message is not automatically the
    // business it describes. A reviewer supplies that, or nobody does.
    // No trustScore and isVerified:false -- nothing here has been verified.
    isVerified: false,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    sourceType: message.channel,
    sourceId: message.sourceId,
    sourceMessageId: message.id,
    sourceUrl: message.sourceUrl,
    ingestedAt: message.receivedAt,
    // lastVerifiedAt is deliberately absent: ingestion is not verification.
    createdAt: message.receivedAt
  };

  // Connect to what Brief already knows -- by explicit evidence only.
  const suggestedLinks: IngestionCandidate['suggestedLinks'] = [];
  const haystack = text.toLowerCase();

  for (const item of existing) {
    if (item.title && haystack.includes(item.title.toLowerCase())) {
      suggestedLinks.push({
        objectId: item.id,
        relation: item.type === 'place' ? 'locationObjectId' : 'relatedObjectIds',
        why: `Message names "${item.title}"`
      });
      continue;
    }
    if (
      locationName &&
      item.type === 'place' &&
      item.title.toLowerCase().includes(locationName.toLowerCase())
    ) {
      suggestedLinks.push({
        objectId: item.id,
        relation: 'locationObjectId',
        why: `Stated location matches "${item.title}"`
      });
    }
  }

  const duplicates = findPotentialDuplicates(draft, existing, 0.7);
  if (duplicates.length > 0) {
    warnings.push(`Possible duplicate of ${duplicates.length} existing record(s).`);
  }

  // --- Is this even an object? ---------------------------------------------
  // The single most important rule in the pipeline: most messages in a group
  // are conversation, and conversation must not become database records.
  // A message earns an object only by carrying a title, a determinable type,
  // and at least one concrete detail.
  const concreteDetails = extracted.filter((f) => f.field !== 'title').length;
  const conversational = CONVERSATION_RE.test(text.trim());
  const tooShort = text.trim().length < 18;

  let rejectionReason: string | undefined;
  if (!title) {
    rejectionReason = 'No usable title line.';
  } else if (!typed) {
    rejectionReason = 'No recognisable object type in the text.';
  } else if (tooShort) {
    rejectionReason = 'Too short to describe anything.';
  } else if (conversational && concreteDetails === 0) {
    rejectionReason = 'Reads as conversation, not an announcement.';
  }

  const isObjectWorthy = rejectionReason === undefined;

  const media: CandidateMedia[] = (message.media ?? []).map((m) => ({
    ...m,
    sourceId: message.sourceId,
    sourceMessageId: message.id,
    receivedAt: message.receivedAt,
    // Brief does not read images. The reference is preserved so a future
    // processor can attach real extractions; until then nothing is claimed.
    imageAnalysisStatus: 'pending' as ImageAnalysisStatus
  }));

  return {
    id: `cand_${message.id}`,
    message,
    draft,
    extracted,
    confidence,
    typeConfident: Boolean(typed),
    duplicates,
    suggestedLinks,
    status: 'pending',
    reviewState: 'candidate',
    media,
    isObjectWorthy,
    rejectionReason,
    warnings
  };
};

// ============================================================================
// ARENA -- a separate world of objects inside Brief, on the same engine.
// Players / games / challenges / matches, not a gaming social network.
// There is no feed, no posts, no likes, no follower counts here.
// ============================================================================

// Game-agnostic from the start. eFootball is simply the first entry, not the
// model. 'other' keeps the union honest rather than pretending the list is
// exhaustive.
export type ArenaGameId =
  | 'efootball'
  | 'fc_mobile'
  | 'ea_fc'
  | 'pubg'
  | 'cod'
  | 'other';

export interface ArenaGame {
  id: ArenaGameId;
  name: string;
  shortName: string;
  // Modes this particular game actually supports. A 2v2 option must not appear
  // for a game that has no such mode.
  modes: string[];
  // Whether the publisher permits account transfer. Brief does not guess this
  // per-user; it is a property of the game's own terms.
  accountTransferPolicy: TransferPolicy;
}

// The boundary that keeps Arena out of trouble. Applied to listings, so an
// item whose transferability is unknown cannot be quietly treated as sellable.
export type TransferPolicy =
  | 'officially_transferable'
  | 'restricted'
  | 'not_supported'
  | 'unknown';

// A player's game identity is NOT their Brief account. One person holds many
// game identities, each with its own tag, platform and rating.
export interface GameIdentity {
  id: string;
  playerId: string;
  gameId: ArenaGameId;
  game: string;
  gamerTag: string;
  platform?: string;
  region?: string;
  // Only true when a real verification step has happened. Never inferred from
  // activity, and never defaulted to true.
  verified?: boolean;
}

export type PlayerPresence = 'online' | 'nearby' | 'offline';

// --- Availability -----------------------------------------------------------
// The live signal that someone is open to an interaction right now. This is
// explicit and user-controlled: Brief never infers availability from activity,
// because "recently online" is not consent to be challenged.

export type AvailabilityState = 'available' | 'busy' | 'offline';
export type AvailabilityWindow = 'now' | 'today' | 'this_week' | 'custom';
export type PlayMode = 'free_match' | 'league' | 'ranked' | 'friendly' | 'tournament';
export type PlayFormat = '1v1' | '2v2' | 'team';

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  free_match: 'Free Match',
  league: 'League',
  ranked: 'Ranked',
  friendly: 'Friendly',
  tournament: 'Tournament'
};

export interface PlayerAvailability {
  playerId: string;
  state: AvailabilityState;
  gameId: ArenaGameId;
  mode: PlayMode;
  format: PlayFormat;
  window: AvailabilityWindow;
  // 'online' or a venue id. Never a precise coordinate: Arena shows a venue
  // or an approximate area, never where somebody actually is.
  locationKind: 'online' | 'venue';
  venueId?: string;
  // When true the player is only listed to people they could actually match
  // with, rather than to the whole of Arena.
  matchableOnly?: boolean;
  // Separate from a match request: organizers use this to find participants.
  lookingForLeague?: boolean;
  leagueDivision?: string;
  updatedAt: string;
}

// Reliability is behavioural, not a rating other players hand out. Cancelling
// is treated far more gently than not turning up.
export interface ReliabilityRecord {
  playerId: string;
  accepted: number;
  completed: number;
  cancelled: number;
  noShows: number;
  disputes: number;
}

// Returns undefined rather than a flattering 100% for someone with no history.
const getReliability = (r: ReliabilityRecord): number | undefined => {
  const engagements = r.completed + r.cancelled + r.noShows + r.disputes;
  if (engagements <= 0) return undefined;
  // A legitimate cancellation costs a little; a no-show or dispute costs a lot.
  const penalty = r.cancelled * 0.5 + r.noShows * 3 + r.disputes * 2;
  const score = ((engagements - penalty) / engagements) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
};

// Repeated no-shows reduce visibility instead of triggering a ban.
const getAvailabilityVisibility = (
  r: ReliabilityRecord | undefined
): 'normal' | 'reduced' => {
  if (!r) return 'normal';
  const score = getReliability(r);
  if (typeof score !== 'number') return 'normal';
  return score < 60 || r.noShows >= 3 ? 'reduced' : 'normal';
};

export interface ArenaPlayer {
  id: string;
  displayName: string;
  presence: PlayerPresence;
  // Reuses the existing proximity field so Arena inherits the same distance
  // semantics as the rest of Brief. Absent means location is not known.
  distanceKm?: number;
  preferredMode?: string;
  lastSeenAt: string;
}

// Per-game record. Stats belong to a game identity, not to the person: being
// strong at eFootball says nothing about their COD rating.
export interface PlayerGameStats {
  identityId: string;
  rating?: number;
  matches: number;
  wins: number;
  losses: number;
}

// Win rate is derived, never stored, and undefined when nothing has been
// played. A 0% win rate and "no matches yet" are different facts.
const getWinRate = (stats: PlayerGameStats): number | undefined => {
  if (stats.matches <= 0) return undefined;
  return Math.round((stats.wins / stats.matches) * 1000) / 10;
};

// Friendly vs competitive is the distinction that matters. Entry fees make a
// challenge competitive; Brief keeps the two visibly separate.
export type ChallengeStake = 'friendly' | 'ranked' | 'entry_fee';
export type ChallengeStatus =
  | 'open'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'played'
  | 'expired'
  | 'cancelled';

export interface ArenaChallenge {
  id: string;
  gameId: ArenaGameId;
  mode: string;
  createdByPlayerId: string;
  stake: ChallengeStake;
  // Only meaningful when stake is 'entry_fee'. Absent for friendly matches.
  entryFeeKes?: number;
  format?: string;
  openUntil: string;
  status: ChallengeStatus;
  acceptedByPlayerId?: string;
  createdAt: string;
  // Set only when the challenge came from a group message, preserving the
  // bridge back to its original source.
  source?: SourceReference;
  // A direct challenge names its recipient; an open lobby challenge does not.
  toPlayerId?: string;
  proposedTime?: string;
  // Points on offer, shown to both sides before anyone commits.
  pointsReward?: number;
  // Set when the recipient counter-proposes rather than declining outright.
  suggestedTime?: string;
  declineReason?: string;
}

export interface ArenaMatch {
  id: string;
  challengeId: string;
  gameId: ArenaGameId;
  playerAId: string;
  playerBId: string;
  playerAName?: string;
  playerBName?: string;
  playedAt: string;
  // A match with no agreed result stays without one. Brief does not decide
  // who won.
  winnerPlayerId?: string;
  scoreLine?: string;
  // Both players must confirm before a result counts.
  confirmedByA?: boolean;
  confirmedByB?: boolean;
  // Server match lifecycle. Absent on older client-only rows.
  status?: 'scheduled' | 'reported' | 'confirmed' | 'disputed' | 'abandoned' | string;
  reportedBy?: string | null;
}

export type ArenaListingKind =
  | 'tournament_ticket'
  | 'coaching'
  | 'service'
  | 'game_product'
  | 'account';

export interface ArenaListing {
  id: string;
  kind: ArenaListingKind;
  gameId: ArenaGameId;
  title: string;
  priceKes?: number;
  sellerPlayerId: string;
  // Derived from the game's policy for account listings. Brief refuses to
  // facilitate what a publisher prohibits.
  transferPolicy: TransferPolicy;
  createdAt: string;
}

// The single gate for whether Arena will carry a listing. Account sales are
// only ever allowed when the game explicitly permits transfer; anything
// unknown or restricted is refused rather than quietly listed.
const canListInArena = (
  listing: Pick<ArenaListing, 'kind' | 'transferPolicy'>
): { allowed: boolean; reason: string } => {
  if (listing.kind !== 'account') {
    return { allowed: true, reason: '' };
  }
  if (listing.transferPolicy === 'officially_transferable') {
    return { allowed: true, reason: '' };
  }
  if (listing.transferPolicy === 'not_supported') {
    return {
      allowed: false,
      reason: 'This game does not permit account transfers.'
    };
  }
  if (listing.transferPolicy === 'restricted') {
    return {
      allowed: false,
      reason: 'Account transfers are restricted for this game.'
    };
  }
  return {
    allowed: false,
    reason: 'Transfer rules for this game have not been confirmed.'
  };
};

// A gaming lounge is a real place, so it reuses the same proximity semantics
// as every other Brief place object rather than inventing a location model.
export interface ArenaVenue {
  id: string;
  name: string;
  locationName: string;
  distanceKm?: number;
  // Physical capacity, so "3 of 8 stations free" is a fact, not a vibe.
  stations?: number;
  stationsFree?: number;
  pricePerHourKes?: number;
  openUntil?: string;
  // Games actually playable here. Drives which venues surface per game.
  gameIds: ArenaGameId[];
  contact?: string;
  // Set only when a real event is scheduled tonight.
  eventTonight?: string;
}

// Live presence at a venue, derived from players -- never stored as a number
// someone typed. If nobody is checked in, the count is 0 and reads as 0.
const getVenuePlayerCount = (
  venue: ArenaVenue,
  gameId: ArenaGameId,
  checkins: { playerId: string; venueId: string; gameId: ArenaGameId }[]
): number =>
  checkins.filter((c) => c.venueId === venue.id && c.gameId === gameId).length;

export interface FindGameFilter {
  gameId: ArenaGameId;
  mode?: string;
  // 'similar' compares against the asking player's rating; undefined means any.
  skill?: 'similar' | 'any';
  location?: 'online' | 'nearby' | 'any';
  maxEntryFeeKes?: number;
  freeOnly?: boolean;
}

export interface FindGameCandidate {
  player: ArenaPlayer;
  identity: GameIdentity;
  stats?: PlayerGameStats;
  challenge?: ArenaChallenge;
  reason: string;
}

// Find a Game. Matches only against players who actually hold an identity for
// that game and are currently reachable. No invented opponents, and no
// pretending an offline player is available.
const findGameCandidates = (
  filter: FindGameFilter,
  pool: {
    players: ArenaPlayer[];
    identities: GameIdentity[];
    stats: PlayerGameStats[];
    challenges: ArenaChallenge[];
    askingRating?: number;
    excludePlayerId?: string;
  },
  limit = 6
): FindGameCandidate[] => {
  const out: FindGameCandidate[] = [];

  for (const identity of pool.identities) {
    if (identity.gameId !== filter.gameId) continue;

    const player = pool.players.find((p) => p.id === identity.playerId);
    if (!player) continue;
    if (player.presence === 'offline') continue;
    // Never offer someone a match against themselves.
    if (pool.excludePlayerId && player.id === pool.excludePlayerId) continue;

    if (filter.location === 'nearby' && typeof player.distanceKm !== 'number') continue;
    if (filter.location === 'online' && player.presence !== 'online') continue;

    const stats = pool.stats.find((st) => st.identityId === identity.id);

    // Skill matching only applies when both ratings genuinely exist.
    if (
      filter.skill === 'similar' &&
      typeof pool.askingRating === 'number' &&
      typeof stats?.rating === 'number' &&
      Math.abs(stats.rating - pool.askingRating) > 6
    ) {
      continue;
    }

    const challenge = pool.challenges.find(
      (c) =>
        c.createdByPlayerId === player.id &&
        c.gameId === filter.gameId &&
        c.status === 'open' &&
        (!filter.mode || c.mode === filter.mode)
    );

    const fee = challenge?.entryFeeKes;
    if (filter.freeOnly && typeof fee === 'number' && fee > 0) continue;
    if (
      typeof filter.maxEntryFeeKes === 'number' &&
      typeof fee === 'number' &&
      fee > filter.maxEntryFeeKes
    ) {
      continue;
    }

    const reasons: string[] = [];
    if (challenge) reasons.push('has an open challenge');
    if (player.presence === 'online') reasons.push('online now');
    else if (typeof player.distanceKm === 'number') {
      reasons.push(`${player.distanceKm} km away`);
    }
    if (
      filter.skill === 'similar' &&
      typeof stats?.rating === 'number' &&
      typeof pool.askingRating === 'number'
    ) {
      reasons.push('similar rating');
    }

    out.push({
      player,
      identity,
      stats,
      challenge,
      reason: reasons.join(' - ')
    });
  }

  // Open challenges first, then presence, then rating where known.
  return out
    .sort((a, b) => {
      if (!!b.challenge !== !!a.challenge) return b.challenge ? 1 : -1;
      if (a.player.presence !== b.player.presence) {
        return a.player.presence === 'online' ? -1 : 1;
      }
      return (b.stats?.rating ?? 0) - (a.stats?.rating ?? 0);
    })
    .slice(0, limit);
};

// Accepting a challenge is a state transition plus a relationship, reusing the
// existing edge model rather than inventing a second graph.
const acceptChallenge = (
  challenge: ArenaChallenge,
  acceptingPlayerId: string,
  now: string
): { challenge: ArenaChallenge; match: ArenaMatch; edges: ObjectRelationship[] } | null => {
  if (challenge.status !== 'open') return null;
  if (challenge.createdByPlayerId === acceptingPlayerId) return null;
  if (challenge.openUntil <= now) return null;

  const accepted: ArenaChallenge = {
    ...challenge,
    status: 'accepted',
    acceptedByPlayerId: acceptingPlayerId
  };

  const match: ArenaMatch = {
    id: `match_${challenge.id}`,
    challengeId: challenge.id,
    gameId: challenge.gameId,
    playerAId: challenge.createdByPlayerId,
    playerBId: acceptingPlayerId,
    playedAt: now
  };

  const edges: ObjectRelationship[] = [
    {
      id: `rel_${challenge.id}_created`,
      sourceType: 'identity',
      sourceId: challenge.createdByPlayerId,
      verb: 'challenges',
      targetType: 'identity',
      targetId: acceptingPlayerId,
      state: 'engaged',
      updatedAt: now
    },
    {
      id: `rel_${challenge.id}_accepted`,
      sourceType: 'identity',
      sourceId: acceptingPlayerId,
      verb: 'accepts',
      targetType: 'identity',
      targetId: challenge.createdByPlayerId,
      state: 'engaged',
      updatedAt: now
    }
  ];

  return { challenge: accepted, match, edges };
};

// A result only exists once BOTH players confirm it. Until then the match is
// played but undecided, and Brief says so rather than guessing.
const recordMatchResult = (
  match: ArenaMatch,
  winnerPlayerId: string | undefined,
  scoreLine: string | undefined
): ArenaMatch => ({
  ...match,
  winnerPlayerId,
  scoreLine
});

const isResultConfirmed = (match: ArenaMatch): boolean =>
  match.confirmedByA === true &&
  match.confirmedByB === true &&
  typeof match.winnerPlayerId === 'string';

// Group -> Arena bridge. A gaming group message asking for a match becomes a
// discoverable challenge request WITHOUT losing where it came from.
const MATCH_REQUEST_RE =
  /\b(anyone (?:for|up for|down for)|who(?:'s| is) (?:up|down|free) for|looking for (?:a )?(?:match|game|opponent)|any(?:one)? playing)\b/i;

// --- Arena Points ledger ----------------------------------------------------
// Every point that exists must trace to a ledger entry. Balances are derived
// by summing the ledger, never stored and incremented, so issued/redeemed
// totals can always be reconciled.

export type PointsReason =
  | 'match_complete'
  | 'match_win'
  | 'tournament_entry'
  | 'tournament_win'
  | 'challenge_verified'
  | 'league_participation'
  | 'community_contribution'
  | 'organizer_base'
  | 'organizer_milestone'
  | 'redemption';

// The economy has ONE driver: creating activity and bringing players to it.
// Participation pays a token amount -- enough to acknowledge showing up, never
// enough to be worth grinding. Everything substantial is earned by making
// something other people can take part in.
const ARENA_POINTS_CONFIG: Record<Exclude<PointsReason, 'redemption'>, number> = {
  // PARTICIPATION -- minimum by design.
  match_complete: 5,
  match_win: 10,
  tournament_entry: 15,
  tournament_win: 60,
  challenge_verified: 5,
  league_participation: 20,
  community_contribution: 50,
  // CREATION -- where the value actually is.
  organizer_base: 150,
  organizer_milestone: 0
};

// Creation rates. Reward follows PLAYERS, not events: running one tournament
// for 50 people is worth far more than running ten empty ones.
const ARENA_CREATION_CONFIG = {
  // Paid per player who actually finished. The core "having players" driver.
  perCompletedPlayer: 60,
  // Someone playing their first ever tournament. Growing the pool is the
  // single most valuable thing an organizer can do.
  perNewPlayer: 100,
  // Someone who came back. Retention counts for more than raw headcount.
  perRepeatPlayer: 30
};

// A hard ceiling on what playing alone can earn in a day. Without this, the
// "minimum for participating" rule is only a suggestion.
const PARTICIPATION_DAILY_CAP = 120;

const PARTICIPATION_REASONS: PointsReason[] = [
  'match_complete',
  'match_win',
  'challenge_verified',
  'tournament_entry',
  'league_participation'
];

const getParticipationEarnedOn = (
  ledger: PointsEntry[],
  playerId: string,
  dayIso: string
): number =>
  ledger
    .filter(
      (e) =>
        e.playerId === playerId &&
        e.amount > 0 &&
        PARTICIPATION_REASONS.includes(e.reason) &&
        e.at.slice(0, 10) === dayIso.slice(0, 10)
    )
    .reduce((sum, e) => sum + e.amount, 0);

// Awards participation points up to the daily cap. Returns what was actually
// granted, so the UI can tell the truth when the cap has been reached instead
// of silently paying nothing.
const awardParticipation = (
  ledger: PointsEntry[],
  playerId: string,
  reason: Exclude<PointsReason, 'redemption'>,
  now: string
): { granted: number; capped: boolean } => {
  const nominal = ARENA_POINTS_CONFIG[reason];
  const already = getParticipationEarnedOn(ledger, playerId, now);
  const room = Math.max(0, PARTICIPATION_DAILY_CAP - already);
  const granted = Math.min(nominal, room);
  return { granted, capped: granted < nominal };
};

export interface PointsEntry {
  id: string;
  playerId: string;
  reason: PointsReason;
  // Negative for redemptions. The sign is what makes the ledger balance.
  amount: number;
  at: string;
  refId?: string;
  note?: string;
}

const getPointsBalance = (ledger: PointsEntry[], playerId: string): number =>
  ledger
    .filter((e) => e.playerId === playerId)
    .reduce((sum, e) => sum + e.amount, 0);

const getPointsIssued = (ledger: PointsEntry[]): number =>
  ledger.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);

const getPointsRedeemed = (ledger: PointsEntry[]): number =>
  ledger.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);

// Outstanding points are a real liability once rewards are honoured, so the
// admin view derives it rather than tracking a separate counter.
const getPointsOutstanding = (ledger: PointsEntry[]): number =>
  getPointsIssued(ledger) - getPointsRedeemed(ledger);

// --- Organizer economy ------------------------------------------------------
// Organizers earn on COMPLETED activity. An empty tournament earns the base
// award only, and milestones count players who actually finished.

const ORGANIZER_MILESTONES: { completedPlayers: number; points: number; label: string }[] = [
  { completedPlayers: 100, points: 8000, label: 'Experienced' },
  { completedPlayers: 50, points: 3500, label: 'Major' },
  { completedPlayers: 25, points: 1500, label: 'Large' },
  { completedPlayers: 10, points: 600, label: 'Established' }
];

export interface Tournament {
  id: string;
  name: string;
  gameId: ArenaGameId;
  organizerId: string;
  capacity: number;
  registeredPlayerIds: string[];
  // Players who actually finished. Registrations alone never pay an organizer.
  completedPlayerIds: string[];
  // Of those, players new to Arena tournaments, and players who had played a
  // previous event by this organizer. Both are subsets of completedPlayerIds.
  newPlayerIds?: string[];
  repeatPlayerIds?: string[];
  matchesCompleted: number;
  status: 'open' | 'running' | 'completed' | 'cancelled';
  startsAt: string;
  venueId?: string;
  entryPoints?: number;
  prizeDescription?: string;
  disputes?: number;
  // Set only where a group genuinely shared this tournament.
  source?: SourceReference;
}

export interface OrganizerRewardBreakdown {
  points: number;
  milestone?: string;
  reason: string;
  // Itemised so an organizer can see exactly which players earned what, and
  // so the figure can be audited rather than trusted.
  lines: { label: string; points: number }[];
}

// The organizer's reward. Driven by PLAYERS SERVED, not by events created:
// the per-player rates dominate, the milestone is a bonus on top, and the flat
// base is small enough that creating tournaments nobody joins is pointless.
const getOrganizerReward = (t: Tournament): OrganizerRewardBreakdown => {
  if (t.status !== 'completed') {
    return { points: 0, milestone: undefined, reason: 'Not completed yet.', lines: [] };
  }
  const finished = t.completedPlayerIds.length;
  if (finished <= 0) {
    // Creating an event is worth nothing on its own. Players are the product.
    return { points: 0, milestone: undefined, reason: 'No players completed.', lines: [] };
  }

  const newPlayers = (t.newPlayerIds ?? []).filter((id) =>
    t.completedPlayerIds.includes(id)
  ).length;
  const repeatPlayers = (t.repeatPlayerIds ?? []).filter((id) =>
    t.completedPlayerIds.includes(id)
  ).length;

  const lines: { label: string; points: number }[] = [];

  const base = ARENA_POINTS_CONFIG.organizer_base;
  lines.push({ label: 'Ran the event', points: base });

  const perPlayer = finished * ARENA_CREATION_CONFIG.perCompletedPlayer;
  lines.push({ label: `${finished} players completed`, points: perPlayer });

  if (newPlayers > 0) {
    lines.push({
      label: `${newPlayers} new to Arena`,
      points: newPlayers * ARENA_CREATION_CONFIG.perNewPlayer
    });
  }
  if (repeatPlayers > 0) {
    lines.push({
      label: `${repeatPlayers} came back`,
      points: repeatPlayers * ARENA_CREATION_CONFIG.perRepeatPlayer
    });
  }

  const tier = ORGANIZER_MILESTONES.find((m) => finished >= m.completedPlayers);
  if (tier) {
    lines.push({ label: `${tier.label} milestone`, points: tier.points });
  }

  return {
    points: lines.reduce((sum, l) => sum + l.points, 0),
    milestone: tier ? tier.label : undefined,
    reason: `${finished} players completed`,
    lines
  };
};

// What an organizer would earn by bringing one more player. Shown in the UI so
// the incentive is legible rather than implied.
const getMarginalPlayerValue = (t: Tournament): number => {
  const before = getOrganizerReward({ ...t, status: 'completed' }).points;
  const nextId = `hypothetical_${t.id}`;
  const after = getOrganizerReward({
    ...t,
    status: 'completed',
    completedPlayerIds: [...t.completedPlayerIds, nextId]
  }).points;
  return after - before;
};

export interface OrganizerRecord {
  organizerId: string;
  tournamentsHosted: number;
  playersServed: number;
  matchesCompleted: number;
  completionRate: number;
  disputeRate: number;
  repeatPlayers: number;
  pointsEarned: number;
}

export type OrganizerRank =
  | 'Host'
  | 'Trusted Host'
  | 'Experienced Host'
  | 'Established Host'
  | 'Seasoned Host';

// Organizer rank needs volume AND quality. A high dispute rate blocks the top
// tiers regardless of how many tournaments someone has run.
const ORGANIZER_LADDER: {
  rank: OrganizerRank;
  minHosted: number;
  minPlayersServed: number;
  minCompletionRate: number;
  maxDisputeRate: number;
}[] = [
  { rank: 'Seasoned Host', minHosted: 25, minPlayersServed: 500, minCompletionRate: 95, maxDisputeRate: 2 },
  { rank: 'Established Host', minHosted: 15, minPlayersServed: 250, minCompletionRate: 90, maxDisputeRate: 4 },
  { rank: 'Experienced Host', minHosted: 8, minPlayersServed: 100, minCompletionRate: 85, maxDisputeRate: 6 },
  { rank: 'Trusted Host', minHosted: 3, minPlayersServed: 30, minCompletionRate: 75, maxDisputeRate: 10 },
  { rank: 'Host', minHosted: 0, minPlayersServed: 0, minCompletionRate: 0, maxDisputeRate: 100 }
];

const getOrganizerRank = (r: OrganizerRecord): OrganizerRank => {
  for (const tier of ORGANIZER_LADDER) {
    if (
      r.tournamentsHosted >= tier.minHosted &&
      r.playersServed >= tier.minPlayersServed &&
      r.completionRate >= tier.minCompletionRate &&
      r.disputeRate <= tier.maxDisputeRate
    ) {
      return tier.rank;
    }
  }
  return 'Host';
};

// --- Anti-abuse -------------------------------------------------------------
// Detection only. Nothing here bans anyone; it raises a flag for review.

export type AbuseFlagKind =
  | 'self_match'
  | 'rapid_repeat'
  | 'empty_tournament'
  | 'excessive_cancellation'
  | 'collusion_pattern';

export type AbuseFlagStatus = 'flagged' | 'under_review' | 'cleared' | 'restricted';

export interface AbuseFlag {
  id: string;
  subjectId: string;
  kind: AbuseFlagKind;
  status: AbuseFlagStatus;
  detail: string;
  detectedAt: string;
}

const detectAbuse = (
  matches: ArenaMatch[],
  tournaments: Tournament[],
  reliability: ReliabilityRecord[],
  now: string
): AbuseFlag[] => {
  const flags: AbuseFlag[] = [];

  for (const m of matches) {
    // Nobody plays themselves. This is the cheapest point-farm there is.
    if (m.playerAId === m.playerBId) {
      flags.push({
        id: `flag_self_${m.id}`,
        subjectId: m.playerAId,
        kind: 'self_match',
        status: 'flagged',
        detail: 'Both sides of the match are the same player.',
        detectedAt: now
      });
    }
  }

  // The same pair playing repeatedly in a short window looks like farming, so
  // it is surfaced for a human rather than judged automatically.
  const pairCounts: Record<string, number> = {};
  for (const m of matches) {
    const key = [m.playerAId, m.playerBId].sort().join('|');
    pairCounts[key] = (pairCounts[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(pairCounts)) {
    if (count >= 5) {
      flags.push({
        id: `flag_rapid_${key}`,
        subjectId: key.split('|')[0],
        kind: 'rapid_repeat',
        status: 'flagged',
        detail: `${count} matches between the same two players.`,
        detectedAt: now
      });
    }
  }

  for (const t of tournaments) {
    if (t.status === 'completed' && t.completedPlayerIds.length === 0) {
      flags.push({
        id: `flag_empty_${t.id}`,
        subjectId: t.organizerId,
        kind: 'empty_tournament',
        status: 'flagged',
        detail: 'Tournament marked complete with no finishing players.',
        detectedAt: now
      });
    }
  }

  for (const r of reliability) {
    if (r.noShows >= 3) {
      flags.push({
        id: `flag_cancel_${r.playerId}`,
        subjectId: r.playerId,
        kind: 'excessive_cancellation',
        status: 'flagged',
        detail: `${r.noShows} no-shows recorded.`,
        detectedAt: now
      });
    }
  }

  return flags;
};

// --- Availability-driven discovery ------------------------------------------

export interface AvailableEntry {
  player: ArenaPlayer;
  availability: PlayerAvailability;
  identity?: GameIdentity;
  stats?: PlayerGameStats;
  reliability?: number;
  visibility: 'normal' | 'reduced';
}

// Players Available Now. Lists ONLY players who explicitly switched
// availability on -- presence alone never puts someone in this list.
const getAvailablePlayers = (
  pool: {
    players: ArenaPlayer[];
    availability: PlayerAvailability[];
    identities: GameIdentity[];
    stats: PlayerGameStats[];
    reliability: ReliabilityRecord[];
  },
  filter: { gameId?: ArenaGameId; mode?: PlayMode; format?: PlayFormat; excludePlayerId?: string }
): AvailableEntry[] => {
  const out: AvailableEntry[] = [];

  for (const av of pool.availability) {
    if (av.state !== 'available') continue;
    if (filter.gameId && av.gameId !== filter.gameId) continue;
    if (filter.mode && av.mode !== filter.mode) continue;
    if (filter.format && av.format !== filter.format) continue;
    if (filter.excludePlayerId && av.playerId === filter.excludePlayerId) continue;

    const player = pool.players.find((p) => p.id === av.playerId);
    if (!player) continue;

    const identity = pool.identities.find(
      (i) => i.playerId === player.id && i.gameId === av.gameId
    );
    const stats = identity
      ? pool.stats.find((st) => st.identityId === identity.id)
      : undefined;
    const rel = pool.reliability.find((r) => r.playerId === player.id);

    out.push({
      player,
      availability: av,
      identity,
      stats,
      reliability: rel ? getReliability(rel) : undefined,
      visibility: getAvailabilityVisibility(rel)
    });
  }

  // Reliable players surface first; unreliable ones sink rather than vanish.
  return out.sort((a, b) => {
    if (a.visibility !== b.visibility) return a.visibility === 'normal' ? -1 : 1;
    return (b.reliability ?? 0) - (a.reliability ?? 0);
  });
};

const getLeagueSeekers = (
  pool: { players: ArenaPlayer[]; availability: PlayerAvailability[] },
  gameId: ArenaGameId
): { player: ArenaPlayer; availability: PlayerAvailability }[] => {
  const out: { player: ArenaPlayer; availability: PlayerAvailability }[] = [];
  for (const av of pool.availability) {
    if (!av.lookingForLeague) continue;
    if (av.gameId !== gameId) continue;
    if (av.state === 'offline') continue;
    const player = pool.players.find((p) => p.id === av.playerId);
    if (player) out.push({ player, availability: av });
  }
  return out;
};

// --- Challenge flow ---------------------------------------------------------

// A direct challenge starts as pending and names both sides. It never creates
// a match on its own -- the recipient has to agree first.
const createDirectChallenge = (
  fromPlayerId: string,
  toPlayerId: string,
  opts: { gameId: ArenaGameId; mode: string; format?: PlayFormat; proposedTime?: string; pointsReward?: number },
  now: string
): ArenaChallenge | null => {
  // Self-challenge is the simplest farm; refuse it at the source.
  if (fromPlayerId === toPlayerId) return null;
  return {
    id: `chl_${fromPlayerId}_${toPlayerId}_${now}`,
    gameId: opts.gameId,
    mode: opts.mode,
    createdByPlayerId: fromPlayerId,
    toPlayerId,
    stake: 'friendly',
    format: opts.format ?? '1v1',
    openUntil: opts.proposedTime ?? now,
    proposedTime: opts.proposedTime,
    pointsReward: opts.pointsReward ?? ARENA_POINTS_CONFIG.match_complete,
    status: 'pending',
    createdAt: now
  };
};

const declineChallenge = (c: ArenaChallenge, reason?: string): ArenaChallenge => ({
  ...c,
  status: 'declined',
  declineReason: reason
});

const suggestChallengeTime = (c: ArenaChallenge, time: string): ArenaChallenge => ({
  ...c,
  suggestedTime: time,
  status: 'pending'
});

// Duplicate protection: one match per challenge, always.
const matchExistsForChallenge = (matches: ArenaMatch[], challengeId: string): boolean =>
  matches.some((m) => m.challengeId === challengeId);

// --- Gift cards -------------------------------------------------------------
// Arena Points are NOT money. A gift card has a shilling face value, a points
// cost, and no exchange rate is implied between them beyond what is displayed.

export type RewardCategory =
  | 'supermarket'
  | 'gaming'
  | 'food'
  | 'transport'
  | 'merchandise'
  | 'mobile_data'
  | 'entertainment';

export type RedemptionMethod = 'voucher_code' | 'qr' | 'physical_card';
export type GiftCardStatus = 'available' | 'sold_out' | 'expired' | 'suspended';

export interface GiftCard {
  id: string;
  brand: string;
  merchant: string;
  category: RewardCategory;
  // Face value in KES. Deliberately separate from pointsRequired so the UI can
  // never present points as currency.
  valueKes: number;
  pointsRequired: number;
  redemptionMethod: RedemptionMethod;
  status: GiftCardStatus;
  inventory: number;
  region: string;
  expiryAt?: string;
  termsNote?: string;
}

// Issued only when a redemption genuinely completes. There is no code until
// the system has actually processed the claim.
export interface RedemptionRecord {
  id: string;
  giftCardId: string;
  playerId: string;
  pointsSpent: number;
  at: string;
  status: 'processing' | 'issued' | 'failed';
  voucherCode?: string;
  failureReason?: string;
}

// Caps that stop unlimited points becoming unlimited liability.
export interface RewardPoolControls {
  dailyRedemptionLimit: number;
  monthlyRedemptionLimit: number;
  redeemedToday: number;
  redeemedThisMonth: number;
}

const canRedeemGiftCard = (
  card: GiftCard,
  ctx: { balance: number; region: string; controls: RewardPoolControls; now: string }
): { allowed: boolean; reason: string } => {
  if (card.status === 'suspended') return { allowed: false, reason: 'Temporarily unavailable.' };
  if (card.status === 'sold_out' || card.inventory <= 0) {
    return { allowed: false, reason: 'Out of stock.' };
  }
  if (card.expiryAt && card.expiryAt <= ctx.now) {
    return { allowed: false, reason: 'This reward has expired.' };
  }
  if (card.region !== ctx.region) {
    return { allowed: false, reason: `Only available in ${card.region}.` };
  }
  if (ctx.controls.redeemedToday >= ctx.controls.dailyRedemptionLimit) {
    return { allowed: false, reason: "Today's redemption limit has been reached." };
  }
  if (ctx.controls.redeemedThisMonth >= ctx.controls.monthlyRedemptionLimit) {
    return { allowed: false, reason: "This month's redemption limit has been reached." };
  }
  if (ctx.balance < card.pointsRequired) {
    const short = card.pointsRequired - ctx.balance;
    return { allowed: false, reason: `${short.toLocaleString()} more points needed.` };
  }
  return { allowed: true, reason: '' };
};

// --- Badges -----------------------------------------------------------------
// Earned from real counters only. No badge exists that cannot be recomputed.

export interface BadgeDef {
  id: string;
  label: string;
  earned: boolean;
}

const getBadges = (ctx: {
  matchesPlayed: number;
  wins: number;
  losses: number;
  tournamentsHosted: number;
  leagueAppearances: number;
  reliability?: number;
  acceptedContributions: number;
}): BadgeDef[] => [
  { id: 'bdg_100', label: '100 Matches', earned: ctx.matchesPlayed >= 100 },
  { id: 'bdg_500', label: '500 Matches', earned: ctx.matchesPlayed >= 500 },
  {
    id: 'bdg_undefeated',
    label: 'Undefeated',
    // Requires a real run: never awarded to someone with no matches.
    earned: ctx.matchesPlayed >= 10 && ctx.losses === 0
  },
  {
    id: 'bdg_reliable',
    label: 'Reliable Player',
    earned: typeof ctx.reliability === 'number' && ctx.reliability >= 95
  },
  { id: 'bdg_host', label: 'Tournament Host', earned: ctx.tournamentsHosted >= 1 },
  { id: 'bdg_toporg', label: 'Top Organizer', earned: ctx.tournamentsHosted >= 10 },
  { id: 'bdg_league', label: 'League Regular', earned: ctx.leagueAppearances >= 3 },
  { id: 'bdg_builder', label: 'Community Builder', earned: ctx.acceptedContributions >= 50 }
];

const detectMatchRequest = (
  entry: GroupKnowledgeEntry,
  games: ArenaGame[]
): { gameId: ArenaGameId; evidence: string } | null => {
  const hit = entry.searchableText.match(MATCH_REQUEST_RE);
  if (!hit) return null;

  const lower = entry.searchableText.toLowerCase();
  const game = games.find(
    (g) =>
      lower.includes(g.name.toLowerCase()) ||
      lower.includes(g.shortName.toLowerCase())
  );
  // Without a named game Brief will not assume which one was meant.
  if (!game) return null;

  return { gameId: game.id, evidence: hit[0] };
};

// ============================================================================
// PARTICIPATION -- quests, points, rank, rewards.
// The rule that keeps this from becoming engagement bait: points settle only
// when a contribution is ACCEPTED. Nothing pays for clicking, opening the app,
// posting volume, or logging in on consecutive days.
// ============================================================================

export type QuestKind =
  | 'verify_event'
  | 'photograph_notice'
  | 'answer_question'
  | 'help_find_vendor'
  | 'attend_and_checkin'
  | 'arena_challenge'
  | 'create_challenge'
  | 'refer_participant';

// A submission is reviewed before it is worth anything. 'rejected' work pays
// zero -- that is what stops volume-farming.
export type QuestStatus = 'open' | 'submitted' | 'accepted' | 'rejected' | 'expired';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  // What acceptance actually requires. Shown to the user BEFORE they start, so
  // reward criteria are never retroactive.
  acceptanceCriteria: string;
  points: number;
  status: QuestStatus;
  // Ties a quest to a real place, group or game where one applies.
  locationName?: string;
  distanceKm?: number;
  groupId?: string;
  gameId?: ArenaGameId;
  expiresAt?: string;
  // Set when a submission has been reviewed. Rejections carry a reason.
  reviewNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

// Contribution quality, not point volume. Someone who submits 200 items and
// has 8 accepted is not a top contributor.
export interface ContributionRecord {
  accepted: number;
  rejected: number;
  // Points that have actually settled. Pending work is deliberately excluded.
  settledPoints: number;
}

export const getAcceptanceRate = (c: ContributionRecord): number | undefined => {
  const total = c.accepted + c.rejected;
  if (total <= 0) return undefined;
  return Math.round((c.accepted / total) * 1000) / 10;
};

// Rank is earned through accepted contribution, with an accuracy floor. Raw
// points alone cannot buy a rank -- that is the whole point of the ladder.
export type BriefRank =
  | 'Newcomer'
  | 'Explorer'
  | 'Contributor'
  | 'Seasoned'
  | 'Expert'
  | 'Steward';

const RANK_LADDER: {
  rank: BriefRank;
  minAccepted: number;
  minAcceptanceRate: number;
}[] = [
  { rank: 'Steward', minAccepted: 500, minAcceptanceRate: 90 },
  { rank: 'Expert', minAccepted: 200, minAcceptanceRate: 85 },
  { rank: 'Seasoned', minAccepted: 75, minAcceptanceRate: 80 },
  { rank: 'Contributor', minAccepted: 20, minAcceptanceRate: 70 },
  { rank: 'Explorer', minAccepted: 5, minAcceptanceRate: 0 },
  { rank: 'Newcomer', minAccepted: 0, minAcceptanceRate: 0 }
];

export const getBriefRank = (c: ContributionRecord): BriefRank => {
  const rate = getAcceptanceRate(c) ?? 0;
  for (const tier of RANK_LADDER) {
    if (c.accepted >= tier.minAccepted && rate >= tier.minAcceptanceRate) {
      return tier.rank;
    }
  }
  return 'Newcomer';
};

// What the user must still do to reach the next tier. Only ever states real
// remaining requirements; returns null at the top.
export const getNextRankRequirement = (
  c: ContributionRecord
): { rank: BriefRank; needAccepted: number; needRate: number } | null => {
  const current = getBriefRank(c);
  const index = RANK_LADDER.findIndex((t) => t.rank === current);
  if (index <= 0) return null;
  const next = RANK_LADDER[index - 1];
  const rate = getAcceptanceRate(c) ?? 0;
  return {
    rank: next.rank,
    needAccepted: Math.max(0, next.minAccepted - c.accepted),
    needRate: Math.max(0, Math.round((next.minAcceptanceRate - rate) * 10) / 10)
  };
};

export interface Participant {
  id: string;
  displayName: string;
  locationName: string;
  contribution: ContributionRecord;
}

// Rewards are local by construction. A Nairobi user should not be offered a
// foreign gift card as the default prize.
export type RewardKind =
  | 'supermarket_voucher'
  | 'airtime'
  | 'data_bundle'
  | 'merchant_voucher'
  | 'event_ticket'
  | 'gaming_credit';

export interface Reward {
  id: string;
  kind: RewardKind;
  title: string;
  // The merchant actually honouring it. No reward without a named provider.
  providerName: string;
  valueKes: number;
  pointsCost: number;
  region: string;
  // Finite stock. Brief does not advertise a reward it cannot fulfil.
  remaining: number;
  // Whether the reward may be passed on, decided per provider rather than
  // assumed. Reuses the same policy vocabulary as Arena listings.
  transferPolicy: TransferPolicy;
}

// A reward can only be claimed with SETTLED points, and only while stock and
// region genuinely permit it.
const canRedeem = (
  reward: Reward,
  wallet: { settledPoints: number; region: string }
): { allowed: boolean; reason: string } => {
  if (reward.remaining <= 0) {
    return { allowed: false, reason: 'Out of stock.' };
  }
  if (reward.region !== wallet.region) {
    return { allowed: false, reason: `Only available in ${reward.region}.` };
  }
  if (wallet.settledPoints < reward.pointsCost) {
    const short = reward.pointsCost - wallet.settledPoints;
    return { allowed: false, reason: `${short.toLocaleString()} more points needed.` };
  }
  return { allowed: true, reason: '' };
};

// A transparent pool, not a reference to anybody's salary. Brief states what
// is committed and what remains, and never implies a payout it cannot cover.
export interface RewardPool {
  periodLabel: string;
  totalKes: number;
  committedKes: number;
  // Points-to-shilling is fixed and published, not discovered at redemption.
  kesPerPoint: number;
}

export const getPoolRemaining = (pool: RewardPool): number =>
  Math.max(0, pool.totalKes - pool.committedKes);

// Points settle ONLY on acceptance. Any other status is worth zero, and this
// is the single place that decides it.
const settleQuest = (quest: Quest): number =>
  quest.status === 'accepted' ? quest.points : 0;

export const summariseContribution = (quests: Quest[]): ContributionRecord => {
  let accepted = 0;
  let rejected = 0;
  let settledPoints = 0;
  for (const q of quests) {
    if (q.status === 'accepted') {
      accepted += 1;
      settledPoints += settleQuest(q);
    } else if (q.status === 'rejected') {
      rejected += 1;
    }
  }
  return { accepted, rejected, settledPoints };
};

// Two boards, deliberately. Ranking on points alone teaches people to farm
// points; ranking on accepted contribution teaches them to be useful.
export const getTopEarners = (people: Participant[], limit = 5): Participant[] =>
  [...people]
    .sort((a, b) => b.contribution.settledPoints - a.contribution.settledPoints)
    .slice(0, limit);

export const getTopContributors = (people: Participant[], limit = 5): Participant[] =>
  [...people]
    .sort((a, b) => {
      if (b.contribution.accepted !== a.contribution.accepted) {
        return b.contribution.accepted - a.contribution.accepted;
      }
      return (getAcceptanceRate(b.contribution) ?? 0) - (getAcceptanceRate(a.contribution) ?? 0);
    })
    .slice(0, limit);

// Percentile is only meaningful with a real cohort behind it.
export const getPercentile = (
  person: Participant,
  people: Participant[]
): number | undefined => {
  if (people.length < 10) return undefined;
  const better = people.filter(
    (p) => p.contribution.accepted > person.contribution.accepted
  ).length;
  return Math.max(0.1, Math.round((better / people.length) * 1000) / 10);
};

// --- Arena game glyphs ------------------------------------------------------
// Brief draws its own marks. Real publisher logos (eFootball, EA FC, PUBG) are
// trademarked artwork Brief has no licence to reproduce, and inventing a
// lookalike would be a fabricated brand asset. Each glyph is a plain shape that
// says which game it is, wrapped in a ring that reports live player count --
// so the mark is dynamic: it changes as people arrive and leave.

// A ball for football titles, crosshair for shooters, generic pad otherwise.
const GameGlyphShape: React.FC<{ gameId: ArenaGameId; color: string }> = ({
  gameId,
  color
}) => {
  if (gameId === 'efootball' || gameId === 'fc_mobile' || gameId === 'ea_fc') {
    return (
      <g stroke={color} strokeWidth="1.6" fill="none">
        <circle cx="20" cy="20" r="7.5" />
        <path d="M20 12.5 L23.6 15.2 L22.2 19.4 L17.8 19.4 L16.4 15.2 Z" fill={color} stroke="none" />
      </g>
    );
  }
  if (gameId === 'pubg' || gameId === 'cod') {
    return (
      <g stroke={color} strokeWidth="1.6" fill="none">
        <circle cx="20" cy="20" r="6.5" />
        <line x1="20" y1="10.5" x2="20" y2="14.5" />
        <line x1="20" y1="25.5" x2="20" y2="29.5" />
        <line x1="10.5" y1="20" x2="14.5" y2="20" />
        <line x1="25.5" y1="20" x2="29.5" y2="20" />
        <circle cx="20" cy="20" r="1.6" fill={color} stroke="none" />
      </g>
    );
  }
  return (
    <g stroke={color} strokeWidth="1.6" fill="none">
      <rect x="12" y="15" width="16" height="10" rx="5" />
      <line x1="16" y1="20" x2="18.5" y2="20" />
      <line x1="17.25" y1="18.75" x2="17.25" y2="21.25" />
      <circle cx="23.5" cy="19" r="1.1" fill={color} stroke="none" />
      <circle cx="25.5" cy="21.5" r="1.1" fill={color} stroke="none" />
    </g>
  );
};

// The ring is the live part. Its arc is playerCount/capacity, it goes amber
// when the venue is full, and grey with a dashed ring when nobody is there --
// a quiet mark rather than a fake-busy one.
const GameGlyph: React.FC<{
  gameId: ArenaGameId;
  playerCount: number;
  capacity?: number;
  label?: string;
}> = ({ gameId, playerCount, capacity, label }) => {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const ceiling = typeof capacity === 'number' && capacity > 0 ? capacity : 8;
  const ratio = Math.max(0, Math.min(1, playerCount / ceiling));
  const full = typeof capacity === 'number' && capacity > 0 && playerCount >= capacity;
  const empty = playerCount <= 0;
  const color = empty ? '#9CA3AF' : full ? '#251045' : '#6B7280';

  return (
    <span className="relative inline-flex shrink-0" title={label}>
      <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label={label}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#D6CFE4" strokeWidth="2.5" />
        {/* Live arc. Nothing is drawn when the count is genuinely zero. */}
        {!empty && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            transform="rotate(-90 20 20)"
          />
        )}
        {empty && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#D6CFE4"
            strokeWidth="2.5"
            strokeDasharray="2 4"
          />
        )}
        <GameGlyphShape gameId={gameId} color={color} />
      </svg>
      <span
        className={`absolute -bottom-0.5 -right-0.5 min-w-[15px] px-1 rounded-full text-[8px] font-extrabold text-center leading-[15px] ${
          empty
            ? 'bg-[#FBFAFD] text-[#251045]/40'
            : full
            ? 'bg-[#5B2EA6] text-[#FFFFFF]'
            : 'bg-[#5B2EA6] text-[#FFFFFF]'
        }`}
      >
        {playerCount}
      </span>
    </span>
  );
};

// --- Arena fixtures ---------------------------------------------------------
// Deliberately small. Enough to exercise every path, not a fake population.

const ARENA_GAMES: ArenaGame[] = [
  {
    id: 'efootball',
    name: 'eFootball',
    shortName: 'eFootball',
    modes: ['1v1', '2v2'],
    accountTransferPolicy: 'not_supported'
  },
  {
    id: 'fc_mobile',
    name: 'FC Mobile',
    shortName: 'FC Mobile',
    modes: ['1v1'],
    accountTransferPolicy: 'not_supported'
  },
  {
    id: 'ea_fc',
    name: 'EA FC',
    shortName: 'EA FC',
    modes: ['1v1', '2v2'],
    accountTransferPolicy: 'restricted'
  },
  {
    id: 'pubg',
    name: 'PUBG Mobile',
    shortName: 'PUBG',
    modes: ['Solo', 'Duo', 'Squad'],
    accountTransferPolicy: 'not_supported'
  },
  {
    id: 'cod',
    name: 'Call of Duty Mobile',
    shortName: 'COD',
    modes: ['1v1', 'Squad'],
    accountTransferPolicy: 'not_supported'
  },
  {
    id: 'other',
    name: 'Other',
    shortName: 'Other',
    modes: ['1v1'],
    // Unknown rather than permissive: an unlisted game has unverified terms.
    accountTransferPolicy: 'unknown'
  }
];

// Semi-logo glyphs for the Konami-style title cards. Purely cosmetic.
const ARENA_GAME_GLYPHS: Record<string, string> = {
  efootball: '⚽',
  fc_mobile: '⚽',
  ea_fc: '⚽',
  pubg: '🪂',
  cod: '🎯',
  other: '🎮'
};

// Client game ids stay stable for the portal. The server uses a slightly
// different set (pubg_mobile, no ea_fc). Map at the edge; never invent a game.
const CLIENT_TO_SERVER_GAME: Record<ArenaGameId, string> = {
  efootball: 'efootball',
  fc_mobile: 'fc_mobile',
  ea_fc: 'fc_mobile',
  pubg: 'pubg_mobile',
  cod: 'cod_mobile',
  other: 'other'
};

const SERVER_TO_CLIENT_GAME: Record<string, ArenaGameId> = {
  efootball: 'efootball',
  fc_mobile: 'fc_mobile',
  pubg_mobile: 'pubg',
  cod_mobile: 'cod',
  other: 'other'
};

/** Never print fixture handles. If we do not know the person, say Player. */
const arenaPlayerLabel = (
  id: string | undefined,
  meId: string | null,
  name?: string | null
): string => {
  if (!id) return 'Player';
  if (meId && id === meId) return 'You';
  const label = String(name ?? '').trim();
  if (label && !/^(ply_|usr_|person_)/i.test(label) && label !== id) return label;
  return 'Player';
};





// --- Participation fixtures -------------------------------------------------

/**
 * No seeded quests. Participation is real activity or it is nothing.
 */
const INITIAL_QUESTS: Quest[] = [];

// Arena's reward catalogue. Arena is mapped but intentionally unbuilt, and
// this batch does not modify any Arena code path -- including its fixtures.
const REWARD_CATALOGUE: Reward[] = [
  { id: 'rwd_carrefour_500', kind: 'supermarket_voucher', title: 'KES 500 supermarket voucher', providerName: 'Carrefour', valueKes: 500, pointsCost: 500, region: 'Nairobi', remaining: 24, transferPolicy: 'restricted' },
  { id: 'rwd_airtime_100', kind: 'airtime', title: 'KES 100 airtime', providerName: 'Safaricom', valueKes: 100, pointsCost: 100, region: 'Nairobi', remaining: 180, transferPolicy: 'officially_transferable' },
  { id: 'rwd_data_1gb', kind: 'data_bundle', title: '1GB data bundle', providerName: 'Safaricom', valueKes: 99, pointsCost: 110, region: 'Nairobi', remaining: 90, transferPolicy: 'officially_transferable' },
  { id: 'rwd_gamehub_hour', kind: 'gaming_credit', title: '2 hours at GameHub Kilimani', providerName: 'GameHub Kilimani', valueKes: 300, pointsCost: 320, region: 'Nairobi', remaining: 12, transferPolicy: 'officially_transferable' },
  { id: 'rwd_kikao_disc', kind: 'merchant_voucher', title: 'KES 1,000 off a solar kit', providerName: 'Kikao Hardware', valueKes: 1000, pointsCost: 900, region: 'Nairobi', remaining: 6, transferPolicy: 'restricted' },
  { id: 'rwd_cup_ticket', kind: 'event_ticket', title: 'Saturday cup entry', providerName: 'GameHub Kilimani', valueKes: 200, pointsCost: 220, region: 'Nairobi', remaining: 0, transferPolicy: 'officially_transferable' },
  // Deliberately out-of-region: must be refused, not quietly shown as claimable.
  { id: 'rwd_mombasa_voucher', kind: 'merchant_voucher', title: 'KES 500 seafood voucher', providerName: 'Mombasa Fish Market', valueKes: 500, pointsCost: 450, region: 'Mombasa', remaining: 10, transferPolicy: 'restricted' }
];

/**
 * No fabricated reward pool.
 *
 * This declared a KES 1,000,000 pool with KES 412,500 already committed --
 * money that does not exist, presented as a real community fund. Brief has no
 * payment provider and cannot disburse anything, so advertising a pot is the
 * most damaging kind of invented economics.
 *
 * Zeroed rather than deleted: the Quests board reads the shape, and a pool of
 * zero is the truthful figure. The UI reports it as unfunded.
 */
export const COMMUNITY_POOL: RewardPool = {
  periodLabel: 'Not funded',
  totalKes: 0,
  committedKes: 0,
  kesPerPoint: 0
};

// A cohort large enough for a percentile to mean something.
/**
 * No fabricated cohort.
 *
 * This was eleven invented people -- Nyabs, Achieng, Mwangi and others -- with
 * invented accepted/rejected counts and invented settled point totals, ranked
 * into a leaderboard and rendered as real community standing. Percentiles
 * computed against an invented cohort are meaningless.
 *
 * The ranking helpers (getTopContributors, getTopEarners, getPercentile) are
 * real and keep their logic; they now operate on an empty cohort until real
 * participants exist.
 */
export const PARTICIPANTS: Participant[] = [];

// --- Arena economy fixtures -------------------------------------------------




const ORGANIZER_RECORDS: OrganizerRecord[] = [];

const REWARD_POOL_CONTROLS: RewardPoolControls = {
  dailyRedemptionLimit: 50,
  monthlyRedemptionLimit: 800,
  redeemedToday: 0,
  redeemedThisMonth: 0
};


// Who is physically at a venue right now. The glyph counts these, so an empty
// venue genuinely renders as zero.


// ============================================================================
// 2. SEED DATA
// ============================================================================

/**
 * Brief starts empty.
 *
 * This was 338 lines of invented places, events and opportunities -- Maji
 * Mazuri Market, fabricated permits, fabricated vendors -- rendered as though
 * they were real local records. They are gone. Objects now come from the
 * server, which only holds what a connector actually ingested.
 *
 * An empty Brief is the correct state for a deployment that has ingested
 * nothing. The UI already handles it: every surface below has an empty state.
 */
const INITIAL_OBJECTS: BriefObject[] = [];

/**
 * Maps a server object row onto the client's BriefObject.
 *
 * Written as an explicit field-by-field adapter rather than a cast because
 * the two shapes genuinely differ: the server carries `verificationStatus`
 * and a nullable `category`, the client carries `isVerified` and a required
 * one. A cast would paper over that and produce `undefined` in the UI.
 *
 * Nothing is invented here. A field the server did not send is left absent,
 * not defaulted to something plausible.
 */
/**
 * A real sparkline from object recency: how many visible things were created
 * per day over the last 8 days, normalised to the sparkline's 0–40 y-range.
 * Derived from `createdAt`, never a stored counter or a hardcoded curve — so a
 * flat or sparse shape is the truth, not a decoration.
 */
function sparkFromObjects(objects: BriefObject[]): string {
  const now = Date.now();
  const days = 8;
  const bins = new Array<number>(days).fill(0);
  for (const o of objects) {
    const t = Date.parse(o.createdAt);
    if (!Number.isFinite(t)) continue;
    const ageDays = (now - t) / 86400000;
    if (ageDays < 0 || ageDays >= days) continue;
    bins[days - 1 - Math.floor(ageDays)] += 1;
  }
  const max = Math.max(1, ...bins);
  return bins
    .map((n, i) => {
      const x = (i / (days - 1)) * 64;
      const y = 40 - (n / max) * 36;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const objectFromServer = (row: any): BriefObject => {
  // Preserve the server's metadata (which now carries coarse lat/lng), and fold
  // in the geo-scoped distance the server computed when a location was given.
  // Without this, the ranked feed drops `distanceKm` on arrival and the map /
  // proximity rail can never populate from real data.
  const meta = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
  if (typeof row?.distanceKm === 'number' && Number.isFinite(row.distanceKm)) {
    meta.distanceKm = row.distanceKm;
  }
  return {
  id: String(row?.id ?? ''),
  type: (row?.type ?? 'knowledge') as ObjectType,
  title: String(row?.title ?? 'Untitled'),
  // The server may hold no category. "Uncategorised" is a statement of
  // absence, not a guessed classification.
  category: row?.category ? String(row.category) : 'Uncategorised',
  summary: String(row?.summary ?? ''),
  locationName: row?.locationName ?? undefined,
  isVerified: row?.verificationStatus === 'verified',
  lastVerifiedAt: row?.lastVerifiedAt ?? undefined,
  validityWindowDays: row?.validityWindowDays ?? undefined,
  sourceType: row?.provenance?.[0]?.platform ?? undefined,
  sourceUrl: row?.sourceUrl ?? row?.provenance?.[0]?.sourceUrl ?? undefined,
  sourceId: row?.provenance?.[0]?.sourceId ?? undefined,
  metadata: Object.keys(meta).length > 0 ? meta : undefined,
  createdAt: String(row?.createdAt ?? new Date().toISOString()),
  // Feed projections expose media/action as nested public fields; keep the
  // first-party detail view compatible without reintroducing private fields.
  imageUrl:
    row?.imageUrl ??
    row?.media?.url ??
    ((row?.imageReference || row?.media?.reference) && row?.id
      ? briefApi.mediaFileUrl(`/api/media/telegram/${String(row?.id)}`)
      : undefined),
  // Indexed gallery images resolve like the cover (server-side Telegram
  // resolution at /api/media/telegram/:id/:index, or direct web URLs).
  gallery: Array.isArray(row?.gallery) && row.gallery.length > 0
    ? row.gallery
        .map((g: any) => {
          const url = typeof g?.url === 'string' ? g.url : null;
          if (!url) return null;
          return {
            url,
            alt: typeof g?.alt === 'string' ? g.alt : undefined,
            attribution: g?.attribution ?? null
          };
        })
        .filter(Boolean)
    : undefined,
  publishedAt: typeof row?.publishedAt === 'string' ? row.publishedAt : undefined,
  temporal: row?.temporal && typeof row.temporal === 'object' ? row.temporal : undefined,
  sourceNames: Array.isArray(row?.sourceNames) ? row.sourceNames.filter((s: unknown) => typeof s === 'string') : undefined,
  sourceCount: Number.isInteger(row?.sourceCount) ? row.sourceCount : undefined,
  actionUrl: row?.actionUrl ?? row?.action?.url ?? undefined,
  actionType: row?.actionType ?? row?.action?.type ?? undefined,
  actionLabel: row?.actionLabel ?? row?.action?.label ?? undefined,
  testContent: row?.testContent && typeof row.testContent === 'object'
    ? {
        label: String(row.testContent.label ?? 'Test preview'),
        expiresAt: typeof row.testContent.expiresAt === 'string' ? row.testContent.expiresAt : null
      }
    : undefined,

  // Relationships the server actually recorded. `/api/objects` returns these
  // as {verb, targetId, target}; the client models the same edges as typed
  // id fields, so the known verbs are mapped across and anything else falls
  // into relatedObjectIds rather than being dropped.
  //
  // Without this the relationship rails could never populate from real data:
  // the edges existed server-side and were being discarded on arrival.
  ...relationshipsFromServer(row?.relationships)
  };
};

/** Server relationship verbs -> the client's typed relationship fields. */
const RELATIONSHIP_VERBS: Record<string, 'locationObjectId' | 'parentObjectId' | 'providerObjectId'> = {
  located_at: 'locationObjectId',
  appears_at: 'locationObjectId',
  part_of: 'parentObjectId',
  offered_by: 'providerObjectId',
  provided_by: 'providerObjectId'
};

const relationshipsFromServer = (
  rels: any
): Pick<BriefObject, 'locationObjectId' | 'parentObjectId' | 'providerObjectId' | 'relatedObjectIds'> => {
  if (!Array.isArray(rels) || rels.length === 0) return {};

  const out: ReturnType<typeof relationshipsFromServer> = {};
  const related: string[] = [];

  for (const rel of rels) {
    const targetId = typeof rel?.targetId === 'string' ? rel.targetId : null;
    if (!targetId) continue;

    const field = RELATIONSHIP_VERBS[String(rel?.verb ?? '')];
    if (field) {
      // First one wins: an object has one location, one parent, one provider.
      if (!out[field]) out[field] = targetId;
    } else if (!related.includes(targetId)) {
      related.push(targetId);
    }
  }

  if (related.length > 0) out.relatedObjectIds = related;
  return out;
};

/**
 * Pulse carries no seeded posts.
 *
 * This was 147 lines of invented neighbourhood chatter presented as real
 * local reporting. Brief has no post ingestion pipeline, so the honest state
 * is empty and the Pulse surfaces say so.
 */
const INITIAL_POSTS: BriefPost[] = [];

/**
 * No seeded journeys. Workflows are user-created; there is no server journey
 * model yet, so Brief starts with none rather than pretending the user is
 * midway through a licence application they never began.
 */
const INITIAL_JOURNEYS: Journey[] = [];


export const getObjectTypeMeta = (type: ObjectType) => {
  switch (type) {
    case 'place': return { label: 'Place', icon: <MapPin className="w-3.5 h-3.5" /> };
    case 'identity': return { label: 'Identity', icon: <Building2 className="w-3.5 h-3.5" /> };
    case 'experience': return { label: 'Experience', icon: <Users className="w-3.5 h-3.5" /> };
    case 'opportunity': return { label: 'Opportunity', icon: <Briefcase className="w-3.5 h-3.5" /> };
    case 'product': return { label: 'Product', icon: <Store className="w-3.5 h-3.5" /> };
    case 'service': return { label: 'Service', icon: <ShieldCheck className="w-3.5 h-3.5" /> };
    case 'knowledge': return { label: 'Knowledge', icon: <Newspaper className="w-3.5 h-3.5" /> };
    case 'community': return { label: 'Community', icon: <Users className="w-3.5 h-3.5" /> };
    case 'document': return { label: 'Document', icon: <Tag className="w-3.5 h-3.5" /> };
    case 'conversation': return { label: 'Conversation', icon: <MessageCircle className="w-3.5 h-3.5" /> };
    case 'business': return { label: 'Business', icon: <Building2 className="w-3.5 h-3.5" /> };
    case 'offer': return { label: 'Offer', icon: <BadgePercent className="w-3.5 h-3.5" /> };
    case 'alert': return { label: 'Alert', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    case 'announcement': return { label: 'Announcement', icon: <Megaphone className="w-3.5 h-3.5" /> };
    case 'news': return { label: 'News', icon: <Globe className="w-3.5 h-3.5" /> };
    default: return { label: 'Object', icon: <Sparkles className="w-3.5 h-3.5" /> };
  }
};

// ============================================================================
// 3. MAIN COMPONENT
// ============================================================================
/**
 * Reads the campaign slug out of the URL. Brief has no router, and adding one
 * for a single public route would be a larger change than the feature. A
 * pathname check is the smallest thing that works.
 */
export function campaignSlugFromPath(pathname: string): string | null {
  const m = /^\/c\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
  return m ? m[1] : null;
}

/**
 * Renders a ticket code as a QR for display at the gate. The code IS the
 * scannable value; any QR reader recovers the same string.
 */
function PublicTicketQr({ code, size = 128 }: { code: string; size?: number }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    QRCode.toDataURL(code, { width: size, margin: 1, color: { dark: '#251045', light: '#FBFAFD' } })
      .then((u) => { if (live) setDataUrl(u); })
      .catch(() => { if (live) setDataUrl(null); });
    return () => { live = false; };
  }, [code, size]);
  if (!dataUrl) return <div className="w-28 h-28 bg-[#F1EDF7] border border-[#D6CFE4] rounded-lg" />;
  return <img src={dataUrl} alt={`Ticket ${code}`} className="w-28 h-28 rounded-lg" />;
}

/** The public page's own share actions, built from the URL the viewer is on. */
function PublicShareRow({ title, description }: { title: string; description: string }) {
  const [copied, setCopied] = useState(false);
  // The viewer is ON the public page, so window.location.href is the canonical
  // link to share (no fabricated origin).
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = `${title} — ${description}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable: no-op */ }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <a href={wa} target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBFAFD] text-[#251045] text-[10px] font-extrabold border border-[#D6CFE4]">
        <MessageCircle className="w-3 h-3" /> WhatsApp
      </a>
      <a href={tg} target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBFAFD] text-[#251045] text-[10px] font-extrabold border border-[#D6CFE4]">
        <ExternalLink className="w-3 h-3" /> Telegram
      </a>
      <button onClick={copy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBFAFD] text-[#251045] text-[10px] font-extrabold border border-[#D6CFE4] cursor-pointer">
        <Share2 className="w-3 h-3" /> {copied ? 'Copied' : 'Copy link'}
      </button>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBFAFD] text-[#251045]/40 text-[10px] border border-[#D6CFE4]" title="Scan to open">
        <ExternalLink className="w-3 h-3" /> QR
      </span>
    </div>
  );
}

/**
 * PUBLIC CAMPAIGN PAGE
 *
 * The page a stranger lands on from a shared link. It talks ONLY to the
 * public endpoints, which return an allow-listed projection: no owner, no
 * internal ids, no roster, no analytics. Nothing is hidden client-side,
 * because nothing private is ever fetched.
 */
export function PublicCampaignPage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<{
    status: 'loading' | 'ready' | 'error';
    data: ApiPublicCampaign | null;
    error: string | null;
  }>({ status: 'loading', data: null, error: null });

  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { status: string; ticketCode?: string | null }>(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  // Contribution pots (T3): the supporter states what they are putting in.
  const [amount, setAmount] = useState('');
  // Updates feed: the organiser's own words, read from the public route.
  const [updates, setUpdates] = useState<briefApi.CampaignUpdatePost[] | null>(null);

  React.useEffect(() => {
    let live = true;
    setUpdates(null);
    void briefApi.getCampaignUpdatesBySlug(slug).then((res) => {
      if (live) setUpdates(res.ok ? res.data : []);
    });
    return () => { live = false; };
  }, [slug, load.data?.registered]);

  const fetchCampaign = React.useCallback(async () => {
    setLoad({ status: 'loading', data: null, error: null });
    const res = await briefApi.getPublicCampaign(slug);
    if (res.ok) setLoad({ status: 'ready', data: res.data, error: null });
    else
      setLoad({
        status: 'error',
        data: null,
        error: res.status === 404 ? 'This campaign is not available.' : res.error
      });
  }, [slug]);

  React.useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const submit = async () => {
    setBusy(true);
    setRegError(null);
    const attendeeRef =
      contact.trim() !== '' ? contact.trim() : `guest-${Math.random().toString(36).slice(2, 10)}`;
    const trackingHash = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('trackingHash') ?? undefined
      : undefined;
    const res = await briefApi.registerForCampaign(slug, {
      attendeeRef,
      name: name.trim() === '' ? undefined : name.trim(),
      contact: contact.trim() === '' ? undefined : contact.trim(),
      trackingHash,
      // Pots only: a whole-shillings amount the supporter states themselves.
      // The server refuses it on fixed-price events.
      amount: amount.trim() ? Number(amount) : undefined
    });
    setBusy(false);
    if (!res.ok) {
      // The backend owns these outcomes: full, closed, already registered.
      // The page relays the reason rather than guessing at one.
      setRegError(res.error);
      // Capacity may have moved underneath us, so re-read the truth.
      fetchCampaign();
      return;
    }
    setDone({ status: res.data.registration.status, ticketCode: res.data.registration.ticketCode ?? null });
    setLoad({ status: 'ready', data: res.data.campaign, error: null });
  };

  const joinWaitlist = async () => {
    setWaitlistBusy(true);
    setWaitlistMessage(null);
    const attendeeRef = contact.trim() !== '' ? contact.trim() : `guest-${Math.random().toString(36).slice(2, 10)}`;
    const res = await briefApi.joinCampaignWaitlist(slug, {
      attendeeRef,
      name: name.trim() === '' ? undefined : name.trim(),
      contact: contact.trim() === '' ? undefined : contact.trim()
    });
    setWaitlistBusy(false);
    if (!res.ok) {
      setWaitlistMessage(res.error);
      return;
    }
    setWaitlistMessage(`Wait list position ${res.data.position ?? res.data.entry?.position ?? 'saved'}.`);
  };

  const c = load.data;

  return (
    <div className="min-h-screen bg-[#D8D2E1] text-[#251045] font-sans selection:bg-[#5B2EA6] selection:text-[#FFFFFF] flex flex-col">
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="9" fill="var(--signal-live)" opacity="0.15" />
            <circle cx="13" cy="13" r="4" fill="var(--signal-live)" />
          </svg>
        </div>

        {load.status === 'loading' && (
          <p className="text-xs text-[#251045]/60 py-12 text-center">Loading...</p>
        )}

        {load.status === 'error' && (
          <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-2xl p-5 space-y-2">
            <p className="text-sm font-extrabold text-[#251045]">{load.error}</p>
            <button
              onClick={fetchCampaign}
              className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {load.status === 'ready' && c && (
          <>
            <div className="space-y-2">
              <p className="text-[9px] text-[#251045]">
                {c.type}
              </p>
              <h1 className="text-2xl font-extrabold leading-tight">{c.title}</h1>
              {c.creator && (
                <p className="text-[11px] text-[#251045] font-extrabold">by {c.creator}</p>
              )}
              {c.description && (
                <p className="text-xs text-[#251045]/60 leading-relaxed">{c.description}</p>
              )}
            </div>

            {/* Contribution pot (T3): a goal, stated amounts, settled-only
                progress, and contributors as a COUNT. Nobody is listed. */}
            {c.goalAmount != null && (
              <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#251045]/50">
                    Contribution pot
                  </p>
                  {c.endsAt && (
                    <p className="text-[10px] text-[#251045]/60">
                      {Date.parse(c.endsAt) <= Date.now()
                        ? 'Deadline passed'
                        : `Open until ${c.endsAt.slice(0, 10)}`}
                    </p>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--ground)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round(((c.raised ?? 0) / c.goalAmount) * 100))}%`,
                      background: 'var(--signal-live)'
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-[#251045]">
                    {c.currency} {(c.raised ?? 0).toLocaleString()} of {c.goalAmount.toLocaleString()}
                  </span>
                  <span className="text-[#251045]/60">
                    {(c.contributors ?? 0)} contribution{(c.contributors ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-[9px] leading-snug text-[#251045]/50">
                  Progress counts SETTLED money only — a pledge that has not settled is not raised.
                  Contributors are counted, never listed.
                </p>
              </div>
            )}

            {/* Updates (T3): the organiser's posts, newest first. */}
            {updates !== null && updates.length > 0 && (
              <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#251045]/50">
                  Updates
                </p>
                {updates.map((u) => (
                  <div key={u.id} className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-extrabold text-[#251045]">{u.title}</p>
                      <p className="shrink-0 text-[9px] text-[#251045]/40">{u.createdAt.slice(0, 10)}</p>
                    </div>
                    <p className="text-[11px] leading-snug text-[#251045]/60">{u.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
              {c.startsAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                  <span className="text-xs text-[#251045]">
                    {c.startsAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              )}
              {c.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                  <span className="text-xs text-[#251045]">{c.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                <span className="text-xs text-[#251045]">
                  {c.price === 0 ? 'Free' : `${c.currency} ${c.price.toLocaleString()}`}
                </span>
              </div>
              {c.remaining !== null && (
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                  <span className="text-xs text-[#251045]">
                    {c.soldOut ? 'Full' : `${c.remaining} spots left`}
                  </span>
                </div>
              )}
              {c.registered > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                  <span className="text-xs text-[#251045]">
                    {c.registered} {c.registered === 1 ? 'person' : 'people'} registered
                  </span>
                </div>
              )}
              {c.capacity !== null && c.remaining !== null && c.capacity > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#251045]/60">Spots filled</span>
                    <span className="font-mono-live text-[#251045]">
                      {c.capacity - c.remaining} / {c.capacity}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--ground)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round(((c.capacity - c.remaining) / c.capacity) * 100))}%`,
                        background: 'var(--signal-live)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <PublicShareRow title={c.title} description={c.description} />

            {done && (
              <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#251045] shrink-0" />
                  <p className="text-sm font-extrabold text-[#251045]">
                    {done.status === 'started' ? "You have a spot held" : "You're registered"}
                  </p>
                </div>
                <p className="text-[11px] text-[#251045]/60 leading-snug">
                  {done.status === 'started'
                    ? 'Your spot is held. It is confirmed once payment is arranged with the organiser.'
                    : 'The organiser can see you on their list.'}
                </p>
                {done.ticketCode && (
                  <div className="flex items-center gap-3 pt-1">
                    <PublicTicketQr code={done.ticketCode} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[9px] text-[#251045]/40">Your ticket</p>
                      <p className="text-[11px] text-[#251045] break-all select-all">{done.ticketCode}</p>
                      <p className="text-[10px] text-[#251045]/40 leading-snug">Show this code at the gate.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!done && (c.status === 'closed' || c.status === 'completed' || c.status === 'cancelled') && (
              <div className="border border-[#D6CFE4] rounded-2xl p-5">
                <p className="text-sm font-extrabold text-[#251045]/60">
                  Registration is closed.
                </p>
              </div>
            )}

            {!done && c.soldOut && c.status !== 'closed' && c.status !== 'cancelled' && (
              <div className="border border-[#D6CFE4] rounded-2xl p-5 space-y-3">
                <p className="text-sm font-extrabold text-[#251045]">This one is full.</p>
                <div className="space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full bg-[#FBFAFD] text-[#251045] text-sm rounded-xl px-3 py-3 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                  />
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Phone or email"
                    className="w-full bg-[#FBFAFD] text-[#251045] text-sm rounded-xl px-3 py-3 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                  />
                  <button
                    disabled={waitlistBusy}
                    onClick={joinWaitlist}
                    className="w-full py-3 rounded-xl border border-[#6C3EC9] text-[#251045] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                  >
                    {waitlistBusy ? 'Saving...' : 'Join wait list'}
                  </button>
                  {waitlistMessage && <p className="text-[10px] text-[#251045]/60">{waitlistMessage}</p>}
                </div>
              </div>
            )}

            {!done &&
              !c.soldOut &&
              (c.status === 'published' || c.status === 'live') && (
                <div className="space-y-3">
                  {regError && (
                    <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-xl p-3">
                      <p className="text-[11px] text-[#251045] break-words">{regError}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">
                      Your name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-sm rounded-xl px-3 py-3 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">
                      Phone or email
                    </label>
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="So the organiser can reach you"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-sm rounded-xl px-3 py-3 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  {/* Pots (T3): the supporter states a whole-shillings amount.
                      Fixed-price events never show this — the price is the price. */}
                  {c.goalAmount != null && (
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">
                        Your contribution ({c.currency})
                      </label>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        inputMode="numeric"
                        placeholder="Whole shillings you are putting in"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-sm rounded-xl px-3 py-3 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                      <p className="mt-1 text-[9px] text-[#251045]/40 leading-snug">
                        State what you are putting in. It counts toward the pot once the money
                        settles; contributors are counted, never listed.
                      </p>
                    </div>
                  )}
                  <button
                    disabled={busy || (c.goalAmount != null && !Number(amount))}
                    onClick={submit}
                    className="w-full py-4 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-sm cursor-pointer disabled:opacity-40"
                  >
                    {busy
                      ? 'Registering...'
                      : c.goalAmount != null
                      ? `Contribute${amount.trim() ? ` ${c.currency} ${Number(amount).toLocaleString()}` : ''}`
                      : c.price === 0
                      ? 'Register'
                      : `Register - ${c.currency} ${c.price.toLocaleString()}`}
                  </button>
                  {(c.price > 0 || c.goalAmount != null) && (
                    <p className="text-[10px] text-[#251045]/40 leading-snug text-center">
                      No online payment is connected yet. Your spot is held and you
                      arrange payment with the organiser.
                    </p>
                  )}
                </div>
              )}

            {/* Commerce only inside context: this event's own resale seats.
                Holders list seats they cannot use; buying here holds the seat
                at the listed price while money is settled with the seller. */}
            {load.status === 'ready' && <EventResale slug={c.slug} />}
          </>
        )}
      </div>

      <footer className="border-t border-[#D6CFE4] py-6 text-[10px] text-[#251045]/40 text-center">
        Brief
      </footer>
    </div>
  );
}

export function App() {
  // Public campaign links open the public page, not the app shell. Checked
  // once at render: a stranger with a link is not a Brief user.
  const publicSlug =
    typeof window !== 'undefined' && window.location
      ? campaignSlugFromPath(window.location.pathname)
      : null;
  const [objects, setObjects] = useState<BriefObject[]>(INITIAL_OBJECTS);
  const [journeys, setJourneys] = useState<Journey[]>(INITIAL_JOURNEYS);
  // Derived, never stored. Nothing can set a civic metric by hand.
  // My Activity starts empty. The two seeded relationships claimed the user
  // had "discovered" and "engaged with" specific objects they had never seen
  // -- a fabricated claim about the person using Brief, and one that pointed
  // at seed objects that no longer exist. Relationships are created by real
  // interaction from here on.
  const [relationships, setRelationships] = useState<ObjectRelationship[]>([]);

  const [posts] = useState<BriefPost[]>(INITIAL_POSTS);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [activeEdition, setActiveEdition] = useState<TeaEdition>(() =>
    getCurrentEdition()
  );

  const [activeTab, setActiveTab] = useState<Destination>(bootRoute.dest);
  const [homeFeedStatus, setHomeFeedStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [nearbySection, setNearbySection] = useState<NearbySection>(bootRoute.nearby);
  // The discovery experience navigation: Home, Events, Explore, Offers,
  // Places, News, Opportunities. Categories only appear when the real data
  // has meaningful rows for them.
  const [discoveryTab, setDiscoveryTab] = useState<
    'home' | 'events' | 'explore' | 'offers' | 'places' | 'news' | 'opportunities'
  >('home');
  const [moreFilters, setMoreFilters] = useState<boolean>(false);
  const [myLayerSection, setMyLayerSection] = useState<MyLayerSection>(bootRoute.mylayer);
  const [workflowSection, setWorkflowSection] = useState<WorkflowSection>(bootRoute.workflow);
  // Which bundle each desk is showing is DERIVED from the open section rather
  // than stored: a deep link, a URL change or a notification jump cannot then
  // disagree with the chips, and there is no second source of truth to sync.
  const activeWorkflowBundle = WORKFLOW_BUNDLES.find((b) =>
    (b.sections as readonly string[]).includes(workflowSection)
  ) ?? WORKFLOW_BUNDLES[0];
  const activeSavedBundle = SAVED_BUNDLES.find((b) =>
    (b.sections as readonly string[]).includes(myLayerSection)
  ) ?? SAVED_BUNDLES[0];
  // 'queue' is the landing view: one list of everything waiting on you. A tool
  // is only one tap deeper, filed under the bundle it belongs to.
  const [workflowView, setWorkflowView] = useState<'queue' | 'screen'>(
    bootRoute.workflow !== 'active' ? 'screen' : 'queue'
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // The offline queue drains itself the moment the browser says the signal is
  // back. Server-side idempotency keys make a double-flush harmless.
  React.useEffect(() => {
    const flush = () => { void briefApi.flushOfflineQueue(); };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<briefApi.AuthedUser | null>(null);

  // --- Onboarding & the service ladder ---------------------------------------
  // The ladder is DERIVED server-side from real rows; the client only holds
  // the answer and decides where it may be shown. Null means "not loaded",
  // which every ladder helper reads as "nothing is locked" — an outage must
  // never turn into a product that refuses to open.
  const [authProviders, setAuthProviders] = useState<briefApi.AuthProviders | null>(null);
  const [onboardingState, setOnboardingState] = useState<briefApi.OnboardingState | null>(null);
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const [nextStepHidden, setNextStepHidden] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const arrivalChannel: ArrivalChannel = React.useMemo(
    () =>
      typeof window === 'undefined'
        ? 'browser'
        : arrivalSource(window.location.href, window.navigator?.userAgent ?? ''),
    []
  );
  const ladder = onboardingState?.ladder ?? null;

  /** Report a step that leaves no server row of its own. Never blocks the UI. */
  const noteActivation = React.useCallback(
    (name: briefApi.ActivationEventName, meta: Record<string, unknown> = {}) => {
      void briefApi.recordActivation(name, meta).then((res) => {
        if (res.ok) {
          setOnboardingState((prev) => (prev ? { ...prev, ladder: res.data.ladder } : prev));
        }
      });
    },
    []
  );
  const [dockOn, setDockOn] = useState(true);
  const dockLastY = React.useRef(0);

  // --- Ingestion backend (real connectors) ---------------------------------
  // The client holds no tokens. It talks to the ingestion server, which owns
  // every secret. When the server is not running these panels degrade to an
  // explicit "not connected" state rather than pretending. The proxy prefix
  // lives in src/api/briefApi.ts, which is the only place that fetches.
  const [connectorStatus, setConnectorStatus] = useState<{
    online: boolean;
    checked: boolean;
    capabilities: Record<string, any> | null;
    liveSources: any[];
    stats: Record<string, any> | null;
  }>({ online: false, checked: false, capabilities: null, liveSources: [], stats: null });
  const [briefItText, setBriefItText] = useState('');
  const [briefItPreview, setBriefItPreview] = useState<any>(null);
  const [briefItBusy, setBriefItBusy] = useState(false);
  const [briefItSaved, setBriefItSaved] = useState<string | null>(null);

  const refreshConnectors = React.useCallback(async () => {
    // Everything goes through briefApi: one API layer, one set of response
    // guards, no fetch() outside src/api (spec 4). Capabilities/status that
    // fail their shape guard degrade to null exactly as before.
    const [srcRes, capRes, statRes] = await Promise.all([
      briefApi.getSources(),
      briefApi.getConnectorCapabilities(),
      briefApi.getIngestStatus()
    ]);

    if (!srcRes.ok) {
      // A dead connector server must never break Brief (spec 30).
      setConnectorStatus((prev) => ({ ...prev, online: false, checked: true }));
      return;
    }

    setConnectorStatus({
      online: true,
      checked: true,
      capabilities: capRes.ok ? capRes.data : null,
      liveSources: srcRes.data,
      stats: statRes.ok ? statRes.data : null
    });
  }, []);

  React.useEffect(() => {
    // Connector state (capabilities + live stats) backs both the Sources tab
    // AND the Actions dashboard's pipeline/ingest cards, so refresh it for any
    // workflows view — not just Sources.
    if (activeTab === 'workflows') {
      void refreshConnectors();
    }
  }, [activeTab, workflowSection, refreshConnectors]);

  // --- Objects from the server ----------------------------------------------
  // Brief holds no seeded objects. Everything discoverable arrives from the
  // ingestion pipeline, so this is the only way the stream gets populated.
  // A failure leaves the list empty and records why, rather than substituting
  // placeholder content.
  const [objectsLoad, setObjectsLoad] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
  }>({ status: 'idle', error: null });

  // --- Session bootstrap -----------------------------------------------------
  // In production the development auth fallback is off and there is no login
  // screen, which made every write (capture, brief-it, confirm) return 401.
  // This silently provisions a real, persisted local account on first run so
  // the whole product is exercisable on the deployed site — a genuine account
  // with a real server session, not a fake. A returning device logs back in.
  /**
   * A device-only account.
   *
   * This used to run silently on every first boot, which meant the very first
   * thing Brief did for a new person was invent an anonymous identity they
   * could never move to another phone. It is now an explicit choice on the
   * first screen: "just look around on this device". Still a real server
   * account with a real session — just one with no email attached to it.
   */
  const provisionGuest = React.useCallback(async (): Promise<briefApi.AuthedUser | null> => {
    let handle = '';
    try { handle = window.localStorage.getItem('brief_local_handle') ?? ''; } catch { /* private mode */ }
    if (!handle) {
      handle = 'local' + Math.random().toString(36).slice(2, 10);
      try { window.localStorage.setItem('brief_local_handle', handle); } catch { /* private mode */ }
    }
    const password = 'brief-local-pass';
    const reg = await briefApi.register(handle, password, 'Local');
    if (reg.ok) {
      setSessionUser(reg.data);
      return reg.data;
    }
    // Handle already exists from a prior visit: log back in.
    const logged = await briefApi.login(handle, password);
    if (logged.ok) {
      setSessionUser(logged.data);
      return logged.data;
    }
    return null;
  }, []);

  const bootstrapSession = React.useCallback(async () => {
    // Inside a Telegram Mini App, the user's real identity is the signed
    // initData — bind it to a Brief account rather than minting an anonymous
    // local identity. Telegram is a DOOR, not a requirement: nobody outside
    // the Mini App is ever asked for it.
    if (briefApi.isTelegramMiniApp()) {
      const tg = (window as any)?.Telegram?.WebApp;
      try {
        tg?.ready?.();
        tg?.expand?.();
      } catch { /* SDK not fully loaded */ }
      const init = await briefApi.telegramInit(String(tg.initData));
      if (init.ok) {
        setSessionUser(init.data);
        setSessionChecked(true);
        return;
      }
      // initData rejected (stale/bad) — fall through to the ordinary path so
      // the app still renders, just without the Telegram identity.
    }

    // Arrived from a link that already knows who this is.
    //
    // The honest version of "the in-app browser identifies the email": the
    // link carries a token THIS server signed for that address, and the server
    // re-verifies the signature before it means anything. A bare ?email= in a
    // URL is not an identity and is ignored. Nothing here reads a device
    // account — no browser exposes that.
    const linkToken = typeof window === 'undefined' ? null : linkTokenFrom(window.location.href);
    if (linkToken) {
      const viaLink = await briefApi.continueFromLinkToken(linkToken, arrivalChannel);
      if (viaLink.ok) {
        setSessionUser(viaLink.data);
        setSessionChecked(true);
        // Burn the parameter so a reload or a forwarded URL cannot replay it.
        try {
          window.history.replaceState({}, '', urlWithoutArrivalParams(window.location.href));
        } catch { /* history blocked */ }
        return;
      }
    }

    const me = await briefApi.whoAmI();
    if (me.ok) {
      setSessionUser(me.data);
      setSessionChecked(true);
      return;
    }
    // 401 means the server wants a real identity. It no longer gets one
    // invented for it: the first-run flow opens and the person chooses
    // Google, a handle, or a device-only account.
    setSessionChecked(true);
    if (me.status === 401) setFirstRunOpen(true);
  }, [arrivalChannel]);

  React.useEffect(() => { void bootstrapSession(); }, [bootstrapSession]);

  // What this deployment may honestly offer on the sign-in screen.
  React.useEffect(() => {
    void briefApi.getAuthProviders().then((res) => {
      if (res.ok) setAuthProviders(res.data);
    });
  }, []);

  // Onboarding state + ladder follow the session. Signed out, there is
  // nothing to load and nothing to lock.
  const refreshOnboarding = React.useCallback(async () => {
    if (!sessionUser) return;
    const res = await briefApi.getOnboarding();
    if (res.ok) setOnboardingState(res.data);
  }, [sessionUser]);

  React.useEffect(() => { void refreshOnboarding(); }, [refreshOnboarding]);

  // The ladder card renders on the Home stream, and its rungs are derived
  // server-side from REAL rows — a saved object, a confirmed one. Those rows
  // change while the app is open, so the ladder is re-read from the server
  // every time Home comes back into view. getLadder() is exactly that half:
  // the ladder alone, without dragging onboarding state along with it.
  React.useEffect(() => {
    if (!sessionUser) return;
    if (activeTab !== 'nearby') return;
    void briefApi.getLadder().then((res) => {
      if (res.ok) {
        setOnboardingState((prev) => (prev ? { ...prev, ladder: res.data } : prev));
      }
    });
  }, [sessionUser, activeTab]);

  // Seeing a populated feed is the moment Brief has shown its point. Recorded
  // once per session, and only when real rows actually arrived.
  const feedSeenRef = React.useRef(false);
  React.useEffect(() => {
    if (feedSeenRef.current) return;
    if (!sessionUser || homeFeedStatus !== 'ready') return;
    feedSeenRef.current = true;
    noteActivation('feed_seen', {});
  }, [sessionUser, homeFeedStatus, noteActivation]);

  // Attribute the visit to the link that produced it, once, when it was not
  // an ordinary browser.
  React.useEffect(() => {
    if (!sessionUser || arrivalChannel === 'browser') return;
    void briefApi.setOnboardingSource(arrivalChannel);
  }, [sessionUser, arrivalChannel]);

  // Open the first run only when there is a real reason to: no session, or a
  // session that has never answered the one question and never skipped it.
  React.useEffect(() => {
    if (!sessionChecked) return;
    if (firstRunOpen) return;
    if (!sessionUser) return;
    if (!onboardingState) return;
    if (
      shouldOpenFirstRun({
        signedIn: true,
        goal: onboardingState.profile?.goal,
        finishedAt: onboardingState.profile?.finishedAt,
        skippedAt: onboardingState.profile?.skippedAt
      })
    ) {
      setFirstRunOpen(true);
    }
  }, [sessionChecked, sessionUser, onboardingState, firstRunOpen]);

  // Mobile dock: hide while reading, pull the nub to bring the five tabs back.
  React.useEffect(() => {
    const onScroll = () => {
      const y = typeof window === 'undefined' ? 0 : window.scrollY;
      if (menuOpen || activeTab === 'arena') {
        setDockOn(true);
        dockLastY.current = y;
        return;
      }
      if (y > dockLastY.current + 10 && y > 48) setDockOn(false);
      else if (y < dockLastY.current - 10) setDockOn(true);
      dockLastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen, activeTab]);

  React.useEffect(() => {
    // Menu is a screen: keep the five-tab dock up while it is open.
    if (menuOpen) setDockOn(true);
  }, [menuOpen]);

  // --- Location & geo --------------------------------------------------------
  // A viewer's coarse position, for "what's around me". Set only by an
  // explicit device-location grant or a manual city tap — never inferred,
  // never fabricated. Null means "everywhere" (the global ranked feed).
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  // A named locality scope for the discovery feed (a city or district tap).
  // Null means the feed is geo- or globally scoped, never inferred.
  const [feedArea, setFeedArea] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const locate = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocError('This browser has no location service — tap a city instead.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'your location'
        });
        // A precise device fix scopes the feed by distance; it is not a
        // named area.
        setFeedArea(null);
        setSelectedLocation('your location');
      },
      () => {
        setLocating(false);
        setLocError('Location unavailable — tap a city instead.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  const chooseCity = React.useCallback((c: GeoPoint) => {
    setLocError(null);
    setUserLocation(c);
    // Named places scope the discovery feed by area (county/area matching),
    // which is far more precise for districts than a raw point + radius.
    setFeedArea(c.area ?? null);
    setSelectedLocation(c.label);
  }, []);

  const clearLocation = React.useCallback(() => {
    setLocError(null);
    setUserLocation(null);
    setFeedArea(null);
    setSelectedLocation('Your area');
  }, []);

  const loadObjects = React.useCallback(async (loc?: { lat: number; lng: number }) => {
    setObjectsLoad({ status: 'loading', error: null });
    // The ranked discovery feed: freshness + trust + engagement, server-derived.
    // When a location is set, it is also geo-scoped (distanceKm per object).
    const res = await briefApi.discoverObjects(loc ? { lat: loc.lat, lng: loc.lng, radiusKm: 40 } : {});
    if (res.ok) {
      setObjects((res.data as any[]).map(objectFromServer));
      setObjectsLoad({ status: 'ready', error: null });
    } else {
      setObjects([]);
      setObjectsLoad({ status: 'error', error: res.error });
    }
  }, []);

  React.useEffect(() => {
    void loadObjects(userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined);
  }, [loadObjects, userLocation]);


  const runBriefItPreview = async () => {
    if (!briefItText.trim()) return;
    setBriefItBusy(true);
    setBriefItSaved(null);
    try {
      const res = await briefApi.previewBriefIt(briefItText);
      setBriefItPreview(res.ok ? res.data : { error: res.error });
    } finally {
      setBriefItBusy(false);
    }
  };

  // Named runBriefItSave, not saveBriefIt: the latter is now the briefApi
  // binding, and shadowing it would be a trap for the next edit.
  const runBriefItSave = async () => {
    setBriefItBusy(true);
    const res = await briefApi.saveBriefIt(briefItText);
    if (res.ok) {
      const result: any = res.data.result;
      setBriefItSaved(
        result?.merged
          ? 'Merged into an object Brief already had.'
          : result?.created
          ? 'Saved to Brief.'
          : result?.reason ?? 'Nothing object-worthy found.'
      );
      setBriefItPreview(null);
      setBriefItText('');
      // A capture is the "contribute" rung. The server also sees the manual
      // source membership this creates; the event just timestamps the moment.
      if (result?.created || result?.merged) noteActivation('capture_saved', {});
      void refreshConnectors();
      void loadObjects();
    } else {
      setBriefItSaved(res.error);
    }
    setBriefItBusy(false);
  };

  // Both navs call this, so selecting a destination behaves identically on
  // desktop and mobile: you land on that destination's main section.
  // --- Destination activity alerts (the red dots on the sidebar titles) ------
  // Derived ONLY from real data: unread notifications (routed by kind) plus
  // public feed items / EPL rooms newer than the last time this viewer
  // opened that destination. First visit baselines silently; unreachable
  // services contribute zero. Never a decorative dot.
  const [destinationAlerts, setDestinationAlerts] = useState<DestinationAlerts>({ nearby: 0, arena: 0, mylayer: 0, workflows: 0 });
  const alertsTick = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    const derive = async () => {
      const tick = ++alertsTick.current;
      const [notifRes, roomsRes, feedRes] = await Promise.all([
        briefApi.getNotifications(true).catch(() => null),
        briefApi.listEplRooms().catch(() => null),
        briefApi.getPublicFeed({}).catch(() => null)
      ]);
      if (cancelled || tick !== alertsTick.current) return;
      const feed = (feedRes && feedRes.ok ? feedRes.data?.feed : null) ?? null;
      const feedItems = feed
        ? [
            ...(Array.isArray(feed.hero) ? feed.hero : []),
            ...(Array.isArray(feed.discovery) ? feed.discovery : []),
            ...(Array.isArray(feed.opportunities) ? feed.opportunities : []),
            ...(Array.isArray(feed.more) ? feed.more : []),
            ...(Array.isArray(feed.moreTea) ? feed.moreTea : []),
            ...(feed.tea ? [feed.tea] : [])
          ]
        : [];
      const lastSeen = {
        nearby: readLastSeen('nearby'),
        arena: readLastSeen('arena')
      };
      setDestinationAlerts(deriveDestinationAlerts({
        notifications: notifRes && notifRes.ok ? notifRes.data?.notifications ?? [] : null,
        rooms: roomsRes && roomsRes.ok ? roomsRes.data ?? [] : null,
        feedItems,
        lastSeen
      }));
    };
    void derive();
    const interval = window.setInterval(() => { void derive(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void derive(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const goToDestination = (id: Destination) => {
    setMenuOpen(false);
    // Opening a destination is the user SEEING it: baseline its freshness
    // clock and drop the dot immediately (notifications keep their own
    // unread state until read on the activity surface).
    writeLastSeen(id, Date.now());
    setDestinationAlerts((prev) => (prev[id] === 0 ? prev : { ...prev, [id]: 0 }));
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setOpenCampaignId(null);
    setSelectedObjectForDetailRaw(null);
    setPendingObjectId(null);
    setActiveTab(id);
    if (id === 'nearby') setNearbySection('stream');
    if (id === 'mylayer') setMyLayerSection('saved');
    if (id === 'workflows') {
      setWorkflowSection('active');
      setWorkflowView('queue');
    }
    if (id === 'arena') setArenaSection('lobby');
  };
  const [selectedObjectType, setSelectedObjectType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('Your area');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pursuitDraft, setPursuitDraft] = useState<string>('');
  const [architectMode, setArchitectMode] = useState<boolean>(false);
  // Seen tracking for the Daily Brief: "New" means genuinely not yet opened.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const [selectedObjectForDetail, setSelectedObjectForDetailRaw] = useState<BriefObject | null>(null);
  const [selectedTeaSlug, setSelectedTeaSlug] = useState<string | null>(bootRoute.teaSlug);
  const [pendingObjectId, setPendingObjectId] = useState<string | null>(bootRoute.objectId);

  // Opening an object marks it seen, which is what keeps the Daily Brief's
  // "New" section honest instead of showing the same items forever.
  const setSelectedObjectForDetail = (object: BriefObject | null) => {
    setSelectedObjectForDetailRaw(object);
    setPendingObjectId(object ? object.id : null);
    if (object) {
      setSeenIds((prev) => {
        if (prev.has(object.id)) return prev;
        const next = new Set(prev);
        next.add(object.id);
        return next;
      });
    }
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // The spring-animated empty-state overlay ("Nothing to do here?"). Opened by
  // an explicit trigger so it never covers content unprompted; the physics is
  // the same springIntro curve the design system specifies.
  const [springOverlayOpen, setSpringOverlayOpen] = useState<boolean>(false);
  const [feedReload, setFeedReload] = useState(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ==========================================================================
  // CAMPAIGNS (Creator Campaign Desk)
  //
  // A campaign is a distribution wrapper over an existing Brief object, so
  // this is a VIEW over the backend, not a second product. Everything shown
  // here -- counts, capacity, money -- arrives from the server on each load.
  // There is deliberately no local mutation of any metric: the only way a
  // number changes is a refetch. That is what keeps `82 / 100` honest.
  // ==========================================================================

  // Canonical public origin, from the server. Null until loaded, and null
  // when the deployment has not configured one -- in which case the UI says
  // so instead of inventing a URL from the current browser host.
  const [publicOrigin, setPublicOrigin] = useState<string | null>(null);
  const [runtimeCheck, setRuntimeCheck] = useState<'checking' | 'current' | 'old' | 'unavailable'>('checking');

  // A lightweight release handshake prevents an older API from looking like a
  // broken button later. Old deployments still return the original config, so
  // a missing contract version is a clear "update before testing" signal.
  useEffect(() => {
    let live = true;
    Promise.all([briefApi.getConfig(), briefApi.getRelease()]).then(([config, release]) => {
      if (!live) return;
      if (config.ok) setPublicOrigin(config.data.publicOrigin);
      if (release.ok) {
        setRuntimeCheck(release.data.apiContractVersion === briefApi.CLIENT_API_CONTRACT ? 'current' : 'old');
      } else {
        // A 200 config + missing release endpoint is an older server. If both
        // probes fail, this is connectivity rather than a version mismatch.
        setRuntimeCheck(config.ok ? 'old' : 'unavailable');
      }
    });
    return () => { live = false; };
  }, []);

  const [campaignState, setCampaignState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCampaign[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [openCampaignId, setOpenCampaignId] = useState<string | null>(bootRoute.campaignId);
  const [campaignDetail, setCampaignDetail] = useState<ApiCampaign | null>(null);
  const [campaignRegs, setCampaignRegs] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiRegistration[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [campaignBusy, setCampaignBusy] = useState<boolean>(false);
  const [campaignActionError, setCampaignActionError] = useState<string | null>(null);

  // Create flow. `preview` is a screen, not a stored object: nothing is sent
  // to the server between 'form' and the user pressing Publish.
  const [createStep, setCreateStep] = useState<'closed' | 'form' | 'preview' | 'published'>('closed');
  const [draft, setDraft] = useState<{
    title: string;
    type: ApiCampaignType;
    description: string;
    location: string;
    startsAt: string;
    capacity: string;
    price: string;
    circleId: string;
  }>({
    title: '',
    type: 'popup',
    description: '',
    location: '',
    startsAt: '',
    capacity: '',
    price: '',
    circleId: ''
  });
  const [publishedCampaign, setPublishedCampaign] = useState<ApiCampaign | null>(null);

  // Attachable existing objects. Loaded only when the creator asks, because
  // most campaigns are something new and the list is noise until it is wanted.
  const [objectPicker, setObjectPicker] = useState<{
    open: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: any[] | null;
    error: string | null;
    selected: { id: string; title: string } | null;
  }>({ open: false, status: 'idle', data: null, error: null, selected: null });

  const loadAttachableObjects = async () => {
    setObjectPicker((p) => ({ ...p, open: true, status: 'loading', error: null }));
    const res = await briefApi.getObjects();
    if (res.ok) {
      setObjectPicker((p) => ({ ...p, status: 'ready', data: res.data, error: null }));
    } else {
      setObjectPicker((p) => ({ ...p, status: 'error', data: null, error: res.error }));
    }
  };

  // Editing an existing draft. Separate from `draft` (the create flow) so a
  // half-finished new campaign is never confused with an edit in progress.
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    location: string;
    startsAt: string;
    price: string;
    capacity: string;
  } | null>(null);

  // The Circle a campaign is attached to, if any. Read separately because the
  // campaign row carries only `circleId`; the target's progress lives on the
  // Circle and is derived there from settled transactions.
  const [campaignCircle, setCampaignCircle] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCircleDetail | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const loadCampaigns = async () => {
    setCampaignState((prev) => ({ ...prev, status: 'loading', error: null }));
    // Config is read alongside the list so share links are correct as soon as
    // a campaign can be shared. A failure here is not fatal: publicOrigin
    // stays null and the share UI reports that honestly.
    briefApi.getConfig().then((c) => {
      if (c.ok) setPublicOrigin(c.data.publicOrigin);
    });
    const res = await briefApi.getCampaigns();
    if (res.ok) {
      setCampaignState({ status: 'ready', data: res.data, error: null });
    } else {
      // No fallback to seeded data. An unreachable server means we say so.
      setCampaignState({ status: 'error', data: null, error: res.error });
    }
  };

  const openCampaign = async (id: string) => {
    setOpenCampaignId(id);
    setCampaignDetail(null);
    setCampaignActionError(null);
    setCampaignRegs({ status: 'loading', data: null, error: null });
    const [detail, regs] = await Promise.all([
      briefApi.getCampaign(id),
      briefApi.getCampaignRegistrations(id)
    ]);
    if (detail.ok) setCampaignDetail(detail.data);
    else setCampaignActionError(detail.error);
    if (regs.ok) setCampaignRegs({ status: 'ready', data: regs.data, error: null });
    else setCampaignRegs({ status: 'error', data: null, error: regs.error });

    // A campaign may be attached to a Circle carrying a Target. The target's
    // progress is derived on the server from settled transactions -- this only
    // reads it. Nothing here writes progress.
    if (detail.ok && detail.data.circleId) {
      setCampaignCircle({ status: 'loading', data: null, error: null });
      const circle = await briefApi.getCircle(detail.data.circleId);
      if (circle.ok) setCampaignCircle({ status: 'ready', data: circle.data, error: null });
      else setCampaignCircle({ status: 'error', data: null, error: circle.error });
    } else {
      setCampaignCircle({ status: 'idle', data: null, error: null });
    }
  };

  /**
   * Save an edit to a draft. Only the fields the server declares writable are
   * sent. Capacity is included only while the campaign is still a draft,
   * because the backend rejects it after publication.
   */
/**
   * Attach an existing Brief item to a campaign that already exists.
   *
   * The backend has supported this since Phase 7B (PATCH objectId, authorised
   * by the caller's existing access to the item's source) but nothing in the
   * UI reached it -- an item could only be linked at create time. Reuses the
   * same picker as the create flow; adds no new primitive and copies no
   * object data.
   */
  const attachObjectToCampaign = async (campaignId: string, objectId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const res = await briefApi.updateCampaign(campaignId, { objectId });
    setCampaignBusy(false);
    setObjectPicker((p) => ({ ...p, open: false, selected: null }));
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    await openCampaign(campaignId);
    showToast('Item linked');
  };

  const saveCampaignEdit = async (campaign: ApiCampaign) => {
    if (!editDraft) return;
    setCampaignBusy(true);
    setCampaignActionError(null);
    const price = editDraft.price.trim() === '' ? 0 : Number(editDraft.price);
    const capacity = editDraft.capacity.trim() === '' ? null : Number(editDraft.capacity);
    const res = await briefApi.updateCampaign(campaign.id, {
      title: editDraft.title.trim(),
      description: editDraft.description.trim(),
      location: editDraft.location.trim() === '' ? null : editDraft.location.trim(),
      startsAt: editDraft.startsAt.trim() === '' ? null : editDraft.startsAt.trim(),
      price: Number.isFinite(price) ? price : 0,
      ...(campaign.status === 'draft'
        ? { capacity: capacity !== null && Number.isFinite(capacity) ? capacity : null }
        : {})
    });
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    setCampaignDetail(res.data);
    setEditDraft(null);
    loadCampaigns();
    showToast('Saved');
  };

  const handleRemoveCampaign = async (campaignId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    try {
      const allCampaigns = campaignState.data ?? [];
      const c = allCampaigns.find((x) => x.id === campaignId) || campaignDetail;
      if (c && c.status !== 'cancelled' && c.status !== 'closed') {
        try { await briefApi.campaignAction(campaignId, 'cancel'); } catch {}
      }
      await briefApi.deleteCampaign(campaignId);
      setCampaignState((prev) => ({
        ...prev,
        data: (prev.data ?? []).filter((item) => item.id !== campaignId)
      }));
      if (c?.objectId) {
        setObjects((prev) => prev.filter((o) => o.id !== c.objectId));
      }
      setOpenCampaignId(null);
      setCampaignDetail(null);
      setEditDraft(null);
      showToast('Event removed.');
      void loadCampaigns();
      void loadObjects();
    } catch (e: any) {
      setCampaignActionError(String(e.message || e));
    } finally {
      setCampaignBusy(false);
    }
  };

  const beginEdit = (c: ApiCampaign) => {
    setCampaignActionError(null);
    setEditDraft({
      title: c.title,
      description: c.description,
      location: c.location ?? '',
      startsAt: c.startsAt ? c.startsAt.slice(0, 16) : '',
      price: c.price === 0 ? '' : String(c.price),
      capacity: c.capacity === null ? '' : String(c.capacity)
    });
  };

  /** Share uses the platform sheet where it exists, clipboard otherwise. */
  const shareCampaign = async (campaign: ApiCampaign) => {
    const link = briefApi.campaignShareLink(campaign.publicSlug, publicOrigin);
    if (!link.available) {
      showToast('No public link configured yet');
      return;
    }
    briefApi.shareCampaign(campaign.id, 'native');
    const url = link.url;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: campaign.title, url });
        return;
      } catch {
        // User dismissed the sheet, or the browser refused. Fall through to
        // copy rather than reporting a failure they did not cause.
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(url);
        showToast('Link copied');
        return;
      } catch {
        // fall through
      }
    }
    showToast(url);
  };

  const copyCampaignLink = async (slug: string, campaignId?: string) => {
    const link = briefApi.campaignShareLink(slug, publicOrigin);
    if (!link.available) {
      showToast('No public link configured yet');
      return;
    }
    if (campaignId) briefApi.shareCampaign(campaignId, 'link');
    const url = link.url;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(url);
        showToast('Link copied');
        return;
      } catch {
        // fall through
      }
    }
    showToast(url);
  };

  const submitDraft = async () => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const capacity = draft.capacity.trim() === '' ? null : Number(draft.capacity);
    const price = draft.price.trim() === '' ? 0 : Number(draft.price);
    const res = await briefApi.createCampaign({
      title: draft.title.trim(),
      type: draft.type,
      description: draft.description.trim(),
      location: draft.location.trim() === '' ? null : draft.location.trim(),
      startsAt: draft.startsAt.trim() === '' ? null : draft.startsAt.trim(),
      capacity: capacity !== null && Number.isFinite(capacity) ? capacity : null,
      price: Number.isFinite(price) ? price : 0,
      circleId: draft.circleId === '' ? null : draft.circleId,
      // Attach an existing item when one was chosen. The server checks
      // authority and refuses if the creator may not use it.
      objectId: objectPicker.selected ? objectPicker.selected.id : null
    });
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return null;
    }
    return res.data;
  };

  /**
   * Publish goes through the real transition endpoint. If the server refuses
   * the transition the campaign stays a draft on screen: there is no local
   * `status = 'live'` anywhere in this file.
   */
  const publishDraft = async () => {
    const created = await submitDraft();
    if (!created) return;
    setCampaignBusy(true);
    const res = await briefApi.campaignAction(created.id, 'publish');
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    setPublishedCampaign(res.data);
    setCreateStep('published');
    loadCampaigns();
  };

  /**
   * The organiser confirms money actually arrived for a held spot.
   *
   * This does NOT set a registration status from the client. The server
   * creates a real transaction, settles it through the ordinary ledger state
   * machine, and promotes the registration off that settled row. The UI then
   * refetches rather than optimistically patching, so what is displayed is
   * always what the server derived.
   */
  const confirmPayment = async (campaignId: string, registrationId: string) => {
    setCampaignBusy(true);
    setCampaignActionError(null);
    const res = await briefApi.confirmRegistrationPayment(campaignId, registrationId);
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    await openCampaign(campaignId);
    showToast('Payment confirmed');
  };

  // --- T3: the organiser authors updates the public page shows -------------
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  const postUpdate = async (campaignId: string) => {
    if (!updateTitle.trim() || !updateBody.trim() || updateBusy) return;
    setUpdateBusy(true);
    setUpdateNote(null);
    const res = await briefApi.postCampaignUpdate(campaignId, {
      title: updateTitle.trim(),
      body: updateBody.trim()
    });
    setUpdateBusy(false);
    if (!res.ok) {
      setUpdateNote(res.error);
      return;
    }
    setUpdateTitle('');
    setUpdateBody('');
    setUpdateNote('Posted. It is on the public page now.');
  };

  const setRegStatus = async (
    campaignId: string,
    registrationId: string,
    status: 'checked_in' | 'no_show'
  ) => {
    setCampaignBusy(true);
    const res = await briefApi.setRegistrationStatus(campaignId, registrationId, status);
    setCampaignBusy(false);
    if (!res.ok) {
      setCampaignActionError(res.error);
      return;
    }
    // Refetch instead of patching state: the metrics block must move with it.
    openCampaign(campaignId);
  };

  const campaignsLive = (campaignState.data ?? []).filter(
    (c) => c.status === 'published' || c.status === 'live'
  );
  const campaignsDraft = (campaignState.data ?? []).filter((c) => c.status === 'draft');
  const campaignsPast = (campaignState.data ?? []).filter(
    (c) => c.status === 'closed' || c.status === 'completed' || c.status === 'cancelled'
  );

  // Card button. Uses the same resolver as the detail view so a given label
  // means the same thing in both places. Anything without a real destination
  // opens the detail view rather than dead-ending.
  const handlePrimaryAction = (object: BriefObject) => {
    const action = resolveAction(object);

    switch (action.kind) {
      case 'external':
      case 'map':
        window.open(action.href, '_blank', 'noopener,noreferrer');
        handleExecuteProtocolAction('discover', object, { silent: true });
        return;

      case 'phone':
        window.location.href = action.href;
        handleExecuteProtocolAction('contact', object, { silent: true });
        return;

      default:
        setSelectedObjectForDetail(object);
    }
  };

  // Primary action from INSIDE the detail view: retarget the stream at this
  // object's type. A navigation decision, never a simulated transaction.
  const handlePivotToType = (object: BriefObject) => {
    const others = objects.filter(
      (item) => item.type === object.type && item.id !== object.id
    ).length;

    setSelectedObjectType(object.type);
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('stream');
    setSelectedObjectForDetail(null);
    handleExecuteProtocolAction('discover', object, { silent: true });
    showToast(getPivotMessage(object, others));
  };

  const handleExecuteProtocolAction = (
    action: ProtocolAction,
    object: BriefObject,
    options?: { silent?: boolean }
  ) => {
    let nextState: FlowState = 'engaged';
    let verb = 'interacted_with';

    if (action === 'book' || action === 'contact' || action === 'buy') {
      nextState = 'committed';
      verb = action === 'book' ? 'booked' : action === 'buy' ? 'bought' : 'contacted';
    } else if (action === 'save') {
      nextState = 'engaged';
      verb = 'saved';
    }

    // The aha moment, reported once it has actually happened. "saved" is the
    // activation event Brief measures itself on; opening is the step before it.
    if (action === 'save') noteActivation('object_saved', { objectId: object.id, type: object.type });
    else if (action === 'discover' || action === 'read') noteActivation('object_opened', { objectId: object.id });

    setRelationships(prev => {
      const existingIdx = prev.findIndex(r => r.targetId === object.id);
      const newEdge: ObjectRelationship = {
        id: `rel_${Date.now()}`,
        sourceType: 'identity',
        sourceId: 'usr_me',
        verb,
        targetType: object.type,
        targetId: object.id,
        state: nextState,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newEdge;
        return updated;
      }
      return [...prev, newEdge];
    });

    const actionLabels: Record<ProtocolAction, string> = {
      discover: 'Opened',
      read: 'Opened',
      save: 'Saved',
      share: 'Shared',
      contact: 'Contact started',
      book: 'Booking',
      buy: 'Purchase',
      report: 'Reported',
      verify: 'Verification started',
      follow: 'Following',
    };

    // Callers that show their own message suppress this one.
    if (!options?.silent) {
      showToast(`${actionLabels[action]} "${object.title}".`);
    }
  };

  const getRelatedObjects = (object: BriefObject): ScoredRelation[] => {
    const explicit = new Set(
      [
        object.parentObjectId,
        object.providerObjectId,
        object.locationObjectId,
        ...(object.relatedObjectIds ?? [])
      ].filter(Boolean) as string[]
    );

    // Objects that point AT this one are just as meaningful as ones it
    // points to -- a place should surface the vendors located there.
    const inbound = new Set(
      objects
        .filter(
          (item) =>
            item.parentObjectId === object.id ||
            item.providerObjectId === object.id ||
            item.locationObjectId === object.id ||
            (item.relatedObjectIds ?? []).includes(object.id)
        )
        .map((item) => item.id)
    );

    const keywords = getKeywords(object);

    const scored: ScoredRelation[] = objects
      .filter((item) => item.id !== object.id)
      .map((item) => {
        let score = 0;
        let reason: RelationReason = 'similar';

        // 1. Explicit, curated links outrank everything inferred -- and must
        //    do so unconditionally. The inferred signals below (2-8) can sum
        //    to roughly 24, so a flat +20 was not actually a guarantee: a
        //    coincidentally similar object could outrank a real, curated
        //    relationship. EXPLICIT_LINK_FLOOR sits above every reachable
        //    inferred total, so a stated relationship can never be buried by
        //    keyword noise. The smaller per-kind bonus only orders explicit
        //    links against each other.
        if (explicit.has(item.id) || inbound.has(item.id)) {
          const isProvider =
            item.id === object.providerObjectId ||
            item.providerObjectId === object.id;
          const isLocation =
            item.id === object.locationObjectId ||
            item.locationObjectId === object.id;

          score += EXPLICIT_LINK_FLOOR;

          if (isProvider) {
            // Who sells or operates this is the most actionable hop.
            score += 12;
            reason = 'provider';
          } else if (isLocation) {
            score += 8;
            reason = 'location';
          } else {
            score += 4;
            reason = 'linked';
          }
        }

        // 2. Same category.
        if (item.category === object.category) score += 6;

        // 3. Same type.
        if (item.type === object.type) score += 3;

        // 4. Complementary type for this object's errand.
        if (item.type !== object.type && areTypesAffine(object.type, item.type)) {
          score += 2;
          if (reason === 'similar') reason = 'complementary';
        }

        // 5. Shared location text.
        if (item.locationName && object.locationName) {
          const a = item.locationName.toLowerCase();
          const b = object.locationName.toLowerCase();
          if (a.includes(b.split(',')[0]) || b.includes(a.split(',')[0])) {
            score += 4;
            if (reason === 'similar') reason = 'nearby';
          }
        }

        // 6. Same operator / vendor.
        if (
          item.creatorName &&
          object.creatorName &&
          item.creatorName === object.creatorName
        ) {
          score += 4;
          if (reason === 'similar') reason = 'provider';
        }

        // 7. Keyword overlap across title, category and summary.
        const overlap = countKeywordOverlap(keywords, getKeywords(item));
        if (overlap > 0) score += Math.min(overlap, 3);

        // 8. Proximity nudge -- never decisive, only breaks ties.
        const distance = item.metadata?.distanceKm;
        if (distance !== undefined) score += Math.max(0, 2 - distance / 2);

        return { item, score, reason };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // Nothing scored: fall back to the physically closest objects so the
    // rail is never empty. Better a weak neighbour than a dead end.
    if (scored.length === 0) {
      return objects
        .filter((item) => item.id !== object.id)
        .map((item) => ({
          item,
          score: 0,
          reason: 'nearby' as RelationReason,
          distance: item.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
        .map(({ item, score, reason }) => ({ item, score, reason }));
    }

    return scored.slice(0, 4);
  };

  // Discovery ranking (destination rework 16). A destination happening today
  // with vendors in it outranks an old generic listing -- but this is time and
  // vendor density, never popularity. Only applied to the unfiltered browse:
  // once the user types a query, relevance wins.
  const rankForDiscovery = (list: BriefObject[]): BriefObject[] => {
    const weight = (obj: BriefObject): number => {
      if (!isDestinationObject(obj)) return 0;
      const state = getDestinationState(obj);
      const vendors = getDestinationVendors(obj, objects).length;
      let score = 0;
      if (state === 'live') score += 40;
      else if (state === 'today') score += 30;
      else if (state === 'upcoming') score += 15;
      else if (state === 'ended') return 0;
      score += Math.min(vendors, 6) * 4;
      if (obj.isVerified) score += 3;
      const km = obj.metadata?.distanceKm;
      if (typeof km === 'number' && km <= 2) score += 4;
      return score;
    };
    return [...list].sort((a, b) => weight(b) - weight(a));
  };

  const filteredObjects = useMemo(() => {
    const byType = objects.filter(
      (obj) => selectedObjectType === 'all' || obj.type === selectedObjectType
    );

    const query = searchQuery.trim().toLowerCase();
    if (query === '') return rankForDiscovery(byType);

    // Weighted match: exact title beats title prefix beats category/type,
    // which beat a summary-only hit. Ties fall back to proximity.
    // Uses the same scorer as pursuit matching -- one brain, so a phrase
    // ranks identically whether typed here or saved as a Pursuit.
    return byType
      .map((obj) => ({ obj, score: scoreObjectForPhrase(obj, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const da = a.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.obj.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .map(({ obj }) => obj);
  }, [objects, selectedObjectType, searchQuery]);

  // STEP 4 My Layer: saved objects grouped by type, derived from the existing
  // relationships state. No parallel data structure.
  const savedObjects = useMemo(
    () =>
      objects.filter((obj) =>
        relationships.some(
          (rel) => rel.targetId === obj.id && rel.verb === 'saved'
        )
      ),
    [objects, relationships]
  );

  const savedGroups = useMemo(() => {
    const order: { type: ObjectType; label: string }[] = [
      { type: 'place', label: 'Places' },
      { type: 'service', label: 'Services' },
      { type: 'opportunity', label: 'Opportunities' },
      { type: 'product', label: 'Products' },
      { type: 'experience', label: 'Events' },
      { type: 'knowledge', label: 'Information' },
      { type: 'identity', label: 'Organisations' },
      { type: 'business', label: 'Businesses' },
      { type: 'offer', label: 'Offers' },
      { type: 'news', label: 'News' },
      { type: 'alert', label: 'Alerts' },
      { type: 'announcement', label: 'Announcements' }
    ];

    return order
      .map(({ type, label }) => ({
        label,
        items: savedObjects.filter((obj) => obj.type === type)
      }))
      .filter(({ items }) => items.length > 0);
  }, [savedObjects]);

  // One graph instance over the live state. Components ask it questions
  // instead of re-deriving relationship rules inline.
  const graph = useMemo(
    () => createBriefGraph(objects, relationships),
    [objects, relationships]
  );

  const watchedIds = useMemo(
    () => new Set(relationships.filter((r) => r.verb === 'watched').map((r) => r.targetId)),
    [relationships]
  );

  // Watch (prompt 21): records intent to monitor. No polling, no fake alerts --
  // diffObjects is the engine this will drive once ingestion supplies a second
  // version of a record.
  // --- §8 verify / report: the crowd-checking half of object trust ----------
  // "I was there" (confirm) and "this is wrong" (report) had server routes
  // and no buttons. Both hit the real endpoints; both show the server's own
  // answer or refusal.
  const [objectCheckBusy, setObjectCheckBusy] = useState<string | null>(null);
  const [reportForObject, setReportForObject] = useState<string | null>(null);

  const handleConfirmObject = async (object: BriefObject) => {
    setObjectCheckBusy(object.id);
    const res = await briefApi.confirmObject(object.id);
    setObjectCheckBusy(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not record your confirmation.');
      return;
    }
    showToast(`Confirmed — ${res.data.confirmationCount} confirmation${res.data.confirmationCount === 1 ? '' : 's'} on record.`);
    await loadObjects();
  };

  const handleReportObject = async (object: BriefObject, reason: string) => {
    setObjectCheckBusy(object.id);
    const res = await briefApi.reportObject(object.id, reason);
    setObjectCheckBusy(null);
    setReportForObject(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not record your report.');
      return;
    }
    showToast('Reported. A moderator sees it; the record stays up until then.');
  };

  const handleToggleWatch = (object: BriefObject) => {
    const isWatching = watchedIds.has(object.id);

    setRelationships((prev) => {
      if (isWatching) {
        return prev.filter(
          (r) => !(r.targetId === object.id && r.verb === 'watched')
        );
      }
      return [
        ...prev,
        {
          id: `rel_watch_${object.id}`,
          sourceType: 'identity' as ObjectType,
          sourceId: 'usr_me',
          verb: 'watched',
          targetType: object.type,
          targetId: object.id,
          state: 'engaged' as FlowState,
          updatedAt: new Date().toISOString()
        }
      ];
    });

    showToast(
      isWatching
        ? `Stopped watching ${object.title}`
        : `Watching ${object.title} for changes`
    );
  };

  // Optional personal label on an existing saved edge (prompt 10).
  const handleSetSaveLabel = (object: BriefObject, label: SaveLabel) => {
    setRelationships((prev) =>
      prev.map((r) =>
        r.targetId === object.id && r.verb === 'saved'
          ? { ...r, label: r.label === label ? undefined : label, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  // Share (prompt 11): a plain, honest text payload. Web Share when the
  // browser offers it, clipboard otherwise. No invented links, no marketing.
  const handleShare = async (object: BriefObject) => {
    const action = resolveAction(object);
    const origin = publicOrigin || (typeof window !== 'undefined' ? window.location.origin : null);
    const shareUrl = objectShareUrl(origin, object.id);
    const lines = [
      object.title,
      object.category,
      object.locationName ? `Location: ${object.locationName}` : null,
      action.kind !== 'none' ? `Action: ${action.label}` : null,
      shareUrl ? shareUrl : null,
      !shareUrl && object.sourceUrl ? `Source: ${object.sourceUrl}` : null
    ].filter(Boolean) as string[];

    const payload = lines.join('\n');
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string; url?: string }) => Promise<void>;
    };

    try {
      if (typeof nav.share === 'function') {
        await nav.share({ title: object.title, text: payload, url: shareUrl ?? undefined });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        showToast(shareUrl ? 'Link copied' : 'Copied to clipboard');
        return;
      }
      showToast('Sharing unavailable on this device');
    } catch {
      // A user dismissing the share sheet is not an error worth shouting about.
    }
  };

  // --- Pursuits --------------------------------------------------------------
  // Standing intents. Matching is recomputed from live objects rather than
  // stored, so a pursuit created before an object was ingested picks it up the
  // moment that object exists.
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);

  const pursuitResults = useMemo(() => {
    const map: Record<string, PursuitMatch[]> = {};
    for (const pursuit of pursuits) {
      map[pursuit.id] =
        pursuit.status === 'active' || pursuit.status === 'paused'
          ? matchPursuit(pursuit, objects)
          : [];
    }
    return map;
  }, [pursuits, objects]);

  const handleCreatePursuit = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (query === '') return;

    const existing = pursuits.find(
      (p) => p.query.toLowerCase() === query.toLowerCase()
    );
    if (existing) {
      setActiveTab('nearby');
      setNearbySection('pursuits');
      showToast('Already pursuing this');
      return;
    }

    const pursuit = createPursuit(query, new Date().toISOString());
    setPursuits((prev) => [pursuit, ...prev]);
    // Handing a query to Brief means you are done typing it. Leaving it in the
    // search box would strand the stream on an empty result set.
    setSearchQuery('');
    setActiveTab('nearby');
    setNearbySection('pursuits');
    showToast(
      pursuit.watchChanges
        ? `Watching: ${pursuit.query}`
        : `Pursuing: ${pursuit.query}`
    );
  };

  const handleSetPursuitStatus = (id: string, status: PursuitStatus) => {
    setPursuits((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status, lastUpdatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleTogglePursuitWatch = (id: string) => {
    setPursuits((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              watchChanges: !p.watchChanges,
              lastUpdatedAt: new Date().toISOString()
            }
          : p
      )
    );
  };

  const handleTogglePursuitCondition = (id: string, condition: WatchCondition) => {
    setPursuits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const current = p.watchConditions ?? [];
        return {
          ...p,
          watchConditions: current.includes(condition)
            ? current.filter((c) => c !== condition)
            : [...current, condition],
          lastUpdatedAt: new Date().toISOString()
        };
      })
    );
  };

  const handleRemovePursuit = (id: string) => {
    setPursuits((prev) => prev.filter((p) => p.id !== id));
    showToast('Pursuit removed');
  };

  // --- Ingestion review state ------------------------------------------------
  // Candidates are parsed on demand and held here. They are NOT objects: until
  // a reviewer accepts one, nothing reaches the graph, search, or My Layer.
  const [candidates, setCandidates] = useState<IngestionCandidate[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, CandidateStatus>>({});

  // Pulls the real inbound queue: messages as they actually arrived from
  // connected sources. Brief ships with no sample traffic, so on a system with
  // nothing connected this correctly finds nothing -- "no new messages" is a
  // true report about an empty queue, not a UI that failed to load.
  const [inboundBusy, setInboundBusy] = useState(false);

  const handleReceiveInbound = async () => {
    setInboundBusy(true);
    // Only unprocessed messages: anything already turned into an object is not
    // waiting on a reviewer, and re-parsing it would invite a duplicate.
    //
    // Sources are fetched alongside them because a message's channel and
    // label live on its source row. Reusing whatever happened to be cached
    // would mean provenance renders only if the user had visited the Sources
    // panel first -- so a draft would silently lose its origin.
    const [res, srcRes] = await Promise.all([
      briefApi.getRawItems({ status: 'pending' }),
      briefApi.getSources()
    ]);
    setInboundBusy(false);

    if (!res.ok) {
      showToast(`Could not reach the inbox: ${res.error}`);
      return;
    }

    const knownSources: any[] = srcRes.ok ? srcRes.data : connectorStatus.liveSources;

    const known = new Set(candidates.map((c) => c.message.id));
    const CHANNELS: SourceType[] = ['telegram', 'whatsapp', 'web', 'rss', 'api', 'manual'];
    const sourceFor = (sourceId: string) =>
      knownSources.find((s: any) => s?.id === sourceId) ?? null;
    const labelFor = (sourceId: string) => sourceFor(sourceId)?.name ?? sourceId;
    // The channel is whatever the source says it is. An unrecognised platform
    // falls back to 'manual' rather than being guessed into a specific network.
    const channelFor = (sourceId: string): SourceType => {
      const raw = sourceFor(sourceId);
      const claimed = (raw?.platform ?? raw?.type ?? '').toLowerCase();
      return CHANNELS.find((c) => c === claimed) ?? 'manual';
    };

    const fresh = res.data
      .filter((item) => !known.has(item.id))
      .map((item) =>
        parseInboundMessage(
          {
            id: item.id,
            channel: channelFor(item.sourceId),
            sourceId: item.sourceId,
            sourceLabel: labelFor(item.sourceId),
            text: item.text,
            receivedAt: item.publishedAt ?? item.retrievedAt ?? item.createdAt ?? new Date().toISOString(),
            sourceUrl: item.rawUrl ?? undefined
          },
          objects
        )
      );

    if (fresh.length === 0) {
      showToast('No new messages');
      return;
    }

    setCandidates((prev) => [...prev, ...fresh]);
    showToast(`${fresh.length} message(s) parsed for review`);
  };

  // Accepting is the ONLY path from message to object, and it is manual.
  const handleAcceptCandidate = (candidate: IngestionCandidate) => {
    const accepted: BriefObject = { ...candidate.draft };

    // Apply suggested links only on acceptance -- a reviewer confirming the
    // parse is what makes a proposed edge real.
    for (const link of candidate.suggestedLinks) {
      if (link.relation === 'locationObjectId' && !accepted.locationObjectId) {
        accepted.locationObjectId = link.objectId;
      } else if (link.relation === 'relatedObjectIds') {
        accepted.relatedObjectIds = [
          ...(accepted.relatedObjectIds ?? []),
          link.objectId
        ];
      }
    }

    setObjects((prev) => [accepted, ...prev]);
    setReviewed((prev) => ({ ...prev, [candidate.id]: 'accepted' }));
    showToast(`Published: ${accepted.title.slice(0, 40)}`);
  };

  const handleRejectCandidate = (candidate: IngestionCandidate) => {
    setReviewed((prev) => ({ ...prev, [candidate.id]: 'rejected' }));
    showToast('Discarded');
  };

  // --- Group intelligence layer ----------------------------------------------
  // Access state is live: revoking a group must immediately remove it and its
  // information, which is why groups are state rather than a constant.
  const [groups, setGroups] = useState<ConnectedSource[]>(ALL_GROUPS);
  // --- Connected sources ----------------------------------------------------
  // The groups Brief may read. Derived from the server's source rows: a
  // source with a granted membership is one the user is in, anything else is
  // only readable if it is public. Access is never assumed.
  React.useEffect(() => {
    if (!connectorStatus.online) return;
    setGroups(
      connectorStatus.liveSources
        .filter((src: any) =>
          src?.platform === 'telegram' || src?.platform === 'whatsapp')
        .map((src: any): ConnectedSource => ({
          id: src.id,
          name: src.name,
          platform: src.platform === 'telegram' ? 'telegram' : 'whatsapp',
          description: src.description ?? undefined,
          // A membership row is the only thing that proves access. Without
          // one, a private group is not readable and says so.
          access:
            src.membership?.accessGranted
              ? 'member'
              : src.accessType === 'public'
              ? 'authorised'
              : 'pending',
          // Author retention is the group's decision. The server does not
          // model it yet, so Brief assumes the privacy-preserving answer.
          retainAuthors: false,
          lastActivityAt: src.lastMessageAt ?? undefined
        }))
    );
  }, [connectorStatus.online, connectorStatus.liveSources]);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // The ONLY list any part of the UI may iterate. Everything else is invisible.
  const visibleGroups = useMemo(
    () => groups.filter(canUserAccessGroup),
    [groups]
  );

  // Indexes are built per accessible group. An inaccessible group yields an
  // empty index by construction, so there is nothing to leak.
  const groupIndexes = useMemo(() => {
    const map: Record<string, GroupKnowledgeEntry[]> = {};
    for (const group of visibleGroups) {
      map[group.id] = buildGroupIndex(GROUP_MESSAGES, group);
    }
    return map;
  }, [visibleGroups]);

  const openGroup = useMemo(
    () => visibleGroups.find((g) => g.id === openGroupId) ?? null,
    [visibleGroups, openGroupId]
  );

  const groupIndex = useMemo(
    () => (openGroup ? groupIndexes[openGroup.id] ?? [] : []),
    [openGroup, groupIndexes]
  );

  const unansweredQuestions = useMemo(
    () => getUnansweredQuestions(groupIndex),
    [groupIndex]
  );

  const handleRevokeGroup = (id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, access: 'revoked' as GroupAccess } : g))
    );
    if (openGroupId === id) setOpenGroupId(null);
    showToast('Access revoked. Brief will stop reading this group.');
  };

  // Saving keeps the group record intact and points back at it. Brief does not
  // claim authorship of anything a member wrote.
  const handleSaveGroupEntry = (entry: GroupKnowledgeEntry) => {
    const group = visibleGroups.find((g) => g.id === entry.groupId);
    if (!group || !group.permissions?.canRetain) {
      showToast('This group does not allow saving.');
      return;
    }
    setSavedGroupEntryIds((prev) =>
      prev.includes(entry.id) ? prev : [...prev, entry.id]
    );
    showToast('Saved with its source.');
  };

  const handleViewSource = (entry: GroupKnowledgeEntry) => {
    const group = visibleGroups.find((g) => g.id === entry.groupId);
    // Brief states where it came from. It does not fabricate a deep link into
    // a platform that may not support one.
    showToast(
      `${entry.source.sourceType} in ${group ? group.name : 'this group'} - ` +
        `${formatSourceDate(entry.source.timestamp)}`
    );
  };

  // --- Participation ---------------------------------------------------------
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [rewards, setRewards] = useState<Reward[]>(REWARD_CATALOGUE);
  const [boardMode, setBoardMode] = useState<'contributors' | 'earners'>('contributors');

  const openQuests = useMemo(
    () => quests.filter((q) => q.status === 'open'),
    [quests]
  );

  // The wallet is derived from settled quests only. Submitted work is visible
  // but deliberately worth nothing until reviewed.
  const myContribution = useMemo(() => summariseContribution(quests), [quests]);
  const myRank = useMemo(() => getBriefRank(myContribution), [myContribution]);
  const nextRank = useMemo(() => getNextRankRequirement(myContribution), [myContribution]);
  const pendingCount = useMemo(
    () => quests.filter((q) => q.status === 'submitted').length,
    [quests]
  );

  const handleSubmitQuest = (quest: Quest) => {
    setQuests((prev) =>
      prev.map((q) =>
        q.id === quest.id
          ? { ...q, status: 'submitted' as QuestStatus, submittedAt: new Date().toISOString() }
          : q
      )
    );
    // Deliberately does NOT say "you earned N points".
    showToast('Submitted for review. Points settle only if accepted.');
  };

  const handleRedeem = (reward: Reward) => {
    const gate = canRedeem(reward, {
      settledPoints: myContribution.settledPoints,
      region: 'Nairobi'
    });
    if (!gate.allowed) {
      showToast(gate.reason);
      return;
    }
    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, remaining: r.remaining - 1 } : r))
    );
    showToast(`Claimed. ${reward.providerName} will honour this reward.`);
  };

  // --- Arena -----------------------------------------------------------------
  // Who the viewer is in Arena. Their own challenges are theirs to manage,
  // not to accept.
  const CURRENT_PLAYER_ID = sessionUser?.id ?? '';
  const [arenaGameId, setArenaGameId] = useState<ArenaGameId>('efootball');
  const [arenaBusyId, setArenaBusyId] = useState<string | null>(null);
  const [openedTournament, setOpenedTournament] = useState<any | null>(null);
  const [openedStanding, setOpenedStanding] = useState<any | null>(null);
  // The secondary game screen. null = closed; set to a game id to open the
  // match-setup surface behind a shelf tile.
  const [arenaOpenGame, setArenaOpenGame] = useState<ArenaGameId | null>(null);
  const [playAsConfirmed, setPlayAsConfirmed] = useState(false);
  const [myGameTag, setMyGameTag] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [availabilityOn, setAvailabilityOn] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

  React.useEffect(() => {
    if (!sessionUser) return;
    let live = true;
    (async () => {
      const [me, tags] = await Promise.all([
        briefApi.getPersonMe(),
        briefApi.getMyArenaPlayers()
      ]);
      if (!live) return;
      if (me.ok) {
        setAvailabilityOn(me.data.availability?.state === 'available');
        const tag = me.data.standing?.gameTags?.find((t) => t.gameId === (CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId));
        if (tag) setMyGameTag(tag.gamerTag);
      }
      if (tags.ok) {
        const mine = (tags.data as any[]).find((p) => p.gameId === (CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId));
        if (mine?.gamerTag) setMyGameTag(String(mine.gamerTag));
      }
    })();
    return () => { live = false; };
  }, [sessionUser, arenaGameId]);
  const [arenaActivity, setArenaActivity] = useState<Record<string, number>>({});
  // Challenges come from the SERVER, not a fixture: a challenge is a real,
  // persisted, attributable record. `ARENA_CHALLENGES` is gone from the state.
  const [challenges, setChallenges] = useState<ArenaChallenge[]>([]);

  // Whether real-money contests are legally available HERE. Fetched from the
  // server rather than hardcoded, because the answer depends on licensing and
  // connected payment rails, not on what the UI would like to show.
  const [arenaMoney, setArenaMoney] = useState<ArenaMoneyStatus | null>(null);
  useEffect(() => {
    briefApi.getArenaMoneyStatus().then((r) => {
      if (r.ok) setArenaMoney(r.data);
    });
  }, []);

  // The eFootball beta is the first controlled Arena test. Its counters are
  // aggregate server projections; a missing response stays visibly unavailable
  // rather than becoming a fabricated zero-population claim.
  const [arenaBetaSummary, setArenaBetaSummary] = useState<ArenaBetaSummary | null>(null);
  const [arenaBetaBusy, setArenaBetaBusy] = useState(false);
  const refreshArenaBeta = React.useCallback(async () => {
    const res = await briefApi.getArenaBeta();
    if (res.ok) setArenaBetaSummary(res.data);
  }, []);
  useEffect(() => { void refreshArenaBeta(); }, [refreshArenaBeta, sessionUser]);

  const handleJoinArenaBeta = async (segment: ArenaBetaSegment) => {
    if (!sessionUser) {
      showToast('Your account is still loading — try again in a moment.');
      return;
    }
    setArenaBetaBusy(true);
    // Preserve a real campaign source when a player arrives from a tagged
    // community/creator link; otherwise record the in-product entry point.
    const acquisitionSource = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_source') ?? 'arena_beta_card'
      : 'arena_beta_card';
    const res = await briefApi.joinArenaBeta({
      segment,
      acquisitionSource
    });
    setArenaBetaBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not save your pilot spot.');
      return;
    }
    await refreshArenaBeta();
    showToast(res.data.reused ? 'You are already on the pilot list.' : 'You are on the pilot list. Add your game tag to play.');
  };

  // Load the real open challenges from the server and map them onto the
  // display model. Server rows use createdBy/acceptedBy; the client model uses
  // createdByPlayerId/acceptedByPlayerId. Everything else (format, points,
  // suggested times) is a client-only convenience that stays absent for real
  // server-backed challenges rather than being invented.
  const refreshArenaChallenges = React.useCallback(async () => {
    const serverGame = CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId;
    const res = await briefApi.getArenaChallenges(serverGame);
    if (!res.ok) return;
    setChallenges(res.data.map((c: any) => ({
      id: String(c.id),
      gameId: (SERVER_TO_CLIENT_GAME[c.gameId] ?? c.gameId) as ArenaGameId,
      mode: String(c.mode ?? '1v1'),
      createdByPlayerId: String(c.createdBy),
      stake: (c.stake ?? 'friendly') as ChallengeStake,
      entryFeeKes: c.entryFeeKes ?? undefined,
      openUntil: c.openUntil,
      status: (c.status ?? 'open') as ChallengeStatus,
      acceptedByPlayerId: c.acceptedBy ? String(c.acceptedBy) : undefined,
      createdAt: c.createdAt
    })));
  }, [arenaGameId]);
  useEffect(() => { void refreshArenaChallenges(); }, [refreshArenaChallenges]);
  const [matches, setMatches] = useState<ArenaMatch[]>([]);

  const mapServerMatch = (m: any): ArenaMatch => ({
    id: String(m.id),
    challengeId: String(m.challengeId ?? ''),
    gameId: (SERVER_TO_CLIENT_GAME[m.gameId] ?? m.gameId) as ArenaGameId,
    playerAId: String(m.playerAId),
    playerBId: String(m.playerBId),
    playerAName: m.playerAName ? String(m.playerAName) : undefined,
    playerBName: m.playerBName ? String(m.playerBName) : undefined,
    playedAt: m.createdAt ?? m.playedAt ?? new Date().toISOString(),
    winnerPlayerId: m.winnerPlayerId ?? undefined,
    scoreLine: m.scoreLine ?? undefined,
    confirmedByA: m.confirmedByA ?? undefined,
    confirmedByB: m.confirmedByB ?? undefined,
    status: m.status,
    reportedBy: m.reportedBy ?? null
  });

  const refreshArenaMatches = React.useCallback(async () => {
    const res = await briefApi.getArenaMatches();
    if (!res.ok) return;
    setMatches(res.data.map(mapServerMatch));
  }, []);
  useEffect(() => { void refreshArenaMatches(); }, [refreshArenaMatches]);

  // Availability is the user's own switch. Defaults to the seeded record and
  // is never flipped on by Brief.
  // Arena entities come from the SERVER — real persisted rows, never a
  // fixture. The fabricated client-side economy (points ledger, gift cards,
  // fake availability/reliability, account listings, venue check-ins) is gone.
  const [arenaPlayers, setArenaPlayers] = useState<any[]>([]);
  const [arenaVenues, setArenaVenues] = useState<any[]>([]);
  const [arenaTournaments, setArenaTournaments] = useState<any[]>([]);
  const [arenaLeaderboard, setArenaLeaderboard] = useState<any[]>([]);

  React.useEffect(() => {
    let live = true;
    (async () => {
      const [p, v, t, g, rooms] = await Promise.all([
        briefApi.getArenaPlayers(),
        briefApi.getArenaVenues(),
        briefApi.getArenaTournaments(),
        briefApi.getArenaGames(),
        briefApi.getLobbyRooms()
      ]);
      if (!live) return;
      if (p.ok) setArenaPlayers(p.data as any[]);
      if (v.ok) setArenaVenues(v.data as any[]);
      if (t.ok) setArenaTournaments(t.data as any[]);
      const counts: Record<string, number> = {};
      const bump = (key: string, n = 1) => {
        const client = SERVER_TO_CLIENT_GAME[key] ?? key;
        counts[client] = (counts[client] ?? 0) + n;
      };
      if (g.ok) {
        for (const [k, val] of Object.entries(g.data.activity ?? {})) {
          if (typeof val !== 'number' || val < 0) continue;
          const client = SERVER_TO_CLIENT_GAME[k] ?? k;
          counts[client] = Math.max(counts[client] ?? 0, val);
        }
      }
      if (rooms.ok) {
        for (const r of rooms.data as any[]) {
          if (!r?.gameId) continue;
          if (r.status === 'started' || r.status === 'closed') continue;
          bump(String(r.gameId), 1);
        }
      }
      setArenaActivity(counts);
    })();
    return () => { live = false; };
  }, []);

  React.useEffect(() => {
    let live = true;
    briefApi.getArenaLeaderboard(arenaGameId).then((r) => {
      if (live && r.ok) setArenaLeaderboard(r.data as any[]);
    });
    return () => { live = false; };
  }, [arenaGameId]);

  const [arenaSection, setArenaSection] = useState<
    'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard'
  >(bootRoute.arena);

  // Challenges addressed to this user, awaiting a decision.
  // Gaming activity detected in groups the user is ALREADY a member of.
  // Runs over the access-checked indexes, so an inaccessible group can never
  // contribute a signal.
  // Workflows secondary is derived from real Journey data, not a new store.

  const activeJourneys = useMemo(() => journeys.filter((j) => !j.isCompleted), [journeys]);
  const completedJourneys = useMemo(() => journeys.filter((j) => j.isCompleted), [journeys]);

  const groupArenaSignals = useMemo(() => {
    const out: { id: string; groupName: string; summary: string; at: string }[] = [];
    for (const group of visibleGroups) {
      const entries = groupIndexes[group.id] ?? [];
      for (const entry of entries) {
        const hit = detectMatchRequest(entry, ARENA_GAMES);
        if (!hit) continue;
        const game = ARENA_GAMES.find((g) => g.id === hit.gameId);
        out.push({
          id: `sig_${entry.id}`,
          groupName: group.name,
          summary: `Someone is looking for a ${game ? game.name : 'game'} match.`,
          at: entry.sentAt
        });
      }
    }
    return out;
  }, [visibleGroups, groupIndexes]);

  const handleChallengePlayer = (targetId: string) => {
    const now = new Date('2026-08-15T10:00:00Z').toISOString();
    const created = createDirectChallenge(
      CURRENT_PLAYER_ID,
      targetId,
      { gameId: arenaGameId, mode: '1v1', proposedTime: 'Tonight' },
      now
    );
    if (!created) {
      showToast('You cannot challenge yourself.');
      return;
    }
    setChallenges((prev) => [...prev, created]);
    showToast('Challenge sent. Waiting for them to accept.');
  };

  const handleRespondToChallenge = (
    challenge: ArenaChallenge,
    response: 'accept' | 'decline' | 'suggest'
  ) => {
    const now = new Date('2026-08-15T10:00:00Z').toISOString();
    if (response === 'decline') {
      setChallenges((prev) =>
        prev.map((c) => (c.id === challenge.id ? declineChallenge(c) : c))
      );
      showToast('Challenge declined.');
      return;
    }
    if (response === 'suggest') {
      setChallenges((prev) =>
        prev.map((c) => (c.id === challenge.id ? suggestChallengeTime(c, 'Tomorrow 20:00') : c))
      );
      showToast('Suggested a different time.');
      return;
    }
    // Duplicate guard: never create a second match for one challenge.
    if (matchExistsForChallenge(matches, challenge.id)) {
      showToast('A match already exists for this challenge.');
      return;
    }
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === challenge.id ? { ...c, status: 'accepted' as ChallengeStatus } : c
      )
    );
    setMatches((prev) => [
      ...prev,
      {
        id: `match_${challenge.id}`,
        challengeId: challenge.id,
        gameId: challenge.gameId,
        playerAId: challenge.createdByPlayerId,
        playerBId: CURRENT_PLAYER_ID,
        playedAt: now
      }
    ]);
    showToast('Challenge accepted. Match created.');
  };

  const arenaGame = useMemo(
    () => ARENA_GAMES.find((g) => g.id === arenaGameId) ?? ARENA_GAMES[0],
    [arenaGameId]
  );

  // The lobby shows open challenges for the selected game only.
  const handleAcceptChallenge = async (challenge: ArenaChallenge) => {
    // Acceptance goes through the SERVER: it creates a real match and marks
    // the challenge accepted, idempotently. A stale challenge is refused by
    // the server rather than optimistically marked accepted.
    const res = await briefApi.acceptArenaChallenge(challenge.id);
    if (!res.ok) {
      showToast(res.error ?? 'This challenge is no longer open.');
      return;
    }
    // The server's match is the record of the game. Map it onto the display
    // model so "Your matches" reflects the real, server-persisted match.
    if (res.data?.match) {
      const m = res.data.match;
      setMatches((prev) => [
        ...prev.filter((x) => x.challengeId !== challenge.id),
        {
          id: String(m.id),
          challengeId: String(m.challengeId ?? challenge.id),
          gameId: m.gameId as ArenaGameId,
          playerAId: String(m.playerAId),
          playerBId: String(m.playerBId),
          playedAt: m.createdAt ?? new Date().toISOString(),
          winnerPlayerId: m.winnerPlayerId ?? undefined,
          scoreLine: m.scoreLine ?? undefined,
          confirmedByA: m.confirmedByA ?? undefined,
          confirmedByB: m.confirmedByB ?? undefined
        }
      ]);
    }
    await refreshArenaChallenges();
    await refreshArenaMatches();
    showToast('Challenge accepted. Match created.');
  };

  const handleCancelChallenge = async (challenge: ArenaChallenge) => {
    setArenaBusyId(challenge.id);
    const res = await briefApi.cancelArenaChallenge(challenge.id);
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not cancel this challenge.');
      return;
    }
    await refreshArenaChallenges();
    showToast('Challenge cancelled.');
  };

  const [arenaTestGame, setArenaTestGame] = useState<string>('efootball');
  const [arenaTestMode, setArenaTestMode] = useState<string>('1v1 Match');
  const [arenaTestStake, setArenaTestStake] = useState<ArenaStakeKind>('friendly');
  const [arenaTestFee, setArenaTestFee] = useState<string>('100');
  const [arenaTestRules, setArenaTestRules] = useState<string>('');
  const [arenaTestDuration, setArenaTestDuration] = useState<number>(120);
  const [arenaTestCreatorOpen, setArenaTestCreatorOpen] = useState<boolean>(false);

  const handleCreateChallenge = async (params?: {
    gameId?: string;
    mode?: string;
    stake?: ArenaStakeKind;
    entryFeeKes?: number;
    note?: string;
    openMinutes?: number;
  }) => {
    setArenaBusyId('create');
    const gid = params?.gameId
      ? ((CLIENT_TO_SERVER_GAME as Record<string, string>)[params.gameId] ?? params.gameId)
      : ((CLIENT_TO_SERVER_GAME as Record<string, string>)[arenaGameId] ?? arenaGameId);
    const res = await briefApi.createArenaChallenge({
      gameId: gid,
      mode: params?.mode ?? arenaGame.modes[0] ?? '1v1',
      stake: params?.stake ?? 'friendly',
      entryFeeKes: params?.entryFeeKes,
      note: params?.note,
      openMinutes: params?.openMinutes ?? 120
    });
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not open a challenge.');
      return;
    }
    setArenaSection('challenges');
    await refreshArenaChallenges();
    showToast('Challenge opened. Anyone can accept it.');
  };

  const handleLaunchArenaTest = async () => {
    const fee = arenaTestStake === 'entry_fee' ? (Number(arenaTestFee) || 100) : undefined;
    await handleCreateChallenge({
      gameId: arenaTestGame,
      mode: arenaTestMode,
      stake: arenaTestStake,
      entryFeeKes: fee,
      note: arenaTestRules.trim() || undefined,
      openMinutes: arenaTestDuration
    });
    setArenaTestCreatorOpen(false);
    setArenaTestRules('');
    showToast('Arena test match launched!');
  };

  // Shared availability toggle used by both PlayAs and the game screen.
  const handleToggleAvailability = async () => {
    setAvailabilityBusy(true);
    const next = !availabilityOn;
    const res = await briefApi.setMyAvailability(
      next
        ? {
            state: 'available',
            gameId: CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId,
            mode: '1v1',
            format: '1v1',
            window: 'tonight',
            locationKind: 'online'
          }
        : { state: 'offline' }
    );
    setAvailabilityBusy(false);
    if (!res.ok) {
      showToast(res.error ?? 'Could not update availability.');
      return;
    }
    setAvailabilityOn(res.data.state === 'available');
    setPlayAsConfirmed(true);
  };

  const handleReportMatch = async (match: ArenaMatch, winnerPlayerId: string | null) => {
    setArenaBusyId(match.id);
    const res = await briefApi.reportArenaMatch(match.id, { winnerPlayerId });
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not report this result.');
      return;
    }
    await refreshArenaMatches();
    showToast('Result reported. The other player still has to confirm.');
  };

  const handleConfirmMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.confirmArenaMatch(match.id);
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not confirm this result.');
      return;
    }
    await refreshArenaMatches();
    if (res.data?.disputed) {
      showToast('Players disagreed. Brief does not pick a winner.');
      return;
    }
    const rw = res.data?.yourRewards;
    showToast(rw ? `Match confirmed · +${rw.xp} XP${rw.coins ? ` · +${rw.coins} Arena Coins` : ''}` : 'Result confirmed.');
  };

  // Abandon: the honest exit for a match that never happened. The server
  // decides who may abandon (and when); a refusal says why.
  const handleAbandonMatch = async (match: ArenaMatch) => {
    setArenaBusyId(match.id);
    const res = await briefApi.abandonArenaMatch(match.id, 'never started');
    setArenaBusyId(null);
    if (!res.ok) {
      showToast(res.error ?? 'Could not abandon this match.');
      return;
    }
    await refreshArenaMatches();
    showToast('Match abandoned.');
  };

  // Venues that actually host the selected game, nearest first.
  // Live activity per game: open challenges plus players checked in at a
  // venue. Drives the count on each game chip, so the selector is dynamic.
  const [savedGroupEntryIds, setSavedGroupEntryIds] = useState<string[]>([]);
  const [commandText, setCommandText] = useState('');
  const [commandResult, setCommandResult] = useState<GroupCommandResult | null>(null);

  const handleRunCommand = (override?: string) => {
    const raw = (override ?? commandText).trim();
    if (raw === '' || !openGroup) return;

    // A bare question is treated as /ask, so members never have to learn
    // command syntax to get an answer.
    const normalised = raw.startsWith('/') ? raw : `/ask ${raw}`;

    const result = runGroupCommand(normalised, {
      entries: groupIndex,
      objects,
      savedObjects,
      now: new Date('2026-08-15T00:00:00Z')
    });

    if (!result) {
      showToast('Unknown command');
      setCommandResult(null);
      return;
    }
    setCommandResult(result);
  };

  // --- Sources ---------------------------------------------------------------
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);

  // --- Capture ---------------------------------------------------------------
  // Pasted text runs through the ingestion parser, then waits for confirmation
  // exactly like anything else. Capture is a doorway, not a shortcut.
  const [captureOpen, setCaptureOpen] = useState(bootRoute.capture);
  const [captureText, setCaptureText] = useState('');
  const [capturePreview, setCapturePreview] = useState<IngestionCandidate | null>(null);
  const [captureMode, setCaptureMode] = useState<'quick' | 'direct'>('quick');
  const [directTitle, setDirectTitle] = useState('');
  const [directType, setDirectType] = useState<ObjectType>('knowledge');
  const [directCategory, setDirectCategory] = useState('News');
  const [directLocation, setDirectLocation] = useState('');

  const handleCaptureParse = () => {
    const raw = captureText.trim();
    if (raw === '') return;
    const message = buildCaptureMessage(raw, new Date().toISOString());
    setCapturePreview(parseInboundMessage(message, objects));
  };

  const handleCaptureConfirm = async (overrideDraft?: { title?: string; type?: ObjectType; category?: string; locationName?: string }) => {
    const raw = captureText.trim();
    if (!raw) return;
    const effTitle = overrideDraft?.title || capturePreview?.draft.title || extractTitle(raw) || 'Captured Post';
    const effType = overrideDraft?.type || capturePreview?.draft.type || 'knowledge';
    const effCat = overrideDraft?.category || capturePreview?.draft.category || 'News';
    const effLoc = overrideDraft?.locationName || capturePreview?.draft.locationName || undefined;

    // Persist through the real ingestion pipeline (server-side), so a capture
    // is discoverable and survives a reload — not just a transient local row.
    const res = await briefApi.saveBriefIt(raw, {
      title: effTitle,
      type: effType,
      category: effCat,
      locationName: effLoc
    } as any);

    // Immediately inject into local state so user sees it formed right away!
    const newObj: BriefObject = {
      id: res.ok && (res.data as any)?.objectId ? (res.data as any).objectId : `cap_${Date.now()}`,
      type: effType,
      title: effTitle,
      category: effCat,
      summary: raw.replace(/\s+/g, ' ').trim().slice(0, 240),
      locationName: effLoc,
      isVerified: false,
      sourceType: 'manual',
      sourceId: 'src_manual_capture',
      ingestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    setObjects((prev) => [newObj, ...prev.filter((o) => o.id !== newObj.id)]);

    setCaptureText('');
    setCapturePreview(null);
    setDirectTitle('');
    setDirectLocation('');
    setCaptureOpen(false);
    if (res.ok) {
      showToast('Dropped into Brief.');
      void loadObjects();
      void refreshConnectors();
    } else {
      showToast(res.error ?? 'Could not save.');
    }
  };

  const handleDirectPost = async () => {
    const raw = captureText.trim();
    const title = directTitle.trim();
    if (!raw || !title) return;
    await handleCaptureConfirm({
      title,
      type: directType,
      category: directCategory,
      locationName: directLocation.trim() || undefined
    });
  };

  const handleCaptureCancel = () => {
    setCaptureText('');
    setCapturePreview(null);
    setDirectTitle('');
    setDirectLocation('');
    setCaptureOpen(false);
  };

  const savedIdSet = useMemo(
    () => new Set(savedObjects.map((o) => o.id)),
    [savedObjects]
  );

  const relatedToSavedIds = useMemo(() => {
    const out = new Set<string>();
    for (const saved of savedObjects) {
      for (const rel of getRelatedObjects(saved)) out.add(rel.item.id);
    }
    return out;
  }, [savedObjects, objects]);

  const dailyBrief = useMemo(
    () =>
      buildDailyBrief({
        objects,
        pursuits,
        pursuitResults,
        savedIds: savedIdSet,
        watchedIds,
        seenIds
      }),
    [objects, pursuits, pursuitResults, savedIdSet, watchedIds, seenIds]
  );

  // The discovery-experience Daily Brief: TODAY / NEAR YOU / NOW / COMING UP
  // from real persisted rows. Only rendered when it has data.
  const discoveryBrief = useMemo(
    () =>
      buildDiscoveryBrief({
        objects,
        area: feedArea,
        geo: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
      }),
    [objects, feedArea, userLocation]
  );

  const pendingCandidates = useMemo(
    () => candidates.filter((c) => !reviewed[c.id]),
    [candidates, reviewed]
  );

  const handleUnsave = (object: BriefObject) => {
    setRelationships((prev) =>
      prev.filter(
        (rel) => !(rel.targetId === object.id && rel.verb === 'saved')
      )
    );
    showToast(`Removed "${object.title}" from your saved things.`);
  };

  // Computed once per render instead of on every call site in the modal.
  const relatedObjects = selectedObjectForDetail
    ? getRelatedObjects(selectedObjectForDetail)
    : [];

  const liveEdition = getCurrentEdition();

  // Newest first, promoted posts kept inline rather than pinned to the top --
  // paid distribution earns a slot in the feed, not the whole masthead.
  const editionPosts = useMemo(
    () =>
      posts
        .filter((post) => post.edition === activeEdition)
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        ),
    [posts, activeEdition]
  );

  const openPostSubject = (post: BriefPost) => {
    const subject = objects.find((item) => item.id === post.relatedObjectId);
    if (subject) {
      setSelectedObjectForDetail(subject);
    }
  };

  const toggleLike = (post: BriefPost) => {
    setLikedPostIds((prev) =>
      prev.includes(post.id)
        ? prev.filter((id) => id !== post.id)
        : [...prev, post.id]
    );
  };

  const handleMenuSelect = (target: MenuTarget) => {
    setMenuOpen(false);
    // The operator desk is not a consumer destination and is not ladder-gated:
    // authority is the session's capabilities, checked again per call.
    if (target.tab === 'operate') {
      setAdminOpen(true);
      return;
    }
    // The ladder shapes what is OFFERED, never what is permitted: authority
    // still lives on the server. A surface whose rung has not been climbed
    // says which step opens it and points at that step instead of dropping
    // someone into a desk they have nothing to put on yet.
    //
    // Saved (Your Layer) and Actions (Workflows) are exempt by design — see
    // showsLadder(). Those two index screens list what exists; they are not a
    // shop window and never carry lock chrome.
    const section = 'section' in target ? target.section ?? null : null;
    if (!isSurfaceUnlocked(ladder, target.tab, section)) {
      const hint = unlockHint(ladder, target.tab, section);
      noteActivation('service_locked_tapped', { tab: target.tab, section, requires: hint });
      showToast(hint ? `Opens after: ${hint}` : 'Not open yet');
      setNextStepHidden(false);
      setCaptureOpen(false);
      setActiveTab('nearby');
      setNearbySection('stream');
      return;
    }
    if (target.tab === 'capture') {
      setCaptureOpen(true);
      return;
    }
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setActiveTab(target.tab);
    if (target.tab === 'nearby') setNearbySection(target.section ?? 'stream');
    if (target.tab === 'mylayer') setMyLayerSection(target.section ?? 'saved');
    if (target.tab === 'workflows') {
      setWorkflowSection(target.section ?? 'cockpit');
      setWorkflowView(target.section ? 'screen' : 'queue');
    }
    if (target.tab === 'arena') setArenaSection(target.section ?? 'lobby');
  };

  const skipUrl = useRef(false);

  const currentRoute = useCallback((): BriefRoute => ({
    dest: activeTab,
    nearby: nearbySection,
    mylayer: myLayerSection,
    workflow: workflowSection,
    arena: arenaSection,
    objectId: selectedObjectForDetail?.id ?? pendingObjectId,
    teaSlug: selectedTeaSlug,
    campaignId: openCampaignId,
    capture: captureOpen,
    menu: menuOpen,
    admin: adminOpen,
    landed: false
  }), [
    activeTab, nearbySection, myLayerSection, workflowSection, arenaSection,
    selectedObjectForDetail, pendingObjectId, selectedTeaSlug, openCampaignId,
    captureOpen, menuOpen, adminOpen
  ]);

  const writeUrl = useCallback((route: BriefRoute, mode: 'push' | 'replace') => {
    if (typeof window === 'undefined' || !window.history) return;
    const url = toPath(route);
    if (mode === 'push') window.history.pushState(route, '', url);
    else window.history.replaceState(route, '', url);
  }, []);

  const applyRoute = useCallback((route: BriefRoute) => {
    skipUrl.current = true;
    setActiveTab(route.dest);
    setNearbySection(route.nearby);
    setMyLayerSection(route.mylayer);
    setWorkflowSection(route.workflow);
    setWorkflowView(route.dest === 'workflows' && route.workflow !== 'active' ? 'screen' : 'queue');
    setArenaSection(route.arena);
    setMenuOpen(route.menu);
    setAdminOpen(route.admin);
    setCaptureOpen(route.capture);
    setSelectedTeaSlug(route.teaSlug);
    setOpenCampaignId(route.campaignId);
    if (route.objectId) setPendingObjectId(route.objectId);
    else {
      setPendingObjectId(null);
      setSelectedObjectForDetailRaw(null);
    }
  }, []);

  const dismissOverlay = useCallback(() => {
    const st = typeof window !== 'undefined' ? window.history.state : null;
    const overlayState = isBriefRoute(st) && (st.menu || st.capture || st.admin || st.objectId || st.teaSlug || st.campaignId);
    if (overlayState && !st.landed && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    skipUrl.current = true;
    setMenuOpen(false);
    setAdminOpen(false);
    setCaptureOpen(false);
    setSelectedTeaSlug(null);
    setOpenCampaignId(null);
    setPendingObjectId(null);
    setSelectedObjectForDetailRaw(null);
    writeUrl({ ...currentRoute(), menu: false, admin: false, capture: false, objectId: null, teaSlug: null, campaignId: null }, 'replace');
  }, [currentRoute, writeUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeUrl({ ...bootRoute, landed: true }, 'replace');
    const onPop = (event: PopStateEvent) => {
      const route = isBriefRoute(event.state)
        ? event.state
        : parsePath(window.location.pathname, window.location.search);
      applyRoute(route);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute, writeUrl]);

  useEffect(() => {
    if (skipUrl.current) {
      skipUrl.current = false;
      return;
    }
    const overlay = menuOpen || adminOpen || captureOpen || Boolean(selectedTeaSlug) || Boolean(openCampaignId) || Boolean(selectedObjectForDetail) || Boolean(pendingObjectId);
    writeUrl(currentRoute(), overlay ? 'push' : 'replace');
  }, [
    activeTab, nearbySection, myLayerSection, workflowSection, arenaSection,
    menuOpen, adminOpen, captureOpen, selectedTeaSlug, openCampaignId,
    selectedObjectForDetail, pendingObjectId, currentRoute, writeUrl
  ]);

  useEffect(() => {
    const tg = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null);
    if (!tg?.BackButton) return;
    const show = menuOpen || captureOpen || Boolean(selectedTeaSlug) || Boolean(openCampaignId) || Boolean(selectedObjectForDetail);
    try {
      if (show) tg.BackButton.show();
      else tg.BackButton.hide();
    } catch { /* Mini App host without BackButton */ }
    const handler = () => dismissOverlay();
    try { tg.BackButton.onClick(handler); } catch { /* */ }
    return () => {
      try { tg.BackButton.offClick?.(handler); } catch { /* */ }
    };
  }, [menuOpen, captureOpen, selectedTeaSlug, openCampaignId, selectedObjectForDetail, dismissOverlay]);

  useEffect(() => {
    if (!pendingObjectId) return;
    const hit = objects.find((o) => o.id === pendingObjectId);
    if (hit) {
      if (selectedObjectForDetail?.id !== hit.id) setSelectedObjectForDetailRaw(hit);
      return;
    }
    let live = true;
    briefApi.getObject(pendingObjectId).then((res) => {
      if (!live || !res.ok) return;
      setSelectedObjectForDetailRaw(objectFromServer(res.data));
    });
    return () => { live = false; };
  }, [pendingObjectId, objects, selectedObjectForDetail]);

  const isAnyModalActive = Boolean(openCampaignId) || createStep !== 'closed' || captureOpen || Boolean(selectedObjectForDetail) || Boolean(selectedTeaSlug);

  // THE APP GATE (product decision 2026-08-29): NO ACCESS WITHOUT AN ACCOUNT.
  // Signed out, the app does not render at all -- no feed, no shelf, no
  // navigation, nothing in the DOM to leak. The sign-in flow IS the screen.
  // The server enforces the same rule on every data route (401
  // account_required); this is the client half.
  if (sessionChecked && !sessionUser) {
    return (
      <div className="min-h-screen bg-[#D8D2E1] text-[#251045]">
        <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#251045]/50">Brief · Nairobi</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mt-2">
              An account opens everything
            </h1>
            <p className="mt-3 text-[12px] leading-relaxed text-[#251045]/70">
              Brief is members-only: the live feed, the Tea studio, EPL fantasy rooms,
              the marketplace and every tool behind this wall need an account.
            </p>
            <ul className="mt-4 space-y-1.5 text-left mx-auto w-fit">
              {[
                'Write and publish your own stories',
                'Open and seat EPL fantasy rooms',
                'Sell, campaign and run groups',
                'Sign in with Google, email link, or your Brief handle'
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[11px] leading-snug text-[#251045]/80">
                  <span aria-hidden="true" className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px] leading-relaxed text-[#251045]/50">
              No real money moves on Brief yet (no payment provider connected), and
              Google sign-in activates once this deployment registers its Google
              credentials. Your Brief account — the primary registry — works today.
            </p>
          </div>
        </div>
        <Onboarding
          open
          providers={authProviders}
          state={onboardingState}
          user={sessionUser}
          channel={arrivalChannel}
          placeLabel={userLocation?.label ?? null}
          onSignedIn={(user) => {
            setSessionUser(user);
            void refreshOnboarding();
          }}
          onGuest={provisionGuest}
          onStateChange={setOnboardingState}
          onUseLocation={locate}
          onChooseCity={(city) => chooseCity(city)}
          onDone={() => {
            setFirstRunOpen(false);
            setActiveTab('nearby');
            setNearbySection('stream');
            void refreshOnboarding();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D8D2E1] text-[#251045] flex flex-col font-sans selection:bg-[#5B2EA6] selection:text-[#FFFFFF]">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#5B2EA6] text-[#FFFFFF] px-4 py-2.5 rounded-xl font-extrabold shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Spring-animated empty-state overlay */}
      {springOverlayOpen && (
        <>
          <div
            onClick={() => setSpringOverlayOpen(false)}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[8px] transition-opacity"
          />
          <div className="brief-spring-modal fixed top-1/2 left-1/2 z-[70] w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#6C3EC9]/25 bg-[#FBFAFD]/90 px-6 py-8 text-center shadow-2xl">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Nothing to do here?</h3>
            <p className="text-sm text-[#251045]/60 leading-relaxed mb-6">
              The current timeline is looking ultra quiet. Let's look into a
              different zone.
            </p>
            <button
              onClick={() => setSpringOverlayOpen(false)}
              className="w-full py-4 rounded-lg bg-[#FBFAFD] border border-[#6C3EC9]/30 text-[#251045] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#6C3EC9]/70 active:translate-y-0.5 active:scale-[0.96] active:border-white"
            >
              🗓️ Check a Different Time
            </button>
          </div>
        </>
      )}

      {/* Roofless: no top bar. The page opens onto the sky. Menu, capture
          and place live on the dock / shelf, not as a lid over the house. */}
      <div className="flex-1 flex w-full">

        {/* DESKTOP / TABLET RAIL. Full height now the header is gone. */}
        <nav
          aria-label="Primary"
          className="hidden md:flex flex-col shrink-0 w-[76px] hover:w-60 transition-all duration-200 border-r border-[#D6CFE4] bg-[#FBFAFD] sticky top-0 h-screen py-4 group/rail overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-expanded={menuOpen}
            className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
              menuOpen ? 'text-[#251045] bg-[#FBFAFD] font-extrabold' : 'text-[#251045] hover:text-[#251045]'
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                menuOpen ? 'h-7 bg-[#5B2EA6]' : 'h-0 bg-transparent'
              }`}
            />
            <Menu className="w-5 h-5 shrink-0" />
            <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
              <span className="block text-[13px] font-extrabold whitespace-nowrap">Menu</span>
            </span>
          </button>
          {DESTINATIONS.map((d) => {
            const active = activeTab === d.id;
            const Icon = DESTINATION_ICONS[d.id];
            return (
              <button
                key={d.id}
                onClick={() => goToDestination(d.id)}
                title={d.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  active
                    ? 'text-[#251045] bg-[#FBFAFD] font-extrabold'
                    : 'text-[#251045] hover:text-[#251045]'
                }`}
              >
                {/* Active marker on the edge, not a heavy filled pill. */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                    active ? 'h-7 bg-[#5B2EA6]' : 'h-0 bg-transparent'
                  }`}
                />
                <span className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  <span className="absolute -right-1.5 -top-1.5">
                    <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                  </span>
                </span>
                <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
                  <span className="block text-[13px] font-extrabold whitespace-nowrap">
                    {d.label}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main Stream. pb-24 on mobile clears the bottom bar. */}
        <main className="flex-1 min-w-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">

        {/* Main Content */}
        {/* Sub-navigation. Sections live INSIDE a destination, so the top
            bar stays five doors wide no matter how much is built. */}
        {activeTab === 'nearby' && (
          <div className="max-w-5xl mx-auto px-0 sm:px-4 pt-2">
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-[#251045]">Home</h1>
                <div className="flex items-center gap-2">
                  <LocationChip
                    label={selectedLocation}
                    locating={locating}
                    locError={locError}
                    hasLocation={Boolean(userLocation)}
                    onLocate={locate}
                    onSelectCity={chooseCity}
                    onClearLocation={clearLocation}
                  />
                </div>
              </div>
              {runtimeCheck === 'old' && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-[#6C3EC9] bg-[#FBFAFD] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-extrabold text-[#251045]">Update needed before testing</p>
                    <p className="mt-1 text-[10px] leading-snug text-[#251045]/60">This app is newer than the API behind it. Deploy the current server so gallery, banner, and news checks use the same contract.</p>
                  </div>
                  <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg bg-[#5B2EA6] px-3 py-2 text-[10px] font-extrabold text-[#FFFFFF]">Refresh</button>
                </div>
              )}
              {runtimeCheck === 'unavailable' && (
                <div className="mb-3 rounded-2xl border border-dashed border-[#D6CFE4] bg-[#FBFAFD] px-4 py-3">
                  <p className="text-[11px] font-extrabold text-[#251045]">Live services are not reachable</p>
                  <p className="mt-1 text-[10px] leading-snug text-[#251045]/60">The shelf still works as navigation, but live news and create actions will wait for the API. No placeholder counts are shown.</p>
                </div>
              )}
              {nearbySection === 'stream' && (
                <>
                  {/* The ladder's one card: the rung they are on and the
                      single thing that opens the next one. Home only — Saved
                      and Actions stay quiet. */}
                  {!nextStepHidden && showsLadder('nearby') && (
                    <div className="mb-3">
                      <NextStep
                        ladder={ladder}
                        onDismiss={() => setNextStepHidden(true)}
                        onAct={(rungId) => {
                          if (rungId === 'identity' || rungId === 'orient') {
                            setFirstRunOpen(true);
                            return;
                          }
                          if (rungId === 'value') {
                            setActiveTab('nearby');
                            setNearbySection('stream');
                            return;
                          }
                          if (rungId === 'contribute') {
                            setCaptureOpen(true);
                            return;
                          }
                          setActiveTab('workflows');
                          setWorkflowSection('campaigns');
                          setWorkflowView('screen');
                        }}
                      />
                    </div>
                  )}
                  <MainShelf
                    onSelect={handleMenuSelect}
                    playOpenCount={arenaActivity.efootball ?? null}
                    ladder={ladder}
                    onLocked={(info) => {
                      noteActivation('service_locked_tapped', { card: info.cardId, requires: info.requires });
                      showToast(info.unlocksAfter ? `Opens after: ${info.unlocksAfter}` : 'Not open yet');
                    }}
                  />
                  {/* No demo seeding on Home: when production data is thin the
                      FeedComposer below renders honest, contextual empty
                      states — the no-fake-live-data rule. */}
                  {/* TODAY'S BRIEF — the compact discovery summary: TODAY /
                      NEAR YOU / NOW / COMING UP, every row a real persisted
                      object. Only rendered when it has data. */}
                  {discoveryTab === 'home' && discoveryBrief.length > 0 && (
                    <section className="mb-8" aria-label="Today's Brief">
                      <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#251045]/60">
                        Today's Brief
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {discoveryBrief.map((section) => (
                          <div
                            key={section.key}
                            className="rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] p-3"
                          >
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#251045]/50">
                              {section.title}
                            </p>
                            <div className="mt-2 space-y-0.5">
                              {section.objects.slice(0, 4).map((obj) => (
                                <button
                                  key={obj.id}
                                  type="button"
                                  onClick={() => setSelectedObjectForDetail(obj)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#E9E4F2] cursor-pointer"
                                >
                                  {obj.imageUrl ? (
                                    <img
                                      src={obj.imageUrl}
                                      alt=""
                                      aria-hidden="true"
                                      loading="lazy"
                                      className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <span
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[15px]"
                                      style={{ background: '#F1EDF7', color: '#6C3EC9' }}
                                      aria-hidden="true"
                                    >
                                      {getObjectTypeMeta(obj.type).label.charAt(0)}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] font-semibold text-[#251045]">
                                      {obj.title}
                                    </span>
                                    {briefWhenLabel(obj) && (
                                      <span className="block truncate text-[9px] font-semibold text-[#251045]/55">
                                        {briefWhenLabel(obj)}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* FEED COMPOSER — the composed, deduplicated magazine feed:
                      hero → tea → discovery → opportunities. Real server rows via
                      /api/feed; card variety by type, never a repeating grid. */}
                  <FeedComposer
                    key={feedReload}
                    typeFilter={selectedObjectType}
                    onFeedStatus={setHomeFeedStatus}
                    area={feedArea}
                    geo={userLocation ? { lat: userLocation.lat, lng: userLocation.lng, radiusKm: 40 } : null}
                    type={discoveryTab === 'events' ? 'experience'
                      : discoveryTab === 'offers' ? 'offer'
                        : discoveryTab === 'places' ? 'place'
                          : discoveryTab === 'news' ? 'news'
                            : discoveryTab === 'opportunities' ? 'opportunity'
                              : null}
                    browse={discoveryTab === 'explore'}
                    onOpen={(raw) => {
                      if (!raw?.id) return;
                      const local = objects.find((object) => object.id === String(raw.id));
                      setSelectedObjectForDetail(local ?? objectFromServer(raw));
                    }}
                    onOpenTea={(slug) => setSelectedTeaSlug(slug)}
                    onOpenTag={(tag) => {
                      setSearchQuery(tag);
                      setNearbySection('stream');
                    }}
                  />
                </>
              )}
            </div>
            {/* Discovery navigation — Home, Events, Explore, Offers, Places,
                News, Opportunities. A category appears only when the real
                persisted data has rows for it; nothing is ever padded to make
                a tab exist. Selecting a category scopes the feed server-side
                (type= on /api/feed); Explore is the whole catalog in one grid.
                Tea/Today/Pursuits/Quests and the remaining types live behind
                "More" so they never permanently occupy the feed. Lives in the
                OUTER nearby block so it is reachable from every section. */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(() => {
                const counts: Record<string, number> = {};
                for (const o of objects) {
                  counts[o.type] = (counts[o.type] ?? 0) + 1;
                }
                const has = (types: string[]) => types.some((t) => (counts[t] ?? 0) > 0);
                const tabs = [
                  { id: 'home', label: 'Home', types: null as string[] | null },
                  { id: 'events', label: 'Events', types: ['experience', 'event'] },
                  { id: 'explore', label: 'Explore', types: null as string[] | null },
                  { id: 'offers', label: 'Offers', types: ['offer'] },
                  { id: 'places', label: 'Places', types: ['place'] },
                  { id: 'news', label: 'News', types: ['news'] },
                  { id: 'opportunities', label: 'Opportunities', types: ['opportunity'] }
                ];
                return tabs
                  .filter((tab) => !tab.types || has(tab.types))
                  .map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setDiscoveryTab(tab.id as typeof discoveryTab);
                        // Keep the legacy client-side filter in step so the
                        // fallback grid matches the tab when the composed
                        // feed is unavailable.
                        const type = tab.id === 'events' ? 'experience'
                          : tab.id === 'offers' ? 'offer'
                            : tab.id === 'places' ? 'place'
                              : tab.id === 'news' ? 'news'
                                : tab.id === 'opportunities' ? 'opportunity'
                                  : 'all';
                        setSelectedObjectType(type);
                        setNearbySection('stream');
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                        nearbySection === 'stream' && discoveryTab === tab.id
                          ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                          : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ));
              })()}
              <button
                onClick={() => setMoreFilters((v) => !v)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                  moreFilters
                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                    : 'bg-[#FBFAFD] text-[#251045]/60 border-[#D6CFE4] hover:border-[#6C3EC9]'
                }`}
              >
                More
              </button>
            </div>

            {/* More filters — reachable from every section, not permanently
                occupying the feed. */}
            {moreFilters && (
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
                {([
                  ['tea', HOME_MORE.tea],
                  ['today', `${HOME_MORE.today}${dailyBrief.length > 0 ? ' *' : ''}`],
                  ['pursuits', `${HOME_MORE.pursuits}${pursuits.length > 0 ? ` (${pursuits.length})` : ''}`],
                  ['quests', `${HOME_MORE.quests}${openQuests.length > 0 ? ` (${openQuests.length})` : ''}`],
                  ['market', HOME_MORE.market],
                  ['events', HOME_MORE.events]
                ] as [NearbySection, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setNearbySection(id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                      nearbySection === id
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {[
                  { id: 'service', label: FILTERS.service },
                  { id: 'product', label: FILTERS.product },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => { setSelectedObjectType(filter.id); setNearbySection('stream'); }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                      nearbySection === 'stream' && selectedObjectType === filter.id
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mylayer' && (
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
            <div className="flex items-end justify-between gap-2 pb-2">
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-[#251045] tracking-tight">
                  Your Layer — Things you've kept
                </h1>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#251045]/50 mt-0.5">
                  {activeSavedBundle.hint}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-[#E9E4F2] text-[#251045]/60 px-2.5 py-1 rounded-full">
                {activeSavedBundle.sections.length} screens
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
              {SAVED_BUNDLES.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => setMyLayerSection(bundle.sections[0] as MyLayerSection)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    activeSavedBundle.id === bundle.id
                      ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                      : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                  }`}
                >
                  {bundle.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 border-t border-[#D6CFE4] pt-2">
              {activeSavedBundle.sections.map((id) => (
                <button
                  key={id}
                  onClick={() => setMyLayerSection(id as MyLayerSection)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    myLayerSection === id
                      ? 'bg-[#5B2EA6] text-[#FFFFFF]'
                      : 'text-[#251045]/60 hover:text-[#251045] bg-[#F1EDF7]'
                  }`}
                >
                  {SAVED_TABS[id]}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
            <div className="flex items-end justify-between gap-2 pb-2">
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-[#251045] tracking-tight">
                  {workflowView === 'queue' ? ROOM.workflows.label : `Workflows — ${activeWorkflowBundle.label}`}
                </h1>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#251045]/50 mt-0.5">
                  {workflowView === 'queue' ? `${QUEUE_LABEL} — ${QUEUE_HINT}` : activeWorkflowBundle.hint}
                </p>
              </div>
              {/* No count on the queue: how much is waiting is the queue's own
                  answer, and a header badge would be a second, worse copy. */}
              {workflowView === 'screen' && (
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-[#E9E4F2] text-[#251045]/60 px-2.5 py-1 rounded-full">
                  {activeWorkflowBundle.sections.length} screens
                </span>
              )}
            </div>

            {/* The landing row. The queue is first because it is the reason you
                opened the Inbox; the bundles are the tools, filed by job. */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => {
                  // Back to the desk's default section as well, so the URL
                  // says /actions while the queue is what you are looking at.
                  // A path that names a tool you are not reading is a small
                  // lie, and it is what a shared link would carry.
                  setWorkflowSection('active');
                  setWorkflowView('queue');
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                  workflowView === 'queue'
                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                    : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                }`}
              >
                {QUEUE_CHIP}
              </button>
              {WORKFLOW_BUNDLES.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => {
                    setWorkflowSection(bundle.sections[0] as WorkflowSection);
                    setWorkflowView('screen');
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    workflowView === 'screen' && activeWorkflowBundle.id === bundle.id
                      ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                      : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                  }`}
                >
                  {bundle.label}
                </button>
              ))}
            </div>

            {workflowView === 'screen' && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 border-t border-[#D6CFE4] pt-2">
                {activeWorkflowBundle.sections.map((id) => (
                  <button
                    key={id}
                    onClick={() => setWorkflowSection(id as WorkflowSection)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                      workflowSection === id
                        ? 'bg-[#5B2EA6] text-[#FFFFFF]'
                        : 'text-[#251045]/60 hover:text-[#251045] bg-[#F1EDF7]'
                    }`}
                  >
                    {INBOX_TABS[id]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'queue' && (
          <TriageQueue
            onOpenSection={(section) => {
              setWorkflowSection(section as WorkflowSection);
              setWorkflowView('screen');
            }}
            onNotice={(message) => showToast(message)}
          />
        )}

        {activeTab === 'nearby' && nearbySection === 'stream' && (
          <>
            {/* A small live rail for destinations. Keep it visual and concise. */}
            {(() => {
              const active = objects
                .filter((obj) => {
                  if (!isDestinationObject(obj)) return false;
                  const state = getDestinationState(obj);
                  return state === 'live' || state === 'today';
                })
                .sort((a, b) => {
                  const da = a.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
                  const db = b.metadata?.distanceKm ?? Number.MAX_SAFE_INTEGER;
                  return da - db;
                })
                .slice(0, 3);
              if (active.length === 0) return null;
              return (
                <section className="mx-auto mb-8 max-w-5xl">
                  <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#251045]/60">
                    Happening nearby
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {active.map((obj) => {
                      const vendors = getDestinationVendors(obj, objects);
                      return (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => setSelectedObjectForDetail(obj)}
                          aria-label={obj.title}
                          className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-[#D6CFE4] bg-[#FBFAFD] text-left transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9]"
                        >
                          {obj.imageUrl ? (
                            <img
                              src={obj.imageUrl}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#3A2169] to-[#2A1657]" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#150826]/90 via-[#150826]/10 to-transparent" />
                          <div className="absolute inset-x-3 bottom-3">
                            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">
                              {obj.title}
                            </h3>
                            {vendors.length > 0 && (
                              <p className="mt-1 text-[10px] font-semibold text-[#FFFFFF]">
                                {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} inside
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Search stays above the visual stream, but the cards themselves
                are title-first. */}
            {searchQuery.trim() !== '' && (
              <SearchResults query={searchQuery} onOpenObject={(o) => setSelectedObjectForDetail(objectFromServer(o))} />
            )}

            {/* The legacy object stream is a fallback for deployments where the
                composed feed is unavailable. Keep one visual language in both
                paths: photo, title, and the one action the record supports. */}
            {(homeFeedStatus !== 'ready' || searchQuery.trim() !== '') && (
              <>
                {filteredObjects.length > 0 ? (
                  <section className="mx-auto max-w-5xl">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {filteredObjects.map((obj) => {
                        const destVendors = isDestinationObject(obj)
                          ? getDestinationVendors(obj, objects)
                          : [];
                        const level = getCardLevel(obj, destVendors.length);
                        const destState = getDestinationState(obj);
                        const status = level >= 2
                          ? DESTINATION_STATE_LABELS[destState]
                          : obj.metadata?.statusBadge;
                        return (
                          <div
                            key={obj.id}
                            onClick={() => setSelectedObjectForDetail(obj)}
                            className={`group relative min-h-[210px] cursor-pointer overflow-hidden rounded-2xl border bg-[#FBFAFD] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#6C3EC9] ${
                              level === 3 ? 'sm:col-span-2 sm:row-span-2 min-h-[270px]' : ''
                            }`}
                          >
                            {obj.imageUrl ? (
                              <img
                                src={obj.imageUrl}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-[#3A2169] to-[#2A1657]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#150826]/95 via-[#150826]/20 to-[#150826]/05" />
                            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                {getObjectTypeMeta(obj.type).label}
                              </span>
                              {!obj.imageUrl && obj.category && (
                                <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                  {obj.category}
                                </span>
                              )}
                              {obj.isVerified && (
                                <span className="rounded-full bg-[#5B2EA6] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#FFFFFF]">
                                  VERIFIED
                                </span>
                              )}
                              {status && (
                                <span className="rounded-full bg-[#F1EDF7]/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#251045]">
                                  {status}
                                </span>
                              )}
                            </div>
                            <div className="absolute inset-x-3 bottom-3">
                              <h3 className="line-clamp-3 pr-2 text-[14px] font-semibold leading-snug text-[#FFFFFF]">
                                {obj.title}
                              </h3>
                              {level === 3 && destVendors.length > 0 && (
                                <p className="mt-1 text-[10px] font-semibold text-[#FFFFFF]">
                                  {destVendors.length} {destVendors.length === 1 ? 'vendor' : 'vendors'} inside
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (level === 3 && destVendors.length > 0) {
                                      setSelectedObjectForDetail(obj);
                                    } else {
                                      handlePrimaryAction(obj);
                                    }
                                  }}
                                  className="rounded-full border border-[#6C3EC9]/70 bg-[#F1EDF7]/60 px-2.5 py-1 text-[10px] font-bold text-[#251045] transition-colors hover:bg-[#5B2EA6] hover:text-[#FFFFFF]"
                                >
                                  {level === 3 && destVendors.length > 0 ? "See what's here" : resolveAction(obj).label}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Save ${obj.title}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleExecuteProtocolAction('save', obj);
                                  }}
                                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D6CFE4]/35 bg-[#F1EDF7]/60 text-[#251045] transition-colors hover:border-[#6C3EC9] hover:text-[#251045]"
                                >
                                  <Bookmark className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <section className="mx-auto max-w-5xl py-10 text-center">
                    {searchQuery.trim() !== '' ? (
                      <>
                        <h2 className="text-base font-semibold text-[#251045]">Nothing nearby</h2>
                        <button
                          type="button"
                          onClick={() => handleCreatePursuit(searchQuery)}
                          className="mt-4 rounded-full border border-[#6C3EC9]/60 px-4 py-2 text-[11px] font-bold text-[#251045]"
                        >
                          Keep pursuing
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-[#251045]">Nothing nearby</h2>
                        <div className="mt-4 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCaptureOpen(true)}
                            className="rounded-full bg-[#5B2EA6] px-4 py-2 text-[11px] font-bold text-[#FFFFFF]"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* TEA */}
        {activeTab === 'nearby' && nearbySection === 'tea' && (
          <section className="space-y-4">
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-4 h-4 text-[#251045]" />
                <span className="text-[10px] text-[#251045]">
                  Tea
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                What people are talking about
              </h2>

              <p className="text-xs text-[#251045] mt-1">
                News, notices and neighbourhood chatter, alongside the
                directory. Posts link back to the places they are about.
              </p>
            </div>

            {/* Ticker (§5.2): a scrolling strip of live topics, each a door. */}
            <TickerBanner
              items={objects.slice(0, 12).map((o) => ({
                id: o.id,
                label: o.title,
                accent: o.category === 'Offer' || o.category === 'Opportunity' ? 'var(--tea)' : undefined
              }))}
              onOpen={(id) => {
                const obj = objects.find((o) => o.id === id);
                if (obj) setSelectedObjectForDetail(obj);
              }}
            />

            {/* Edition switcher */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {TEA_EDITIONS.map(({ edition, label, Icon }) => {
                const isActive = edition === activeEdition;
                const count = posts.filter((p) => p.edition === edition).length;

                return (
                  <button
                    key={edition}
                    onClick={() => setActiveEdition(edition)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition cursor-pointer ${
                      isActive
                        ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                        : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-extrabold whitespace-nowrap">
                      {label}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isActive ? 'text-[#FFFFFF]/70' : 'text-[#251045]/60'
                      }`}
                    >
                      {count}
                    </span>
                    {edition === liveEdition && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#251045]/60 px-1">
              <span className="font-extrabold">
                {getEditionMeta(activeEdition).label}
              </span>
              <span>
                {activeEdition === liveEdition
                  ? 'Live now'
                  : getEditionMeta(activeEdition).window}
              </span>
            </div>

            {/* Posts */}
            {editionPosts.map((post) => {
              const kindMeta = getPostKindMeta(post.kind);
              const subject = objects.find(
                (item) => item.id === post.relatedObjectId
              );
              const isLiked = likedPostIds.includes(post.id);

              return (
                <article
                  key={post.id}
                  className={`bg-[#FBFAFD] border rounded-2xl p-4 ${
                    post.isPromoted ? 'border-[#6C3EC9]' : 'border-[#D6CFE4]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-[#F1EDF7] ${kindMeta.tone}`}
                    >
                      {kindMeta.label}
                    </span>

                    <span className="text-[11px] font-bold text-[#251045]">
                      {post.authorName}
                    </span>

                    {post.authorIsVerified && (
                      <ShieldCheck className="w-3 h-3 text-[#251045] shrink-0" />
                    )}

                    <span className="text-[10px] text-[#251045]/60">
                      {getRelativeTime(post.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#251045] leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-[#251045] mt-1.5 leading-relaxed">
                    {post.body}
                  </p>

                  {post.isPromoted && (
                    <p className="text-[10px] text-[#251045] mt-2">
                      Paid distribution by {post.promotedBy}.
                    </p>
                  )}

                  {subject && (
                    <button
                      onClick={() => openPostSubject(post)}
                      className="mt-3 w-full flex items-center gap-2 bg-[#F1EDF7] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-xl p-2.5 transition cursor-pointer group text-left"
                    >
                      {subject.imageUrl && (
                        <img
                          src={subject.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-[#251045]/60">
                          About this {getObjectTypeMeta(subject.type).label}
                        </div>
                        <div className="text-[11px] font-extrabold truncate group-hover:text-[#251045]">
                          {subject.title}
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-[#251045] shrink-0" />
                    </button>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#D6CFE4]">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition ${
                        isLiked ? 'text-[#251045]' : 'text-[#251045]/60 hover:text-[#251045]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                      />
                      {formatCount(post.reactionsCount + (isLiked ? 1 : 0))}
                    </button>

                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#251045]/60">
                      No discussion yet
                    </span>

                    {post.tags && post.tags.length > 0 && (
                      <span className="ml-auto text-[10px] text-[#251045]/60 truncate">
                        {post.tags.map((tag) => `#${tag}`).join(' ')}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {editionPosts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[#D6CFE4] rounded-2xl">
                <Newspaper className="w-8 h-8 mx-auto mb-3 text-[#251045]/60" />
                <p className="text-sm font-bold">No tea in this edition yet.</p>
              </div>
            )}
          </section>
        )}

        {/* MY LAYER */}
        {activeTab === 'mylayer' && myLayerSection === 'saved' && (
          <section className="space-y-4">
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-4 h-4 text-[#251045]" />
                <span className="text-[10px] text-[#251045]">
                  Your saved things
                </span>
              </div>

              <h2 className="text-xl font-extrabold">Things you've kept.</h2>

              <p className="text-xs text-[#251045] mt-1">
                {savedObjects.length > 0
                  ? `${savedObjects.length} saved across ${savedGroups.length} ${
                      savedGroups.length === 1 ? 'section' : 'sections'
                    }.`
                  : 'Your saved places, opportunities and useful information.'}
              </p>
            </div>

            {savedGroups.map((group) => (
              <div key={group.label}>
                <div className="flex items-baseline gap-2 mb-2 px-1">
                  <h3 className="text-[11px] font-extrabold text-[#251045]">
                    {group.label}
                  </h3>
                  <span className="text-[10px] text-[#251045]/60">
                    {group.items.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((obj) => {
                    const action = resolveAction(obj);
                    const distance = getDistanceLabel(obj);

                    return (
                      <div
                        key={obj.id}
                        className="bg-[#FBFAFD] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-2xl p-3 transition"
                      >
                        <button
                          onClick={() => setSelectedObjectForDetail(obj)}
                          className="w-full text-left cursor-pointer group"
                        >
                          <div className="flex items-start gap-3">
                            {obj.imageUrl && (
                              <img
                                src={obj.imageUrl}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] text-[#251045]/60">
                                {obj.category}
                              </div>
                              <div className="text-xs font-extrabold mt-0.5 line-clamp-2 group-hover:text-[#251045]">
                                {obj.title}
                              </div>
                              {distance && (
                                <div className="text-[10px] text-[#251045]/60 mt-1">
                                  {distance}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 mt-3">
                          {action.kind === 'internal' || action.kind === 'none' ? (
                            <button
                              onClick={() => setSelectedObjectForDetail(obj)}
                              className="flex-1 py-2 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045] font-extrabold text-[11px] cursor-pointer"
                            >
                              View details
                            </button>
                          ) : (
                            <a
                              href={action.href}
                              target={action.kind === 'phone' ? undefined : '_blank'}
                              rel={
                                action.kind === 'phone'
                                  ? undefined
                                  : 'noopener noreferrer'
                              }
                              onClick={() =>
                                handleExecuteProtocolAction(
                                  action.kind === 'phone' ? 'contact' : 'discover',
                                  obj,
                                  { silent: true }
                                )
                              }
                              className="flex-1 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {action.label}
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            onClick={() => handleCreatePursuit(obj.title)}
                            title="Pursue similar"
                            className="p-2 rounded-xl bg-[#FBFAFD] text-[#251045] border border-[#D6CFE4] hover:border-[#6C3EC9] cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleUnsave(obj)}
                            title="Remove from saved"
                            className="p-2 rounded-xl bg-[#FBFAFD] text-[#251045] border border-[#D6CFE4] hover:border-[#6C3EC9] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Why this was saved (prompt 10). Optional: an
                            unlabelled save is a perfectly valid save, so this
                            is a quiet row of toggles, never a required step. */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {SAVE_LABELS.map((label) => {
                            const active = graph.savedLabel(obj.id) === label;
                            return (
                              <button
                                key={label}
                                onClick={() => handleSetSaveLabel(obj, label)}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                                  active
                                    ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                    : 'bg-transparent text-[#251045]/40 border-[#D6CFE4] hover:border-[#D6CFE4]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Activity (prompt 19). Derived from the same relationships,
                not a second history store. Secondary to saved objects. */}
            {(() => {
              const recent = graph.activity(6);
              if (recent.length === 0) return null;

              return (
                <div className="mt-8 pt-5 border-t border-[#D6CFE4]">
                  <p className="text-[10px] text-[#251045]/40 mb-3">
                    Recent activity
                  </p>
                  <div className="space-y-1.5">
                    {recent.map((entry) => (
                      <button
                        key={`${entry.object.id}_${entry.verb}`}
                        onClick={() => setSelectedObjectForDetail(entry.object)}
                        className="w-full text-left flex items-center gap-2 py-1.5 cursor-pointer"
                      >
                        <span className="text-[9px] text-[#251045] w-20 shrink-0">
                          {entry.verb}
                        </span>
                        <span className="text-[11px] text-[#251045]/60 truncate">
                          {entry.object.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {savedObjects.length === 0 && (
              <div className="py-14 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-3 text-[#251045]/40" />
                <p className="font-display text-lg font-semibold text-[#251045]">Nothing kept yet.</p>
                <p className="mt-1 text-xs text-[#251045]/60">
                  Save a place or opportunity and it will sit here, quiet and waiting.
                </p>
              </div>
            )}
          </section>
        )}

        {/* WORKFLOWS */}
        {activeTab === 'workflows' &&
          workflowView === 'screen' &&
          (workflowSection === 'active' || workflowSection === 'completed') && (
          <section className="space-y-5">
            <ActionsEngine
              online={connectorStatus.online}
              checked={connectorStatus.checked}
              capabilities={connectorStatus.capabilities as any}
              liveSourceCount={connectorStatus.liveSources.length}
              stats={connectorStatus.stats as any}
            />
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-[#251045]" />
                <span className="text-[10px] text-[#251045]">
                  Workflows
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                Things you can actually do.
              </h2>

              <p className="text-xs text-[#251045] mt-1">
                {workflowSection === 'completed'
                  ? 'Processes you have already finished.'
                  : 'Follow a process instead of figuring it out from scratch.'}
              </p>
            </div>

            {(workflowSection === 'completed' ? completedJourneys : activeJourneys)
              .length === 0 && (
              workflowSection === 'completed' ? (
                <p className="text-xs text-[#251045]/60">
                  Nothing finished yet. Your wins will collect here.
                </p>
              ) : (
                <PromptBanner
                  line1="Zero active. Your move."
                  line2="Connect a channel or capture the first thing — that's what fills this board."
                  action="Connect a source"
                  onAction={() => setWorkflowSection('sources')}
                />
              )
            )}

            {(workflowSection === 'completed' ? completedJourneys : activeJourneys).map((journey) => (
              <div
                key={journey.id}
                className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-[#251045]">
                        {journey.category}
                      </span>

                      <h3 className="text-lg font-extrabold mt-1">
                        {journey.title}
                      </h3>

                      <p className="text-xs text-[#251045] mt-1">
                        {journey.description}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-[#251045]">
                      {journey.progressPercent}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-[#F1EDF7] rounded-full mt-5 overflow-hidden">
                    <div
                      className="h-full bg-[#5B2EA6] rounded-full"
                      style={{ width: `${journey.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-[#D6CFE4]">
                  {journey.steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-4 border-b border-[#D6CFE4] last:border-b-0"
                    >
                      {step.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#251045] shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#251045]/60 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold">
                          {step.title}
                        </p>
                        <p className="text-[10px] text-[#251045]/60">
                          {step.description}
                        </p>
                      </div>

                      <span className="text-[9px] text-[#251045]">
                        {step.statusLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* INTELLIGENCE */}
        {activeTab === 'nearby' && nearbySection === 'quests' && (
          <Quests
            quests={quests}
            boardMode={boardMode}
            setBoardMode={setBoardMode}
            handleSubmitQuest={handleSubmitQuest}
            setActiveTab={setActiveTab}
            setArenaSection={setArenaSection}
          />
        )}

        {activeTab === 'arena' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">Arena</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                Gather with people to play. Not a competition — host challenges and run live match tests.
              </p>
            </div>

            {sessionUser && (
              <div id="arena-profile">
              <PlayAs
                displayName={sessionUser.displayName || 'you'}
                handle={sessionUser.handle}
                confirmed={playAsConfirmed}
                onConfirm={() => setPlayAsConfirmed(true)}
                gameName={arenaGame.name}
                gameId={arenaGame.id}
                tagDraft={tagDraft}
                onTagDraft={setTagDraft}
                onCreateTag={async () => {
                  setTagBusy(true);
                  const res = await briefApi.createArenaPlayer({
                    gameId: CLIENT_TO_SERVER_GAME[arenaGameId] ?? arenaGameId,
                    gamerTag: tagDraft.trim()
                  });
                  setTagBusy(false);
                  if (!res.ok) {
                    showToast(res.error ?? 'Could not save that tag.');
                    return;
                  }
                  setMyGameTag(tagDraft.trim());
                  setPlayAsConfirmed(true);
                  showToast('Game tag saved.');
                }}
                tagBusy={tagBusy}
                myTag={myGameTag}
                availabilityOn={availabilityOn}
                availabilityBusy={availabilityBusy}
                onToggleAvailability={() => void handleToggleAvailability()}
              />
              </div>
            )}

            <ArenaPulse />

            <ArenaShelf
              games={ARENA_GAMES}
              activity={arenaActivity}
              onOpen={(id) => { setArenaGameId(id); setArenaOpenGame(id); }}
            />

            {/* Secondary screen: the match-setup surface behind a shelf tile. */}
            {arenaOpenGame && (
              <ArenaGameScreen
                game={ARENA_GAMES.find((g) => g.id === arenaOpenGame) ?? ARENA_GAMES[0]}
                activity={arenaActivity[arenaOpenGame] ?? 0}
                challenges={challenges.filter(
                  (c) =>
                    c.gameId === arenaOpenGame ||
                    (SERVER_TO_CLIENT_GAME[c.gameId] ?? c.gameId) === arenaOpenGame
                )}
                myTag={myGameTag}
                availabilityOn={availabilityOn}
                availabilityBusy={availabilityBusy}
                busyId={arenaBusyId}
                myPlayerId={CURRENT_PLAYER_ID || null}
                onClose={() => setArenaOpenGame(null)}
                onCreateChallenge={(params) => void handleCreateChallenge(params)}
                onAcceptChallenge={(c) => void handleAcceptChallenge(c)}
                onCancelChallenge={(c) => void handleCancelChallenge(c)}
                onToggleAvailability={() => void handleToggleAvailability()}
                onViewLeaderboard={() => { setArenaSection('leaderboard'); setArenaOpenGame(null); }}
                onViewTournaments={() => { setArenaSection('tournaments'); setArenaOpenGame(null); }}
              />
            )}

            {/* Package 2: the high-frequency match queue */}
            <MatchQueuePanel
              gameName={arenaGame.name}
              latestChallenge={challenges.find((c) => c.status === 'open' || c.status === 'accepted') ?? challenges[0] ?? null}
              latestMatch={matches[0] ?? null}
              availabilityOn={availabilityOn}
              busy={availabilityBusy || arenaBusyId === 'create'}
              onEnterQueue={(params) => void handleCreateChallenge({ stake: params.stake, note: params.note })}
              onToggleAvailability={() => void handleToggleAvailability()}
            />

            {/* ARENA DIRECT TEST & CHALLENGE STUDIO */}
            <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#5B2EA6] text-[#FFFFFF] text-[10px] font-black">
                      ⚡
                    </span>
                    <h3 className="text-[14px] font-black text-[#251045] tracking-tight">
                      Arena Test & Challenge Studio
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#251045]/60 mt-0.5">
                    Configure and launch a live test match or challenge with all options listed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArenaTestCreatorOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[11px] font-extrabold text-[#251045] hover:border-[#6C3EC9] transition-colors cursor-pointer"
                >
                  {arenaTestCreatorOpen ? 'Close' : 'Create Test'}
                </button>
              </div>

              {arenaTestCreatorOpen && (
                <div className="space-y-3 pt-3 border-t border-[#E9E4F2]">
                  {/* Game Selection */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1.5">
                      Target Game
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {ARENA_GAMES.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setArenaTestGame(g.id);
                            setArenaTestMode(g.modes[0] ?? '1v1 Match');
                          }}
                          className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                            arenaTestGame === g.id
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9] shadow-xs'
                              : 'bg-[#F1EDF7] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]/40'
                          }`}
                        >
                          <p className="text-[11px] font-black truncate">{g.name}</p>
                          <p className={`text-[8.5px] truncate mt-0.5 ${arenaTestGame === g.id ? 'text-[#FFFFFF]/70' : 'text-[#251045]/50'}`}>
                            {g.modes.length} modes
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode / Format Selection */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1.5">
                      Match Format & Mode
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ...(ARENA_GAMES.find((g) => g.id === arenaTestGame)?.modes ?? ['1v1 Match']),
                        'Beta Pilot Duel',
                        'Clan Test'
                      ]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setArenaTestMode(m)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                            arenaTestMode === m
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]/40'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stake / Tier Selection */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1.5">
                      Test Tier & Stake
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        ['friendly', 'Friendly Test', 'Free match'],
                        ['ranked', 'Ranked Challenge', 'Elo points'],
                        ['entry_fee', 'Prize Stake', 'KES fee']
                      ] as [ArenaStakeKind, string, string][]).map(([s, label, hint]) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setArenaTestStake(s)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            arenaTestStake === s
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4] hover:border-[#6C3EC9]/40'
                          }`}
                        >
                          <p className="text-[11px] font-black">{label}</p>
                          <p className={`text-[8.5px] ${arenaTestStake === s ? 'text-[#FFFFFF]/70' : 'text-[#251045]/50'}`}>{hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entry fee input if prize stake */}
                  {arenaTestStake === 'entry_fee' && (
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1">
                        Entry Fee / Prize Stake (KES)
                      </label>
                      <div className="flex items-center gap-2">
                        {['50', '100', '200', '500'].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setArenaTestFee(amt)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                              arenaTestFee === amt
                                ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                                : 'bg-[#F1EDF7] text-[#251045] border-[#D6CFE4]'
                            }`}
                          >
                            KES {amt}
                          </button>
                        ))}
                        <input
                          type="number"
                          value={arenaTestFee}
                          onChange={(e) => setArenaTestFee(e.target.value)}
                          placeholder="Amount"
                          className="w-24 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#D6CFE4] focus:border-[#6C3EC9] outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Rules / Notes */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1">
                      Match Notes & Objectives (Optional)
                    </label>
                    <input
                      type="text"
                      value={arenaTestRules}
                      onChange={(e) => setArenaTestRules(e.target.value)}
                      placeholder="e.g. Test new squad, 90 mins, no extra time"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#D6CFE4] focus:border-[#6C3EC9] outline-none"
                    />
                  </div>

                  {/* Duration Window */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#251045]/50 mb-1">
                      Time Window
                    </label>
                    <div className="flex gap-1.5">
                      {[
                        [30, '30m'],
                        [60, '1 hr'],
                        [120, '2 hrs'],
                        [1440, '24 hrs']
                      ].map(([mins, lbl]) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setArenaTestDuration(Number(mins))}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                            arenaTestDuration === mins
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#F1EDF7] text-[#251045] border-[#D6CFE4]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Launch button */}
                  <button
                    type="button"
                    disabled={arenaBusyId === 'create'}
                    onClick={() => void handleLaunchArenaTest()}
                    className="w-full py-3 rounded-xl bg-[#5B2EA6] hover:bg-[#000000] text-[#FFFFFF] text-xs font-black cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {arenaBusyId === 'create' ? 'Launching…' : '🚀 Launch Arena Test Match'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {([
                ['lobby', 'Lobby'],
                ['epl', 'EPL'],
                ['challenges', `Challenges${challenges.length > 0 ? ` (${challenges.length})` : ''}`],
                ['tournaments', `Tournaments${arenaTournaments.length > 0 ? ` (${arenaTournaments.length})` : ''}`],
                ['leaderboard', 'Leaderboard']
              ] as [typeof arenaSection, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setArenaSection(key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                    arenaSection === key
                      ? 'bg-[#FBFAFD] text-[#251045] border-[#6C3EC9]'
                      : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {arenaSection === 'epl' && (
              <EplDesk meId={sessionUser?.id ?? null} onToast={showToast} />
            )}

            {arenaSection === 'lobby' && (
              <LobbyBoard gameId={({ pubg: 'pubg_mobile', cod: 'cod_mobile', ea_fc: 'fc_mobile' } as Record<string, string>)[arenaGameId] ?? arenaGameId} />
            )}

            {arenaSection === 'challenges' && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={arenaBusyId === 'create'}
                  onClick={() => void handleCreateChallenge()}
                  className="w-full h-10 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] text-[12px] font-extrabold cursor-pointer disabled:opacity-40"
                >
                  {arenaBusyId === 'create' ? 'Opening…' : `Open a ${arenaGame.modes[0] ?? '1v1'} challenge`}
                </button>
                {challenges.length === 0 && (
                  <p className="text-xs text-[#251045]/60">No open challenges for {arenaGame.name} right now.</p>
                )}
                {challenges.map((c) => {
                  const mine = Boolean(CURRENT_PLAYER_ID) && c.createdByPlayerId === CURRENT_PLAYER_ID;
                  const expired = Boolean(c.openUntil) && c.openUntil <= new Date().toISOString();
                  const taken = c.status === 'accepted' || Boolean(c.acceptedByPlayerId);
                  return (
                    <div key={c.id} className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#251045]">{c.mode} · {c.stake === 'friendly' ? 'Friendly' : c.stake === 'ranked' ? 'Ranked' : 'Entry fee'}</p>
                        {c.entryFeeKes ? <p className="text-[10px] text-[#251045]/60">KES {c.entryFeeKes}</p> : null}
                        <p className="text-[10px] text-[#251045]/60 mt-0.5">
                          {mine ? 'Your challenge' : 'Open challenge'}
                          {expired ? ' · expired' : ''}
                          {taken ? ' · taken' : ''}
                        </p>
                      </div>
                      {mine ? (
                        <button
                          type="button"
                          disabled={arenaBusyId === c.id || taken || c.status === 'cancelled'}
                          onClick={() => void handleCancelChallenge(c)}
                          className="shrink-0 px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[#251045] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={arenaBusyId === c.id || expired || taken}
                          onClick={() => void handleAcceptChallenge(c)}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                          title={expired ? 'This challenge has expired' : taken ? 'Already accepted' : undefined}
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {arenaSection === 'tournaments' && (
              <div className="space-y-2">
                {arenaTournaments.filter((t) => !t.gameId || (SERVER_TO_CLIENT_GAME[t.gameId] ?? t.gameId) === arenaGameId).length === 0 && (
                  <p className="text-xs text-[#251045]/60">No tournaments yet for {arenaGame.name}.</p>
                )}
                {arenaTournaments.filter((t) => !t.gameId || (SERVER_TO_CLIENT_GAME[t.gameId] ?? t.gameId) === arenaGameId).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenedTournament(t)}
                    className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 cursor-pointer"
                  >
                    <p className="text-xs font-extrabold text-[#251045]">{t.title}</p>
                    {t.startsAt && <p className="text-[10px] text-[#251045]/60 mt-0.5">{t.startsAt.slice(0, 16).replace('T', ' ')}</p>}
                    <p className="text-[10px] text-[#251045] mt-1">Open</p>
                  </button>
                ))}
                {openedTournament && (
                  <div className="bg-[#FBFAFD] border border-[#6C3EC9] rounded-2xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#251045]">{openedTournament.title}</p>
                        <p className="text-[10px] text-[#251045]/60 mt-0.5">
                          {openedTournament.status || 'open'}
                          {openedTournament.startsAt ? ` · ${String(openedTournament.startsAt).slice(0, 16).replace('T', ' ')}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenedTournament(null)}
                        className="text-[10px] font-extrabold text-[#251045]/60 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    {openedTournament.maxPlayers != null && (
                      <p className="text-[11px] text-[#251045]/60">Cap {openedTournament.maxPlayers}</p>
                    )}
                    <p className="text-[11px] text-[#251045]/60 leading-snug">
                      Registration is not on the server yet. Brief will not pretend you can join.
                    </p>
                  </div>
                )}
              </div>
            )}

            {arenaSection === 'leaderboard' && (
              <div className="space-y-2">
                <SeasonStrip />
                {arenaLeaderboard.length === 0 && (
                  <p className="text-xs text-[#251045]/60">No confirmed results yet for {arenaGame.name}.</p>
                )}
                {arenaLeaderboard.map((row, i) => (
                  <button
                    key={row.playerId}
                    type="button"
                    onClick={() => setOpenedStanding(row)}
                    className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-[#251045]/40 w-4">{i + 1}</span>
                      <span className="text-xs font-extrabold text-[#251045]">{row.player}</span>
                    </div>
                    <span className="text-[10px] text-[#251045]/60">{row.won} won · {row.played} played</span>
                  </button>
                ))}
                {openedStanding && (
                  <div className="bg-[#FBFAFD] border border-[#6C3EC9] rounded-2xl p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-extrabold text-[#251045]">{openedStanding.player}</p>
                      <button
                        type="button"
                        onClick={() => setOpenedStanding(null)}
                        className="text-[10px] font-extrabold text-[#251045]/60 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    <p className="text-[11px] text-[#251045]/60">
                      {openedStanding.won} won · {openedStanding.played} played
                      {typeof openedStanding.winRate === 'number' ? ` · ${Math.round(openedStanding.winRate * 100)}%` : ''}
                    </p>
                    <p className="text-[10px] text-[#251045]/40">Confirmed results only. Brief does not invent a rating.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'activity' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">My Activity</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                What you have saved, watched and acted on.
              </p>
            </div>
            {relationships.length === 0 && (
              <p className="text-xs text-[#251045]/60">Nothing yet.</p>
            )}
            <div className="space-y-2">
              {[...relationships]
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .map((rel) => {
                  const obj = objects.find((o) => o.id === rel.targetId);
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      disabled={!obj}
                      onClick={() => {
                        if (obj) setSelectedObjectForDetail(obj);
                      }}
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center gap-3 text-left cursor-pointer disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="text-[9px] text-[#251045] shrink-0">
                        {rel.verb}
                      </span>
                      <p className="text-xs text-[#251045] flex-1 min-w-0 truncate">
                        {obj ? obj.title : rel.targetId}
                      </p>
                      <span className="text-[9px] text-[#251045]/40 shrink-0">
                        {rel.updatedAt.slice(0, 10)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* MY LAYER > ARENA. Your standing in Arena gathered in one section:
            rank, points, and match history. This is a view of existing Arena
            state, not a second Arena -- playing still happens in Arena. */}
        {activeTab === 'mylayer' && myLayerSection === 'arena' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">Your Arena</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                Your matches. Play is recorded when both players confirm a result.
              </p>
            </div>
            <h3 className="text-[11px] font-extrabold text-[#251045]/40">
              My Matches
            </h3>
            {matches.length === 0 && (
              <p className="text-xs text-[#251045]/60">
                No matches yet. Accept a challenge in Arena to start one.
              </p>
            )}
            <div className="space-y-2">
              {matches.map((m) => {
                const me = CURRENT_PLAYER_ID;
                const status = m.status ?? (isResultConfirmed(m) ? 'confirmed' : 'scheduled');
                const iReported = Boolean(me) && m.reportedBy === me;
                const waiting = status === 'reported' && iReported;
                const canConfirm = status === 'reported' && Boolean(me) && !iReported;
                const canReport = status === 'scheduled' && Boolean(me);
                const opponent = m.playerAId === me ? m.playerBId : m.playerAId;
                return (
                  <div key={m.id} className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 space-y-2">
                    <p className="text-xs text-[#251045]">
                      {arenaPlayerLabel(m.playerAId, me || null, m.playerAName)} vs {arenaPlayerLabel(m.playerBId, me || null, m.playerBName)}
                    </p>
                    <p className="text-[10px] text-[#251045]/60">
                      {status === 'confirmed'
                        ? (m.scoreLine || 'Confirmed')
                        : status === 'disputed'
                        ? 'Players disagreed. Brief does not pick a winner.'
                        : status === 'abandoned'
                        ? 'Abandoned'
                        : waiting
                        ? 'Waiting for the other player to confirm'
                        : 'Result not confirmed by both players'}
                    </p>
                    {canReport && (
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, me)} className="px-2.5 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">I won</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, opponent ?? null)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">They won</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleReportMatch(m, null)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">Draw</button>
                        <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleAbandonMatch(m)} className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045]/60 text-[10px] font-extrabold cursor-pointer disabled:opacity-40">Never happened</button>
                      </div>
                    )}
                    {canConfirm && (
                      <button type="button" disabled={arenaBusyId === m.id} onClick={() => void handleConfirmMatch(m)} className="px-3 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">
                        Confirm result
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'points' && (
          <RewardsDesk
            settledPoints={myContribution.settledPoints}
            rank={myRank}
            accepted={myContribution.accepted}
            pending={pendingCount}
          />
        )}

        {activeTab === 'mylayer' && myLayerSection === 'circles' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Circles />
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'events' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <EventsHub />
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'market' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Marketplace />
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'mshikano' && (
          <MshikanoDesk />
        )}

        {activeTab === 'mylayer' && myLayerSection === 'groups' && (
          <ConnectedGroups
            visibleGroups={visibleGroups}
            groupIndexes={groupIndexes}
            openGroup={openGroup}
            setOpenGroupId={setOpenGroupId}
            groupIndex={groupIndex}
            unansweredQuestions={unansweredQuestions}
            handleRevokeGroup={handleRevokeGroup}
            handleSaveGroupEntry={handleSaveGroupEntry}
            handleViewSource={handleViewSource}
            commandResult={commandResult}
            setCommandResult={setCommandResult}
            commandText={commandText}
            setCommandText={setCommandText}
            getUnansweredQuestions={getUnansweredQuestions}
            groupMessages={GROUP_MESSAGES}
            formatSourceDate={formatSourceDate}
            handleRunCommand={handleRunCommand}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
          />
        )}

        {activeTab === 'mylayer' && myLayerSection === 'tickets' && (
          <MyTickets
            onSell={() => {
              // Selling is a Workflows → Sell act: the money side of the seat
              // lives with the rest of the money, not in the personal layer.
              setActiveTab('workflows');
              setWorkflowView('screen');
              setWorkflowSection('resale');
            }}
          />
        )}

        {activeTab === 'mylayer' && myLayerSection === 'campaigns' && (
          <div className="space-y-4">

            {/* CAMPAIGNS. Create something, publish it, share one link, watch
                who turns up. Every figure below is read from the server. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#251045]">Events</h2>
                <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                  Things you are putting out into the world. Publish once, share
                  one link, see who registered.
                </p>
              </div>
              <button
                onClick={() => {
                  setCampaignActionError(null);
                  setPublishedCampaign(null);
                  setDraft({
                    title: '', type: 'popup', description: '', location: '',
                    startsAt: '', capacity: '', price: '', circleId: ''
                  });
                  setObjectPicker({
                    open: false, status: 'idle', data: null, error: null, selected: null
                  });
                  setCreateStep('form');
                }}
                className="shrink-0 px-3 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>

            {campaignState.status === 'idle' && (
              <button
                onClick={loadCampaigns}
                className="w-full border border-[#D6CFE4] rounded-2xl p-4 text-xs font-extrabold text-[#251045] cursor-pointer"
              >
                Load my campaigns
              </button>
            )}

            {campaignState.status === 'loading' && (
              <div className="border border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">Loading campaigns...</p>
              </div>
            )}

            {campaignState.status === 'error' && (
              <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-2xl p-4 space-y-2">
                <p className="text-xs text-[#251045] font-extrabold">
                  Couldn't load campaigns. Try again.
                </p>
                <p className="text-[10px] text-[#251045]/60 break-words">
                  {campaignState.error}
                </p>
                <button
                  onClick={loadCampaigns}
                  className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {campaignState.status === 'ready' && (campaignState.data ?? []).length === 0 && (
              <div className="border border-dashed border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">You haven't created a campaign yet.</p>
              </div>
            )}

            {campaignState.status === 'ready' && campaignsLive.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Live
                </h3>
                {campaignsLive.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#251045] truncate">{c.title}</p>
                        <p className="text-[10px] text-[#251045]/60 mt-0.5 truncate">
                          {[c.location, c.startsAt ? c.startsAt.slice(0, 16).replace('T', ' ') : null]
                            .filter(Boolean)
                            .join(' \u00b7 ') || 'No place or time set'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] text-[#251045]">
                        {c.status}
                      </span>
                    </div>

                    {/* Capacity is printed from server values only. */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-[11px] text-[#251045]">
                        {c.metrics.slotsTaken}
                        {c.metrics.capacity === null ? ' registered' : ` / ${c.metrics.capacity}`}
                      </span>
                      <span className="text-[11px] text-[#251045]">
                        {c.metrics.currency} {c.metrics.revenueSettled.toLocaleString()} settled
                      </span>
                      {c.metrics.revenuePending > 0 && (
                        <span className="text-[11px] text-[#251045]">
                          {c.metrics.currency} {c.metrics.revenuePending.toLocaleString()} pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openCampaign(c.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => shareCampaign(c)}
                        className="px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel and remove this event?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsDraft.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Drafts
                </h3>
                {campaignsDraft.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#251045] truncate">
                        {c.title || 'Untitled'}
                      </p>
                      <p className="text-[9px] text-[#251045]/40 mt-0.5">
                        {c.type} - not published
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => { openCampaign(c.id); beginEdit(c); }}
                        className="px-3 py-1.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[10px] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        disabled={campaignBusy}
                        onClick={async () => {
                          setCampaignBusy(true);
                          setCampaignActionError(null);
                          const res = await briefApi.campaignAction(c.id, 'publish');
                          setCampaignBusy(false);
                          if (!res.ok) { setCampaignActionError(res.error); showToast(res.error); return; }
                          loadCampaigns();
                          showToast('Published');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel and remove this draft?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsPast.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#251045]/40">
                  Finished
                </h3>
                {campaignsPast.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-[#251045]/60 truncate">{c.title}</p>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => openCampaign(c.id)}
                        className="text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer"
                      >
                        {c.status}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Remove this finished event?')) {
                            void handleRemoveCampaign(c.id);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 font-extrabold text-[10px] cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'today' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#251045]">Today</h2>
              <p className="text-[11px] text-[#251045]/60 leading-snug mt-1">
                Only what relates to your pursuits, saved and watched things.
              </p>
            </div>

            {dailyBrief.length === 0 && (
              <div className="border border-dashed border-[#D6CFE4] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#251045]/60">Nothing to report.</p>
                <p className="text-[10px] text-[#251045]/40 mt-1">
                  Save something, or start a pursuit, and this fills itself in.
                </p>
              </div>
            )}

            {dailyBrief.map((section) => (
              <div key={section.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold text-[#251045]">
                    {section.title}
                  </h3>
                  <span className="text-[10px] text-[#251045]/60">
                    {section.objects.length + section.pursuits.length}
                  </span>
                </div>

                {section.objects.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] hover:border-[#D6CFE4] rounded-xl p-3 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[#251045]/40">
                        {getObjectTypeMeta(obj.type).label}
                      </span>
                      {getDistanceLabel(obj) && (
                        <span className="text-[9px] text-[#251045]/60">
                          {getDistanceLabel(obj)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-bold text-[#251045] leading-snug mt-0.5">
                      {obj.title}
                    </p>
                    {obj.metadata?.statusBadge && (
                      <p className="text-[10px] text-[#251045] mt-0.5">
                        {obj.metadata.statusBadge}
                      </p>
                    )}
                  </button>
                ))}

                {section.pursuits.map((pursuit) => (
                  <button
                    key={pursuit.id}
                    onClick={() => { setActiveTab('nearby'); setNearbySection('pursuits'); }}
                    className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 cursor-pointer"
                  >
                    <p className="text-[11px] text-[#251045]/60">{pursuit.query}</p>
                    <p className="text-[9px] text-[#251045]/40 mt-0.5">
                      Nothing useful yet. Brief is still looking.
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'mediakit' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <CreatorProfilePanel />
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'opportunities' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <OpportunitiesPanel />
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'messages' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <MessagesPanel />
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'verification' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <VerificationPanel />
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'subscriptions' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <SubscriptionsPanel />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'money' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <MoneyPanel />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'resale' && (
          <ResaleDesk />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'cockpit' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <CreatorCockpit />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'command' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <HostCommand />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'vault' && (
          <Vault />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'fees' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <ServiceFees />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'shop' && (
          <WhatsAppShopBuilder onOpenFees={() => setWorkflowSection('fees')} />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'tea' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <TeaDesk />
          </div>
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'engine' && (
          <EnginePanel
            // Deltas that touch the object stream silently refresh the home
            // feed — the "never loading" feel, wired to real data.
            onObjectsChanged={() => { void loadObjects(); }}
          />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'groupbuy' && (
          <GroupBuyPortal />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'gate' && (
          <CheckIn />
        )}

        {activeTab === 'workflows' &&
          workflowView === 'screen' &&
          ['campaigns', 'matches', 'distribution', 'calendar', 'vendors', 'ai'].includes(workflowSection) && (
            <div className="max-w-3xl mx-auto px-4 py-6">
              <YardEngineDesk section={workflowSection as YardSection} />
            </div>
          )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'sources' && (
          <SourcesPanel
            connectorStatus={connectorStatus}
            sources={sources}
            objects={objects}
            briefItText={briefItText}
            setBriefItText={setBriefItText}
            briefItPreview={briefItPreview}
            briefItBusy={briefItBusy}
            briefItSaved={briefItSaved}
            setBriefItPreview={setBriefItPreview}
            setBriefItSaved={setBriefItSaved}
            runBriefItPreview={runBriefItPreview}
            runBriefItSave={runBriefItSave}
            refreshConnectors={refreshConnectors}
            getSourceHealth={getSourceHealth}
            getSourceHealthLabel={getSourceHealthLabel}
          />
        )}

        {activeTab === 'nearby' && nearbySection === 'pursuits' && (
          <Pursuits
            pursuits={pursuits}
            pursuitResults={pursuitResults}
            pursuitDraft={pursuitDraft}
            setPursuitDraft={setPursuitDraft}
            handleCreatePursuit={handleCreatePursuit}
            handleRemovePursuit={handleRemovePursuit}
            handleSetPursuitStatus={handleSetPursuitStatus}
            handleTogglePursuitWatch={handleTogglePursuitWatch}
            handleTogglePursuitCondition={handleTogglePursuitCondition}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
          />
        )}

        {activeTab === 'workflows' && workflowView === 'screen' && workflowSection === 'inbox' && (
          <Inbox
            pendingCandidates={pendingCandidates}
            reviewed={reviewed}
            objects={objects}
            sources={sources}
            handleAcceptCandidate={handleAcceptCandidate}
            handleRejectCandidate={handleRejectCandidate}
            handleReceiveInbound={handleReceiveInbound}
            inboundBusy={inboundBusy}
          />
        )}

        </main>
      </div>

      {/* MOBILE DOCK. Five tabs. Hides while you read; a pull nub brings it back. */}
      <button
        type="button"
        aria-label="Show navigation"
        onClick={() => setDockOn(true)}
        className={`md:hidden fixed bottom-0 left-1/2 z-[55] -translate-x-1/2 h-5 w-16 rounded-t-full bg-[#FBFAFD] border border-b-0 border-[#D6CFE4] cursor-pointer transition-transform ${
          dockOn || isAnyModalActive ? 'translate-y-full pointer-events-none hidden' : ''
        } ${isAnyModalActive ? 'hidden' : ''}`}
      >
        <span className="mx-auto mt-1.5 block h-1 w-8 rounded-full bg-[#D1D5DB]" />
      </button>
      <nav
        aria-label="Primary"
        className={`md:hidden fixed bottom-0 inset-x-0 z-[55] bg-[#FBFAFD]/98 backdrop-blur-xl border-t border-[#D6CFE4] flex shadow-lg transition-transform duration-200 ${
          dockOn && !isAnyModalActive ? 'translate-y-0' : 'translate-y-full hidden pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v); setDockOn(true); }}
          aria-label="Menu"
          aria-expanded={menuOpen}
          title="Menu"
          className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
            menuOpen ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[12px] font-extrabold leading-none">Menu</span>
        </button>
        {DESTINATIONS.map((d) => {
          const active = activeTab === d.id;
          const Icon = DESTINATION_ICONS[d.id];
          return (
            <button
              key={d.id}
              onClick={() => goToDestination(d.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
                active ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                <span className="absolute -right-2 -top-1.5">
                  <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                </span>
              </span>
              <span className="text-[12px] font-extrabold leading-none">
                {d.label}
              </span>
              {(destinationAlerts[d.id] ?? 0) > 0 && (
                <span className="sr-only">
                  {destinationAlerts[d.id]} update{(destinationAlerts[d.id] ?? 0) > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* CAMPAIGN DASHBOARD. Every number is server-derived. Where the
          backend does not measure something, this says so rather than
          printing a zero that looks like a measurement. */}
      {openCampaignId && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={() => {
            setOpenCampaignId(null);
            setCampaignDetail(null);
            setEditDraft(null);
            setCampaignCircle({ status: 'idle', data: null, error: null });
          }}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-[#251045] truncate">
                  {campaignDetail ? campaignDetail.title : 'Campaign'}
                </h2>
                {campaignDetail && (
                  <p className="text-[9px] text-[#251045]/40 mt-0.5">
                    {campaignDetail.type} &middot; {campaignDetail.status}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setOpenCampaignId(null);
                  setCampaignDetail(null);
                  setEditDraft(null);
                }}
                className="shrink-0 p-1.5 rounded-full hover:bg-[#E9E4F2] text-[#251045]/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {campaignActionError && (
                <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-3">
                  <p className="text-[11px] font-bold break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {!campaignDetail && !campaignActionError && (
                <p className="text-xs text-[#251045]/60 py-6 text-center">Loading campaign...</p>
              )}

              {campaignDetail && editDraft && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Title</label>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Description</label>
                    <textarea
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      rows={2}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={editDraft.startsAt}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, startsAt: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Where</label>
                    <input
                      value={editDraft.location}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        disabled={campaignDetail.status !== 'draft'}
                        value={editDraft.capacity}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, capacity: e.target.value } : d))}
                        placeholder="Unlimited"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={editDraft.price}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, price: e.target.value } : d))}
                        placeholder="Free"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                  </div>
                  {campaignDetail.status !== 'draft' && (
                    <p className="text-[9px] text-[#251045]/40 leading-snug">
                      Spots cannot change after publishing. People have already
                      registered against this number.
                    </p>
                  )}
                </div>
              )}

              {campaignDetail && !editDraft && (
                <>
                  {campaignDetail.status !== 'draft' && (
                    <CampaignDistribution
                      compact
                      link={briefApi.campaignShareLink(campaignDetail.publicSlug, publicOrigin)}
                      title={campaignDetail.title}
                      onCopy={() => copyCampaignLink(campaignDetail.publicSlug, campaignDetail.id)}
                      onShare={(ch) => briefApi.shareCampaign(campaignDetail.id, ch)}
                      onNativeShare={() => shareCampaign(campaignDetail)}
                    />
                  )}

                  <button
                    onClick={() => beginEdit(campaignDetail)}
                    className="w-full py-2.5 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-[11px] cursor-pointer hover:bg-[#F4F1FA]"
                  >
                    Edit details
                  </button>

                  {campaignDetail.status === 'draft' && (
                    <button
                      disabled={campaignBusy}
                      onClick={async () => {
                        setCampaignBusy(true);
                        setCampaignActionError(null);
                        const res = await briefApi.campaignAction(campaignDetail.id, 'publish');
                        setCampaignBusy(false);
                        if (!res.ok) { setCampaignActionError(res.error); return; }
                        setCampaignDetail(res.data);
                        loadCampaigns();
                        showToast('Published');
                      }}
                      className="w-full py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000]"
                    >
                      {campaignBusy ? 'Publishing...' : 'Publish'}
                    </button>
                  )}

                  {/* PEOPLE */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      People
                    </h3>
                    <p className="text-xl font-extrabold text-[#251045]">
                      {campaignDetail.metrics.slotsTaken}
                      {campaignDetail.metrics.capacity !== null && (
                        <span className="text-[#251045]/40"> / {campaignDetail.metrics.capacity}</span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {([
                        ['Registered', campaignDetail.metrics.registrations],
                        ['Checked in', campaignDetail.metrics.checkedIn],
                        [
                          'Remaining',
                          campaignDetail.metrics.remaining === null
                            ? 'Unlimited'
                            : campaignDetail.metrics.remaining
                        ],
                        ['No-show', campaignDetail.metrics.noShows]
                      ] as [string, string | number][]).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">{label}</span>
                          <span className="text-[11px] text-[#251045]/60">{value}</span>
                        </div>
                      ))}
                    </div>
                    {campaignDetail.metrics.capacity !== null &&
                      campaignDetail.metrics.remaining === 0 && (
                        <p className="text-[10px] font-extrabold text-[#251045]">Full</p>
                      )}
                  </div>

                  {/* MONEY */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Money
                    </h3>
                    {campaignDetail.price === 0 ? (
                      <p className="text-[11px] text-[#251045]/60">
                        This is a free campaign. No money is collected.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">Settled</span>
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenueSettled.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#251045]/60">Pending</span>
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenuePending.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Pending is money that has not arrived.
                        </p>
                      </>
                    )}
                  </div>

                  {/* CAMPAIGN */}
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Campaign
                    </h3>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Page loads</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.views}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Different devices</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.viewers === null
                          ? 'Not enough data'
                          : campaignDetail.metrics.viewers}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Times you shared</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.shares}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Started registering</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.registrationsStarted}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#251045]/60">Page load to registration</span>
                      <span className="text-[11px] text-[#251045]/60">
                        {campaignDetail.metrics.conversionPct === null
                          ? 'Not enough data'
                          : `${campaignDetail.metrics.conversionPct}%`}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#251045]/40 leading-snug pt-1">
                      Different devices is a rough count, not people. Times you shared counts your own taps, not how many people saw it.
                    </p>
                  </div>

                  {/* WHAT PEOPLE ARE GETTING */}
                  {campaignDetail.object && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        What people get
                      </h3>
                      <p className="text-xs text-[#251045]">{campaignDetail.object.title}</p>
                      {campaignDetail.object.summary && (
                        <p className="text-[10px] text-[#251045]/60 leading-snug">
                          {campaignDetail.object.summary}
                        </p>
                      )}
                      <p className="text-[9px] text-[#251045]/40 pt-0.5">
                        {campaignDetail.object.type}
                        {campaignDetail.ownsObject === false && ' \u00b7 existing item'}
                      </p>
                      {campaignDetail.ownsObject === false && (
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Publishing the campaign does not change it.
                        </p>
                      )}

                      {!objectPicker.open ? (
                        <button
                          disabled={campaignBusy}
                          onClick={loadAttachableObjects}
                          className="text-[10px] text-[#251045] underline underline-offset-2 cursor-pointer disabled:opacity-40 pt-1"
                        >
                          Link a different item
                        </button>
                      ) : (
                        <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto mt-1">
                          {objectPicker.status === 'loading' && (
                            <p className="text-[11px] text-[#251045]/60 p-2">Loading your items...</p>
                          )}
                          {objectPicker.status === 'error' && (
                            <p className="text-[11px] text-[#251045] p-2">
                              Couldn't load your items. {objectPicker.error}
                            </p>
                          )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).length === 0 && (
                              <p className="text-[11px] text-[#251045]/60 p-2">
                                Nothing else to link yet.
                              </p>
                            )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).slice(0, 25).map((o: any) => (
                              <button
                                key={o.id}
                                disabled={campaignBusy}
                                onClick={() => attachObjectToCampaign(campaignDetail.id, o.id)}
                                className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#FBFAFD] cursor-pointer disabled:opacity-40"
                              >
                                <p className="text-[11px] text-[#251045] truncate">{o.title}</p>
                                <p className="text-[9px] text-[#251045]/40">
                                  {o.type}
                                </p>
                              </button>
                            ))}
                          <button
                            onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                            className="w-full text-[10px] text-[#251045]/60 py-1 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TARGET */}
                  {campaignCircle.status === 'loading' && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#251045]/60">Loading target...</p>
                    </div>
                  )}

                  {campaignCircle.status === 'error' && (
                    <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#251045]/40">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#251045]">Target unavailable.</p>
                      <p className="text-[9px] text-[#251045]/60 break-words">
                        {campaignCircle.error}
                      </p>
                    </div>
                  )}

                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    !(
                      campaignCircle.data.circle.targetValue !== null &&
                      campaignCircle.data.circle.targetValue > 0
                    ) && (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1">
                        <h3 className="text-[9px] text-[#251045]/40">
                          Target
                        </h3>
                        <p className="text-[11px] text-[#251045]">
                          {campaignCircle.data.circle.name}
                        </p>
                        <p className="text-[10px] text-[#251045]/60">
                          No target set on this circle.
                        </p>
                      </div>
                    )}

                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    campaignCircle.data.circle.targetValue !== null &&
                    campaignCircle.data.circle.targetValue > 0 && (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
                        <h3 className="text-[9px] text-[#251045]/40">
                          Target
                        </h3>
                        <p className="text-xs text-[#251045]">
                          {campaignCircle.data.circle.goal || campaignCircle.data.circle.name}
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-extrabold text-[#251045]">
                            {campaignCircle.data.circle.currentValue.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#251045]/40">
                            of {campaignCircle.data.circle.targetValue.toLocaleString()}
                          </span>
                        </div>
                        {campaignCircle.data.circle.progressPct !== null && (
                          <p className="text-[10px] text-[#251045]">
                            {Math.round(campaignCircle.data.circle.progressPct)}%
                          </p>
                        )}
                        <div className="h-1.5 rounded-full bg-[#D6CFE4] overflow-hidden">
                          <div
                            className="h-full bg-[#5B2EA6]"
                            style={{
                              width: `${Math.min(100, campaignCircle.data.circle.progressPct ?? 0)}%`
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-[#251045]/40 leading-snug">
                          Progress comes from settled transactions in
                          {' '}{campaignCircle.data.circle.name}, not from this campaign.
                        </p>
                      </div>
                    )}

                  {/* POST AN UPDATE (T3): the organiser's words land on the
                      public page — the loop supporters read. */}
                  <div className="space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Post an update
                    </h3>
                    <input
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      placeholder="Update title (e.g. Halfway there)"
                      aria-label="update title"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                    <textarea
                      value={updateBody}
                      onChange={(e) => setUpdateBody(e.target.value)}
                      placeholder="What the people supporting this should know"
                      aria-label="update body"
                      rows={3}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                    <button
                      type="button"
                      disabled={updateBusy || !updateTitle.trim() || !updateBody.trim()}
                      onClick={() => void postUpdate(campaignDetail.id)}
                      className="px-4 py-2 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                    >
                      {updateBusy ? 'Posting…' : 'Post update'}
                    </button>
                    {updateNote && <p className="text-[10px] text-[#251045]/60 break-words">{updateNote}</p>}
                  </div>

                  {/* REGISTRATIONS */}
                  <div className="space-y-2">
                    <h3 className="text-[9px] text-[#251045]/40">
                      Registrations
                    </h3>

                    {campaignRegs.status === 'loading' && (
                      <p className="text-[11px] text-[#251045]/60">Loading people...</p>
                    )}

                    {campaignRegs.status === 'error' && (
                      <div className="border border-[#D6CFE4] bg-[#FBFAFD] rounded-xl p-3 space-y-1">
                        <p className="text-[11px] text-[#251045]">Couldn't load registrations.</p>
                        <p className="text-[9px] text-[#251045]/60 break-words">
                          {campaignRegs.error}
                        </p>
                      </div>
                    )}

                    {campaignRegs.status === 'ready' &&
                      (campaignRegs.data ?? []).length === 0 && (
                        <p className="text-[11px] text-[#251045]/60">
                          Nobody has registered yet.
                        </p>
                      )}

                    {campaignRegs.status === 'ready' && campaignDetail.price > 0 && (
                      <AwaitingPayment
                        registrations={campaignRegs.data ?? []}
                        currency={campaignDetail.metrics.currency}
                        price={campaignDetail.price}
                        busy={campaignBusy}
                        onConfirmPayment={(regId) => confirmPayment(campaignDetail.id, regId)}
                      />
                    )}

                    {campaignRegs.status === 'ready' &&
                      (campaignRegs.data ?? []).map((r) => (
                        <div
                          key={r.id}
                          className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-[#251045] truncate">
                              {r.name || r.attendeeRef}
                            </p>
                            <p className="text-[9px] text-[#251045]/40 mt-0.5">
                              {r.status.replace('_', ' ')}
                            </p>
                          </div>
                          {(r.status === 'registered' || r.status === 'confirmed') && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'checked_in')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                              >
                                Check in
                              </button>
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'no_show')}
                                className="px-2.5 py-1.5 rounded-lg border border-[#D6CFE4] text-[#251045]/60 font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                              >
                                No-show
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {(campaignDetail.status === 'published' || campaignDetail.status === 'live') && (
                    <button
                      disabled={campaignBusy}
                      onClick={async () => {
                        setCampaignBusy(true);
                        const res = await briefApi.campaignAction(campaignDetail.id, 'close');
                        setCampaignBusy(false);
                        if (!res.ok) { setCampaignActionError(res.error); return; }
                        setCampaignDetail(res.data);
                        loadCampaigns();
                      }}
                      className="w-full py-2.5 rounded-xl border border-[#D6CFE4] text-[#251045]/60 font-extrabold text-[11px] cursor-pointer disabled:opacity-40"
                    >
                      Close campaign
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Sticky Action Footer */}
            {campaignDetail && editDraft && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    disabled={campaignBusy}
                    onClick={() => setEditDraft(null)}
                    className="flex-1 py-3 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#F4F1FA] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={campaignBusy || editDraft.title.trim() === ''}
                    onClick={() => saveCampaignEdit(campaignDetail)}
                    className="flex-[2] py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000] transition-colors shadow-xs"
                  >
                    {campaignBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <button
                  disabled={campaignBusy}
                  onClick={() => {
                    if (window.confirm('Cancel and remove this event?')) {
                      void handleRemoveCampaign(campaignDetail.id);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[11px] cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  Cancel & Remove Event
                </button>
              </div>
            )}

            {campaignDetail && !editDraft && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 flex items-center gap-2">
                <button
                  disabled={campaignBusy}
                  onClick={() => {
                    if (window.confirm('Cancel and remove this event?')) {
                      void handleRemoveCampaign(campaignDetail.id);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-extrabold text-[11px] cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  Cancel & Remove Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN. Type -> details -> preview -> publish. The preview
          is a screen, not a saved object: nothing reaches the server until
          Publish, and publication itself is the real transition endpoint. */}
      {createStep !== 'closed' && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <h2 className="text-base font-extrabold text-[#251045]">
                {createStep === 'form'
                  ? 'Create'
                  : createStep === 'preview'
                  ? 'Preview'
                  : 'Published'}
              </h2>
              <button
                onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
                className="shrink-0 p-1.5 rounded-full hover:bg-[#E9E4F2] text-[#251045]/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {campaignActionError && (
                <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-3">
                  <p className="text-[10px] font-bold break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {createStep === 'form' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">What is it</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['popup', 'session', 'drop', 'event'] as ApiCampaignType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft((d) => ({ ...d, type: t }))}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                            draft.type === t
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#FBFAFD] text-[#251045] border-[#D6CFE4]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Title</label>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Saturday plant sale"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Description</label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={2}
                      placeholder="One or two lines. What should people expect?"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">
                      What people get
                    </label>
                    {objectPicker.selected ? (
                      <div className="flex items-center justify-between gap-2 bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2.5">
                        <p className="text-xs text-[#251045] truncate">
                          {objectPicker.selected.title}
                        </p>
                        <button
                          onClick={() =>
                            setObjectPicker((p) => ({ ...p, selected: null, open: false }))
                          }
                          className="shrink-0 text-[10px] text-[#251045]/60 underline underline-offset-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : !objectPicker.open ? (
                      <button
                        onClick={loadAttachableObjects}
                        className="w-full text-left bg-[#FBFAFD] border border-dashed border-[#D6CFE4] rounded-xl px-3 py-2.5 text-[11px] text-[#251045]/60 cursor-pointer"
                      >
                        Something new &middot; tap to link an existing item instead
                      </button>
                    ) : (
                      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto">
                        {objectPicker.status === 'loading' && (
                          <p className="text-[11px] text-[#251045]/60 p-2">Loading your items...</p>
                        )}
                        {objectPicker.status === 'error' && (
                          <p className="text-[11px] text-[#251045] p-2">
                            Couldn't load your items. {objectPicker.error}
                          </p>
                        )}
                        {objectPicker.status === 'ready' &&
                          (objectPicker.data ?? []).length === 0 && (
                            <p className="text-[11px] text-[#251045]/60 p-2">
                              Nothing to link yet. Carry on and describe it above.
                            </p>
                          )}
                        {objectPicker.status === 'ready' &&
                          (objectPicker.data ?? []).slice(0, 25).map((o: any) => (
                            <button
                              key={o.id}
                              onClick={() =>
                                setObjectPicker((p) => ({
                                  ...p,
                                  selected: { id: o.id, title: o.title },
                                  open: false
                                }))
                              }
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#FBFAFD] cursor-pointer"
                            >
                              <p className="text-[11px] text-[#251045] truncate">{o.title}</p>
                              <p className="text-[9px] text-[#251045]/40">
                                {o.type}
                              </p>
                            </button>
                          ))}
                        <button
                          onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                          className="w-full text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#251045]/40 mb-1">Where</label>
                    <input
                      value={draft.location}
                      onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                      placeholder="Kilimani, Nairobi"
                      className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        value={draft.capacity}
                        onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))}
                        placeholder="Unlimited"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#251045]/40 mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                        placeholder="Free"
                        className="w-full bg-[#FBFAFD] text-[#251045] text-xs rounded-xl px-3 py-2.5 border border-[#D6CFE4] focus:border-[#6C3EC9] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {createStep === 'preview' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#251045]/60">
                    This is what people will see. Nothing is public yet.
                  </p>
                  <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-1.5">
                    <p className="text-[9px] text-[#251045]/40">{draft.type}</p>
                    <p className="text-sm font-extrabold text-[#251045]">{draft.title}</p>
                    {draft.description && (
                      <p className="text-[11px] text-[#251045]/60 leading-snug">{draft.description}</p>
                    )}
                    <div className="pt-1 space-y-0.5">
                      {draft.startsAt && (
                        <p className="text-[10px] text-[#251045]">
                          {draft.startsAt.replace('T', ' ')}
                        </p>
                      )}
                      {draft.location && (
                        <p className="text-[10px] text-[#251045]">{draft.location}</p>
                      )}
                      <p className="text-[10px] text-[#251045]">
                        {draft.price.trim() === '' || Number(draft.price) === 0
                          ? 'Free'
                          : `KES ${draft.price}`}
                        {draft.capacity.trim() !== '' && ` \u00b7 ${draft.capacity} spots`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {createStep === 'published' && publishedCampaign && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#251045] shrink-0" />
                    <p className="text-xs font-extrabold text-[#251045]">
                      {publishedCampaign.title} is {publishedCampaign.status}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#251045]/60">
                    Share this link anywhere. Anyone who opens it can register.
                  </p>
                  {(() => {
                    const link = briefApi.campaignShareLink(
                      publishedCampaign.publicSlug,
                      publicOrigin
                    );
                    return (
                      <CampaignDistribution
                        link={link}
                        title={publishedCampaign.title}
                        onCopy={() =>
                          copyCampaignLink(publishedCampaign.publicSlug, publishedCampaign.id)
                        }
                        onShare={(ch) => briefApi.shareCampaign(publishedCampaign.id, ch)}
                        onNativeShare={() => shareCampaign(publishedCampaign)}
                      />
                    );
                  })()}
                  <button
                    onClick={() => { setCreateStep('closed'); openCampaign(publishedCampaign.id); }}
                    className="w-full text-[10px] text-[#251045]/40 underline underline-offset-2 cursor-pointer"
                  >
                    Open campaign
                  </button>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            {createStep === 'form' && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0">
                <button
                  disabled={draft.title.trim() === ''}
                  onClick={() => { setCampaignActionError(null); setCreateStep('preview'); }}
                  className="w-full py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#000000] transition-colors"
                >
                  Preview
                </button>
              </div>
            )}

            {createStep === 'preview' && (
              <div className="p-4 pb-safe pb-8 sm:pb-4 border-t border-[#D6CFE4] bg-[#FBFAFD] shrink-0 flex items-center gap-2">
                <button
                  disabled={campaignBusy}
                  onClick={() => setCreateStep('form')}
                  className="px-4 py-3 rounded-xl border border-[#D6CFE4] text-[#251045] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#F4F1FA]"
                >
                  Back
                </button>
                <button
                  disabled={campaignBusy}
                  onClick={publishDraft}
                  className="flex-1 py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs cursor-pointer disabled:opacity-40 hover:bg-[#000000]"
                >
                  {campaignBusy ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAPTURE: the easiest way into Brief. Quick drop or direct post creation. */}
      {captureOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={handleCaptureCancel}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[#D6CFE4] shrink-0 flex items-start justify-between gap-3 bg-[#FBFAFD]">
              <div>
                <h2 className="text-xl font-extrabold text-[#251045]">
                  {captureMode === 'quick' ? 'Drop something here.' : 'Create news or post.'}
                </h2>
                <p className="text-[11px] text-[#251045]/60 mt-1">
                  {captureMode === 'quick'
                    ? 'A message, link, listing, event, opportunity or anything worth keeping.'
                    : 'Publish updates, news bulletins, opportunities or stories directly into Brief.'}
                </p>
              </div>
              <button
                onClick={handleCaptureCancel}
                className="p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4] shrink-0 hover:bg-[#E9E4F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 pb-safe pb-8 sm:pb-5">
              {/* Mode switcher */}
              <div className="flex rounded-xl bg-[#E9E4F2] p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setCaptureMode('quick'); setCapturePreview(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    captureMode === 'quick' ? 'bg-[#FBFAFD] text-[#251045] shadow-xs' : 'text-[#251045]/60 hover:text-[#251045]'
                  }`}
                >
                  Quick Capture
                </button>
                <button
                  type="button"
                  onClick={() => { setCaptureMode('direct'); setCapturePreview(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    captureMode === 'direct' ? 'bg-[#FBFAFD] text-[#251045] shadow-xs' : 'text-[#251045]/60 hover:text-[#251045]'
                  }`}
                >
                  Post News / Update
                </button>
              </div>

              {captureMode === 'quick' ? (
                <>
                  <textarea
                    value={captureText}
                    onChange={(e) => {
                      setCaptureText(e.target.value);
                      setCapturePreview(null);
                    }}
                    rows={5}
                    placeholder="Paste or type anything (e.g. news update, meetup announcement, listing...)"
                    className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2.5 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9] resize-none"
                  />

                  {!capturePreview && (
                    <button
                      onClick={handleCaptureParse}
                      disabled={captureText.trim() === ''}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs transition ${
                        captureText.trim() === ''
                          ? 'bg-[#FBFAFD] text-[#251045]/40 cursor-not-allowed border border-[#D6CFE4]'
                          : 'bg-[#5B2EA6] text-[#FFFFFF] cursor-pointer hover:bg-[#000000]'
                      }`}
                    >
                      Read it
                    </button>
                  )}

                  {/* Confirmation step. Brief shows exactly what it understood and
                      waits -- nothing is saved until the user agrees. */}
                  {capturePreview && (
                    <div className="space-y-3">
                      {!capturePreview.isObjectWorthy ? (
                        <div className="border border-[#D6CFE4] bg-[#F1EDF7] rounded-xl p-3">
                          <p className="text-[11px] font-bold text-[#251045]">
                            Brief could not make an object from this.
                          </p>
                          <p className="text-[10px] text-[#251045]/60 mt-1">
                            {capturePreview.rejectionReason}
                          </p>
                          <p className="text-[10px] text-[#251045]/40 mt-1">
                            Nothing was saved.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCaptureMode('direct');
                              setDirectTitle(captureText.slice(0, 60));
                            }}
                            className="mt-2.5 inline-flex items-center text-[11px] font-extrabold text-[#251045] underline cursor-pointer"
                          >
                            Create directly as news or post instead →
                          </button>
                        </div>
                      ) : (
                        <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl p-3 space-y-2">
                          <p className="text-[9px] text-[#251045] font-bold uppercase tracking-wider">
                            {getObjectTypeMeta(capturePreview.draft.type).label}
                          </p>
                          <p className="text-sm font-extrabold text-[#251045] leading-snug">
                            {capturePreview.draft.title}
                          </p>

                          {capturePreview.extracted
                            .filter((f) => f.field !== 'title')
                            .map((f) => (
                              <div
                                key={f.field}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span className="text-[10px] text-[#251045]/60">
                                  {f.field}
                                </span>
                                <span className="text-[10px] text-[#251045]/60 truncate">
                                  {f.value}
                                </span>
                              </div>
                            ))}

                          {capturePreview.duplicates.length > 0 && (
                            <p className="text-[10px] text-[#251045]">
                              Possible duplicate of{' '}
                              {capturePreview.duplicates[0].item.title}
                            </p>
                          )}

                          <p className="text-[9px] text-[#251045]/40">
                            Unverified. Saved as your own capture.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleCaptureCancel}
                          className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] cursor-pointer"
                        >
                          Discard
                        </button>
                        {capturePreview.isObjectWorthy && (
                          <button
                            onClick={() => void handleCaptureConfirm()}
                            className="flex-[2] py-2.5 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-[11px] cursor-pointer hover:bg-[#000000]"
                          >
                            Save to Brief
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Direct Post / News Creation */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Post Type
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ['knowledge', 'News / Bulletin', 'News'],
                        ['community', 'Community Post', 'Community'],
                        ['experience', 'Event / Meetup', 'Event'],
                        ['opportunity', 'Opportunity', 'Opportunity'],
                        ['service', 'Service Offer', 'Service']
                      ] as [ObjectType, string, string][]).map(([typeVal, label, catVal]) => (
                        <button
                          key={typeVal}
                          type="button"
                          onClick={() => {
                            setDirectType(typeVal);
                            setDirectCategory(catVal);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer border ${
                            directType === typeVal
                              ? 'bg-[#5B2EA6] text-[#FFFFFF] border-[#6C3EC9]'
                              : 'bg-[#F1EDF7] text-[#251045]/70 border-[#D6CFE4] hover:text-[#251045]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Title / Headline <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={directTitle}
                      onChange={(e) => setDirectTitle(e.target.value)}
                      placeholder="e.g. Community Tech Meetup this Saturday"
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Post Details / Content <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={captureText}
                      onChange={(e) => setCaptureText(e.target.value)}
                      rows={4}
                      placeholder="Write your news or post details here..."
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#251045]/60 mb-1">
                      Location / Venue (Optional)
                    </label>
                    <input
                      type="text"
                      value={directLocation}
                      onChange={(e) => setDirectLocation(e.target.value)}
                      placeholder="e.g. Alchemist Bar, Westlands, Nairobi"
                      className="w-full bg-[#FBFAFD] border border-[#D6CFE4] rounded-xl px-3 py-2 text-xs text-[#251045] placeholder:text-[#251045]/40 outline-none focus:border-[#6C3EC9]"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCaptureCancel}
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!directTitle.trim() || !captureText.trim()}
                      onClick={() => void handleDirectPost()}
                      className={`flex-[2] py-2.5 rounded-xl font-extrabold text-[11px] transition ${
                        !directTitle.trim() || !captureText.trim()
                          ? 'bg-[#D6CFE4] text-[#251045]/40 cursor-not-allowed'
                          : 'bg-[#5B2EA6] text-[#FFFFFF] cursor-pointer hover:bg-[#000000]'
                      }`}
                    >
                      Publish to Brief
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Package 3: the dynamic ticket bar — the active gate pass, locked to
          the bottom of the screen, with inline delta alerts. */}
      <TicketBar />

      {/* DETAIL LAYER */}
      {selectedTeaSlug && (
        <TeaReader slug={selectedTeaSlug} onClose={dismissOverlay} />
      )}

      {selectedObjectForDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#150826]/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden"
          onClick={dismissOverlay}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#FBFAFD] border border-[#D6CFE4] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl mb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 pb-safe pb-8 sm:pb-5">
              {/* Hero — the cover photo, or the first real gallery image when
                  a news story has photos but no cover. */}
              {(() => {
                const heroUrl = selectedObjectForDetail.imageUrl
                  ?? selectedObjectForDetail.gallery?.[0]?.url
                  ?? null;
                if (!heroUrl) return null;
                return (
                  <div className="relative h-56 sm:h-72">
                    <img
                      src={heroUrl}
                      alt={selectedObjectForDetail.title}
                      className="w-full h-full object-cover"
                    />

                    <button
                      onClick={() => setSelectedObjectForDetail(null)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4]"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#F1EDF7]/85 text-[#251045] border border-[#D6CFE4]">
                        {selectedObjectForDetail.category}
                      </span>

                      {selectedObjectForDetail.isVerified && (
                        <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Gallery — the object's other REAL source photos, opened in a
                  new tab. Never fabricated; only rows the server projected. */}
              {(() => {
                const heroUrl = selectedObjectForDetail.imageUrl
                  ?? selectedObjectForDetail.gallery?.[0]?.url
                  ?? null;
                const rest = (selectedObjectForDetail.gallery ?? [])
                  .filter((img) => img.url !== heroUrl);
                if (rest.length === 0) return null;
                return (
                  <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                    {rest.slice(0, 6).map((img) => (
                      <a
                        key={img.url}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={img.alt ?? 'Photo'}
                        className="block aspect-square overflow-hidden rounded-xl border border-[#D6CFE4] transition-transform hover:scale-[1.02]"
                      >
                        <img
                          src={img.url}
                          alt={img.alt ?? ''}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                );
              })()}

              {/* Without a hero image the close button and chips disappeared
                  entirely, leaving backdrop-click as the only way out. This is
                  the same control set, laid out for an imageless record. */}
              {!selectedObjectForDetail.imageUrl && !selectedObjectForDetail.gallery?.[0]?.url && (
                <div className="flex items-center justify-between gap-2 p-4 border-b border-[#D6CFE4]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#F1EDF7]/85 text-[#251045] border border-[#D6CFE4]">
                      {selectedObjectForDetail.category}
                    </span>

                    {selectedObjectForDetail.isVerified && (
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                        Verified
                      </span>
                    )}
                  </div>

                  <button
                    onClick={dismissOverlay}
                    className="p-2 rounded-full bg-[#F1EDF7]/80 text-[#251045] border border-[#D6CFE4]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Details */}
              <div className="p-5 space-y-5">

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[#251045]/60">
                      {getObjectTypeMeta(selectedObjectForDetail.type).label}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-[#251045]">
                    {selectedObjectForDetail.title}
                  </h2>

                  <p className="text-sm text-[#251045] mt-2 leading-relaxed">
                    {selectedObjectForDetail.summary}
                  </p>

                  {/* News detail — publisher, publication time, relevant
                      location, and the prominent "Read original" action.
                      Headline + concise summary only: the full article lives
                      at the original link, never reproduced here. */}
                  {selectedObjectForDetail.type === 'news' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#251045]/60">
                        {(() => {
                          const publisher = selectedObjectForDetail.sourceNames?.[0]
                            ?? (selectedObjectForDetail.sourceCount
                              ? `${selectedObjectForDetail.sourceCount} ${selectedObjectForDetail.sourceCount === 1 ? 'source' : 'sources'}`
                              : null);
                          if (!publisher) return null;
                          return <span>From {publisher}</span>;
                        })()}
                        {(() => {
                          const stamp = selectedObjectForDetail.publishedAt
                            ?? selectedObjectForDetail.createdAt;
                          if (!stamp) return null;
                          const d = new Date(stamp);
                          if (!Number.isFinite(d.getTime())) return null;
                          return (
                            <span>
                              {d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                              {' · '}
                              {d.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          );
                        })()}
                        {(() => {
                          const place = selectedObjectForDetail.locationName
                            ?? selectedObjectForDetail.metadata?.area
                            ?? selectedObjectForDetail.metadata?.county;
                          if (!place) return null;
                          return <span>· {place}</span>;
                        })()}
                      </div>

                      {(() => {
                        const readUrl = selectedObjectForDetail.sourceUrl
                          ?? (selectedObjectForDetail.actionType === 'external'
                            ? selectedObjectForDetail.actionUrl
                            : null);
                        if (!readUrl) return null;
                        return (
                          <a
                            href={readUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#5B2EA6] px-5 py-2.5 text-[12px] font-extrabold text-[#FFFFFF] transition-opacity hover:opacity-90"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Read original
                          </a>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Facts -- generated from metadata, empty fields omitted */}
                {(() => {
                  const facts = buildKeyFacts(selectedObjectForDetail);
                  if (facts.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {facts.map((fact) => (
                        <div
                          key={fact.key}
                          className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-3"
                        >
                          <div className="text-[10px] text-[#251045]/60">
                            {fact.label}
                          </div>
                          <div className="text-xs font-bold mt-1">
                            {fact.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Location & contact */}
                {(selectedObjectForDetail.locationName ||
                  selectedObjectForDetail.creatorName ||
                  selectedObjectForDetail.metadata?.contactPhone) && (
                  <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl p-3 space-y-3">
                    {selectedObjectForDetail.locationName && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            Location
                          </div>
                          <div className="text-xs font-bold">
                            {selectedObjectForDetail.locationName}
                          </div>
                          {resolveAction(selectedObjectForDetail).kind !== 'map' && (
                            <a
                              href={buildMapsHref(
                                selectedObjectForDetail.locationName
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#251045] mt-1 hover:underline"
                            >
                              Open in Maps
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedObjectForDetail.creatorName && (
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            {selectedObjectForDetail.type === 'product'
                              ? 'Seller'
                              : selectedObjectForDetail.type === 'service'
                              ? 'Provider'
                              : selectedObjectForDetail.type === 'opportunity'
                              ? 'Offered by'
                              : 'Listed by'}
                          </div>
                          <div className="text-xs font-bold">
                            {selectedObjectForDetail.creatorName}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedObjectForDetail.metadata?.contactPhone && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-[#251045] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#251045]/60">
                            Contact
                          </div>
                          <a
                            href={buildTelHref(
                              selectedObjectForDetail.metadata.contactPhone
                            )}
                            className="text-xs font-bold text-[#251045] hover:underline"
                          >
                            {selectedObjectForDetail.metadata.contactPhone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Trust, freshness and provenance (prompts 12/13/14).
                    One quiet row answering: who said this, was it checked,
                    how recently, and where did it come from. A score is
                    labelled as a confidence signal, never as a guarantee. */}
                {(() => {
                  const subject = selectedObjectForDetail;
                  const fresh = getFreshness(subject);
                  const hasTrust =
                    subject.isVerified ||
                    Boolean(subject.creatorName) ||
                    Boolean(fresh) ||
                    Boolean(subject.sourceUrl) ||
                    (Array.isArray(subject.sourceNames) && subject.sourceNames.length > 0);

                  if (!hasTrust) return null;

                  const freshTone =
                    fresh?.level === 'stale' || fresh?.level === 'aging'
                      ? 'text-[#251045]'
                      : 'text-[#251045]';

                  return (
                    <div className="bg-[#F1EDF7] border border-[#D6CFE4] rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck className="w-4 h-4 text-[#251045] shrink-0" />
                          <span className="text-xs font-bold truncate">
                            {subject.creatorName || 'Provider not stated'}
                          </span>
                          {subject.isVerified && (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#5B2EA6] text-[#FFFFFF] shrink-0">
                              VERIFIED
                            </span>
                          )}
                        </div>

                      </div>

                      {fresh && (
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[10px] font-bold ${freshTone}`}>
                            {fresh.label}
                          </span>
                          <span className="text-[10px] text-[#251045]/40">
                            checked {fresh.verifiedOn}
                          </span>
                        </div>
                      )}

                      {/* Source transparency on every item: the real source
                          name(s) — "From City Wire", "From Kilimani Notices"
                          — never an internal id. */}
                      {subject.sourceNames && subject.sourceNames.length > 0 && (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-[#251045]/70 truncate">
                            From {subject.sourceNames.slice(0, 3).join(', ')}
                          </span>
                        </div>
                      )}

                      <p className="text-[10px] text-[#251045]/40 leading-snug">
                        Verification records when this was last checked. It is
                        not a guarantee of accuracy.
                      </p>

                      {subject.sourceUrl && (
                        <a
                          href={subject.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#251045] underline underline-offset-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Source
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* "You can..." (prompt 8). Only actions the data supports. */}
                {(() => {
                  const suggestions = getSuggestedActions(selectedObjectForDetail);
                  const extras = suggestions.filter((a) => a.kind !== 'primary');
                  if (extras.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#251045]/40">
                        You can
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {extras.map((a) => (
                          <a
                            key={a.key}
                            href={a.href}
                            target={a.key === 'call' ? undefined : '_blank'}
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]"
                          >
                            {a.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleExecuteProtocolAction(
                          'save',
                          selectedObjectForDetail
                        )
                      }
                      className="flex-1 py-3 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4" />
                      Save
                    </button>

                    {(() => {
                      const action = resolveAction(selectedObjectForDetail);
                      const primaryClass =
                        'flex-[2] py-3 rounded-xl bg-[#5B2EA6] text-[#FFFFFF] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer';

                      // Stays in Brief: pivot the stream sideways.
                      if (action.kind === 'internal') {
                        return (
                          <button
                            onClick={() =>
                              handlePivotToType(selectedObjectForDetail)
                            }
                            className={primaryClass}
                          >
                            {action.label}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        );
                      }

                      // Real destination -> real link.
                      if (action.kind !== 'none') {
                        const newTab = action.kind !== 'phone';
                        return (
                          <a
                            href={action.href}
                            target={newTab ? '_blank' : undefined}
                            rel={newTab ? 'noopener noreferrer' : undefined}
                            onClick={() =>
                              handleExecuteProtocolAction(
                                action.kind === 'phone' ? 'contact' : 'discover',
                                selectedObjectForDetail,
                                { silent: true }
                              )
                            }
                            className={primaryClass}
                          >
                            {action.label}
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        );
                      }

                      // No route -> say so plainly. Don't fake a transaction.
                      return (
                        <div className="flex-[2] py-3 rounded-xl bg-[#FBFAFD] border border-dashed border-[#D6CFE4] text-[#251045]/60 font-extrabold text-xs flex items-center justify-center gap-2">
                          {action.label} unavailable
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] text-[#251045]/60 text-center">
                    {getActionNote(selectedObjectForDetail)}
                  </p>

                  {/* Secondary doors (prompts 11/18/21). Subordinate to the
                      primary action, and only rendered where data supports
                      them. Watch records intent; it does not poll anything. */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShare(selectedObjectForDetail)}
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>

                    <button
                      onClick={() =>
                        handleCreatePursuit(selectedObjectForDetail.title)
                      }
                      className="flex-1 py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/60 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Pursue
                    </button>

                    <button
                      onClick={() => handleToggleWatch(selectedObjectForDetail)}
                      className={`flex-1 py-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer ${
                        watchedIds.has(selectedObjectForDetail.id)
                          ? 'bg-[#FBFAFD] border-[#D6CFE4] text-[#251045]'
                          : 'bg-[#FBFAFD] border-[#D6CFE4] text-[#251045]/60'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {watchedIds.has(selectedObjectForDetail.id) ? 'Watching' : 'Watch'}
                    </button>
                  </div>

                  {/* §8: the crowd-checking row. Confirm says "I know this is
                      true"; report says "this is wrong" with a reason. Both
                      are real server records, not local flags. */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleConfirmObject(selectedObjectForDetail)}
                      disabled={objectCheckBusy === selectedObjectForDetail.id}
                      className="flex-1 min-w-fit py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/70 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      {objectCheckBusy === selectedObjectForDetail.id ? 'Recording…' : '✓ I can confirm this'}
                    </button>
                    <button
                      onClick={() => setReportForObject(reportForObject === selectedObjectForDetail.id ? null : selectedObjectForDetail.id)}
                      className="flex-1 min-w-fit py-2.5 rounded-xl bg-[#FBFAFD] border border-[#D6CFE4] text-[#251045]/50 font-bold text-[11px] cursor-pointer"
                    >
                      Report
                    </button>
                  </div>
                  {reportForObject === selectedObjectForDetail.id && (
                    <div className="flex flex-wrap gap-1.5">
                      {['wrong details', 'spam', 'offensive', 'no longer true'].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => void handleReportObject(selectedObjectForDetail, reason)}
                          disabled={objectCheckBusy === selectedObjectForDetail.id}
                          className="px-3 py-1.5 rounded-full border border-[#D6CFE4] text-[11px] font-bold text-[#251045]/70 cursor-pointer disabled:opacity-50"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}

                  {watchedIds.has(selectedObjectForDetail.id) && (
                    <p className="text-[10px] text-[#251045]/40 text-center">
                      Brief will track changes to this record. Alerts are not live yet.
                    </p>
                  )}
                </div>

                {/* Why this appeared (prompt 7). Every reason is computed
                    from real state, so none of them can be untrue. */}
                {(() => {
                  const reasons = getAppearanceReasons(selectedObjectForDetail, {
                    pursuits,
                    pursuitResults,
                    savedIds: savedIdSet,
                    watchedIds,
                    relatedToSavedIds
                  });
                  if (reasons.length === 0) return null;

                  return (
                    <details className="group">
                      <summary className="text-[10px] text-[#251045]/40 cursor-pointer list-none">
                        Why this appeared
                      </summary>
                      <div className="mt-2 space-y-1">
                        {reasons.map((r) => (
                          <p key={r.key} className="text-[10px] text-[#251045]/60">
                            {r.label}
                          </p>
                        ))}
                      </div>
                    </details>
                  );
                })()}

                {/* Nearby (prompt 16). Distinct from Related: this answers
                    "what else is around here", not "what goes with this".
                    Anything already shown in Related is filtered out so the
                    two rails never duplicate each other. */}
                {(() => {
                  const shown = new Set(relatedObjects.map((r) => r.item.id));
                  const near = graph
                    .nearby(selectedObjectForDetail, 8)
                    .filter((o) => !shown.has(o.id))
                    .slice(0, 4);

                  if (near.length === 0) return null;

                  return (
                    <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                      <p className="text-[10px] text-[#251045]">
                        More from this area
                      </p>
                      <h3 className="text-sm font-extrabold mt-1 mb-3">Nearby</h3>

                      <div className="grid grid-cols-2 gap-2">
                        {near.map((obj) => {
                          const dist = getDistanceLabel(obj);
                          return (
                            <button
                              key={obj.id}
                              onClick={() => setSelectedObjectForDetail(obj)}
                              className="text-left bg-[#FBFAFD] border border-[#D6CFE4] hover:border-[#D6CFE4] rounded-xl p-3 cursor-pointer transition"
                            >
                              <p className="text-[9px] text-[#251045]/40">
                                {getObjectTypeMeta(obj.type).label}
                              </p>
                              <p className="text-[11px] font-bold text-[#251045] leading-snug mt-0.5 line-clamp-2">
                                {obj.title}
                              </p>
                              {dist && (
                                <p className="text-[9px] text-[#251045]/60 mt-1">
                                  {dist}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* WHAT'S HERE (rework 4/5). The destination detail becomes a
                    mini directory: who is trading, what they sell, and a hop
                    into each vendor. Everything is read from stated graph
                    edges; when a destination has no linked vendors we say so
                    rather than inventing a line-up. */}
                {isDestinationObject(selectedObjectForDetail) && (() => {
                  const dest = selectedObjectForDetail;
                  const vendors = getDestinationVendors(dest, objects);
                  const state = getDestinationState(dest);
                  const access = getDestinationAccess(dest);
                  return (
                    <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-[#251045]">
                            {DESTINATION_STATE_LABELS[state]}
                          </p>
                          <h3 className="text-sm font-extrabold mt-1">
                            What's here
                          </h3>
                        </div>
                        {access && (
                          <span className="text-[9px] font-extrabold text-[#251045] border border-[#D6CFE4] rounded-full px-2 py-0.5">
                            {access}
                          </span>
                        )}
                      </div>

                      {vendors.length === 0 ? (
                        <p className="text-xs text-[#251045]/60">
                          Vendor information unavailable. Brief only lists
                          traders that are actually linked to this destination.
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-[#251045] mb-2">
                            {vendors.length}{' '}
                            {vendors.length === 1 ? 'vendor' : 'vendors'} listed
                            here
                          </p>
                          <div className="space-y-2">
                            {vendors.map((vendor) => {
                              const offerings = getVendorOfferings(vendor, objects);
                              return (
                                <div
                                  key={vendor.id}
                                  className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-extrabold text-[#251045] truncate">
                                          {vendor.title}
                                        </p>
                                        {vendor.isVerified && (
                                          <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#5B2EA6] text-[#FFFFFF]">
                                            VERIFIED
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-[#251045]/60 mt-0.5">
                                        {vendor.category}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedObjectForDetail(vendor)}
                                      className="shrink-0 text-[10px] font-extrabold text-[#251045] cursor-pointer"
                                    >
                                      View vendor
                                    </button>
                                  </div>

                                  {/* What they sell, only where real records exist. */}
                                  {offerings.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {offerings.map((item) => (
                                        <button
                                          key={item.id}
                                          onClick={() => setSelectedObjectForDetail(item)}
                                          className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                                        >
                                          <span className="text-[10px] text-[#251045] truncate">
                                            {item.title}
                                          </span>
                                          {typeof item.metadata?.price === 'number' && (
                                            <span className="shrink-0 text-[10px] text-[#251045]">
                                              {item.metadata.currency || 'KES'}{' '}
                                              {item.metadata.price.toLocaleString()}
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* VENDOR VIEW (rework 6/7). Opening an identity shows what
                    it sells and where it can be found, so a trader discovered
                    at one popup leads to the next one instead of a dead end.
                    Contact routes through the object's own stated action --
                    Brief never invents a phone number or a shop URL. */}
                {selectedObjectForDetail.type === 'identity' && (() => {
                  const vendor = selectedObjectForDetail;
                  const offerings = getVendorOfferings(vendor, objects);
                  const appearsAt = getVendorDestinations(vendor, objects);
                  if (offerings.length === 0 && appearsAt.length === 0) return null;
                  return (
                    <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                      {appearsAt.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-[#251045]">
                            Find them at
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {appearsAt.map((dest) => {
                              const state = getDestinationState(dest);
                              return (
                                <button
                                  key={dest.id}
                                  onClick={() => setSelectedObjectForDetail(dest)}
                                  className="w-full text-left bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    {(state === 'live' || state === 'today') && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B2EA6] shrink-0" />
                                    )}
                                    <span className="text-xs text-[#251045] truncate">
                                      {dest.title}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#251045]/40">
                                    {DESTINATION_STATE_LABELS[state]}
                                    {dest.locationName ? ` - ${dest.locationName}` : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {offerings.length > 0 && (
                        <div>
                          <p className="text-[10px] text-[#251045]">
                            What they offer
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {offerings.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedObjectForDetail(item)}
                                className="w-full flex items-center justify-between gap-3 bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-3 text-left cursor-pointer"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs text-[#251045] truncate">
                                    {item.title}
                                  </span>
                                  <span className="block text-[9px] text-[#251045]/40">
                                    {item.category}
                                  </span>
                                </span>
                                {typeof item.metadata?.price === 'number' && (
                                  <span className="shrink-0 text-[11px] font-extrabold text-[#251045]">
                                    {item.metadata.currency || 'KES'}{' '}
                                    {item.metadata.price.toLocaleString()}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Related */}
                {relatedObjects.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#D6CFE4]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] text-[#251045]">
                          Continue exploring
                        </p>
                        <h3 className="text-sm font-extrabold mt-1">
                          {getRelatedHeading(
                            selectedObjectForDetail,
                            relatedObjects
                          )}
                        </h3>
                      </div>

                      <span className="text-[10px] text-[#251045]/60 shrink-0">
                        {relatedObjects.length} nearby
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {relatedObjects.map(({ item: related, reason }) => {
                        const chip = getReasonChip(reason);
                        const distance = getDistanceLabel(related);

                        return (
                          <button
                            key={related.id}
                            onClick={() => setSelectedObjectForDetail(related)}
                            className="text-left bg-[#F1EDF7] border border-[#D6CFE4] hover:border-[#6C3EC9] rounded-xl p-3 transition group cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              {related.imageUrl && (
                                <img
                                  src={related.imageUrl}
                                  alt=""
                                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                                />
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[9px] text-[#251045]/60">
                                    {related.category}
                                  </p>
                                  {chip && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#D6CFE4] text-[#251045]">
                                      {chip}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-extrabold mt-1 line-clamp-2 group-hover:text-[#251045]">
                                  {related.title}
                                </p>

                                {related.locationName && (
                                  <p className="text-[10px] text-[#251045] mt-1 truncate">
                                    {related.locationName}
                                  </p>
                                )}

                                {distance && (
                                  <p className="text-[10px] text-[#251045]/60 mt-0.5">
                                    {distance}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First run. An OVERLAY, not a replacement: the feed loads behind it,
          so the screen after the flow is already warm. */}
      <Onboarding
        open={firstRunOpen}
        providers={authProviders}
        state={onboardingState}
        user={sessionUser}
        channel={arrivalChannel}
        placeLabel={userLocation?.label ?? null}
        onSignedIn={(user) => {
          setSessionUser(user);
          void refreshOnboarding();
        }}
        onGuest={provisionGuest}
        onStateChange={setOnboardingState}
        onUseLocation={locate}
        onChooseCity={(city) => chooseCity(city)}
        onDone={() => {
          setFirstRunOpen(false);
          setActiveTab('nearby');
          setNearbySection('stream');
          void refreshOnboarding();
        }}
      />

      <MenuSheet
        open={menuOpen}
        onClose={dismissOverlay}
        onSelect={handleMenuSelect}
        onSelectCity={chooseCity}
        selectedLocation={selectedLocation}
        canOperate={briefApi.isOperator(sessionUser)}
      />
      <AdminDesk open={adminOpen} onClose={dismissOverlay} me={sessionUser} />

      <footer className="border-t border-[#D6CFE4] mt-12 py-6 text-xs text-[#251045]/60 text-center">
        Everything Happening Around You
      </footer>

    </div>
  );
}

export default App;
