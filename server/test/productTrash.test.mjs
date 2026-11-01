import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPurgeCountdown, isProductTrashed } from '../../admin/js/productTrash.mjs';

test('trash countdown rounds partial days up and clamps expired products to today', () => {
  const now = new Date('2026-11-01T10:00:00Z');

  assert.equal(formatPurgeCountdown('2026-11-03 09:00:00', now), '2 days remaining');
  assert.equal(formatPurgeCountdown('2026-11-02 09:00:00', now), '1 day remaining');
  assert.equal(formatPurgeCountdown('2026-11-01 09:00:00', now), 'Deletes today');
  assert.equal(formatPurgeCountdown(null, now), 'Pending deletion');
});

test('only deleted archived products receive trash actions', () => {
  assert.equal(isProductTrashed({ status: 'archived', deletedAt: '2026-10-01 00:00:00' }), true);
  assert.equal(isProductTrashed({ status: 'draft', deletedAt: null }), false);
  assert.equal(isProductTrashed({ status: 'published', deletedAt: null }), false);
});
