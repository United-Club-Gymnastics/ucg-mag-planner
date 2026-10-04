// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRoutine, scoreVault, scoreAthlete } from '../js/scoring.js';

const s = (name, letter, eg) => ({ name, letter, eg });

// Example routines from the "NAIGC Advanced (GymACT)" sheet of the MAG
// Routine Composition Planner.
const advFloor = [
  s('Front full', 'C', 4), s('Pike press', 'B', 1), s('Front tuck', 'A', 2), s('Dive roll', 'A', 2),
  s('Scale', 'A', 1), s('Round off', 'A', ''), s('Back layout', 'B', 3),
];
const advPommel = [
  s('Double scissor travel', 'C', 1), s('Back scissor', 'A', 1), s('Scissor', 'A', 1),
  s('Circle travel', 'B', 3), s('Circle', 'A', 2), s('Circle handstand', 'B', 4),
];
const advRings = [
  s('Archer butterfly', 'B', 2), s('Cross', 'C', 2), s('Kip to L', 'B', 3), s('Support swing handstand', 'B', 1),
  s('L', 'A', 2), s('Str. Fwd roll', 'B', 2), s('Dislocate', 'A', 1), s('Back full', 'B', 4),
];
const advPbars = [
  s('Front uprise', 'A', 1), s('Swing handstand', 'A', 2), s('Peach to support', 'B', 3), s('L-sit', 'A', 2),
  s('Sharpe', 'B', 2), s('Press', 'B', 2), s('Back half', 'B', 4),
];
const advHbar = [
  s('Varonin', 'B', 2), s('Kip cast handstand', 'A', 3), s('Front giant', 'A', 1), s('Pirouette', 'A', 1),
  s('Flying giant', 'B', 1), s('Back giant', 'A', 1), s('Layout flyaway', 'A', 4),
];

test('Advanced floor matches spreadsheet (12.6, 12.3 with the missing double flip)', () => {
  const r = scoreRoutine('fx', 'adv', advFloor);
  assert.equal(r.difficulty, 1.1);
  assert.equal(r.egTotal, 1.5); // I 0.5, II A 0.3, III B 0.3, IV (floor) C 0.4
  assert.equal(r.startValue, 12.6);
  assert.equal(r.deductions, 0.3);
  assert.equal(r.afterDeductions, 12.3);
  assert.equal(scoreRoutine('fx', 'adv', advFloor, { dblFlip: true }).deductions, 0);
});

test('Advanced pommel: dismount group is worth the dismount value (12.3)', () => {
  const r = scoreRoutine('ph', 'adv', advPommel);
  assert.equal(r.egTotal, 1.3);
  assert.equal(r.startValue, 12.3);
});

test('Advanced rings matches spreadsheet (12.9)', () => {
  const r = scoreRoutine('sr', 'adv', advRings, { swingHs: true });
  assert.equal(r.egTotal, 1.4);
  assert.equal(r.afterDeductions, 12.9);
});

test('Advanced p-bars and high bar match spreadsheet (12.4, 12.1)', () => {
  assert.equal(scoreRoutine('pb', 'adv', advPbars).startValue, 12.4);
  assert.equal(scoreRoutine('hb', 'adv', advHbar).startValue, 12.1);
});

test('Intermediate floor matches spreadsheet (12.8)', () => {
  const r = scoreRoutine('fx', 'int', [
    s('back layout 1/2', 'B', 3), s('front layout', 'B', 2), s('Dive roll', 'A', ''), s('Split', 'A', 1),
    s('V-sit', 'B', 1), s('standing scale 180', 'B', 1), s('roundoff', 'A', ''), s('back layout', 'B', 3),
  ]);
  assert.equal(r.difficulty, 1.3);
  assert.equal(r.egTotal, 1.5);
  assert.equal(r.startValue, 12.8);
});

test('Intermediate: A earns 0.3 and B or higher 0.5 in groups II-IV', () => {
  const r = scoreRoutine('ph', 'int', [s('a', 'A', 1), s('b', 'A', 2), s('c', 'B', 3), s('d', 'A', 4)]);
  assert.equal(r.egTotal, 1.6);
});

test('Developmental floor matches spreadsheet (11.6)', () => {
  const r = scoreRoutine('fx', 'dev', [
    s('Dive roll', 'A', 2), s('Press headstand', 'A', ''), s('L-sit', 'A', ''),
    s('Cartwheel', 'A', ''), s('Scale', 'A', 1), s('Front tuck', 'A', 2),
  ]);
  assert.equal(r.egTotal, 1.0);
  assert.equal(r.startValue, 11.6);
});

