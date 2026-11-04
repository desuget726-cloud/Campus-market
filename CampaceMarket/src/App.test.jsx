import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import App from './App';
import { invalidateAdminSettingsCache } from './api/adminSettings';
import { API_BASE_URL } from './config';

vi.mock('./Components/Navbars/Navbar', () => ({
  default: ({ onNavigate, user }) => (
    <div>
      Navbar
      <button
        type="button"
        onClick={() => onNavigate(user ? '/dashboard?tab=buyer' : 'login', user ? undefined : { redirect: 'browse-market' })}
      >
        Browse Market
      </button>
      <button
        type="button"
        onClick={() => onNavigate(user ? '/dashboard?mode=seller' : 'login', user ? undefined : { redirect: 'post-item' })}
      >
        Sell an Item
      </button>
    </div>
  ),
}));

vi.mock('./Components/Navbars/TopBar', () => ({
  default: () => <div>TopBar</div>,
}));

vi.mock('./Components/Authontication/RegisterForm', () => ({
  default: () => <div>Register Form</div>,
}));

vi.mock('./Components/Authontication/LoginForm', () => ({
  default: ({ onLoginSuccess }) => (
    <div>
      Login Form
      <button
        type="button"
        onClick={() => onLoginSuccess({ studentId: 'student-1', role: 'student' }, 'student')}
      >
        Complete Student Login
      </button>
    </div>
  ),
}));

vi.mock('./Components/Home/HomeView', () => ({
  default: ({ onBackToSellerHub }) => (
    <div>
      Home View
      {onBackToSellerHub && (
        <button type="button" onClick={onBackToSellerHub}>Back to Seller Hub</button>
      )}
    </div>
  ),
}));

vi.mock('./Components/Views/AboutView', () => ({
  default: () => <div>About View</div>,
}));

vi.mock('./Components/Views/ServicesView', () => ({
  default: () => <div>Services View</div>,
}));

vi.mock('./Components/Views/ContactView', () => ({
  default: () => <div>Contact View</div>,
}));

vi.mock('./Components/Views/SellerProfileView', () => ({
  default: () => <div>Seller Profile</div>,
}));

vi.mock('./Components/Layout/Footer', () => ({
  default: () => <footer>Footer</footer>,
}));

vi.mock('./Components/Views/PolicyView', () => ({
  default: () => <div>Policy View</div>,
}));

vi.mock('./Components/Dashboard/AdminDashboard', () => ({
  default: ({ initialTab, onSessionTimeoutChange }) => (
    <div data-testid="admin-dashboard">
      <span>Dashboard tab: {initialTab}</span>
      <button type="button" onClick={() => onSessionTimeoutChange?.(1)}>
        Set timeout to one minute
      </button>
    </div>
  ),
}));

vi.mock('./Components/Dashboard/StudentDashboard', () => ({
  default: function MockStudentDashboard({ initialTab, dashboardLink, onTabChange, onNavigate }) {
    useEffect(() => {
      onTabChange?.(initialTab);
    }, [initialTab, onTabChange]);
    return (
      <div data-testid="student-dashboard">
        <span>Student tab: {initialTab}</span>
        <span>Student section: {dashboardLink?.section || 'none'}</span>
        <button
          type="button"
          onClick={() => onNavigate?.('product-details', { productId: 42, returnTo: 'seller-hub' })}
        >
          Open seller product
        </button>
      </div>
    );
  },
}));

vi.mock('./Components/Authontication/SuccessModal', () => ({
  default: () => <div>Success Modal</div>,
}));

vi.mock('./Components/Authontication/AuthInfoModal', () => ({
  default: () => <div>Auth Info Modal</div>,
}));

vi.mock('./Components/Notifications/PaymentSuccessToast', () => ({
  default: () => <div>Payment Success Toast</div>,
}));

const SESSION_STORAGE_KEY = 'campaceSession';
const buildAdminSession = (overrides = {}) => ({
  user: {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    access_token: 'token-123',
  },
  userRole: 'admin',
  currentView: 'admin-dashboard',
  access_token: 'token-123',
  accessToken: 'token-123',
  adminTab: 'dashboard',
  ...overrides,
});

const buildStudentSession = () => ({
  user: {
    studentId: 'seller-1',
    role: 'student',
    access_token: 'student-token',
  },
  userRole: 'student',
  currentView: 'student-dashboard',
  access_token: 'student-token',
});

