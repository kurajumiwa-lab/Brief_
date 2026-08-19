import React, { useState, useMemo, useEffect } from 'react';
import * as briefApi from './api/briefApi';
import type { ArenaMoneyStatus } from './api/types';
import QRCode from 'qrcode';
import { CampaignDistribution } from './components/CampaignDistribution';
import { AwaitingPayment } from './components/AwaitingPayment';
import { Pulse } from './components/Pulse';
import { SourcesPanel } from './components/SourcesPanel';
import { ConnectedGroups } from './components/ConnectedGroups';
import { MoneyPanel } from './components/MoneyPanel';
import { Vault } from './components/vault/Vault';
import { CheckIn } from './components/CheckIn';
import { HostCommand } from './components/HostCommand';
import { Circles } from './components/Circles';
import { Marketplace } from './components/Marketplace';
import { Pursuits } from './components/Pursuits';
import { Inbox } from './components/Inbox';
import { Quests } from './components/Quests';
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
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  | 'conversation';

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
// Five doors. Each answers one question: where do I discover, play, find my
// own things, do work, or understand what changed. Everything else is a
// section INSIDE one of these, never a top-level tab.
export type Destination =
  | 'nearby'
  | 'arena'
  | 'mylayer'
  | 'workflows'
  | 'pulse';

// The five doors, defined once and consumed by both the desktop rail and the
// mobile bar so the two can never drift apart.
export const DESTINATIONS: {
  id: Destination;
  label: string;
  hint: string;
}[] = [
  { id: 'nearby', label: 'Around', hint: "What's happening near you" },
  { id: 'arena', label: 'Play', hint: 'Find people to play with nearby' },
  { id: 'mylayer', label: 'Saved', hint: 'Your saved places and opportunities' },
  { id: 'workflows', label: 'Actions', hint: 'Things you can get done' },
  // "Pulse", not "Intelligence": the second names the implementation, and
  // nobody sets out to visit an intelligence department.
  { id: 'pulse', label: 'Pulse', hint: "What's changing around you" }
];

// Icons kept separate from DESTINATIONS so the data stays plain and the
// component layer owns the visuals. All five are already imported.
const DESTINATION_ICONS: Record<Destination, LucideIcon> = {
  nearby: MapPin,
  arena: Award,
  mylayer: Bookmark,
  workflows: Briefcase,
  pulse: TrendingUp
};

export type NearbySection = 'stream' | 'tea' | 'today' | 'pursuits' | 'quests' | 'market';
export type MyLayerSection =
  | 'saved' | 'activity' | 'arena' | 'points' | 'circles' | 'groups' | 'campaigns';
// Workflows secondary: a Journey is either in progress or finished. Inbox and
// Sources are kept -- they are existing workflow surfaces, not new screens.
export type WorkflowSection = 'command' | 'active' | 'completed' | 'inbox' | 'sources' | 'money' | 'vault' | 'gate';
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
export type CivicMetric =
  | { label: string; available: true; value: number; unit?: string; caption: string }
  | { label: string; available: false; reason: string };

export interface TownHealth {
  metrics: CivicMetric[];
  /** Freshness over objects Brief holds. Null when there is nothing to measure. */
  infoFreshnessPct: number | null;
}

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
      return { label: 'News', tone: 'text-[#00E676] border-[#14392B]' };
    case 'notice':
      return { label: 'Notice', tone: 'text-[#FFD166] border-[#5A4A1E]' };
    case 'chatter':
      return { label: 'Chatter', tone: 'text-[#00E676] border-[#14392B]' };
    case 'question':
      return { label: 'Question', tone: 'text-[#7FD1FF] border-[#1E4A5F]' };
    case 'promo':
      return { label: 'Promoted', tone: 'text-[#FF9F6E] border-[#5F3A1E]' };
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
  place: ['experience', 'identity']
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
  { type: 'experience', words: /\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar)\b/i, label: 'event language' },
  { type: 'service', words: /\b(service|repair|installation|booking|book a|consultation|inspection|delivery|plumber|fundi)\b/i, label: 'service language' },
  { type: 'product', words: /\b(for sale|selling|stock|in stock|price|buy|brand new|second hand|pieces|units)\b/i, label: 'sale language' },
  { type: 'knowledge', words: /\b(guide|how to|steps|requirements|explainer|notice|announcement)\b/i, label: 'informational language' },
  { type: 'place', words: /\b(shop|stall|market|centre|center|hub|office|premises|located at|branch)\b/i, label: 'premises language' }
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
  if (!line) return null;
  return line.replace(/^[^A-Za-z0-9]+/, '').slice(0, 80);
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
  const tooShort = text.trim().length < 25;

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
  playedAt: string;
  // A match with no agreed result stays without one. Brief does not decide
  // who won.
  winnerPlayerId?: string;
  scoreLine?: string;
  // Both players must confirm before a result counts.
  confirmedByA?: boolean;
  confirmedByB?: boolean;
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
  { completedPlayers: 100, points: 8000, label: 'Elite organizer' },
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
  | 'Organizer'
  | 'Trusted Organizer'
  | 'Elite Organizer'
  | 'Arena Host'
  | 'Arena Champion';

