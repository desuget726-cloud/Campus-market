import assert from 'node:assert/strict';
import test from 'node:test';
import { filterPublicProducts } from './publicListings.js';

test('public listing filter removes products owned by the current student', () => {
  const products = [
    { id: 1, seller_id: 'student-1', seller: 'Student Name' },
    { id: 2, seller_id: null, seller: 'Student Name' },
    { id: 3, seller_id: 'student-2', seller: 'Another Seller' },
  ];

  assert.deepEqual(
    filterPublicProducts(products, { studentId: 'student-1', name: 'Student Name' }),
    [{ id: 3, seller_id: 'student-2', seller: 'Another Seller' }],
  );
});

test('anonymous public listings keep products from all sellers', () => {
  const products = [{ id: 1, seller_id: 'student-1' }, { id: 2, seller_id: null }];

  assert.deepEqual(filterPublicProducts(products, null), products);
});
