// UCG MAG start value rules (2026-2028), from the UCG MAG Rules breakdown and
// rules policy, the MAG start value worksheets, and the MAG Routine
// Composition Planner spreadsheet.
import { VAULTS } from './vaults.js';

export const EXECUTION = 10;
export const MIN_SKILLS = 6;
export const MAX_ROUTINE = 20; // skills a routine list can hold (counting + non-counting)
export const MAX_PER_EG = 4; // WG: at most 4 counting skills from one element group

// Sub-A skills (UCG CoP) are recognised skills worth 0.0, with no EG.
export const LETTER_VALUES = { 'Sub-A': 0, A: 0.1, B: 0.2, C: 0.3, D: 0.4, E: 0.5, F: 0.6, G: 0.7, H: 0.8, I: 0.9, J: 1.0 };
export const LETTERS = Object.keys(LETTER_VALUES);
export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

export const LEVELS = {
  dev: {
    label: 'Developmental',
    maxSkills: 6,
    shortDeduction: 0.5,
    cap: 12.3,
  },
  int: {
    label: 'Intermediate',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: 13.1,
  },
  adv: {
    label: 'Advanced (GymACT)',
    maxSkills: 8,
    shortDeduction: 1.0,
    cap: null,
  },
};
export const LEVEL_IDS = Object.keys(LEVELS);

export const EVENTS = ['fx', 'ph', 'sr', 'pb', 'hb']; // vault is scored separately
export const ALL_EVENTS = ['fx', 'ph', 'sr', 'vt', 'pb', 'hb']; // Olympic order

export const APPARATUS = {
  fx: {
    label: 'Floor Exercise',
    short: 'Floor',
    groups: {
      1: 'Non acrobatic elements',
      2: 'Forward acrobatic elements',
      3: 'Backward acrobatic elements',
      4: 'Single saltos with at least one twist',
    },
  },
  ph: {
    label: 'Pommel Horse',
    short: 'Pommel',
    groups: {
      1: 'Single leg swings and scissors',
      2: 'Circles, kehrs, russians, and flops',
      3: 'Travels',
      4: 'Dismounts',
    },
  },
  sr: {
    label: 'Still Rings',
    short: 'Rings',
    groups: { 1: 'Kips and swings', 2: 'Strength', 3: 'Swing to strength', 4: 'Dismounts' },
  },
  vt: { label: 'Vault', short: 'Vault' },
  pb: {
    label: 'Parallel Bars',
    short: 'P-Bars',
    groups: { 1: 'Upper arm', 2: 'Support', 3: 'Basket and long hang swings', 4: 'Dismounts' },
  },
  hb: {
    label: 'High Bar',
    short: 'High Bar',
    groups: { 1: 'Long hang', 2: 'Flight', 3: 'In bar', 4: 'Dismounts' },
  },
};

// Bonus and requirement options for each event and level. `kind`:
//   check    one-time bonus when ticked (value) or, for `deduction`, a
//            requirement whose absence costs the value
//   count    number of times a bonus is earned (value each, max `max`)
//   mushroom Pommel Horse mushroom bonus, 0.0-1.0
// Stick bonuses aren't here: they depend on the live routine, not the plan.
export function eventOptions(event, level) {
  const o = [];
  if (event === 'fx') {
    o.push({ id: 'conn1', kind: 'count', value: 0.1, max: 5, label: 'D or higher + B/C connection', help: '+0.1 each' });
    o.push({ id: 'conn2', kind: 'count', value: 0.2, max: 5, label: 'D or higher + D or higher connection', help: '+0.2 each' });
    if (level === 'adv') {
      o.push({ id: 'dblDismount', kind: 'check', value: 0.1, label: 'Double flipping dismount', help: '+0.1' });
      o.push({ id: 'dblFlip', kind: 'check', value: 0.3, deduction: true, label: 'Routine includes a double flip', help: 'Required: -0.3 neutral deduction if missing' });
    }
  }
  if (event === 'ph' && level === 'dev') {
    o.push({ id: 'mushroom', kind: 'mushroom', label: 'Mushroom bonus', help: '+0.1 per circle, +0.2 per other skill; top 5 count, max +1.0' });
  }
  if (event === 'sr') {
    o.push({ id: 'strength', kind: 'check', value: 0.3, label: 'C or higher strength skill', help: 'One-time +0.3' });
    if (level === 'adv') {
      o.push({ id: 'swingHs', kind: 'check', value: 0.3, deduction: true, label: 'Routine includes a swing to handstand', help: 'Required: -0.3 neutral deduction if missing' });
    }
  }
  if (event === 'hb') {
    o.push({ id: 'connCC', kind: 'count', value: 0.1, max: 5, label: 'C + C connection', help: 'Flight to flight, or in bar to flight / flight to in bar with no intermediate swing: +0.1 each' });
  }
  return o;
}

