export const DEFAULT_ADMIN_SECTION = 'dashboard';

export const ADMIN_SECTION_OPTIONS = [
  'dashboard',
  'user-management',
  'student-verification',
  'product-management',
  'product-reviews',
  'categories',
  'orders',
  'payments',
  'reports',
  'support',
  'analytics',
  'notifications',
  'audit-logs',
  'settings',
  'profile',
  'admin-accounts',
];

export const normalizeAdminSection = (value, fallback = DEFAULT_ADMIN_SECTION) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (!normalizedValue) return fallback;

  if (normalizedValue === 'admin-users') return DEFAULT_ADMIN_SECTION;

  if (['ai-recommendations', 'id-change-requests', 'id-verification', 'id-verification-requests'].includes(normalizedValue)) {
    return DEFAULT_ADMIN_SECTION;
  }

  return ADMIN_SECTION_OPTIONS.includes(normalizedValue) ? normalizedValue : fallback;
};

export const getAdminSectionFromSearch = (search, fallback = DEFAULT_ADMIN_SECTION) => {
  if (typeof window !== 'undefined' && search == null) {
    search = window.location.search;
  }

  const params = new URLSearchParams(search || '');
  const requestedSection = params.get('tab') ?? params.get('section') ?? '';
  return normalizeAdminSection(requestedSection, fallback);
};

export const setAdminSectionUrl = (pathname, search, section) => {
  const nextSection = normalizeAdminSection(section, DEFAULT_ADMIN_SECTION);
  const params = new URLSearchParams(search || '');
  params.delete('section');
  params.set('tab', nextSection);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
};
