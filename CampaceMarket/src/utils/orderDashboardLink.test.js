import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrderDashboardUrl, parseOrderDashboardLink } from './orderDashboardLink.js';

test('parses buyer order deep links and keeps the requested order id', () => {
  assert.deepEqual(
    parseOrderDashboardLink('/dashboard?tab=buyer&section=orders&order=26'),
    {
      tab: 'buyer',
      section: 'orders',
      orderId: '26',
      hasOrderParameter: true,
    },
  );
});

test('parses seller order links and rejects invalid order ids without losing the orders tab', () => {
  assert.deepEqual(
    parseOrderDashboardLink(new URL('https://campus.example/dashboard?tab=seller&section=orders&order=nope')),
    {
      tab: 'seller',
      section: 'orders',
      orderId: null,
      hasOrderParameter: true,
    },
  );
});

test('successful payment navigation points to Buyer Hub Orders for the returned order id', () => {
  assert.equal(buildOrderDashboardUrl(26), '/dashboard?tab=buyer&section=orders&order=26');
});

test('does not parse unrelated routes or dashboard sections', () => {
  assert.equal(parseOrderDashboardLink('/dashboard?tab=orders'), null);
  assert.equal(parseOrderDashboardLink('/products/26'), null);
  assert.throws(() => buildOrderDashboardUrl('not-an-order'));
});
