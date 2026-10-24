export const PENDING_PRODUCT_ACTION_KEY = 'campacePendingProductAction';

const validActions = new Set(['addToCart', 'showContact', 'wishlist', 'pay', 'report', 'sendMessage']);
const INTERNAL_RETURN_TO_ORIGIN = 'https://campace.internal';

export function normalizeInternalReturnTo(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;

    try {
        const url = new URL(value, INTERNAL_RETURN_TO_ORIGIN);
        if (url.origin !== INTERNAL_RETURN_TO_ORIGIN) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
}

export function buildProductReturnTo(productId) {
    const id = String(productId ?? '').trim();
    if (!/^\d+$/.test(id)) return '/';
    return `/?productId=${encodeURIComponent(id)}`;
}

export function getProductIdFromReturnTo(value) {
    const returnTo = normalizeInternalReturnTo(value);
    if (!returnTo) return null;
    const url = new URL(returnTo, INTERNAL_RETURN_TO_ORIGIN);
    const productId = url.pathname === '/' ? url.searchParams.get('productId') : null;
    return /^\d+$/.test(productId || '') ? productId : null;
}

export function savePendingProductAction(intent, storage = window.sessionStorage) {
    if (!intent?.returnTo || !validActions.has(intent.action)) return false;

    const quantity = Math.max(1, Math.floor(Number(intent.quantity) || 1));
    try {
        storage.setItem(PENDING_PRODUCT_ACTION_KEY, JSON.stringify({
            returnTo: String(intent.returnTo),
            action: intent.action,
            quantity,
        }));
        return true;
    } catch {
        return false;
    }
}

export function startProductActionLogin(intent, navigateToLogin, storage = window.sessionStorage) {
    const saved = savePendingProductAction(intent, storage);
    navigateToLogin();
    return saved;
}

export function getPendingProductAction(storage = window.sessionStorage) {
    try {
        const serializedIntent = storage.getItem(PENDING_PRODUCT_ACTION_KEY);
        if (!serializedIntent) return null;

        const intent = JSON.parse(serializedIntent);
        if (!intent?.returnTo || !validActions.has(intent.action)) return null;

        return {
            returnTo: String(intent.returnTo),
            action: intent.action,
            quantity: Math.max(1, Math.floor(Number(intent.quantity) || 1)),
        };
    } catch {
        return null;
    }
}

export function clearPendingProductAction(storage = window.sessionStorage) {
    try {
        storage.removeItem(PENDING_PRODUCT_ACTION_KEY);
    } catch {
        return;
    }
}

export async function restorePendingProductAction(intent, handlers, onHandled) {
    if (!intent || !validActions.has(intent.action)) return false;
    const handler = handlers?.[intent.action];
    if (typeof handler !== 'function') return false;

    try {
        await handler(intent);
        return true;
    } finally {
        onHandled?.();
    }
}