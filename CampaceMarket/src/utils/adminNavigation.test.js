import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_NAVIGATION,
  filterAdminNavigation,
  getActiveAdminGroup,
  getAdminGroupBadgeTotal,
} from './adminNavigation.js';

test('finds the active admin menu group from a deep-link section', () => {
  assert.equal(getActiveAdminGroup('reports'), 'reports-system');
  assert.equal(getActiveAdminGroup('/product-reviews'), 'marketplace-products');
  assert.equal(getActiveAdminGroup('dashboard'), null);
});

test('sums child badges for collapsed groups', () => {
  const verificationGroup = ADMIN_NAVIGATION.find((entry) => entry.key === 'user-management-group');
  const reportsGroup = ADMIN_NAVIGATION.find((entry) => entry.key === 'reports-system');
  assert.equal(getAdminGroupBadgeTotal(verificationGroup, { pendingVerifications: 3 }), 3);
  assert.equal(getAdminGroupBadgeTotal(reportsGroup, { openReports: 5 }), 5);
});

test('hides children denied by the current admin permissions', () => {
  const navigation = filterAdminNavigation(ADMIN_NAVIGATION, {
    permissions: { users: true, products: false },
  });
  assert.equal(navigation.some((entry) => entry.key === 'marketplace-products'), false);
  assert.equal(navigation.some((entry) => entry.key === 'support'), true);
});
