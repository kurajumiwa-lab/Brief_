// ---------------------------------------------------------------------------
// SHARED TEST FIXTURES  --  test-owned, never shipped.
//
// Build Batch 1 removed Brief's seed data: the product now starts empty and
// fills from the server. Several suites, however, legitimately need a rich
// object graph to test against -- relationship chains, pursuit matching,
// destination directories, group access rules.
//
// Those suites now own their data HERE rather than reaching into App.tsx and
// eval'ing a product constant. That separation is the point:
//
//   * the product ships no invented content, and
//   * the tests keep the fixtures they need to be meaningful.
//
// Fixtures are the pre-Batch-1 seeds, preserved verbatim from git so the
// assertions that referenced them still describe the same graph.
// ---------------------------------------------------------------------------

const DEFAULT_PERMISSIONS = {
  canRead: true,
  canProcess: true,
  canRetain: true,
  canShareBeyondGroup: false,
  canReply: false,
  canPostDigest: false
};

const FIXTURE_OBJECTS = [
  {
    id: 'plc_maji_mazuri',
    type: 'place',
    title: 'Maji Mazuri Farmers & Artisans Market',
    category: 'Marketplace',
    summary: 'Fresh organic produce, handcrafts, and open vendor trade.',
    locationName: 'Haile Selassie Ave, CBD',
    creatorName: 'City County Markets Board',
    trustScore: 96,
    lastVerifiedAt: '2026-08-05T10:00:00Z',
    validityWindowDays: 90,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: '06:00-18:30',
      statusBadge: 'Open Now',
      capacity: 1500,
      rating: 4.8,
      reviewsCount: 142,
      distanceKm: 0.4
    },
    actionLabel: 'Open Map',
    actionType: 'map',
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    // Pattern 3 (place -> vendors -> events) had no event edge. This is the
    // market's own recurring trading day, hosted by the board that already
    // operates the market and located at the market object itself. No new
    // vendor, no invented organiser: creatorName matches plc_maji_mazuri.
    id: 'exp_maji_market_day',
    type: 'experience',
    title: 'Maji Mazuri Saturday Market Day',
    category: 'Event',
    summary: 'Weekly extended trading day for produce and artisan vendors.',
    locationName: 'Haile Selassie Ave, CBD',
    creatorName: 'City County Markets Board',
    trustScore: 96,
    lastVerifiedAt: '2026-08-05T10:00:00Z',
    validityWindowDays: 90,
    isVerified: true,
    metadata: {
      operatingHours: 'Saturdays, 06:00-18:30',
      statusBadge: 'Upcoming',
      distanceKm: 0.4
    },
    actionLabel: 'Get Directions',
    actionType: 'map',
    locationObjectId: 'plc_maji_mazuri',
    parentObjectId: 'plc_maji_mazuri',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'plc_jeevanjee',
    type: 'place',
    title: 'Jeevanjee Gardens Open Pavilion',
    category: 'Civic Space',
    summary: 'Civic dialogues, public forums, open-air art, and youth meetups.',
    locationName: 'Muindi Mbingu St, CBD',
    creatorName: 'County Parks Dept',
    trustScore: 94,
    lastVerifiedAt: '2026-08-04T12:00:00Z',
    validityWindowDays: 60,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: '06:00-20:00',
      statusBadge: 'Open Access',
      capacity: 800,
      rating: 4.6,
      reviewsCount: 89,
      distanceKm: 0.8
    },
    actionLabel: 'Open Map',
    actionType: 'map',
    createdAt: '2026-02-01T08:00:00Z'
  },
  {
    id: 'plc_kilimani_hub',
    type: 'place',
    title: 'Kilimani Innovation Hub & Lab',
    category: 'Co-Working',
    summary: 'IoT prototype lab, shared workspace, and civic tech incubator.',
    locationName: 'Argwings Kodhek Rd',
    creatorName: 'Kilimani Collective',
    trustScore: 98,
    lastVerifiedAt: '2026-08-06T09:00:00Z',
    validityWindowDays: 30,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: '24/7 Access',
      statusBadge: '24/7 Live',
      capacity: 120,
      rating: 4.9,
      reviewsCount: 210,
      distanceKm: 2.1
    },
    actionLabel: 'Open Map',
    actionType: 'map',
    createdAt: '2026-02-10T08:00:00Z'
  },
  {
    id: 'id_county_licensing',
    type: 'identity',
    title: 'City Licensing & Permits Dept',
    category: 'Government',
    summary: 'Unified Business Permits, food health clearances, and signage.',
    locationName: 'City Hall Annex, Fl 3',
    creatorName: 'County Government',
    trustScore: 95,
    lastVerifiedAt: '2026-08-05T08:00:00Z',
    validityWindowDays: 180,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: '08:00-17:00',
      statusBadge: 'Verified Authority',
      contactPhone: '+254 700 000 111',
      rating: 4.3,
      reviewsCount: 64,
      distanceKm: 0.2
    },
    actionLabel: 'Call Office',
    actionType: 'phone',
    createdAt: '2025-10-01T08:00:00Z'
  },
  {
    id: 'id_green_harvest',
    type: 'identity',
    title: 'Green Harvest Farmers Co-op',
    category: 'Cooperative',
    summary: '85 smallholder urban farmers delivering farm-to-table harvests.',
    locationName: 'Stall 42, Maji Mazuri',
    creatorName: 'Jane Wambui',
    trustScore: 97,
    lastVerifiedAt: '2026-08-03T11:00:00Z',
    validityWindowDays: 30,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: '07:00-18:00',
      statusBadge: 'Active Seller',
      contactPhone: '+254 712 345 678',
      rating: 4.9,
      reviewsCount: 178,
      distanceKm: 0.4
    },
    actionLabel: 'Call Seller',
    actionType: 'phone',
    locationObjectId: 'plc_maji_mazuri',
    createdAt: '2026-01-20T08:00:00Z'
  },
  {
    id: 'exp_youth_summit',
    type: 'experience',
    title: 'Youth Tech & Micro-Commerce Forum',
    category: 'Event',
    summary: 'Licensing officers, young entrepreneurs, and micro-finance dialog.',
    locationName: 'Jeevanjee Pavilion',
    creatorName: 'Youth Enterprise Net',
    trustScore: 98,
    lastVerifiedAt: '2026-08-06T08:00:00Z',
    validityWindowDays: 14,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: 'Aug 15, 09:00',
      statusBadge: 'Upcoming',
      capacity: 300,
      rating: 4.8,
      reviewsCount: 45,
      distanceKm: 0.8
    },
    actionLabel: 'Get Directions',
    actionType: 'map',
    locationObjectId: 'plc_jeevanjee',
    createdAt: '2026-07-15T08:00:00Z'
  },
  {
    id: 'opp_green_grant',
    type: 'opportunity',
    title: 'Green Commerce Micro-Grant 2026',
    category: 'Grant',
    summary: 'Non-equity seed grant for solar, zero-waste, or organic enterprise.',
    locationName: 'Nairobi County Wide',
    creatorName: 'Innovation Fund',
    trustScore: 99,
    lastVerifiedAt: '2026-08-05T09:00:00Z',
    validityWindowDays: 30,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      price: 250000,
      currency: 'KES',
      deadline: 'Aug 31',
      statusBadge: '22 Days Left',
      rating: 5.0,
      reviewsCount: 312
    },
    // actionUrl intentionally absent: no verified application portal yet.
    // The intent is declared, but resolveAction falls through to 'none' and
    // the UI shows "Apply Online unavailable" rather than a guessed URL.
    actionType: 'external',
    actionLabel: 'Apply Online',
    createdAt: '2026-07-01T08:00:00Z'
  },
  {
    id: 'knw_permit_guide',
    type: 'knowledge',
    title: 'Single Business Permit Online Guide',
    category: 'Guide',
    summary: 'Official registration steps and health inspection requirements.',
    locationName: 'City Hall Annex',
    creatorName: 'Civic Data Group',
    trustScore: 98,
    lastVerifiedAt: '2026-08-05T14:00:00Z',
    validityWindowDays: 120,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      operatingHours: 'Est 3 Days',
      statusBadge: '4-Step Process',
      rating: 4.7,
      reviewsCount: 156
    },
    // actionUrl intentionally absent: no verified document URL yet.
    actionType: 'external',
    actionLabel: 'Read Guide',
    providerObjectId: 'id_county_licensing',
    relatedObjectIds: ['srv_health_inspection', 'opp_green_grant'],
    createdAt: '2026-03-10T08:00:00Z'
  },
  {
    id: 'prd_solar_kit',
    type: 'product',
    title: 'Portable Solar Lighting Pack (50W)',
    category: 'Equipment',
    summary: 'Heavy-duty 50W panel + 12V LiFePO4 battery box for vendor stalls.',
    locationName: 'Kilimani Hardware Lab',
    creatorName: 'Kikao Hardware',
    trustScore: 97,
    lastVerifiedAt: '2026-08-04T11:00:00Z',
    validityWindowDays: 90,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      price: 18500,
      currency: 'KES',
      statusBadge: '35 In Stock',
      rating: 4.9,
      reviewsCount: 92
    },
    actionLabel: 'Buy',
    actionType: 'internal',
    locationObjectId: 'plc_kilimani_hub',
    providerObjectId: 'id_kikao_hardware',
    relatedObjectIds: ['srv_solar_install'],
    createdAt: '2026-05-10T08:00:00Z'
  },
  {
    // The seller behind prd_solar_kit. Everything here is either copied from
    // the product record that already named this business, or omitted.
    // No phone, price, rating, review count, image or opening hours is
    // invented: those fields are simply absent until a real source supplies
    // them, and every consumer already guards for that.
    id: 'id_kikao_hardware',
    type: 'identity',
    title: 'Kikao Hardware',
    category: 'Hardware Supplier',
    summary: 'Solar and electrical hardware supplier stocking vendor power kits.',
    locationName: 'Kilimani Hardware Lab',
    // Matches prd_solar_kit.creatorName exactly -- reusing the string already
    // in the data rather than inventing a proprietor.
    creatorName: 'Kikao Hardware',
    // Trust mirrored from prd_solar_kit, the record that attests to this
    // seller. Not a second, independently claimed verification event.
    trustScore: 97,
    lastVerifiedAt: '2026-08-04T11:00:00Z',
    validityWindowDays: 90,
    isVerified: true,
    // No imageUrl: no existing image depicts this business, and the product
    // photo would misrepresent a storefront. The UI already guards on it.
    actionLabel: 'Open Map',
    actionType: 'map',
    locationObjectId: 'plc_kilimani_hub',
    createdAt: '2026-05-10T08:00:00Z'
  },
  {
    // Complementary service for the pack. The object model carries this
    // cleanly: 'service' already exists and srv_health_inspection is the
    // precedent. Price, availability and contact are omitted, not guessed.
    id: 'srv_solar_install',
    type: 'service',
    title: 'Solar Pack Installation Support',
    category: 'Installation',
    summary: 'Mounting, wiring and handover support for stall solar lighting packs.',
    locationName: 'Kilimani Hardware Lab',
    creatorName: 'Kikao Hardware',
    trustScore: 97,
    lastVerifiedAt: '2026-08-04T11:00:00Z',
    validityWindowDays: 90,
    isVerified: true,
    actionLabel: 'Book',
    actionType: 'internal',
    providerObjectId: 'id_kikao_hardware',
    locationObjectId: 'plc_kilimani_hub',
    relatedObjectIds: ['prd_solar_kit'],
    createdAt: '2026-05-12T08:00:00Z'
  },
  {
    id: 'srv_health_inspection',
    type: 'service',
    title: 'Food Safety Premises Inspection',
    category: 'Inspection',
    summary: 'Pre-opening food hygiene site visit by county health inspector.',
    locationName: 'Nairobi CBD',
    creatorName: 'City Licensing Board',
    trustScore: 96,
    lastVerifiedAt: '2026-08-05T09:00:00Z',
    validityWindowDays: 30,
    isVerified: true,
    imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1000&q=80',
    metadata: {
      price: 3500,
      currency: 'KES',
      statusBadge: 'Bookable Slot',
      rating: 4.8,
      reviewsCount: 114
    },
    actionLabel: 'Book',
    actionType: 'internal',
    providerObjectId: 'id_county_licensing',
    relatedObjectIds: ['knw_permit_guide'],
    createdAt: '2026-04-15T08:00:00Z'
  }
];

