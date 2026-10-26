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

function fallback(message) {
  return {
    tab: 'home',
    section: null,
    itemId: null,
    fallbackMessage: message,
  };
}

export function parseStudentDashboardLink(input) {
  let url;
  try {
    url = new URL(input, 'http://localhost');
  } catch {
    return null;
  }

  if (url.pathname.replace(/\/+$/, '').toLowerCase() !== '/dashboard') return null;

  const tab = url.searchParams.get('tab');
  if (!tab) return fallback('This dashboard link was incomplete, so Home is shown.');
  if (!studentTabs.has(tab)) return fallback('This dashboard link is unavailable, so Home is shown.');

  const section = url.searchParams.get('section');
  const item = url.searchParams.get('item');
  let itemId = null;
  if (tab === 'buyer') {
    if (section && !buyerSections.has(section)) {
      return fallback('This dashboard section is unavailable, so Home is shown.');
    }
    if (item) {
      const match = section === 'reports-support'
        ? /^(report|support)-(\d+)$/.exec(item)
        : null;
      if (!match || Number(match[2]) < 1) {
        return fallback('This dashboard link is invalid, so Home is shown.');
      }
      itemId = Number(match[2]);
    }
  } else if (tab === 'seller') {
    if (section && !sellerSections.has(section)) {
      return fallback('This dashboard section is unavailable, so Home is shown.');
    }
    if (section === 'warnings' || section === 'account-notices') {
      if (item) {
        const match = /^report-(\d+)$/.exec(item);
        if (!match || Number(match[1]) < 1) {
          return fallback('This notice link is invalid, so Home is shown.');
        }
        itemId = Number(match[1]);
      }
    } else if (item) {
      return fallback('This dashboard link is unavailable, so Home is shown.');
    }
  } else if (section || item) {
    return fallback('This dashboard section is unavailable, so Home is shown.');
  }

  return { tab, section, itemId, fallbackMessage: '' };
}
