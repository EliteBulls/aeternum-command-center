'use strict';
// Import the real implementation — no duplication; threshold changes here automatically.
const { checkStaleness, STALE_THRESHOLD_MS, FUTURE_GRACE_MS } = require('../js/stale-guard.js');

const assert = require('assert');

// ── Render-logic mirror (founder-action → NEXT-allowed) ──────────────────────
const FA = {
  wait:    ['รอ AI ทำงานให้เสร็จ', '⏳ รอ AI ทำงาน',    'wait'],
  next:    ['กด NEXT เพื่อเริ่มงานถัดไป', '▶ กด NEXT', 'next'],
  approve: ['ตรวจและกด APPROVE',  '✓ กด APPROVE',       'approve'],
};
function nextAllowed(founderAction) {
  return (FA[founderAction] || FA.wait)[2] === 'next';
}

// ── Harness ───────────────────────────────────────────────────────────────────
const NOW = new Date('2026-08-02T06:00:00.000Z').getTime();
let pass = 0, fail = 0;

function test(name, fn) {
  try   { fn(); console.log('  PASS', name); pass++; }
  catch (e) { console.error('  FAIL', name + ':', e.message); fail++; }
}

console.log('\nStale Status Guard Tests  (threshold =', STALE_THRESHOLD_MS / 3600000, 'h)');
console.log('='.repeat(60));

// ── 1. Fresh timestamp ────────────────────────────────────────────────────────
test('fresh: exactly now', () => {
  const r = checkStaleness(new Date(NOW).toISOString(), NOW);
  assert.strictEqual(r.stale, false);
  assert.strictEqual(r.reason, 'fresh');
});

test('fresh: 1 min ago', () => {
  const r = checkStaleness(new Date(NOW - 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale, false);
});

test('fresh: 1 hour ago', () => {
  const r = checkStaleness(new Date(NOW - 60 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale, false);
});

test('fresh: 12 hours ago', () => {
  const r = checkStaleness(new Date(NOW - 12 * 60 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale, false);
});

test('fresh: 1 ms before threshold (just under 26 h)', () => {
  const r = checkStaleness(new Date(NOW - (STALE_THRESHOLD_MS - 1)).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

// ── 2. Stale timestamp ────────────────────────────────────────────────────────
test('stale: exactly 26 hours ago (at threshold boundary)', () => {
  const r = checkStaleness(new Date(NOW - STALE_THRESHOLD_MS).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'stale');
});

test('stale: 27 hours ago (beyond threshold)', () => {
  const r = checkStaleness(new Date(NOW - 27 * 60 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'stale');
});

test('stale: 48 hours ago', () => {
  const r = checkStaleness(new Date(NOW - 48 * 60 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'stale');
});

// ── 3. Missing timestamp ──────────────────────────────────────────────────────
test('missing: null', () => {
  const r = checkStaleness(null, NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'missing');
});

test('missing: empty string', () => {
  const r = checkStaleness('', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'missing');
});

test('missing: whitespace only', () => {
  const r = checkStaleness('   ', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'missing');
});

test('missing: undefined', () => {
  const r = checkStaleness(undefined, NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'missing');
});

// ── 4. Invalid timestamp ──────────────────────────────────────────────────────
test('invalid: Thai locale string "30 ก.ค. 2569"', () => {
  const r = checkStaleness('30 ก.ค. 2569', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'invalid');
});

test('invalid: garbage string', () => {
  const r = checkStaleness('not-a-date', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'invalid');
});

test('invalid: bare number string', () => {
  const r = checkStaleness('1234567890', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'invalid');
});

// ── 5. Future timestamp ───────────────────────────────────────────────────────
test('future: 1 hour ahead', () => {
  const r = checkStaleness(new Date(NOW + 60 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'future');
});

test('future: 6 min ahead (beyond 5 min grace)', () => {
  const r = checkStaleness(new Date(NOW + 6 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'future');
});

test('future: exactly at grace boundary (5 min) — treated as fresh', () => {
  const r = checkStaleness(new Date(NOW + FUTURE_GRACE_MS).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

test('future: 3 min ahead (within grace)', () => {
  const r = checkStaleness(new Date(NOW + 3 * 60_000).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

// ── 6. NEXT disabled when data unsafe ────────────────────────────────────────
test('NEXT disabled: founder_action=wait', () => {
  assert.strictEqual(nextAllowed('wait'), false);
});

test('NEXT disabled: undefined founder_action defaults to wait', () => {
  assert.strictEqual(nextAllowed(undefined), false);
});

test('NEXT disabled: stale data forces founder_action=wait', () => {
  const ts = new Date(NOW - STALE_THRESHOLD_MS).toISOString();
  const { stale } = checkStaleness(ts, NOW);
  assert.strictEqual(stale, true);
  assert.strictEqual(nextAllowed('wait'), false, 'NEXT must be locked when stale');
});

// ── 7. Existing validation: normal render unblocked when fresh ────────────────
test('existing: fresh ISO timestamp is not blocked', () => {
  const ts = new Date(NOW - 3 * 60_000).toISOString();
  assert.strictEqual(checkStaleness(ts, NOW).stale, false);
});

test('existing: founder_action=next allowed when fresh', () => {
  assert.strictEqual(nextAllowed('next'), true);
});

test('existing: founder_action=approve does not unlock NEXT', () => {
  assert.strictEqual(nextAllowed('approve'), false);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(fail === 0 ? 'ALL PASS' : fail + ' FAILED', '—', pass, 'passed,', fail, 'failed');
if (fail > 0) process.exit(1);
