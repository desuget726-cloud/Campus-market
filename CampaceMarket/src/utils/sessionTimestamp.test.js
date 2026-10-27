import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSessionTimestamp } from './sessionTimestamp.js';

test('formats a session timestamp as an exact human-readable date and time', () => {
  const timestamp = new Date(2026, 9, 26, 17, 45).toISOString();
  assert.equal(formatSessionTimestamp(timestamp), 'Oct 26, 2026, 5:45 PM');
});

test('returns unavailable for missing or invalid session timestamps', () => {
  assert.equal(formatSessionTimestamp(null), 'Unavailable');
  assert.equal(formatSessionTimestamp('not-a-timestamp'), 'Unavailable');
});