// Organizer rank needs volume AND quality. A high dispute rate blocks the top
// tiers regardless of how many tournaments someone has run.
const ORGANIZER_LADDER: {
  rank: OrganizerRank;
  minHosted: number;
  minPlayersServed: number;
  minCompletionRate: number;
  maxDisputeRate: number;
}[] = [
  { rank: 'Arena Champion', minHosted: 25, minPlayersServed: 500, minCompletionRate: 95, maxDisputeRate: 2 },
  { rank: 'Arena Host', minHosted: 15, minPlayersServed: 250, minCompletionRate: 90, maxDisputeRate: 4 },
  { rank: 'Elite Organizer', minHosted: 8, minPlayersServed: 100, minCompletionRate: 85, maxDisputeRate: 6 },
  { rank: 'Trusted Organizer', minHosted: 3, minPlayersServed: 30, minCompletionRate: 75, maxDisputeRate: 10 },
  { rank: 'Organizer', minHosted: 0, minPlayersServed: 0, minCompletionRate: 0, maxDisputeRate: 100 }
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
  return 'Organizer';
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
  | 'Pro'
  | 'Elite'
  | 'Sovereign';

const RANK_LADDER: {
  rank: BriefRank;
  minAccepted: number;
  minAcceptanceRate: number;
}[] = [
  { rank: 'Sovereign', minAccepted: 500, minAcceptanceRate: 90 },
  { rank: 'Elite', minAccepted: 200, minAcceptanceRate: 85 },
  { rank: 'Pro', minAccepted: 75, minAcceptanceRate: 80 },
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
  const color = empty ? '#48484A' : full ? '#C2A24A' : '#00E676';

  return (
    <span className="relative inline-flex shrink-0" title={label}>
      <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label={label}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#1E1E22" strokeWidth="2.5" />
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
            stroke="#1E1E22"
            strokeWidth="2.5"
            strokeDasharray="2 4"
          />
        )}
        <GameGlyphShape gameId={gameId} color={color} />
      </svg>
      <span
        className={`absolute -bottom-0.5 -right-0.5 min-w-[15px] px-1 rounded-full text-[8px] font-extrabold text-center leading-[15px] ${
          empty
            ? 'bg-[#121214] text-[#48484A]'
            : full
            ? 'bg-[#C2A24A] text-[#0A0A0B]'
            : 'bg-[#00E676] text-[#0A0A0B]'
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

const ARENA_PLAYERS: ArenaPlayer[] = [
  { id: 'ply_nyabs', displayName: 'Nyabs', presence: 'online', preferredMode: '1v1', lastSeenAt: '2026-08-15T09:40:00Z' },
  { id: 'ply_mike', displayName: 'Mike', presence: 'online', preferredMode: '1v1', lastSeenAt: '2026-08-15T09:38:00Z' },
  { id: 'ply_kip', displayName: 'Kip', presence: 'online', preferredMode: '2v2', lastSeenAt: '2026-08-15T09:30:00Z' },
  { id: 'ply_jay', displayName: 'Jay', presence: 'nearby', distanceKm: 2.4, preferredMode: '1v1', lastSeenAt: '2026-08-15T09:20:00Z' },
  { id: 'ply_wanjiku', displayName: 'Wanjiku', presence: 'offline', preferredMode: '1v1', lastSeenAt: '2026-08-14T21:00:00Z' }
];

const ARENA_IDENTITIES: GameIdentity[] = [
  { id: 'gid_nyabs_ef', playerId: 'ply_nyabs', gameId: 'efootball', game: 'eFootball', gamerTag: 'NYABS_254', platform: 'Mobile', region: 'KE', verified: true },
  { id: 'gid_mike_ef', playerId: 'ply_mike', gameId: 'efootball', game: 'eFootball', gamerTag: 'MikeStrikes', platform: 'Mobile', region: 'KE' },
  { id: 'gid_kip_ef', playerId: 'ply_kip', gameId: 'efootball', game: 'eFootball', gamerTag: 'KipMaster', platform: 'Console', region: 'KE' },
  { id: 'gid_jay_ef', playerId: 'ply_jay', gameId: 'efootball', game: 'eFootball', gamerTag: 'JayZeroSix', platform: 'Mobile', region: 'KE' },
  // Same person, different game, separate identity and separate stats.
  { id: 'gid_mike_cod', playerId: 'ply_mike', gameId: 'cod', game: 'Call of Duty Mobile', gamerTag: 'M1KE_OPS', platform: 'Mobile', region: 'KE' },
  { id: 'gid_wanjiku_ef', playerId: 'ply_wanjiku', gameId: 'efootball', game: 'eFootball', gamerTag: 'WanjikuW', platform: 'Mobile', region: 'KE' }
];

const ARENA_STATS: PlayerGameStats[] = [
  { identityId: 'gid_nyabs_ef', rating: 87, matches: 142, wins: 96, losses: 46 },
  { identityId: 'gid_mike_ef', rating: 84, matches: 61, wins: 33, losses: 28 },
  { identityId: 'gid_kip_ef', rating: 86, matches: 78, wins: 44, losses: 34 },
  { identityId: 'gid_jay_ef', rating: 89, matches: 103, wins: 71, losses: 32 },
  { identityId: 'gid_mike_cod', rating: 62, matches: 12, wins: 5, losses: 7 },
  // A brand new identity: no rating, nothing played. Must not render as 0%.
  { identityId: 'gid_wanjiku_ef', matches: 0, wins: 0, losses: 0 }
];

const ARENA_CHALLENGES: ArenaChallenge[] = [
  {
    id: 'chl_nyabs_1',
    gameId: 'efootball',
    mode: '1v1',
    createdByPlayerId: 'ply_nyabs',
    stake: 'entry_fee',
    entryFeeKes: 100,
    format: 'First to 3',
    openUntil: '2026-08-15T20:00:00Z',
    status: 'open',
    createdAt: '2026-08-15T09:00:00Z'
  },
  {
    id: 'chl_mike_1',
    gameId: 'efootball',
    mode: '1v1',
    createdByPlayerId: 'ply_mike',
    stake: 'friendly',
    format: 'Single match',
    openUntil: '2026-08-15T22:00:00Z',
    status: 'open',
    createdAt: '2026-08-15T09:10:00Z'
  },
  {
    id: 'chl_kip_1',
    gameId: 'efootball',
    mode: '2v2',
    createdByPlayerId: 'ply_kip',
    stake: 'friendly',
    format: 'Looking for partner',
    openUntil: '2026-08-15T21:00:00Z',
    status: 'open',
    createdAt: '2026-08-15T09:15:00Z'
  },
  {
    id: 'chl_jay_1',
    gameId: 'efootball',
    mode: '1v1',
    createdByPlayerId: 'ply_jay',
    stake: 'ranked',
    format: 'First to 3',
    openUntil: '2026-08-15T19:00:00Z',
    status: 'open',
    createdAt: '2026-08-15T08:50:00Z'
  }
];

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

const ARENA_AVAILABILITY: PlayerAvailability[] = [
  { playerId: 'ply_mike', state: 'available', gameId: 'efootball', mode: 'free_match', format: '1v1', window: 'now', locationKind: 'online', updatedAt: '2026-08-15T09:38:00Z' },
  { playerId: 'ply_kip', state: 'available', gameId: 'efootball', mode: 'league', format: '2v2', window: 'today', locationKind: 'online', lookingForLeague: true, leagueDivision: 'Intermediate', updatedAt: '2026-08-15T09:30:00Z' },
  { playerId: 'ply_jay', state: 'available', gameId: 'efootball', mode: 'ranked', format: '1v1', window: 'now', locationKind: 'venue', venueId: 'ven_gamehub_kilimani', updatedAt: '2026-08-15T09:20:00Z' },
  // Busy and offline players must never appear in Available Now.
  { playerId: 'ply_wanjiku', state: 'busy', gameId: 'efootball', mode: 'friendly', format: '1v1', window: 'today', locationKind: 'online', updatedAt: '2026-08-15T08:00:00Z' },
  { playerId: 'ply_nyabs', state: 'available', gameId: 'cod', mode: 'free_match', format: '1v1', window: 'now', locationKind: 'venue', venueId: 'ven_gamehub_kilimani', updatedAt: '2026-08-15T09:40:00Z' }
];

const ARENA_RELIABILITY: ReliabilityRecord[] = [
  { playerId: 'ply_nyabs', accepted: 150, completed: 142, cancelled: 6, noShows: 0, disputes: 1 },
  { playerId: 'ply_mike', accepted: 64, completed: 61, cancelled: 3, noShows: 0, disputes: 0 },
  { playerId: 'ply_kip', accepted: 82, completed: 78, cancelled: 4, noShows: 0, disputes: 0 },
  // Deliberately unreliable: must sink in the list, not disappear or be banned.
  { playerId: 'ply_jay', accepted: 110, completed: 96, cancelled: 5, noShows: 6, disputes: 3 },
  { playerId: 'ply_wanjiku', accepted: 0, completed: 0, cancelled: 0, noShows: 0, disputes: 0 }
];

const ARENA_TOURNAMENTS: Tournament[] = [
  {
    id: 'trn_weekend_cup',
    name: 'Weekend eFootball Cup',
    gameId: 'efootball',
    organizerId: 'ply_nyabs',
    capacity: 32,
    registeredPlayerIds: Array.from({ length: 28 }, (_, i) => `ply_reg_${i}`),
    completedPlayerIds: [],
    matchesCompleted: 0,
    status: 'open',
    startsAt: '2026-08-16T16:00:00Z',
    venueId: 'ven_gamehub_kilimani',
    entryPoints: 100,
    prizeDescription: 'KES 2,000 supermarket voucher'
  },
  {
    id: 'trn_kilimani_league',
    name: 'Kilimani Midweek League',
    gameId: 'efootball',
    organizerId: 'ply_nyabs',
    capacity: 64,
    registeredPlayerIds: Array.from({ length: 58 }, (_, i) => `ply_lg_${i}`),
    // 52 players actually finished: base 150 + the 50-player tier 3500 = 3650,
    // which is exactly what the ledger credits.
    completedPlayerIds: Array.from({ length: 52 }, (_, i) => `ply_lg_${i}`),
    // 18 had never played an Arena tournament; 24 had played one of Nyabs'
    // previous events. Growth and retention are what the rates reward.
    newPlayerIds: Array.from({ length: 18 }, (_, i) => `ply_lg_${i}`),
    repeatPlayerIds: Array.from({ length: 24 }, (_, i) => `ply_lg_${i + 18}`),
    matchesCompleted: 134,
    status: 'completed',
    startsAt: '2026-08-05T16:00:00Z',
    disputes: 0
  },
  // An organizer marking an empty tournament complete: earns nothing, flagged.
  {
    id: 'trn_ghost',
    name: 'Ngara Flash Cup',
    gameId: 'efootball',
    organizerId: 'ply_kip',
    capacity: 16,
    registeredPlayerIds: [],
    completedPlayerIds: [],
    matchesCompleted: 0,
    status: 'completed',
    startsAt: '2026-08-12T16:00:00Z'
  }
];

const ORGANIZER_RECORDS: OrganizerRecord[] = [
  { organizerId: 'ply_nyabs', tournamentsHosted: 18, playersServed: 423, matchesCompleted: 612, completionRate: 97, disputeRate: 1.2, repeatPlayers: 186, pointsEarned: 42000 },
  { organizerId: 'ply_kip', tournamentsHosted: 2, playersServed: 12, matchesCompleted: 9, completionRate: 40, disputeRate: 15, repeatPlayers: 1, pointsEarned: 300 }
];

const ARENA_LEDGER: PointsEntry[] = [
  // Matches getOrganizerReward for trn_kilimani_league exactly: 150 base
  // + 52*60 + 18*100 + 24*30 + 3500 milestone.
  { id: 'pe_1', playerId: 'ply_nyabs', reason: 'organizer_milestone', amount: 9290, at: '2026-08-06T10:00:00Z', refId: 'trn_kilimani_league', note: '52 players completed' },
  { id: 'pe_2', playerId: 'ply_nyabs', reason: 'tournament_win', amount: 60, at: '2026-08-02T18:00:00Z' },
  { id: 'pe_3', playerId: 'ply_nyabs', reason: 'match_win', amount: 10, at: '2026-08-13T18:00:00Z' },
  { id: 'pe_4', playerId: 'ply_nyabs', reason: 'match_complete', amount: 5, at: '2026-08-13T18:00:00Z' },
  { id: 'pe_5', playerId: 'ply_mike', reason: 'match_complete', amount: 5, at: '2026-08-13T19:00:00Z' },
  { id: 'pe_6', playerId: 'ply_nyabs', reason: 'community_contribution', amount: 50, at: '2026-08-12T09:00:00Z' },
  { id: 'pe_7', playerId: 'ply_nyabs', reason: 'redemption', amount: -1000, at: '2026-08-14T12:00:00Z', refId: 'gc_airtime_100' }
];

const GIFT_CARDS: GiftCard[] = [
  { id: 'gc_super_500', brand: 'Carrefour', merchant: 'Carrefour Kenya', category: 'supermarket', valueKes: 500, pointsRequired: 5000, redemptionMethod: 'voucher_code', status: 'available', inventory: 40, region: 'Nairobi' },
  { id: 'gc_gaming_1000', brand: 'GameHub', merchant: 'GameHub Kilimani', category: 'gaming', valueKes: 1000, pointsRequired: 10000, redemptionMethod: 'qr', status: 'available', inventory: 15, region: 'Nairobi' },
  { id: 'gc_airtime_100', brand: 'Safaricom', merchant: 'Safaricom', category: 'mobile_data', valueKes: 100, pointsRequired: 1000, redemptionMethod: 'voucher_code', status: 'available', inventory: 200, region: 'Nairobi' },
  { id: 'gc_food_300', brand: 'Java House', merchant: 'Java House', category: 'food', valueKes: 300, pointsRequired: 3000, redemptionMethod: 'qr', status: 'available', inventory: 25, region: 'Nairobi' },
  { id: 'gc_transport_200', brand: 'Little', merchant: 'Little Cab', category: 'transport', valueKes: 200, pointsRequired: 2000, redemptionMethod: 'voucher_code', status: 'available', inventory: 60, region: 'Nairobi' },
  { id: 'gc_merch_tee', brand: 'Brief', merchant: 'Brief Store', category: 'merchandise', valueKes: 800, pointsRequired: 9000, redemptionMethod: 'physical_card', status: 'available', inventory: 8, region: 'Nairobi' },
  { id: 'gc_sold_out', brand: 'IMAX', merchant: 'IMAX Nairobi', category: 'entertainment', valueKes: 700, pointsRequired: 7000, redemptionMethod: 'qr', status: 'sold_out', inventory: 0, region: 'Nairobi' }
];

const REWARD_POOL_CONTROLS: RewardPoolControls = {
  dailyRedemptionLimit: 50,
  monthlyRedemptionLimit: 800,
  redeemedToday: 12,
  redeemedThisMonth: 310
};

const ARENA_VENUES: ArenaVenue[] = [
  {
    id: 'ven_gamehub_kilimani',
    name: 'GameHub Kilimani',
    locationName: 'Kilimani',
    distanceKm: 1.2,
    stations: 8,
    stationsFree: 3,
    pricePerHourKes: 150,
    openUntil: '22:00',
    gameIds: ['efootball', 'fc_mobile', 'cod'],
    eventTonight: 'eFootball 16-player cup, 19:00'
  },
  {
    id: 'ven_pixel_westlands',
    name: 'Pixel Lounge Westlands',
    locationName: 'Westlands',
    distanceKm: 4.6,
    stations: 12,
    stationsFree: 12,
    pricePerHourKes: 200,
    openUntil: '23:00',
    gameIds: ['efootball', 'ea_fc', 'pubg']
  },
  {
    // Deliberately sparse: no price, no capacity, no event. The card must
    // simply omit what is unknown instead of inventing plausible values.
    id: 'ven_corner_ngara',
    name: 'Corner Play Ngara',
    locationName: 'Ngara',
    distanceKm: 6.1,
    gameIds: ['efootball']
  }
];

// Who is physically at a venue right now. The glyph counts these, so an empty
// venue genuinely renders as zero.
const ARENA_CHECKINS: { playerId: string; venueId: string; gameId: ArenaGameId }[] = [
  { playerId: 'ply_mike', venueId: 'ven_gamehub_kilimani', gameId: 'efootball' },
  { playerId: 'ply_kip', venueId: 'ven_gamehub_kilimani', gameId: 'efootball' },
  { playerId: 'ply_jay', venueId: 'ven_gamehub_kilimani', gameId: 'efootball' },
  { playerId: 'ply_nyabs', venueId: 'ven_gamehub_kilimani', gameId: 'cod' }
];

const ARENA_LISTINGS: ArenaListing[] = [
  { id: 'lst_ticket_1', kind: 'tournament_ticket', gameId: 'efootball', title: 'Saturday 16-player cup entry', priceKes: 200, sellerPlayerId: 'ply_nyabs', transferPolicy: 'officially_transferable', createdAt: '2026-08-14T10:00:00Z' },
  { id: 'lst_coach_1', kind: 'coaching', gameId: 'efootball', title: 'Defending and counter-attack coaching, 1 hour', priceKes: 500, sellerPlayerId: 'ply_jay', transferPolicy: 'officially_transferable', createdAt: '2026-08-14T11:00:00Z' },
  // Present so the boundary is exercised, and refused by canListInArena.
  { id: 'lst_account_1', kind: 'account', gameId: 'efootball', title: 'Established eFootball account', priceKes: 8000, sellerPlayerId: 'ply_kip', transferPolicy: 'not_supported', createdAt: '2026-08-14T12:00:00Z' }
];

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
export const objectFromServer = (row: any): BriefObject => ({
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
  sourceUrl: row?.provenance?.[0]?.sourceUrl ?? undefined,
  sourceId: row?.provenance?.[0]?.sourceId ?? undefined,
  metadata: row?.metadata ?? undefined,
  createdAt: String(row?.createdAt ?? new Date().toISOString()),

  // Relationships the server actually recorded. `/api/objects` returns these
  // as {verb, targetId, target}; the client models the same edges as typed
  // id fields, so the known verbs are mapped across and anything else falls
  // into relatedObjectIds rather than being dropped.
  //
  // Without this the relationship rails could never populate from real data:
  // the edges existed server-side and were being discarded on arrival.
  ...relationshipsFromServer(row?.relationships)
});

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

/**
 * Derives civic metrics from records Brief actually holds.
 *
 * The rule this function exists to enforce:
 *
 *     no underlying records -> no number -> honest empty state
 *
 * Freshness is genuinely derivable: it is the share of objects carrying a
 * verification date that has not expired, computed by the same getFreshness()
 * the cards use. Everything else on the old dashboard -- businesses helped,
 * events attended, knowledge resolved, community contributions -- would
 * require outcome tracking Brief does not do. Those are reported as
 * unavailable with the reason, not filled with a plausible-looking integer.
 */
const deriveTownHealth = (
  objects: BriefObject[],
  journeys: Journey[],
  now: Date = new Date()
): TownHealth => {
  const dated = objects.filter((o) => getFreshness(o, now) !== null);
  const fresh = dated.filter((o) => {
    const f = getFreshness(o, now);
    return f !== null && f.level !== 'stale';
  });

  const infoFreshnessPct =
    dated.length > 0 ? Math.round((fresh.length / dated.length) * 1000) / 10 : null;

  const completedJourneys = journeys.filter((j) => j.isCompleted).length;

  const metrics: CivicMetric[] = [
    infoFreshnessPct === null
      ? {
          label: 'Freshness',
          available: false,
          reason: 'No object carries a verification date yet, so freshness cannot be measured.'
        }
      : {
          label: 'Freshness',
          available: true,
          value: infoFreshnessPct,
          unit: '%',
          caption: `${fresh.length} of ${dated.length} dated objects still within their verification window`
        },
    {
      label: 'Journeys',
      available: true,
      value: completedJourneys,
      caption: completedJourneys === 1 ? 'journey completed' : 'journeys completed'
    },
    {
      label: 'Businesses',
      available: false,
      reason: 'Brief does not track business outcomes. Nothing records whether a business was helped.'
    },
    {
      label: 'Events',
      available: false,
      reason: 'Attendance is only known for campaigns you run. There is no town-wide attendance record.'
    },
    {
      label: 'Opportunities',
      available: false,
      reason: 'Brief does not know whether an opportunity was acted on after you left the app.'
    },
    {
      label: 'Community',
      available: false,
      reason: 'Contributions are recorded per Circle. There is no town-wide contribution count.'
    }
  ];

  return { metrics, infoFreshnessPct };
};

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
    QRCode.toDataURL(code, { width: size, margin: 1, color: { dark: '#121214', light: '#FFFFFF' } })
      .then((u) => { if (live) setDataUrl(u); })
      .catch(() => { if (live) setDataUrl(null); });
    return () => { live = false; };
  }, [code, size]);
  if (!dataUrl) return <div className="w-28 h-28 bg-[#0A0A0B] border border-[#1E1E22] rounded-lg" />;
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C1F] text-[#00E676] text-[10px] font-extrabold border border-[#14392B]">
        <MessageCircle className="w-3 h-3" /> WhatsApp
      </a>
      <a href={tg} target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#252C31] text-[#8FAFC4] text-[10px] font-extrabold border border-[#14392B]">
        <ExternalLink className="w-3 h-3" /> Telegram
      </a>
      <button onClick={copy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C1F] text-[#00E676] text-[10px] font-extrabold border border-[#14392B] cursor-pointer">
        <Share2 className="w-3 h-3" /> {copied ? 'Copied' : 'Copy link'}
      </button>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1C1F] text-[#48484A] text-[10px] border border-[#1E1E22]" title="Scan to open">
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
    const res = await briefApi.registerForCampaign(slug, {
      attendeeRef,
      name: name.trim() === '' ? undefined : name.trim(),
      contact: contact.trim() === '' ? undefined : contact.trim()
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

  const c = load.data;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#FFFFFF] font-sans selection:bg-[#00E676] selection:text-[#0A0A0B] flex flex-col">
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-5">
        <p className="text-[9px] text-[#48484A]">Brief</p>

        {load.status === 'loading' && (
          <p className="text-xs text-[#8E8E93] py-12 text-center">Loading...</p>
        )}

        {load.status === 'error' && (
          <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-2xl p-5 space-y-2">
            <p className="text-sm font-extrabold text-[#FFFFFF]">{load.error}</p>
            <button
              onClick={fetchCampaign}
              className="px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {load.status === 'ready' && c && (
          <>
            <div className="space-y-2">
              <p className="text-[9px] text-[#00E676]">
                {c.type}
              </p>
              <h1 className="text-2xl font-extrabold leading-tight">{c.title}</h1>
              {c.creator && (
                <p className="text-[11px] text-[#00E676] font-extrabold">by {c.creator}</p>
              )}
              {c.description && (
                <p className="text-xs text-[#A1A1A6] leading-relaxed">{c.description}</p>
              )}
            </div>

            <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
              {c.startsAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                  <span className="text-xs text-[#FFFFFF]">
                    {c.startsAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              )}
              {c.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                  <span className="text-xs text-[#FFFFFF]">{c.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                <span className="text-xs text-[#FFFFFF]">
                  {c.price === 0 ? 'Free' : `${c.currency} ${c.price.toLocaleString()}`}
                </span>
              </div>
              {c.remaining !== null && (
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                  <span className="text-xs text-[#FFFFFF]">
                    {c.soldOut ? 'Full' : `${c.remaining} spots left`}
                  </span>
                </div>
              )}
              {c.registered > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                  <span className="text-xs text-[#FFFFFF]">
                    {c.registered} {c.registered === 1 ? 'person' : 'people'} registered
                  </span>
                </div>
              )}
            </div>

            <PublicShareRow title={c.title} description={c.description} />

            {done && (
              <div className="border border-[#14392B] bg-[#1C1C1F] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                  <p className="text-sm font-extrabold text-[#FFFFFF]">
                    {done.status === 'started' ? "You have a spot held" : "You're registered"}
                  </p>
                </div>
                <p className="text-[11px] text-[#A1A1A6] leading-snug">
                  {done.status === 'started'
                    ? 'Your spot is held. It is confirmed once payment is arranged with the organiser.'
                    : 'The organiser can see you on their list.'}
                </p>
                {done.ticketCode && (
                  <div className="flex items-center gap-3 pt-1">
                    <PublicTicketQr code={done.ticketCode} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[9px] text-[#48484A]">Your ticket</p>
                      <p className="text-[11px] text-[#D9BB7D] break-all select-all">{done.ticketCode}</p>
                      <p className="text-[10px] text-[#48484A] leading-snug">Show this code at the gate.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!done && (c.status === 'closed' || c.status === 'completed' || c.status === 'cancelled') && (
              <div className="border border-[#1E1E22] rounded-2xl p-5">
                <p className="text-sm font-extrabold text-[#8E8E93]">
                  Registration is closed.
                </p>
              </div>
            )}

            {!done && c.soldOut && c.status !== 'closed' && c.status !== 'cancelled' && (
              <div className="border border-[#1E1E22] rounded-2xl p-5">
                <p className="text-sm font-extrabold text-[#C2A24A]">This one is full.</p>
              </div>
            )}

            {!done &&
              !c.soldOut &&
              (c.status === 'published' || c.status === 'live') && (
                <div className="space-y-3">
                  {regError && (
                    <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-xl p-3">
                      <p className="text-[11px] text-[#FFFFFF] break-words">{regError}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">
                      Your name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name"
                      className="w-full bg-[#1C1C1F] text-[#FFFFFF] text-sm rounded-xl px-3 py-3 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">
                      Phone or email
                    </label>
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="So the organiser can reach you"
                      className="w-full bg-[#1C1C1F] text-[#FFFFFF] text-sm rounded-xl px-3 py-3 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <button
                    disabled={busy}
                    onClick={submit}
                    className="w-full py-4 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-sm cursor-pointer disabled:opacity-40"
                  >
                    {busy ? 'Registering...' : c.price === 0 ? 'Register' : `Register - ${c.currency} ${c.price.toLocaleString()}`}
                  </button>
                  {c.price > 0 && (
                    <p className="text-[10px] text-[#48484A] leading-snug text-center">
                      No online payment is connected yet. Your spot is held and you
                      arrange payment with the organiser.
                    </p>
                  )}
                </div>
              )}
          </>
        )}
      </div>

      <footer className="border-t border-[#1E1E22] py-6 text-[10px] text-[#48484A] text-center">
        Brief
      </footer>
    </div>
  );
}

/** A warm, human greeting for the home header — not a machine timestamp. */
function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  const townHealth = useMemo(
    () => deriveTownHealth(objects, journeys),
    [objects, journeys]
  );

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

  const [activeTab, setActiveTab] = useState<Destination>('nearby');
  const [nearbySection, setNearbySection] = useState<NearbySection>('stream');
  const [myLayerSection, setMyLayerSection] = useState<MyLayerSection>('saved');
  const [workflowSection, setWorkflowSection] = useState<WorkflowSection>('command');
  const [pulseSection, setPulseSection] = useState<PulseSection>('now');

  // --- Ingestion backend (real connectors) ---------------------------------
  // The client holds no tokens. It talks to the ingestion server, which owns
  // every secret. When the server is not running these panels degrade to an
  // explicit "not connected" state rather than pretending.
  const INGEST_API = '/ingest';
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
    // Sources go through briefApi like everything else: one API layer, one
    // set of response guards. Capabilities/status have no binding yet and
    // stay inline until they earn one.
    const [srcRes, capRes, statRes] = await Promise.all([
      briefApi.getSources(),
      fetch(`${INGEST_API}/api/capabilities`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${INGEST_API}/api/status`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]);

    if (!srcRes.ok) {
      // A dead connector server must never break Brief (spec 30).
      setConnectorStatus((prev) => ({ ...prev, online: false, checked: true }));
      return;
    }

    setConnectorStatus({
      online: true,
      checked: true,
      capabilities: capRes,
      liveSources: srcRes.data,
      stats: statRes
    });
  }, []);

  React.useEffect(() => {
    if (activeTab === 'workflows' && workflowSection === 'sources') {
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

  const loadObjects = React.useCallback(async () => {
    setObjectsLoad({ status: 'loading', error: null });
    // The ranked discovery feed: freshness + trust + engagement, server-derived.
    const res = await briefApi.discoverObjects();
    if (res.ok) {
      setObjects((res.data as any[]).map(objectFromServer));
      setObjectsLoad({ status: 'ready', error: null });
    } else {
      setObjects([]);
      setObjectsLoad({ status: 'error', error: res.error });
    }
  }, []);

  React.useEffect(() => {
    void loadObjects();
  }, [loadObjects]);


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
      void refreshConnectors();
      void loadObjects();
    } else {
      setBriefItSaved(res.error);
    }
    setBriefItBusy(false);
  };

  // Both navs call this, so selecting a destination behaves identically on
  // desktop and mobile: you land on that destination's main section.
  const goToDestination = (id: Destination) => {
    setActiveTab(id);
    if (id === 'nearby') setNearbySection('stream');
    if (id === 'mylayer') setMyLayerSection('saved');
    if (id === 'workflows') setWorkflowSection('active');
    if (id === 'pulse') setPulseSection('now');
  };
  const [selectedObjectType, setSelectedObjectType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('Your area');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pursuitDraft, setPursuitDraft] = useState<string>('');
  const [architectMode, setArchitectMode] = useState<boolean>(false);
  // Seen tracking for the Daily Brief: "New" means genuinely not yet opened.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const [selectedObjectForDetail, setSelectedObjectForDetailRaw] = useState<BriefObject | null>(null);

  // Opening an object marks it seen, which is what keeps the Daily Brief's
  // "New" section honest instead of showing the same items forever.
  const setSelectedObjectForDetail = (object: BriefObject | null) => {
    setSelectedObjectForDetailRaw(object);
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

  const [campaignState, setCampaignState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: ApiCampaign[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
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
      { type: 'identity', label: 'Organisations' }
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
    const lines = [
      object.title,
      object.category,
      object.locationName ? `Location: ${object.locationName}` : null,
      action.kind !== 'none' ? `Action: ${action.label}` : null,
      object.sourceUrl ? `Source: ${object.sourceUrl}` : null
    ].filter(Boolean) as string[];

    const payload = lines.join('\n');
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string }) => Promise<void>;
    };

    try {
      if (typeof nav.share === 'function') {
        await nav.share({ title: object.title, text: payload });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        showToast('Copied to clipboard');
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
  const CURRENT_PLAYER_ID = 'ply_nyabs';
  const [arenaGameId, setArenaGameId] = useState<ArenaGameId>('efootball');
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

  // Load the real open challenges from the server and map them onto the
  // display model. Server rows use createdBy/acceptedBy; the client model uses
  // createdByPlayerId/acceptedByPlayerId. Everything else (format, points,
  // suggested times) is a client-only convenience that stays absent for real
  // server-backed challenges rather than being invented.
  const refreshArenaChallenges = React.useCallback(async () => {
    const res = await briefApi.getArenaChallenges();
    if (!res.ok) return;
    setChallenges(res.data.map((c: any) => ({
      id: String(c.id),
      gameId: c.gameId as ArenaGameId,
      mode: String(c.mode ?? '1v1'),
      createdByPlayerId: String(c.createdBy),
      stake: (c.stake ?? 'friendly') as ChallengeStake,
      entryFeeKes: c.entryFeeKes ?? undefined,
      openUntil: c.openUntil,
      status: (c.status ?? 'open') as ChallengeStatus,
      acceptedByPlayerId: c.acceptedBy ? String(c.acceptedBy) : undefined,
      createdAt: c.createdAt
    })));
  }, []);
  useEffect(() => { void refreshArenaChallenges(); }, [refreshArenaChallenges]);
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [arenaView, setArenaView] = useState<'home' | 'find' | 'player'>('home');
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const [findFreeOnly, setFindFreeOnly] = useState(false);
  const [findNearby, setFindNearby] = useState(false);

  // Availability is the user's own switch. Defaults to the seeded record and
  // is never flipped on by Brief.
  const [availability, setAvailability] = useState<PlayerAvailability[]>(ARENA_AVAILABILITY);
  const [ledger, setLedger] = useState<PointsEntry[]>(ARENA_LEDGER);
  const [giftCards, setGiftCards] = useState<GiftCard[]>(GIFT_CARDS);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [tournaments] = useState<Tournament[]>(ARENA_TOURNAMENTS);
  const [arenaSection, setArenaSection] = useState<
    'lobby' | 'available' | 'challenges' | 'tournaments' | 'kings' | 'rewards'
  >('lobby');

  const myAvailability = useMemo(
    () => availability.find((a) => a.playerId === CURRENT_PLAYER_ID && a.gameId === arenaGameId),
    [availability, arenaGameId]
  );

  const handleToggleAvailability = (state: AvailabilityState) => {
    setAvailability((prev) => {
      const existing = prev.find(
        (a) => a.playerId === CURRENT_PLAYER_ID && a.gameId === arenaGameId
      );
      if (existing) {
        return prev.map((a) =>
          a === existing ? { ...a, state, updatedAt: new Date().toISOString() } : a
        );
      }
      return [
        ...prev,
        {
          playerId: CURRENT_PLAYER_ID,
          state,
          gameId: arenaGameId,
          mode: 'free_match' as PlayMode,
          format: '1v1' as PlayFormat,
          window: 'now' as AvailabilityWindow,
          locationKind: 'online' as const,
          updatedAt: new Date().toISOString()
        }
      ];
    });
    showToast(
      state === 'available'
        ? 'You are listed as available. Only you control this.'
        : 'You are no longer listed as available.'
    );
  };

  const availableNow = useMemo(
    () =>
      getAvailablePlayers(
        {
          players: ARENA_PLAYERS,
          availability,
          identities: ARENA_IDENTITIES,
          stats: ARENA_STATS,
          reliability: ARENA_RELIABILITY
        },
        { gameId: arenaGameId, excludePlayerId: CURRENT_PLAYER_ID }
      ),
    [availability, arenaGameId]
  );

  const leagueSeekers = useMemo(
    () => getLeagueSeekers({ players: ARENA_PLAYERS, availability }, arenaGameId),
    [availability, arenaGameId]
  );

  const participationToday = useMemo(
    () => getParticipationEarnedOn(ledger, CURRENT_PLAYER_ID, '2026-08-15T00:00:00Z'),
    [ledger]
  );

  const myBalance = useMemo(
    () => getPointsBalance(ledger, CURRENT_PLAYER_ID),
    [ledger]
  );

  // Challenges addressed to this user, awaiting a decision.
  const incomingChallenges = useMemo(
    () => challenges.filter((c) => c.toPlayerId === CURRENT_PLAYER_ID && c.status === 'pending'),
    [challenges]
  );

  // Gaming activity detected in groups the user is ALREADY a member of.
  // Runs over the access-checked indexes, so an inaccessible group can never
  // contribute a signal.
  // Workflows secondary is derived from real Journey data, not a new store.
  // PULSE derivations. Every one reads existing state -- posts, objects,
  // groups the user already belongs to. Nothing here is generated or inferred
  // by a model; Pulse is a reading of the information layer, not an assistant.
  const pulseNow = useMemo(
    () =>
      [...posts]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 6),
    [posts]
  );

  const pulseNotices = useMemo(
    () => posts.filter((p) => p.kind === 'notice' || p.kind === 'news'),
    [posts]
  );

  const pulseRecentlyVerified = useMemo(
    () =>
      objects
        .filter((obj) => obj.isVerified && obj.lastVerifiedAt)
        .sort((a, b) => (b.lastVerifiedAt ?? '').localeCompare(a.lastVerifiedAt ?? ''))
        .slice(0, 5),
    [objects]
  );

  // What the groups you are already in are surfacing. Membership is never
  // invented: this walks visibleGroups only.
  const pulseGroupSignals = useMemo(() => {
    const out: {
      id: string;
      groupName: string;
      text: string;
      at: string;
    }[] = [];
    for (const group of visibleGroups) {
      for (const entry of groupIndexes[group.id] ?? []) {
        out.push({
          id: `pulse_${entry.id}`,
          groupName: group.name,
          text: entry.originalText,
          at: entry.sentAt
        });
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [visibleGroups, groupIndexes]);

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

  const abuseFlags = useMemo(
    () => detectAbuse(matches, tournaments, ARENA_RELIABILITY, '2026-08-15T10:00:00Z'),
    [matches, tournaments]
  );

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

  const handleRedeemGiftCard = (card: GiftCard) => {
    const gate = canRedeemGiftCard(card, {
      balance: myBalance,
      region: 'Nairobi',
      controls: REWARD_POOL_CONTROLS,
      now: '2026-08-15T10:00:00Z'
    });
    if (!gate.allowed) {
      showToast(gate.reason);
      return;
    }
    const id = `rdm_${card.id}_${Date.now()}`;
    // Recorded as processing. No voucher code is invented here -- a code only
    // exists once a real provider issues one.
    setRedemptions((prev) => [
      ...prev,
      {
        id,
        giftCardId: card.id,
        playerId: CURRENT_PLAYER_ID,
        pointsSpent: card.pointsRequired,
        at: new Date().toISOString(),
        status: 'processing'
      }
    ]);
    setLedger((prev) => [
      ...prev,
      {
        id: `pe_${id}`,
        playerId: CURRENT_PLAYER_ID,
        reason: 'redemption',
        amount: -card.pointsRequired,
        at: new Date().toISOString(),
        refId: card.id
      }
    ]);
    setGiftCards((prev) =>
      prev.map((g) => (g.id === card.id ? { ...g, inventory: g.inventory - 1 } : g))
    );
    showToast('Redemption submitted. Your code appears once the merchant issues it.');
  };

  const arenaGame = useMemo(
    () => ARENA_GAMES.find((g) => g.id === arenaGameId) ?? ARENA_GAMES[0],
    [arenaGameId]
  );

  // The lobby shows open challenges for the selected game only.
  const lobbyChallenges = useMemo(
    () =>
      challenges.filter(
        (c) => c.gameId === arenaGameId && c.status === 'open'
      ),
    [challenges, arenaGameId]
  );

  const findResults = useMemo(
    () =>
      findGameCandidates(
        {
          gameId: arenaGameId,
          location: findNearby ? 'nearby' : 'any',
          freeOnly: findFreeOnly
        },
        {
          players: ARENA_PLAYERS,
          identities: ARENA_IDENTITIES,
          stats: ARENA_STATS,
          challenges,
          excludePlayerId: CURRENT_PLAYER_ID
        }
      ),
    [arenaGameId, challenges, findFreeOnly, findNearby]
  );

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
    showToast('Challenge accepted. Match created.');
  };

  // Venues that actually host the selected game, nearest first.
  const nearbyVenues = useMemo(
    () =>
      ARENA_VENUES.filter((v) => v.gameIds.includes(arenaGameId)).sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      ),
    [arenaGameId]
  );

  // Live activity per game: open challenges plus players checked in at a
  // venue. Drives the count on each game chip, so the selector is dynamic.
  const gameActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of ARENA_GAMES) {
      const open = challenges.filter(
        (c) => c.gameId === g.id && c.status === 'open'
      ).length;
      const atVenues = ARENA_CHECKINS.filter((c) => c.gameId === g.id).length;
      counts[g.id] = open + atVenues;
    }
    return counts;
  }, [challenges]);

  const openPlayer = useMemo(
    () => ARENA_PLAYERS.find((p) => p.id === openPlayerId) ?? null,
    [openPlayerId]
  );

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
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [capturePreview, setCapturePreview] = useState<IngestionCandidate | null>(null);

  const handleCaptureParse = () => {
    const raw = captureText.trim();
    if (raw === '') return;
    const message = buildCaptureMessage(raw, new Date().toISOString());
    setCapturePreview(parseInboundMessage(message, objects));
  };

  const handleCaptureConfirm = () => {
    if (!capturePreview || !capturePreview.isObjectWorthy) return;
    handleAcceptCandidate(capturePreview);
    setCaptureText('');
    setCapturePreview(null);
    setCaptureOpen(false);
  };

  const handleCaptureCancel = () => {
    setCaptureText('');
    setCapturePreview(null);
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

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#FFFFFF] flex flex-col font-sans selection:bg-[#00E676] selection:text-[#0A0A0B]">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00E676] text-[#0A0A0B] px-4 py-2.5 rounded-xl font-extrabold shadow-2xl flex items-center gap-2">
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
          <div className="brief-spring-modal fixed top-1/2 left-1/2 z-[70] w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#00E676]/25 bg-[#16161A]/90 px-6 py-8 text-center shadow-2xl">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Nothing to do here?</h3>
            <p className="text-sm text-[#8E8E93] leading-relaxed mb-6">
              The current timeline is looking ultra quiet. Let's look into a
              different zone.
            </p>
            <button
              onClick={() => setSpringOverlayOpen(false)}
              className="w-full py-4 rounded-lg bg-[#1C1C1F] border border-[#00E676]/30 text-[#FFFFFF] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#00E676]/70 active:translate-y-0.5 active:scale-[0.96] active:border-white"
            >
              🗓️ Check a Different Time
            </button>
          </div>
        </>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B]/95 backdrop-blur-xl border-b border-[#1E1E22] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-xl text-[#00E676] tracking-tight">Brief</span>
              {/* Where am I. The rail shows it too, but the header keeps the
                  answer visible when the rail is collapsed to icons. */}
              <span className="hidden lg:inline text-[11px] font-extrabold text-[#48484A]">
                {DESTINATIONS.find((d) => d.id === activeTab)?.label}
              </span>
              <div className="flex items-center gap-1 bg-[#1C1C1F] text-[#FFFFFF] text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#14392B]">
                <MapPin className="w-3.5 h-3.5 text-[#00E676]" />
                <span>{selectedLocation}</span>
              </div>
            </div>

            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E93]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nearby places, jobs, services..."
                className="w-full bg-[#1C1C1F] text-[#FFFFFF] text-xs rounded-xl pl-9 pr-4 py-2 border border-[#1E1E22] focus:outline-none focus:border-[#00E676] placeholder:text-[#8E8E93]"
              />
            </div>

            <button
              onClick={() => setCaptureOpen(true)}
              title="Capture something"
              className="p-2 rounded-xl text-xs font-bold border bg-[#00E676] text-[#0A0A0B] border-[#00E676] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setArchitectMode(!architectMode)}
              className="p-2 rounded-xl text-xs font-bold border bg-[#1C1C1F] text-[#00E676] border-[#14392B] cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Shell: persistent rail on the left from md up, bottom bar below that.
          Both read from DESTINATIONS so they cannot disagree. */}
      <div className="flex-1 flex w-full">

        {/* DESKTOP / TABLET RAIL. Slim by default, expands on hover so it
            never eats horizontal space the content needs. */}
        <nav
          aria-label="Primary"
          className="hidden md:flex flex-col shrink-0 w-[76px] hover:w-60 transition-all duration-200 border-r border-[#1E1E22] bg-[#121214] sticky top-[57px] h-[calc(100vh-57px)] py-4 group/rail overflow-hidden"
        >
          {DESTINATIONS.map((d) => {
            const active = activeTab === d.id;
            const Icon = DESTINATION_ICONS[d.id];
            return (
              <button
                key={d.id}
                onClick={() => goToDestination(d.id)}
                title={d.hint}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  active
                    ? 'text-[#00E676] bg-[#1C1C1F] font-extrabold'
                    : 'text-[#00E676] hover:text-[#FFFFFF]'
                }`}
              >
                {/* Active marker on the edge, not a heavy filled pill. */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                    active ? 'h-7 bg-[#00E676]' : 'h-0 bg-transparent'
                  }`}
                />
                <Icon className="w-5 h-5 shrink-0" />
                {/* Collapsed shows the icon only (with a title tooltip).
                    Expanded adds the name and a one-line description. */}
                <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
                  <span className="block text-[11px] font-extrabold whitespace-nowrap">
                    {d.label}
                  </span>
                  <span className="block text-[9px] text-[#48484A] whitespace-nowrap">
                    {d.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main Stream. pb-24 on mobile clears the bottom bar. */}
        <main className="flex-1 min-w-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">

        {/* Visual Hero Bar */}
        <div className="mb-6 rounded-2xl bg-[#1C1C1F] border border-[#14392B] p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-[#8E8E93] mb-1">{greetingForHour(new Date().getHours())}</p>
            <h1 className="text-xl font-extrabold text-[#FFFFFF]">
              What's happening around you
            </h1>
            <p className="text-xs text-[#8E8E93] mt-1">
              {objects.length > 0
                ? `${objects.length} thing${objects.length === 1 ? '' : 's'} happening nearby`
                : 'Nothing happening nearby yet — check again later or look around another area.'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        {/* Sub-navigation. Sections live INSIDE a destination, so the top
            bar stays five doors wide no matter how much is built. */}
        {activeTab === 'nearby' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {([
                ['stream', 'Everything'],
                ['tea', 'Tea'],
                ['today', `Today${dailyBrief.length > 0 ? ' *' : ''}`],
                ['pursuits', `Pursuits${pursuits.length > 0 ? ` (${pursuits.length})` : ''}`],
                ['quests', `Quests${openQuests.length > 0 ? ` (${openQuests.length})` : ''}`],
                // Standalone commerce. A SECTION inside Nearby, not a sixth
                // destination: buying from a local seller is a nearby act.
                ['market', 'Market']
              ] as [NearbySection, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setNearbySection(id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    nearbySection === id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mylayer' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {([
                ['saved', `Saved (${relationships.length})`],
                ['activity', 'Activity'],
                ['arena', `Arena${matches.length > 0 ? ` (${matches.length})` : ''}`],
                ['points', 'Points'],
                // Circle is the community primitive. "Groups" beside it is
                // the connected-source reader, not a second community model.
                ['circles', 'Circles'],
                ['groups', `Groups${unansweredQuestions.length > 0 ? ` (${unansweredQuestions.length})` : ''}`],
                ['campaigns', 'Campaigns']
              ] as [MyLayerSection, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMyLayerSection(id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    myLayerSection === id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {([
                // Command is the host's landing surface: the overview of what
                // needs attention, money, people, distribution and what's next.
                ['command', 'Command'],
                ['active', `Active (${activeJourneys.length})`],
                ['completed', `Completed (${completedJourneys.length})`],
                ['inbox', `Inbox${pendingCandidates.length > 0 ? ` (${pendingCandidates.length})` : ''}`],
                ['sources', 'Sources'],
                // A SECTION inside Workflows, not a sixth destination. The
                // rail stays five doors wide: Around / Play / Saved /
                // Actions / Pulse.
                ['money', 'Money'],
                ['vault', 'Vault'],
                ['gate', 'Gate']
              ] as [WorkflowSection, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setWorkflowSection(id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    workflowSection === id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pulse' && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {([
                ['now', 'Now'],
                ['local', 'Local'],
                ['groups', 'Groups'],
                ['signals', 'Signals']
              ] as [PulseSection, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPulseSection(id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                    pulseSection === id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'stream' && (
          <>
            {/* TEA */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[10px] font-extrabold text-[#00E676] shrink-0">
                    Today's Tea
                  </span>
                  <span className="text-[11px] text-[#00E676] truncate">
                    What Nairobi is talking about
                  </span>
                </div>

                <button
                  onClick={() => { setActiveTab('nearby'); setNearbySection('tea'); }}
                  className="shrink-0 text-[10px] font-extrabold text-[#00E676] hover:text-[#00E676] px-2 py-1 rounded-full cursor-pointer transition"
                >
                  See all
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {TEA_EDITIONS.map(({ edition, label, Icon }) => (
                  <button
                    key={edition}
                    onClick={() => {
                      setActiveEdition(edition);
                      setActiveTab('nearby');
                      setNearbySection('tea');
                    }}
                    className="shrink-0 flex items-center gap-1.5 bg-[#1C1C1F] border border-[#14392B] hover:border-[#00E676] rounded-full px-3 py-1.5 transition cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                    <span className="text-[11px] font-extrabold text-[#FFFFFF] whitespace-nowrap">
                      {label}
                    </span>
                    {edition === liveEdition && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* HAPPENING NEARBY (rework 10). Passing-mass discovery: if
                something is on today near the selected location, surface it
                above the browse grid so a person walking around the city sees
                it without searching. Empty when nothing is genuinely on. */}
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
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
                    <h3 className="text-[11px] font-extrabold text-[#00E676]">
                      Happening nearby
                    </h3>
                  </div>
                  <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar">
                    {active.map((obj) => {
                      const vendors = getDestinationVendors(obj, objects);
                      return (
                        <button
                          key={obj.id}
                          onClick={() => setSelectedObjectForDetail(obj)}
                          className="shrink-0 w-60 text-left bg-[#1C1C1F] border border-[#14392B] hover:border-[#00E676] rounded-2xl p-3 cursor-pointer transition"
                        >
                          <p className="text-xs font-extrabold text-[#FFFFFF] line-clamp-1">
                            {obj.title}
                          </p>
                          <p className="text-[10px] text-[#8E8E93] mt-0.5 line-clamp-1">
                            {obj.locationName}
                            {getDistanceLabel(obj) ? ` - ${getDistanceLabel(obj)}` : ''}
                          </p>
                          {vendors.length > 0 && (
                            <p className="text-[10px] text-[#00E676] mt-1">
                              {vendors.length}{' '}
                              {vendors.length === 1 ? 'vendor' : 'vendors'} inside
                            </p>
                          )}
                          <span className="inline-block text-[10px] font-extrabold text-[#00E676] mt-1.5">
                            See what's here
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Stream Filters */}
            <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Everything' },
                { id: 'place', label: 'Places' },
                { id: 'experience', label: 'Events' },
                { id: 'opportunity', label: 'Opportunities' },
                { id: 'service', label: 'Services' },
                { id: 'product', label: 'Market' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedObjectType(filter.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                    selectedObjectType === filter.id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B] hover:border-[#00E676]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Objects */}
            {filteredObjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredObjects.map((obj) => {
                  // Destination treatment (rework 3/17). Level 3 = on today
                  // with vendors inside; it spans the grid and leads with what
                  // is there. Level 2 = upcoming destination. Everything else
                  // renders exactly as it always has.
                  const destVendors = isDestinationObject(obj)
                    ? getDestinationVendors(obj, objects)
                    : [];
                  const level = getCardLevel(obj, destVendors.length);
                  const destState = getDestinationState(obj);
                  const access = getDestinationAccess(obj);
                  const vendorCats = getVendorCategories(destVendors);
                  return (
                  <div
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className={`bg-[#1C1C1F] border hover:bg-[#13291C] rounded-2xl p-4 cursor-pointer transition ${
                      level === 3
                        ? 'border-[#00E676] md:col-span-2 lg:col-span-3'
                        : level === 2
                        ? 'border-[#14392B] hover:border-[#00E676]'
                        : 'border-[#1E1E22] hover:border-[#00E676]'
                    }`}
                  >
                    {level >= 2 && (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            destState === 'live' || destState === 'today'
                              ? 'bg-[#00E676] text-[#0A0A0B]'
                              : 'bg-[#121214] text-[#00E676] border border-[#14392B]'
                          }`}
                        >
                          {(destState === 'live' || destState === 'today') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0B]" />
                          )}
                          {DESTINATION_STATE_LABELS[destState]}
                        </span>
                        {access && (
                          <span className="text-[9px] font-extrabold text-[#00E676]">
                            {access}
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      {obj.imageUrl && (
                        <div className="relative h-44 w-full bg-[#0A0A0B] overflow-hidden">
                          <img
                            src={obj.imageUrl}
                            alt={obj.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                          />

                          <div className="absolute top-3 left-3 flex items-center gap-2">
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#0A0A0B]/80 text-[#00E676] border border-[#14392B]">
                              {obj.category}
                            </span>

                            {obj.isVerified && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00E676] text-[#0A0A0B]">
                                VERIFIED
                              </span>
                            )}
                          </div>

                          {obj.metadata?.price !== undefined && (
                            <span className="absolute bottom-2 right-3 text-[#00E676] text-sm font-extrabold bg-[#0A0A0B]/80 px-2 py-0.5 rounded border border-[#14392B]">
                              {obj.metadata.currency || 'KES'} {obj.metadata.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Imageless objects must not silently lose their
                          category and verification chips -- these used to live
                          only inside the hero image block. Same chips, same
                          styling, just reachable without a photo. */}
                      {!obj.imageUrl && (
                        <div className="flex items-center gap-2 px-4 pt-1">
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#0A0A0B]/80 text-[#00E676] border border-[#14392B]">
                            {obj.category}
                          </span>

                          {obj.isVerified && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00E676] text-[#0A0A0B]">
                              VERIFIED
                            </span>
                          )}
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] text-[#8E8E93]">
                            {getObjectTypeMeta(obj.type).label}
                          </span>

                        </div>

                        <h3 className="text-base font-extrabold text-[#FFFFFF] group-hover:text-[#00E676] line-clamp-2">
                          {obj.title}
                        </h3>

                        {/* Status (prompt 9): displayed only when explicitly
                            supplied. Never computed from partial data, and
                            deliberately below the title, not competing with it. */}
                        {obj.metadata?.statusBadge && (
                          <span className="inline-block text-[10px] font-bold text-[#00E676]">
                            {obj.metadata.statusBadge}
                          </span>
                        )}

                        <p className="text-xs text-[#00E676] line-clamp-2">
                          {obj.summary}
                        </p>

                        {obj.locationName && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#8E8E93]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{obj.locationName}</span>
                            {getDistanceLabel(obj) && (
                              <span className="ml-auto shrink-0 text-[#00E676]">
                                {getDistanceLabel(obj)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* WHAT IS INSIDE (rework 11). Counts and categories
                            are read off real linked records -- a destination
                            with no stated vendors shows nothing here rather
                            than a fabricated line-up. */}
                        {level === 3 && destVendors.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[10px] font-extrabold text-[#FFFFFF]">
                              {destVendors.length}{' '}
                              {destVendors.length === 1 ? 'vendor' : 'vendors'} inside
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
                              {vendorCats.map((cat) => (
                                <span
                                  key={cat}
                                  className="shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#121214] text-[#00E676] border border-[#1E1E22]"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 pt-0 flex items-center gap-2">
                      {/* "See what's here" opens the context; it is not a
                          booking. Only destinations with something inside get
                          it -- otherwise the object keeps its real action. */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (level === 3 && destVendors.length > 0) {
                            setSelectedObjectForDetail(obj);
                            return;
                          }
                          handlePrimaryAction(obj);
                        }}
                        className="flex-1 bg-[#00E676] hover:bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>
                          {level === 3 && destVendors.length > 0
                            ? "See what's here"
                            : resolveAction(obj).label}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteProtocolAction('save', obj);
                        }}
                        className="p-2.5 rounded-xl bg-[#1C1C1F] text-[#00E676] border border-[#1E1E22] hover:bg-[#14392B] cursor-pointer"
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-[#8E8E93]">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-bold">Nothing nearby right now.</p>

                {/* A search that finds nothing is the clearest signal of
                    intent Brief ever gets. Rather than a dead end, offer to
                    keep pursuing it as information arrives. */}
                {searchQuery.trim() !== '' ? (
                  <div className="mt-4">
                    <p className="text-[11px] text-[#48484A] mb-2">
                      Brief has not seen anything matching this yet.
                    </p>
                    <button
                      onClick={() => handleCreatePursuit(searchQuery)}
                      className="px-4 py-2 rounded-xl bg-[#1C1C1F] border border-[#14392B] text-[#00E676] font-extrabold text-[11px] cursor-pointer"
                    >
                      Keep pursuing "{searchQuery.trim()}"
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] text-[#48484A] max-w-xs mx-auto leading-relaxed">
                      Everything here arrives from the communities and sources
                      Brief is connected to. Connect a source or capture
                      something in Workflows → Sources.
                    </p>
                    {/* The spring overlay trigger: an explicit affordance, so
                        the empty state never covers the app unprompted. */}
                    <button
                      onClick={() => setSpringOverlayOpen(true)}
                      className="mx-auto px-4 py-2 rounded-xl bg-[#1C1C1F] border border-[#00E676]/30 text-[#00E676] font-bold text-[11px] cursor-pointer flex items-center gap-2 transition-transform hover:-translate-y-0.5 hover:border-[#00E676]/70 active:translate-y-0.5 active:scale-[0.96]"
                    >
                      🗓️ Check a Different Time
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TEA */}
        {activeTab === 'nearby' && nearbySection === 'tea' && (
          <section className="space-y-4">
            <div className="bg-[#1C1C1F] border border-[#14392B] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-4 h-4 text-[#00E676]" />
                <span className="text-[10px] text-[#00E676]">
                  Tea
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                What people are talking about
              </h2>

              <p className="text-xs text-[#00E676] mt-1">
                News, notices and neighbourhood chatter, alongside the
                directory. Posts link back to the places they are about.
              </p>
            </div>

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
                        ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                        : 'bg-[#1C1C1F] text-[#00E676] border-[#14392B] hover:border-[#00E676]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-extrabold whitespace-nowrap">
                      {label}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isActive ? 'text-[#0A0A0B]/70' : 'text-[#8E8E93]'
                      }`}
                    >
                      {count}
                    </span>
                    {edition === liveEdition && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#8E8E93] px-1">
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
                  className={`bg-[#1C1C1F] border rounded-2xl p-4 ${
                    post.isPromoted ? 'border-[#5F3A1E]' : 'border-[#1E1E22]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-[#0A0A0B] ${kindMeta.tone}`}
                    >
                      {kindMeta.label}
                    </span>

                    <span className="text-[11px] font-bold text-[#FFFFFF]">
                      {post.authorName}
                    </span>

                    {post.authorIsVerified && (
                      <ShieldCheck className="w-3 h-3 text-[#00E676] shrink-0" />
                    )}

                    <span className="text-[10px] text-[#8E8E93]">
                      {getRelativeTime(post.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#FFFFFF] leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-[#00E676] mt-1.5 leading-relaxed">
                    {post.body}
                  </p>

                  {post.isPromoted && (
                    <p className="text-[10px] text-[#FF9F6E] mt-2">
                      Paid distribution by {post.promotedBy}.
                    </p>
                  )}

                  {subject && (
                    <button
                      onClick={() => openPostSubject(post)}
                      className="mt-3 w-full flex items-center gap-2 bg-[#0A0A0B] border border-[#1E1E22] hover:border-[#00E676] rounded-xl p-2.5 transition cursor-pointer group text-left"
                    >
                      {subject.imageUrl && (
                        <img
                          src={subject.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-[#8E8E93]">
                          About this {getObjectTypeMeta(subject.type).label}
                        </div>
                        <div className="text-[11px] font-extrabold truncate group-hover:text-[#00E676]">
                          {subject.title}
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                    </button>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1E1E22]">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition ${
                        isLiked ? 'text-[#00E676]' : 'text-[#8E8E93] hover:text-[#00E676]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                      />
                      {formatCount(post.reactionsCount + (isLiked ? 1 : 0))}
                    </button>

                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93]">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {formatCount(post.commentsCount)}
                    </span>

                    {post.tags && post.tags.length > 0 && (
                      <span className="ml-auto text-[10px] text-[#8E8E93] truncate">
                        {post.tags.map((tag) => `#${tag}`).join(' ')}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {editionPosts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[#14392B] rounded-2xl">
                <Newspaper className="w-8 h-8 mx-auto mb-3 text-[#8E8E93]" />
                <p className="text-sm font-bold">No tea in this edition yet.</p>
              </div>
            )}
          </section>
        )}

        {/* MY LAYER */}
        {activeTab === 'mylayer' && myLayerSection === 'saved' && (
          <section className="space-y-4">
            <div className="bg-[#1C1C1F] border border-[#14392B] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-4 h-4 text-[#00E676]" />
                <span className="text-[10px] text-[#00E676]">
                  Your saved things
                </span>
              </div>

              <h2 className="text-xl font-extrabold">Things you've kept.</h2>

              <p className="text-xs text-[#00E676] mt-1">
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
                  <h3 className="text-[11px] font-extrabold text-[#00E676]">
                    {group.label}
                  </h3>
                  <span className="text-[10px] text-[#8E8E93]">
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
                        className="bg-[#1C1C1F] border border-[#1E1E22] hover:border-[#00E676] rounded-2xl p-3 transition"
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
                              <div className="text-[9px] text-[#8E8E93]">
                                {obj.category}
                              </div>
                              <div className="text-xs font-extrabold mt-0.5 line-clamp-2 group-hover:text-[#00E676]">
                                {obj.title}
                              </div>
                              {distance && (
                                <div className="text-[10px] text-[#8E8E93] mt-1">
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
                              className="flex-1 py-2 rounded-xl bg-[#1C1C1F] border border-[#14392B] text-[#00E676] font-extrabold text-[11px] cursor-pointer"
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
                              className="flex-1 py-2 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {action.label}
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            onClick={() => handleCreatePursuit(obj.title)}
                            title="Pursue similar"
                            className="p-2 rounded-xl bg-[#1C1C1F] text-[#00E676] border border-[#1E1E22] hover:border-[#00E676] cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleUnsave(obj)}
                            title="Remove from saved"
                            className="p-2 rounded-xl bg-[#1C1C1F] text-[#00E676] border border-[#1E1E22] hover:border-[#00E676] cursor-pointer"
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
                                    ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                                    : 'bg-transparent text-[#48484A] border-[#1E1E22] hover:border-[#14392B]'
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
                <div className="mt-8 pt-5 border-t border-[#1E1E22]">
                  <p className="text-[10px] text-[#48484A] mb-3">
                    Recent activity
                  </p>
                  <div className="space-y-1.5">
                    {recent.map((entry) => (
                      <button
                        key={`${entry.object.id}_${entry.verb}`}
                        onClick={() => setSelectedObjectForDetail(entry.object)}
                        className="w-full text-left flex items-center gap-2 py-1.5 cursor-pointer"
                      >
                        <span className="text-[9px] text-[#00E676] w-20 shrink-0">
                          {entry.verb}
                        </span>
                        <span className="text-[11px] text-[#A1A1A6] truncate">
                          {entry.object.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {savedObjects.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[#14392B] rounded-2xl">
                <Bookmark className="w-8 h-8 mx-auto mb-3 text-[#8E8E93]" />
                <p className="text-sm font-bold">Nothing saved yet.</p>
                <p className="text-xs text-[#8E8E93] mt-1">
                  Save something from Nearby and it will appear here.
                </p>
              </div>
            )}
          </section>
        )}

        {/* WORKFLOWS */}
        {activeTab === 'workflows' &&
          (workflowSection === 'active' || workflowSection === 'completed') && (
          <section className="space-y-5">
            <div className="bg-[#1C1C1F] border border-[#14392B] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-[#00E676]" />
                <span className="text-[10px] text-[#00E676]">
                  Workflows
                </span>
              </div>

              <h2 className="text-xl font-extrabold">
                Things you can actually do.
              </h2>

              <p className="text-xs text-[#00E676] mt-1">
                {workflowSection === 'completed'
                  ? 'Processes you have already finished.'
                  : 'Follow a process instead of figuring it out from scratch.'}
              </p>
            </div>

            {(workflowSection === 'completed' ? completedJourneys : activeJourneys)
              .length === 0 && (
              <p className="text-xs text-[#8E8E93]">
                {workflowSection === 'completed'
                  ? 'Nothing finished yet. Things you complete will stay here for reference.'
                  : 'Your activities will appear here.'}
              </p>
            )}

            {(workflowSection === 'completed' ? completedJourneys : activeJourneys).map((journey) => (
              <div
                key={journey.id}
                className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-[#00E676]">
                        {journey.category}
                      </span>

                      <h3 className="text-lg font-extrabold mt-1">
                        {journey.title}
                      </h3>

                      <p className="text-xs text-[#00E676] mt-1">
                        {journey.description}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-[#00E676]">
                      {journey.progressPercent}%
                    </span>
                  </div>

                  <div className="h-1.5 bg-[#0A0A0B] rounded-full mt-5 overflow-hidden">
                    <div
                      className="h-full bg-[#00E676] rounded-full"
                      style={{ width: `${journey.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-[#1E1E22]">
                  {journey.steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-4 border-b border-[#1E1E22] last:border-b-0"
                    >
                      {step.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#00E676] shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#8E8E93] shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold">
                          {step.title}
                        </p>
                        <p className="text-[10px] text-[#8E8E93]">
                          {step.description}
                        </p>
                      </div>

                      <span className="text-[9px] text-[#00E676]">
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
              <h2 className="text-lg font-extrabold text-[#FFFFFF]">Arena</h2>
              <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
                Players looking for a game, an opponent or a squad. Not a feed.
              </p>
            </div>

            {/* REAL-MONEY GATE.
                Entry fees are arranged between players. Brief does not hold,
                pool or pay out stakes, and says so rather than implying a
                wallet exists. The requirement list is the server's, so this
                cannot drift out of sync with what the backend will allow. */}
            {arenaMoney && !arenaMoney.enabled && (
              <div className="bg-[#1A1206] border border-[#4A3A12] rounded-2xl p-3">
                <p className="text-[11px] font-extrabold text-[#C2A24A]">
                  Brief does not handle match money
                </p>
                <p className="text-[10px] text-[#8E8E93] leading-snug mt-1">
                  Entry fees shown here are arranged directly between players.
                  Brief holds no stakes and pays out no winnings.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {arenaMoney.requirements
                    .filter((r) => !r.met)
                    .map((r) => (
                      <li key={r.id} className="text-[9px] text-[#48484A]">
                        - {r.label}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Game selection. Arena is game-agnostic; eFootball is only the
                first entry in the list. */}
            <div className="flex flex-wrap gap-2">
              {ARENA_GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setArenaGameId(g.id);
                    setArenaView('home');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer border ${
                    arenaGameId === g.id
                      ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                      : 'bg-[#1C1C1F] text-[#00E676] border-[#1E1E22]'
                  }`}
                >
                  {g.shortName}
                  {gameActivity[g.id] > 0 ? ` (${gameActivity[g.id]})` : ''}
                </button>
              ))}
            </div>

            {/* Availability node. The dot is the signal, not decoration. */}
            {arenaView === 'home' && (
              <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        myAvailability?.state === 'available'
                          ? 'bg-[#00E676]'
                          : myAvailability?.state === 'busy'
                          ? 'bg-[#C2A24A]'
                          : 'bg-[#48484A]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#FFFFFF]">
                        {myAvailability?.state === 'available'
                          ? `Available for ${PLAY_MODE_LABELS[myAvailability.mode]}`
                          : myAvailability?.state === 'busy'
                          ? 'Busy'
                          : 'Not available'}
                      </p>
                      <p className="text-[9px] text-[#48484A]">
                        {arenaGame.shortName}
                        {myAvailability?.state === 'available'
                          ? ` - ${myAvailability.format} - ${myAvailability.window === 'now' ? 'Now' : 'Today'}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(['available', 'busy', 'offline'] as AvailabilityState[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleToggleAvailability(st)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-extrabold cursor-pointer border ${
                          (myAvailability?.state ?? 'offline') === st
                            ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                            : 'bg-[#121214] text-[#00E676] border-[#1E1E22]'
                        }`}
                      >
                        {st === 'available' ? 'Available' : st === 'busy' ? 'Busy' : 'Offline'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Compact section switcher, not six giant cards. */}
            {/* AVAILABILITY NODE. The first thing you see on entering Arena:
                how many people are actually available right now, and one way
                to act on it. It sits above the section pills so it is part of
                the entry point rather than one tab's content. Availability is
                a state shown in context, never a navigation destination. */}
            {arenaView === 'home' && (
              <div className="bg-[#1C1C1F] border border-[#14392B] rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        availableNow.length > 0 ? 'bg-[#00E676]' : 'bg-[#48484A]'
                      }`}
                    />
                    <p className="text-sm font-extrabold text-[#FFFFFF]">
                      {availableNow.length}{' '}
                      {availableNow.length === 1 ? 'player' : 'players'} available now
                    </p>
                  </div>
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
                    Ready to play {arenaGame.name}. Availability is set by each
                    player and expires on its own.
                  </p>
                </div>
                <button
                  onClick={() => setArenaView('find')}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-[#00E676] text-[#0A0A0B] cursor-pointer"
                >
                  Find Match
                </button>
              </div>
            )}

            {arenaView === 'home' && (
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['lobby', 'Play Now'],
                  ['available', `Players (${availableNow.length})`],
                  ['challenges', `Challenges${incomingChallenges.length > 0 ? ` (${incomingChallenges.length})` : ''}`],
                  ['tournaments', 'Tournaments'],
                  ['kings', 'Kings & Queens'],
                  ['rewards', 'Rewards']
                ] as [typeof arenaSection, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setArenaSection(key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                      arenaSection === key
                        ? 'bg-[#121214] text-[#00E676] border-[#00E676]'
                        : 'bg-[#1C1C1F] text-[#00E676] border-[#1E1E22]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {arenaView === 'home' && arenaSection === 'available' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-[11px] font-extrabold text-[#48484A]">
                    Players available now
                  </h3>
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
                    Only players who switched availability on themselves.
                  </p>
                </div>
                {availableNow.length === 0 && (
                  <p className="text-xs text-[#8E8E93]">
                    Nobody is listed as available for {arenaGame.name}.
                  </p>
                )}
                {availableNow.map((e) => {
                  const venue = e.availability.venueId
                    ? ARENA_VENUES.find((v) => v.id === e.availability.venueId)
                    : undefined;
                  return (
                    <div
                      key={e.player.id}
                      className={`bg-[#1C1C1F] border rounded-2xl p-3 flex items-center gap-3 ${
                        e.visibility === 'reduced' ? 'border-[#121214] opacity-70' : 'border-[#1E1E22]'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-[#121214] text-[#00E676] text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {e.player.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[#FFFFFF] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0" />
                          {e.player.displayName}
                        </p>
                        <p className="text-[9px] text-[#48484A] mt-0.5">
                          {arenaGame.shortName} - {PLAY_MODE_LABELS[e.availability.mode]} -{' '}
                          {e.availability.format} -{' '}
                          {/* Venue name or "Online". Never a coordinate. */}
                          {e.availability.locationKind === 'venue'
                            ? venue
                              ? venue.name
                              : 'At a venue'
                            : 'Online'}
                        </p>
                        <p className="text-[9px] text-[#8E8E93] mt-0.5">
                          {e.stats
                            ? `${e.stats.wins}W / ${e.stats.losses}L`
                            : 'No matches yet'}
                          {typeof e.reliability === 'number'
                            ? ` - ${e.reliability}% reliability`
                            : ' - reliability not established'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleChallengePlayer(e.player.id)}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                      >
                        Challenge
                      </button>
                    </div>
                  );
                })}

                {leagueSeekers.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                      Looking for league
                    </h3>
                    {leagueSeekers.map(({ player, availability: av }) => (
                      <div
                        key={player.id}
                        className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#FFFFFF]">
                            {player.displayName}
                          </p>
                          <p className="text-[9px] text-[#48484A] mt-0.5">
                            {arenaGame.shortName}
                            {av.leagueDivision ? ` - ${av.leagueDivision}` : ''} - available{' '}
                            {av.window === 'now' ? 'now' : av.window === 'today' ? 'today' : 'this week'}
                          </p>
                        </div>
                        <button
                          onClick={() => showToast('Invite sent to join your league.')}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-[#121214] text-[#00E676] font-extrabold text-[10px] cursor-pointer border border-[#14392B]"
                        >
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {arenaView === 'home' && arenaSection === 'challenges' && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-[#48484A]">
                  Challenges received
                </h3>
                {incomingChallenges.length === 0 && (
                  <p className="text-xs text-[#8E8E93]">No challenges waiting for you.</p>
                )}
                {incomingChallenges.map((c) => {
                  const from = ARENA_PLAYERS.find((p) => p.id === c.createdByPlayerId);
                  return (
                    <div key={c.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                      <p className="text-xs font-extrabold text-[#FFFFFF]">
                        {from ? from.displayName : 'A player'} challenged you
                      </p>
                      <p className="text-[9px] text-[#48484A] mt-0.5">
                        {arenaGame.shortName} - {c.format}
                        {c.proposedTime ? ` - ${c.proposedTime}` : ''}
                        {typeof c.pointsReward === 'number'
                          ? ` - ${c.pointsReward} Arena Points`
                          : ''}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleRespondToChallenge(c, 'accept')}
                          className="px-3 py-1 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondToChallenge(c, 'decline')}
                          className="px-3 py-1 rounded-xl bg-[#121214] text-[#00E676] text-[10px] cursor-pointer border border-[#1E1E22]"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleRespondToChallenge(c, 'suggest')}
                          className="px-3 py-1 rounded-xl bg-[#121214] text-[#00E676] text-[10px] cursor-pointer border border-[#1E1E22]"
                        >
                          Suggest Time
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {arenaView === 'home' && arenaSection === 'tournaments' && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-extrabold text-[#48484A]">
                  Tournaments
                </h3>
                {tournaments
                  .filter((t) => t.gameId === arenaGameId)
                  .map((t) => {
                    const reward = getOrganizerReward(t);
                    const organizer = ARENA_PLAYERS.find((p) => p.id === t.organizerId);
                    return (
                      <div key={t.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-xs font-extrabold text-[#FFFFFF]">{t.name}</p>
                          <span className="text-[9px] text-[#48484A] shrink-0">
                            {t.registeredPlayerIds.length}/{t.capacity}
                          </span>
                        </div>
                        <p className="text-[9px] text-[#48484A] mt-0.5">
                          {organizer ? `Hosted by ${organizer.displayName}` : 'Organizer'} -{' '}
                          {t.status}
                        </p>
                        {t.prizeDescription && (
                          <p className="text-[10px] text-[#C2A24A] mt-1">{t.prizeDescription}</p>
                        )}
                        {/* Organizer reward, itemised. Shown honestly,
                            including zero, so the incentive is legible. */}
                        {reward.points > 0 ? (
                          <div className="mt-2 pt-2 border-t border-[#121214]">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-[9px] text-[#48484A]">
                                Organizer earned
                              </span>
                              <span className="text-xs font-extrabold text-[#00E676]">
                                {reward.points.toLocaleString()}
                              </span>
                            </div>
                            {reward.lines.map((l) => (
                              <div
                                key={l.label}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span className="text-[9px] text-[#8E8E93]">{l.label}</span>
                                <span className="text-[9px] text-[#A1A1A6]">
                                  +{l.points.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-[#8E8E93] mt-1">
                            Organizer reward: none - {reward.reason}
                          </p>
                        )}
                        {/* The driver, stated plainly. */}
                        {t.status !== 'completed' && (
                          <p className="text-[9px] text-[#00E676] mt-1">
                            Each player who completes adds{' '}
                            {getMarginalPlayerValue(t)} points for the organizer.
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {arenaView === 'home' && arenaSection === 'kings' && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-[11px] font-extrabold text-[#48484A]">
                    Kings and Queens
                  </h3>
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">Players</p>
                </div>
                {ARENA_PLAYERS.map((p) => ({
                  player: p,
                  points: getPointsBalance(ledger, p.id)
                }))
                  .filter((r) => r.points > 0)
                  .sort((a, b) => b.points - a.points)
                  .map((r, i) => (
                    <div
                      key={r.player.id}
                      className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center gap-3"
                    >
                      <span className="text-[10px] text-[#48484A] w-8 shrink-0">
                        {i === 0 ? 'KING' : `#${i + 1}`}
                      </span>
                      <p className="text-xs font-extrabold text-[#FFFFFF] flex-1 min-w-0">
                        {r.player.displayName}
                      </p>
                      <span className="text-[10px] text-[#A1A1A6] shrink-0">
                        {r.points.toLocaleString()}
                      </span>
                    </div>
                  ))}

                <p className="text-[10px] text-[#8E8E93] pt-2">Organizers</p>
                {ORGANIZER_RECORDS.sort((a, b) => b.pointsEarned - a.pointsEarned).map((o, i) => {
                  const person = ARENA_PLAYERS.find((p) => p.id === o.organizerId);
                  return (
                    <div key={o.organizerId} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-[#C2A24A] shrink-0">
                          {i === 0 ? 'Arena host' : `#${i + 1}`}
                        </span>
                        <p className="text-xs font-extrabold text-[#FFFFFF] flex-1 min-w-0">
                          {person ? person.displayName : o.organizerId}
                        </p>
                        <span className="text-[10px] text-[#A1A1A6] shrink-0">
                          {o.pointsEarned.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#48484A] mt-1">
                        {getOrganizerRank(o)} - {o.tournamentsHosted} tournaments -{' '}
                        {o.playersServed} players - {o.completionRate}% completion
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {arenaView === 'home' && arenaSection === 'rewards' && (
              <div className="space-y-2">
                <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10px] text-[#48484A]">
                      Your Arena Points
                    </span>
                    <span className="text-lg font-extrabold text-[#00E676]">
                      {myBalance.toLocaleString()}
                    </span>
                  </div>
                  {/* Stated plainly, every time rewards are shown. */}
                  <p className="text-[10px] text-[#8E8E93] mt-1">
                    Arena Points are not cash and have no monetary value. They can
                    be redeemed for the rewards below while stock lasts.
                  </p>
                  {/* Honest about where points actually come from, so nobody
                      grinds matches expecting it to add up. */}
                  <div className="mt-2 pt-2 border-t border-[#121214]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] text-[#8E8E93]">
                        From playing today
                      </span>
                      <span className="text-[10px] text-[#A1A1A6]">
                        {participationToday} / {PARTICIPATION_DAILY_CAP}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#48484A] mt-1 leading-snug">
                      Playing earns a small fixed amount, capped daily. Points are
                      earned mainly by organising: {ARENA_CREATION_CONFIG.perCompletedPlayer}{' '}
                      per player who completes your event,{' '}
                      {ARENA_CREATION_CONFIG.perNewPlayer} for each player new to Arena.
                    </p>
                  </div>
                </div>

                {giftCards.map((g) => {
                  const gate = canRedeemGiftCard(g, {
                    balance: myBalance,
                    region: 'Nairobi',
                    controls: REWARD_POOL_CONTROLS,
                    now: '2026-08-15T10:00:00Z'
                  });
                  return (
                    <div key={g.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[#FFFFFF]">
                          KES {g.valueKes.toLocaleString()} {g.brand}
                        </p>
                        <p className="text-[9px] text-[#48484A] mt-0.5">
                          {g.merchant} - {g.category.replace('_', ' ')} -{' '}
                          {g.inventory > 0 ? `${g.inventory} left` : 'none left'}
                        </p>
                        {!gate.allowed && (
                          <p className="text-[10px] text-[#C2A24A] mt-1">{gate.reason}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {/* Points cost and cash value never share a line. */}
                        <p className="text-[10px] text-[#A1A1A6]">
                          {g.pointsRequired.toLocaleString()} pts
                        </p>
                        <button
                          onClick={() => handleRedeemGiftCard(g)}
                          disabled={!gate.allowed}
                          className={`mt-1 px-3 py-1 rounded-xl font-extrabold text-[10px] ${
                            gate.allowed
                              ? 'bg-[#00E676] text-[#0A0A0B] cursor-pointer'
                              : 'bg-[#121214] text-[#48484A] cursor-not-allowed'
                          }`}
                        >
                          Redeem
                        </button>
                      </div>
                    </div>
                  );
                })}

                {redemptions.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                      Your redemptions
                    </h3>
                    {redemptions.map((r) => {
                      const card = giftCards.find((g) => g.id === r.giftCardId);
                      return (
                        <div key={r.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                          <p className="text-xs text-[#FFFFFF]">
                            {card ? `${card.brand} - KES ${card.valueKes}` : 'Reward'}
                          </p>
                          {/* No fabricated voucher code. */}
                          <p className="text-[10px] text-[#C2A24A] mt-0.5">
                            {r.status === 'processing'
                              ? 'Processing. No code has been issued yet.'
                              : r.status === 'issued'
                              ? r.voucherCode
                              : r.failureReason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {arenaView === 'player' && openPlayer && (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setArenaView('home');
                    setOpenPlayerId(null);
                  }}
                  className="text-[10px] text-[#00E676] cursor-pointer"
                >
                  Back to Arena
                </button>
                {(() => {
                  const identity = ARENA_IDENTITIES.find(
                    (i) => i.playerId === openPlayer.id && i.gameId === arenaGameId
                  );
                  if (!identity) {
                    return (
                      <p className="text-xs text-[#8E8E93]">
                        {openPlayer.displayName} does not play {arenaGame.name}.
                      </p>
                    );
                  }
                  const stats = ARENA_STATS.find((st) => st.identityId === identity.id);
                  const winRate = stats ? getWinRate(stats) : undefined;
                  return (
                    <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-base font-extrabold text-[#FFFFFF]">
                          {openPlayer.displayName}
                        </p>
                        <p className="text-[9px] text-[#48484A] mt-0.5">
                          {identity.game}
                          {' - '}
                          {identity.gamerTag}
                          {identity.verified ? ' - verified' : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1">
                        {[
                          ['Rating', typeof stats?.rating === 'number' ? String(stats.rating) : 'Not rated yet'],
                          ['Matches', String(stats?.matches ?? 0)],
                          ['Wins', String(stats?.wins ?? 0)],
                          // An unplayed identity says so rather than showing 0%.
                          ['Win rate', typeof winRate === 'number' ? `${winRate}%` : 'No matches yet']
                        ].map(([k, v]) => (
                          <React.Fragment key={k}>
                            <span className="text-[10px] text-[#8E8E93]">{k}</span>
                            <span className="text-[10px] text-[#A1A1A6]">{v}</span>
                          </React.Fragment>
                        ))}
                      </div>
                      {openPlayer.preferredMode && (
                        <p className="text-[10px] text-[#8E8E93]">
                          Preferred mode{' '}
                          <span className="text-[#A1A1A6]">{openPlayer.preferredMode}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-[#00E676]">
                        {openPlayer.presence === 'online'
                          ? 'Online'
                          : openPlayer.presence === 'nearby'
                          ? `${openPlayer.distanceKm} km away`
                          : 'Offline'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {arenaView === 'find' && (
              <div className="space-y-3">
                <button
                  onClick={() => setArenaView('home')}
                  className="text-[10px] text-[#00E676] cursor-pointer"
                >
                  Back to Arena
                </button>
                <h3 className="text-[11px] font-extrabold text-[#48484A]">
                  Find a Game
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFindFreeOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] cursor-pointer border ${
                      findFreeOnly
                        ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676] font-extrabold'
                        : 'bg-[#1C1C1F] text-[#00E676] border-[#1E1E22]'
                    }`}
                  >
                    Free only
                  </button>
                  <button
                    onClick={() => setFindNearby((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] cursor-pointer border ${
                      findNearby
                        ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676] font-extrabold'
                        : 'bg-[#1C1C1F] text-[#00E676] border-[#1E1E22]'
                    }`}
                  >
                    Nearby
                  </button>
                </div>

                {findResults.length === 0 && (
                  <p className="text-xs text-[#8E8E93]">
                    No players available for {arenaGame.name} right now.
                  </p>
                )}

                {findResults.map((c) => (
                  <div
                    key={c.identity.id}
                    className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#FFFFFF]">
                        {c.player.displayName}
                      </p>
                      <p className="text-[9px] text-[#48484A] mt-0.5">
                        {typeof c.stats?.rating === 'number'
                          ? `Rating ${c.stats.rating}`
                          : 'Not rated yet'}
                        {c.reason ? ` - ${c.reason}` : ''}
                      </p>
                      <p className="text-[9px] text-[#8E8E93] mt-0.5">
                        {c.challenge
                          ? c.challenge.stake === 'entry_fee'
                            ? `Entry KES ${c.challenge.entryFeeKes}`
                            : c.challenge.stake === 'ranked'
                            ? 'Ranked'
                            : 'Friendly'
                          : 'No open challenge'}
                      </p>
                    </div>
                    {c.challenge && (
                      <button
                        onClick={() => handleAcceptChallenge(c.challenge as ArenaChallenge)}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                      >
                        Challenge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {arenaView === 'home' && (
              <>
                {arenaSection === 'lobby' && (
                <>
                {/* FROM YOUR GROUPS. Only groups the user already belongs to,
                    reusing the same access rules as the Group tab. Brief never
                    joins, posts to, or claims ownership of a group. */}
                {groupArenaSignals.length > 0 && (
                  <div className="bg-[#1C1C1F] border border-[#14392B] rounded-2xl p-3">
                    <p className="text-[9px] font-extrabold text-[#00E676]">
                      From your groups
                    </p>
                    {groupArenaSignals.map((sig) => (
                      <div key={sig.id} className="mt-2">
                        <p className="text-xs text-[#FFFFFF]">{sig.groupName}</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">{sig.summary}</p>
                        <p className="text-[9px] text-[#48484A] mt-0.5">
                          Shared in this group on {formatSourceDate(sig.at)}. Brief has
                          not posted anything.
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Operational economics. No engagement metrics. */}
                {abuseFlags.length > 0 && (
                  <div className="bg-[#1C1C1F] border border-[#C2A24A] rounded-2xl p-3">
                    <p className="text-[9px] font-extrabold text-[#C2A24A]">
                      Flagged for review
                    </p>
                    {abuseFlags.map((f) => (
                      <p key={f.id} className="text-[10px] text-[#8E8E93] mt-1">
                        {f.detail} Status: {f.status}. No account has been actioned.
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setArenaView('find')}
                  className="w-full text-left bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 cursor-pointer"
                >
                  <p className="text-sm font-extrabold text-[#FFFFFF]">Find a Game</p>
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
                    Match with someone ready to play {arenaGame.name}
                  </p>
                </button>

                <div>
                  <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                    Live lobby
                  </h3>
                  {lobbyChallenges.length === 0 && (
                    <p className="text-xs text-[#8E8E93]">
                      No open challenges for {arenaGame.name} right now.
                    </p>
                  )}
                  <div className="space-y-2">
                    {lobbyChallenges.map((c) => {
                      const player = ARENA_PLAYERS.find(
                        (p) => p.id === c.createdByPlayerId
                      );
                      return (
                        <div
                          key={c.id}
                          className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center gap-3"
                        >
                          <button
                            onClick={() => {
                              setOpenPlayerId(c.createdByPlayerId);
                              setArenaView('player');
                            }}
                            className="text-xs font-extrabold text-[#FFFFFF] cursor-pointer shrink-0"
                          >
                            {player ? player.displayName : 'Player'}
                          </button>
                          <span className="text-[10px] text-[#00E676] shrink-0">
                            {c.mode}
                          </span>
                          <span className="text-[10px] text-[#8E8E93] truncate">
                            {c.format}
                          </span>
                          <span
                            className={`text-[10px] ml-auto shrink-0 ${
                              c.stake === 'entry_fee' ? 'text-[#C2A24A]' : 'text-[#48484A]'
                            }`}
                          >
                            {c.stake === 'entry_fee'
                              ? `KES ${c.entryFeeKes}`
                              : c.stake === 'ranked'
                              ? 'Ranked'
                              : 'Friendly'}
                          </span>
                          {c.createdByPlayerId === CURRENT_PLAYER_ID ? (
                            <span className="shrink-0 text-[9px] text-[#48484A]">
                              Your challenge
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcceptChallenge(c)}
                              className="shrink-0 px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {matches.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                      Your matches
                    </h3>
                    <div className="space-y-2">
                      {matches.map((m) => {
                        const a = ARENA_PLAYERS.find((p) => p.id === m.playerAId);
                        const b = ARENA_PLAYERS.find((p) => p.id === m.playerBId);
                        return (
                          <div
                            key={m.id}
                            className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3"
                          >
                            <p className="text-xs text-[#FFFFFF]">
                              {a ? a.displayName : 'Player'} vs{' '}
                              {b ? b.displayName : 'Player'}
                            </p>
                            {/* Brief does not decide or guess a result. */}
                            <p className="text-[10px] text-[#8E8E93] mt-0.5">
                              {isResultConfirmed(m)
                                ? m.scoreLine
                                : 'Result not confirmed by both players'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                    Nearby
                  </h3>
                  {nearbyVenues.length === 0 && (
                    <p className="text-xs text-[#8E8E93]">
                      No venues nearby for {arenaGame.name}.
                    </p>
                  )}
                  <div className="space-y-2">
                    {nearbyVenues.map((v) => {
                      const here = getVenuePlayerCount(v, arenaGameId, ARENA_CHECKINS);
                      return (
                        <div
                          key={v.id}
                          className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-start gap-3"
                        >
                          {/* The mark is the live part: ring and count track
                              who is actually here for THIS game. */}
                          <GameGlyph
                            gameId={arenaGameId}
                            playerCount={here}
                            capacity={v.stations}
                            label={`${here} playing ${arenaGame.name} at ${v.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-[#FFFFFF]">
                              {v.name}
                            </p>
                            <p className="text-[9px] text-[#48484A] mt-0.5">
                              {v.locationName}
                              {typeof v.distanceKm === 'number'
                                ? ` - ${v.distanceKm} km`
                                : ''}
                            </p>
                            <p className="text-[10px] text-[#00E676] mt-1">
                              {here > 0
                                ? `${here} playing ${arenaGame.shortName} now`
                                : 'Nobody checked in right now'}
                            </p>
                            {/* Everything below is omitted when unknown. */}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {typeof v.stationsFree === 'number' &&
                                typeof v.stations === 'number' && (
                                  <span className="text-[9px] text-[#8E8E93]">
                                    {v.stationsFree} of {v.stations} stations free
                                  </span>
                                )}
                              {typeof v.pricePerHourKes === 'number' && (
                                <span className="text-[9px] text-[#8E8E93]">
                                  KES {v.pricePerHourKes}/hr
                                </span>
                              )}
                              {v.openUntil && (
                                <span className="text-[9px] text-[#8E8E93]">
                                  open until {v.openUntil}
                                </span>
                              )}
                            </div>
                            {v.eventTonight && (
                              <p className="text-[10px] text-[#C2A24A] mt-1">
                                Tonight: {v.eventTonight}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                    Exchange
                  </h3>
                  <div className="space-y-2">
                    {ARENA_LISTINGS.filter((l) => l.gameId === arenaGameId).map((l) => {
                      const gate = canListInArena(l);
                      return (
                        <div
                          key={l.id}
                          className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-xs text-[#FFFFFF]">{l.title}</p>
                            {gate.allowed && typeof l.priceKes === 'number' && (
                              <span className="text-[10px] text-[#A1A1A6] shrink-0">
                                KES {l.priceKes}
                              </span>
                            )}
                          </div>
                          {/* The transfer boundary. Brief will not facilitate
                              what a publisher prohibits. */}
                          {!gate.allowed && (
                            <p className="text-[10px] text-[#C2A24A] mt-1">
                              Not available in Arena. {gate.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                </>
                )}
              </>
            )}
          </div>
        )}

        {/* MY ACTIVITY. Reuses the existing relationships edges -- no second
            activity store. Every row is a real edge the user created. */}
        {activeTab === 'mylayer' && myLayerSection === 'activity' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#FFFFFF]">My Activity</h2>
              <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
                What you have saved, watched and acted on.
              </p>
            </div>
            {relationships.length === 0 && (
              <p className="text-xs text-[#8E8E93]">Nothing yet.</p>
            )}
            <div className="space-y-2">
              {[...relationships]
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .map((rel) => {
                  const obj = objects.find((o) => o.id === rel.targetId);
                  return (
                    <div
                      key={rel.id}
                      className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center gap-3"
                    >
                      <span className="text-[9px] text-[#00E676] shrink-0">
                        {rel.verb}
                      </span>
                      <p className="text-xs text-[#FFFFFF] flex-1 min-w-0 truncate">
                        {obj ? obj.title : rel.targetId}
                      </p>
                      <span className="text-[9px] text-[#48484A] shrink-0">
                        {rel.updatedAt.slice(0, 10)}
                      </span>
                    </div>
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
              <h2 className="text-lg font-extrabold text-[#FFFFFF]">Your Arena</h2>
              <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
                Your rank, points and matches. Play and redeem in Arena.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                <p className="text-[10px] text-[#48484A]">
                  Rank
                </p>
                <p className="text-sm font-extrabold text-[#FFFFFF] mt-1">{myRank}</p>
              </div>
              <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                <p className="text-[10px] text-[#48484A]">
                  Arena Points
                </p>
                <p className="text-sm font-extrabold text-[#00E676] mt-1">
                  {myBalance.toLocaleString()}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab('arena');
                setArenaSection('rewards');
              }}
              className="text-[10px] font-extrabold text-[#00E676] cursor-pointer"
            >
              Redeem in Arena
            </button>

            <h3 className="text-[11px] font-extrabold text-[#48484A]">
              My Matches
            </h3>
            {matches.length === 0 && (
              <p className="text-xs text-[#8E8E93]">
                No matches yet. Accept a challenge in Arena to start one.
              </p>
            )}
            <div className="space-y-2">
              {matches.map((m) => {
                const a = ARENA_PLAYERS.find((p) => p.id === m.playerAId);
                const b = ARENA_PLAYERS.find((p) => p.id === m.playerBId);
                return (
                  <div key={m.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                    <p className="text-xs text-[#FFFFFF]">
                      {a ? a.displayName : 'Player'} vs {b ? b.displayName : 'Player'}
                    </p>
                    {/* Result stays unclaimed until both players confirm. */}
                    <p className="text-[10px] text-[#8E8E93] mt-0.5">
                      {isResultConfirmed(m)
                        ? m.scoreLine
                        : 'Result not confirmed by both players'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MY POINTS. Both currencies in one place, still clearly separate:
            Brief Points come from accepted quests, Arena Points from play and
            organising. They are never summed into a single number. */}
        {activeTab === 'mylayer' && myLayerSection === 'points' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#FFFFFF]">My Points</h2>
              <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
                Points are not cash and have no monetary value.
              </p>
            </div>

            <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-[#48484A]">
                  Brief Points
                </span>
                <span className="text-lg font-extrabold text-[#00E676]">
                  {myContribution.settledPoints.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-[#8E8E93]">
                Rank <span className="text-[#A1A1A6]">{myRank}</span> -{' '}
                {myContribution.accepted} accepted contributions
              </p>
              {pendingCount > 0 && (
                <p className="text-[10px] text-[#C2A24A]">
                  {pendingCount} submitted, awaiting review. Worth nothing yet.
                </p>
              )}
            </div>

            <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-[#48484A]">
                  Arena Points
                </span>
                <span className="text-lg font-extrabold text-[#00E676]">
                  {myBalance.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-[#8E8E93]">
                From playing today {participationToday} / {PARTICIPATION_DAILY_CAP}.
                Earned mainly by organising events.
              </p>
              <button
                onClick={() => {
                  setActiveTab('arena');
                  setArenaSection('rewards');
                }}
                className="text-[10px] font-extrabold text-[#00E676] cursor-pointer"
              >
                Redeem in Arena
              </button>
            </div>

            {redemptions.length > 0 && (
              <div>
                <h3 className="text-[11px] font-extrabold text-[#48484A] mb-2">
                  Redeemed
                </h3>
                <div className="space-y-2">
                  {redemptions.map((r) => {
                    const card = giftCards.find((g) => g.id === r.giftCardId);
                    return (
                      <div key={r.id} className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3">
                        <p className="text-xs text-[#FFFFFF]">
                          {card ? `${card.brand} - KES ${card.valueKes}` : 'Reward'}
                        </p>
                        <p className="text-[10px] text-[#C2A24A] mt-0.5">
                          {r.status === 'processing'
                            ? 'Processing. No code has been issued yet.'
                            : r.status === 'issued'
                            ? r.voucherCode
                            : r.failureReason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mylayer' && myLayerSection === 'circles' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Circles />
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'market' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Marketplace />
          </div>
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

        {activeTab === 'mylayer' && myLayerSection === 'campaigns' && (
          <div className="space-y-4">

            {/* CAMPAIGNS. Create something, publish it, share one link, watch
                who turns up. Every figure below is read from the server. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#FFFFFF]">Campaigns</h2>
                <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
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
                className="shrink-0 px-3 py-2 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[11px] cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>

            {campaignState.status === 'idle' && (
              <button
                onClick={loadCampaigns}
                className="w-full border border-[#14392B] rounded-2xl p-4 text-xs font-extrabold text-[#00E676] cursor-pointer"
              >
                Load my campaigns
              </button>
            )}

            {campaignState.status === 'loading' && (
              <div className="border border-[#1E1E22] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#8E8E93]">Loading campaigns...</p>
              </div>
            )}

            {campaignState.status === 'error' && (
              <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-2xl p-4 space-y-2">
                <p className="text-xs text-[#FFFFFF] font-extrabold">
                  Couldn't load campaigns. Try again.
                </p>
                <p className="text-[10px] text-[#A1A1A6] break-words">
                  {campaignState.error}
                </p>
                <button
                  onClick={loadCampaigns}
                  className="px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {campaignState.status === 'ready' && (campaignState.data ?? []).length === 0 && (
              <div className="border border-dashed border-[#1E1E22] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#8E8E93]">You haven't created a campaign yet.</p>
              </div>
            )}

            {campaignState.status === 'ready' && campaignsLive.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#48484A]">
                  Live
                </h3>
                {campaignsLive.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#FFFFFF] truncate">{c.title}</p>
                        <p className="text-[10px] text-[#A1A1A6] mt-0.5 truncate">
                          {[c.location, c.startsAt ? c.startsAt.slice(0, 16).replace('T', ' ') : null]
                            .filter(Boolean)
                            .join(' \u00b7 ') || 'No place or time set'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] text-[#00E676]">
                        {c.status}
                      </span>
                    </div>

                    {/* Capacity is printed from server values only. */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-[11px] text-[#FFFFFF]">
                        {c.metrics.slotsTaken}
                        {c.metrics.capacity === null ? ' registered' : ` / ${c.metrics.capacity}`}
                      </span>
                      <span className="text-[11px] text-[#00E676]">
                        {c.metrics.currency} {c.metrics.revenueSettled.toLocaleString()} settled
                      </span>
                      {c.metrics.revenuePending > 0 && (
                        <span className="text-[11px] text-[#C2A24A]">
                          {c.metrics.currency} {c.metrics.revenuePending.toLocaleString()} pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openCampaign(c.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => shareCampaign(c)}
                        className="px-3 py-1.5 rounded-xl border border-[#14392B] text-[#00E676] font-extrabold text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsDraft.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#48484A]">
                  Drafts
                </h3>
                {campaignsDraft.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#FFFFFF] truncate">
                        {c.title || 'Untitled'}
                      </p>
                      <p className="text-[9px] text-[#48484A] mt-0.5">
                        {c.type} - not published
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => { openCampaign(c.id); beginEdit(c); }}
                        className="px-3 py-1.5 rounded-xl border border-[#14392B] text-[#00E676] font-extrabold text-[10px] cursor-pointer"
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
                        className="px-3 py-1.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                      >
                        Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {campaignState.status === 'ready' && campaignsPast.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] text-[#48484A]">
                  Finished
                </h3>
                {campaignsPast.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-[#A1A1A6] truncate">{c.title}</p>
                    <button
                      onClick={() => openCampaign(c.id)}
                      className="shrink-0 text-[10px] text-[#48484A] underline underline-offset-2 cursor-pointer"
                    >
                      {c.status}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'nearby' && nearbySection === 'today' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#FFFFFF]">Today</h2>
              <p className="text-[11px] text-[#8E8E93] leading-snug mt-1">
                Only what relates to your pursuits, saved and watched things.
              </p>
            </div>

            {dailyBrief.length === 0 && (
              <div className="border border-dashed border-[#1E1E22] rounded-2xl p-8 text-center">
                <p className="text-xs text-[#8E8E93]">Nothing to report.</p>
                <p className="text-[10px] text-[#48484A] mt-1">
                  Save something, or start a pursuit, and this fills itself in.
                </p>
              </div>
            )}

            {dailyBrief.map((section) => (
              <div key={section.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold text-[#00E676]">
                    {section.title}
                  </h3>
                  <span className="text-[10px] text-[#8E8E93]">
                    {section.objects.length + section.pursuits.length}
                  </span>
                </div>

                {section.objects.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className="w-full text-left bg-[#1C1C1F] border border-[#1E1E22] hover:border-[#14392B] rounded-xl p-3 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[#48484A]">
                        {getObjectTypeMeta(obj.type).label}
                      </span>
                      {getDistanceLabel(obj) && (
                        <span className="text-[9px] text-[#8E8E93]">
                          {getDistanceLabel(obj)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-bold text-[#FFFFFF] leading-snug mt-0.5">
                      {obj.title}
                    </p>
                    {obj.metadata?.statusBadge && (
                      <p className="text-[10px] text-[#00E676] mt-0.5">
                        {obj.metadata.statusBadge}
                      </p>
                    )}
                  </button>
                ))}

                {section.pursuits.map((pursuit) => (
                  <button
                    key={pursuit.id}
                    onClick={() => { setActiveTab('nearby'); setNearbySection('pursuits'); }}
                    className="w-full text-left bg-[#121214] border border-[#1E1E22] rounded-xl p-3 cursor-pointer"
                  >
                    <p className="text-[11px] text-[#A1A1A6]">{pursuit.query}</p>
                    <p className="text-[9px] text-[#48484A] mt-0.5">
                      Nothing useful yet. Brief is still looking.
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'workflows' && workflowSection === 'money' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <MoneyPanel />
          </div>
        )}

        {activeTab === 'workflows' && workflowSection === 'command' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <HostCommand />
          </div>
        )}

        {activeTab === 'workflows' && workflowSection === 'vault' && (
          <Vault />
        )}

        {activeTab === 'workflows' && workflowSection === 'gate' && (
          <CheckIn />
        )}

        {activeTab === 'workflows' && workflowSection === 'sources' && (
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

        {activeTab === 'workflows' && workflowSection === 'inbox' && (
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

        {activeTab === 'pulse' && (
          <Pulse
            pulseSection={pulseSection}
            townHealth={townHealth}
            pulseNow={pulseNow}
            pulseNotices={pulseNotices}
            pulseRecentlyVerified={pulseRecentlyVerified}
            pulseGroupSignals={pulseGroupSignals}
            objects={objects}
            setActiveTab={setActiveTab}
            setMyLayerSection={setMyLayerSection}
            setSelectedObjectForDetail={setSelectedObjectForDetail}
            formatSourceDate={formatSourceDate}
            selectedLocation={selectedLocation}
          />
        )}

        </main>
      </div>

      {/* MOBILE BOTTOM BAR. Same five doors, icon plus short label. */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#121214]/98 backdrop-blur-xl border-t border-[#1E1E22] flex"
      >
        {DESTINATIONS.map((d) => {
          const active = activeTab === d.id;
          const Icon = DESTINATION_ICONS[d.id];
          return (
            <button
              key={d.id}
              onClick={() => goToDestination(d.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer transition-colors ${
                active ? 'text-[#00E676]' : 'text-[#48484A]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-extrabold leading-none">
                {d.label}
              </span>
              <span
                className={`h-0.5 w-6 rounded-full transition-all ${
                  active ? 'bg-[#00E676]' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* CAMPAIGN DASHBOARD. Every number is server-derived. Where the
          backend does not measure something, this says so rather than
          printing a zero that looks like a measurement. */}
      {openCampaignId && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md overflow-y-auto"
          onClick={() => {
            setOpenCampaignId(null);
            setCampaignDetail(null);
            setEditDraft(null);
            setCampaignCircle({ status: 'idle', data: null, error: null });
          }}
        >
          <div className="min-h-screen flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div
              className="w-full max-w-lg bg-[#1C1C1F] border border-[#14392B] rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-[#FFFFFF] truncate">
                    {campaignDetail ? campaignDetail.title : 'Campaign'}
                  </h2>
                  {campaignDetail && (
                    <p className="text-[9px] text-[#48484A] mt-0.5">
                      {campaignDetail.type} &middot; {campaignDetail.status}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setOpenCampaignId(null); setCampaignDetail(null); }}
                  className="shrink-0 text-[#48484A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {campaignActionError && (
                <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-xl p-3">
                  <p className="text-[10px] text-[#FFFFFF] break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {!campaignDetail && !campaignActionError && (
                <p className="text-xs text-[#8E8E93] py-6 text-center">Loading campaign...</p>
              )}

              {campaignDetail && editDraft && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Title</label>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Description</label>
                    <textarea
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      rows={2}
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={editDraft.startsAt}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, startsAt: e.target.value } : d))}
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Where</label>
                    <input
                      value={editDraft.location}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#48484A] mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        disabled={campaignDetail.status !== 'draft'}
                        value={editDraft.capacity}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, capacity: e.target.value } : d))}
                        placeholder="Unlimited"
                        className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#48484A] mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={editDraft.price}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, price: e.target.value } : d))}
                        placeholder="Free"
                        className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                      />
                    </div>
                  </div>
                  {campaignDetail.status !== 'draft' && (
                    <p className="text-[9px] text-[#48484A] leading-snug">
                      Spots cannot change after publishing. People have already
                      registered against this number.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={campaignBusy}
                      onClick={() => setEditDraft(null)}
                      className="px-4 py-3 rounded-xl border border-[#14392B] text-[#00E676] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={campaignBusy || editDraft.title.trim() === ''}
                      onClick={() => saveCampaignEdit(campaignDetail)}
                      className="flex-1 py-3 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                    >
                      {campaignBusy ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {campaignDetail && !editDraft && (
                <>
                  {/* Distribution. Previously the channel buttons and the
                      canonical URL existed ONLY in the publish-success panel,
                      so a creator returning later could not share to WhatsApp
                      without re-publishing. Same component, both places. */}
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
                    className="w-full py-2.5 rounded-xl border border-[#14392B] text-[#00E676] font-extrabold text-[11px] cursor-pointer"
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
                      className="w-full py-3 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                    >
                      {campaignBusy ? 'Publishing...' : 'Publish'}
                    </button>
                  )}

                  {/* PEOPLE */}
                  <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#48484A]">
                      People
                    </h3>
                    <p className="text-xl font-extrabold text-[#FFFFFF]">
                      {campaignDetail.metrics.slotsTaken}
                      {campaignDetail.metrics.capacity !== null && (
                        <span className="text-[#48484A]"> / {campaignDetail.metrics.capacity}</span>
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
                          <span className="text-[10px] text-[#8E8E93]">{label}</span>
                          <span className="text-[11px] text-[#A1A1A6]">{value}</span>
                        </div>
                      ))}
                    </div>
                    {campaignDetail.metrics.capacity !== null &&
                      campaignDetail.metrics.remaining === 0 && (
                        <p className="text-[10px] font-extrabold text-[#C2A24A]">Full</p>
                      )}
                  </div>

                  {/* MONEY. Settled and pending are never added together. */}
                  <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
                    <h3 className="text-[9px] text-[#48484A]">
                      Money
                    </h3>
                    {campaignDetail.price === 0 ? (
                      <p className="text-[11px] text-[#8E8E93]">
                        This is a free campaign. No money is collected.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#8E8E93]">Settled</span>
                          <span className="text-sm font-extrabold text-[#00E676]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenueSettled.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-[#8E8E93]">Pending</span>
                          <span className="text-sm font-extrabold text-[#C2A24A]">
                            {campaignDetail.metrics.currency}{' '}
                            {campaignDetail.metrics.revenuePending.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[9px] text-[#48484A] leading-snug">
                          Pending is money that has not arrived. No payment provider is
                          connected, so settlement is recorded manually in Workflows.
                        </p>
                      </>
                    )}
                  </div>

                  {/* CAMPAIGN. Honest labels only. */}
                  <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1">
                    <h3 className="text-[9px] text-[#48484A]">
                      Campaign
                    </h3>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#8E8E93]">Page loads</span>
                      <span className="text-[11px] text-[#A1A1A6]">
                        {campaignDetail.metrics.views}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#8E8E93]">Different devices</span>
                      <span className="text-[11px] text-[#A1A1A6]">
                        {campaignDetail.metrics.viewers === null
                          ? 'Not enough data'
                          : campaignDetail.metrics.viewers}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#8E8E93]">Times you shared</span>
                      <span className="text-[11px] text-[#A1A1A6]">
                        {campaignDetail.metrics.shares}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#8E8E93]">Started registering</span>
                      <span className="text-[11px] text-[#A1A1A6]">
                        {campaignDetail.metrics.registrationsStarted}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-[#8E8E93]">Page load to registration</span>
                      <span className="text-[11px] text-[#A1A1A6]">
                        {campaignDetail.metrics.conversionPct === null
                          ? 'Not enough data'
                          : `${campaignDetail.metrics.conversionPct}%`}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#48484A] leading-snug pt-1">
                      Page loads are server-side loads of the public page. Different
                      devices is a rough count, not people. Times you shared counts
                      your own taps, not how many people saw it. Brief does not
                      measure reach or impressions.
                    </p>
                  </div>

                  {/* WHAT PEOPLE ARE GETTING. The wrapped Brief object. Shown
                      as a plain description of the offer -- the creator never
                      needs to know the word "object". */}
                  {campaignDetail.object && (
                    <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#48484A]">
                        What people get
                      </h3>
                      <p className="text-xs text-[#FFFFFF]">{campaignDetail.object.title}</p>
                      {campaignDetail.object.summary && (
                        <p className="text-[10px] text-[#A1A1A6] leading-snug">
                          {campaignDetail.object.summary}
                        </p>
                      )}
                      <p className="text-[9px] text-[#48484A] pt-0.5">
                        {campaignDetail.object.type}
                        {campaignDetail.ownsObject === false && ' \u00b7 existing item'}
                      </p>
                      {campaignDetail.ownsObject === false && (
                        <p className="text-[9px] text-[#48484A] leading-snug">
                          This campaign promotes something that already existed in
                          Brief. Publishing the campaign does not change it.
                        </p>
                      )}

                      {/* Link an existing item to a campaign that already
                          exists. Backend capability shipped in 7B; this is the
                          first surface that reaches it. */}
                      {!objectPicker.open ? (
                        <button
                          disabled={campaignBusy}
                          onClick={loadAttachableObjects}
                          className="text-[10px] text-[#00E676] underline underline-offset-2 cursor-pointer disabled:opacity-40 pt-1"
                        >
                          Link a different item
                        </button>
                      ) : (
                        <div className="bg-[#0A0A0B] border border-[#1E1E22] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto mt-1">
                          {objectPicker.status === 'loading' && (
                            <p className="text-[11px] text-[#8E8E93] p-2">Loading your items...</p>
                          )}
                          {objectPicker.status === 'error' && (
                            <p className="text-[11px] text-[#FFFFFF] p-2">
                              Couldn't load your items. {objectPicker.error}
                            </p>
                          )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).length === 0 && (
                              <p className="text-[11px] text-[#8E8E93] p-2">
                                Nothing else to link yet.
                              </p>
                            )}
                          {objectPicker.status === 'ready' &&
                            (objectPicker.data ?? []).slice(0, 25).map((o: any) => (
                              <button
                                key={o.id}
                                disabled={campaignBusy}
                                onClick={() => attachObjectToCampaign(campaignDetail.id, o.id)}
                                className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#1C1C1F] cursor-pointer disabled:opacity-40"
                              >
                                <p className="text-[11px] text-[#FFFFFF] truncate">{o.title}</p>
                                <p className="text-[9px] text-[#48484A]">
                                  {o.type}
                                </p>
                              </button>
                            ))}
                          <button
                            onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                            className="w-full text-[10px] text-[#8E8E93] py-1 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TARGET. Only when the campaign is attached to a Circle
                      that actually carries a target. Progress is read from the
                      Circle's server-derived currentValue -- the campaign UI
                      never computes or writes it. */}
                  {campaignCircle.status === 'loading' && (
                    <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#48484A]">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#8E8E93]">Loading target...</p>
                    </div>
                  )}

                  {/* Honest unavailable state. Never a zeroed progress bar,
                      which would read as "no progress" rather than "unknown". */}
                  {campaignCircle.status === 'error' && (
                    <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1">
                      <h3 className="text-[9px] text-[#48484A]">
                        Target
                      </h3>
                      <p className="text-[11px] text-[#FFFFFF]">Target unavailable.</p>
                      <p className="text-[9px] text-[#8E8E93] break-words">
                        {campaignCircle.error}
                      </p>
                    </div>
                  )}

                  {/* Attached to a circle that carries no target: say so
                      rather than inventing a goal to fill the space. */}
                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    !(
                      campaignCircle.data.circle.targetValue !== null &&
                      campaignCircle.data.circle.targetValue > 0
                    ) && (
                      <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1">
                        <h3 className="text-[9px] text-[#48484A]">
                          Target
                        </h3>
                        <p className="text-[11px] text-[#FFFFFF]">
                          {campaignCircle.data.circle.name}
                        </p>
                        <p className="text-[10px] text-[#8E8E93]">
                          No target set on this circle.
                        </p>
                      </div>
                    )}

                  {campaignCircle.status === 'ready' &&
                    campaignCircle.data &&
                    campaignCircle.data.circle.targetValue !== null &&
                    campaignCircle.data.circle.targetValue > 0 && (
                      <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-2">
                        <h3 className="text-[9px] text-[#48484A]">
                          Target
                        </h3>
                        <p className="text-xs text-[#FFFFFF]">
                          {campaignCircle.data.circle.goal || campaignCircle.data.circle.name}
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-extrabold text-[#00E676]">
                            {campaignCircle.data.circle.currentValue.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#48484A]">
                            of {campaignCircle.data.circle.targetValue.toLocaleString()}
                          </span>
                        </div>
                        {campaignCircle.data.circle.progressPct !== null && (
                          <p className="text-[10px] text-[#00E676]">
                            {Math.round(campaignCircle.data.circle.progressPct)}%
                          </p>
                        )}
                        <div className="h-1.5 rounded-full bg-[#1E1E22] overflow-hidden">
                          <div
                            className="h-full bg-[#00E676]"
                            style={{
                              width: `${Math.min(100, campaignCircle.data.circle.progressPct ?? 0)}%`
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-[#48484A] leading-snug">
                          Progress comes from settled transactions in
                          {' '}{campaignCircle.data.circle.name}, not from this campaign.
                        </p>
                      </div>
                    )}

                  {/* REGISTRATIONS */}
                  <div className="space-y-2">
                    <h3 className="text-[9px] text-[#48484A]">
                      Registrations
                    </h3>

                    {campaignRegs.status === 'loading' && (
                      <p className="text-[11px] text-[#8E8E93]">Loading people...</p>
                    )}

                    {campaignRegs.status === 'error' && (
                      <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-xl p-3 space-y-1">
                        <p className="text-[11px] text-[#FFFFFF]">Couldn't load registrations.</p>
                        <p className="text-[9px] text-[#A1A1A6] break-words">
                          {campaignRegs.error}
                        </p>
                      </div>
                    )}

                    {campaignRegs.status === 'ready' &&
                      (campaignRegs.data ?? []).length === 0 && (
                        <p className="text-[11px] text-[#8E8E93]">
                          Nobody has registered yet.
                        </p>
                      )}

                    {/* Creator attention: held-but-unpaid spots. Renders
                        nothing when there are none. */}
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
                          className="bg-[#121214] border border-[#1E1E22] rounded-xl p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-[#FFFFFF] truncate">
                              {r.name || r.attendeeRef}
                            </p>
                            <p className="text-[9px] text-[#48484A] mt-0.5">
                              {r.status.replace('_', ' ')}
                            </p>
                          </div>
                          {(r.status === 'registered' || r.status === 'confirmed') && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'checked_in')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#00E676] text-[#0A0A0B] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                              >
                                Check in
                              </button>
                              <button
                                disabled={campaignBusy}
                                onClick={() => setRegStatus(campaignDetail.id, r.id, 'no_show')}
                                className="px-2.5 py-1.5 rounded-lg border border-[#14392B] text-[#8E8E93] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
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
                      className="w-full py-2.5 rounded-xl border border-[#14392B] text-[#8E8E93] font-extrabold text-[11px] cursor-pointer disabled:opacity-40"
                    >
                      Close campaign
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN. Type -> details -> preview -> publish. The preview
          is a screen, not a saved object: nothing reaches the server until
          Publish, and publication itself is the real transition endpoint. */}
      {createStep !== 'closed' && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md overflow-y-auto"
          onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
        >
          <div className="min-h-screen flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div
              className="w-full max-w-lg bg-[#1C1C1F] border border-[#14392B] rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-extrabold text-[#FFFFFF]">
                  {createStep === 'form'
                    ? 'Create'
                    : createStep === 'preview'
                    ? 'Preview'
                    : 'Published'}
                </h2>
                <button
                  onClick={() => { if (!campaignBusy) setCreateStep('closed'); }}
                  className="shrink-0 text-[#48484A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {campaignActionError && (
                <div className="border border-[#6E3A2E] bg-[#2A2018] rounded-xl p-3">
                  <p className="text-[10px] text-[#FFFFFF] break-words">
                    {campaignActionError}
                  </p>
                </div>
              )}

              {createStep === 'form' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">What is it</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['popup', 'session', 'drop', 'event'] as ApiCampaignType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft((d) => ({ ...d, type: t }))}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                            draft.type === t
                              ? 'bg-[#00E676] text-[#0A0A0B] border-[#00E676]'
                              : 'bg-[#121214] text-[#00E676] border-[#14392B]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Title</label>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Saturday plant sale"
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Description</label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={2}
                      placeholder="One or two lines. What should people expect?"
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none resize-none"
                    />
                  </div>

                  {/* Optionally promote something that already exists in Brief
                      instead of describing it again. Collapsed by default. */}
                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">
                      What people get
                    </label>
                    {objectPicker.selected ? (
                      <div className="flex items-center justify-between gap-2 bg-[#121214] border border-[#14392B] rounded-xl px-3 py-2.5">
                        <p className="text-xs text-[#FFFFFF] truncate">
                          {objectPicker.selected.title}
                        </p>
                        <button
                          onClick={() =>
                            setObjectPicker((p) => ({ ...p, selected: null, open: false }))
                          }
                          className="shrink-0 text-[10px] text-[#8E8E93] underline underline-offset-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : !objectPicker.open ? (
                      <button
                        onClick={loadAttachableObjects}
                        className="w-full text-left bg-[#121214] border border-dashed border-[#1E1E22] rounded-xl px-3 py-2.5 text-[11px] text-[#8E8E93] cursor-pointer"
                      >
                        Something new &middot; tap to link an existing item instead
                      </button>
                    ) : (
                      <div className="bg-[#121214] border border-[#1E1E22] rounded-xl p-2 space-y-1 max-h-44 overflow-y-auto">
                        {objectPicker.status === 'loading' && (
                          <p className="text-[11px] text-[#8E8E93] p-2">Loading your items...</p>
                        )}
                        {objectPicker.status === 'error' && (
                          <p className="text-[11px] text-[#FFFFFF] p-2">
                            Couldn't load your items. {objectPicker.error}
                          </p>
                        )}
                        {objectPicker.status === 'ready' &&
                          (objectPicker.data ?? []).length === 0 && (
                            <p className="text-[11px] text-[#8E8E93] p-2">
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
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#1C1C1F] cursor-pointer"
                            >
                              <p className="text-[11px] text-[#FFFFFF] truncate">{o.title}</p>
                              <p className="text-[9px] text-[#48484A]">
                                {o.type}
                              </p>
                            </button>
                          ))}
                        <button
                          onClick={() => setObjectPicker((p) => ({ ...p, open: false }))}
                          className="w-full text-[10px] text-[#48484A] underline underline-offset-2 cursor-pointer py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">When</label>
                    <input
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#48484A] mb-1">Where</label>
                    <input
                      value={draft.location}
                      onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                      placeholder="Kilimani, Nairobi"
                      className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-[#48484A] mb-1">Spots</label>
                      <input
                        inputMode="numeric"
                        value={draft.capacity}
                        onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))}
                        placeholder="Unlimited"
                        className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[#48484A] mb-1">Price (KES)</label>
                      <input
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                        placeholder="Free"
                        className="w-full bg-[#121214] text-[#FFFFFF] text-xs rounded-xl px-3 py-2.5 border border-[#1E1E22] focus:border-[#00E676] focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    disabled={draft.title.trim() === ''}
                    onClick={() => { setCampaignActionError(null); setCreateStep('preview'); }}
                    className="w-full py-3 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Preview
                  </button>
                </div>
              )}

              {createStep === 'preview' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#8E8E93]">
                    This is what people will see. Nothing is public yet.
                  </p>
                  <div className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-4 space-y-1.5">
                    <p className="text-[9px] text-[#48484A]">{draft.type}</p>
                    <p className="text-sm font-extrabold text-[#FFFFFF]">{draft.title}</p>
                    {draft.description && (
                      <p className="text-[11px] text-[#A1A1A6] leading-snug">{draft.description}</p>
                    )}
                    <div className="pt-1 space-y-0.5">
                      {draft.startsAt && (
                        <p className="text-[10px] text-[#00E676]">
                          {draft.startsAt.replace('T', ' ')}
                        </p>
                      )}
                      {draft.location && (
                        <p className="text-[10px] text-[#00E676]">{draft.location}</p>
                      )}
                      <p className="text-[10px] text-[#00E676]">
                        {draft.price.trim() === '' || Number(draft.price) === 0
                          ? 'Free'
                          : `KES ${draft.price}`}
                        {draft.capacity.trim() !== '' && ` \u00b7 ${draft.capacity} spots`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={campaignBusy}
                      onClick={() => setCreateStep('form')}
                      className="px-4 py-3 rounded-xl border border-[#14392B] text-[#00E676] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      disabled={campaignBusy}
                      onClick={publishDraft}
                      className="flex-1 py-3 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs cursor-pointer disabled:opacity-40"
                    >
                      {campaignBusy ? 'Publishing...' : 'Publish'}
                    </button>
                  </div>
                </div>
              )}

              {createStep === 'published' && publishedCampaign && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                    <p className="text-xs font-extrabold text-[#FFFFFF]">
                      {publishedCampaign.title} is {publishedCampaign.status}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#8E8E93]">
                    Share this link anywhere. Anyone who opens it can register.
                  </p>
                  {(() => {
                    // Same distribution surface as the campaign detail view --
                    // one component, so the two can never drift apart.
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
                    className="w-full text-[10px] text-[#48484A] underline underline-offset-2 cursor-pointer"
                  >
                    Open campaign
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CAPTURE: the easiest way into Brief. Deliberately one input and two
          buttons -- no onboarding, no explanation, no AI branding. */}
      {captureOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md overflow-y-auto"
          onClick={handleCaptureCancel}
        >
          <div className="min-h-screen flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div
              className="w-full max-w-lg bg-[#1C1C1F] border border-[#14392B] rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#FFFFFF]">
                    Drop something here.
                  </h2>
                  <p className="text-[11px] text-[#8E8E93] mt-1">
                    A message, link, listing, event, opportunity or anything
                    worth keeping.
                  </p>
                </div>
                <button
                  onClick={handleCaptureCancel}
                  className="p-2 rounded-full bg-[#0A0A0B]/80 text-[#FFFFFF] border border-[#14392B] shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={captureText}
                onChange={(e) => {
                  setCaptureText(e.target.value);
                  setCapturePreview(null);
                }}
                rows={5}
                placeholder="Paste or type anything"
                className="w-full bg-[#121214] border border-[#1E1E22] rounded-xl px-3 py-2.5 text-xs text-[#FFFFFF] placeholder-[#48484A] outline-none focus:border-[#14392B] resize-none"
              />

              {!capturePreview && (
                <button
                  onClick={handleCaptureParse}
                  disabled={captureText.trim() === ''}
                  className={`w-full py-3 rounded-xl font-extrabold text-xs ${
                    captureText.trim() === ''
                      ? 'bg-[#1C1C1F] text-[#48484A] cursor-not-allowed'
                      : 'bg-[#00E676] text-[#0A0A0B] cursor-pointer'
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
                    <div className="border border-[#3A3416] bg-[#1A1708] rounded-xl p-3">
                      <p className="text-[11px] font-bold text-[#C2A24A]">
                        Brief could not make an object from this.
                      </p>
                      <p className="text-[10px] text-[#A1A1A6] mt-1">
                        {capturePreview.rejectionReason}
                      </p>
                      <p className="text-[10px] text-[#48484A] mt-1">
                        Nothing was saved.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#121214] border border-[#1E1E22] rounded-xl p-3 space-y-2">
                      <p className="text-[9px] text-[#00E676]">
                        {getObjectTypeMeta(capturePreview.draft.type).label}
                      </p>
                      <p className="text-sm font-extrabold text-[#FFFFFF] leading-snug">
                        {capturePreview.draft.title}
                      </p>

                      {capturePreview.extracted
                        .filter((f) => f.field !== 'title')
                        .map((f) => (
                          <div
                            key={f.field}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="text-[10px] text-[#8E8E93]">
                              {f.field}
                            </span>
                            <span className="text-[10px] text-[#A1A1A6] truncate">
                              {f.value}
                            </span>
                          </div>
                        ))}

                      {capturePreview.duplicates.length > 0 && (
                        <p className="text-[10px] text-[#C2A24A]">
                          Possible duplicate of{' '}
                          {capturePreview.duplicates[0].item.title}
                        </p>
                      )}

                      <p className="text-[9px] text-[#48484A]">
                        Unverified. Saved as your own capture.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleCaptureCancel}
                      className="flex-1 py-2.5 rounded-xl bg-[#121214] border border-[#1E1E22] text-[#8E8E93] font-bold text-[11px] cursor-pointer"
                    >
                      Discard
                    </button>
                    {capturePreview.isObjectWorthy && (
                      <button
                        onClick={handleCaptureConfirm}
                        className="flex-[2] py-2.5 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-[11px] cursor-pointer"
                      >
                        Save to Brief
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL LAYER */}
      {selectedObjectForDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md overflow-y-auto"
          onClick={() => setSelectedObjectForDetail(null)}
        >
          <div className="min-h-screen flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div
              className="w-full max-w-2xl bg-[#1C1C1F] border border-[#14392B] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Hero */}
              {selectedObjectForDetail.imageUrl && (
                <div className="relative h-56 sm:h-72">
                  <img
                    src={selectedObjectForDetail.imageUrl}
                    alt={selectedObjectForDetail.title}
                    className="w-full h-full object-cover"
                  />

                  <button
                    onClick={() => setSelectedObjectForDetail(null)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-[#0A0A0B]/80 text-[#FFFFFF] border border-[#14392B]"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#0A0A0B]/85 text-[#00E676] border border-[#14392B]">
                      {selectedObjectForDetail.category}
                    </span>

                    {selectedObjectForDetail.isVerified && (
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#00E676] text-[#0A0A0B]">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Without a hero image the close button and chips disappeared
                  entirely, leaving backdrop-click as the only way out. This is
                  the same control set, laid out for an imageless record. */}
              {!selectedObjectForDetail.imageUrl && (
                <div className="flex items-center justify-between gap-2 p-4 border-b border-[#1E1E22]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#0A0A0B]/85 text-[#00E676] border border-[#14392B]">
                      {selectedObjectForDetail.category}
                    </span>

                    {selectedObjectForDetail.isVerified && (
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#00E676] text-[#0A0A0B]">
                        Verified
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedObjectForDetail(null)}
                    className="p-2 rounded-full bg-[#0A0A0B]/80 text-[#FFFFFF] border border-[#14392B]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Details */}
              <div className="p-5 space-y-5">

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[#8E8E93]">
                      {getObjectTypeMeta(selectedObjectForDetail.type).label}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-[#FFFFFF]">
                    {selectedObjectForDetail.title}
                  </h2>

                  <p className="text-sm text-[#00E676] mt-2 leading-relaxed">
                    {selectedObjectForDetail.summary}
                  </p>
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
                          className="bg-[#0A0A0B] border border-[#1E1E22] rounded-xl p-3"
                        >
                          <div className="text-[10px] text-[#8E8E93]">
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
                  <div className="bg-[#0A0A0B] border border-[#1E1E22] rounded-xl p-3 space-y-3">
                    {selectedObjectForDetail.locationName && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#8E8E93]">
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
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00E676] mt-1 hover:underline"
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
                        <User className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#8E8E93]">
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
                        <Building2 className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#8E8E93]">
                            Contact
                          </div>
                          <a
                            href={buildTelHref(
                              selectedObjectForDetail.metadata.contactPhone
                            )}
                            className="text-xs font-bold text-[#00E676] hover:underline"
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
                    Boolean(subject.sourceUrl);

                  if (!hasTrust) return null;

                  const freshTone =
                    fresh?.level === 'stale' || fresh?.level === 'aging'
                      ? 'text-[#C2A24A]'
                      : 'text-[#00E676]';

                  return (
                    <div className="bg-[#0A0A0B] border border-[#1E1E22] rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0" />
                          <span className="text-xs font-bold truncate">
                            {subject.creatorName || 'Provider not stated'}
                          </span>
                          {subject.isVerified && (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#00E676] text-[#0A0A0B] shrink-0">
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
                          <span className="text-[10px] text-[#48484A]">
                            checked {fresh.verifiedOn}
                          </span>
                        </div>
                      )}

                      <p className="text-[10px] text-[#48484A] leading-snug">
                        Verification records when this was last checked. It is
                        not a guarantee of accuracy.
                      </p>

                      {subject.sourceUrl && (
                        <a
                          href={subject.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#00E676] underline underline-offset-2"
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
                      <p className="text-[10px] text-[#48484A]">
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
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#1C1C1F] border border-[#14392B] text-[#00E676]"
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
                      className="flex-1 py-3 rounded-xl bg-[#1C1C1F] border border-[#14392B] text-[#00E676] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4" />
                      Save
                    </button>

                    {(() => {
                      const action = resolveAction(selectedObjectForDetail);
                      const primaryClass =
                        'flex-[2] py-3 rounded-xl bg-[#00E676] text-[#0A0A0B] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer';

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
                        <div className="flex-[2] py-3 rounded-xl bg-[#1C1C1F] border border-dashed border-[#14392B] text-[#8E8E93] font-extrabold text-xs flex items-center justify-center gap-2">
                          {action.label} unavailable
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] text-[#8E8E93] text-center">
                    {getActionNote(selectedObjectForDetail)}
                  </p>

                  {/* Secondary doors (prompts 11/18/21). Subordinate to the
                      primary action, and only rendered where data supports
                      them. Watch records intent; it does not poll anything. */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShare(selectedObjectForDetail)}
                      className="flex-1 py-2.5 rounded-xl bg-[#121214] border border-[#1E1E22] text-[#8E8E93] font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>

                    <button
                      onClick={() =>
                        handleCreatePursuit(selectedObjectForDetail.title)
                      }
                      className="flex-1 py-2.5 rounded-xl bg-[#121214] border border-[#1E1E22] text-[#8E8E93] font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Pursue
                    </button>

                    <button
                      onClick={() => handleToggleWatch(selectedObjectForDetail)}
                      className={`flex-1 py-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer ${
                        watchedIds.has(selectedObjectForDetail.id)
                          ? 'bg-[#1C1C1F] border-[#14392B] text-[#00E676]'
                          : 'bg-[#121214] border-[#1E1E22] text-[#8E8E93]'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {watchedIds.has(selectedObjectForDetail.id) ? 'Watching' : 'Watch'}
                    </button>
                  </div>

                  {watchedIds.has(selectedObjectForDetail.id) && (
                    <p className="text-[10px] text-[#48484A] text-center">
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
                      <summary className="text-[10px] text-[#48484A] cursor-pointer list-none">
                        Why this appeared
                      </summary>
                      <div className="mt-2 space-y-1">
                        {reasons.map((r) => (
                          <p key={r.key} className="text-[10px] text-[#8E8E93]">
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
                    <div className="mt-6 pt-5 border-t border-[#1E1E22]">
                      <p className="text-[10px] text-[#00E676]">
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
                              className="text-left bg-[#121214] border border-[#1E1E22] hover:border-[#14392B] rounded-xl p-3 cursor-pointer transition"
                            >
                              <p className="text-[9px] text-[#48484A]">
                                {getObjectTypeMeta(obj.type).label}
                              </p>
                              <p className="text-[11px] font-bold text-[#FFFFFF] leading-snug mt-0.5 line-clamp-2">
                                {obj.title}
                              </p>
                              {dist && (
                                <p className="text-[9px] text-[#8E8E93] mt-1">
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
                    <div className="mt-6 pt-5 border-t border-[#1E1E22]">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-[#00E676]">
                            {DESTINATION_STATE_LABELS[state]}
                          </p>
                          <h3 className="text-sm font-extrabold mt-1">
                            What's here
                          </h3>
                        </div>
                        {access && (
                          <span className="text-[9px] font-extrabold text-[#00E676] border border-[#14392B] rounded-full px-2 py-0.5">
                            {access}
                          </span>
                        )}
                      </div>

                      {vendors.length === 0 ? (
                        <p className="text-xs text-[#8E8E93]">
                          Vendor information unavailable. Brief only lists
                          traders that are actually linked to this destination.
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-[#00E676] mb-2">
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
                                  className="bg-[#121214] border border-[#1E1E22] rounded-2xl p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-extrabold text-[#FFFFFF] truncate">
                                          {vendor.title}
                                        </p>
                                        {vendor.isVerified && (
                                          <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#00E676] text-[#0A0A0B]">
                                            VERIFIED
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-[#8E8E93] mt-0.5">
                                        {vendor.category}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedObjectForDetail(vendor)}
                                      className="shrink-0 text-[10px] font-extrabold text-[#00E676] cursor-pointer"
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
                                          <span className="text-[10px] text-[#00E676] truncate">
                                            {item.title}
                                          </span>
                                          {typeof item.metadata?.price === 'number' && (
                                            <span className="shrink-0 text-[10px] text-[#00E676]">
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
                    <div className="mt-6 pt-5 border-t border-[#1E1E22]">
                      {appearsAt.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-[#00E676]">
                            Find them at
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {appearsAt.map((dest) => {
                              const state = getDestinationState(dest);
                              return (
                                <button
                                  key={dest.id}
                                  onClick={() => setSelectedObjectForDetail(dest)}
                                  className="w-full text-left bg-[#121214] border border-[#1E1E22] rounded-2xl p-3 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    {(state === 'live' || state === 'today') && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0" />
                                    )}
                                    <span className="text-xs text-[#FFFFFF] truncate">
                                      {dest.title}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#48484A]">
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
                          <p className="text-[10px] text-[#00E676]">
                            What they offer
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {offerings.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedObjectForDetail(item)}
                                className="w-full flex items-center justify-between gap-3 bg-[#121214] border border-[#1E1E22] rounded-2xl p-3 text-left cursor-pointer"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs text-[#FFFFFF] truncate">
                                    {item.title}
                                  </span>
                                  <span className="block text-[9px] text-[#48484A]">
                                    {item.category}
                                  </span>
                                </span>
                                {typeof item.metadata?.price === 'number' && (
                                  <span className="shrink-0 text-[11px] font-extrabold text-[#00E676]">
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
                  <div className="mt-6 pt-5 border-t border-[#1E1E22]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] text-[#00E676]">
                          Continue exploring
                        </p>
                        <h3 className="text-sm font-extrabold mt-1">
                          {getRelatedHeading(
                            selectedObjectForDetail,
                            relatedObjects
                          )}
                        </h3>
                      </div>

                      <span className="text-[10px] text-[#8E8E93] shrink-0">
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
                            className="text-left bg-[#0A0A0B] border border-[#1E1E22] hover:border-[#00E676] rounded-xl p-3 transition group cursor-pointer"
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
                                  <p className="text-[9px] text-[#8E8E93]">
                                    {related.category}
                                  </p>
                                  {chip && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#14392B] text-[#00E676]">
                                      {chip}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-extrabold mt-1 line-clamp-2 group-hover:text-[#00E676]">
                                  {related.title}
                                </p>

                                {related.locationName && (
                                  <p className="text-[10px] text-[#00E676] mt-1 truncate">
                                    {related.locationName}
                                  </p>
                                )}

                                {distance && (
                                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
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

      <footer className="border-t border-[#1E1E22] mt-12 py-6 text-xs text-[#8E8E93] text-center">
        Brief 10.0 &middot; Everything Happening Around You
      </footer>

    </div>
  );
}

export default App;
