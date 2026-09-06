// Configure the Railway API URL at Vite build time.
export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const apiUrl = (path) => `${API_BASE}${path}`;
