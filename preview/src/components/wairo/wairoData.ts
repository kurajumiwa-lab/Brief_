export interface WairoLocation {
  id: string;
  name: string;
  fullName: string;
  zone: string;
  etaMins: number;
  distanceKm: number;
  droneCorridor: string;
  coordinates: string;
}

export interface WairoService {
  id: string;
  title: string;
  subtitle: string;
  shortDesc: string;
  speed: string;
  badge: string;
  accent: string;
  icon: string;
  priceKes: string;
  priceUsd: string;
  capacity: string;
  security: string;
}

export interface WairoTimelineStep {
  time: string;
  title: string;
  desc: string;
  done: boolean;
  active?: boolean;
}

export interface WairoDelivery {
  trackingId: string;
  status: string;
  progressPercent: number;
  etaMinutes: number;
  destination: string;
  locationId: string;
  pilotName: string;
  pilotCallsign: string;
  droneId: string;
  serviceType: string;
  packageSummary: string;
  altitude: number;
  speed: number;
  battery: number;
  quantumLink: string;
  departedTime: string;
  estimatedArrival: string;
  timeline: WairoTimelineStep[];
}

export interface WairoMessage {
  id: string;
  sender: 'user' | 'pilot' | 'system';
  name: string;
  role: string;
  avatar: string;
  time: string;
  text: string;
}

export const LOCATIONS: WairoLocation[] = [
  {
    id: 'langata',
    name: "Lang'ata",
    fullName: "Lang'ata Office Hub",
    zone: "Sector 4-South",
    etaMins: 6,
    distanceKm: 4.2,
    droneCorridor: "Airway B-04 (Clear)",
    coordinates: "1.3624° S, 36.7628° E",
  },
  {
    id: 'westlands',
    name: "Westlands",
    fullName: "Westlands Innovation Tower",
    zone: "Sector 1-North",
    etaMins: 11,
    distanceKm: 8.7,
    droneCorridor: "Airway A-12 (Optimal)",
    coordinates: "1.2683° S, 36.8044° E",
  },
  {
    id: 'kilimani',
    name: "Kilimani",
    fullName: "Kilimani Cyber District",
    zone: "Sector 2-West",
    etaMins: 8,
    distanceKm: 5.9,
    droneCorridor: "Airway C-08 (Clear)",
    coordinates: "1.2921° S, 36.7865° E",
  },
  {
    id: 'karen',
    name: "Karen",
    fullName: "Karen Estate Drop Pod",
    zone: "Sector 5-Southwest",
    etaMins: 14,
    distanceKm: 12.3,
    droneCorridor: "Airway E-02 (Sub-orbital)",
    coordinates: "1.3218° S, 36.7126° E",
  },
  {
    id: 'upperhill',
    name: "Upper Hill",
    fullName: "Upper Hill Sky Terminal",
    zone: "Sector 3-Central",
    etaMins: 9,
    distanceKm: 6.4,
    droneCorridor: "Airway D-10 (Active)",
    coordinates: "1.2989° S, 36.8142° E",
  },
  {
    id: 'gigiri',
    name: "Gigiri",
    fullName: "Gigiri Diplomatic Compound",
    zone: "Sector 6-North",
    etaMins: 16,
    distanceKm: 14.1,
    droneCorridor: "Airway F-01 (Secure)",
    coordinates: "1.2330° S, 36.8090° E",
  },
];

