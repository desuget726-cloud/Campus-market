import { API_BASE_URL } from '../config';
import { adminApiPatch } from './apiClient';

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

export const patchAdminSettings = async (settings) => {
  const saved = await adminApiPatch(`${API_BASE_URL}/api/admin/settings`, settings);
  invalidateAdminSettingsCache();
  return saved;
};