// Avoid floating point noise (0.1 + 0.2 etc.).
export const round1 = (n) => Math.round(n * 10) / 10;
export const fmt = (n) => Number(n || 0).toFixed(1);

export function letterValue(letter) {
  const l = String(letter || '');
  return LETTER_VALUES[l] ?? LETTER_VALUES[l.toUpperCase()] ?? 0;
}

const isFilled = (s) => !!(s && (String(s.name || '').trim() || s.letter));
export const SR_MAX_STATIC = 3; // WG rings: EG II/III skills before a B or higher EG I skill

// "Back giant", "backgiant" and "Back-Giant" are the same skill.
export const skillKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Element group bonus for one group, from the highest-value counting skill in it.
function groupBonus(level, event, eg, value) {
  if (level === 'dev') return 0.5;
  if (eg === 1) return 0.5;
  if (level === 'int') return value >= 0.2 ? 0.5 : 0.3;
  // Advanced: the dismount group is worth the dismount's value (max 0.5),
  // except on floor, which has no dismount group.
  if (eg === 4 && event !== 'fx') return Math.min(value, 0.5);
  return value >= 0.4 ? 0.5 : value >= 0.3 ? 0.4 : 0.3;
}

/**
 * Score one routine (floor, pommel, rings, p-bars or high bar).
 * skills: the whole routine in order, [{ name, letter, eg }] (blank rows allowed).
 *   - Each skill counts once: a later skill with the same name (ignoring case,
 *     spaces and punctuation) is a repeat and doesn't count.
 *   - Rings (WG rule): only the first 3 EG II/III skills count until a B or
 *     higher EG I skill is performed (reason 'sr').
 *   - The level's highest-value skills count (6 Developmental, 8 otherwise),
 *     at most 4 from one element group. Ties: the earlier skill wins.
 * options: { [optionId]: true | number } for the event's bonus options.
 *
 * Returns:
 *   items   one entry per input row with status 'blank' | 'counting' |
 *           'noncounting' | 'repeat' (repeatOf) and, for non-counting skills,
 *           reason 'top' | 'eg' (over the 4-per-group limit) | 'sr'
 *   rows    counting skills in routine order
 *   and totals.
 */
