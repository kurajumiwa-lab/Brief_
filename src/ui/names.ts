// Familiar names. Ids stay stable so URLs and tests of behaviour do not drift.
// People should recognise the words from other apps.

export const ROOM = {
  // §2: exactly these destinations, in the brief's own words. The ids are the
  // stable contract (URLs, tests); the labels are what the brief calls them.
  nearby: { label: 'Nearby', hint: "What's happening near you" },
  arena: { label: 'Arena', hint: 'Find people to play with' },
  mylayer: { label: 'My Layer', hint: 'Places and events you kept' },
  workflows: { label: 'Workflows', hint: "What's waiting on you" }
} as const;

export const HOME_MORE: Record<string, string> = {
  tea: 'Stories',
  today: 'Today',
  pursuits: 'Alerts',
  quests: 'Jobs',
  market: 'Shop',
  events: "What's on"
};

export const SAVED_TABS: Record<string, string> = {
  saved: 'Saved',
  activity: 'Activity',
  arena: 'Matches',
  points: 'Points',
  circles: 'Groups',
  groups: 'Chats',
  campaigns: 'Events',
  mediakit: 'Profile',
  opportunities: 'Offers',
  messages: 'Messages',
  subscriptions: 'Plans',
  tickets: 'My tickets'
};

export const INBOX_TABS: Record<string, string> = {
  cockpit: 'Create',
  command: 'Dashboard',
  active: 'Open',
  completed: 'Done',
  inbox: 'Review',
  sources: 'Feeds',
  money: 'Payments',
  resale: 'Resale',
  vault: 'Records',
  gate: 'Check-in',
  tea: 'Editor',
  campaigns: 'Campaigns',
  matches: 'Matches',
  distribution: 'Distribution',
  calendar: 'Calendar',
  vendors: 'Vendors',
  ai: 'AI review',
  engine: 'Engine',
  groupbuy: 'Group Buy'
};

export const MENU_QUICK: Record<string, string> = {
  new: 'New',
  inbox: 'Inbox',
  money: 'Payments',
  circles: 'Groups',
  market: 'Shop',
  command: 'Dashboard',
  tea: 'Stories',
  groups: 'Chats'
};

export const FILTERS = {
  all: 'All',
  place: 'Places',
  experience: 'Events',
  opportunity: 'Offers',
  service: 'Services',
  product: 'Products'
} as const;

// ---------------------------------------------------------------------------
// BUNDLES
//
// Eighteen tools and eleven options were not eighteen or eleven decisions --
// they were one list with no structure, so opening the desk meant scanning a
// menu to find the thing you came for. Each bundle below is a package that
// ships together: the tools you reach for in the same sitting.
//
// The section ids are unchanged and every one of them is still reachable, so
// nothing was deleted to make the list shorter -- it was filed.
// ---------------------------------------------------------------------------

export const WORKFLOW_BUNDLES = [
  { id: 'create', label: 'Create', hint: 'Write, review and publish',
    sections: ['cockpit', 'inbox', 'tea', 'distribution', 'calendar', 'ai'] },
  { id: 'sell', label: 'Sell', hint: 'Events, shelves and the money they make',
    sections: ['campaigns', 'vendors', 'money', 'resale', 'groupbuy'] },
  { id: 'run', label: 'Run', hint: 'Operate what is already live',
    sections: ['command', 'active', 'completed', 'matches', 'engine'] },
  { id: 'records', label: 'Records', hint: 'What happened, attested',
    sections: ['vault', 'gate', 'sources'] }
] as const;

export const SAVED_BUNDLES = [
  { id: 'kept', label: 'Kept', hint: 'What you kept, and your own history',
    sections: ['saved', 'activity', 'points', 'campaigns', 'tickets'] },
  { id: 'groups', label: 'Groups', hint: 'Circles, chats and matches',
    sections: ['circles', 'groups', 'arena'] },
  { id: 'creator', label: 'Creator', hint: 'Your public side',
    sections: ['mediakit', 'opportunities', 'messages', 'subscriptions'] }
] as const;

export type WorkflowBundleId = typeof WORKFLOW_BUNDLES[number]['id'];
export type SavedBundleId = typeof SAVED_BUNDLES[number]['id'];

/** The queue is the Inbox landing: the one list of everything waiting on you. */
export const QUEUE_LABEL = 'Waiting on you';
/** The chip label. Short because the page title above it already says the rest. */
export const QUEUE_CHIP = 'Queue';
export const QUEUE_HINT = 'Drafts to review, tasks you hold, orders to fill, doors to open';