const FIXTURE_POSTS = [
  {
    id: 'post_water_cbd',
    edition: 'morning',
    kind: 'notice',
    title: 'Water rationing on Haile Selassie Ave this week',
    body: 'County water says supply to the CBD stretch will be cut 09:00-14:00 Tue and Thu. Market traders are advised to fill tanks early. Vendors at Maji Mazuri say they are sharing a bowser.',
    authorName: 'Nairobi Water Desk',
    authorHandle: '@nairobiwater',
    authorIsVerified: true,
    publishedAt: '2026-08-15T05:40:00Z',
    reactionsCount: 214,
    commentsCount: 38,
    relatedObjectId: 'plc_maji_mazuri',
    tags: ['utilities', 'cbd']
  },
  {
    id: 'post_matatu_fare',
    edition: 'morning',
    kind: 'news',
    title: 'Matatu fares on Ngong Road drop back to 70 bob',
    body: 'After two weeks at 100, operators on the Ngong Road route have settled back to 70 during off-peak. Commuters report the change started Thursday evening.',
    authorName: 'Ma3 Route Watch',
    authorHandle: '@ma3watch',
    publishedAt: '2026-08-15T04:15:00Z',
    reactionsCount: 892,
    commentsCount: 156,
    tags: ['transport']
  },
  {
    id: 'post_grant_deadline',
    edition: 'morning',
    kind: 'news',
    title: 'Green Commerce grant closes in 16 days, only 40% of slots claimed',
    body: 'The innovation fund says applications are running well below capacity this cycle. Solar, zero-waste and organic enterprises are all eligible.',
    authorName: 'Brief Desk',
    authorHandle: '@brief',
    authorIsVerified: true,
    publishedAt: '2026-08-15T06:05:00Z',
    reactionsCount: 143,
    commentsCount: 21,
    relatedObjectId: 'opp_green_grant',
    tags: ['funding']
  },
  {
    id: 'post_kikao_promo',
    edition: 'morning',
    kind: 'promo',
    title: 'Solar stall kits at 15% off until Sunday',
    body: 'Kikao Hardware is clearing 50W panel and battery-box sets ahead of new stock. Fits a standard vendor stall and runs lights plus a phone charging bank.',
    authorName: 'Kikao Hardware',
    authorHandle: '@kikaohw',
    publishedAt: '2026-08-15T05:00:00Z',
    reactionsCount: 61,
    commentsCount: 9,
    isPromoted: true,
    promotedBy: 'Kikao Hardware',
    relatedObjectId: 'prd_solar_kit',
    tags: ['market']
  },
  {
    id: 'post_licensing_queue',
    edition: 'evening',
    kind: 'chatter',
    title: 'Licensing office queue was actually short today',
    body: 'Went in at 14:00 expecting the usual. Out in 35 minutes with the permit stamped. Whatever they changed at the annex, it is working.',
    authorName: 'Wanjiru M.',
    authorHandle: '@wanjiru_m',
    publishedAt: '2026-08-14T15:30:00Z',
    reactionsCount: 327,
    commentsCount: 64,
    relatedObjectId: 'id_county_licensing',
    tags: ['permits']
  },
  {
    id: 'post_jeevanjee_music',
    edition: 'evening',
    kind: 'chatter',
    title: 'Someone has been playing sax at Jeevanjee around 18:00',
    body: 'Third evening running. Small crowd, nobody collecting money, just a guy and a saxophone near the fountain. Best thing about my commute right now.',
    authorName: 'Otieno K.',
    authorHandle: '@otieno_k',
    publishedAt: '2026-08-14T16:10:00Z',
    reactionsCount: 1204,
    commentsCount: 187,
    relatedObjectId: 'plc_jeevanjee',
    tags: ['culture']
  },
  {
    id: 'post_inspection_tip',
    edition: 'evening',
    kind: 'question',
    title: 'Does the health inspection need the premises fully fitted?',
    body: 'Booking the food safety visit next week but the counters are not in yet. Anyone done this recently -- do they fail you for that or is a walkthrough enough?',
    authorName: 'Brian N.',
    authorHandle: '@brian_nj',
    publishedAt: '2026-08-14T17:45:00Z',
    reactionsCount: 88,
    commentsCount: 42,
    relatedObjectId: 'srv_health_inspection',
    tags: ['permits', 'food']
  },
  {
    id: 'post_weekend_market',
    edition: 'weekend',
    kind: 'news',
    title: 'Maji Mazuri opens an extra artisan row on Saturdays',
    body: 'Twenty additional stalls along the east wall, mostly leather, beadwork and recycled-metal pieces. Runs 08:00 to 16:00 through the end of the year.',
    authorName: 'City Markets Board',
    authorHandle: '@citymarkets',
    authorIsVerified: true,
    publishedAt: '2026-08-15T03:20:00Z',
    reactionsCount: 456,
    commentsCount: 73,
    relatedObjectId: 'plc_maji_mazuri',
    tags: ['market', 'weekend']
  },
  {
    id: 'post_youth_forum_seats',
    edition: 'weekend',
    kind: 'notice',
    title: 'Youth forum has 60 seats left for today',
    body: 'Registration desk opens 08:30 at the Jeevanjee pavilion. Licensing officers are attending the second session, so bring permit questions.',
    authorName: 'Youth Enterprise Net',
    authorHandle: '@youthnet',
    authorIsVerified: true,
    publishedAt: '2026-08-15T02:50:00Z',
    reactionsCount: 178,
    commentsCount: 26,
    relatedObjectId: 'exp_youth_summit',
    tags: ['events']
  },
  {
    id: 'post_kilimani_hub_weekend',
    edition: 'weekend',
    kind: 'chatter',
    title: 'Kilimani hub is quiet on Saturdays and nobody seems to know',
    body: 'Full lab access, no queue for the 3D printers, and the coffee machine actually works. Weekday crowd has no idea what it is missing.',
    authorName: 'Faith A.',
    authorHandle: '@faith_codes',
    publishedAt: '2026-08-15T01:15:00Z',
    reactionsCount: 634,
    commentsCount: 91,
    relatedObjectId: 'plc_kilimani_hub',
    tags: ['coworking']
  }
];

