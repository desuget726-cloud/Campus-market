const studentTabs = new Set([
  'home',
  'buyer',
  'seller',
  'messages',
  'notifications',
  'settings',
]);

const buyerSections = new Set([
  'search',
  'wishlist',
  'cart',
  'orders',
  'reports-support',
  'payments',
]);

const sellerSections = new Set(['warnings', 'account-notices']);

function fallback() {
  return { tab: 'home', section: null, itemId: null };
}

export function parseStudentDashboardLink(input) {
  let url;
  try {
    url = new URL(input, 'http://localhost');
  } catch {
    return null;
  }

  if (url.pathname.replace(/\/+$/, '').toLowerCase() !== '/dashboard') return null;

  const requestedMode = url.searchParams.get('mode');
  const mode = requestedMode === 'buyer' || requestedMode === 'seller' ? requestedMode : null;
  const requestedTab = url.searchParams.get('tab');
  const modeAliases = {
    buyer: {
      marketplace: { tab: 'buyer', section: 'search' },
      orders: { tab: 'buyer', section: 'orders' },
      wishlist: { tab: 'buyer', section: 'wishlist' },
      cart: { tab: 'buyer', section: 'cart' },
    },
    seller: {
      add_product: { tab: 'seller', sellerDestination: 'add_product' },
      my_listings: { tab: 'seller', sellerDestination: 'listings' },
      customer_orders: { tab: 'seller', sellerDestination: 'orders' },
      sales_analytics: { tab: 'seller', sellerDestination: 'analytics' },
      wallet: { tab: 'seller', sellerDestination: 'wallet' },
    },
  };
  const alias = mode && requestedTab ? modeAliases[mode][requestedTab] : null;
  const tab = alias?.tab || requestedTab || (mode === 'buyer' ? 'buyer' : mode === 'seller' ? 'seller' : null);
  if (!tab || !studentTabs.has(tab)) return fallback();

  const section = alias?.section || url.searchParams.get('section');
  const item = url.searchParams.get('item');
  let itemId = null;
  if (tab === 'buyer') {
    if (section && !buyerSections.has(section)) {
      return fallback();
    }
    if (item) {
      const match = section === 'reports-support'
        ? /^(report|support)-(\d+)$/.exec(item)
        : null;
      if (!match || Number(match[2]) < 1) {
        return fallback();
      }
      itemId = Number(match[2]);
    }
  } else if (tab === 'seller') {
    if (section && !sellerSections.has(section)) {
      return fallback();
    }
    if (section === 'warnings' || section === 'account-notices') {
      if (item) {
        const match = /^report-(\d+)$/.exec(item);
        if (!match || Number(match[1]) < 1) {
          return fallback();
        }
        itemId = Number(match[1]);
      }
    } else if (item) {
      return fallback();
    }
  } else if (section || item) {
    return fallback();
  }

  return {
    tab,
    section,
    itemId,
    ...(mode ? { mode } : {}),
    ...(alias?.sellerDestination ? { sellerDestination: alias.sellerDestination } : {}),
  };
}
