export const ADMIN_NAVIGATION = [
  {
    type: 'link',
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'M4 6h16M4 12h16M4 18h16',
    path: 'dashboard',
  },
  {
    type: 'group',
    key: 'user-management-group',
    label: 'User Management',
    icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422M12 14L5.84 10.578',
    items: [
      { key: 'user-management', label: 'All Users / Students', icon: 'M12 14l9-5-9-5-9 5 9 5z', path: 'user-management', badgeKey: null, permission: 'users' },
      { key: 'student-verification', label: 'Student Verification', icon: 'M12 11c2.761 0 5-2.238 5-5S14.761 1 12 1 7 3.238 7 6s2.239 5 5 5z M4 23c0-4.418 3.582-8 8-8s8 3.582 8 8', path: 'student-verification', badgeKey: 'pendingVerifications', permission: 'users' },
      { key: 'admin-users', label: 'Admin Users', icon: 'M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M10 11a4 4 0 100-8 4 4 0 000 8z M20 8v6 M23 11h-6', path: 'admin-users', badgeKey: null, permission: 'users' },
    ],
  },
  {
    type: 'group',
    key: 'marketplace-products',
    label: 'Marketplace & Products',
    icon: 'M4 7h16v13H4z M8 7v-3h8v3',
    items: [
      { key: 'product-management', label: 'All Products', icon: 'M4 7h16v13H4z M8 7v-3h8v3', path: 'product-management', badgeKey: null, permission: 'products' },
      { key: 'categories', label: 'Categories', icon: 'M5 5h14v4H5z M5 15h14v4H5z', path: 'categories', badgeKey: null, permission: 'products' },
      { key: 'product-reviews', label: 'Product Reviews', icon: 'M12 3l2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 16.77l-5.4 2.84 1.03-6.01-4.36-4.25 6.03-.88L12 3z', path: 'product-reviews', badgeKey: null, permission: 'products' },
    ],
  },
  {
    type: 'group',
    key: 'orders-transactions',
    label: 'Orders & Transactions',
    icon: 'M6 6h12l2 10H4z M8 22h8',
    items: [
      { key: 'orders', label: 'Orders', icon: 'M6 6h12l2 10H4z M8 22h8', path: 'orders', badgeKey: null, permission: 'orders' },
      { key: 'payments', label: 'Payments', icon: 'M6 7h12v10H6z M9 12h6 M12 16v2', path: 'payments', badgeKey: null, permission: 'payments' },
    ],
  },
  {
    type: 'group',
    key: 'reports-system',
    label: 'Reports & System',
    icon: 'M6 5h12v14H6z M9 9h6 M9 13h4',
    items: [
      { key: 'analytics', label: 'Analytics', icon: 'M5 19h14M9 15v-4M15 15V9', path: 'analytics', badgeKey: null, permission: 'analytics' },
      { key: 'reports', label: 'Reports', icon: 'M6 5h12v14H6z M9 9h6 M9 13h4', path: 'reports', badgeKey: 'openReports', permission: 'reports' },
      { key: 'audit-logs', label: 'Audit Logs', icon: 'M6 4h12v4H6z M6 12h12v4H6z M10 20h4', path: 'audit-logs', badgeKey: null, permission: 'audit_logs' },
    ],
  },
  {
    type: 'link',
    key: 'support',
    label: 'Support',
    icon: 'M4 5h16v12H8l-4 4V5z M8 9h8 M8 13h5',
    path: 'support',
    badgeKey: 'support',
    permission: 'support',
  },
  {
    type: 'link',
    key: 'notifications',
    label: 'Notifications',
    icon: 'M18 13v-3a6 6 0 10-12 0v3l-2 2v1h16v-1l-2-2z M13.73 21a2 2 0 01-3.46 0',
    path: 'notifications',
    badgeKey: 'unreadNotifications',
    permission: null,
  },
  {
    type: 'link',
    key: 'settings',
    label: 'Settings',
    icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z M4.93 4.93l2.12 2.12 M17.95 17.95l2.12 2.12 M4.93 19.07l2.12-2.12 M17.95 6.05l2.12-2.12',
    path: 'settings',
    permission: 'settings',
  },
];

export const ADMIN_NAV_ITEM_STYLES = {
  active: 'bg-[#1d4ed8] text-white shadow-md',
  idle: 'text-slate-300 hover:bg-white/10 hover:text-white',
  groupActive: 'bg-white/10 text-white',
  groupIdle: 'text-slate-300 hover:bg-white/10 hover:text-white',
};

export function getActiveAdminGroup(path, navigation = ADMIN_NAVIGATION) {
  const normalizedPath = String(path || '').split('?')[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  return navigation.find((entry) => (
    entry.type === 'group'
    && entry.items.some((item) => item.path.toLowerCase() === normalizedPath)
  ))?.key || null;
}

export function getAdminGroupBadgeTotal(group, counts = {}) {
  if (group.type !== 'group') return 0;
  return group.items.reduce((total, item) => {
    if (item.badgeKey === 'support') {
      return total + Number(counts.supportOpen || 0) + Number(counts.supportOverdue || 0);
    }
    return total + Number(counts[item.badgeKey] || 0);
  }, 0);
}

export function isAdminNavigationItemAllowed(item, user) {
  if (!item.permission) return true;
  const permissions = user?.permissions;
  if (!permissions || typeof permissions !== 'object') return true;
  return permissions[item.permission] !== false;
}

export function filterAdminNavigation(navigation, user) {
  return navigation.flatMap((entry) => {
    if (entry.type === 'link') {
      return isAdminNavigationItemAllowed(entry, user) ? [entry] : [];
    }
    const items = entry.items.filter((item) => isAdminNavigationItemAllowed(item, user));
    return items.length ? [{ ...entry, items }] : [];
  });
}