const FIXTURE_JOURNEYS = [
  {
    id: 'jrn_register_food_biz',
    title: 'Register & Open Licensed Food Enterprise',
    category: 'Setup Workflow',
    description: 'Trackable process linking health clearance, inspection, and permit issuance.',
    estimatedDays: 5,
    progressPercent: 50,
    isCompleted: false,
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    steps: [
      { id: 'step_1', order: 1, title: 'Review Hygiene Standards', description: 'County sanitation checklist', targetObjectType: 'knowledge', targetObjectId: 'knw_permit_guide', isCompleted: true, statusLabel: 'Verified' },
      { id: 'step_2', order: 2, title: 'Fill Clearance Form F-12', description: 'Digital health application', targetObjectType: 'document', isCompleted: true, statusLabel: 'Submitted' },
      { id: 'step_3', order: 3, title: 'Site Hygiene Inspection', description: 'Officer visit booking', targetObjectType: 'service', targetObjectId: 'srv_health_inspection', isCompleted: false, statusLabel: 'Pending' },
      { id: 'step_4', order: 4, title: 'Green Commerce Grant', description: 'KES 250k seed funding', targetObjectType: 'opportunity', targetObjectId: 'opp_green_grant', isCompleted: false, statusLabel: 'Optional' }
    ]
  }
];

