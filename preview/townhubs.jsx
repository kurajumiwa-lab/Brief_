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
const { ArenaClanCoordination } = require('./src/components/arena/ArenaClanCoordination.tsx');

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

  console.log(`\nPASSED ${pass}   FAILED ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
