import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SECTION_OPTIONS, normalizeAdminSection } from './adminDashboardSection.js';

test('removed admin-users links fall back to the dashboard', () => {
  assert.equal(ADMIN_SECTION_OPTIONS.includes('admin-users'), false);
  assert.equal(normalizeAdminSection('admin-users'), 'dashboard');
  assert.equal(normalizeAdminSection('admin-users', 'user-management'), 'dashboard');
});