const FIXTURE_GROUPS = [
  {
    id: 'grp_kilimani_traders',
    name: 'Kilimani Traders',
    platform: 'whatsapp',
    description: 'Neighbourhood traders, services and notices.',
    access: 'member',
    retainAuthors: true,
    memberCount: 312,
    memberCountLabel: '312 members',
    joinedAt: '2026-03-02T08:00:00Z',
    lastActivityAt: '2026-08-14T10:20:00Z',
    permissions: DEFAULT_PERMISSIONS,
    lastIndexedAt: '2026-08-14T10:25:00Z'
  },
  {
    id: 'grp_ku_medics',
    name: 'KU Medical Students',
    platform: 'telegram',
    description: 'Study resources and campus notices.',
    access: 'member',
    // This group has NOT permitted author retention. Names must not appear.
    retainAuthors: false,
    memberCount: 148,
    memberCountLabel: '148 members',
    joinedAt: '2026-05-11T08:00:00Z',
    lastActivityAt: '2026-08-13T16:40:00Z',
    permissions: DEFAULT_PERMISSIONS,
    lastIndexedAt: '2026-08-13T16:45:00Z'
  },
  {
    id: 'grp_westlands_biz',
    name: 'Westlands Business Forum',
    platform: 'telegram',
    description: 'Access granted by an administrator.',
    access: 'authorised',
    retainAuthors: true,
    memberCount: 90,
    memberCountLabel: '90 members',
    lastActivityAt: '2026-08-12T09:00:00Z',
    permissions: DEFAULT_PERMISSIONS
  },
  {
    id: 'grp_pending_estate',
    name: 'Riverside Estate',
    platform: 'whatsapp',
    access: 'pending',
    retainAuthors: false,
    permissions: { ...DEFAULT_PERMISSIONS, canRead: false, canProcess: false }
  },
  {
    id: 'grp_revoked_market',
    name: 'Old Market Vendors',
    platform: 'whatsapp',
    access: 'revoked',
    retainAuthors: false,
    permissions: { ...DEFAULT_PERMISSIONS, canRead: false, canProcess: false, canRetain: false }
  },
  {
    id: 'grp_stranger_group',
    name: 'Mombasa Fisheries',
    platform: 'telegram',
    // The user has no relationship with this group whatsoever. It exists in
    // Brief's data because another user authorised it. It must never surface.
    access: 'revoked',
    retainAuthors: false,
    permissions: { ...DEFAULT_PERMISSIONS, canRead: false, canProcess: false, canRetain: false }
  }
];

