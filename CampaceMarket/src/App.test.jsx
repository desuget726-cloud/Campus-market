import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import App from './App';

vi.mock('./Components/Navbars/Navbar', () => ({
  default: () => <div>Navbar</div>,
}));

vi.mock('./Components/Navbars/TopBar', () => ({
  default: () => <div>TopBar</div>,
}));

vi.mock('./Components/Authontication/RegisterForm', () => ({
  default: () => <div>Register Form</div>,
}));

vi.mock('./Components/Authontication/LoginForm', () => ({
  default: () => <div>Login Form</div>,
}));

vi.mock('./Components/Home/HomeView', () => ({
  default: () => <div>Home View</div>,
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
  default: ({ initialTab }) => (
    <div data-testid="admin-dashboard">
      <span>Dashboard tab: {initialTab}</span>
    </div>
  ),
}));

vi.mock('./Components/Dashboard/StudentDashboard', () => ({
  default: function MockStudentDashboard({ initialTab, dashboardLink, onTabChange }) {
    useEffect(() => {
      onTabChange?.(initialTab);
    }, [initialTab, onTabChange]);
    return (
      <div data-testid="student-dashboard">
        <span>Student tab: {initialTab}</span>
        <span>Student section: {dashboardLink?.section || 'none'}</span>
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

  describe('student dashboard deep links', () => {
    beforeEach(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.history.replaceState({}, '', '/');
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildStudentSession()));
    });

    afterEach(() => {
      cleanup();
    });

    it('opens and restores a seller warning deep link after remount', async () => {
      window.history.replaceState({}, '', '/dashboard?tab=seller&section=warnings&item=report-16');

      const firstRender = render(<App />);
      expect(await screen.findByText('Student tab: seller')).toBeTruthy();
      expect(screen.getByText('Student section: warnings')).toBeTruthy();
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

  it('falls back to Dashboard for an unknown admin section', async () => {
    window.history.replaceState({}, '', '/?tab=not-a-real-section');
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(buildAdminSession({ adminTab: 'not-a-real-section' })));

    render(<App />);

    await waitFor(() => expect(window.location.search).toContain('tab=dashboard'));
    expect(await screen.findByText(/Dashboard tab: dashboard/i)).toBeTruthy();
  });
});
