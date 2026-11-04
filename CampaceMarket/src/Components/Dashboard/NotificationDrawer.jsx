import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { buildOrderDashboardUrl } from '../../utils/orderDashboardLink';

const getAccessToken = (user) => (
  user?.access_token
  || user?.accessToken
  || user?.token
  || ''
);

const getNotificationItems = (data) => {
  const items = Array.isArray(data)
    ? data
    : data?.notifications || data?.allNotifications || data?.items || [];
  return items.map((item) => ({
    ...item,
    read: Boolean(item.read ?? item.is_read),
  }));
};

const getNotificationError = async (response, fallback) => {
  const data = await response.json().catch(() => null);
  const detail = typeof data?.detail === 'string' ? data.detail : data?.detail?.message;
  return new Error(detail || data?.message || `${fallback} (HTTP ${response.status})`);
};

const formatTimestamp = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const getNotificationTarget = (notification) => {
  const type = String(notification.type || notification.category || notification.reference_type || '').toLowerCase();
  const title = String(notification.title || '');
  const text = `${title} ${notification.message || notification.description || ''}`.toLowerCase();
  const actionUrl = notification.action_url || notification.actionUrl;
  let actionParams = null;
  if (actionUrl) {
    try {
      actionParams = new URL(actionUrl, window.location.origin).searchParams;
    } catch {
      actionParams = null;
    }
  }

  if (type === 'support' || type.includes('support') || /support/i.test(title)) {
    const ticketId = notification.ticket_id
      || notification.ticketId
      || notification.reference_id
      || actionParams?.get('ticket')
      || actionParams?.get('item')
      || /(?:SUP[-\s]?0*)(\d+)/i.exec(title)?.[1];
    const ticketNumber = ticketId
      ? /^(?:SUP[-\s]?|support-)?0*(\d+)$/i.exec(String(ticketId))?.[1] || String(ticketId)
      : null;
    const ticketParam = ticketNumber ? `&item=support-${encodeURIComponent(ticketNumber)}` : '';
    return `/dashboard?tab=buyer&section=reports-support${ticketParam}`;
  }

  if (type === 'seller_order' || text.includes('payment received')) {
    return '/dashboard?mode=seller&tab=customer_orders';
  }

  if (type === 'wallet' || /withdraw|deposit/i.test(`${type} ${title}`)) {
    return '/dashboard?tab=buyer&section=payments';
  }

  if (type.includes('chat') || type.includes('message') || text.includes('new message')) {
    const conversationId = notification.conversation_id
      || notification.conversationId
      || notification.chat_thread_id
      || notification.chatThreadId
      || actionParams?.get('conversation');
    return `/dashboard?tab=messages${conversationId ? `&conversation=${encodeURIComponent(conversationId)}` : ''}`;
  }

  if (type === 'order' || text.includes('payment completed') || type.includes('order') || text.includes('order')) {
    const orderId = notification.order_id
      || notification.orderId
      || (type.includes('order') || text.includes('payment completed') ? notification.reference_id : null)
      || actionParams?.get('order');
    return orderId
      ? buildOrderDashboardUrl(orderId, 'buyer')
      : '/dashboard?tab=buyer&section=orders';
  }

  if (actionUrl) {
    const actionTarget = String(actionUrl).trim().toLowerCase();
    const dashboardTargets = {
      buyer: '/dashboard?mode=buyer&tab=buyer&section=search',
      orders: '/dashboard?mode=buyer&tab=buyer&section=orders',
      payments: '/dashboard?mode=buyer&tab=buyer&section=payments',
      messages: '/dashboard?tab=messages',
    };
    return dashboardTargets[actionTarget] || actionUrl;
  }

  return '/dashboard?tab=notifications';
};

