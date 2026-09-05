// ---------------------------------------------------------------------------
// BRIEF 2.0: SPACE FIRST-LOOP TEST SUITE (Digital Landlord)
//
// Tests:
// 1. HomeSurface rendering & empty state
// 2. Space creation flow (Amina's Cakes)
// 3. SpaceShell with metrics, offers, activities
// 4. Offer creation & publication (Birthday Cake, KES 4,500)
// 5. Customer conversation / contextual inquiry
// 6. Navigation and AppShell integration
// ---------------------------------------------------------------------------

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Request = dom.window.Request || class {};
global.Response = dom.window.Response || class {};
global.fetch = async () => ({ ok: true, json: async () => ({}) });

const { HomeSurface } = require('./src/features/home/HomeSurface.tsx');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');
const { SpaceHeader } = require('./src/features/spaces/SpaceHeader.tsx');
const { SpaceOffers } = require('./src/features/spaces/SpaceOffers.tsx');
const { SpaceActivity } = require('./src/features/spaces/SpaceActivity.tsx');
const { CreateSpaceModal } = require('./src/features/spaces/CreateSpaceModal.tsx');
const { CreateOfferModal } = require('./src/features/spaces/CreateOfferModal.tsx');
const { PublicOfferModal } = require('./src/features/offers/PublicOfferModal.tsx');
const { AppShell } = require('./src/app/AppShell.tsx');

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name} ${extra}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== BRIEF 2.0: SPACES & THE DIGITAL LANDLORD SUITE ===');

  // --- 1. HomeSurface ---
  console.log('\n--- 1. HomeSurface Decision Screen ---');
  const host1 = document.createElement('div');
  document.body.appendChild(host1);
  const root1 = createRoot(host1);
  await act(async () => {
    root1.render(React.createElement(HomeSurface, {
      userName: 'Amina',
      onOpenSpace: () => {}
    }));
  });

  const text1 = host1.textContent;
  check('renders greeting with user name', text1.includes('Good morning, Amina'));
  check('renders core question: What are you working on?', text1.includes('What are you working on?'));
  check('shows Today action queue', text1.includes('Today') && text1.includes('Action Queue'));
  check('shows 4 quick action options: Sell, Find customers, Get paid, Create space',
    text1.includes('Sell something') && text1.includes('Find customers') && text1.includes('Get paid') && text1.includes('Create space'));

  await act(async () => { root1.unmount(); host1.remove(); });

  // --- 2. CreateSpaceModal ---
  console.log('\n--- 2. CreateSpaceModal (4-Step Simple Wizard) ---');
  const host2 = document.createElement('div');
  document.body.appendChild(host2);
  const root2 = createRoot(host2);
  await act(async () => {
    root2.render(React.createElement(CreateSpaceModal, {
      isOpen: true,
      onClose: () => {},
      onSpaceCreated: () => {}
    }));
  });

  const text2 = host2.textContent;
  check('renders Step 1: What are you building?', text2.includes('What are you building?'));
  check('shows simple space options: Business, Side Hustle, Creator, Community',
    text2.includes('Business') && text2.includes('Side Hustle') && text2.includes('Creator Work'));

  await act(async () => { root2.unmount(); host2.remove(); });

  // --- 3. SpaceHeader & SpaceState ---
  console.log('\n--- 3. SpaceHeader & Space Identity ---');
  const mockSpace = {
    id: 'spc_amina_cakes_1',
    ownerId: 'usr_amina',
    vendorId: 'vend_amina_1',
    name: "Amina's Cakes",
    type: 'business',
    goal: 'Get my first 20 customers',
    targetValueKes: 100000,
    status: 'active',
    capabilities: ['commerce', 'communication', 'ledger', 'activity'],
    metrics: {
      revenueKes: 84200,
      customerCount: 23,
      activeOrdersCount: 7,
      totalOrdersCount: 19,
      offersCount: 3
    },
    offers: [
      {
        id: 'list_bday_1',
        vendorId: 'vend_amina_1',
        title: 'Birthday Cake',
        description: 'Custom birthday cake for 10-15 people',
        price: 4500,
        currency: 'KES',
        type: 'product',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    recentActivities: [
      {
        id: 'act_1',
        spaceId: 'spc_amina_cakes_1',
        kind: 'space_created',
        title: "Created Space: Amina's Cakes",
        description: 'Goal: Get my first 20 customers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'act_2',
        spaceId: 'spc_amina_cakes_1',
        kind: 'offer_published',
        title: 'Published offer: Birthday Cake',
        description: 'KES 4,500 · Live and accepting orders',
        createdAt: new Date().toISOString()
      }
    ],
    recentConversations: [
      {
        id: 'cnv_1',
        spaceId: 'spc_amina_cakes_1',
        customerName: 'Mary',
        customerContact: '+254712345678',
        offerTitle: 'Birthday Cake',
        status: 'new',
        messages: [{ id: 'm1', from: 'customer', sender: 'Mary', text: 'Can you make it for Saturday?', at: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const host3 = document.createElement('div');
  document.body.appendChild(host3);
  const root3 = createRoot(host3);
  await act(async () => {
    root3.render(React.createElement(SpaceHeader, {
      space: mockSpace,
      onAddOffer: () => {},
      onCreateOrder: () => {}
    }));
  });

  const text3 = host3.textContent;
  check('renders space title correctly', text3.includes("Amina's Cakes"));
  check('renders space goal', text3.includes('Get my first 20 customers'));
  check('renders concise 3 metrics: Revenue 84,200, 23 Customers, 7 Active Orders',
    text3.includes('84,200') && text3.includes('23') && text3.includes('7'));
  check('shows fast action buttons: Add Offer & Create Order',
    text3.includes('Add Offer') && text3.includes('Create Order'));

  await act(async () => { root3.unmount(); host3.remove(); });

  // --- 4. SpaceOffers ---
  console.log('\n--- 4. SpaceOffers ---');
  const host4 = document.createElement('div');
  document.body.appendChild(host4);
  const root4 = createRoot(host4);
  await act(async () => {
    root4.render(React.createElement(SpaceOffers, {
      offers: mockSpace.offers,
      onAddOffer: () => {}
    }));
  });

  const text4 = host4.textContent;
  check('renders offer title', text4.includes('Birthday Cake'));
  check('renders offer price: KES 4,500', text4.includes('4,500'));
  check('renders offer status badge: active', text4.includes('active'));

  await act(async () => { root4.unmount(); host4.remove(); });

  // --- 5. SpaceActivity ---
  console.log('\n--- 5. SpaceActivity Stream ---');
  const host5 = document.createElement('div');
  document.body.appendChild(host5);
  const root5 = createRoot(host5);
  await act(async () => {
    root5.render(React.createElement(SpaceActivity, {
      activities: mockSpace.recentActivities
    }));
  });

  const text5 = host5.textContent;
  check('renders activity stream header', text5.includes('Recent Activity'));
  check('shows space creation event', text5.includes("Created Space: Amina's Cakes"));
  check('shows offer published event', text5.includes('Published offer: Birthday Cake'));

  await act(async () => { root5.unmount(); host5.remove(); });

  // --- 6. PublicOfferModal (Customer Contextual Inquiry) ---
  console.log('\n--- 6. PublicOfferModal (Customer View) ---');
  const host6 = document.createElement('div');
  document.body.appendChild(host6);
  const root6 = createRoot(host6);
  await act(async () => {
    root6.render(React.createElement(PublicOfferModal, {
      isOpen: true,
      offer: mockSpace.offers[0],
      spaceName: "Amina's Cakes",
      onClose: () => {}
    }));
  });

  const text6 = host6.textContent;
  check('shows public offer title and price', text6.includes('Birthday Cake') && text6.includes('4,500'));
  check('shows verified seller space name', text6.includes("Amina's Cakes"));
  check('shows customer action buttons: Ask about this & Order Now',
    text6.includes('Ask about this') && text6.includes('Order Now'));

  await act(async () => { root6.unmount(); host6.remove(); });

  // --- 7. AppShell Integration ---
  console.log('\n--- 7. AppShell Navigation ---');
  const host7 = document.createElement('div');
  document.body.appendChild(host7);
  const root7 = createRoot(host7);
  await act(async () => {
    root7.render(React.createElement(AppShell, {
      initialTab: 'home'
    }));
  });

  const text7 = host7.textContent;
  check('renders AppShell Home tab by default', text7.includes('What are you working on?'));

  await act(async () => { root7.unmount(); host7.remove(); });

  console.log(`\nPASSED ${passed} / FAILED ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
