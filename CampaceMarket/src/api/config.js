import { API_BASE_URL } from '../config';

export const API_BASE = API_BASE_URL;
export const apiUrl = (path) => `${API_BASE_URL}${path}`;
