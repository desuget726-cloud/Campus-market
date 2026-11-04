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
  const requestedTab = url.searchParams.get('tab');
  const isMyOrdersTab = requestedTab === 'my_orders';
  const tab = isMyOrdersTab ? 'buyer' : requestedTab;
  if (!['buyer', 'seller'].includes(tab)) return null;

  const requestedSection = url.searchParams.get('section') || '';
  const requestedOrderId = url.searchParams.get('order_id') ?? url.searchParams.get('order');
  const section = isMyOrdersTab
    ? 'orders'
    : requestedSection || (requestedOrderId !== null ? 'orders' : '');
  const validSections = ['search', 'wishlist', 'cart', 'orders', 'payments', 'reports-support'];
  const normalizedSection = validSections.includes(section) ? section : '';
  const orderId = /^\d+$/.test(requestedOrderId || '') && Number(requestedOrderId) > 0
    ? requestedOrderId
    : null;

  return {
    tab,
    section: normalizedSection,
    orderId,
    hasOrderParameter: url.searchParams.has('order_id') || url.searchParams.has('order'),
  };
};
