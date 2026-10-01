import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearPendingProductAction,
    getPendingProductAction,
    PENDING_PRODUCT_ACTION_KEY,
    restorePendingProductAction,
    startProductActionLogin,
} from './productActionState.js';

function createStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
    };
}

test('guest add-to-cart redirects to login and restores its product action once', async () => {
    const storage = createStorage();
    const destinations = [];
    const intent = { returnTo: 42, action: 'addToCart', quantity: 3 };

    const saved = startProductActionLogin(intent, () => {
        destinations.push('login');
        assert.deepEqual(JSON.parse(storage.getItem(PENDING_PRODUCT_ACTION_KEY)), {
            returnTo: '42',
            action: 'addToCart',
            quantity: 3,
        });
    }, storage);

    assert.equal(saved, true);
    assert.deepEqual(destinations, ['login']);
    const pendingAction = getPendingProductAction(storage);
    assert.deepEqual(pendingAction, {
        returnTo: '42',
        action: 'addToCart',
        quantity: 3,
    });
    let restoredAction;
    let restoreCompleted = false;
    await restorePendingProductAction(pendingAction, {
        addToCart: async (action) => { restoredAction = action; },
    }, () => {
        clearPendingProductAction(storage);
        restoreCompleted = true;
    });

    assert.deepEqual(restoredAction, pendingAction);
    assert.equal(restoreCompleted, true);
    assert.equal(getPendingProductAction(storage), null);
});