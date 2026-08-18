// PHASE 1 (server stopped): seed a second seller. callerId() is a constant
// over HTTP, so a rival seller can only be created through the domain layer.
process.env.BRIEF_DATA_DIR = '/tmp/brief-prod';
const { store } = await import('/home/user/server/src/store.js');
const vendors = await import('/home/user/server/src/domain/vendor.js');
const listings = await import('/home/user/server/src/domain/listing.js');
let v = store.find('vendors', x => x.ownerId === 'usr_rival');
if (!v) v = vendors.createVendor({ ownerId:'usr_rival', displayName:'Kangemi Grocers',
  description:'Fresh produce', contactMethod:'0733 444555' });
// Unlimited stock so the live script is REPEATABLE. Stock exhaustion and
// oversell are covered exhaustively in server/test/run.js; re-running a live
// smoke test should not fail because a previous run bought the last crate.
const l = listings.createListing({ vendorId: v.id, title:'Crate of tomatoes',
  description:'Grade A', type:'product', price:2500, currency:'KES',
  quantityAvailable:null, locationName:'Kangemi' });
listings.transitionListing(l.id, 'active');
console.log(JSON.stringify({ vendorId: v.id, listingId: l.id }));
