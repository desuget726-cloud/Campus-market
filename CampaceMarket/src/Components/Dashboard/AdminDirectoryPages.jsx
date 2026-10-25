import { useCallback, useEffect, useState } from 'react';
import { adminApiGet } from '../../api/apiClient';
import { getErrorMessage } from '../../utils/notify';

function AdminUsersPage() {
  const [admins, setAdmins] = useState([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAdmins = useCallback(async (term = '') => {
    setLoading(true);
    try {
      const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : '';
      const result = await adminApiGet(`/api/admin/admin-users${query}`);
      setAdmins(Array.isArray(result) ? result : []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadAdmins());
  }, [loadAdmins]);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchDraft);
    void loadAdmins(searchDraft);
  };

  return (
    <section className="space-y-5 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">Admin Users</h1>
        <p className="mt-1 text-sm text-slate-600">Read-only directory of administrator accounts.</p>
        <form onSubmit={submitSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="admin-directory-search">Search administrators</label>
          <input
            id="admin-directory-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search name, username, email, role or status"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <button type="submit" className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800">Search</button>
        </form>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>}
      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading administrators">
          {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-200" />)}
        </div>
      ) : admins.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {search ? 'No administrators match that search.' : 'No administrator accounts were found.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((admin) => (
                  <tr key={admin.id} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold text-slate-900">{admin.name}</td>
                    <td className="px-4 py-3">{admin.username}</td>
                    <td className="px-4 py-3">{admin.email}</td>
                    <td className="px-4 py-3">{admin.role}</td>
                    <td className="px-4 py-3">{admin.status}</td>
                    <td className="px-4 py-3">{admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminProductReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async (term = '') => {
    setLoading(true);
    try {
      const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : '';
      const result = await adminApiGet(`/api/admin/reviews${query}`);
      setReviews(Array.isArray(result) ? result : []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadReviews());
  }, [loadReviews]);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchDraft);
    void loadReviews(searchDraft);
  };

  return (
    <section className="space-y-5 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">Product Reviews</h1>
        <p className="mt-1 text-sm text-slate-600">Review marketplace feedback by product, reviewer and rating.</p>
        <form onSubmit={submitSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="product-reviews-search">Search reviews</label>
          <input
            id="product-reviews-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search products, reviewers or comments"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <button type="submit" className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800">Search</button>
        </form>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>}
      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading product reviews">
          {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {search ? 'No reviews match that search.' : 'There are no product reviews yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">{review.product}</h2>
                  <p className="mt-1 text-xs text-slate-500">By {review.reviewer} ({review.reviewer_id}) · Order #{review.order_id}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{review.rating} / 5</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{review.comment}</p>
              <p className="mt-3 text-xs text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleString() : 'Date unavailable'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export { AdminProductReviewsPage, AdminUsersPage };
