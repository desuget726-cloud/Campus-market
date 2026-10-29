import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminProfileMenu from './AdminProfileMenu';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const profile = {
  username: 'mau9999',
  email: 'admin@example.com',
};

describe('AdminProfileMenu', () => {
  it('opens the menu and closes it on Escape with focus returned to the button', async () => {
    const user = userEvent.setup();
    render(<AdminProfileMenu key="dashboard" user={profile} />);
    const trigger = screen.getByRole('button', { name: 'Open admin profile menu for mau9999' });

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside click and on route change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <AdminProfileMenu key="dashboard" user={profile} />
        <button type="button">Outside</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Open admin profile menu for mau9999' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    rerender(
      <>
        <AdminProfileMenu key="settings" user={profile} />
        <button type="button">Outside</button>
      </>,
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('logs out immediately without a confirmation dialog', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    render(<AdminProfileMenu user={profile} onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: 'Open admin profile menu for mau9999' }));
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('shows only the avatar in collapsed mode and uses initials when no image exists', async () => {
    const user = userEvent.setup();
    render(<AdminProfileMenu user={profile} collapsed />);
    const trigger = screen.getByRole('button', { name: 'Open admin profile menu for mau9999' });

    expect(within(trigger).getByText('M')).toBeTruthy();
    expect(within(trigger).queryByText('ADMIN')).toBeNull();
    expect(within(trigger).queryByText('mau9999')).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
