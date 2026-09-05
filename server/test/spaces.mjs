import { store } from '../src/store.js';
import * as spaces from '../src/domain/space.js';
import * as auth from '../src/domain/auth.js';

function check(label, pass, detail) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

console.log('\n=== SPACES DOMAIN (Brief 2.0 — Digital Landlord) ===');

store._reset();

const userA = auth.createUser({ handle: 'amina', displayName: 'Amina', password: 'password123' });
const userB = auth.createUser({ handle: 'mary', displayName: 'Mary', password: 'password123' });

// 1. Create Space
const space = spaces.createSpace({
  ownerId: userA.id,
  name: "Amina's Cakes",
  type: 'business',
  goal: 'Get my first 20 customers',
  targetValueKes: 100000
});

check('space created with unguessable id', space.id.startsWith('spc_'));
check('space owner matches caller', space.ownerId === userA.id);
check('space name is saved', space.name === "Amina's Cakes");
check('space goal is saved', space.goal === 'Get my first 20 customers');
check('underlying vendor created and linked', space.vendorId && space.vendorId.startsWith('vend_'));
check('initial activity recorded', space.recentActivities.length >= 1 && space.recentActivities[0].kind === 'space_created');

// 2. List spaces for owner
const aminaSpaces = spaces.listSpacesForOwner(userA.id);
check('owner can list own spaces', aminaSpaces.length === 1 && aminaSpaces[0].id === space.id);

const marySpaces = spaces.listSpacesForOwner(userB.id);
check('other user has no spaces yet', marySpaces.length === 0);

// 3. Create Offer (Listing) inside Space
const offer = spaces.createSpaceOffer(space.id, {
  title: 'Birthday Cake',
  description: 'Custom birthday cake for 10-15 people',
  price: 4500,
  currency: 'KES',
  type: 'product',
  callerId: userA.id
});

check('offer created with price', offer.price === 4500);
check('offer tagged with spaceId', offer.spaceId === space.id);
check('offer starts as draft', offer.status === 'draft');

// 4. Unauthorized offer creation rejected
let unauthFailed = false;
try {
  spaces.createSpaceOffer(space.id, {
    title: 'Hacked Cake',
    price: 10,
    callerId: userB.id
  });
} catch {
  unauthFailed = true;
}
check('non-owner cannot create offer in another user space', unauthFailed);

// 5. Publish Offer
const published = spaces.publishSpaceOffer(space.id, offer.id, { callerId: userA.id });
check('offer is published and active', published.status === 'active');

// 6. Customer Conversation (Contextual Inquiry)
const conv = spaces.createSpaceConversation({
  spaceId: space.id,
  offerId: offer.id,
  customerName: 'Mary',
  customerContact: '+254712345678',
  message: 'Can you make this cake for Saturday?'
});

check('conversation created with offer context', conv.offerId === offer.id && conv.offerTitle === 'Birthday Cake');
check('conversation customer message attached', conv.messages.length === 1 && conv.messages[0].text.includes('Saturday'));

// 7. Space Activity Stream
const activities = spaces.getSpaceActivities(space.id);
check('activity stream reflects space lifecycle', activities.some(a => a.kind === 'space_created') &&
  activities.some(a => a.kind === 'offer_published') &&
  activities.some(a => a.kind === 'conversation_received'));

// 8. Order Creation with Server-Authoritative Price
const order = spaces.createSpaceOrder({
  spaceId: space.id,
  offerId: offer.id,
  customerId: userB.id,
  customerName: 'Mary',
  quantity: 1,
  deliveryNotes: 'Deliver to Kilimani on Saturday 11am',
  callerId: userA.id
});

check('order total equals server offer price (4500)', order.total === 4500);
check('order tagged with spaceId and customer', order.spaceId === space.id && order.customerName === 'Mary');

// 9. Hydrated Space State
const hydrated = spaces.getSpace(space.id);
check('hydrated space shows active offer count', hydrated.metrics.offersCount >= 1);
check('hydrated space shows customer count', hydrated.metrics.customerCount >= 1);
check('hydrated space shows active orders count', hydrated.metrics.activeOrdersCount >= 1);

console.log('SPACES DOMAIN TESTS PASSED!\n');
