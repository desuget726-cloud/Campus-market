import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearPendingProductAction,
    buildProductReturnTo,
    getPendingProductAction,
    getProductIdFromReturnTo,
    normalizeInternalReturnTo,
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

test('chat payment action opens the selected product payment flow', async () => {
    const storage = createStorage();
    const intent = { returnTo: 42, action: 'pay', quantity: 1 };
    assert.equal(startProductActionLogin(intent, () => {}, storage), true);

    const pendingAction = getPendingProductAction(storage);
    let paymentOpened = false;
    await restorePendingProductAction(pendingAction, {
        pay: async (action) => {
            paymentOpened = action.returnTo === '42';
        },
    }, () => clearPendingProductAction(storage));

    assert.equal(paymentOpened, true);
    assert.equal(getPendingProductAction(storage), null);
});

test('product return destinations are internal and identify the product after login', () => {
    const returnTo = buildProductReturnTo(42);
    assert.equal(returnTo, '/?productId=42');
    assert.equal(normalizeInternalReturnTo(returnTo), returnTo);
    assert.equal(getProductIdFromReturnTo(returnTo), '42');
    assert.equal(normalizeInternalReturnTo('https://outside.example/'), null);
    assert.equal(normalizeInternalReturnTo('//outside.example/'), null);
    assert.equal(normalizeInternalReturnTo('/\\outside.example/'), null);
    assert.equal(getProductIdFromReturnTo('/?productId=invalid'), null);
});

test('report and send-message actions can be restored without silently discarding their intent', async () => {
    const storage = createStorage();
    for (const action of ['report', 'sendMessage']) {
        assert.equal(startProductActionLogin({ returnTo: 42, action }, () => {}, storage), true);
        const pendingAction = getPendingProductAction(storage);
        assert.equal(pendingAction.action, action);
        let restored = false;
        await restorePendingProductAction(pendingAction, {
            [action]: () => { restored = true; },
        }, () => clearPendingProductAction(storage));
        assert.equal(restored, true);
        assert.equal(getPendingProductAction(storage), null);
    }
});