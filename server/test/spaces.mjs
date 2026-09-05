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

console.log('\n=== SPACES DOMAIN (Brief 2.0 — Digital Landlord & Phase 2 Chat Rails) ===');

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

// 7. Inbound WhatsApp Message Route
const waConv = spaces.routeInboundWhatsAppMessage({
  spaceId: space.id,
  from: '+254712345678',
  customerName: 'Mary',
  text: 'Also chocolate flavor please!'
});
check('WhatsApp message appends to existing conversation', waConv.id === conv.id && waConv.messages.length === 2);
check('WhatsApp message body preserved', waConv.messages[1].text.includes('chocolate flavor'));

// 8. In-Thread Quotation (Customized Price KES 5,200)
const quote = spaces.createSpaceQuote({
  spaceId: space.id,
  conversationId: conv.id,
  title: '2-Tier Chocolate Birthday Cake',
  priceKes: 5200,
  notes: 'Including Saturday Kilimani delivery',
  callerId: userA.id
});
check('custom quote created with server price', quote.priceKes === 5200);
check('quote message posted into conversation', spaces.getSpaceConversations(space.id)[0].quotes.length === 1);

// 9. Trigger M-Pesa STK Push
const mpesaPrompt = spaces.triggerMpesaPrompt({
  spaceId: space.id,
  conversationId: conv.id,
  quoteId: quote.id,
  phoneNumber: '+254712345678',
  amountKes: 5200,
  description: 'Amina Cakes: Chocolate Birthday Cake',
  callerId: userA.id
});
check('M-Pesa prompt created in pending state', mpesaPrompt.status === 'pending' && mpesaPrompt.amountKes === 5200);

// 10. Complete M-Pesa Payment & Auto-Convert to Order
const paymentResult = spaces.completeMpesaPayment({
  spaceId: space.id,
  conversationId: conv.id,
  paymentRequestId: mpesaPrompt.id,
  mpesaReceipt: 'QJ891234AB',
  amountPaid: 5200
});
check('payment status completed and confirmed', paymentResult.status === 'paid' && paymentResult.receipt === 'QJ891234AB');
check('order auto-created with exact paid amount', paymentResult.order.total === 5200 && paymentResult.order.status === 'paid');
check('order tagged with space and customer', paymentResult.order.spaceId === space.id && paymentResult.order.customerName === 'Mary');

// 11. Hydrated Space State with Live Metrics
const hydrated = spaces.getSpace(space.id);
check('hydrated space shows active offer count', hydrated.metrics.offersCount >= 1);
check('hydrated space shows customer count', hydrated.metrics.customerCount >= 1);
check('hydrated space shows total paid revenue KES 5,200', hydrated.metrics.revenueKes === 5200);
check('hydrated space shows active orders count', hydrated.metrics.activeOrdersCount >= 1);

// 12. Activity Stream
const activities = spaces.getSpaceActivities(space.id);
check('activity stream records payment and auto-conversion',
  activities.some(a => a.kind === 'payment_received') &&
  activities.some(a => a.kind === 'quote_sent') &&
  activities.some(a => a.kind === 'mpesa_prompt_sent'));

console.log('SPACES DOMAIN & CHAT RAILS TESTS PASSED!\n');
