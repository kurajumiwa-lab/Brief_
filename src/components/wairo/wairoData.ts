export interface WairoLocation {
  id: string;
  name: string;
  fullName: string;
  county: string;
  zone: string;
  etaMins: number;
  distanceKm: number;
  transitCorridor: string;
  coordinates: string;
  isInterCounty?: boolean;
}

export type LogisticsType = 'courier' | 'consolidated' | 'errands' | 'wayfarer';

export interface LogisticsService {
  id: LogisticsType;
  title: string;
  tagline: string;
  description: string;
  speed: string;
  badge: string;
  accent: string;
  icon: string;
  baseKes: number;
  vehicleTypes: string[];
  driverSharePercent: number; // e.g. 90% payout vs Uber's 72%
}

export interface PrivateProviderBid {
  providerId: string;
  companyName: string;
  isBrandedCompany: boolean;
  isLogbookVerifiedOwner: boolean;
  vehicleType: 'boda' | 'car' | 'van' | 'truck' | 'traveler';
  vehicleModel: string;
  driverName: string;
  plateNo: string;
  trustScore: number; // e.g. 98.4%
  completedDeliveries: number;
  bidPriceKes: number;
  etaMins: number;
  insuranceCovered: boolean;
  matchScore: number; // calculated mathematically: Score = w1*(Base/Bid) + w2*Trust + w3*(1/ETA) + w4*OwnerBonus
  badge?: string;
}

export interface WairoDelivery {
  trackingId: string;
  serviceType: LogisticsType;
  status: string;
  progressPercent: number;
  etaMinutes: number;
  destination: string;
  locationId: string;
  senderLocation: string;
  providerName: string;
  carrierType: string;
  courierName: string;
  courierPhone: string;
  vehicleType: string;
  vehiclePlate: string;
  packageSummary: string;
  fareKes: number;
  driverReturnKes: number;
  platformFeeKes: number;
  isConsolidatedBatch?: boolean;
  timeline: {
    time: string;
    title: string;
    desc: string;
    done: boolean;
    active?: boolean;
  }[];
}

