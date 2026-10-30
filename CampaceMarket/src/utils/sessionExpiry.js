const AUTH_ENDPOINT_PATHS = [
  /^\/api\/auth(?:\/|$)/,
  /^\/api\/(?:login|register)(?:\/|$)/,
  /^\/api\/admin\/(?:login|2fa)(?:\/|$)/,
  /^\/api\/student\/profile\/(?:password|2fa)(?:\/|$)/,
];

export function isSessionExpiryResponse({
  responseStatus,
  requestUrl,
  apiBaseUrl,
  storedSessionExists,
  authorizationHeader = '',
  credentials = 'same-origin',
  errorCode = null,
}) {
  if (responseStatus !== 401 || !storedSessionExists || errorCode === 'INCORRECT_PIN') return false;

  let requestedUrl;
  let apiOrigin;
  try {
    requestedUrl = new URL(requestUrl, apiBaseUrl);
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    return false;
  }

  if (requestedUrl.origin !== apiOrigin || !requestedUrl.pathname.startsWith('/api/')) {
    return false;
  }
  if (AUTH_ENDPOINT_PATHS.some((path) => path.test(requestedUrl.pathname))) {
    return false;
  }

  return /^Bearer\s+\S+/i.test(authorizationHeader) || credentials === 'include';
}
