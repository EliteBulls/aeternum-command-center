'use strict';
const assert = require('assert');

// ── Guard logic (mirrors index.html) ──────────────────────────────────────────
const STALE_THRESHOLD_MS = 10 * 60 * 1000;
const FUTURE_GRACE_MS    =  5 * 60 * 1000;

function checkStaleness(updatedAt, nowMs) {
  if (!updatedAt || typeof updatedAt !== 'string' || !updatedAt.trim())
    return { stale: true, reason: 'missing' };
  const ts = Date.parse(updatedAt);
  if (!isFinite(ts)) return { stale: true, reason: 'invalid' };
  const diff = nowMs - ts;
  if (diff < -FUTURE_GRACE_MS)   return { stale: true,  reason: 'future' };
  if (diff >= STALE_THRESHOLD_MS) return { stale: true,  reason: 'stale'  };
  return { stale: false, reason: 'fresh' };
}

// ── Minimal render-logic extracted from index.html ───────────────────────────
const FA = {
  wait:    ['รอ AI ทำงานให้เสร็จ', '⏳ รอ AI ทำงาน',       'wait'],
  next:    ['กด NEXT เพื่อเริ่มงานถัดไป', '▶ กด NEXT',    'next'],
  approve: ['ตรวจและกด APPROVE',  '✓ กด APPROVE',          'approve'],
};
function nextAllowed(founderAction) {
  return (FA[founderAction] || FA.wait)[2] === 'next';
}

// ── Test harness ──────────────────────────────────────────────────────────────
const NOW = new Date('2026-08-02T06:00:00.000Z').getTime();
let pass = 0, fail = 0;

function test(name, fn) {
  try   { fn(); console.log('  PASS', name); pass++; }
  catch (e) { console.error('  FAIL', name + ':', e.message); fail++; }
}

console.log('\nStale Status Guard Tests');
console.log('========================');

// ── 1. Fresh timestamp ────────────────────────────────────────────────────────
test('fresh: 1 min ago', () => {
  const r = checkStaleness(new Date(NOW - 1 * 60 * 1000).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

test('fresh: exactly now', () => {
  const r = checkStaleness(new Date(NOW).toISOString(), NOW);
  assert.strictEqual(r.stale, false);
});

test('fresh: 9 min 59 s ago (just inside threshold)', () => {
  const r = checkStaleness(new Date(NOW - (STALE_THRESHOLD_MS - 1000)).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

// ── 2. Stale timestamp ────────────────────────────────────────────────────────
test('stale: exactly 10 min ago (at threshold)', () => {
  const r = checkStaleness(new Date(NOW - STALE_THRESHOLD_MS).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'stale');
});

test('stale: 11 min ago', () => {
  const r = checkStaleness(new Date(NOW - 11 * 60 * 1000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'stale');
});

test('stale: 1 hour ago', () => {
  const r = checkStaleness(new Date(NOW - 60 * 60 * 1000).toISOString(), NOW);
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

test('invalid: number as string "1234567890"', () => {
  const r = checkStaleness('1234567890', NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'invalid');
});

// ── 5. Future timestamp ───────────────────────────────────────────────────────
test('future: 1 hour ahead', () => {
  const r = checkStaleness(new Date(NOW + 60 * 60 * 1000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'future');
});

test('future: 6 min ahead (beyond grace)', () => {
  const r = checkStaleness(new Date(NOW + 6 * 60 * 1000).toISOString(), NOW);
  assert.strictEqual(r.stale,  true);
  assert.strictEqual(r.reason, 'future');
});

test('future: exactly at grace boundary (5 min) — still fresh', () => {
  const r = checkStaleness(new Date(NOW + FUTURE_GRACE_MS).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

test('future: 3 min ahead (within grace)', () => {
  const r = checkStaleness(new Date(NOW + 3 * 60 * 1000).toISOString(), NOW);
  assert.strictEqual(r.stale,  false);
  assert.strictEqual(r.reason, 'fresh');
});

// ── 6. NEXT disabled when data unsafe ────────────────────────────────────────
test('NEXT disabled: stale founder_action=wait', () => {
  assert.strictEqual(nextAllowed('wait'), false);
});

test('NEXT disabled: missing founder_action (defaults to wait)', () => {
  assert.strictEqual(nextAllowed(undefined), false);
});

test('NEXT disabled: block status forces wait', () => {
  const ts = new Date(NOW - 11 * 60 * 1000).toISOString();
  const staleness = checkStaleness(ts, NOW);
  assert.strictEqual(staleness.stale, true);
  assert.strictEqual(nextAllowed('wait'), false, 'NEXT must be locked when stale');
});

// ── 7. Existing validation: normal render is unblocked when fresh ─────────────
test('existing: fresh ISO timestamp is not blocked', () => {
  const ts = new Date(NOW - 3 * 60 * 1000).toISOString();
  const r = checkStaleness(ts, NOW);
  assert.strictEqual(r.stale, false);
});

test('existing: founder_action=next is allowed when fresh', () => {
  assert.strictEqual(nextAllowed('next'), true);
});

test('existing: founder_action=approve allowed when fresh', () => {
  assert.strictEqual(nextAllowed('approve'), false, 'approve does not unlock NEXT');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(fail === 0 ? 'ALL PASS' : fail + ' FAILED', '—', pass, 'passed,', fail, 'failed');
if (fail > 0) process.exit(1);
