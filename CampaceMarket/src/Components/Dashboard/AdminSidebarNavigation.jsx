import { ADMIN_NAV_ITEM_STYLES, formatAdminBadgeCount, getAdminGroupBadgeTotal } from '../../utils/adminNavigation';

function renderBadge(item, counts) {
  if (item.badgeKey === 'support') {
    const unseenCount = Number(counts.unseenSupport || 0);
    const overdueCount = Number(counts.supportOverdue || 0);
    if (!unseenCount && !overdueCount) return null;
    return (
      <span className="inline-flex items-center gap-1.5">
        {unseenCount > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">{formatAdminBadgeCount(unseenCount)}</span>}
        {overdueCount > 0 && <span className="rounded-full bg-rose-700 px-1.5 py-0.5 text-[9px] font-black text-white" aria-label={`${overdueCount} overdue tickets`}>{formatAdminBadgeCount(overdueCount)}</span>}
      </span>
    );
  }
  const count = Number(counts[item.badgeKey] || 0);
  if (!count) return null;
  const badgeClass = item.badgeKey === 'unseenReports'
    ? 'bg-rose-500 text-white'
    : item.badgeKey === 'pendingVerifications'
      ? 'bg-amber-400 text-amber-950'
      : 'bg-sky-500 text-white';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${badgeClass}`}>{formatAdminBadgeCount(count)}</span>;
}

function AdminSidebarNavigation({
  navigation,
  activePath,
  counts,
  collapsed,
  expandedGroups,
  onNavigate,
  onGroupToggle,
}) {
  return navigation.map((entry) => {
    if (entry.type === 'link') {
      const isActive = activePath === entry.path;
      return (
        <button
          key={entry.key}
          type="button"
          onClick={() => onNavigate(entry.path)}
          title={collapsed ? entry.label : undefined}
          aria-label={collapsed ? entry.label : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={`mb-1 flex w-full shrink-0 items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isActive ? ADMIN_NAV_ITEM_STYLES.active : ADMIN_NAV_ITEM_STYLES.idle} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
        >
          <span className={`flex min-w-0 items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}>
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={entry.icon} />
            </svg>
            <span className={collapsed ? 'lg:hidden' : ''}>{entry.label}</span>
          </span>
          {!collapsed && renderBadge(entry, counts)}
        </button>
      );
    }

    const isOpen = expandedGroups.includes(entry.key);
    const hasActiveChild = entry.items.some((item) => item.path === activePath);
    const groupBadgeTotal = getAdminGroupBadgeTotal(entry, counts);
    const groupId = `admin-menu-group-${entry.key}`;
    return (
      <div key={entry.key} className="mb-1">
        <button
          type="button"
          onClick={() => onGroupToggle(entry.key, collapsed)}
          title={collapsed ? entry.label : undefined}
          aria-label={collapsed ? entry.label : undefined}
          aria-expanded={collapsed ? false : isOpen}
          aria-controls={groupId}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${hasActiveChild ? ADMIN_NAV_ITEM_STYLES.groupActive : ADMIN_NAV_ITEM_STYLES.groupIdle} ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
        >
          <span className={`flex min-w-0 items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}>
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={entry.icon} />
            </svg>
            <span className={collapsed ? 'lg:hidden' : ''}>{entry.label}</span>
          </span>
          {collapsed ? (
            groupBadgeTotal > 0 && <span className="hidden rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-black text-white lg:inline-flex">{formatAdminBadgeCount(groupBadgeTotal)}</span>
          ) : (
            <span className="flex items-center gap-2">
              {groupBadgeTotal > 0 && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-black text-white">{formatAdminBadgeCount(groupBadgeTotal)}</span>}
              <svg className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </span>
          )}
        </button>
        {collapsed && <div id={groupId} hidden />}
        {!collapsed && (
          <div id={groupId} className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="ml-4 border-l border-white/10 py-1 pl-2">
                {entry.items.map((item) => {
                  const isActive = activePath === item.path;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onNavigate(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isActive ? ADMIN_NAV_ITEM_STYLES.active : ADMIN_NAV_ITEM_STYLES.idle}`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        <span>{item.label}</span>
                      </span>
                      {renderBadge(item, counts)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  });
}

export default AdminSidebarNavigation;
