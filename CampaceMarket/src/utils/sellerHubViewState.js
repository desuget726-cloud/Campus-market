export const SELLER_HUB_VIEWS = Object.freeze({
    overview: 'overview',
    productManagement: 'product-management',
    operations: 'operations',
});

export function sellerHubViewReducer(currentView, action) {
    switch (action?.type) {
        case 'open-product-management':
            return SELLER_HUB_VIEWS.productManagement;
        case 'open-operations':
            return SELLER_HUB_VIEWS.operations;
        case 'back-to-overview':
            return SELLER_HUB_VIEWS.overview;
        default:
            return currentView;
    }
}

export function getSellerHubSections(activeView) {
    return {
        overview: activeView === SELLER_HUB_VIEWS.overview,
        productManagement: activeView === SELLER_HUB_VIEWS.productManagement,
        operations: activeView === SELLER_HUB_VIEWS.operations,
    };
}