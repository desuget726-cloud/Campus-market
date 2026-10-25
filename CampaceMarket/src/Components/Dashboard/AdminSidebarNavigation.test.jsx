import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminSidebarNavigation from './AdminSidebarNavigation';
import { ADMIN_NAVIGATION } from '../../utils/adminNavigation';

afterEach(cleanup);

describe('AdminSidebarNavigation', () => {
  const reportGroup = ADMIN_NAVIGATION.find((entry) => entry.key === 'reports-system');

  it('renders and marks the active child when its group is expanded', () => {
    const { container } = render(
      <AdminSidebarNavigation
        navigation={[reportGroup]}
        activePath="reports"
        counts={{ unseenReports: 3 }}
        collapsed={false}
        expandedGroups={['reports-system']}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Reports');
    expect(screen.getByRole('button', { name: /Reports & System/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the sum of child badges in collapsed icon-only mode', () => {
    render(
      <AdminSidebarNavigation
        navigation={[reportGroup]}
        activePath="dashboard"
        counts={{ unseenReports: 2 }}
        collapsed
        expandedGroups={[]}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Reports & System' }).getAttribute('aria-controls')).toBe('admin-menu-group-reports-system');
    expect(screen.getByRole('button', { name: 'Reports & System' }).textContent).toContain('2');
    expect(screen.queryByRole('button', { name: 'Reports' })).toBeNull();
  });

  it('hides zero badges and caps report and group badges at 99+', () => {
    const { rerender } = render(
      <AdminSidebarNavigation
        navigation={[reportGroup]}
        activePath="reports"
        counts={{ unseenReports: 0 }}
        collapsed={false}
        expandedGroups={['reports-system']}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();

    rerender(
      <AdminSidebarNavigation
        navigation={[reportGroup]}
        activePath="reports"
        counts={{ unseenReports: 120 }}
        collapsed={false}
        expandedGroups={['reports-system']}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );
    expect(screen.getAllByText('99+')).toHaveLength(2);
  });

  it('shows unseen support separately from its overdue indicator, not the open total', () => {
    const supportItem = ADMIN_NAVIGATION.find((entry) => entry.key === 'support');
    const { rerender } = render(
      <AdminSidebarNavigation
        navigation={[supportItem]}
        activePath="dashboard"
        counts={{ supportOpen: 7, supportOverdue: 0 }}
        collapsed={false}
        expandedGroups={[]}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText('7')).toBeNull();

    rerender(
      <AdminSidebarNavigation
        navigation={[supportItem]}
        activePath="dashboard"
        counts={{ unseenSupport: 2, supportOverdue: 1 }}
        collapsed={false}
        expandedGroups={[]}
        onNavigate={vi.fn()}
        onGroupToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('delegates group expand and collapse to the caller', () => {
    const onGroupToggle = vi.fn();
    render(
      <AdminSidebarNavigation
        navigation={[reportGroup]}
        activePath="dashboard"
        counts={{}}
        collapsed={false}
        expandedGroups={[]}
        onNavigate={vi.fn()}
        onGroupToggle={onGroupToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Reports & System/ }));
    expect(onGroupToggle).toHaveBeenCalledWith('reports-system', false);
  });
});
