// ---------------------------------------------------------------------------
// KENYAN LOCATION GAZETTEER — the recogniser behind "extract when present".
//
// The extraction rule is absolute: a location is only ever recorded because
// the words appear in the message itself. This file is a lookup table that
// turns a literal phrase into a CLASSIFICATION (county / neighbourhood-ward /
// landmark). It never inserts a location that is not in the text, and it never
// guesses a place from context. Every match is kept with its original snippet
// as evidence so a reviewer can audit it rather than trust it.
//
// The lists are deliberately finite and Nairobi-centric to start. Unknown
// places still surface as free-text `locationName` via the venue regex in
// extract.js — the gazetteer only adds structure (county / area / landmark)
// when a known name is literally present.
// ---------------------------------------------------------------------------

/** The 47 Kenyan counties (post-2010 constitution). */
export const COUNTIES = [
  'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta',
  'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru',
  'Tharaka Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
  'Nyeri', 'Kirinyaga', "Murang'a", 'Kiambu', 'Turkana', 'West Pokot',
  'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo Marakwet', 'Nandi',
  'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado', 'Kericho', 'Bomet',
  'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay',
  'Migori', 'Kisii', 'Nyamira', 'Nairobi'
];

/** Nairobi neighbourhoods, estates and bordering towns that recur in posts. */
export const AREAS = [
  // Central / West
  'Kilimani', 'Kileleshwa', 'Westlands', 'Lavington', 'Parklands', 'Ngara',
  'Upper Hill', 'CBD', 'Central Business District', 'Riverside', 'Loresho',
  'Spring Valley', 'Kitisuru', 'Adams Arcade', 'Kangemi', 'Dagoretti',
  'Kawangware', 'Kabete', 'Lower Kabete',
  // South / Karen / Langata
  'Karen', 'Langata', 'South B', 'South C', 'Kibera', 'Madaraka',
  'Ngong', 'Rongai', 'Ongata Rongai', 'Kiserian', 'Karen Hardy',
  // East / North
  'Eastleigh', 'Roysambu', 'Ruaka', 'Kasarani', 'Embakasi', 'Donholm',
  'Umoja', 'Buruburu', 'Komarock', 'Kayole', 'Dandora', 'Baba Dogo',
  'Mathare', 'Huruma', 'Kariobangi', 'Korogocho', 'Githurai', 'Zimmerman',
  'Kahawa', 'Runda', 'Muthaiga', 'Gigiri', 'Industrial Area',
  // Satellite towns (neighbouring counties but common in Nairobi posts)
  'Thika', 'Juja', 'Kitengela', 'Athi River', 'Mlolongo', 'Syokimau',
  'Kiambu Town', 'Kikuyu', 'Limuru', 'Ruiru'
];

/** Named landmarks, venues, malls, markets and institutions. */
export const LANDMARKS = [
  // Malls / shopping
  'Sarit Centre', 'Westgate Mall', 'Two Rivers', 'The Hub Karen', 'Village Market',
  'Galleria', 'Yaya Centre', 'Prestige Plaza', 'Garden City', 'Junction Mall',
  'The Alchemist', 'Alchemist',
  // Public spaces / institutions
  'National Museum', 'Kenyatta International Convention Centre', 'KICC',
  'Uhuru Park', 'Nairobi National Park', 'Karura Forest', 'Giraffe Centre',
  'City Park', 'Arboretum', 'Bomas of Kenya',
  // Airports / transport
  'Jomo Kenyatta International Airport', 'JKIA', 'Wilson Airport', 'SGR Terminus',
  // Stadiums / venues
  'Nyayo Stadium', 'Kasarani Stadium', 'Kenyatta University', 'University of Nairobi',
  'Strathmore University', 'USIU', 'Daystar University',
  // Roads
  'Moi Avenue', 'Kenyatta Avenue', 'Tom Mboya Street', 'Ngong Road', 'Waiyaki Way',
  'Thika Road', 'Mombasa Road', 'Langata Road', 'Argwings Kodhek Road',
  'Riverside Drive', 'Kimathi Street', 'Uhuru Highway', 'Outer Ring Road',
  // Markets
  'City Market', 'Gikomba Market', 'Maasai Market', 'Kenyatta Market', 'Toi Market',
  'Muthurwa Market', 'Kariokor Market', 'Ngara Market'
];

/** Match a location mention and classify it. Returns the most specific class. */
export function classifyLocation(name) {
  const n = String(name ?? '').trim();
  if (!n) return null;
  const eq = (a, b) => a.toLowerCase() === b.toLowerCase();

  // Most specific first: a landmark beats an area, an area beats a county.
  if (LANDMARKS.some((l) => eq(l, n))) return { kind: 'landmark', value: n };
  if (AREAS.some((a) => eq(a, n))) return { kind: 'area', value: n };
  if (COUNTIES.some((c) => eq(c, n))) return { kind: 'county', value: n };
  return null;
}

/**
 * Scan free text for every gazetteer mention, longest-first so that
 * "The Hub Karen" is preferred over a spurious "Karen" fragment. Returns a
 * de-duplicated, ordered list of { name, kind, snippet } entries — each backed
 * by the exact substring it matched.
 */
export function scanLocations(text) {
  const out = [];
  const seen = new Set();
  const terms = [...LANDMARKS, ...AREAS, ...COUNTIES]
    .sort((a, b) => b.length - a.length);

  for (const term of terms) {
    // Whole-word match, case-insensitive, but not a substring of a larger word.
    const re = new RegExp(`(^|[^A-Za-z0-9])(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^A-Za-z0-9])`, 'i');
    const m = text.match(re);
    if (!m) continue;
    const name = m[2];
    const key = `${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = classifyLocation(name);
    if (cls) out.push({ name, kind: cls.kind, snippet: m[0] });
  }
  return out;
}
