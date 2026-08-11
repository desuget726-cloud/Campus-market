import { API_BASE } from "./config";

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || res.statusText);
    err.status = res.status;
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
export const apiDelete = (path, opts) => apiFetch(path, { method: "DELETE", ...opts });
