const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

// ---------------------------------------------------------------------------
// UTF-8 / MOJIBAKE GUARD
//
// The 2026-08-15 production build rendered UTF-8 as Latin-1 in visible UI:
// "Brief â€" Everything Happening Around You", "Â£c" where a dash belonged,
// mangled emoji in the Tea cards. The deployed bundle was stale and the
// current sources are clean -- this suite keeps it that way forever by
// failing the moment a mojibake marker sequence enters shipped client code.
// ---------------------------------------------------------------------------

// Latin-1-misdecode markers: Â, Ã, â, ð+, etc. Legitimate text never needs
// these characters in this codebase's languages (English/Swahili UI).
const MOJIBAKE = /[ÂÃâðŸ]/;

const files = [
  'src/App.tsx',
  'src/model/core.tsx',
  'src/ui/names.ts',
  ...fs.readdirSync(path.join(__dirname, 'src/components')).filter((f) => f.endsWith('.tsx')).map((f) => 'src/components/' + f),
  ...fs.readdirSync(path.join(__dirname, 'src/components/marketplace')).map((f) => 'src/components/marketplace/' + f),
  ...fs.readdirSync(path.join(__dirname, 'src/components/circle')).map((f) => 'src/components/circle/' + f),
  ...fs.readdirSync(path.join(__dirname, 'src/components/vault')).map((f) => 'src/components/vault/' + f)
];

console.log('=== MOJIBAKE: no Latin-1 misdecode markers in shipped client source ===');
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  check(f + ' is clean', !MOJIBAKE.test(src), (src.match(MOJIBAKE) || [])[0]);
}

console.log('\n=== UTF-8 survives end-to-end ===');
const corpus = files.map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
check('em-dashes exist and survived (—)', corpus.includes(' — '));
check('ellipsis survived (…)', corpus.includes('…'));
check('middle dot survived (·)', corpus.includes(' · '));

// Functional: the event time label renders "Tomorrow · 9:00 AM" — the · is
// a live render, not a literal someone might paste mojibake over.
const { getEventStartPreview } = require('./src/model/core.tsx');
const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
const label = getEventStartPreview(d.toISOString(), new Date());
check('event WHEN renders "Tomorrow · …"', label.startsWith('Tomorrow · '), label);

console.log('\nPASS ' + pass + ' FAIL ' + fail);
process.exit(fail ? 1 : 0);
