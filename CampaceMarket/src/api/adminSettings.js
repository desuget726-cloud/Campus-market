import { API_BASE_URL } from '../config';

let adminSettingsRequest;

export const invalidateAdminSettingsCache = () => {
  adminSettingsRequest = null;
};

export const getAdminSettings = () => {
  if (!adminSettingsRequest) {
    adminSettingsRequest = fetch(`${API_BASE_URL}/api/admin/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Settings endpoint unavailable');
        return response.json();
      })
      .catch((error) => {
        adminSettingsRequest = null;
        throw error;
      });
  }

  return adminSettingsRequest;
};
