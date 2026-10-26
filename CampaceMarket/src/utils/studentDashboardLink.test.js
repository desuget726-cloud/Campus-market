import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentDashboardLink } from './studentDashboardLink.js';

test('missing tab falls back to Home without a warning', () => {
  assert.deepEqual(parseStudentDashboardLink('/dashboard'), {
    tab: 'home',
    section: null,
    itemId: null,
  });
});

test('unknown tabs and sections fall back to Home', () => {
  assert.deepEqual(parseStudentDashboardLink('/dashboard?tab=unknown'), {
    tab: 'home',
    section: null,
    itemId: null,
  });
  assert.deepEqual(parseStudentDashboardLink('/dashboard?tab=seller&section=private'), {
    tab: 'home',
    section: null,
    itemId: null,
  });
});

test('seller moderation deep links resolve the report ID and section', () => {
  assert.deepEqual(
    parseStudentDashboardLink('/dashboard?tab=seller&section=warnings&item=report-16'),
    { tab: 'seller', section: 'warnings', itemId: 16 },
  );
  assert.deepEqual(
    parseStudentDashboardLink('/dashboard?tab=seller&section=account-notices&item=report-16'),
    { tab: 'seller', section: 'account-notices', itemId: 16 },
  );
});

test('malformed notice IDs fall back safely', () => {
  assert.equal(
    parseStudentDashboardLink('/dashboard?tab=seller&section=warnings&item=SUP-0016').tab,
    'home',
  );
});

test('report and support deep links require numeric IDs', () => {
  assert.deepEqual(
    parseStudentDashboardLink('/dashboard?tab=buyer&section=reports-support&item=report-25'),
    { tab: 'buyer', section: 'reports-support', itemId: 25 },
  );
  assert.equal(
    parseStudentDashboardLink('/dashboard?tab=buyer&section=reports-support&item=SUP-0025').tab,
    'home',
  );
});
