/**
 * NEIGHBORHOOD DATA & CHAMPIONS MODEL
 * Focuses Brief on the hyper-local 3km micro-economy:
 * - Estate nodes & local Boda stages
 * - Active verified riders with live ETA & ratings
 * - Hyper-local Chamas with target milestones
 * - Hyper-local Gigs with verified 48h settlement
 * - Local Community Champions (Stage Chairmen, Chama Secretaries, Duka Anchors)
 */

export interface NeighborhoodRider {
  id: string;
  name: string;
  stage: string;
  distance: string;
  eta: string;
  rating: number;
  completedRuns: number;
  vehicle: string;
  avatar: string;
  isAvailable: boolean;
  phone?: string;
}

export interface NeighborhoodChama {
  id: string;
  name: string;
  type: 'Merry-Go-Round' | 'Table Bank' | 'Harambee / Life-Events';
  cycle: string;
  membersCount: number;
  targetAmount: string;
  fundedPercentage: number;
  nextPayout: string;
  coordinator: string;
  verified: boolean;
}

export interface NeighborhoodGig {
  id: string;
  title: string;
  employer: string;
  payout: string;
  timing: string;
  settlement: string;
  distance: string;
  spotsLeft: number;
  category: 'Hospitality' | 'Logistics' | 'Retail' | 'Events';
  verifiedEmployer: boolean;
}

export interface NeighborhoodEvent {
  id: string;
  title: string;
  venue: string;
  timing: string;
  badge: string;
  entryFee: string;
  distance: string;
}

export interface CommunityChampion {
  id: string;
  name: string;
  role: string;
  title: string;
  neighborhoodId: string;
  badge: 'Stage Chairman' | 'Chama Secretary' | 'Duka Anchor' | 'Market Organizer';
  vouchedRidersCount: number;
  verifiedMerchantsCount: number;
  communityVolume: string;
  phone: string;
  quote: string;
  avatar: string;
  verifiedSince: string;
}

export interface NeighborhoodActivity {
  id: string;
  text: string;
  timeAgo: string;
  icon: string;
  type: 'send' | 'save' | 'earn' | 'event';
}

