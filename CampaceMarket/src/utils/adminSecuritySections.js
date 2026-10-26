const ADMIN_SECURITY_SECTIONS = [
  ['personal', 'Personal Information'],
  ['password', 'Password & Security'],
  ['2fa', 'Two-Factor Authentication'],
  ['sessions', 'Active Sessions'],
  ['history', 'Login History'],
];

export const getAdminSecuritySections = (subAdminsEnabled, isMainAdmin) => [
  ...ADMIN_SECURITY_SECTIONS,
  ...(subAdminsEnabled ? [['permissions', 'Role & Permissions']] : []),
  ...(subAdminsEnabled && isMainAdmin ? [['admin-accounts', 'Admin Accounts']] : []),
];

export const normalizeAdminSecuritySection = (section, subAdminsEnabled, isMainAdmin) => {
  const sections = getAdminSecuritySections(subAdminsEnabled, isMainAdmin);
  return sections.some(([id]) => id === section) ? section : 'personal';
};
