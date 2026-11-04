import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationDrawer from './NotificationDrawer';

const response = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => data,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NotificationDrawer', () => {
  it.each([
    ['support ticket', {
      id: 1,
      type: 'support',
      title: 'Support update SUP-0003',
    }, '/dashboard?tab=buyer&section=reports-support&item=support-3'],
    ['wallet deposit', {
      id: 2,
      type: 'wallet',
      title: 'Deposit received',
    }, '/dashboard?tab=buyer&section=payments'],
    ['seller order', {
      id: 3,
      type: 'seller_order',
      title: 'Payment received',
    }, '/dashboard?mode=seller&tab=customer_orders'],
    ['buyer order', {
      id: 4,
      type: 'order',
      title: 'Payment completed',
      order_id: 42,
    }, '/dashboard?tab=buyer&section=orders&order=42'],
    ['direct message', {
      id: 5,
      type: 'chat',
      title: 'New message',
      conversation_id: 'conv-9',
    }, '/dashboard?tab=messages&conversation=conv-9'],
  ])('marks and routes a %s notification', async (_label, notification, target) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ notifications: [{ ...notification, is_read: false }] }))
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(
      <NotificationDrawer
        open
        user={{ studentId: 'student-1', access_token: 'student-token' }}
        userRole="student"
        unreadCount={1}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    const item = await screen.findByRole('button', { name: new RegExp(notification.title) });
    expect(item.querySelector('[aria-label="Unread"]')).not.toBeNull();
    fireEvent.click(item);

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(target));
    await waitFor(() => expect(item.querySelector('[aria-label="Unread"]')).toBeNull());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('loads student notifications, marks one read, and navigates to its action', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        notifications: [{
          id: 21,
          title: 'Order update',
          message: 'Your order is ready.',
          type: 'order',
          action_url: '/dashboard?tab=buyer&section=orders',
          is_read: false,
          created_at: '2026-11-03T10:00:00Z',
        }],
      }))
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const onNavigate = vi.fn();
    const onUnreadCountChange = vi.fn();

    render(
      <NotificationDrawer
        open
        user={{ studentId: 'student-1', access_token: 'student-token' }}
        userRole="student"
        unreadCount={1}
        onUnreadCountChange={onUnreadCountChange}
        onNavigate={onNavigate}
      />,
    );

    const notification = await screen.findByRole('button', { name: /Order update/ });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/student/notifications?student_id=student-1');
    fireEvent.click(notification);

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/dashboard?tab=buyer&section=orders'));
    expect(fetchMock.mock.calls[1][0]).toContain('/api/student/notifications/mark-read');
    expect(onUnreadCountChange).toHaveBeenLastCalledWith(expect.any(Function));
  });

  it('renders the attached image on a broadcast notification', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({
      notifications: [{
        id: 22,
        title: 'Campus poster',
        message: 'A new campus event.',
        type: 'broadcast',
        image_url: 'https://res.cloudinary.com/campus/image/upload/event.png',
        is_read: true,
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationDrawer
        open
        user={{ studentId: 'student-1', access_token: 'student-token' }}
        userRole="student"
        unreadCount={0}
      />,
    );

    const notification = await screen.findByRole('button', { name: /Campus poster/ });
    expect(notification.querySelector('img').getAttribute('src')).toBe(
      'https://res.cloudinary.com/campus/image/upload/event.png',
    );
  });

  it('marks all student notifications as read from the drawer header', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        notifications: [{ id: 1, title: 'One', is_read: false }],
      }))
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationDrawer
        open
        user={{ studentId: 'student-1' }}
        userRole="student"
        unreadCount={1}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('/api/student/notifications/mark-all-read');
  });

  it('loads admin support notifications and opens the selected support item', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        items: [{
          id: 8,
          title: 'New support reply',
          message: 'A student replied to a ticket.',
          reference_type: 'support',
          reference_id: 35,
          is_read: false,
        }],
        unread_count: 1,
      }))
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const onNotificationSelect = vi.fn();

    render(
      <NotificationDrawer
        open
        user={{ role: 'admin', token: 'admin-token' }}
        userRole="admin"
        onNotificationSelect={onNotificationSelect}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /New support reply/ }));
    await waitFor(() => expect(onNotificationSelect).toHaveBeenCalledWith(expect.objectContaining({ reference_id: 35 })));
    expect(fetchMock.mock.calls[0][0]).toContain('/support/notifications');
    expect(fetchMock.mock.calls[1][0]).toContain('/support/notifications/8/read');
  });
});