const FIXTURE_GROUP_MESSAGES = [
  {
    id: 'gm_01',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Wanjiru',
    text: 'Where can I renew my business permit?',
    sentAt: '2026-08-11T07:15:00Z'
  },
  {
    id: 'gm_02',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Otieno',
    text: 'Selling 3 goats, 18000 each, Kisumu. Call 0712345678',
    sentAt: '2026-08-11T09:40:00Z'
  },
  {
    id: 'gm_03',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Achieng',
    text: 'Anyone selling a 50W solar kit?',
    sentAt: '2026-08-12T06:05:00Z'
  },
  {
    id: 'gm_04',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Mwangi',
    text: 'Kikao Hardware has 50W systems, they are at Kilimani Hardware Lab',
    sentAt: '2026-08-12T06:22:00Z',
    replyToId: 'gm_03'
  },
  {
    id: 'gm_05',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Njeri',
    text: 'Vacancy: accounts assistant needed at a logistics firm. Deadline: 30 September. Send CV to the office.',
    sentAt: '2026-08-12T11:00:00Z'
  },
  {
    id: 'gm_06',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Kamau',
    text: 'Who knows a plumber around Kilimani?',
    sentAt: '2026-08-13T08:30:00Z'
  },
  {
    id: 'gm_07',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Otieno',
    text: 'Youth tech forum this Saturday at Jeevanjee Gardens, starts 09:00',
    sentAt: '2026-08-13T13:12:00Z'
  },
  {
    id: 'gm_08',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Achieng',
    text: 'Green Commerce Micro-Grant applications are open, deadline: 31 August',
    sentAt: '2026-08-14T07:45:00Z'
  },
  { id: 'gm_09', groupId: 'grp_kilimani_traders', authorLabel: 'Kamau', text: 'Good morning all', sentAt: '2026-08-14T07:50:00Z' },
  { id: 'gm_10', groupId: 'grp_kilimani_traders', authorLabel: 'Njeri', text: 'haha true', sentAt: '2026-08-14T07:52:00Z' },
  {
    id: 'gm_11',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Mwangi',
    text: 'Guide on the single business permit steps and requirements is on the county website',
    sentAt: '2026-08-14T10:20:00Z'
  },
  {
    id: 'gm_12',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Achieng',
    text: 'Anyone know where I can get a 2-bedroom house around Kilimani?',
    sentAt: '2026-08-14T15:10:00Z'
  },

  // --- KU Medical Students (member, authors NOT retained) -------------------
  {
    id: 'gm_20',
    groupId: 'grp_ku_medics',
    authorLabel: 'Brenda',
    text: 'OSCE revision workshop on Saturday at the lecture hall, starts 14:00',
    sentAt: '2026-08-13T09:00:00Z'
  },
  {
    id: 'gm_21',
    groupId: 'grp_ku_medics',
    authorLabel: 'Dennis',
    text: 'Anyone have the OSCE study guide document?',
    sentAt: '2026-08-13T16:40:00Z'
  },

  // --- Westlands Business Forum (authorised, not a member) ------------------
  {
    id: 'gm_30',
    groupId: 'grp_westlands_biz',
    authorLabel: 'Forum Admin',
    text: 'Business mentorship programme applications open, deadline: 20 September',
    sentAt: '2026-08-12T09:00:00Z'
  },

  {
    id: 'gm_50',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Kip',
    text: 'Anyone for eFootball tonight? Looking for a 1v1 around 8pm',
    sentAt: '2026-08-15T06:00:00Z'
  },

  // --- Multimodal: same model, different arrival ----------------------------
  {
    id: 'gm_40',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Otieno',
    text: 'Event poster for the weekend',
    sentAt: '2026-08-13T18:00:00Z',
    mediaKind: 'image',
    mediaReference: 'img_poster_001',
    // Caption text only. Nothing here was read out of the image itself.
    mediaExtractedText: 'Community clean-up meetup Sunday at Maji Mazuri, 08:00-11:00',
    mediaAnalysisStatus: 'processed'
  },
  {
    id: 'gm_41',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Mwangi',
    text: 'Kikao Hardware Price List',
    sentAt: '2026-08-13T18:30:00Z',
    mediaKind: 'document',
    mediaReference: 'doc_pricelist_kikao',
    mediaExtractedText:
      'Kikao Hardware price list. Solar panel, battery, lighting kit, inverter. 50W solar kit KSh 18,500.',
    mediaAnalysisStatus: 'processed'
  },
  {
    id: 'gm_42',
    groupId: 'grp_kilimani_traders',
    authorLabel: 'Njeri',
    text: 'Flyer',
    sentAt: '2026-08-13T19:00:00Z',
    mediaKind: 'image',
    mediaReference: 'img_flyer_002',
    // No caption, no processed text: Brief must record the image and claim
    // nothing about its contents.
    mediaAnalysisStatus: 'pending'
  },

  // --- Messages in groups this user CANNOT access ---------------------------
  // Present on purpose: if any of these ever appear in the user's results,
  // the access filter has failed and the tests must catch it.
  {
    id: 'gm_90',
    groupId: 'grp_revoked_market',
    authorLabel: 'Someone',
    text: 'Selling wholesale tomatoes, 4500 per crate. Call 0712999888',
    sentAt: '2026-08-14T08:00:00Z'
  },
  {
    id: 'gm_91',
    groupId: 'grp_stranger_group',
    authorLabel: 'Stranger',
    text: 'Fresh tilapia supply available daily, contact 0713777666',
    sentAt: '2026-08-14T08:30:00Z'
  },
  {
    id: 'gm_92',
    groupId: 'grp_pending_estate',
    authorLabel: 'Neighbour',
    text: 'Plumber recommendation: very good and affordable, call 0714555444',
    sentAt: '2026-08-14T09:00:00Z'
  }
];

