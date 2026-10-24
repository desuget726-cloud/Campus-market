import assert from 'node:assert/strict';
import test from 'node:test';
import { isSessionExpiryResponse } from './sessionExpiry.js';

const apiBaseUrl = 'http://localhost:8000';
const authenticatedRequest = {
  responseStatus: 401,
  apiBaseUrl,
  storedSessionExists: true,
  authorizationHeader: 'Bearer student-token',
};

test('treats an authenticated API 401 as an expired session when a session is stored', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/orders/detail/28`,
  }), true);
});

test('does not treat login 401s as expired sessions', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/login`,
  }), false);
});

test('does not treat 2FA 401s as expired sessions', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/admin/login/2fa`,
  }), false);
});

test('does not treat password-reset 401s as expired sessions', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/auth/reset-password`,
  }), false);
});

test('does not treat student security-setting 401s as expired sessions', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/profile/2fa`,
  }), false);
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/profile/password`,
  }), false);
});

test('does not treat other auth endpoint 401s as expired sessions', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/auth/session`,
  }), false);
});

test('does not treat an authenticated API 401 as expired when no session is stored', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/orders/detail/28`,
    storedSessionExists: false,
  }), false);
});

test('does not treat an unauthenticated API 401 as expired', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/orders/detail/28`,
    authorizationHeader: '',
  }), false);
});

test('recognizes endpoints authenticated by an explicit session cookie', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: `${apiBaseUrl}/api/student/orders/detail/28`,
    authorizationHeader: '',
    credentials: 'include',
  }), true);
});

test('ignores non-API and other-origin 401s', () => {
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: 'http://localhost:5173/login',
  }), false);
  assert.equal(isSessionExpiryResponse({
    ...authenticatedRequest,
    requestUrl: 'https://example.test/api/student/orders/detail/28',
  }), false);
});
