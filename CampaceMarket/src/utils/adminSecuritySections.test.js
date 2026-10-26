import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminSecuritySections,
  normalizeAdminSecuritySection,
} from './adminSecuritySections.js';

test('hides sub-admin sections when the feature flag is disabled', () => {
  const sections = getAdminSecuritySections(false, true);
  const ids = sections.map(([id]) => id);

  assert.ok(!ids.includes('admin-accounts'));
  assert.ok(!ids.includes('permissions'));
  assert.equal(normalizeAdminSecuritySection('admin-accounts', false, true), 'personal');
  assert.equal(normalizeAdminSecuritySection('permissions', false, true), 'personal');
});

test('keeps sub-admin sections available to the main admin when enabled', () => {
  const sections = getAdminSecuritySections(true, true);
  const ids = sections.map(([id]) => id);

  assert.ok(ids.includes('admin-accounts'));
  assert.ok(ids.includes('permissions'));
  assert.equal(normalizeAdminSecuritySection('admin-accounts', true, true), 'admin-accounts');
});

test('does not show admin accounts to a sub-admin', () => {
  const ids = getAdminSecuritySections(true, false).map(([id]) => id);

  assert.ok(!ids.includes('admin-accounts'));
  assert.ok(ids.includes('permissions'));
});
