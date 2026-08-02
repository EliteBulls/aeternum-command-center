'use strict';
// Stale Status Guard — shared by index.html (browser) and tests (Node.js).
// Change the threshold here; both consumers pick it up automatically.

const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000; // 26 hours — covers daily cron + Actions delay
const FUTURE_GRACE_MS    =  5 * 60 * 1000;        // 5 minutes — clock-skew grace

/**
 * Returns { stale: boolean, reason: string }.
 * Fails closed on: missing, invalid, future (>5 min), or stale (>=26 h).
 *
 * @param {string|null|undefined} updatedAt  ISO-8601 timestamp string from status.json
 * @param {number}                nowMs      reference time (Date.now())
 */
function checkStaleness(updatedAt, nowMs) {
  if (!updatedAt || typeof updatedAt !== 'string' || !updatedAt.trim())
    return { stale: true, reason: 'missing' };
  const ts = Date.parse(updatedAt);
  if (!isFinite(ts)) return { stale: true, reason: 'invalid' };
  const diff = nowMs - ts;
  if (diff < -FUTURE_GRACE_MS)    return { stale: true,  reason: 'future' };
  if (diff >= STALE_THRESHOLD_MS) return { stale: true,  reason: 'stale'  };
  return { stale: false, reason: 'fresh' };
}

// CommonJS export for Node.js (tests). Browser ignores this block.
if (typeof module !== 'undefined') {
  module.exports = { checkStaleness, STALE_THRESHOLD_MS, FUTURE_GRACE_MS };
}
