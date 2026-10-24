const DASHBOARD_PATH = '/dashboard';

export const buildOrderDashboardUrl = (orderId, tab = 'buyer') => {
  const normalizedOrderId = String(orderId ?? '').trim();
  if (!/^\d+$/.test(normalizedOrderId) || Number(normalizedOrderId) <= 0) {
    throw new Error('A valid order id is required to open order details.');
  }
  if (!['buyer', 'seller'].includes(tab)) {
    throw new Error('A valid dashboard role is required to open order details.');
  }
  return `${DASHBOARD_PATH}?tab=${tab}&section=orders&order=${encodeURIComponent(normalizedOrderId)}`;
};

export const parseOrderDashboardLink = (value) => {
  let url;
  try {
    if (value instanceof URL) {
      url = value;
    } else if (typeof value === 'string') {
      url = new URL(value, 'http://localhost');
    } else if (value && typeof value.pathname === 'string') {
      url = new URL(`${value.pathname}${value.search || ''}`, 'http://localhost');
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (url.pathname.replace(/\/+$/, '').toLowerCase() !== DASHBOARD_PATH) return null;
  const tab = url.searchParams.get('tab');
  if (!['buyer', 'seller'].includes(tab)) return null;

  const requestedSection = url.searchParams.get('section') || '';
  const validSections = ['search', 'wishlist', 'cart', 'orders', 'payments'];
  const section = validSections.includes(requestedSection) ? requestedSection : '';
  const requestedOrderId = url.searchParams.get('order');
  const orderId = /^\d+$/.test(requestedOrderId || '') && Number(requestedOrderId) > 0
    ? requestedOrderId
    : null;

  return {
    tab,
    section,
    orderId,
    hasOrderParameter: requestedOrderId !== null,
  };
};
