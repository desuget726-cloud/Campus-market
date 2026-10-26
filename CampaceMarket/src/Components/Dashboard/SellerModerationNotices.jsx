import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../api/apiClient';
import { getErrorMessage } from '../../utils/notify';

const noticeSections = {
  warnings: new Set(['warning', 'product_hidden']),
  'account-notices': new Set(['suspended', 'deactivated']),
};

function formatNoticeDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function SellerModerationNotices({ section, itemId = null, onInvalidLink }) {
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noticeNotFound, setNoticeNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadNotices = async () => {
      setLoading(true);
      setError('');
      setNoticeNotFound(false);
      try {
        const result = await apiGet('/api/student/moderation/notices');
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        setNotices(items);
        const sectionActions = noticeSections[section];
        const visibleItems = items.filter((notice) => sectionActions?.has(notice.action));
        if (itemId) {
          const matchingNotice = visibleItems.find((notice) => notice.report_id === itemId);
          if (!matchingNotice) {
            setNoticeNotFound(true);
            onInvalidLink?.('This notice is unavailable for your account, so Home is shown.');
          } else {
            setSelectedNotice(matchingNotice);
          }
        } else {
          setSelectedNotice(null);
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadNotices();
    return () => {
      cancelled = true;
    };
  }, [itemId, onInvalidLink, section]);

  const visibleNotices = useMemo(
    () => notices.filter((notice) => noticeSections[section]?.has(notice.action)),
    [notices, section],
  );

  if (noticeNotFound) return null;

  return (
    <section aria-label="Warnings and notices" className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Seller Hub</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">Warnings &amp; Notices</h2>
        <p className="mt-2 text-sm text-slate-600">Private account notices and marketplace moderation decisions for your account.</p>
      </header>
      {loading && <p role="status" className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-sky-800">Loading your notices…</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>}
      {!loading && !error && visibleNotices.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">You have no notices in this section.</p>
      )}
      {!loading && !error && visibleNotices.length > 0 && (
        <div className="space-y-3">
          {visibleNotices.map((notice) => (
            <article key={notice.id} className={`rounded-2xl border p-4 ${selectedNotice?.id === notice.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-bold text-slate-900">{notice.title}</h3>
                <time className="text-xs text-slate-500">{formatNoticeDate(notice.created_at)}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{notice.reason}</p>
              {notice.product && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-bold">{notice.product.title}</p>
                  <p className="mt-1">Product status: {notice.product.status || 'Unknown'}</p>
                  <p className="mt-1">Warnings on your account: {notice.product.warning_count}</p>
                </div>
              )}
              {notice.account_status && (
                <p className="mt-3 text-xs font-semibold text-amber-800">Current account status: {notice.account_status}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default SellerModerationNotices;
