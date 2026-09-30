import assert from 'node:assert/strict';
import test from 'node:test';
import { isOrderRefunded, shouldShowReceiptActions } from './orderReceiptState.js';

test('receipt actions are hidden for rejected, expired, and refunded orders', () => {
    for (const order of [
        { status: 'Rejected', payment_status: 'Refunded' },
        { status: 'Expired', payment_status: 'Refunded' },
        { status: 'Processing', payment_status: 'Refunded' },
        { status: 'Refunded', payment_status: 'Successful' },
        { status: 'Processing', payment_status: 'Successful', refund_status: 'succeeded' },
    ]) {
        assert.equal(isOrderRefunded(order), true);
        assert.equal(shouldShowReceiptActions(order, 'buyer'), false);
    }
});

test('receipt actions remain available for paid orders to buyers only', () => {
    const paidOrder = { status: 'Processing', payment_status: 'Successful' };

    assert.equal(isOrderRefunded(paidOrder), false);
    assert.equal(shouldShowReceiptActions(paidOrder, 'buyer'), true);
    assert.equal(shouldShowReceiptActions(paidOrder, 'seller'), false);
});