export function scoreRoutine(event, level, skills = [], options = {}) {
  const L = LEVELS[level] || LEVELS.int;
  const items = skills.map((s, idx) => ({
    idx,
    name: String(s?.name || '').trim(),
    letter: s?.letter || '',
    value: letterValue(s?.letter),
    eg: s?.eg ? Number(s.eg) : null,
    bonus: 0,
    status: isFilled(s) ? null : 'blank',
  }));

  const firstSeen = new Map();
  for (const it of items) {
    if (it.status) continue;
    const key = skillKey(it.name);
    if (key && firstSeen.has(key)) {
      it.status = 'repeat';
      it.repeatOf = firstSeen.get(key);
    } else if (key) firstSeen.set(key, it.idx);
  }

  if (event === 'sr') {
    let statics = 0;
    for (const it of items) {
      if (it.status) continue;
      if (it.eg === 1 && it.value >= 0.2) break;
      if (it.eg === 2 || it.eg === 3) {
        statics++;
        if (statics > SR_MAX_STATIC) {
          it.status = 'noncounting';
          it.reason = 'sr';
        }
      }
    }
  }

  const perGroup = {};
  let counted = 0;
  const candidates = items.filter((it) => !it.status);
  for (const it of [...candidates].sort((a, b) => b.value - a.value || a.idx - b.idx)) {
    if (it.eg && (perGroup[it.eg] || 0) >= MAX_PER_EG) {
      it.status = 'noncounting';
      it.reason = 'eg';
    } else if (counted >= L.maxSkills) {
      it.status = 'noncounting';
      it.reason = 'top';
    } else {
      it.status = 'counting';
      counted++;
      if (it.eg) perGroup[it.eg] = (perGroup[it.eg] || 0) + 1;
    }
  }

  const rows = items.filter((it) => it.status === 'counting');

  // Each element group's bonus goes to its highest-value counting skill
  // (the earliest one on a tie).
  const egBonus = {};
  for (const g of [1, 2, 3, 4]) {
    const best = rows
      .filter((r) => r.eg === g && r.letter)
      .sort((a, b) => b.value - a.value || a.idx - b.idx)[0];
    if (!best) continue;
    best.bonus = groupBonus(level, event, g, best.value);
    egBonus[g] = best.bonus;
  }
  let egTotal = Object.values(egBonus).reduce((t, b) => t + b, 0);
  if (level === 'dev') egTotal = Math.min(egTotal, 1.5); // only 3 groups count
  egTotal = round1(egTotal);

  const difficulty = round1(rows.reduce((t, r) => t + r.value, 0));

  let bonus = 0;
  let deductions = 0;
  const optionValues = {};
  for (const o of eventOptions(event, level)) {
    const v = options?.[o.id];
    let got = 0;
    if (o.kind === 'check' && o.deduction) {
      if (!v) deductions += o.value;
      continue;
    }
    if (o.kind === 'check' && v) got = o.value;
    if (o.kind === 'count') got = Math.min(Math.max(0, Number(v) || 0), o.max) * o.value;
    if (o.kind === 'mushroom') got = Math.min(Math.max(0, Number(v) || 0), 1);
    optionValues[o.id] = round1(got);
    bonus += got;
  }
  bonus = round1(bonus);
  deductions = round1(deductions);

  const shortBy = Math.max(0, MIN_SKILLS - rows.length);
  const shortDeduction = round1(shortBy * L.shortDeduction);
  const raw = round1(EXECUTION + difficulty + egTotal + bonus);
  const capped = L.cap != null && raw > L.cap;
  const startValue = rows.length ? round1((capped ? L.cap : raw) - shortDeduction) : 0;

  return {
    items,
    rows,
    difficulty,
    egBonus,
    egTotal,
    bonus,
    optionValues,
    shortBy,
    shortDeduction,
    raw,
    capped,
    cap: L.cap,
    startValue,
    deductions: rows.length ? deductions : 0,
    afterDeductions: rows.length ? round1(startValue - deductions) : 0,
  };
}

export function findVault(id) {
  return VAULTS.find((v) => v.id === String(id)) ?? null;
}

export function scoreVault(level, id) {
  const v = findVault(id);
  if (!v) return null;
  const L = LEVELS[level] || LEVELS.int;
  const dv = level === 'adv' ? v.adv : v.value;
  if (level === 'dev' && v.flipping) {
    return { ...v, dv, banned: true, capped: false, startValue: 0 };
  }
  const raw = round1(EXECUTION + dv);
  const capped = L.cap != null && raw > L.cap;
  return { ...v, dv, banned: false, raw, capped, startValue: capped ? L.cap : raw };
}

export function scoreAthlete(athlete) {
  const level = LEVELS[athlete.level] ? athlete.level : 'int';
  const vault = scoreVault(level, athlete.vault);
  const events = Object.fromEntries(
    EVENTS.map((e) => [e, scoreRoutine(e, level, athlete.routines?.[e] || [], athlete.options?.[e] || {})])
  );
  const allAround = round1((vault?.startValue || 0) + EVENTS.reduce((t, e) => t + events[e].startValue, 0));
  return { level, vault, events, allAround };
}