export interface Neighborhood {
  id: string;
  name: string;
  fullName: string;
  county: string;
  zone: string;
  tagline: string;
  coordinates: string;
  landmarkStages: string[];
  champion: CommunityChampion;
  activeRiders: NeighborhoodRider[];
  activeChamas: NeighborhoodChama[];
  activeGigs: NeighborhoodGig[];
  activeEvents: NeighborhoodEvent[];
  recentActivity: NeighborhoodActivity[];
  stats: {
    activeRidersCount: number;
    weeklyVolume: string;
    verifiedGigsCount: number;
    activeChamasCount: number;
  };
}

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'kilimani',
    name: 'Kilimani',
    fullName: 'Kilimani / Yaya Centre Zone',
    county: 'Nairobi',
    zone: 'Nairobi West',
    tagline: 'Yaya · Argwings Kodhek · Ring Rd · Chaka',
    coordinates: '1.2921° S, 36.7865° E',
    landmarkStages: ['Yaya Stage 4', 'Adams Arcade Depot', 'Prestige Boda Bay', 'Chaka Rd Stage'],
    champion: {
      id: 'champ-kilimani-1',
      name: 'Chairman Juma',
      role: 'Boda Stage 4 Chairman & Dispatch Coordinator',
      title: 'Kilimani Stage 4 Chairman',
      neighborhoodId: 'kilimani',
      badge: 'Stage Chairman',
      vouchedRidersCount: 22,
      verifiedMerchantsCount: 16,
      communityVolume: 'KES 420,000/mo',
      phone: '+254 722 819 012',
      quote: 'We vet every rider on Stage 4. 90/10 split means riders stay honest and fast.',
      avatar: '👨🏿‍✈️',
      verifiedSince: 'Oct 2024'
    },
    activeRiders: [
      {
        id: 'rider-kili-1',
        name: 'Otieno',
        stage: 'Yaya Stage 4',
        distance: '0.4 km',
        eta: '3 mins',
        rating: 4.98,
        completedRuns: 142,
        vehicle: 'Boxer 150 (KME 412X)',
        avatar: '🏍️',
        isAvailable: true
      },
      {
        id: 'rider-kili-2',
        name: 'Kimani',
        stage: 'Adams Arcade Depot',
        distance: '0.8 km',
        eta: '5 mins',
        rating: 4.94,
        completedRuns: 98,
        vehicle: 'TVS HLX 125 (KMH 891B)',
        avatar: '🛵',
        isAvailable: true
      },
      {
        id: 'rider-kili-3',
        name: 'Wanjiku',
        stage: 'Prestige Boda Bay',
        distance: '1.1 km',
        eta: '7 mins',
        rating: 5.0,
        completedRuns: 64,
        vehicle: 'Honda Ace 125 (KMC 330D)',
        avatar: '🏍️',
        isAvailable: false
      }
    ],
    activeChamas: [
      {
        id: 'chama-kili-1',
        name: 'Kilimani Women Traders Circle',
        type: 'Merry-Go-Round',
        cycle: 'Cycle 5 · Round 8',
        membersCount: 14,
        targetAmount: 'KES 280,000',
        fundedPercentage: 85,
        nextPayout: 'This Friday (Mama Grace)',
        coordinator: 'Mama Grace (Chama Secretary)',
        verified: true
      },
      {
        id: 'chama-kili-2',
        name: 'Woodley Boda Welfare & Emergency Table Bank',
        type: 'Table Bank',
        cycle: 'Active Loan Cycle',
        membersCount: 24,
        targetAmount: 'KES 450,000',
        fundedPercentage: 92,
        nextPayout: '15th of Month',
        coordinator: 'Chairman Juma',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-kili-1',
        title: 'Barista & Cashier Weekend Shift',
        employer: 'Java House Yaya Centre',
        payout: 'KES 1,800/shift',
        timing: 'Sat & Sun · 7:00 AM – 3:30 PM',
        settlement: '48h M-Pesa Direct',
        distance: '0.3 km',
        spotsLeft: 2,
        category: 'Hospitality',
        verifiedEmployer: true
      },
      {
        id: 'gig-kili-2',
        title: 'On-Demand Parcel Dispatch Runner',
        employer: 'Prestige Pharmacy & Logistics',
        payout: 'KES 2,400/day',
        timing: 'Today · 11:00 AM – 7:00 PM',
        settlement: 'Same-Day M-Pesa',
        distance: '0.6 km',
        spotsLeft: 1,
        category: 'Logistics',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-kili-1',
        title: 'Kilimani Organic Flea & Food Market',
        venue: 'Impala Club Grounds, Ngong Rd',
        timing: 'Saturday · 9:00 AM – 5:00 PM',
        badge: 'Flea Market',
        entryFee: 'Free Entry',
        distance: '0.9 km'
      },
      {
        id: 'evt-kili-2',
        title: 'Acoustic Soul Session & Creator Pop-up',
        venue: 'The Alchemist / Tree House Kilimani',
        timing: 'Sunday · 4:00 PM – 9:00 PM',
        badge: 'Live Music',
        entryFee: 'KES 500',
        distance: '1.2 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-kili-1',
        text: 'Wanjiru dispatched a parcel from Argwings Kodhek to Ring Rd',
        timeAgo: '4m ago',
        icon: '🚚',
        type: 'send'
      },
      {
        id: 'act-kili-2',
        text: 'Kilimani Women Traders Circle received KES 20,000 contribution',
        timeAgo: '18m ago',
        icon: '🌸',
        type: 'save'
      },
      {
        id: 'act-kili-3',
        text: 'Otieno verified delivery of medical consignment @ Nairobi Women\'s Hospital',
        timeAgo: '35m ago',
        icon: '✅',
        type: 'send'
      },
      {
        id: 'act-kili-4',
        text: 'Java House Yaya confirmed 2 barista shift slots for Saturday',
        timeAgo: '1h ago',
        icon: '💼',
        type: 'earn'
      }
    ],
    stats: {
      activeRidersCount: 18,
      weeklyVolume: 'KES 148,000',
      verifiedGigsCount: 6,
      activeChamasCount: 4
    }
  },
  {
    id: 'south-b',
    name: 'South B',
    fullName: 'South B / Sana Sana / Plainsview',
    county: 'Nairobi',
    zone: 'Nairobi South',
    tagline: 'Sana Sana · Plainsview · Mariakani · Mater Rd',
    coordinates: '1.3142° S, 36.8364° E',
    landmarkStages: ['Sana Sana Stage', 'Plainsview Junction', 'Mater Hospital Depot', 'Mariakani Stage'],
    champion: {
      id: 'champ-southb-1',
      name: 'Evans Maina',
      role: 'Plainsview Merchants Anchor & Chama Trustee',
      title: 'Plainsview Community Anchor',
      neighborhoodId: 'south-b',
      badge: 'Duka Anchor',
      vouchedRidersCount: 19,
      verifiedMerchantsCount: 24,
      communityVolume: 'KES 380,000/mo',
      phone: '+254 711 440 928',
      quote: 'South B runs on trust. Every duka and rider here connects through Brief.',
      avatar: '🏪',
      verifiedSince: 'Nov 2024'
    },
    activeRiders: [
      {
        id: 'rider-sb-1',
        name: 'Kamau',
        stage: 'Sana Sana Stage',
        distance: '0.2 km',
        eta: '2 mins',
        rating: 4.96,
        completedRuns: 168,
        vehicle: 'Boxer BM150 (KMD 119P)',
        avatar: '🏍️',
        isAvailable: true
      },
      {
        id: 'rider-sb-2',
        name: 'Omondi',
        stage: 'Plainsview Junction',
        distance: '0.5 km',
        eta: '4 mins',
        rating: 4.92,
        completedRuns: 112,
        vehicle: 'Captain 150 (KMK 782C)',
        avatar: '🛵',
        isAvailable: true
      }
    ],
    activeChamas: [
      {
        id: 'chama-sb-1',
        name: 'South B Youth Enterprise Table Bank',
        type: 'Table Bank',
        cycle: 'Cycle 3 · 18 Members',
        membersCount: 18,
        targetAmount: 'KES 360,000',
        fundedPercentage: 78,
        nextPayout: '10th of Month',
        coordinator: 'Evans Maina',
        verified: true
      },
      {
        id: 'chama-sb-2',
        name: 'Mariakani Estate Emergency Welfare Pool',
        type: 'Harambee / Life-Events',
        cycle: 'Emergency Fund Active',
        membersCount: 32,
        targetAmount: 'KES 150,000',
        fundedPercentage: 94,
        nextPayout: 'Disbursed as needed',
        coordinator: 'Mama Brian',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-sb-1',
        title: 'Supermarket Inventory & Shelf Stocker',
        employer: 'Plainsview Mini-Mart',
        payout: 'KES 1,500/shift',
        timing: 'Tonight · 6:00 PM – 11:00 PM',
        settlement: 'Instant Cash/M-Pesa',
        distance: '0.2 km',
        spotsLeft: 3,
        category: 'Retail',
        verifiedEmployer: true
      },
      {
        id: 'gig-sb-2',
        title: 'Boda Express Delivery - Auto Parts',
        employer: 'Mombasa Rd Auto Spares Hub',
        payout: 'KES 2,500/day + 90% fuel perk',
        timing: 'Daily · 8:00 AM – 5:00 PM',
        settlement: '48h Verified',
        distance: '0.8 km',
        spotsLeft: 2,
        category: 'Logistics',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-sb-1',
        title: 'South B Community Inter-Estate Cup',
        venue: 'Mariakani Primary Grounds',
        timing: 'Sunday · 2:00 PM – 6:00 PM',
        badge: 'Sports & Social',
        entryFee: 'Free',
        distance: '0.4 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-sb-1',
        text: 'Kamau completed urgent prescription run from Mater Hospital to Plainsview',
        timeAgo: '8m ago',
        icon: '💊',
        type: 'send'
      },
      {
        id: 'act-sb-2',
        text: 'Mariakani Emergency Pool funded KES 45,000 medical bill',
        timeAgo: '42m ago',
        icon: '🌸',
        type: 'save'
      }
    ],
    stats: {
      activeRidersCount: 14,
      weeklyVolume: 'KES 118,000',
      verifiedGigsCount: 5,
      activeChamasCount: 3
    }
  },
  {
    id: 'langata',
    name: "Lang'ata",
    fullName: "Lang'ata / Galleria / Carnivore Corridor",
    county: 'Nairobi',
    zone: 'Nairobi South',
    tagline: 'Galleria · Carnivore · T-Mall · Dam Estate',
    coordinates: '1.3624° S, 36.7628° E',
    landmarkStages: ['Galleria Hub Stage', 'Carnivore Junction', 'Dam Estate Gate', 'Otiende Shopping Centre'],
    champion: {
      id: 'champ-lang-1',
      name: 'Pastor Kiprono',
      role: 'Otiende Community Elder & Welfare Secretary',
      title: 'Otiende Community Secretary',
      neighborhoodId: 'langata',
      badge: 'Chama Secretary',
      vouchedRidersCount: 15,
      verifiedMerchantsCount: 18,
      communityVolume: 'KES 310,000/mo',
      phone: '+254 733 910 144',
      quote: 'Direct accountability gives our community peace of mind with every contribution.',
      avatar: '🕊️',
      verifiedSince: 'Dec 2024'
    },
    activeRiders: [
      {
        id: 'rider-lang-1',
        name: 'Hassan',
        stage: 'Galleria Hub Stage',
        distance: '0.6 km',
        eta: '4 mins',
        rating: 4.95,
        completedRuns: 120,
        vehicle: 'Boxer 150 (KMA 551L)',
        avatar: '🏍️',
        isAvailable: true
      }
    ],
    activeChamas: [
      {
        id: 'chama-lang-1',
        name: "Lang'ata Friends Table Banking & Micro-Loans",
        type: 'Table Bank',
        cycle: 'Cycle 6',
        membersCount: 20,
        targetAmount: 'KES 400,000',
        fundedPercentage: 88,
        nextPayout: 'End of Month',
        coordinator: 'Pastor Kiprono',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-lang-1',
        title: 'Event Usher & Ticket Scanner',
        employer: 'Carnivore Grounds Events',
        payout: 'KES 2,000/night',
        timing: 'Friday · 5:00 PM – 1:00 AM',
        settlement: 'Next-Day M-Pesa',
        distance: '0.9 km',
        spotsLeft: 4,
        category: 'Events',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-lang-1',
        title: 'Bomas Cultural Night & Crafts Market',
        venue: 'Bomas of Kenya Amphitheatre',
        timing: 'Friday · 6:00 PM',
        badge: 'Culture',
        entryFee: 'KES 1,000',
        distance: '1.4 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-lang-1',
        text: "Hassan dropped event sound gear at Carnivore Grounds",
        timeAgo: '12m ago',
        icon: '🚚',
        type: 'send'
      }
    ],
    stats: {
      activeRidersCount: 11,
      weeklyVolume: 'KES 94,000',
      verifiedGigsCount: 4,
      activeChamasCount: 2
    }
  },
  {
    id: 'westlands',
    name: 'Westlands',
    fullName: 'Westlands / Mpaka Plaza / Sarit Hub',
    county: 'Nairobi',
    zone: 'Nairobi West',
    tagline: 'Mpaka Rd · Sarit Centre · Waiyaki Way · Rhapta',
    coordinates: '1.2683° S, 36.8044° E',
    landmarkStages: ['Sarit Centre Stage', 'Mpaka Plaza Boda Bay', 'Rhapta Rd Stage', 'Westgate Transit Point'],
    champion: {
      id: 'champ-west-1',
      name: 'Brian Mutua',
      role: 'Westlands Boda Stage Lead & Dispatch Marshal',
      title: 'Westlands Stage Lead',
      neighborhoodId: 'westlands',
      badge: 'Stage Chairman',
      vouchedRidersCount: 28,
      verifiedMerchantsCount: 30,
      communityVolume: 'KES 560,000/mo',
      phone: '+254 720 183 992',
      quote: 'High speed, verified couriers for Westlands businesses and restaurants.',
      avatar: '💼',
      verifiedSince: 'Oct 2024'
    },
    activeRiders: [
      {
        id: 'rider-west-1',
        name: 'Dennis',
        stage: 'Mpaka Plaza Boda Bay',
        distance: '0.3 km',
        eta: '2 mins',
        rating: 4.99,
        completedRuns: 210,
        vehicle: 'Yamaha Crux 110 (KMJ 902Y)',
        avatar: '🏍️',
        isAvailable: true
      }
    ],
    activeChamas: [
      {
        id: 'chama-west-1',
        name: 'Westlands Hospitality Workers Pool',
        type: 'Merry-Go-Round',
        cycle: 'Cycle 4',
        membersCount: 16,
        targetAmount: 'KES 320,000',
        fundedPercentage: 90,
        nextPayout: 'Every Monday',
        coordinator: 'Brian Mutua',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-west-1',
        title: 'Line Cook / Kitchen Assistant',
        employer: 'Mpaka Road Bistro',
        payout: 'KES 2,200/shift',
        timing: 'Today · 3:00 PM – 11:00 PM',
        settlement: '48h Direct M-Pesa',
        distance: '0.2 km',
        spotsLeft: 1,
        category: 'Hospitality',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-west-1',
        title: 'Westlands Tech & Creator Meetup',
        venue: 'iHub / Sarit Centre',
        timing: 'Thursday · 5:30 PM',
        badge: 'Networking',
        entryFee: 'Free RSVP',
        distance: '0.5 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-west-1',
        text: 'Dennis completed express documents drop at Waiyaki Way Tower',
        timeAgo: '6m ago',
        icon: '📄',
        type: 'send'
      }
    ],
    stats: {
      activeRidersCount: 24,
      weeklyVolume: 'KES 210,000',
      verifiedGigsCount: 8,
      activeChamasCount: 3
    }
  },
  {
    id: 'roysambu',
    name: 'Roysambu',
    fullName: 'Roysambu / TRM / Mirema Zone',
    county: 'Nairobi',
    zone: 'Nairobi East',
    tagline: 'TRM · Mirema Drive · Lumumba · Thika Rd',
    coordinates: '1.2185° S, 36.8880° E',
    landmarkStages: ['TRM Main Stage', 'Mirema Junction Depot', 'Lumumba Drive Bay', 'Safari Park Stage'],
    champion: {
      id: 'champ-roy-1',
      name: 'Madam Beatrice',
      role: 'Mirema Traders & Student Chama Lead',
      title: 'Mirema Community Lead',
      neighborhoodId: 'roysambu',
      badge: 'Chama Secretary',
      vouchedRidersCount: 20,
      verifiedMerchantsCount: 22,
      communityVolume: 'KES 340,000/mo',
      phone: '+254 712 908 311',
      quote: 'Our students and traders get reliable 90/10 errands and clear table banking.',
      avatar: '🌺',
      verifiedSince: 'Jan 2025'
    },
    activeRiders: [
      {
        id: 'rider-roy-1',
        name: 'George',
        stage: 'TRM Main Stage',
        distance: '0.4 km',
        eta: '3 mins',
        rating: 4.93,
        completedRuns: 135,
        vehicle: 'Boxer 150 (KMG 440Z)',
        avatar: '🏍️',
        isAvailable: true
      }
    ],
    activeChamas: [
      {
        id: 'chama-roy-1',
        name: 'Mirema Campus & Traders Revolving Fund',
        type: 'Merry-Go-Round',
        cycle: 'Cycle 7',
        membersCount: 20,
        targetAmount: 'KES 200,000',
        fundedPercentage: 80,
        nextPayout: 'This Sunday',
        coordinator: 'Madam Beatrice',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-roy-1',
        title: 'Boutique Sales & Social Media Attendant',
        employer: 'TRM Fashion Mall',
        payout: 'KES 1,600/day',
        timing: 'Full Day · 9:00 AM – 7:00 PM',
        settlement: 'Daily M-Pesa',
        distance: '0.4 km',
        spotsLeft: 2,
        category: 'Retail',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-roy-1',
        title: 'Thika Road Pop-Up Thrift Fair',
        venue: 'TRM Rooftop Arena',
        timing: 'Saturday · 10:00 AM',
        badge: 'Thrift & Pop-Up',
        entryFee: 'Free',
        distance: '0.4 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-roy-1',
        text: 'George completed clothing delivery from TRM to Mirema Drive',
        timeAgo: '15m ago',
        icon: '👕',
        type: 'send'
      }
    ],
    stats: {
      activeRidersCount: 16,
      weeklyVolume: 'KES 124,000',
      verifiedGigsCount: 7,
      activeChamasCount: 3
    }
  },
  {
    id: 'nyamataro',
    name: 'Nyamataro',
    fullName: 'Nyamataro / Kisii Town Corridor',
    county: 'Kisii',
    zone: 'South Nyanza',
    tagline: 'Market Junction · Daraja Mbili · Kisii Central',
    coordinates: '0.6780° S, 34.7725° E',
    landmarkStages: ['Nyamataro Junction', 'Daraja Mbili Market Depot', 'Kisii Hospital Stage', 'Suneka Bay'],
    champion: {
      id: 'champ-nyam-1',
      name: 'Mzee Makori',
      role: 'Daraja Mbili Market Elder & Produce Logistics Chair',
      title: 'Daraja Mbili Elder',
      neighborhoodId: 'nyamataro',
      badge: 'Market Organizer',
      vouchedRidersCount: 26,
      verifiedMerchantsCount: 35,
      communityVolume: 'KES 480,000/mo',
      phone: '+254 721 340 551',
      quote: 'From farm to market, Brief connects Kisii traders with zero middlemen friction.',
      avatar: '🥑',
      verifiedSince: 'Oct 2024'
    },
    activeRiders: [
      {
        id: 'rider-nyam-1',
        name: 'Mogaka',
        stage: 'Nyamataro Junction',
        distance: '0.2 km',
        eta: '2 mins',
        rating: 4.97,
        completedRuns: 180,
        vehicle: 'Boxer 150 (KMC 918M)',
        avatar: '🏍️',
        isAvailable: true
      }
    ],
    activeChamas: [
      {
        id: 'chama-nyam-1',
        name: 'Kisii Soapstone & Avocado Farmers Chama',
        type: 'Table Bank',
        cycle: 'Cycle 8 · KES 500k Fund',
        membersCount: 28,
        targetAmount: 'KES 500,000',
        fundedPercentage: 95,
        nextPayout: '1st of Month',
        coordinator: 'Mzee Makori',
        verified: true
      }
    ],
    activeGigs: [
      {
        id: 'gig-nyam-1',
        title: 'Produce Crate Loader & Sorter',
        employer: 'Daraja Mbili Fresh Wholesale',
        payout: 'KES 1,400/morning',
        timing: 'Tomorrow · 5:30 AM – 11:30 AM',
        settlement: 'Same-Day Cash/M-Pesa',
        distance: '0.7 km',
        spotsLeft: 4,
        category: 'Logistics',
        verifiedEmployer: true
      }
    ],
    activeEvents: [
      {
        id: 'evt-nyam-1',
        title: 'Kisii Cultural Night & Music Acoustic',
        venue: 'Kisii Sports Club Ground',
        timing: 'Saturday · 6:00 PM',
        badge: 'Cultural',
        entryFee: 'KES 300',
        distance: '1.5 km'
      }
    ],
    recentActivity: [
      {
        id: 'act-nyam-1',
        text: 'Mogaka delivered 4 crates of avocados from Nyamataro to Kisii CBD',
        timeAgo: '9m ago',
        icon: '🥑',
        type: 'send'
      }
    ],
    stats: {
      activeRidersCount: 22,
      weeklyVolume: 'KES 165,000',
      verifiedGigsCount: 5,
      activeChamasCount: 4
    }
  }
];

