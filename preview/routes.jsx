const { parsePath, toPath, objectPath, objectShareUrl, DEFAULT_ROUTE } = require('./src/nav/routes.ts');

let pass = 0;
let fail = 0;
const check = (n, c, d = '') => {
  if (c) {
    pass++;
    console.log('  PASS  ' + n);
  } else {
    fail++;
    console.log('  FAIL  ' + n + (d ? ' -> ' + d : ''));
  }
};

console.log('=== parsePath ===');
check('root is Around stream', parsePath('/').dest === 'nearby' && parsePath('/').nearby === 'stream');
check('/around is Around', parsePath('/around').dest === 'nearby');
check('/around/tea is Tea', parsePath('/around/tea').nearby === 'tea');
check('/around/o/x opens object', parsePath('/around/o/obj_1').objectId === 'obj_1');
check('/o/x is a share alias', parsePath('/o/obj_1').objectId === 'obj_1');
check('/around/t/slug is tea reader', parsePath('/around/t/morning-nairobi').teaSlug === 'morning-nairobi');
check('/saved/circles', parsePath('/saved/circles').dest === 'mylayer' && parsePath('/saved/circles').mylayer === 'circles');
check('/actions/money', parsePath('/actions/money').dest === 'workflows' && parsePath('/actions/money').workflow === 'money');
check('menu query', parsePath('/around', '?menu=1').menu === true);
check('capture query', parsePath('/around', 'capture=1').capture === true);
check('following query is a real overlay', parsePath('/around', '?following=1').following === true);
check('collections query is a real overlay', parsePath('/saved', '?collections=1').collections === true);
check('unknown path falls back to Around', parsePath('/nope').dest === 'nearby');
check('/c/slug stays a public page (Around dest)', parsePath('/c/saturday-sale').dest === 'nearby' && !parsePath('/c/saturday-sale').objectId);

console.log('\n=== toPath ===');
check('default serialises to /around', toPath(DEFAULT_ROUTE) === '/around');
check('object share path', objectPath('obj_1') === '/o/obj_1');
check('share url needs an origin', objectShareUrl(null, 'obj_1') === null);
check('share url joins origin', objectShareUrl('https://brief.example', 'obj_1') === 'https://brief.example/o/obj_1');
check(
  'saved circles round-trip',
  toPath(parsePath('/saved/circles')) === '/saved/circles'
);
check(
  'tea reader round-trip',
  toPath(parsePath('/around/t/hello')) === '/around/t/hello'
);
check(
  'menu overlay stays on the query',
  toPath({ ...DEFAULT_ROUTE, menu: true }) === '/around?menu=1'
);
check(
  'following overlay round-trips on the query',
  toPath(parsePath('/around', '?following=1')) === '/around?following=1'
);
check(
  'collections overlay round-trips on the query',
  toPath(parsePath('/saved', '?collections=1')) === '/saved?collections=1'
);
check(
  'closing the following overlay strips the flag',
  toPath(DEFAULT_ROUTE) === '/around'
);

console.log('');
console.log('='.repeat(46));
console.log('PASSED ' + pass + '   FAILED ' + fail);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
