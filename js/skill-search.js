// Skill search for the routine editor: UCG CoP and WG skills for an apparatus,
// filtered by what's typed. WG names use CoP shorthand ("Salto bwd. str. w. 1/1 t."),
// so common words are mapped onto it: "back layout full" finds that skill.
import { SKILLS } from './skills.js';

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4' };
const ALIASES = {
  back: 'bwd', backward: 'bwd', backwards: 'bwd', bwd: 'bwd', bw: 'bwd',
  front: 'fwd', forward: 'fwd', forwards: 'fwd', fwd: 'fwd', fw: 'fwd',
  layout: 'str', stretched: 'str', straight: 'str', str: 'str',
  handstand: 'hdst', hdst: 'hdst', hs: 'hdst', hstd: 'hdst',
  double: 'dbl', dbl: 'dbl',
  full: '1/1', half: '1/2',
  twist: 'turn', twists: 'turn', turns: 'turn', turn: 'turn', t: 'turn',
  tucked: 'tuck', tuck: 'tuck', piked: 'pike', pike: 'pike',
  straddled: 'straddle', straddle: 'straddle', strad: 'straddle',
};

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[½¼¾]/g, (c) => FRACTIONS[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Stöckli -> stockli
    .split(/[^a-z0-9/]+/)
    .filter(Boolean)
    .map((w) => ALIASES[w] || w);
}

export const skillLabel = (s) => (s.eponym ? `${s.name} (${s.eponym})` : s.name);

const byApp = {};
for (const s of SKILLS) {
  s.label = skillLabel(s);
  s.tokens = tokens(`${s.label} ${s.note}`);
  (byApp[s.app] ||= []).push(s);
}

const VALUE_ORDER = ['Sub-A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const order = (a, b) =>
  (a.eg || 0) - (b.eg || 0) ||
  VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) ||
  (a.src === b.src ? 0 : a.src === 'UCG' ? -1 : 1);

export function findSkill(id) {
  return id ? SKILLS.find((s) => s.id === id) || null : null;
}

// Skills for an apparatus matching every typed word (as a word start).
// With nothing typed: the whole list by element group (no EG first), value,
// then UCG before WG. While searching: closest matches (fewest extra words) first.
export function searchSkills(app, query) {
  const q = tokens(query);
  const list = (byApp[app] || []).filter((s) => q.every((w) => s.tokens.some((t) => t.startsWith(w))));
  return list.sort(q.length ? (a, b) => a.tokens.length - b.tokens.length || order(a, b) : order);
}
