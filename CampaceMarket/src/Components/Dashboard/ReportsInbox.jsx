import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiGet } from '../../api/apiClient';
import { API_BASE_URL } from '../../config';
import { getErrorMessage } from '../../utils/notify';

const statusStyles = {
  Open: 'bg-amber-100 text-amber-800',
  'Under Review': 'bg-sky-100 text-sky-800',
  'In Progress': 'bg-sky-100 text-sky-800',
  'Waiting for User': 'bg-violet-100 text-violet-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  Dismissed: 'bg-slate-200 text-slate-700',
  Closed: 'bg-slate-200 text-slate-700',
};

const allowedAttachmentTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
]);

function readSelectedItem() {
  const params = new URLSearchParams(window.location.search);
  const selected = params.get('item') || '';
  const match = /^(report|support)-(\d+)$/.exec(selected);
  return match ? { kind: match[1], id: Number(match[2]) } : null;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function ReportsInbox({ accessToken, onInvalidReportLink }) {
  const token = accessToken || '';
  const [reports, setReports] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [unreadKeys, setUnreadKeys] = useState(new Set());
  const [selected, setSelected] = useState(readSelectedItem);
  const [detail, setDetail] = useState(null);
  const [ticketNotFound, setTicketNotFound] = useState(false);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [appealDraft, setAppealDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('General Inquiry');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketAttachment, setTicketAttachment] = useState(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const refreshLists = useCallback(async (signal) => {
    if (!token) {
      await Promise.resolve();
      setError('Please sign in to view reports and support requests.');
      setLoading(false);
      return;
    }
    try {
      const studentId = JSON.parse(window.localStorage.getItem('campaceSession') || '{}')?.user?.studentId;
      const [reportItems, ticketResult, notificationResult] = await Promise.all([
        apiGet('/api/student/reports/participating', { headers, signal }),
        apiGet('/api/student/support/tickets', { headers, signal }),
        studentId
          ? apiGet(`/api/student/notifications?student_id=${encodeURIComponent(studentId)}`, { headers, signal })
          : Promise.resolve({ notifications: [] }),
      ]);
      setReports(Array.isArray(reportItems) ? reportItems : []);
      setTickets(Array.isArray(ticketResult?.items) ? ticketResult.items : []);
      const unread = new Set();
      (notificationResult?.notifications || []).forEach((notification) => {
        if (!notification.is_read && notification.reference_id) {
          const kind = String(notification.type || '').startsWith('support') ? 'support' : 'report';
          unread.add(`${kind}-${notification.reference_id}`);
        }
      });
      setUnreadKeys(unread);
      setError('');
    } catch (requestError) {
      if (requestError.name === 'AbortError') return;
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [headers, token]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => refreshLists(controller.signal));
    return () => controller.abort();
  }, [refreshLists]);

  useEffect(() => {
    const syncSelection = () => {
      setSelected(readSelectedItem());
      setTicketNotFound(false);
      setError('');
    };
    window.addEventListener('popstate', syncSelection);
    return () => window.removeEventListener('popstate', syncSelection);
  }, []);

  const selectItem = useCallback((kind, id) => {
    setTicketNotFound(false);
    setError('');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'buyer');
    params.set('section', 'reports-support');
    params.set('item', `${kind}-${id}`);
    window.history.pushState({}, '', `/dashboard?${params.toString()}`);
    setSelected({ kind, id });
  }, []);

  const returnToTicketList = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('item');
    const query = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    setSelected(null);
    setDetail(null);
    setTicketNotFound(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!selected || !token) {
      return;
    }
    const controller = new AbortController();
    const loadDetail = async () => {
      setDetailLoading(true);
      setTicketNotFound(false);
      setError('');
      try {
        const item = selected.kind === 'report'
          ? await apiGet(`/api/student/reports/${selected.id}`, { headers, signal: controller.signal })
          : await apiGet(`/api/student/support/tickets/${selected.id}`, { headers, signal: controller.signal });
        setDetail(item);
        setDraft('');
        setAppealDraft('');
        await apiFetch(`/api/student/communications/${selected.kind}/${selected.id}/read`, {
          method: 'POST',
          headers,
          signal: controller.signal,
        });
        setUnreadKeys((current) => {
          const next = new Set(current);
          next.delete(`${selected.kind}-${selected.id}`);
          return next;
        });
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        if (selected.kind === 'report' && requestError.status === 404) {
          onInvalidReportLink?.('This report is unavailable for your account, so Home is shown.');
          setError('');
        } else if (selected.kind === 'support' && requestError.status === 404) {
          setTicketNotFound(true);
          setError('');
        } else {
          setError(getErrorMessage(requestError));
        }
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    void Promise.resolve().then(loadDetail);
    return () => controller.abort();
  }, [headers, onInvalidReportLink, selected, token]);

  const submitTicket = async (event) => {
    event.preventDefault();
    const body = ticketMessage.trim();
    if (ticketSubject.trim().length < 3 || body.length < 10) {
      setError('Add a subject and a message of at least 10 characters.');
      return;
    }
    if (ticketAttachment && (
      !allowedAttachmentTypes.has(ticketAttachment.type)
      || ticketAttachment.size > 5 * 1024 * 1024
    )) {
      setError('Choose a JPG, PNG, WebP, or PDF file no larger than 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('subject', ticketSubject.trim());
      formData.append('category', ticketCategory);
      formData.append('message', body);
      if (ticketAttachment) formData.append('attachment', ticketAttachment);
      const result = await apiFetch('/support/tickets', {
        method: 'POST',
        headers,
        body: formData,
      });
      setTicketSubject('');
      setTicketMessage('');
      setTicketAttachment(null);
      await refreshLists();
      selectItem('support', result.ticket.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected || selected.kind !== 'support') return;
    if (replyAttachment && (
      !allowedAttachmentTypes.has(replyAttachment.type)
      || replyAttachment.size > 5 * 1024 * 1024
    )) {
      setError('Choose a JPG, PNG, WebP, or PDF file no larger than 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const requestBody = replyAttachment ? new FormData() : JSON.stringify({ body });
      if (replyAttachment) {
        requestBody.append('body', body);
        requestBody.append('attachment', replyAttachment);
      }
      await apiFetch(`/api/student/support/tickets/${selected.id}/messages`, {
        method: 'POST',
        headers,
        body: requestBody,
      });
      const next = await apiGet(`/api/student/support/tickets/${selected.id}`, { headers });
      setDetail(next);
      setDraft('');
      setReplyAttachment(null);
      await refreshLists();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submitAppeal = async () => {
    if (!selected || selected.kind !== 'report' || appealDraft.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/student/reports/${selected.id}/appeal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: appealDraft.trim() }),
      });
      const next = await apiGet(`/api/student/reports/${selected.id}`, { headers });
      setDetail(next);
      setAppealDraft('');
      await refreshLists();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const reopenTicket = async () => {
    if (!selected || selected.kind !== 'support') return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/student/support/tickets/${selected.id}/reopen`, {
        method: 'POST',
        headers,
      });
      const next = await apiGet(`/api/student/support/tickets/${selected.id}`, { headers });
      setDetail(next);
      await refreshLists();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const filteredItems = useMemo(() => {
    const items = [
      ...tickets.map((item) => ({ ...item, kind: 'support', displayId: item.ticket_number })),
      ...reports.map((item) => ({ ...item, kind: 'report', displayId: item.report_id })),
    ];
    return items
      .filter((item) => filter === 'All' || item.status === filter)
      .sort((left, right) => new Date(right.updated_at || right.date || right.created_at || 0) - new Date(left.updated_at || left.date || left.created_at || 0));
  }, [filter, reports, tickets]);

  const downloadAttachment = async (url, name) => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, { headers });
      if (!response.ok) throw new Error('Unable to download this attachment.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name || 'support-attachment';
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const currentStatus = detail?.status || '';
  const messages = detail?.messages || [];

  return (
    <section className="space-y-5" aria-label="Reports & Support">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Reports &amp; Support</h2>
        <p className="mt-1 text-sm text-slate-600">Private requests are visible only to you and the UniXchange admin team.</p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={submitTicket} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">New support request</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Subject
            <input required minLength={3} maxLength={200} value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Category
            <select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <option>General Inquiry</option>
              <option>Login Issue</option>
              <option>Payment Problem</option>
              <option>Account Problem</option>
              <option>Bug Report</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Message
          <textarea required minLength={10} maxLength={5000} rows={4} value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Attachment (optional, JPG/PNG/WebP/PDF, up to 5 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setTicketAttachment(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
          {busy ? 'Sending…' : 'Send to admin'}
        </button>
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900">Your requests</h3>
            <select aria-label="Filter requests by status" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
              <option>All</option>
              {Object.keys(statusStyles).map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="space-y-3" aria-label="Loading requests">
              {[1, 2, 3].map((value) => <div key={value} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No requests match this filter.</p>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const key = `${item.kind}-${item.id}`;
                return (
                  <button key={key} type="button" onClick={() => selectItem(item.kind, item.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.kind === item.kind && selected.id === item.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{item.displayId}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[item.status] || 'bg-slate-100 text-slate-700'}`}>{item.status}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-slate-700">{item.subject || item.issue || item.category}</span>
                    <span className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(item.updated_at || item.date || item.created_at)}</span>
                      {unreadKeys.has(key) && <span aria-label="Unread update" className="h-2.5 w-2.5 rounded-full bg-sky-600" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {detailLoading ? (
            <div className="space-y-3" aria-label="Loading request details">
              <div className="h-6 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : ticketNotFound ? (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
              <p role="alert" className="text-sm font-semibold text-amber-900">Ticket not found or not yours.</p>
              <button type="button" onClick={returnToTicketList} className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800">
                Back to ticket list
              </button>
            </div>
          ) : !detail || !selected || detail.id !== selected.id ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Select a report or support request to view its updates.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{selected.kind === 'report' ? detail.report_id : detail.ticket_number}</p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">{detail.subject || detail.category || 'Report'}</h3>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyles[currentStatus] || 'bg-slate-100 text-slate-700'}`}>{currentStatus}</span>
              </div>

              {selected.kind === 'report' ? (
                <div className="space-y-4 pt-4">
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{detail.issue}</p>
                  <p className="text-xs text-slate-500">Submitted {formatDate(detail.date)}</p>
                  {(detail.decision || detail.decision_reason) && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                      <p className="font-bold">Admin decision: {detail.decision || currentStatus}</p>
                      {detail.decision_reason && <p className="mt-2 whitespace-pre-wrap">{detail.decision_reason}</p>}
                    </div>
                  )}
                  {detail.messages?.map((message) => (
                    <div key={message.id} className="rounded-xl bg-sky-50 p-4 text-sm text-slate-800">
                      <p className="text-xs font-bold text-sky-800">UniXchange Support · {formatDate(message.created_at)}</p>
                      <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                    </div>
                  ))}
                  {detail.appeal_submitted ? (
                    <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Appeal submitted, waiting for admin.</p>
                  ) : detail.can_appeal && (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <label className="block text-sm font-bold text-amber-950">
                        One-time appeal
                        <textarea rows={3} maxLength={2000} value={appealDraft} onChange={(event) => setAppealDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 font-normal text-slate-800" />
                      </label>
                      <button type="button" disabled={busy || appealDraft.trim().length < 10} onClick={submitAppeal} className="rounded-full bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit appeal</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <p className="text-xs text-slate-500">{detail.category} · Created {formatDate(detail.created_at)}</p>
                  <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
                    {messages.map((message) => (
                      <div key={message.id} className={`max-w-[90%] rounded-2xl p-3 text-sm ${message.sender_type === 'student' ? 'ml-auto bg-sky-700 text-white' : 'mr-auto border border-slate-200 bg-white text-slate-800'}`}>
                        <p className={`mb-1 text-[11px] font-bold ${message.sender_type === 'student' ? 'text-sky-100' : 'text-sky-800'}`}>{message.sender_type === 'student' ? 'You' : 'UniXchange Support'}</p>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        {message.attachment_url && <button type="button" onClick={() => downloadAttachment(message.attachment_url, `${detail.ticket_number}-attachment`)} className="mt-2 underline">Download attachment</button>}
                        <p className={`mt-2 text-[10px] ${message.sender_type === 'student' ? 'text-sky-100' : 'text-slate-500'}`}>{formatDate(message.created_at)}</p>
                      </div>
                    ))}
                  </div>
                  {detail.can_reopen && <button type="button" disabled={busy} onClick={reopenTicket} className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50">Reopen ticket</button>}
                  {currentStatus !== 'Closed' ? (
                    <form onSubmit={submitReply} className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Add information for the admin team
                        <textarea rows={3} maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3" />
                      </label>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReplyAttachment(event.target.files?.[0] || null)} className="block w-full text-xs" aria-label="Optional ticket attachment" />
                      <button type="submit" disabled={busy || !draft.trim()} className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Send reply to admin</button>
                    </form>
                  ) : <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">This ticket is closed and no longer accepts replies.</p>}
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export default ReportsInbox;