const FIXTURE_SOURCES = [
  {
    id: 'tg_nairobi_traders',
    name: 'Nairobi Traders',
    type: 'telegram',
    description: 'Trader announcements, stock and service adverts.',
    active: true,
    lastSeenAt: '2026-08-14T11:02:00Z',
    lastSuccessfulIngestionAt: '2026-08-14T11:02:00Z',
    ingestionCount: 3,
    errorCount: 0
  },
  {
    id: 'wa_kilimani_notices',
    name: 'Kilimani Notices',
    type: 'whatsapp',
    description: 'Neighbourhood notices, grants and civic updates.',
    active: true,
    lastSeenAt: '2026-08-14T09:05:00Z',
    lastSuccessfulIngestionAt: '2026-08-14T09:05:00Z',
    ingestionCount: 1,
    errorCount: 0
  },
  {
    id: 'src_manual_capture',
    name: 'Captured by you',
    type: 'manual',
    description: 'Anything you paste or forward into Brief yourself.',
    active: true,
    ingestionCount: 0,
    errorCount: 0
  }
];

const FIXTURE_BUSINESS_PROFILES = [
  {
    id: 'biz_kikao',
    objectId: 'id_kikao_hardware',
    name: 'Kikao Hardware',
    location: 'Kilimani Hardware Lab',
    services: ['Solar lighting packs', 'Installation support'],
    faqs: [
      {
        question: 'Do you install?',
        answer: 'Yes. Installation support is offered for solar lighting packs.'
      }
    ],
    lastConfirmedAt: '2026-08-04T11:00:00Z'
  }
];

