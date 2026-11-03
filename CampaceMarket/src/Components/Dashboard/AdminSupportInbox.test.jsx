import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminSupportInbox from './AdminSupportInbox';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('AdminSupportInbox', () => {
  it('updates ticket status and submits public replies and internal notes without assignment controls', async () => {
    window.localStorage.setItem('campaceSession', JSON.stringify({ access_token: 'test-token' }));
    window.history.pushState({}, '', '/admin?ticket=1');
    let ticket = {
      id: 1,
      ticket_number: 'SUP-0001',
      subject: 'Test ticket',
      category: 'General Inquiry',
      status: 'Open',
      name: 'Test Student',
      email: 'student@example.test',
      revision: 1,
      messages: [{
        id: 8,
        sender_type: 'admin',
        body: 'Original admin message',
        created_at: '2026-10-01T12:00:00',
        is_internal: false,
        is_edited: false,
        can_edit: true,
        can_delete: true,
      }],
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
      if (url.pathname === '/support/tickets/1' && method === 'GET') {
        return jsonResponse(ticket);
      }
      if (url.pathname === '/api/admin/support/1/seen') {
        return jsonResponse({ success: true });
      }
      if (url.pathname === '/support/tickets/1' && method === 'PATCH') {
        ticket = { ...ticket, ...JSON.parse(options.body), revision: ticket.revision + 1 };
        return jsonResponse(ticket);
      }
      if (url.pathname === '/support/tickets/1/messages/8' && method === 'PATCH') {
        const { body } = JSON.parse(options.body);
        ticket = {
          ...ticket,
          messages: ticket.messages.map((message) => (
            message.id === 8 ? { ...message, body, is_edited: true } : message
          )),
        };
        return jsonResponse({ success: true });
      }
      if (url.pathname === '/support/tickets/1/messages/8' && method === 'DELETE') {
        ticket = {
          ...ticket,
          messages: ticket.messages.filter((message) => message.id !== 8),
        };
        return jsonResponse({ success: true });
      }
      if (url.pathname === '/support/tickets/1/messages' && method === 'POST') {
        const message = JSON.parse(options.body);
        ticket = {
          ...ticket,
          revision: ticket.revision + 1,
          messages: [...ticket.messages, {
            id: ticket.messages.length + 1,
            body: message.body,
            is_internal: message.is_internal,
            sender_type: 'admin',
          }],
        };
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSupportInbox />);
    await screen.findByRole('heading', { name: 'Test ticket' });

    expect(screen.queryByLabelText('Assign admin')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save assignment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Assign to me' })).toBeNull();
    expect(screen.queryByText(/Current assignee:/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit message 8' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message 8' }), {
      target: { value: 'Updated admin message' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save edit 8' }));
    expect(await screen.findByText('Updated admin message')).toBeTruthy();
    expect(screen.getByText('(edited)')).toBeTruthy();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete message 8' }));
    await waitFor(() => {
      expect(requests.some((request) => (
        request.url.pathname === '/support/tickets/1/messages/8'
        && request.method === 'DELETE'
      ))).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText('Updated admin message')).toBeNull());

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'In Progress' } });
    await waitFor(() => {
      expect(requests.some((request) => (
        request.url.pathname === '/support/tickets/1'
        && request.method === 'PATCH'
        && JSON.parse(request.options.body).status === 'In Progress'
      ))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Status').value).toBe('In Progress');
    });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A public reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send public reply' }));
    expect(await screen.findByText('A public reply')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Internal note'));
    expect(await screen.findByText('Private internal note')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'An internal note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save internal note' }));
    expect(await screen.findByText('An internal note')).toBeTruthy();

    await waitFor(() => {
      const messageRequests = requests.filter((request) => (
        request.url.pathname === '/support/tickets/1/messages'
        && request.method === 'POST'
      ));
      expect(messageRequests).toHaveLength(2);
      expect(JSON.parse(messageRequests[0].options.body)).toMatchObject({
        body: 'A public reply',
        is_internal: false,
      });
      expect(JSON.parse(messageRequests[1].options.body)).toMatchObject({
        body: 'An internal note',
        is_internal: true,
      });
    });
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