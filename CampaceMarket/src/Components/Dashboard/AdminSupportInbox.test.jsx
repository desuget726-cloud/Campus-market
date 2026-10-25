import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminSupportInbox from './AdminSupportInbox';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('AdminSupportInbox', () => {
  it('assigns a ticket using the admin PATCH endpoint and JSON body', async () => {
    window.localStorage.setItem('campaceSession', JSON.stringify({ access_token: 'test-token' }));
    window.history.pushState({}, '', '/admin?ticket=1');
    const ticket = {
      id: 1,
      ticket_number: 'SUP-0001',
      subject: 'Test ticket',
      category: 'General Inquiry',
      status: 'Open',
      name: 'Test Student',
      email: 'student@example.test',
      revision: 1,
      messages: [],
      assigned_admin_id: null,
      is_unseen: true,
      overdue: false,
    };
    const requests = [];
    const fetchMock = vi.fn(async (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost');
      const method = options.method || 'GET';
      requests.push({ url, method, options });

      if (url.pathname === '/support/tickets' && method === 'GET') {
        return jsonResponse({ items: [ticket], counters: { Open: 1 } });
      }
      if (url.pathname === '/support/canned-responses') {
        return jsonResponse([]);
      }
      if (url.pathname === '/support/notifications') {
        return jsonResponse({ items: [] });
      }
      if (url.pathname === '/api/admin/support/admins') {
        return jsonResponse({
          items: [{ id: 7, name: 'Support Admin', username: 'support-admin' }],
          current_admin_id: 7,
        });
      }
      if (url.pathname === '/support/tickets/1' && method === 'GET') {
        return jsonResponse(ticket);
      }
      if (url.pathname === '/api/admin/support/1/seen') {
        return jsonResponse({ success: true });
      }
      if (url.pathname === '/api/admin/support/1/assign' && method === 'PATCH') {
        return jsonResponse({
          success: true,
          ticket: {
            ...ticket,
            assigned_admin_id: 7,
            assigned_admin: { id: 7, name: 'Support Admin', username: 'support-admin' },
          },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSupportInbox />);
    await screen.findByRole('heading', { name: 'Test ticket' });
    await screen.findByRole('option', { name: 'Support Admin (@support-admin)' });
    fireEvent.change(screen.getByLabelText('Assign admin'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));

    await waitFor(() => {
      expect(requests.some((request) => (
        request.url.pathname === '/api/admin/support/1/assign'
        && request.method === 'PATCH'
      ))).toBe(true);
    });
    const assignmentRequest = requests.find((request) => request.url.pathname === '/api/admin/support/1/assign');
    expect(assignmentRequest.method).toBe('PATCH');
    expect(JSON.parse(assignmentRequest.options.body)).toEqual({ admin_id: 7 });
    expect(await screen.findByText('Current assignee: Support Admin')).toBeTruthy();
  });
});

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}
