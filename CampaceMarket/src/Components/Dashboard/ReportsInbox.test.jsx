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
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('ReportsInbox', () => {
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
