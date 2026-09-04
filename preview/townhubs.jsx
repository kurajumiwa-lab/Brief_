const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://brief.test/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  writable: true,
  configurable: true
});
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const { TodayOpportunities } = require('./src/components/home/TodayOpportunities.tsx');
const { CommitteeDesk } = require('./src/components/life/CommitteeDesk.tsx');
const { WellbeingDesk } = require('./src/components/wellbeing/WellbeingDesk.tsx');
const { CivicKnowledgeGuide } = require('./src/components/civic/CivicKnowledgeGuide.tsx');
const { BriefAiAssistant } = require('./src/components/ai/BriefAiAssistant.tsx');
const { ChamaDesk } = require('./src/components/circle/ChamaDesk.tsx');
const { UssdSimulatorDesk } = require('./src/components/offline/UssdSimulatorDesk.tsx');
const { InterCountyDesk } = require('./src/components/wairo/InterCountyDesk.tsx');
const { PrivateCarrierAuctionDesk } = require('./src/components/wairo/PrivateCarrierAuctionDesk.tsx');
const { WairoBookmark } = require('./src/components/wairo/WairoBookmark.tsx');
const { IronSheet } = require('./src/components/ui/IronSheet.tsx');
const { MetalTag } = require('./src/components/ui/MetalTag.tsx');
const { OfflineSyncQueueDesk } = require('./src/components/offline/OfflineSyncQueueDesk.tsx');
const { ArenaClanCoordination } = require('./src/components/arena/ArenaClanCoordination.tsx');
const { UniversalCreatePostModal, CreatePostSheet } = require('./src/components/posts/UniversalCreatePostModal.tsx');
const { DiscoverScreen } = require('./src/screens/DiscoverScreen.tsx');
const { LandingScreen } = require('./src/screens/LandingScreen.tsx');
const { SheetDetailScreen } = require('./src/screens/SheetDetailScreen.tsx');
const { SubcategoryDrillScreen } = require('./src/screens/SubcategoryDrillScreen.tsx');

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    console.log('  FAIL  ' + name + (detail ? ' -> ' + detail : ''));
  }
};

