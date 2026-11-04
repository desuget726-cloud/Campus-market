import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampusAnnouncementBanner from './CampusAnnouncementBanner';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('CampusAnnouncementBanner', () => {
  it('loads public announcements and dismisses them for the session', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 17,
        title: 'Campus update',
        message: 'The student center is open.',
        created_at: new Date(now).toISOString(),
        banner_pinned: true,
      }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<CampusAnnouncementBanner />);

    expect(await screen.findByText('Campus update')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/announcements/active'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss campus announcement' }));
    await waitFor(() => expect(screen.queryByText('Campus update')).toBeNull());
    expect(window.localStorage.getItem('announcement_snooze_17')).toBe(String(now));
    expect(window.sessionStorage.getItem('announcement_session_dismissed_17')).toBe(String(now));

    unmount();
    window.sessionStorage.clear();
    vi.mocked(Date.now).mockReturnValue(now + 4 * 60 * 60 * 1000);
    render(<CampusAnnouncementBanner />);
    expect(await screen.findByText('Campus update')).toBeTruthy();
  });

  it('does not render announcements older than 72 hours', async () => {
    const now = Date.now();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 19,
        title: 'Expired update',
        message: 'This announcement is too old.',
        created_at: new Date(now - 73 * 60 * 60 * 1000).toISOString(),
        urgent_banner: true,
      }],
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CampusAnnouncementBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText('Expired update')).toBeNull();
  });

  it('opens the full poster and message from an image-bearing announcement banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 18,
        title: 'Poster announcement',
        message: 'Read the complete event details here.',
        image_url: 'https://res.cloudinary.com/campus/image/upload/poster.png',
        created_at: new Date().toISOString(),
        banner_pinned: true,
      }],
    }));

    render(<CampusAnnouncementBanner />);

    fireEvent.click(await screen.findByRole('button', { name: 'View announcement: Poster announcement' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('img').getAttribute('src')).toBe(
      'https://res.cloudinary.com/campus/image/upload/poster.png',
    );
    expect(screen.getByRole('heading', { name: 'Poster announcement' })).toBeTruthy();
    expect(screen.getByText('Read the complete event details here.')).toBeTruthy();
  });
});