// Inbound messages as the SERVER returns them from /api/raw-items. Batch 1
// replaced the client-side INBOUND_FIXTURES constant with a real fetch, so
// the review-queue suites now serve these rows over the mocked endpoint --
// exercising the actual wiring rather than a hardcoded array in App.tsx.
const FIXTURE_RAW_ITEMS = [
  {
    id: 'msg_001',
    sourceId: 'tg_nairobi_traders',
    text: 'Solar installation and repair service. We mount panels and wire battery boxes for stalls. Charges from KSh 4,500 per site. Call 0712345678. Open 08:00-17:00 Mon to Sat.',
    publishedAt: '2026-08-14T07:20:00Z',
    processingStatus: 'pending'
  },
  {
    id: 'msg_002',
    sourceId: 'wa_kilimani_notices',
    text: 'Youth enterprise grant applications now open. Non-equity funding for small traders. Deadline: 30 September. Requirements and steps will be shared here.',
    publishedAt: '2026-08-14T09:05:00Z',
    processingStatus: 'pending'
  },
  {
    // Deliberately a near-duplicate of a fixture object, to prove the
    // duplicate check fires before anything is published.
    id: 'msg_003',
    sourceId: 'tg_nairobi_traders',
    text: 'Maji Mazuri Farmers & Artisans Market is open today. Fresh produce and handcrafts at Haile Selassie Ave. Open 06:00-18:30.',
    publishedAt: '2026-08-14T10:40:00Z',
    processingStatus: 'pending'
  },
  {
    // Deliberately unparseable chatter: proves low confidence is surfaced
    // rather than smoothed over into a plausible-looking object.
    id: 'msg_004',
    sourceId: 'tg_nairobi_traders',
    text: 'Anyone around? asking for a friend',
    publishedAt: '2026-08-14T11:02:00Z',
    processingStatus: 'pending'
  }
];

// The sources those messages arrived from. handleReceiveInbound() resolves
// each message's channel and label from the connected-source list, so these
// must be served alongside the raw items for provenance to render.
const FIXTURE_INBOX_SOURCES = [
  { id: 'tg_nairobi_traders', name: 'Nairobi Traders (Telegram)', type: 'telegram', platform: 'telegram',
    itemsProcessed: 0, itemsPending: 3, itemsRejected: 0, objectsCreated: 0, membership: null },
  { id: 'wa_kilimani_notices', name: 'Kilimani Notices (WhatsApp)', type: 'whatsapp', platform: 'whatsapp',
    itemsProcessed: 0, itemsPending: 1, itemsRejected: 0, objectsCreated: 0, membership: null }
];

module.exports = {
  FIXTURE_OBJECTS,
  FIXTURE_POSTS,
  FIXTURE_JOURNEYS,
  FIXTURE_GROUPS,
  FIXTURE_GROUP_MESSAGES,
  FIXTURE_SOURCES,
  FIXTURE_BUSINESS_PROFILES,
  FIXTURE_RAW_ITEMS,
  FIXTURE_INBOX_SOURCES
};
