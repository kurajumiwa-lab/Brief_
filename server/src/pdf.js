// ---------------------------------------------------------------------------
// PDF EXPORT — a minimal, dependency-free writer for meeting minutes.
//
// There is no PDF library in the dependency tree (and adding one for a text
// export is overkill), so this emits a valid single-page PDF (Helvetica) by
// hand: object graph, one content stream, an xref table and a trailer. It is
// enough for a member to keep a record or attach to a dispute / SACCO
// registration. Text is sanitised to printable ASCII so the standard encoding
// renders correctly; nothing is fabricated beyond the record itself.
// ---------------------------------------------------------------------------

// Keep every glyph inside printable ASCII (the standard Helvetica encoding).
function ascii(s) {
  return String(s)
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/[^\x20-\x7e]/g, '');
}

function esc(s) {
  return ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text, maxChars) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    let line = raw;
    while (line.length > maxChars) {
      let cut = line.lastIndexOf(' ', maxChars);
      if (cut < 20) cut = maxChars;
      out.push(line.slice(0, cut).trimEnd());
      line = line.slice(cut).trimStart();
    }
    if (line.length) out.push(line);
  }
  return out;
}

/**
 * Render minutes to a PDF Buffer. `groupName` is the group; `minutes` is an
 * array of the group's minutes (title, body, heldAt, decisions, actionItems).
 */
export function minutesPdf({ groupName, minutes = [] }) {
  const ops = [];
  const text = (size, y, str) => ops.push(`BT /F1 ${size} Tf 72 ${y} Td (${esc(str)}) Tj ET`);

  text(16, 760, `${groupName || 'Circle'} — Meeting Minutes`);
  text(10, 744, `Exported ${new Date().toISOString().slice(0, 10)} · ${minutes.length} meeting(s)`);

  let y = 716;
  for (const m of minutes) {
    if (y < 100) { ops.push('ET'); break; } // stop before running off the page
    const heading = `${m.title}${m.heldAt ? ' — ' + String(m.heldAt).slice(0, 10) : ''}`;
    text(12, y, heading); y -= 18;
    for (const w of wrap(m.body, 96)) { if (y < 72) break; text(9, y, w); y -= 13; }
    if (Array.isArray(m.decisions)) for (const d of m.decisions) { if (y < 72) break; text(9, y, `- ${d}`); y -= 13; }
    if (Array.isArray(m.actionItems)) for (const a of m.actionItems) { if (y < 72) break; text(9, y, `-> ${a}`); y -= 13; }
    y -= 10;
  }
  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`;

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += xref;
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
