/**
 * 7-DAY COMMUNITY HABIT RHYTHM & NOTIFICATION TEMPLATES
 * Generates predictable weekly neighborhood beats (Monday to Sunday)
 */

export interface CommunityBeat {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  title: string;
  subtitle: string;
  notificationCopy: string;
  coreVerb: 'Send' | 'Save' | 'Earn' | 'Experience';
  icon: string;
}

export const COMMUNITY_BEATS: Record<string, CommunityBeat> = {
  Monday: {
    day: 'Monday',
    title: 'Monday Hustle & Shifts',
    subtitle: 'New weekly verified micro-gigs and errand routes posted by local shops.',
    notificationCopy: '🌅 Monday Hustle: 4 new verified gigs opened in your estate. Apply with 48h settlement.',
    coreVerb: 'Earn',
    icon: '💼'
  },
  Tuesday: {
    day: 'Tuesday',
    title: 'Estate Merchant Restocks',
    subtitle: 'Boda courier pooling for hardware and wholesale supplies.',
    notificationCopy: '📦 Estate Restock: Otieno & 5 riders active for express deliveries.',
    coreVerb: 'Send',
    icon: '🚚'
  },
  Wednesday: {
    day: 'Wednesday',
    title: 'Chama Mid-Week Pulse',
    subtitle: 'Check your table banking cycle and rotational merry-go-round targets.',
    notificationCopy: '🌸 Chama Pulse: Your group cycle is due this Friday. View transparent records.',
    coreVerb: 'Save',
    icon: '🌸'
  },
  Thursday: {
    day: 'Thursday',
    title: 'Town Logistics & Inter-County',
    subtitle: 'Consolidated freight batches heading to Mombasa, Kisumu, Nakuru, and Eldoret.',
    notificationCopy: '🚛 Inter-County Cargo: Thursday dispatch batch closing at 4:00 PM.',
    coreVerb: 'Send',
    icon: '🚛'
  },
  Friday: {
    day: 'Friday',
    title: 'Weekend Dispatch & Payouts',
    subtitle: 'Chama rotational disbursements and weekend event setup runs.',
    notificationCopy: '⚡ Weekend Dispatch: Chama cycle disbursements recorded. 90/10 rider rates live.',
    coreVerb: 'Save',
    icon: '⚡'
  },
  Saturday: {
    day: 'Saturday',
    title: 'Neighborhood Pop-Ups & Markets',
    subtitle: 'Flea markets, organic farm produce drops, and creator acoustic sessions.',
    notificationCopy: '🎉 Weekend Pop-Up: Local flea market is live in your estate until 5:00 PM.',
    coreVerb: 'Experience',
    icon: '🎉'
  },
  Sunday: {
    day: 'Sunday',
    title: 'Weekly Neighborhood Wrap',
    subtitle: 'Public celebration of chama milestones, completed runs, and top riders.',
    notificationCopy: '☕ Estate Wrap: Your neighborhood completed 148 runs and KES 200k in Chama savings.',
    coreVerb: 'Experience',
    icon: '☕'
  }
};

export function getTodayCommunityBeat(): CommunityBeat {
  const days: Array<'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'> = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];
  const currentDay = days[new Date().getDay()];
  return COMMUNITY_BEATS[currentDay] || COMMUNITY_BEATS.Monday;
}
