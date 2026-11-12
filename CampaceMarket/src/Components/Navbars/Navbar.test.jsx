import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Navbar from './Navbar';
import HeroSection from '../Home/HeroSection';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => key,
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));
vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ items: [{ quantity: 2 }], cartBadgeDismissed: false }),
}));

const student = { studentId: 'student-1', role: 'student' };

function renderNavbar(props = {}) {
  const onNavigate = vi.fn();
  const onProductSearch = vi.fn();
  render(
    <Navbar
      onNavigate={onNavigate}
      onProductSearch={onProductSearch}
      user={student}
      userRole="student"
      variant="dashboard"
      {...props}
    />,
  );
  return { onNavigate, onProductSearch };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Navbar marketplace header', () => {
  it('shows the navbar search for authenticated users on the home page', () => {
    window.history.replaceState({}, '', '/');
    renderNavbar({ user: student, variant: 'public' });

    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeTruthy();
  });

  it('hides the navbar search for guests on the home page', () => {
    window.history.replaceState({}, '', '/');
    renderNavbar({ user: null, userRole: null, variant: 'public' });

    expect(screen.queryByRole('searchbox', { name: 'Search products' })).toBeNull();
  });

  it('shows the navbar search for guests away from the home page', () => {
    window.history.replaceState({}, '', '/product/42');
    renderNavbar({ user: null, userRole: null, variant: 'public' });

    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeTruthy();
  });

  it('switches to Browse Market when the URL indicates seller mode', () => {
    window.history.replaceState({}, '', '/dashboard?mode=seller');
    const { onNavigate } = renderNavbar({ variant: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'Browse Market' }));

    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=buyer');
  });

  it('switches to Browse Market when the active dashboard mode is seller', () => {
    const { onNavigate } = renderNavbar({ activeStudentMode: 'seller' });

    fireEvent.click(screen.getByRole('button', { name: 'Browse Market' }));

    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=buyer');
  });

  it('hides the Hero search form when the user is authenticated', () => {
    render(
      <HeroSection
        searchQuery=""
        onSearch={() => { }}
        onSearchQueryChange={() => { }}
        categories={[]}
        selectedCategory=""
        onCategoryChange={() => { }}
        onQuickFilter={() => { }}
        searchPlaceholder="Search products"
        showSearch={false}
      />,
    );

    expect(screen.queryByRole('searchbox', { name: 'Search UniXchange listings' })).toBeNull();
  });

  it('submits a global product search and keeps the sell action available', () => {
    const { onProductSearch, onNavigate } = renderNavbar({ variant: 'public' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'desk lamp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onProductSearch).toHaveBeenCalledWith('desk lamp');
    const sellButton = screen.getByRole('button', { name: 'Sell an Item' });
    fireEvent.click(sellButton);
    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=seller');
    expect(screen.queryByText('About')).toBeNull();
    expect(screen.queryByText('Services')).toBeNull();
    expect(screen.queryByText('Contact')).toBeNull();
  });

  it('shows messages, cart, and notifications with the cart badge count', () => {
    const { onNavigate } = renderNavbar();

    expect(screen.getByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cart' })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cart' }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, '/dashboard?tab=messages', undefined);
    expect(onNavigate).toHaveBeenNthCalledWith(2, '/dashboard?mode=buyer&tab=cart');
  });

  it('provides dashboard, orders, settings, and logout from the profile menu', () => {
    const onLogout = vi.fn();
    const { onNavigate } = renderNavbar({ onLogout });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open account menu' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onNavigate).toHaveBeenCalledWith('/dashboard');
    fireEvent.click(screen.getAllByRole('button', { name: 'Open account menu' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'My Orders' }));
    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=buyer&tab=orders');
    expect(screen.queryByRole('button', { name: 'My Orders' })).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open account menu' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/dashboard?tab=settings', undefined);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open account menu' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('keeps global search and marketplace actions in the dashboard header', () => {
    renderNavbar({ variant: 'dashboard' });

    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sell an Item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cart' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open notifications' })).toBeTruthy();
  });
});
