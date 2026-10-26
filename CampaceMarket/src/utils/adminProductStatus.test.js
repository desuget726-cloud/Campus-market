import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminProductStatusCounts,
  matchesAdminProductStatusFilter,
} from './adminProductStatus.js';

const products = [
  { status: 'Approved' },
  { status: 'active' },
  { status: 'available' },
  { status: 'Sold' },
  { status: 'Pending' },
  { status: 'Flagged' },
  { status: 'Paused' },
];

test('counts total, available, sold, pending, and flagged products case-insensitively', () => {
  assert.deepEqual(getAdminProductStatusCounts(products), {
    total: 7,
    available: 3,
    sold: 1,
    pending: 1,
    flagged: 1,
  });
});

test('filters available, sold, pending, and flagged products', () => {
  assert.equal(products.filter((product) => matchesAdminProductStatusFilter(product, 'available')).length, 3);
  assert.deepEqual(
    products.filter((product) => matchesAdminProductStatusFilter(product, 'sold')),
    [{ status: 'Sold' }],
  );
  assert.deepEqual(
    products.filter((product) => matchesAdminProductStatusFilter(product, 'pending')),
    [{ status: 'Pending' }],
  );
  assert.deepEqual(
    products.filter((product) => matchesAdminProductStatusFilter(product, 'flagged')),
    [{ status: 'Flagged' }],
  );
  assert.equal(products.filter((product) => matchesAdminProductStatusFilter(product, 'all')).length, 7);
});
