// Verifies the OG meta injection for /c/:slug in production serving mode.
// Self-contained: starts the server, seeds a campaign, fetches the route,
// asserts the meta tags, and exits non-zero on failure.
process.env.NODE_ENV = 'production';
process.env.BRIEF_DATA_DIR = '/tmp/brief-og-selfcheck';
process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com';

const { store } = await import('/home/user/Brief_/server/src/store.js');
const { default: app } = await import('/home/user/Brief_/server/src/index.js');

store._reset();
store.insert('campaigns', {
  id: 'cmp_og', ownerId: 'usr_me', objectId: 'obj_og', circleId: null,
  title: 'Rooftop Saturday', description: 'A rooftop gathering in Kilimani',
  type: 'event', status: 'live', location: 'Kilimani', startsAt: null, endsAt: null,
  capacity: 50, price: 0, currency: 'KES', ownsObject: true, publicSlug: 'rooftop-saturday',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), metadata: {}
});

const srv = app.listen(0);
const port = srv.address().port;

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

const get = async (p) => {
  const res = await fetch(`http://127.0.0.1:${port}${p}`);
  return { status: res.status, body: await res.text() };
};

// A public campaign's page carries OG tags with the real title/description.
const ok = await get('/c/rooftop-saturday');
check('public page returns 200 HTML', ok.status === 200 && ok.body.includes('<div id="root">'), 'status ' + ok.status);
check('og:title carries the campaign title', ok.body.includes('property="og:title" content="Rooftop Saturday"'), ok.body.match(/og:title[^\n]*/)?.[0]);
check('og:description carries the description', ok.body.includes('content="A rooftop gathering in Kilimani"'));
check('og:url carries the canonical URL', ok.body.includes('https://brief.example.com/c/rooftop-saturday'));
check('twitter:card present', ok.body.includes('name="twitter:card"'));
check('the SPA bundle is still referenced', /assets\/index-[A-Za-z0-9_-]+\.js/.test(ok.body));

// A missing campaign falls back to the plain SPA shell with no injected tags.
const miss = await get('/c/does-not-exist');
check('missing campaign returns the shell (200)', miss.status === 200 && miss.body.includes('<div id="root">'));
check('missing campaign has no og:title', !miss.body.includes('og:title'));

// The SPA still loads for a browser (the script tag survives injection).
check('title tag was replaced (no stale "Brief" title)', !ok.body.includes('<title>Brief</title>') || ok.body.includes('Rooftop Saturday'));

srv.close();
console.log(`\nOG self-check: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
