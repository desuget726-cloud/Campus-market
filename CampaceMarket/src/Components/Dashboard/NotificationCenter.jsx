import { useMemo, useState } from 'react';

const filters = ['All', 'Orders', 'Messages', 'Payments', 'Products', 'System'];

const getCategory = (notification) => {
    const value = `${notification.type || ''} ${notification.category || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    if (/order|purchase|delivery|pickup/.test(value)) return 'Orders';
    if (/message|chat|reply|inbox/.test(value)) return 'Messages';
    if (/payment|wallet|chapa|transaction|refund/.test(value)) return 'Payments';
    if (/product|listing|approval|approved|rejected/.test(value)) return 'Products';
    return 'System';
};

const getPriority = (notification) => {
    const value = `${notification.type || ''} ${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    if (/fail|reject|declin|cancel/.test(value)) return { label: 'Important', color: 'bg-red-500', border: 'border-l-red-500', icon: '🔴' };
    if (/pending|await|accept|received order/.test(value)) return { label: 'Action Required', color: 'bg-amber-500', border: 'border-l-amber-500', icon: '🟡' };
    if (/message|chat|reply/.test(value)) return { label: 'Information', color: 'bg-blue-500', border: 'border-l-blue-500', icon: '🔵' };
    if (/success|successful|approved|completed|confirmed/.test(value)) return { label: 'Success', color: 'bg-emerald-500', border: 'border-l-emerald-500', icon: '🟢' };
    return { label: 'System', color: 'bg-slate-400', border: 'border-l-slate-400', icon: '⚪' };
};

const getTimeframe = (createdAt) => {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'EARLIER';
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDifference = Math.round((startOfToday - startOfDate) / 86400000);
    if (dayDifference === 0) return 'TODAY';
    if (dayDifference === 1) return 'YESTERDAY';
    return 'EARLIER';
};

function NotificationCenter({ notifications, unreadCount, isMarkingRead, onMarkAllRead, onNavigate, onBuyerOrders }) {
    const [activeFilter, setActiveFilter] = useState('All');
    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const filteredNotifications = useMemo(() => safeNotifications.filter((notification) => activeFilter === 'All' || getCategory(notification) === activeFilter), [activeFilter, safeNotifications]);
    const groupedNotifications = ['TODAY', 'YESTERDAY', 'EARLIER'].map((label) => ({
        label,
        items: filteredNotifications.filter((notification) => getTimeframe(notification.created_at) === label),
    })).filter((group) => group.items.length > 0);

    const handleAction = (notification) => {
        const category = getCategory(notification);
        if (category === 'Orders') onBuyerOrders();
        else if (category === 'Messages') onNavigate('messages');
        else if (category === 'Products') onNavigate('seller');
        else if (category === 'Payments') onNavigate('buyer');
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-600">Notification Center</p><h2 className="mt-2 text-3xl font-black text-slate-950">Stay ahead of campus activity.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Orders, messages, payments, listings, and system updates organized into one actionable feed.</p></div>
                    <div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">{safeNotifications.length} total <span className="mx-1 text-slate-300">•</span> {unreadCount} unread</span><button type="button" onClick={onMarkAllRead} disabled={!safeNotifications.length || isMarkingRead} className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isMarkingRead ? 'Marking…' : 'Mark all as read'}</button></div>
                </div>

                <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4">{filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter}</button>)}</div>

                {groupedNotifications.length === 0 ? <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><div className="text-4xl">🔔</div><p className="mt-4 text-lg font-bold text-slate-900">You're all caught up! There are no new notifications right now.</p><p className="mt-2 text-sm text-slate-500">New campus activity will appear here as it happens.</p></div> : <div className="mt-8 space-y-8">{groupedNotifications.map((group) => <section key={group.label}><div className="mb-3 flex items-center gap-3"><h3 className="text-xs font-black tracking-[0.25em] text-slate-500">{group.label}</h3><span className="h-px flex-1 bg-slate-200" /></div><div className="space-y-3">{group.items.map((notification) => { const priority = getPriority(notification); const category = getCategory(notification); return <article key={notification.id ?? `${notification.created_at}-${notification.title}`} className={`border-l-4 ${priority.border} rounded-r-2xl border-y border-r border-slate-200 bg-slate-50/70 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${priority.color}`} title={priority.label} /><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-slate-950">{notification.title || 'Campus update'}</h4><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{priority.icon} {priority.label}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p></div></div><div className="shrink-0 text-left sm:text-right"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${notification.read ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>{notification.read ? 'Read' : 'New'}</span><p className="mt-2 text-xs text-slate-400">{new Date(notification.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{category}</span>{category !== 'System' && <button type="button" onClick={() => handleAction(notification)} className="text-sm font-black text-sky-700 hover:text-sky-900">{category === 'Orders' ? 'View Order →' : category === 'Messages' ? 'Reply →' : category === 'Products' ? 'View Product →' : 'View Payment →'}</button>}</div></article>; })}</div></section>)}</div>}
            </section>
        </div>
    );
}

export default NotificationCenter;