export const LOCATIONS: WairoLocation[] = [
  {
    id: 'langata',
    name: "Lang'ata",
    fullName: "Lang'ata Rd / Galleria Hub",
    county: "Nairobi",
    zone: "Nairobi South",
    etaMins: 22,
    distanceKm: 8.4,
    transitCorridor: "Southern Bypass / Lang'ata Corridor",
    coordinates: "1.3624° S, 36.7628° E",
  },
  {
    id: 'westlands',
    name: "Westlands",
    fullName: "Westlands / Mpaka Plaza Hub",
    county: "Nairobi",
    zone: "Nairobi West",
    etaMins: 18,
    distanceKm: 6.2,
    transitCorridor: "Waiyaki Way / Ring Rd",
    coordinates: "1.2683° S, 36.8044° E",
  },
  {
    id: 'cbd',
    name: "Nairobi CBD",
    fullName: "CBD / Tom Mboya / Kencom Hub",
    county: "Nairobi",
    zone: "Nairobi Central",
    etaMins: 15,
    distanceKm: 4.1,
    transitCorridor: "Haile Selassie / Moi Avenue",
    coordinates: "1.2864° S, 36.8172° E",
  },
  {
    id: 'kilimani',
    name: "Kilimani",
    fullName: "Kilimani / Yaya Centre Zone",
    county: "Nairobi",
    zone: "Nairobi West",
    etaMins: 20,
    distanceKm: 5.9,
    transitCorridor: "Argwings Kodhek / Ngong Rd",
    coordinates: "1.2921° S, 36.7865° E",
  },
  {
    id: 'eastleigh',
    name: "Eastleigh",
    fullName: "Eastleigh 1st Ave Commercial Hub",
    county: "Nairobi",
    zone: "Nairobi East",
    etaMins: 25,
    distanceKm: 7.5,
    transitCorridor: "Jogoo Rd / Juja Rd Connector",
    coordinates: "1.2783° S, 36.8482° E",
  },
  {
    id: 'industrial',
    name: "Industrial Area",
    fullName: "Enterprise Rd / ICD Depot",
    county: "Nairobi",
    zone: "Nairobi Industrial",
    etaMins: 24,
    distanceKm: 9.8,
    transitCorridor: "Mombasa Rd / Enterprise Corridor",
    coordinates: "1.3121° S, 36.8521° E",
  },
  {
    id: 'mombasa',
    name: "Mombasa",
    fullName: "Mombasa Island / Nyali Hub",
    county: "Mombasa",
    zone: "Coast Inter-County",
    etaMins: 360, // 6 hours or scheduled consolidated
    distanceKm: 485.0,
    transitCorridor: "Mombasa Highway A109 / SGR Freight",
    coordinates: "4.0435° S, 39.6682° E",
    isInterCounty: true,
  },
  {
    id: 'nakuru',
    name: "Nakuru",
    fullName: "Nakuru CBD / Section 58 Depot",
    county: "Nakuru",
    zone: "Rift Valley Corridor",
    etaMins: 150,
    distanceKm: 158.0,
    transitCorridor: "Nakuru - Nairobi Highway A104",
    coordinates: "0.3031° S, 36.0800° E",
    isInterCounty: true,
  },
  {
    id: 'kisumu',
    name: "Kisumu",
    fullName: "Kisumu Mega City / Oginga Odinga Hub",
    county: "Kisumu",
    zone: "Western Corridor",
    etaMins: 320,
    distanceKm: 342.0,
    transitCorridor: "Kisumu - Kericho Highway B1",
    coordinates: "0.0917° S, 34.7680° E",
    isInterCounty: true,
  },
  {
    id: 'eldoret',
    name: "Eldoret",
    fullName: "Eldoret Town / Uganda Rd Depot",
    county: "Uasin Gishu",
    zone: "North Rift Corridor",
    etaMins: 280,
    distanceKm: 312.0,
    transitCorridor: "Eldoret - Nakuru Highway A104",
    coordinates: "0.5143° N, 35.2698° E",
    isInterCounty: true,
  },
];

export const LOGISTICS_SERVICES: LogisticsService[] = [
  {
    id: 'courier',
    title: 'Point-to-Point Courier',
    tagline: 'Instant express dispatch via verified boda bodas & vans',
    description: 'Direct door-to-door delivery within Nairobi & environs. Vetted couriers with OTP verification.',
    speed: '25-45 mins',
    badge: 'INSTANT EXPRESS',
    accent: '#F58220',
    icon: 'Bike',
    baseKes: 250,
    vehicleTypes: ['Boda Boda (Motorbike)', 'Compact Car', 'Cargo Van'],
    driverSharePercent: 90, // 90% payout to courier
  },
  {
    id: 'consolidated',
    title: 'Consolidated Cargo',
    tagline: 'Group/shared bulk transit for inter-county routes (Save up to 60%)',
    description: 'Parcels are pooled into scheduled highway vans & trucks running Nairobi ➔ Mombasa, Nakuru, Kisumu, Eldoret.',
    speed: 'Same-day / Next-day',
    badge: 'GROUP SAVINGS',
    accent: '#00BFEF',
    icon: 'Truck',
    baseKes: 450,
    vehicleTypes: ['Consolidated Freight Van', '3-Tonne Truck', 'Inter-County Bus Parcel'],
    driverSharePercent: 88,
  },
  {
    id: 'errands',
    title: 'Errands & Task Runner',
    tagline: 'Personal runner for shopping, KRA/Huduma filings & office tasks',
    description: 'Hire a trusted, badge-verified runner to stand in queues, buy groceries at City Market, pick up medicine, or deliver signed tenders.',
    speed: 'On-demand / Hourly',
    badge: 'CONCIERGE',
    accent: '#19D8F5',
    icon: 'Footprints',
    baseKes: 350,
    vehicleTypes: ['Foot Runner', 'Boda Boda Rider', 'Dedicated Agent'],
    driverSharePercent: 92,
  },
  {
    id: 'wayfarer',
    title: 'Long-Distance Traveler Network',
    tagline: 'Upcountry travelers with own verified vehicles picking your cargo',
    description: 'Travelers driving or riding to your destination take verified parcels along their route. Vehicle logbook owners get priority matching.',
    speed: 'Direct with Traveler',
    badge: 'COMMUTER POOL',
    accent: '#FF9D24',
    icon: 'Car',
    baseKes: 500,
    vehicleTypes: ['Private Station Wagon', 'Pickup D-Max', 'Commuter SUV', 'Tour Van'],
    driverSharePercent: 90,
  },
];

