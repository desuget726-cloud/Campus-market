import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSellerHubSections,
    SELLER_HUB_VIEWS,
    sellerHubViewReducer,
} from './sellerHubViewState.js';

test('Product Management opens from the overview and Back returns to overview', () => {
    const overview = getSellerHubSections(SELLER_HUB_VIEWS.overview);
    assert.deepEqual(overview, {
        overview: true,
        productManagement: false,
        operations: false,
    });

    const productView = sellerHubViewReducer(SELLER_HUB_VIEWS.overview, {
        type: 'open-product-management',
    });
    assert.deepEqual(getSellerHubSections(productView), {
        overview: false,
        productManagement: true,
        operations: false,
    });

    const restoredOverview = sellerHubViewReducer(productView, { type: 'back-to-overview' });
    assert.deepEqual(getSellerHubSections(restoredOverview), overview);
});