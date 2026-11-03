import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsInbox from './ReportsInbox';

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('../../api/apiClient', () => apiMocks);

beforeEach(() => {
  window.localStorage.setItem('campaceSession', JSON.stringify({
    user: { studentId: 'reporter-1' },
  }));
  window.history.pushState({}, '', '/dashboard?item=support-1');
  apiMocks.apiFetch.mockResolvedValue({});
  apiMocks.apiGet.mockImplementation((path) => {
    if (path === '/api/student/reports/participating') return Promise.resolve([]);
    if (path === '/api/student/support/tickets') {
      return Promise.resolve({
        items: [{
          id: 1,
          ticket_number: 'SUP-0001',
          subject: 'Wallet question',
          status: 'Open',
          updated_at: '2026-10-01T12:00:00',
        }],
      });
    }
    if (path.startsWith('/api/student/support/tickets/')) {
      const error = new Error('Support ticket not found.');
      error.status = 404;
      return Promise.reject(error);
    }
    return Promise.resolve({ notifications: [] });
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('ReportsInbox', () => {
  it('lets students edit and delete only their own support messages', async () => {
    let ticket = {
      id: 1,
      ticket_number: 'SUP-0001',
      subject: 'Wallet question',
      category: 'General Inquiry',
      status: 'Open',
      messages: [
        {
          id: 11,
          sender_type: 'student',
          body: 'Original student message',
          created_at: '2026-10-01T12:00:00',
          is_edited: false,
          can_edit: true,
          can_delete: true,
        },
        {
          id: 22,
          sender_type: 'admin',
          body: 'Admin response',
          created_at: '2026-10-01T12:01:00',
          is_edited: false,
          can_edit: false,
          can_delete: false,
        },
      ],
    };
    const requests = [];
    apiMocks.apiGet.mockImplementation((path) => {
      if (path === '/api/student/reports/participating') return Promise.resolve([]);
      if (path === '/api/student/support/tickets') return Promise.resolve({ items: [ticket] });
      if (path === '/api/student/support/tickets/1') return Promise.resolve(ticket);
      return Promise.resolve({ notifications: [] });
    });
    apiMocks.apiFetch.mockImplementation((path, options = {}) => {
      requests.push({ path, options });
      if (path === '/support/tickets/1/messages/11' && options.method === 'PATCH') {
        const { body } = JSON.parse(options.body);
        ticket = {
          ...ticket,
          messages: ticket.messages.map((message) => (
            message.id === 11 ? { ...message, body, is_edited: true } : message
          )),
        };
      }
      if (path === '/support/tickets/1/messages/11' && options.method === 'DELETE') {
        ticket = {
          ...ticket,
          messages: ticket.messages.filter((message) => message.id !== 11),
        };
      }
      return Promise.resolve({});
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ReportsInbox accessToken="student-token" />);
    expect(await screen.findByText('Original student message')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit message 22' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete message 22' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit message 11' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message 11' }), {
      target: { value: 'Edited student message' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save edit 11' }));
    expect(await screen.findByText('Edited student message')).toBeTruthy();
    expect(screen.getByText('(edited)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete message 11' }));
    await waitFor(() => {
      expect(requests.some((request) => (
        request.path === '/support/tickets/1/messages/11'
        && request.options.method === 'DELETE'
      ))).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText('Edited student message')).toBeNull());
  });

  it('shows a not-found message for a deep-linked ticket and returns to the ticket list', async () => {
    render(<ReportsInbox accessToken="student-token" />);

    expect((await screen.findByRole('alert')).textContent).toContain('Ticket not found or not yours');
    expect(apiMocks.apiGet).toHaveBeenCalledWith(
      '/api/student/support/tickets',
      expect.objectContaining({
        headers: { Authorization: 'Bearer student-token' },
      }),
    );
    expect(apiMocks.apiGet.mock.calls.some(([path]) => (
      path === '/api/student/support/tickets/1'
    ))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back to ticket list' }));

    await waitFor(() => expect(window.location.search).not.toContain('item='));
    expect(screen.getByRole('button', { name: /SUP-0001/ })).toBeTruthy();
    expect(screen.getByText('Select a report or support request to view its updates.')).toBeTruthy();
  });
});