// Mathematical Private Auction Script for Providers
// Calculates match score: Score = (wRate * (Base / Bid)) + (wTrust * Trust) + (wSpeed * (1 / (ETA / 10))) + (wOwner * OwnerBonus)
export const computeAuctionBids = (
  serviceType: LogisticsType,
  dest: WairoLocation,
  cargoWeightKg: number = 3
): PrivateProviderBid[] => {
  const baseRate = serviceType === 'consolidated' ? 450 : serviceType === 'errands' ? 350 : dest.isInterCounty ? 1200 : 300;
  
  const bids: PrivateProviderBid[] = [
    {
      providerId: 'prov-fargo',
      companyName: 'Fargo Express Kenya Ltd',
      isBrandedCompany: true,
      isLogbookVerifiedOwner: true,
      vehicleType: dest.isInterCounty ? 'truck' : 'van',
      vehicleModel: 'Toyota HiAce / Isuzu FRR (Insured)',
      driverName: 'Fargo Fleet Lead (David Ochieng)',
      plateNo: 'KDG 418M',
      trustScore: 99.2,
      completedDeliveries: 14820,
      bidPriceKes: Math.round(baseRate * 1.25),
      etaMins: dest.etaMins + 5,
      insuranceCovered: true,
      matchScore: 94.5,
      badge: 'BRANDED CARRIER (FIXED RATE)',
    },
    {
      providerId: 'prov-speedaf',
      companyName: 'Speedaf Partner Logistics',
      isBrandedCompany: true,
      isLogbookVerifiedOwner: true,
      vehicleType: 'van',
      vehicleModel: 'Nissan NV200 Cargo Pod',
      driverName: 'Samuel Kamau',
      plateNo: 'KDF 892P',
      trustScore: 97.8,
      completedDeliveries: 6240,
      bidPriceKes: Math.round(baseRate * 1.1),
      etaMins: dest.etaMins,
      insuranceCovered: true,
      matchScore: 92.8,
      badge: 'FAST DISPATCH',
    },
    {
      providerId: 'prov-boda-owner',
      companyName: 'SwiftLink Verified Rider (Own Logbook)',
      isBrandedCompany: false,
      isLogbookVerifiedOwner: true,
      vehicleType: 'boda',
      vehicleModel: 'Bajaj Boxer 150 HD (Owner Verified)',
      driverName: 'Erick Mwangi',
      plateNo: 'KMDJ 302S',
      trustScore: 98.4,
      completedDeliveries: 1840,
      bidPriceKes: Math.round(baseRate * 0.9),
      etaMins: Math.max(12, Math.round(dest.etaMins * 0.8)),
      insuranceCovered: true,
      matchScore: 96.8,
      badge: 'BEST VALUE (ALGORITHMIC WINNER)',
    },
    {
      providerId: 'prov-wayfarer-traveler',
      companyName: 'Long-Distance Traveler (Nairobi ➔ Upcountry)',
      isBrandedCompany: false,
      isLogbookVerifiedOwner: true,
      vehicleType: 'car',
      vehicleModel: 'Toyota Fielder 1.8X (Verified Commuter)',
      driverName: 'Captain Brian Kiprono',
      plateNo: 'KDD 671L',
      trustScore: 96.5,
      completedDeliveries: 420,
      bidPriceKes: Math.round(baseRate * 0.75),
      etaMins: dest.etaMins + 15,
      insuranceCovered: true,
      matchScore: 95.1,
      badge: 'COMMUTER POOL (CHEAPEST)',
    },
  ];

  return bids.sort((a, b) => b.matchScore - a.matchScore);
};

