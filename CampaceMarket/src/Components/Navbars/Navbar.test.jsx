import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Navbar from './Navbar';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => key,
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

const student = { studentId: 'student-1', role: 'student' };

function renderNavbar(props = {}) {
  const onNavigate = vi.fn();
  render(
    <Navbar
      onNavigate={onNavigate}
      user={student}
      userRole="student"
      variant="dashboard"
      {...props}
    />,
  );
  return onNavigate;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Navbar student mode actions', () => {
  it('shows the prominent sell action at the top of the mobile drawer and closes after switching', () => {
    const onNavigate = renderNavbar({ activeStudentMode: 'buyer', variant: 'public' });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle mobile navigation' }));
    const drawer = screen.getByLabelText('Mobile navigation');
    const sellButton = screen.getByRole('button', { name: /Sell an Item/i });

    expect(drawer.firstElementChild).toBe(sellButton);
    expect(sellButton.className).toContain('bg-sky-500');
    fireEvent.click(sellButton);

    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=seller');
    expect(screen.queryByLabelText('Mobile navigation')).toBeNull();
  });

  it('shows Switch to Buying at the top of the seller mobile drawer and closes after switching', () => {
    window.history.replaceState({}, '', '/?mode=seller');
    const onNavigate = renderNavbar({ activeStudentMode: 'seller', variant: 'public' });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle mobile navigation' }));
    const drawer = screen.getByLabelText('Mobile navigation');
    const switchButton = screen.getByRole('button', { name: /Switch to Buying/i });

    expect(drawer.firstElementChild).toBe(switchButton);
    expect(switchButton.className).toContain('bg-slate-800');
    fireEvent.click(switchButton);

    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=buyer');
    expect(screen.queryByLabelText('Mobile navigation')).toBeNull();
  });

  it('shows only Switch to Buying in the seller dashboard', () => {
    window.history.replaceState({}, '', '/dashboard?mode=seller');
    const onNavigate = renderNavbar({ activeStudentMode: 'seller' });

    const switchButton = screen.getByRole('button', { name: /Switch to Buying/i });
    expect(switchButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Browse Market/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sell an Item/i })).toBeNull();

    fireEvent.click(switchButton);
    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=buyer');
  });

  it('detects a seller inventory URL and hides the sell action', () => {
    window.history.replaceState({}, '', '/dashboard?tab=seller_hub/inventory');
    renderNavbar();

    expect(screen.getByRole('button', { name: /Switch to Buying/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sell an Item/i })).toBeNull();
  });

  it('shows only the prominent sell action in buyer mode', () => {
    window.history.replaceState({}, '', '/dashboard?mode=buyer');
    const onNavigate = renderNavbar({ activeStudentMode: 'buyer' });

    const sellButton = screen.getByRole('button', { name: /Sell an Item/i });
    expect(sellButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Browse Market/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch to Buying/i })).toBeNull();

    fireEvent.click(sellButton);
    expect(onNavigate).toHaveBeenCalledWith('/dashboard?mode=seller');
  });

  it('hides Browse Market on the public marketplace in buyer mode', () => {
    window.history.replaceState({}, '', '/?mode=buyer');
    renderNavbar({ activeStudentMode: 'buyer', variant: 'public' });

    expect(screen.getByRole('button', { name: /Sell an Item/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Browse Market/i })).toBeNull();
  });
});