const STORAGE_KEY = 'brief_primary_neighborhood_id';
const LOCK_KEY = 'brief_neighborhood_locked_until';
const JOIN_DATE_KEY = 'brief_neighborhood_joined_date';

export interface UserTrustProfile {
  primary_neighborhood: string;
  neighborhood_locked_until: string;
  reputation_score: {
    wairo: number;
    chama: number;
    harambee: number;
    gigs: number;
  };
  is_community_champion: boolean;
  joined_neighborhood_date: string;
  trust_flags: string[];
}

export interface GroupTrustProfile {
  membership_type: 'invite_only' | 'champion_approved_public';
  trust_score: number;
  is_verified: boolean;
  visibility: 'private' | 'neighborhood' | 'citywide';
  dispute_count: number;
}

export function isNewToNeighborhood(joinedDate?: string): boolean {
  if (!joinedDate) return true;
  const joinedMs = Date.parse(joinedDate);
  if (isNaN(joinedMs)) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - joinedMs < thirtyDaysMs;
}

export function canChangeNeighborhood(): { allowed: boolean; remainingDays: number } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const lockedUntilStr = window.localStorage.getItem(LOCK_KEY);
      if (lockedUntilStr) {
        const lockedUntilMs = Date.parse(lockedUntilStr);
        if (!isNaN(lockedUntilMs) && Date.now() < lockedUntilMs) {
          const remainingDays = Math.ceil((lockedUntilMs - Date.now()) / (24 * 60 * 60 * 1000));
          return { allowed: false, remainingDays };
        }
      }
    }
  } catch {
    // Fallback
  }
  return { allowed: true, remainingDays: 0 };
}

export function getPrimaryNeighborhood(): Neighborhood {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedId = window.localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const found = NEIGHBORHOODS.find((n) => n.id === savedId);
        if (found) return found;
      }
    }
  } catch {
    // Fallback to default
  }
  return NEIGHBORHOODS[0]; // Kilimani default
}

export function setPrimaryNeighborhood(id: string): { neighborhood: Neighborhood; lockedUntil: string } {
  const found = NEIGHBORHOODS.find((n) => n.id === id) || NEIGHBORHOODS[0];
  const lockDate = new Date();
  lockDate.setDate(lockDate.getDate() + 90);
  const lockedUntil = lockDate.toISOString();
  const joinedDate = new Date().toISOString();

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, found.id);
      window.localStorage.setItem(LOCK_KEY, lockedUntil);
      if (!window.localStorage.getItem(JOIN_DATE_KEY)) {
        window.localStorage.setItem(JOIN_DATE_KEY, joinedDate);
      }
    }
  } catch {
    // Ignore storage failure
  }
  return { neighborhood: found, lockedUntil };
}