test('Developmental: only 3 groups count, 6 skills max, cap 12.3', () => {
  const r = scoreRoutine('hb', 'dev', [
    s('a', 'C', 1), s('b', 'C', 2), s('c', 'C', 3), s('d', 'C', 4), s('e', 'C', 1), s('f', 'C', 2), s('g', 'C', 3),
  ]);
  assert.equal(r.rows.length, 6);
  assert.equal(r.items[6].status, 'noncounting');
  assert.equal(r.egTotal, 1.5);
  assert.equal(r.raw, 13.3);
  assert.ok(r.capped);
  assert.equal(r.startValue, 12.3);
});

test('Intermediate cap is 13.1, applied before the short routine deduction', () => {
  const five = [s('a', 'E', 1), s('b', 'E', 2), s('c', 'E', 3), s('d', 'E', 4), s('e', 'E', 1)];
  const r = scoreRoutine('pb', 'int', five);
  assert.equal(r.raw, 14.5);
  assert.equal(r.startValue, 12.1); // 13.1 cap - 1.0 short
});

test('short routine: Developmental loses 0.5 per skill, others 1.0', () => {
  const four = [s('a', 'A', 1), s('b', 'A', 2), s('c', 'A', 3), s('d', 'A', 4)];
  assert.equal(scoreRoutine('pb', 'dev', four).shortDeduction, 1.0);
  assert.equal(scoreRoutine('pb', 'int', four).shortDeduction, 2.0);
});

test('at most 4 counting skills per element group', () => {
  const r = scoreRoutine('sr', 'adv', [
    s('a', 'C', 2), s('b', 'C', 2), s('c', 'C', 2), s('d', 'C', 2), s('e', 'B', 2), s('f', 'A', 1),
  ]);
  assert.equal(r.items[4].status, 'noncounting');
  assert.equal(r.items[4].reason, 'eg');
  assert.equal(r.difficulty, 1.3);
});

test('repeats do not count', () => {
  const r = scoreRoutine('hb', 'int', [s('Back giant', 'A', 1), s('back-giant', 'A', 1)]);
  assert.equal(r.items[1].status, 'repeat');
  assert.equal(r.difficulty, 0.1);
});

test('bonuses: rings strength +0.3, floor connections, Advanced stick by dismount value', () => {
  assert.equal(scoreRoutine('sr', 'int', advRings, { strength: true }).bonus, 0.3);
  assert.equal(scoreRoutine('fx', 'int', advFloor, { conn1: 2, conn2: 1 }).bonus, 0.4);
  assert.equal(scoreRoutine('pb', 'adv', advPbars, { stick: true }).bonus, 0.1); // B dismount
  assert.equal(scoreRoutine('hb', 'adv', advHbar, { stick: true }).bonus, 0); // A dismount
  assert.equal(scoreRoutine('hb', 'int', advHbar, { stick: true }).bonus, 0.1);
});

test('mushroom bonus counts toward the Developmental cap', () => {
  const r = scoreRoutine('ph', 'dev', advPommel, { mushroom: 1.0 });
  assert.equal(r.bonus, 1.0);
  assert.equal(r.startValue, 12.3);
});

test('vault: Advanced uses its own values; Developmental bans flipping vaults', () => {
  assert.equal(scoreVault('adv', '202').startValue, 11.4);
  assert.equal(scoreVault('adv', '105').startValue, 13.6);
  assert.equal(scoreVault('int', '105').startValue, 12.8);
  assert.equal(scoreVault('int', '105', { stick: true }).startValue, 13.0);
  assert.equal(scoreVault('int', '202', { stick: true }).startValue, 11.5);
  assert.equal(scoreVault('adv', '202', { stick: true }).startValue, 11.4);
  assert.equal(scoreVault('dev', '105').startValue, 0);
  assert.ok(scoreVault('dev', '105').banned);
  assert.equal(scoreVault('int', '225').startValue, 13.1); // capped
});

test('all-around adds vault and the five events', () => {
  const aa = scoreAthlete({
    level: 'adv',
    vault: '202',
    routines: { fx: advFloor, ph: advPommel, sr: advRings, pb: advPbars, hb: advHbar },
  }).allAround;
  assert.equal(aa, 73.7); // the spreadsheet's 73.4 also takes off the floor neutral deduction
});

test('blank rows are ignored; empty routine scores 0', () => {
  assert.equal(scoreRoutine('fx', 'int', [s('', '', '')]).startValue, 0);
});
