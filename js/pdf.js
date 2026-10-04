// Fills in the official UCG MAG Start Value Worksheets (assets/worksheets/,
// one per level, copied from the printouts gymnasts fill in by hand) with one
// page per event. The worksheets aren't fillable forms, so the answers are
// written at fixed positions, measured from each worksheet in PDF points
// (origin at the top left, as the measurements were taken; flipped below).
import { PDFDocument, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js';
import { APPARATUS, EVENTS, LEVELS, eventOptions, scoreAthlete, fmt } from './scoring.js';

const PAGE_H = 792;
const INK = rgb(0.094, 0.294, 0.337); // UCG dark blue green #184B56, reads as "filled in"

// Table columns: [left, right] of Name, Difficulty, Value, Element Group, Connections.
// Rows: top of the first row and row height. Lines: the "N.______" blanks
// (x where the underline starts, y of the underline).
const LAYOUTS = {
  dev: {
    url: 'assets/worksheets/dev.pdf',
    name: { x: 157, y: 83 },
    event: { x: 385, y: 83 },
    cols: [[75.5, 296.5], [296.5, 355.5], [355.5, 410.5], [410.5, 470.5], [470.5, 542.5]],
    rowTop: 242.5,
    rowH: 24.7,
    lines: { x: 516, ys: [426.5, 482.7, 538.2, 579.4] },
    // 1: skills + bonuses, 2: EG, 3: 10 - short, 4: start value
    fill: ['skillsAndBonus', 'eg', 'base', 'sv'],
  },
  int: {
    url: 'assets/worksheets/int.pdf',
    name: { x: 157, y: 83 },
    event: { x: 385, y: 83 },
    cols: [[75.5, 296.5], [296.5, 355.5], [355.5, 410.5], [410.5, 470.5], [470.5, 555.5]],
    rowTop: 228.5,
    rowH: 24.75,
    lines: { x: 512, ys: [476, 532.2, 588.5, 644, 685.3] },
    fill: ['skills', 'eg', 'bonus', 'base', 'sv'],
  },
  adv: {
    url: 'assets/worksheets/adv.pdf',
    name: { x: 139, y: 75.5 },
    event: { x: 367, y: 75.5 },
    cols: [[57.5, 265.5], [265.5, 323.5], [323.5, 382.5], [382.5, 471.5], [471.5, 540.5]],
    rowTop: 191.5,
    rowH: 24.75,
    lines: { x: 494, ys: [434.8, 553.3, 604.3, 641, 667.3] },
    fill: ['skills', 'eg', 'bonus', 'base', 'sv'],
    // Expected deductions, listed under the worksheet: where to mark them.
    deductions: { fx: { x: 282, y: 701.8 }, sr: { x: 309, y: 715.3 } },
  },
};

// Standard PDF fonts only cover WinAnsi; swap anything else for a close match.
function safeText(font, text) {
  const s = String(text ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-');
  return [...s]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

function writer(page, fonts) {
  // x, y measured from the top left; y is the text baseline.
  const text = (s, x, y, { size = 10, font = fonts.regular, maxWidth } = {}) => {
    let t = safeText(font, s);
    if (maxWidth) {
      while (size > 6 && font.widthOfTextAtSize(t, size) > maxWidth) size -= 0.5;
      while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
    }
    page.drawText(t, { x, y: PAGE_H - y, size, font, color: INK });
  };
  const center = (s, cx, y, opts = {}) => {
    const font = opts.font || fonts.regular;
    const size = opts.size || 10;
    const t = safeText(font, s);
    text(t, cx - font.widthOfTextAtSize(t, size) / 2, y, opts);
  };
  return { text, center };
}

async function loadTemplate(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the worksheet (${url})`);
  return PDFDocument.load(await res.arrayBuffer());
}

function fillPage(page, fonts, level, athlete, event, r) {
  const L = LAYOUTS[level];
  const w = writer(page, fonts);
  w.text(athlete.name, L.name.x, L.name.y - 1, { size: 11, font: fonts.bold, maxWidth: 180 });
  w.text(APPARATUS[event].label, L.event.x, L.event.y - 1, { size: 11, font: fonts.bold, maxWidth: 140 });

  r.rows.forEach((row, i) => {
    const y = L.rowTop + i * L.rowH + L.rowH / 2 + 3.5;
    const [name, diff, value, eg] = L.cols;
    w.text(row.name, name[0] + 20, y, { size: 10, maxWidth: name[1] - name[0] - 26 });
    w.center(row.letter, (diff[0] + diff[1]) / 2, y);
    if (row.letter) w.center(fmt(row.value), (value[0] + value[1]) / 2, y);
    if (row.eg) w.center(String(row.eg), (eg[0] + eg[1]) / 2, y);
  });

  const values = {
    skills: fmt(r.difficulty),
    skillsAndBonus: fmt(r.difficulty + r.bonus),
    eg: fmt(r.egTotal),
    bonus: fmt(r.bonus),
    base: fmt(10 - r.shortDeduction),
    sv: fmt(r.startValue),
  };
  L.fill.forEach((key, i) => {
    w.text(values[key], L.lines.x, L.lines.ys[i] - 3, { size: 11, font: key === 'sv' ? fonts.bold : fonts.regular });
  });

  const mark = L.deductions?.[event];
  if (mark && r.deductions) w.text(`<-- applies to this routine (-${fmt(r.deductions)})`, mark.x, mark.y, { size: 9, font: fonts.bold });

  // Anything the blanks don't show goes in the empty space at the bottom.
  const bonuses = eventOptions(event, level)
    .filter((o) => r.optionValues[o.id])
    .map((o) => `${o.label} +${fmt(r.optionValues[o.id])}`);
  const notes = [];
  if (bonuses.length) notes.push(`Bonuses${L.fill.includes('skillsAndBonus') ? ' (included in line 1)' : ''}: ${bonuses.join(', ')}.`);
  if (r.capped) notes.push(`Start value capped at ${fmt(r.cap)} (${fmt(r.raw)} before the cap).`);
  notes.forEach((n, i) => w.text(n, L.cols[0][0], 740 + i * 13, { size: 9, maxWidth: 480 }));
}

export async function exportAthletePdf(athlete, events = EVENTS) {
  const score = scoreAthlete(athlete);
  const L = LAYOUTS[score.level];
  const template = await loadTemplate(L.url);
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  for (const e of events) {
    const [page] = await doc.copyPages(template, [0]);
    doc.addPage(page);
    fillPage(page, fonts, score.level, athlete, e, score.events[e]);
  }
  doc.setTitle(`${athlete.name || 'Athlete'} - UCG MAG ${LEVELS[score.level].label} Start Values`);
  return doc.save();
}

export function downloadPdf(bytes, athlete, events = EVENTS) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = events.length === 1 ? ` ${APPARATUS[events[0]].short}` : '';
  a.download = `${(athlete.name || 'Athlete').trim()} SV Sheet${suffix}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
