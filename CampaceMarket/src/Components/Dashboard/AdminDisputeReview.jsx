import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../../api/config';

const ACTIVE_STATUSES = ['OPEN', 'UNDER_REVIEW'];

const getSessionToken = (user) => {
  try {
    const session = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
    return session.access_token || session.accessToken || user?.access_token || '';
  } catch {
    return user?.access_token || '';
  }
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Unknown';
const formatMoney = (value) => `${Number(value || 0).toLocaleString('en-US')} ETB`;
const isUrgent = (value) => value && (Date.now() - new Date(value).getTime()) > 3 * 24 * 60 * 60 * 1000;

const evidenceUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) return value;
  return `${API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
};

function EvidenceImage({ src, label }) {
  if (!src) return <p className="text-sm text-slate-500">No evidence image submitted.</p>;
  return (
    <a href={evidenceUrl(src)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <img src={evidenceUrl(src)} alt={label} className="max-h-64 w-full object-contain" />
    </a>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${normalized === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>{normalized.replace('_', ' ')}</span>;
}

export default function AdminDisputeReview({ user, onCountChange }) {
  const [disputes, setDisputes] = useState([]);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDecision, setPendingDecision] = useState(null);
  const [resolving, setResolving] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const token = getSessionToken(user);
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Unable to load disputes.');
    return data;
  }, [user]);

  const loadDisputes = useCallback(async () => {
    try {
      const data = await request('/api/admin/disputes');
      const active = (Array.isArray(data) ? data : []).filter((item) => ACTIVE_STATUSES.includes(String(item.status || '').toUpperCase()));
      setDisputes(active);
      onCountChange?.(active.length);
      setSelectedDispute((current) => current && active.some((item) => item.id === current.id) ? current : null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDisputes(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDisputes]);

  const filteredDisputes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visible = disputes.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || String(item.status || '').toUpperCase() === statusFilter;
      const haystack = [item.order_id, item.product?.title, item.buyer?.name, item.seller?.name, item.reason].join(' ').toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    const getSortValue = (item) => {
      if (sort.key === 'created_at') return new Date(item.created_at || 0).getTime();
      if (sort.key === 'product') return String(item.product?.title || item.order?.title || '').toLowerCase();
      if (sort.key === 'buyer') return String(item.buyer?.name || item.buyer_id || '').toLowerCase();
      if (sort.key === 'seller') return String(item.seller?.name || item.seller_id || '').toLowerCase();
      return String(item[sort.key] || '').toLowerCase();
    };
    return [...visible].sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);
      if (leftValue === rightValue) return 0;
      const result = leftValue > rightValue ? 1 : -1;
      return sort.direction === 'asc' ? result : -result;
    });
  }, [disputes, search, sort, statusFilter]);

  const changeSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  const openDetail = async (dispute) => {
    setSelectedDispute(dispute);
    try {
      const detail = await request(`/api/admin/disputes/${dispute.id}`);
      setSelectedDispute(detail);
    } catch (detailError) {
      toast.error(detailError.message);
    }
  };

  const resolveDispute = async () => {
    if (!pendingDecision || !selectedDispute || resolving) return;
    setResolving(true);
    try {
      await request(`/api/admin/disputes/${selectedDispute.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ decision: pendingDecision }),
      });
      setDisputes((current) => current.filter((item) => item.id !== selectedDispute.id));
      setSelectedDispute(null);
      setPendingDecision(null);
      onCountChange?.(disputes.length - 1);
      await loadDisputes();
      toast.success(pendingDecision === 'BUYER' ? 'Buyer refunded successfully.' : 'Funds released to seller successfully.');
    } catch (resolveError) {
      toast.error(resolveError.message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-900">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Trust & Safety</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Dispute Review</h2>
            <p className="mt-2 text-sm text-slate-500">Review active buyer and seller claims before releasing escrow.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search disputes" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-sky-500">
              <option value="ALL">All active</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under review</option>
            </select>
            <button type="button" onClick={() => { setLoading(true); void loadDisputes(); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50">Refresh</button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {[['order_id', 'Order'], ['product', 'Product'], ['buyer', 'Buyer'], ['seller', 'Seller'], ['reason', 'Reason'], ['created_at', 'Submitted'], ['status', 'Status']].map(([key, label]) => (
                <th key={key} className="px-5 py-4"><button type="button" onClick={() => changeSort(key === 'product' ? 'product' : key)} className="font-black hover:text-slate-900">{label} {sort.key === key && (sort.direction === 'asc' ? '^' : 'v')}</button></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">Loading active disputes...</td></tr>}
            {!loading && filteredDisputes.map((dispute) => {
              const urgent = isUrgent(dispute.created_at);
              return <tr key={dispute.id} onClick={() => openDetail(dispute)} className={`cursor-pointer border-b border-slate-100 transition hover:bg-sky-50 ${urgent ? 'bg-orange-50/70' : ''}`}>
                <td className="px-5 py-4 font-black">#{dispute.order_id}</td>
                <td className="px-5 py-4 font-semibold">{dispute.product?.title || dispute.order?.title || 'Unknown product'}</td>
                <td className="px-5 py-4">{dispute.buyer?.name || dispute.buyer_id}</td>
                <td className="px-5 py-4">{dispute.seller?.name || dispute.seller_id}</td>
                <td className="max-w-[220px] px-5 py-4">{dispute.reason}</td>
                <td className={`px-5 py-4 ${urgent ? 'font-black text-orange-700' : 'text-slate-600'}`}>{formatDate(dispute.created_at)}{urgent && <span className="mt-1 block text-[10px] uppercase tracking-wider">Needs urgent attention</span>}</td>
                <td className="px-5 py-4"><StatusBadge status={dispute.status} /></td>
              </tr>;
            })}
            {!loading && filteredDisputes.length === 0 && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">No active disputes match this view.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedDispute && <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Dispute #{selectedDispute.id}</p><h3 className="mt-2 text-2xl font-black">Order #{selectedDispute.order_id}: {selectedDispute.product?.title || selectedDispute.order?.title}</h3><p className="mt-2 text-sm text-slate-500">Submitted {formatDate(selectedDispute.created_at)} by {selectedDispute.buyer?.name || selectedDispute.buyer_id}</p></div>
          <StatusBadge status={selectedDispute.status} />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl bg-slate-50 p-5"><h4 className="font-black">Buyer claim</h4><p className="text-sm leading-6 text-slate-700">{selectedDispute.description}</p><EvidenceImage src={selectedDispute.evidence_image} label="Buyer evidence" /></div>
          <div className="space-y-4 rounded-2xl bg-slate-50 p-5"><h4 className="font-black">Seller response</h4><p className="text-sm leading-6 text-slate-700">{selectedDispute.seller_response || 'No response submitted.'}</p><EvidenceImage src={selectedDispute.seller_evidence} label="Seller evidence" /></div>
        </div>
        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 p-5 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order</p><p className="mt-1 font-black">#{selectedDispute.order?.id || selectedDispute.order_id}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Price</p><p className="mt-1 font-black">{selectedDispute.order?.price || 'Unknown'}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Escrow amount</p><p className="mt-1 font-black">{formatMoney(selectedDispute.order?.escrow_amount)}</p></div></div>
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setPendingDecision('BUYER')} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700">Refund Buyer</button><button type="button" onClick={() => setPendingDecision('SELLER')} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Release to Seller</button></div>
      </div>}

      {pendingDecision && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Confirm resolution</p><h3 className="mt-2 text-2xl font-black">{pendingDecision === 'BUYER' ? 'Refund the buyer?' : 'Release funds to the seller?'}</h3><p className="mt-3 text-sm leading-6 text-slate-600">This permanently resolves dispute #{selectedDispute?.id} and changes the escrow outcome for order #{selectedDispute?.order_id}.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPendingDecision(null)} disabled={resolving} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel</button><button type="button" onClick={resolveDispute} disabled={resolving} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{resolving ? 'Resolving...' : 'Confirm resolution'}</button></div></div></div>}
    </div>
  );
}
