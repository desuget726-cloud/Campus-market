import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_NAVIGATION,
  filterAdminNavigation,
  getActiveAdminGroup,
  getAdminGroupBadgeTotal,
  formatAdminBadgeCount,
  decrementAdminSidebarCount,
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
  assert.equal(getAdminGroupBadgeTotal(reportsGroup, { unseenReports: 5 }), 5);
  assert.equal(getAdminGroupBadgeTotal(reportsGroup, { unseenReports: 2, supportOverdue: 4 }), 2);
});

test('caps badge labels and clamps optimistic seen decrements at zero', () => {
  assert.equal(formatAdminBadgeCount(0), 0);
  assert.equal(formatAdminBadgeCount(99), 99);
  assert.equal(formatAdminBadgeCount(100), '99+');
  assert.deepEqual(decrementAdminSidebarCount({ unseenReports: 2 }, 'unseenReports'), { unseenReports: 1 });
  assert.deepEqual(decrementAdminSidebarCount({ unseenReports: 0 }, 'unseenReports'), { unseenReports: 0 });
});

test('hides children denied by the current admin permissions', () => {
  const navigation = filterAdminNavigation(ADMIN_NAVIGATION, {
    permissions: { users: true, products: false },
  });
  assert.equal(navigation.some((entry) => entry.key === 'marketplace-products'), false);
  assert.equal(navigation.some((entry) => entry.key === 'support'), true);
});