export const INITIAL_ACTIVE_DELIVERY: WairoDelivery = {
  trackingId: 'WR-KEN-8849-NX',
  serviceType: 'courier',
  status: 'IN TRANSIT',
  progressPercent: 72,
  etaMinutes: 14,
  destination: "Lang'ata Rd / Galleria Hub",
  locationId: 'langata',
  senderLocation: "Nairobi CBD Hub",
  providerName: "SwiftLink Verified Rider",
  carrierType: "Verified Boda Boda (Owner-Operator)",
  courierName: "Erick Mwangi (Logbook Verified)",
  courierPhone: "+254 712 345 678",
  vehicleType: "Bajaj Boxer 150 HD",
  vehiclePlate: "KMDJ 302S",
  packageSummary: "1x Business Documents & Hardware Kit (OTP: 8849)",
  fareKes: 380,
  driverReturnKes: 342, // 90% payout to rider
  platformFeeKes: 38, // 10% platform take
  timeline: [
    { time: '10:02 AM', title: 'Private Reverse-Auction Locked', desc: 'Mathematical match found in 1.4s (Erick Mwangi - 98.4% Trust)', done: true },
    { time: '10:05 AM', title: 'Package Collected & Sealed', desc: 'Verified at CBD Hub with tamper-evident QR seal', done: true },
    { time: '10:12 AM', title: 'Rider in Transit', desc: 'Cruising via Southern Bypass towards Lang\'ata', done: true, active: true },
    { time: '10:26 AM', title: 'Doorstep Hand-Off & OTP', desc: 'Recipient will provide 4-digit code to release payout to rider', done: false },
  ],
};

export const MOCK_ORDERS = [
  {
    id: 'WR-KEN-8849-NX',
    date: 'Today, 10:02 AM',
    destination: "Lang'ata Rd / Galleria Hub",
    items: "Business Documents & Hardware Kit",
    serviceType: "Point-to-Point Courier",
    provider: "SwiftLink Rider (Erick Mwangi)",
    status: "IN TRANSIT",
    statusColor: "#00BFEF",
    costKes: 380,
    driverTakeKes: 342,
    isLive: true,
  },
  {
    id: 'WR-KEN-7412-MG',
    date: 'Yesterday, 3:45 PM',
    destination: "Mombasa Island / Nyali Hub",
    items: "Consolidated E-Commerce Batch (4 Cartons)",
    serviceType: "Consolidated Cargo",
    provider: "Fargo Courier Kenya Ltd",
    status: "DELIVERED",
    statusColor: "#10B981",
    costKes: 1450,
    driverTakeKes: 1276,
    isLive: false,
  },
  {
    id: 'WR-KEN-6190-ER',
    date: 'Sep 01, 11:15 AM',
    destination: "Kilimani / Yaya Centre Zone",
    items: "Huduma Centre Tax Clearance Pickup & Pharmacy Run",
    serviceType: "Errands Runner",
    provider: "ErrandNinja (Maya Lin)",
    status: "DELIVERED",
    statusColor: "#10B981",
    costKes: 450,
    driverTakeKes: 414,
    isLive: false,
  },
];

export const MOCK_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'pilot' as const,
    name: 'Erick Mwangi (Courier Rider)',
    role: 'Logbook-Verified Rider',
    avatar: '🛵',
    time: '10:08 AM',
    text: "Habari! Nimechukua package CBD. Niko Southern Bypass approaching Lang'ata Galleria. ETA ni 14 minutes. Kuwa tayari na OTP 8849.",
  },
  {
    id: 'msg-2',
    sender: 'system' as const,
    name: 'Wairo Auction & Dispatch Engine',
    role: 'Automated Dispatch Core',
    avatar: '⚙️',
    time: '10:09 AM',
    text: "Private auction settled mathematically. Provider return locked at KES 342 (90% payout via M-Pesa B2C on delivery completion).",
  },
];