async function main() {
  console.log('=== TOWN HUBS & BOARDS SUITE ===');

  // --- 1. TodayOpportunities ---
  console.log('\n--- 1. TodayOpportunities ---');
  let selectedOpp = null;
  const host1 = document.createElement('div');
  document.body.appendChild(host1);
  const root1 = createRoot(host1);
  await act(async () => {
    root1.render(React.createElement(TodayOpportunities, {
      onSelectOpportunity: (opp) => { selectedOpp = opp; }
    }));
  });

  const text1 = host1.textContent;
  check('renders Today Pulse header', text1.includes("Today's Opportunities"));
  check('renders Paid Gigs card', text1.includes('Paid Gigs'));
  check('renders Pool Match card', text1.includes('Pool Match'));
  check('renders Skills Workshop card', text1.includes('Skills Workshop'));
  check('renders Thrift Drop card', text1.includes('Thrift Drop'));
  check('renders Creator Live card', text1.includes('J Segera'));
  check('renders Grants card', text1.includes('Grants'));

  const gigBtn = Array.from(host1.querySelectorAll('button')).find(b => b.textContent.includes('Paid Gigs'));
  if (gigBtn) {
    await act(async () => {
      gigBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('clicking opportunity triggers callback', selectedOpp && selectedOpp.title === 'Paid Gigs');
  await act(async () => { root1.unmount(); host1.remove(); });

  // --- 2. CommitteeDesk ---
  console.log('\n--- 2. CommitteeDesk ---');
  const host2 = document.createElement('div');
  document.body.appendChild(host2);
  const root2 = createRoot(host2);
  await act(async () => {
    root2.render(React.createElement(CommitteeDesk, {
      onClose: () => {},
      onOpenVendor: () => {}
    }));
  });

  check('renders Committee Desk title', host2.textContent.includes("Dad's Burial Arrangements"));
  check('shows Harambee target and progress', host2.textContent.includes('TOTAL TARGET') && host2.textContent.includes('FUNDED'));
  check('shows task assignments', host2.textContent.includes('Tasks (6)'));

  // Switch to Contributions tab
  const contribBtn = Array.from(host2.querySelectorAll('button')).find(b => b.textContent.includes('Contributions'));
  if (contribBtn) {
    await act(async () => {
      contribBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows M-Pesa ledger contributions', host2.textContent.includes('M-Pesa Contribution Ledger') && host2.textContent.includes('QKJ82910A'));

  // Switch to Guest Info tab
  const guestInfoBtn = Array.from(host2.querySelectorAll('button')).find(b => b.textContent.includes('Guest Info'));
  if (guestInfoBtn) {
    await act(async () => {
      guestInfoBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows guest info and logistics', host2.textContent.includes('Service & Burial Venue') && host2.textContent.includes("St. Peter's Church"));
  await act(async () => { root2.unmount(); host2.remove(); });

  // --- 3. WellbeingDesk ---
  console.log('\n--- 3. WellbeingDesk ---');
  let bookedDoc = null;
  const host3 = document.createElement('div');
  document.body.appendChild(host3);
  const root3 = createRoot(host3);
  await act(async () => {
    root3.render(React.createElement(WellbeingDesk, {
      onClose: () => {},
      onBookTherapist: (doc) => { bookedDoc = doc; }
    }));
  });

  const text3 = host3.textContent;
  check('renders Wellbeing Hub title', text3.includes('Emotional Wellbeing') && text3.includes('TOWN WELLBEING DISTRICT'));
  check('renders 1-tap mood options', text3.includes('Lonely') && text3.includes('Stressed') && text3.includes('Grieving'));
  check('renders verified therapists directory', text3.includes('Dr. Mercy Bosire') && text3.includes('Clinical Psychologist'));
  check('renders support circles', text3.includes("Men's Mental Health Circle") || text3.includes('Grief Support Group'));

  const lonelyMoodBtn = Array.from(host3.querySelectorAll('button')).find(b => b.textContent.includes('Lonely'));
  if (lonelyMoodBtn) {
    await act(async () => {
      lonelyMoodBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('selecting lonely mood updates advice', host3.textContent.includes('Connect with a peer support circle'));
  await act(async () => { root3.unmount(); host3.remove(); });

  // --- 4. CivicKnowledgeGuide ---
  console.log('\n--- 4. CivicKnowledgeGuide ---');
  let civicAction = null;
  const host4 = document.createElement('div');
  document.body.appendChild(host4);
  const root4 = createRoot(host4);
  await act(async () => {
    root4.render(React.createElement(CivicKnowledgeGuide, {
      onClose: () => {},
      onAction: (actName) => { civicAction = actName; }
    }));
  });

  const text4 = host4.textContent;
  check('renders Single Business Permit guide', text4.includes('How to renew your business permit?'));
  check('shows verified checklist', text4.includes('Valid National ID') && text4.includes('Previous Single Business Permit'));
  check('shows 10-action Universal Protocol Bar', text4.includes('Save') && text4.includes('Share') && text4.includes('Verify'));
  await act(async () => { root4.unmount(); host4.remove(); });

  // --- 5. BriefAiAssistant (The Mayor) ---
  console.log('\n--- 5. BriefAiAssistant ---');
  const host5 = document.createElement('div');
  document.body.appendChild(host5);
  const root5 = createRoot(host5);
  await act(async () => {
    root5.render(React.createElement(BriefAiAssistant, {
      onClose: () => {},
      onOpenCardAction: () => {}
    }));
  });

  const text5 = host5.textContent;
  check('renders Town Concierge header', text5.includes('Town Concierge') && text5.includes('The Mayor'));
  check('renders greeting message', text5.includes('Hello Neighbor!') && text5.includes('Town Concierge'));
  await act(async () => { root5.unmount(); host5.remove(); });

  // --- 6. ChamaDesk (Merry-Go-Round & Table Banking) ---
  console.log('\n--- 6. ChamaDesk ---');
  const host6 = document.createElement('div');
  document.body.appendChild(host6);
  const root6 = createRoot(host6);
  await act(async () => {
    root6.render(React.createElement(ChamaDesk, {
      onClose: () => {},
      onOpenCircle: () => {}
    }));
  });

  const text6 = host6.textContent;
  check('renders Chama title', text6.includes('Kilimani Women Traders Chama'));
  check('shows Merry-Go-Round pot and recipient', text6.includes('GRACE WANJIKU') && text6.includes('ROUND 5'));
  check('shows rotational roster', text6.includes('Payout Roster') && text6.includes('Mary Atieno'));

  // Switch to Table Banking loans tab
  const loansBtn = Array.from(host6.querySelectorAll('button')).find(b => b.textContent.includes('Table Banking'));
  if (loansBtn) {
    await act(async () => {
      loansBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows table loans and interest', host6.textContent.includes('Table Banking Loans') && host6.textContent.includes('5% Int'));
  await act(async () => { root6.unmount(); host6.remove(); });

  // --- 7. UssdSimulatorDesk (2G GSM / SMS Fallback) ---
  console.log('\n--- 7. UssdSimulatorDesk ---');
  const host7 = document.createElement('div');
  document.body.appendChild(host7);
  const root7 = createRoot(host7);
  await act(async () => {
    root7.render(React.createElement(UssdSimulatorDesk, {
      onClose: () => {},
      onAction: () => {}
    }));
  });

  const text7 = host7.textContent;
  check('renders USSD Fallback title', text7.includes('SMS & USSD Fallback Gateway'));
  check('shows retro LCD dial prompt', text7.includes('*483*88#') && text7.includes('SAFARICOM 2G'));
  check('renders dial and keypad buttons', text7.includes('DIAL') && text7.includes('END / CLR'));

  // Switch to SMS tab
  const smsTabBtn = Array.from(host7.querySelectorAll('button')).find(b => b.textContent.includes('Two-Way SMS Shortcode'));
  if (smsTabBtn) {
    await act(async () => {
      smsTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows shortcode gateway and sample dispatches', host7.textContent.includes('22880') && host7.textContent.includes('WAIRO DISPATCH'));
  await act(async () => { root7.unmount(); host7.remove(); });

  // --- 8. InterCountyDesk (Long Distance Traveler & Cargo Matching) ---
  console.log('\n--- 8. InterCountyDesk ---');
  const host8 = document.createElement('div');
  document.body.appendChild(host8);
  const root8 = createRoot(host8);
  await act(async () => {
    root8.render(React.createElement(InterCountyDesk, {
      onClose: () => {},
      onBookingComplete: () => {}
    }));
  });

  const text8 = host8.textContent;
  check('renders Inter-County title', text8.includes('Long-Distance Traveler & Cargo Matching'));
  check('shows inter-county routes and counties', text8.includes('Mombasa') && text8.includes('Kisumu') && text8.includes('Nairobi'));
  check('shows logbook verified badge', text8.includes('LOGBOOK VERIFIED'));

  // Switch to Post Trip tab
  const postTripBtn = Array.from(host8.querySelectorAll('button')).find(b => b.textContent.includes('Post Your Trip'));
  if (postTripBtn) {
    await act(async () => {
      postTripBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows post trip form & 90% payout info', host8.textContent.includes('Earn 90% Commission') && host8.textContent.includes('Publish Inter-County Route'));

  // Switch to My Bookings tab
  const myBookingsBtn = Array.from(host8.querySelectorAll('button')).find(b => b.textContent.includes('My Cargo Bookings'));
  if (myBookingsBtn) {
    await act(async () => {
      myBookingsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows parcel escrow release PIN', host8.textContent.includes('Recipient Drop-off Release PIN') && host8.textContent.includes('7419'));
  await act(async () => { root8.unmount(); host8.remove(); });

  // --- 9. ArenaClanCoordination (Discord for Africa & Scrim Coordinator) ---
  console.log('\n--- 9. ArenaClanCoordination ---');
  const host9 = document.createElement('div');
  document.body.appendChild(host9);
  const root9 = createRoot(host9);
  await act(async () => {
    root9.render(React.createElement(ArenaClanCoordination, {
      onClose: () => {},
      onJoinMatch: () => {}
    }));
  });

  const text9 = host9.textContent;
  check('renders Arena Clan Hub title', text9.includes('Arena Clan Hub & Matchmaking'));
  check('shows top African clans and tags', text9.includes('Nairobi Phantoms') && text9.includes('[NBO]') && text9.includes('Mombasa Cyber-Sharks'));
  check('shows Discord voice channel lounge', text9.includes('Voice: Nairobi Scrim Lobbies #1') && text9.includes('Recruiting Open'));

  // Switch to M-Pesa Staked tab
  const stakedTabBtn = Array.from(host9.querySelectorAll('button')).find(b => b.textContent.includes('M-Pesa Staked Duels'));
  if (stakedTabBtn) {
    await act(async () => {
      stakedTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows staked challenge lobbies and prize pools', host9.textContent.includes('M-Pesa Staked Challenge Lobbies') && host9.textContent.includes('KES 900'));

  // Switch to Tournament Bracket tab
  const bracketTabBtn = Array.from(host9.querySelectorAll('button')).find(b => b.textContent.includes('County Tournament Brackets'));
  if (bracketTabBtn) {
    await act(async () => {
      bracketTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows single elimination bracket and rounds', host9.textContent.includes('Quarterfinals') && host9.textContent.includes('Semifinals') && host9.textContent.includes('Grand Final'));
  await act(async () => { root9.unmount(); host9.remove(); });

  // --- 10. PrivateCarrierAuctionDesk (Silent Math Reverse Auction) ---
  console.log('\n--- 10. PrivateCarrierAuctionDesk ---');
  const host10 = document.createElement('div');
  document.body.appendChild(host10);
  const root10 = createRoot(host10);
  await act(async () => {
    root10.render(React.createElement(PrivateCarrierAuctionDesk, {
      onClose: () => {},
      onDispatchSelected: () => {}
    }));
  });

  const text10 = host10.textContent;
  check('renders Carrier Reverse-Auction title', text10.includes('Carrier Reverse-Auction Engine'));
  check('shows registered carriers and bids', text10.includes('Fargo Courier') && text10.includes('GreenWheels') && text10.includes('KES 220'));
  check('shows math match scores', text10.includes('/100') && text10.includes('Price') && text10.includes('Trust'));

  // Switch to Branded Fixed Rates tab
  const fixedTabBtn = Array.from(host10.querySelectorAll('button')).find(b => b.textContent.includes('Branded Direct Booking'));
  if (fixedTabBtn) {
    await act(async () => {
      fixedTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows branded direct booking & fixed rates', host10.textContent.includes('Direct Fixed-Rate Booking') && host10.textContent.includes('G4S Secure Logistics'));
  await act(async () => { root10.unmount(); host10.remove(); });

  // --- 11. OfflineSyncQueueDesk (PWA IndexedDB & Background Sync) ---
  console.log('\n--- 11. OfflineSyncQueueDesk ---');
  const host11 = document.createElement('div');
  document.body.appendChild(host11);
  const root11 = createRoot(host11);
  await act(async () => {
    root11.render(React.createElement(OfflineSyncQueueDesk, {
      onClose: () => {},
      onActionSynced: () => {}
    }));
  });

  const text11 = host11.textContent;
  check('renders Offline Sync Queue title', text11.includes('Offline Local Storage & Sync Queue'));
  check('shows pending sync mutations and count', text11.includes('Pending Sync') && text11.includes('mutations'));
  check('shows network state simulator pills', text11.includes('4G Online') && text11.includes('Offline'));

  // Switch to IndexedDB inspect tab
  const inspectTabBtn = Array.from(host11.querySelectorAll('button')).find(b => b.textContent.includes('IndexedDB Tables'));
  if (inspectTabBtn) {
    await act(async () => {
      inspectTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows offline local table stores', host11.textContent.includes('wairo_offline_deliveries') && host11.textContent.includes('duka_offline_sales'));
  await act(async () => { root11.unmount(); host11.remove(); });

  // --- 12. UniversalCreatePostModal (Single Consolidated Post Publisher) ---
  console.log('\n--- 12. UniversalCreatePostModal ---');
  const host12 = document.createElement('div');
  document.body.appendChild(host12);
  const root12 = createRoot(host12);
  await act(async () => {
    root12.render(React.createElement(UniversalCreatePostModal, {
      isOpen: true,
      initialPostType: 'event',
      onClose: () => {},
      onPostCreated: () => {}
    }));
  });

  const text12 = host12.textContent;
  check('renders Universal Publisher title', text12.includes('UNIVERSAL PUBLISHER') && text12.includes('Publish Event & Gathering'));
  check('shows multi-type tabs: event, product, announcement', text12.includes('Event / Popup') && text12.includes('Product / Duka') && text12.includes('Announcement'));
  check('shows multi-image picker widget', text12.includes('Photos & Media') && text12.includes('Add Photo'));
  check('shows 3-step wizard progression', text12.includes('1. Content & Type') && text12.includes('2. Media & Logistics') && text12.includes('3. Preview & Post'));

  // Switch to Product tab
  const productTabBtn = Array.from(host12.querySelectorAll('button')).find(b => b.textContent.includes('Product / Duka'));
  if (productTabBtn) {
    await act(async () => {
      productTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('adapts form to product pricing and category fields', host12.textContent.includes('Pricing & Inventory') && host12.textContent.includes('Price (KES)'));

  // Switch to Step 3 (Live Preview & Post)
  const step3Btn = Array.from(host12.querySelectorAll('button')).find(b => b.textContent.includes('3. Preview & Post'));
  if (step3Btn) {
    await act(async () => {
      step3Btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('renders live card feed preview on Step 3', host12.textContent.includes('Live Feed Preview') && host12.textContent.includes('Publish PRODUCT'));

  // Test Discard Draft Protection Dialog
  const closeBtn = host12.querySelector('button[aria-label="Close modal"]');
  if (closeBtn) {
    await act(async () => {
      closeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('triggers discard draft protection modal on close', host12.textContent.includes('Discard Draft?') && host12.textContent.includes('Keep Editing'));

  await act(async () => { root12.unmount(); host12.remove(); });

  // --- 13. DiscoverScreen (Modern 3D Depth & Staggered GlassCard Hub) ---
  console.log('\n--- 13. DiscoverScreen ---');
  const host13 = document.createElement('div');
  document.body.appendChild(host13);
  const root13 = createRoot(host13);
  await act(async () => {
    root13.render(React.createElement(DiscoverScreen));
  });

  const text13 = host13.textContent;
  check('renders Discover title and warm greeting', text13.includes('Discover') && text13.includes('Good morning'));
  check('shows visual toggle category options', text13.includes('All') && text13.includes('Events') && text13.includes('Products') && text13.includes('News'));
  check('renders floating action pill Create button', text13.includes('Create'));

  // Tap first card to open detail bottom sheet
  const firstCard = host13.querySelector('.rounded-\\[20px\\]');
  if (firstCard) {
    await act(async () => {
      firstCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('opens detail bottom sheet with direct WhatsApp & Telegram actions', host13.textContent.includes('WhatsApp') && host13.textContent.includes('Telegram') && host13.textContent.includes('Contact Organizer / Seller Directly:'));

  await act(async () => { root13.unmount(); host13.remove(); });

  // --- 14. CreatePostSheet (2-Step Bottom Sheet Creator) ---
  console.log('\n--- 14. CreatePostSheet ---');
  const host14 = document.createElement('div');
  document.body.appendChild(host14);
  const root14 = createRoot(host14);
  await act(async () => {
    root14.render(React.createElement(CreatePostSheet, {
      isOpen: true,
      onClose: () => {},
      onPostCreated: () => {}
    }));
  });

  const text14 = host14.textContent;
  check('renders Step 0 prompt', text14.includes('What are you sharing?'));
  check('shows type options: Event, Product, Announce', text14.includes('Event') && text14.includes('Product') && text14.includes('Announce'));
  check('shows Continue button', text14.includes('Continue'));

  // Click Continue to advance to Step 1
  const continueBtn = Array.from(host14.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
  if (continueBtn) {
    await act(async () => {
      continueBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('advances to Step 1 Add the details', host14.textContent.includes('Add the details') && host14.textContent.includes('Tap to add photos'));
  check('renders publish button on Step 1', host14.textContent.includes('Publish'));

  await act(async () => { root14.unmount(); host14.remove(); });

  // --- 15. WairoBookmark (Wax-Seal Bookmark Widget) ---
  console.log('\n--- 15. WairoBookmark ---');
  const host15 = document.createElement('div');
  document.body.appendChild(host15);
  const root15 = createRoot(host15);
  let bookmarkTapped = false;
  await act(async () => {
    root15.render(React.createElement(WairoBookmark, {
      status: 'IN TRANSIT',
      location: "Lang'ata",
      onTap: () => { bookmarkTapped = true; }
    }));
  });

  const text15 = host15.textContent;
  check('renders WairoBookmark location tag', text15.includes("Lang'ata"));

  const sealElem = host15.querySelector('[aria-label="Wairo Courier Bookmark Seal"]');
  check('renders seal element with accessible aria-label', Boolean(sealElem));

  if (sealElem) {
    await act(async () => {
      sealElem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('fires onTap callback when wax seal is tapped', bookmarkTapped === true);

  await act(async () => { root15.unmount(); host15.remove(); });

  // --- 16. IronSheet & MetalTag (Tactile Brushed-Metal Materials) ---
  console.log('\n--- 16. IronSheet & MetalTag ---');
  const host16 = document.createElement('div');
  document.body.appendChild(host16);
  const root16 = createRoot(host16);
  let sheetTapped = false;
  await act(async () => {
    root16.render(React.createElement('div', null,
      React.createElement(IronSheet, {
        material: 'copper',
        title: 'Kilimani Life Events',
        subtitle: 'Community weddings, harambee & gatherings',
        emoji: '🌿',
        badge: 'COMMUNITY',
        onTap: () => { sheetTapped = true; }
      }),
      React.createElement(MetalTag, {
        material: 'copper',
        label: 'Harambee',
        selected: true
      })
    ));
  });

  const text16 = host16.textContent;
  check('renders IronSheet title and subtitle', text16.includes('Kilimani Life Events') && text16.includes('Community weddings'));
  check('renders IronSheet badge and emoji', text16.includes('COMMUNITY') && text16.includes('🌿'));
  check('renders MetalTag label', text16.includes('Harambee'));

  const sheetCard = host16.querySelector('.rounded-\\[20px\\]');
  if (sheetCard) {
    await act(async () => {
      sheetCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('fires onTap callback on IronSheet click', sheetTapped === true);

  await act(async () => { root16.unmount(); host16.remove(); });

  // --- 17. LandingScreen (Unified Sections, IronSheet Grid & Floating Wairo Bookmark) ---
  console.log('\n--- 17. LandingScreen ---');
  const host17 = document.createElement('div');
  document.body.appendChild(host17);
  const root17 = createRoot(host17);
  await act(async () => {
    root17.render(React.createElement(LandingScreen));
  });

  const text17 = host17.textContent;
  check('renders LandingScreen header and Around You', text17.includes('AROUND YOU') && text17.includes('Home'));
  check('shows section switcher tabs: Today, Districts, Shelf', text17.includes('Today') && text17.includes('Districts') && text17.includes('Shelf'));
  check('renders Today section items: Paid Gigs, Pool Match', text17.includes('Paid Gigs') && text17.includes('Pool Match'));

  // Switch to Districts section
  const districtsTab = Array.from(host17.querySelectorAll('button')).find(b => b.textContent.trim() === 'Districts');
  if (districtsTab) {
    await act(async () => {
      districtsTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows Town Centre Districts and Quick Access tags', host17.textContent.includes('Town Centre Districts') && host17.textContent.includes('Life-Events Hub') && host17.textContent.includes('Quick Access'));

  await act(async () => { root17.unmount(); host17.remove(); });

  // --- 18. SheetDetailScreen (Tactile Material Details & Join Confirmation) ---
  console.log('\n--- 18. SheetDetailScreen ---');
  const host18 = document.createElement('div');
  document.body.appendChild(host18);
  const root18 = createRoot(host18);
  let joinSuccessFired = false;
  await act(async () => {
    root18.render(React.createElement(SheetDetailScreen, {
      material: 'copper',
      title: 'Skills Workshop',
      subtitle: '2:00 PM · Online Zoom',
      emoji: '✨',
      badge: 'LEARNING',
      heroDescription: 'Join a workshop that connects local skills with real opportunities.',
      onJoinSuccess: () => { joinSuccessFired = true; }
    }));
  });

  const text18 = host18.textContent;
  check('renders SheetDetailScreen title and badge', text18.includes('Skills Workshop') && text18.includes('LEARNING'));
  check('shows subtabs: Overview, Related, Activity', text18.includes('Overview') && text18.includes('Related') && text18.includes('Activity'));
  check('renders sticky action bar Join Now button', text18.includes('Join Now'));

  // Switch to Related tab
  const relatedTab = Array.from(host18.querySelectorAll('button')).find(b => b.textContent.trim() === 'Related');
  if (relatedTab) {
    await act(async () => {
      relatedTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('shows People Also Follow section on Related tab', host18.textContent.includes('People Also Follow') && host18.textContent.includes('Skills Marketplace'));

  // Open Join confirmation sheet
  const joinNowBtn = Array.from(host18.querySelectorAll('button')).find(b => b.textContent.trim() === 'Join Now');
  if (joinNowBtn) {
    await act(async () => {
      joinNowBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('opens Join Confirmation sheet', host18.textContent.includes("YOU'RE JOINING") && host18.textContent.includes('Confirm ✓'));

  // Click Confirm ✓
  const confirmBtn = Array.from(host18.querySelectorAll('button')).find(b => b.textContent.trim() === 'Confirm ✓');
  if (confirmBtn) {
    await act(async () => {
      confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('fires onJoinSuccess callback on confirm', joinSuccessFired === true);

  await act(async () => { root18.unmount(); host18.remove(); });

  // --- 19. SubcategoryDrillScreen (Subcategory Drilldown & Material Consistency) ---
  console.log('\n--- 19. SubcategoryDrillScreen ---');
  const host19 = document.createElement('div');
  document.body.appendChild(host19);
  const root19 = createRoot(host19);
  let selectedItemFired = null;
  await act(async () => {
    root19.render(React.createElement(SubcategoryDrillScreen, {
      material: 'copper',
      parentCategory: 'Skills Workshop',
      subcategory: 'Beginner',
      onSelectItem: (item) => { selectedItemFired = item; }
    }));
  });

  const text19 = host19.textContent;
  check('renders SubcategoryDrillScreen parent category and subcategory', text19.includes('Skills Workshop') && text19.includes('Beginner'));
  check('renders horizontal filters: All, Free, Certificate, Weekend, Online', text19.includes('All') && text19.includes('Certificate') && text19.includes('Weekend'));
  check('renders sort options: Newest, Popular, Nearby', text19.includes('Newest') && text19.includes('Popular') && text19.includes('Nearby'));
  check('renders 2-column IronSheet grid with items', text19.includes('Coffee Art') && text19.includes('Espresso 101'));

  // Switch filter to Certificate
  const certTag = Array.from(host19.querySelectorAll('button')).find(b => b.textContent.trim().includes('Certificate'));
  if (certTag) {
    await act(async () => {
      certTag.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  check('filters grid correctly to Certificate items', host19.textContent.includes('Espresso 101') && host19.textContent.includes('POS Basics'));

  await act(async () => { root19.unmount(); host19.remove(); });

  console.log(`\nPASSED ${pass}   FAILED ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