describe('admin dashboard default section', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('uses the fetched inactivity setting and logs out only after the last activity', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession()));
    window.localStorage.setItem('token', 'legacy-token');
    invalidateAdminSettingsCache();
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(window, 'fetch').mockImplementation(async (request) => {
      const requestUrl = typeof request === 'string' ? request : request.url;
      if (requestUrl.includes('/api/admin/settings')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ security: { sessionTimeout: 1 } }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    try {
      render(<App />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50_000);
      });
      fireEvent.mouseMove(window);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(59_999);
      });
      expect(screen.getByTestId('admin-dashboard')).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText('Login Form')).toBeTruthy();
      expect(window.location.pathname).toBe('/login');
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem('token')).toBeNull();
      expect(fetchMock.mock.calls.some(([request, options]) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        return requestUrl.endsWith('/api/admin/logout') && options?.method === 'POST';
      })).toBe(true);
      expect(screen.getByText('Logged out due to inactivity.')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      fetchMock.mockRestore();
      invalidateAdminSettingsCache();
    }
  });

  it('sends a guest Browse Market login to the buyer dashboard', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Market' }));

    expect(await screen.findByText('Login Form')).toBeTruthy();
    expect(window.location.search).toBe('?redirect=browse-market');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Student Login' }));

    expect(await screen.findByText('Student tab: buyer')).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe('/dashboard?mode=buyer&tab=marketplace');
  });

  it('sends a guest Sell an Item login to the seller dashboard overview', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sell an Item' }));

    expect(await screen.findByText('Login Form')).toBeTruthy();
    expect(window.location.search).toBe('?redirect=post-item');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Student Login' }));

    expect(await screen.findByText('Student tab: seller')).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe('/dashboard?mode=seller');
  });

  it('redirects guest dashboard deep links to the public home page', async () => {
    window.history.replaceState({}, '', '/dashboard?tab=seller');
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);

    expect(await screen.findByText('Home View')).toBeTruthy();
    expect(screen.queryByTestId('student-dashboard')).toBeNull();
    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe('/');
    });
  });

  it('sends a guest order email deep link to login and restores it after sign-in', async () => {
    window.history.replaceState({}, '', '/dashboard?tab=my_orders&order_id=26');
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);

    expect(await screen.findByText('Login Form')).toBeTruthy();
    const returnTo = '/dashboard?tab=my_orders&order_id=26';
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe(returnTo);

    fireEvent.click(screen.getByRole('button', { name: 'Complete Student Login' }));

    expect(await screen.findByText('Student tab: buyer')).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe(returnTo);
  });

  it('does not restore a saved student dashboard view without a user session', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      currentView: 'student-dashboard',
      studentTab: 'seller',
    }));
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);

    expect(await screen.findByText('Home View')).toBeTruthy();
    expect(screen.queryByTestId('student-dashboard')).toBeNull();
  });

  describe('student dashboard deep links', () => {
    let fetchMock;

    beforeEach(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.history.replaceState({}, '', '/');
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildStudentSession()));
      fetchMock = vi.spyOn(window, 'fetch').mockImplementation(async (request) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        if (requestUrl.includes('/api/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              role: 'student',
              access_token: 'student-token',
              user: { studentId: 'seller-1', role: 'student' },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      });
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('opens and restores a seller warning deep link after remount', async () => {
      window.history.replaceState({}, '', '/dashboard?tab=seller&section=warnings&item=report-16');

      const firstRender = render(<App />);
      expect(await screen.findByText('Student tab: seller')).toBeTruthy();
      expect(screen.getByText('Student section: warnings')).toBeTruthy();
      const sessionCall = fetchMock.mock.calls.find(([request]) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        return requestUrl.includes('/api/auth/session');
      });
      const sessionOptions = sessionCall[1];
      expect(sessionOptions.credentials).toBe('include');
      expect(sessionOptions.headers.Authorization).toBe('Bearer student-token');
      firstRender.unmount();

      render(<App />);
      expect(await screen.findByText('Student tab: seller')).toBeTruthy();
      expect(screen.getByText('Student section: warnings')).toBeTruthy();
    });

    it('falls back to Home without a warning for an unknown dashboard section', async () => {
      window.history.replaceState({}, '', '/dashboard?tab=seller&section=unknown');

      render(<App />);

      expect(await screen.findByText('Student tab: home')).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('returns to Seller Hub after opening a product from the seller dashboard', async () => {
      window.history.replaceState({}, '', '/dashboard?tab=seller');

      render(<App />);
      fireEvent.click(await screen.findByRole('button', { name: 'Open seller product' }));

      expect(await screen.findByText('Home View')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Back to Seller Hub' }));

      expect(await screen.findByText('Student tab: seller')).toBeTruthy();
      expect(window.location.pathname + window.location.search).toBe('/dashboard?tab=seller');
    });

    it('clears an expired student session without starting student polling', async () => {
      fetchMock.mockImplementation(async (request) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        return requestUrl.includes('/api/auth/session')
          ? { ok: false, status: 401, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => ({}) };
      });

      render(<App />);

      expect(await screen.findByText('Login Form')).toBeTruthy();
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(fetchMock.mock.calls.filter(([request]) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        return requestUrl.includes('/api/auth/session');
      })).toHaveLength(1);
      expect(fetchMock.mock.calls.some(([request]) => {
        const requestUrl = typeof request === 'string' ? request : request.url;
        return requestUrl.includes('/api/student/notifications/unread-count')
          || requestUrl.includes('/api/student/cart');
      })).toBe(false);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Dashboard when the admin has no section param', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession()));

    render(<App />);

    const dashboard = await screen.findByTestId('admin-dashboard');
    expect(dashboard).toBeTruthy();
    expect(screen.getByText(/Dashboard tab: dashboard/i)).toBeTruthy();
    await waitFor(() => expect(window.location.search).toContain('tab=dashboard'));
  });

  it('does not request admin profile or sidebar counts before an admin session is stored', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const adminSessionRequests = fetchMock.mock.calls.filter(([request]) => {
      const requestUrl = typeof request === 'string' ? request : request.url;
      return requestUrl.includes('/api/admin/me')
        || requestUrl.includes('/api/admin/sidebar-counts');
    });
    expect(adminSessionRequests).toHaveLength(0);
  });

  it('adds the stored bearer token to API requests without an authorization header', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession()));
    const fetchMock = vi.spyOn(window, 'fetch').mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    render(<App />);
    await waitFor(() => expect(window.fetch).not.toBe(fetchMock));
    await window.fetch(`${API_BASE_URL}/api/test-auth-default`);

    const request = fetchMock.mock.calls.find(([url]) => url === `${API_BASE_URL}/api/test-auth-default`);
    expect(request[1].headers.get('Authorization')).toBe('Bearer token-123');

    await window.fetch('https://external.example/api/resource');
    const externalRequest = fetchMock.mock.calls.find(([url]) => url === 'https://external.example/api/resource');
    expect(externalRequest[1]).toBeUndefined();
  });

  it('clears and redirects once when an authenticated admin request returns a session code', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession()));
    const fetchMock = vi.spyOn(window, 'fetch').mockImplementation(async (request) => {
      const requestUrl = typeof request === 'string' ? request : request.url;
      if (requestUrl.includes('/api/admin/me')) {
        return {
          ok: false,
          status: 401,
          clone: () => ({
            json: async () => ({
              detail: {
                code: 'session_replaced',
                message: 'This admin session was replaced.',
              },
            }),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    });

    render(<App />);
    await waitFor(() => expect(window.fetch).not.toBe(fetchMock));
    await window.fetch(`${API_BASE_URL}/api/admin/me`, {
      headers: { Authorization: 'Bearer token-123' },
    });

    expect(await screen.findByText('Login Form')).toBeTruthy();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(fetchMock.mock.calls.filter(([request]) => {
      const requestUrl = typeof request === 'string' ? request : request.url;
      return requestUrl.includes('/api/admin/me');
    })).toHaveLength(1);
  });

  it('falls back to Dashboard for an unknown admin section', async () => {
    window.history.replaceState({}, '', '/?tab=not-a-real-section');
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession({ adminTab: 'not-a-real-section' })));

    render(<App />);

    await waitFor(() => expect(window.location.search).toContain('tab=dashboard'));
    expect(await screen.findByText(/Dashboard tab: dashboard/i)).toBeTruthy();
  });
});
