// Familiar names. Ids stay stable so URLs and tests of behaviour do not drift.
// People should recognise the words from other apps.

export const ROOM = {
  nearby: { label: 'Home', hint: "What's happening near you" },
  arena: { label: 'Play', hint: 'Find people to play with' },
  mylayer: { label: 'Saved', hint: 'Places and events you kept' },
  workflows: { label: 'Inbox', hint: 'Things waiting for you' }
} as const;

export const HOME_MORE: Record<string, string> = {
  tea: 'Stories',
  today: 'Today',
  pursuits: 'Alerts',
  quests: 'Jobs',
  market: 'Shop'
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
  subscriptions: 'Plans'
};

export const INBOX_TABS: Record<string, string> = {
  cockpit: 'Create',
  command: 'Dashboard',
  active: 'Open',
  completed: 'Done',
  inbox: 'Review',
  sources: 'Feeds',
  money: 'Payments',
  vault: 'Records',
  gate: 'Check-in',
  tea: 'Editor'
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
