import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReduceUnreadNotificationCount } from './notificationState.js';

test('delete only reduces unread count when a notification was still unread', () => {
    assert.equal(shouldReduceUnreadNotificationCount({ read: false }), true);
    assert.equal(shouldReduceUnreadNotificationCount({ read: true }), false);
    assert.equal(shouldReduceUnreadNotificationCount(null), false);
    assert.equal(shouldReduceUnreadNotificationCount(undefined), false);
});
