import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SellerModerationNotices from './SellerModerationNotices';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiClient', () => ({ apiGet }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SellerModerationNotices', () => {
  it('shows only the logged-in seller notice content for a deep-linked report', async () => {
    apiGet.mockResolvedValue({
      items: [{
        id: 246,
        report_id: 16,
        action: 'warning',
        title: 'Marketplace warning',
        reason: 'Please provide accurate listing details.',
        created_at: '2026-10-25T12:00:00',
        product: {
          id: 3,
          title: 'Laptop',
          status: 'Active',
          warning_count: 1,
        },
      }],
    });

    render(<SellerModerationNotices section="warnings" itemId={16} accessToken="student-token" />);

    expect(await screen.findByText('Marketplace warning')).toBeTruthy();
    expect(screen.getByText('Please provide accurate listing details.')).toBeTruthy();
    expect(screen.getByText('Laptop')).toBeTruthy();
    expect(screen.getByText('Product status: Active')).toBeTruthy();
    expect(screen.getByText('Warnings on your account: 1')).toBeTruthy();
    expect(screen.queryByText(/reporter|internal admin/i)).toBeNull();
    expect(apiGet).toHaveBeenCalledWith('/api/student/moderation/notices', {
      headers: { Authorization: '******' },
    });
  });

  it('returns to the safe dashboard when the requested notice is not in the owner list', async () => {
    const onInvalidLink = vi.fn();
    apiGet.mockResolvedValue({ items: [] });

    render(
      <SellerModerationNotices
        section="warnings"
        itemId={16}
        onInvalidLink={onInvalidLink}
      />,
    );

    await waitFor(() => {
      expect(onInvalidLink).toHaveBeenCalledWith(
        'This notice is unavailable for your account, so Home is shown.',
      );
    });
  });
});
