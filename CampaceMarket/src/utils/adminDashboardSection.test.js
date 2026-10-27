import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SECTION_OPTIONS, normalizeAdminSection, setAdminSectionUrl } from './adminDashboardSection.js';

test('removed admin-users links fall back to the dashboard', () => {
  assert.equal(ADMIN_SECTION_OPTIONS.includes('admin-users'), false);
  assert.equal(normalizeAdminSection('admin-users'), 'dashboard');
  assert.equal(normalizeAdminSection('admin-users', 'user-management'), 'dashboard');
});

test('navigating to reports removes stale auth errors but preserves other query parameters', () => {
  assert.equal(
    setAdminSectionUrl('/dashboard', '?error=google_state_invalid&filter=open', 'reports'),
    '/dashboard?filter=open&tab=reports',
  );
});

test('navigating to another admin section preserves query parameters', () => {
  assert.equal(
    setAdminSectionUrl('/dashboard', '?error=google_state_invalid', 'dashboard'),
    '/dashboard?error=google_state_invalid&tab=dashboard',
  );
});