export const SERVICES: WairoService[] = [
  {
    id: 'quantum-express',
    title: 'Quantum Express',
    subtitle: 'Piloted hover-drone with astronaut escort for ultra-critical drops.',
    shortDesc: 'Pilots the astronaut hover-craft from the complex drone hub.',
    speed: '12 min ETA',
    badge: 'FLAGSHIP',
    accent: '#F58220',
    icon: 'Rocket',
    priceKes: '1,200',
    priceUsd: '9.50',
    capacity: 'Up to 15 kg',
    security: 'Biometric Hand-off',
  },
  {
    id: 'urban-drone',
    title: 'Urban Delivery',
    subtitle: 'Autonomous multi-rotor drone for fast, eco-friendly city packages.',
    shortDesc: 'Autonomous drone parcel delivery for high-speed city routes.',
    speed: '18 min ETA',
    badge: 'ECO-AIR',
    accent: '#00BFEF',
    icon: 'Plane',
    priceKes: '650',
    priceUsd: '5.00',
    capacity: 'Up to 5 kg',
    security: 'QR Drop Lock',
  },
  {
    id: 'tech-solutions',
    title: 'Tech Solutions',
    subtitle: 'Armored, climate-controlled high-tech containers for electronics.',
    shortDesc: 'Solve tech cargo logistics with high-tech shielded pods.',
    speed: '25 min ETA',
    badge: 'HEAVY CARGO',
    accent: '#173247',
    icon: 'Box',
    priceKes: '2,400',
    priceUsd: '18.50',
    capacity: 'Up to 50 kg',
    security: 'Faraday Shielded',
  },
  {
    id: 'sustainable-fabric',
    title: 'VERA Eco-Fabrics',
    subtitle: '200k+ sustainable, carbon-negative apparel delivered on-demand.',
    shortDesc: 'Sustainable next-gen textiles with instant zero-emission delivery.',
    speed: '15 min ETA',
    badge: '200k+ ECO',
    accent: '#19D8F5',
    icon: 'Sparkles',
    priceKes: '850',
    priceUsd: '6.80',
    capacity: 'Garment Pods',
    security: 'Sealed NFC Tag',
  },
];

export const INITIAL_ACTIVE_DELIVERY: WairoDelivery = {
  trackingId: 'WR-8849-NX',
  status: 'IN TRANSIT',
  progressPercent: 68,
  etaMinutes: 6,
  destination: "Lang'ata Office Hub",
  locationId: 'langata',
  pilotName: 'Captain Kael',
  pilotCallsign: 'Quantum Courier Alpha',
  droneId: 'Vortex-X4 (5Y-WRO)',
  serviceType: 'Quantum Express',
  packageSummary: '1x VERA Quantum Tech Jacket + Cyber Visor',
  altitude: 128,
  speed: 84,
  battery: 89,
  quantumLink: '99.9%',
  departedTime: '10:02 AM',
  estimatedArrival: '10:14 AM',
  timeline: [
    { time: '10:02 AM', title: 'Package Dispatched', desc: 'Securely loaded into Hover-Pod #4', done: true },
    { time: '10:05 AM', title: 'Air Corridor Cleared', desc: 'Altitude 140m, flight route approved', done: true },
    { time: '10:08 AM', title: 'Hover Pilot in Transit', desc: 'Crossing Southern Bypass towards Lang’ata', done: true, active: true },
    { time: '10:14 AM', title: 'Arrival at Drop Pad', desc: 'Precision descent on rooftop receiver beacon', done: false },
  ],
};

export const MOCK_ORDERS = [
  {
    id: 'WR-8849-NX',
    date: 'Today, 10:02 AM',
    destination: "Lang'ata Office Hub",
    items: "VERA Cyber Jacket + Tech Accessories",
    type: "Quantum Express",
    status: "IN TRANSIT",
    statusColor: "#00BFEF",
    costKes: "1,200",
    pilot: "Captain Kael",
    isLive: true,
  },
  {
    id: 'WR-7712-BT',
    date: 'Yesterday, 4:15 PM',
    destination: "Westlands Tech Hub",
    items: "Quantum Processor Kit (Faraday Box)",
    type: "Tech Solutions",
    status: "DELIVERED",
    statusColor: "#10B981",
    costKes: "2,400",
    pilot: "Autonomous Drone X-9",
    isLive: false,
  },
  {
    id: 'WR-6290-LK',
    date: 'Sep 01, 11:30 AM',
    destination: "Kilimani Cyber District",
    items: "Eco-Fabric Minimal Streetwear",
    type: "Urban Delivery",
    status: "DELIVERED",
    statusColor: "#10B981",
    costKes: "650",
    pilot: "Pilot Maya",
    isLive: false,
  },
];

export const MOCK_MESSAGES: WairoMessage[] = [
  {
    id: 'msg-1',
    sender: 'pilot',
    name: 'Captain Kael',
    role: 'Quantum Express Pilot',
    avatar: '👨‍🚀',
    time: '10:06 AM',
    text: "Greetings! Hover-drone Vortex-X4 is cruising at 128 meters above Southern Bypass. Weather is pristine. ETA to Lang'ata is exactly 6 minutes.",
  },
  {
    id: 'msg-2',
    sender: 'system',
    name: 'Wairo AI Dispatch',
    role: 'Telemetry Core',
    avatar: '🤖',
    time: '10:07 AM',
    text: "Decryption beacon locked on your Lang'ata rooftop pad. Quantum handshake verified (4096-bit AES).",
  },
];
