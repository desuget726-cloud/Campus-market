import { API_BASE } from "./config";

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    const detail = payload?.detail;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail[0]?.msg || text
        : text || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export async function apiFetch(path, options = {}) {
  // If path is an absolute URL, use it directly; otherwise prefix with API_BASE
  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${API_BASE}${path}`;

  const defaultHeaders = { "Content-Type": "application/json" };
  options.headers = { ...defaultHeaders, ...(options.headers || {}) };

  const res = await fetch(url, options);
  return handleResponse(res);
}

export const apiGet = (path, opts) => apiFetch(path, { method: "GET", ...opts });
export const apiPost = (path, body, opts) =>
  apiFetch(path, { method: "POST", body: JSON.stringify(body), ...opts });
export const apiPatch = (path, body, opts) =>
  apiFetch(path, { method: "PATCH", body: JSON.stringify(body), ...opts });
export const apiDelete = (path, opts) => apiFetch(path, { method: "DELETE", ...opts });

export function getStoredAccessToken() {
  if (typeof window === "undefined") return "";
  try {
    const session = JSON.parse(window.localStorage.getItem("campaceSession") || "{}");
    const sessionUser = session?.user || {};
    return session.access_token || session.accessToken || session.token
      || sessionUser.access_token || sessionUser.accessToken || sessionUser.token || "";
  } catch {
    return "";
  }
}

export async function adminApiGet(path, options = {}) {
  const token = getStoredAccessToken();
  if (!token) {
    const error = new Error("Your session expired, please sign in again");
    error.status = 401;
    throw error;
  }
  return apiGet(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}
