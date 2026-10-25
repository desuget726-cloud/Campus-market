import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiGet, apiPatch, getStoredAccessToken } from '../../api/apiClient';
import { API_BASE_URL } from '../../config';
import { getErrorMessage, notifySuccess } from '../../utils/notify';

const ticketStatuses = ['Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'];
const ticketStatusStyles = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-sky-100 text-sky-800',
  'Waiting for User': 'bg-violet-100 text-violet-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  Closed: 'bg-slate-200 text-slate-700',
};
const ticketSeenStyles = {
  unseen: 'font-black text-slate-950',
  seen: 'font-bold text-slate-700',
};
const ignoreSeenCount = () => {};
const formatRequestError = (requestError) => {
  const message = getErrorMessage(requestError);
  const detail = typeof message === 'string' ? message : requestError?.message || 'Request failed.';
  return requestError?.status ? `HTTP ${requestError.status}: ${detail}` : detail;
};

function AdminSupportInbox({ onItemsSeen = ignoreSeenCount }) {
  const token = getStoredAccessToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tickets, setTickets] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [counters, setCounters] = useState({});
  const [selectedId, setSelectedId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('ticket');
    return /^\d+$/.test(value || '') ? Number(value) : null;
  });
  const [detail, setDetail] = useState(null);
  const [canned, setCanned] = useState([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [internal, setInternal] = useState(false);
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'All') query.set('status', statusFilter);
      if (categoryFilter !== 'All') query.set('category', categoryFilter);
      if (overdueOnly) query.set('overdue', 'true');
      const [ticketResult, cannedResult, notificationResult] = await Promise.all([
        apiGet(`/support/tickets${query.size ? `?${query.toString()}` : ''}`, { headers }),
        apiGet('/support/canned-responses', { headers }),
        apiGet('/support/notifications', { headers }),
      ]);
      setTickets(ticketResult?.items || []);
      setCounters(ticketResult?.counters || {});
      setCanned(Array.isArray(cannedResult) ? cannedResult : []);
      setNotifications(notificationResult?.items || []);
      setError('');
    } catch (requestError) {
      setError(formatRequestError(requestError));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, headers, overdueOnly, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    apiGet('/api/admin/support/admins', { headers })
      .then((result) => {
        if (cancelled) return;
        setAdmins(result?.items || []);
        setCurrentAdminId(result?.current_admin_id ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(formatRequestError(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [headers]);

  useEffect(() => {
    void Promise.resolve().then(loadTickets);
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setDetailLoading(true);
        return apiGet(`/support/tickets/${selectedId}`, { headers, signal: controller.signal });
      })
      .then(async (ticket) => {
        await apiFetch(`/api/admin/support/${ticket.id}/seen`, { method: 'POST', headers });
        setDetail({ ...ticket, is_unseen: false });
        setAssignedAdminId(ticket.assigned_admin_id ? String(ticket.assigned_admin_id) : '');
        setTickets((current) => current.map((item) => (
          item.id === ticket.id ? { ...item, is_unseen: false } : item
        )));
        setNotifications((current) => current.map((item) => (
          item.reference_type === 'support'
          && String(item.reference_id) === String(ticket.id)
            ? { ...item, is_read: true }
            : item
        )));
        onItemsSeen('unseenSupport', ticket.is_unseen ? 1 : 0);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(formatRequestError(requestError));
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [headers, onItemsSeen, selectedId]);

  const selectTicket = (ticketId) => {
    setSelectedId(ticketId);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'support');
    url.searchParams.set('ticket', String(ticketId));
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
  };

  const openAdminNotification = async (notification) => {
    try {
      await apiFetch(`/support/notifications/${notification.id}/read`, { method: 'POST', headers });
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
      if (!notification.is_read) onItemsSeen('unreadNotifications', 1);
      if (notification.reference_type === 'support') {
        selectTicket(Number(notification.reference_id));
      } else if (notification.action_url) {
        window.location.assign(notification.action_url);
      }
    } catch (requestError) {
      setError(formatRequestError(requestError));
    }
  };

  const markAllTicketsSeen = async () => {
    const unseenCount = tickets.filter((ticket) => ticket.is_unseen).length;
    try {
      await apiFetch('/api/admin/support/seen-all', { method: 'POST', headers });
      setTickets((current) => current.map((ticket) => ({ ...ticket, is_unseen: false })));
      onItemsSeen('unseenSupport', unseenCount);
      await loadTickets();
    } catch (requestError) {
      setError(formatRequestError(requestError));
    }
  };

  const markAllNotificationsSeen = async () => {
    const unreadCount = notifications.filter((notification) => !notification.is_read).length;
    try {
      await apiFetch('/support/notifications/read-all', { method: 'POST', headers });
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
      onItemsSeen('unreadNotifications', unreadCount);
    } catch (requestError) {
      setError(formatRequestError(requestError));
    }
  };

  const saveAssignment = async (adminId = assignedAdminId) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiPatch(`/api/admin/support/${detail.id}/assign`, {
        admin_id: adminId ? Number(adminId) : null,
      }, { headers });
      setDetail((current) => current?.id === detail.id ? { ...current, ...result.ticket } : current);
      setAssignedAdminId(result.ticket?.assigned_admin_id ? String(result.ticket.assigned_admin_id) : '');
      notifySuccess('Support ticket assignment saved.');
      await loadTickets();
    } catch (requestError) {
      setError(formatRequestError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!detail || !draft.trim()) return;
    if (attachment && (
      !new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).has(attachment.type)
      || attachment.size > 5 * 1024 * 1024
    )) {
      setError('Choose a JPG, PNG, WebP, or PDF file no larger than 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = attachment ? new FormData() : JSON.stringify({
        body: draft.trim(),
        is_internal: internal,
        revision: detail.revision,
      });
      if (attachment) {
        body.append('body', draft.trim());
        body.append('is_internal', String(internal));
        body.append('revision', String(detail.revision));
        body.append('attachment', attachment);
      }
      await apiFetch(`/support/tickets/${detail.id}/messages`, {
        method: 'POST',
        headers,
        body,
      });
      setDraft('');
      setAttachment(null);
      const updated = await apiGet(`/support/tickets/${detail.id}`, { headers });
      setDetail(updated);
      await loadTickets();
    } catch (requestError) {
      setError(formatRequestError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/support/tickets/${detail.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      setDetail(await apiGet(`/support/tickets/${detail.id}`, { headers }));
      await loadTickets();
    } catch (requestError) {
      setError(formatRequestError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const insertCannedResponse = (template) => {
    const values = {
      student_name: detail?.name || 'Student',
      ticket_id: detail?.ticket_number || '',
    };
    setDraft(template.body.replace(/\{(student_name|ticket_id)\}/g, (placeholder, key) => values[key]));
    setInternal(false);
  };

  const downloadAttachment = async (url, fileName) => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, { headers });
      if (!response.ok) throw new Error('Unable to download this attachment.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(formatRequestError(requestError));
    }
  };

  const categories = useMemo(() => ['All', ...new Set(tickets.map((ticket) => ticket.category))], [tickets]);

  return (
    <section className="space-y-5 text-slate-900" aria-label="Admin support inbox">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Support inbox</h2>
            <p className="mt-1 text-sm text-slate-600">Private conversations are visible only to administrators and their creator.</p>
          </div>
          <button type="button" onClick={markAllTicketsSeen} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Mark all as seen</button>
        </div>
      </header>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option>All</option>
          {ticketStatuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
          Overdue only
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(counters).map(([status, count]) => (
          <span key={status} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{status}: {count}</span>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
        <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold">Tickets ({tickets.length})</h3>
          {loading ? (
            [1, 2, 3].map((row) => <div key={row} className="h-16 animate-pulse rounded-xl bg-slate-100" />)
          ) : tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">No tickets match these filters.</p>
          ) : tickets.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => selectTicket(ticket.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 ${ticketSeenStyles[ticket.is_unseen ? 'unseen' : 'seen']}`}>
                  {ticket.is_unseen && <span className="h-2 w-2 rounded-full bg-rose-500" aria-label="Unseen" />}
                  {ticket.ticket_number}
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ticketStatusStyles[ticket.status] || 'bg-slate-100 text-slate-700'}`}>{ticket.status}</span>
              </span>
              <span className="mt-1 block truncate text-sm">{ticket.subject}</span>
              <span className="mt-1 block text-xs text-slate-500">{ticket.category}{ticket.overdue ? ' · Overdue' : ''}</span>
            </button>
          ))}
        </aside>

        <article className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {notifications.length > 0 && (
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Admin queue notifications</h3>
                <button type="button" onClick={markAllNotificationsSeen} className="text-xs font-bold text-sky-700 hover:text-sky-900">Mark all as seen</button>
              </div>
              {notifications.slice(0, 4).map((notification) => (
                <button key={notification.id} type="button" onClick={() => openAdminNotification(notification)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-sky-50">
                  <span><strong>{notification.title}</strong><span className="ml-2 text-slate-600">{notification.message}</span></span>
                  {!notification.is_read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-600" />}
                </button>
              ))}
            </div>
          )}
          {detailLoading ? (
            <div className="space-y-3"><div className="h-6 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-36 animate-pulse rounded-xl bg-slate-100" /></div>
          ) : !detail || detail.id !== selectedId ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Select a support ticket.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{detail.ticket_number} · {detail.category}</p>
                  <h3 className="mt-1 text-lg font-black">{detail.subject}</h3>
                  <p className="mt-1 text-sm text-slate-600">{detail.name} · {detail.email}</p>
                </div>
                {detail.overdue && <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">Overdue</span>}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="text-xs font-semibold text-slate-600">
                  <label>
                    Assign admin
                    <select value={assignedAdminId} onChange={(event) => setAssignedAdminId(event.target.value)} className="mt-1 block min-w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Unassigned</option>
                      {detail.assigned_admin_id && !admins.some((item) => item.id === detail.assigned_admin_id) && (
                        <option value={String(detail.assigned_admin_id)} disabled>
                          {detail.assigned_admin?.name || `Admin #${detail.assigned_admin_id}`} (inactive)
                        </option>
                      )}
                      {admins.map((item) => (
                        <option key={item.id} value={String(item.id)}>{item.name} (@{item.username})</option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1">Current assignee: {detail.assigned_admin?.name || (detail.assigned_admin_id ? `Admin #${detail.assigned_admin_id}` : 'Unassigned')}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => saveAssignment()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Save assignment</button>
                <button type="button" disabled={busy || !currentAdminId} onClick={() => saveAssignment(String(currentAdminId))} className="rounded-full border border-sky-300 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-50 disabled:opacity-50">Assign to me</button>
                <label className="text-xs font-semibold text-slate-600">
                  Status
                  <select value={detail.status} onChange={(event) => updateStatus(event.target.value)} disabled={busy} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {ticketStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              </div>

              <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {(detail.messages || []).map((message) => (
                  <div key={message.id} className={`rounded-xl p-3 text-sm ${message.is_internal ? 'border border-amber-300 bg-amber-50 text-amber-950' : message.sender_type === 'student' ? 'bg-white text-slate-800' : 'bg-sky-50 text-sky-950'}`}>
                    <p className="text-[11px] font-bold">{message.is_internal ? 'INTERNAL NOTE · ADMINS ONLY' : message.sender_type === 'student' ? 'Student' : 'UniXchange Support'}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
                    {message.attachment_url && <button type="button" onClick={() => downloadAttachment(message.attachment_url, `${detail.ticket_number}-attachment`)} className="mt-2 text-xs font-bold underline">Download attachment</button>}
                    <p className="mt-2 text-[10px] text-slate-500">{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={submitMessage} className={`space-y-3 rounded-xl border p-4 ${internal ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold">{internal ? 'Private internal note' : 'Public reply to student'}</p>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold">
                    <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                    Internal note
                  </label>
                </div>
                {canned.length > 0 && (
                  <select aria-label="Canned response" defaultValue="" onChange={(event) => {
                    const template = canned.find((item) => String(item.id) === event.target.value);
                    if (template) insertCannedResponse(template);
                  }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="">Insert canned response…</option>
                    {canned.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                )}
                <textarea required maxLength={5000} rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAttachment(event.target.files?.[0] || null)} className="block w-full text-xs" aria-label="Optional reply attachment" />
                <button type="submit" disabled={busy || !draft.trim()} className={`rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${internal ? 'bg-amber-700 hover:bg-amber-800' : 'bg-sky-700 hover:bg-sky-800'}`}>
                  {busy ? 'Saving…' : internal ? 'Save internal note' : 'Send public reply'}
                </button>
              </form>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export default AdminSupportInbox;