function NotificationDrawer({
  open,
  user,
  userRole,
  unreadCount = 0,
  onUnreadCountChange,
  onClose,
  onNavigate,
  onViewAll,
  onNotificationSelect,
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const closeButtonRef = useRef(null);
  const role = String(userRole || user?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const isAdmin = ['admin', 'sub_admin', 'super_admin'].includes(role);
  const studentId = user?.studentId || user?.student_id;
  const token = getAccessToken(user);
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const resolvedUnreadCount = hasLoaded ? unreadNotifications : unreadCount;

  const fetchNotifications = useCallback(async (signal, { quiet = false } = {}) => {
    if (!user || (!isAdmin && !studentId)) return;
    if (!quiet) {
      setLoading(true);
      setError('');
      setHasLoaded(false);
    }
    try {
      const endpoint = isAdmin
        ? `${API_BASE_URL}/support/notifications`
        : `${API_BASE_URL}/api/student/notifications?student_id=${encodeURIComponent(studentId)}`;
      const response = await fetch(endpoint, {
        signal,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw await getNotificationError(response, 'Unable to load notifications');
      const data = await response.json();
      const items = getNotificationItems(data);
      setNotifications(items);
      setHasLoaded(true);
      onUnreadCountChange?.(items.filter((item) => !item.read).length);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        console.error('Failed to load notifications:', requestError);
        setError(requestError.message || 'Unable to load notifications.');
      }
    } finally {
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [isAdmin, onUnreadCountChange, studentId, token, user]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    let requestInFlight = false;
    const loadNotifications = async (quiet = false) => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        await fetchNotifications(controller.signal, { quiet });
      } finally {
        requestInFlight = false;
      }
    };
    void loadNotifications();
    const refreshId = window.setInterval(() => void loadNotifications(true), 30_000);
    closeButtonRef.current?.focus();
    return () => {
      controller.abort();
      window.clearInterval(refreshId);
    };
  }, [fetchNotifications, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, open]);

  const request = async (endpoint, body) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw await getNotificationError(response, 'Unable to update notifications');
  };

  const handleMarkAllRead = async () => {
    setError('');
    try {
      if (isAdmin) {
        await request('/support/notifications/read-all');
      } else {
        await request(`/api/student/notifications/mark-all-read?student_id=${encodeURIComponent(studentId)}`);
      }
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      onUnreadCountChange?.(0);
    } catch (requestError) {
      console.error('Failed to mark all notifications as read:', requestError);
      setError(requestError.message || 'Unable to mark notifications as read.');
    }
  };

  const markRead = async (notification) => {
    if (notification.read) return;
    setNotifications((current) => current.map((item) => (
      String(item.id) === String(notification.id) ? { ...item, read: true, is_read: true } : item
    )));
    onUnreadCountChange?.((current) => Math.max(0, current - 1));

    if (isAdmin) {
      await request(`/support/notifications/${encodeURIComponent(notification.id)}/read`);
    } else {
      await request('/api/student/notifications/mark-read', {
        student_id: studentId,
        notification_id: notification.id,
      });
    }
  };

  const handleNotificationClick = async (notification) => {
    setError('');
    const markReadRequest = markRead(notification);
    onClose?.();

    if (isAdmin && notification.reference_type === 'support') {
      onNotificationSelect?.(notification);
      try {
        await markReadRequest;
      } catch (requestError) {
        console.error('Failed to mark notification as read:', requestError);
      }
      return;
    }

    onNavigate?.(getNotificationTarget(notification));
    try {
      await markReadRequest;
    } catch (requestError) {
      console.error('Failed to mark notification as read:', requestError);
      setError(requestError.message || 'Unable to mark notification as read.');
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close notifications"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        id="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-96 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">Notifications</h2>
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                {resolvedUnreadCount}
              </span>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!resolvedUnreadCount}
              className="mt-1 text-xs font-semibold text-sky-700 hover:text-sky-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all as read
            </button>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <p role="status" className="p-6 text-center text-sm text-slate-500">Loading notifications…</p>
          )}
          {error && <p role="alert" className="mx-4 mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {!loading && !error && notifications.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">You’re all caught up.</p>
          )}
          <ul className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full cursor-pointer items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-lg" aria-hidden="true">
                    {String(notification.type || notification.category || notification.reference_type || '').toLowerCase().includes('order') ? '📦'
                      : String(notification.type || '').toLowerCase().includes('message') ? '💬'
                        : String(notification.type || '').toLowerCase().includes('payment') ? '💳'
                          : '🔔'}
                  </span>
                  <span className="min-w-0 flex-1">
                    {notification.image_url && (
                      <img
                        src={notification.image_url}
                        alt=""
                        className="mb-3 max-h-36 w-full rounded-lg object-cover"
                      />
                    )}
                    <span className="flex items-start gap-2">
                      <span className={`min-w-0 flex-1 text-sm ${notification.read ? 'font-medium text-slate-700' : 'font-bold text-slate-950'}`}>
                        {notification.title || 'Notification'}
                      </span>
                      {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Unread" />}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">{notification.message || notification.description || ''}</span>
                    <span className="mt-2 block text-xs text-slate-400">{formatTimestamp(notification.created_at || notification.timestamp)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onViewAll}
            className="w-full cursor-pointer rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-bold text-sky-700 transition hover:bg-sky-50"
          >
            View all notifications
          </button>
        </footer>
      </aside>
    </>
  );
}

export default NotificationDrawer;
