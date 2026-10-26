import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApiDelete, adminApiGet, adminApiPatch } from '../../api/apiClient';
import { IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import { getErrorMessage, notifySuccess } from '../../utils/notify';

function AdminProductReviewsPage({ onNavigate }) {
  const [reviews, setReviews] = useState([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [reviewActionId, setReviewActionId] = useState(null);
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

  const filteredReviews = useMemo(() => reviews.filter((review) => {
    const rating = Number(review.rating);
    const matchesRating = ratingFilter === 'all'
      || (ratingFilter === 'low' ? rating >= 1 && rating <= 2 : rating === Number(ratingFilter));
    const matchesVisibility = visibilityFilter === 'all'
      || (visibilityFilter === 'hidden' ? review.is_hidden : !review.is_hidden);
    return matchesRating && matchesVisibility;
  }), [reviews, ratingFilter, visibilityFilter]);

  const ratingCounts = useMemo(() => ({
    all: reviews.length,
    5: reviews.filter((review) => Number(review.rating) === 5).length,
    4: reviews.filter((review) => Number(review.rating) === 4).length,
    3: reviews.filter((review) => Number(review.rating) === 3).length,
    low: reviews.filter((review) => Number(review.rating) >= 1 && Number(review.rating) <= 2).length,
  }), [reviews]);

  const visibilityCounts = useMemo(() => ({
    all: reviews.length,
    visible: reviews.filter((review) => !review.is_hidden).length,
    hidden: reviews.filter((review) => review.is_hidden).length,
  }), [reviews]);

  const handleToggleVisibility = async (review) => {
    setReviewActionId(review.id);
    setError('');
    try {
      const isHidden = !review.is_hidden;
      await adminApiPatch(`/api/admin/reviews/${review.id}/visibility`, { is_hidden: isHidden });
      setReviews((current) => current.map((item) => (
        item.id === review.id ? { ...item, is_hidden: isHidden } : item
      )));
      notifySuccess(isHidden ? 'Review hidden from the marketplace.' : 'Review restored to the marketplace.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setReviewActionId(null);
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Permanently delete this review? This action cannot be undone.')) return;
    setReviewActionId(review.id);
    setError('');
    try {
      await adminApiDelete(`/api/admin/reviews/${review.id}`);
      setReviews((current) => current.filter((item) => item.id !== review.id));
      notifySuccess('Review deleted permanently.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setReviewActionId(null);
    }
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
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews by rating">
              {[
                { key: 'all', label: 'All Ratings' },
                { key: '5', label: '5 Stars' },
                { key: '4', label: '4 Stars' },
                { key: '3', label: '3 Stars' },
                { key: 'low', label: '1-2 Stars (Low Rating)' },
              ].map((filter) => {
                const isActive = ratingFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setRatingFilter(filter.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition ${isActive ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
                  >
                    {filter.label} <span className={isActive ? 'text-sky-100' : 'text-slate-400'}>({ratingCounts[filter.key]})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews by visibility">
              {[
                { key: 'all', label: 'All Reviews' },
                { key: 'visible', label: 'Visible' },
                { key: 'hidden', label: 'Hidden' },
              ].map((filter) => {
                const isActive = visibilityFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setVisibilityFilter(filter.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${isActive ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {filter.label} ({visibilityCounts[filter.key]})
                  </button>
                );
              })}
            </div>
          </div>
          {filteredReviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              No reviews match the selected filters.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((review) => {
                const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
                const actionInProgress = reviewActionId === review.id;
                return (
                  <article key={review.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${review.is_hidden ? 'border-amber-300' : 'border-slate-200'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={resolveImageUrl(review.image)}
                          alt=""
                          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }}
                          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <h2 className="truncate font-bold text-slate-900">{review.product || 'Untitled product'}</h2>
                          <p className="mt-1 text-xs text-slate-500">By {review.reviewer} ({review.reviewer_id}) · Order #{review.order_id}</p>
                          <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Verified Purchase</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span aria-label={`${rating} out of 5 stars`} className="text-lg tracking-wide text-amber-500">
                          {'★'.repeat(rating)}<span className="text-slate-300">{'★'.repeat(5 - rating)}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{review.rating} / 5</span>
                        {review.is_hidden && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Hidden</span>}
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-700">{review.comment}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleString() : 'Date unavailable'}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!review.product_id}
                          onClick={() => onNavigate?.('product-details', { productId: review.product_id })}
                          className="rounded-full border border-sky-200 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          View Product
                        </button>
                        <button
                          type="button"
                          disabled={actionInProgress}
                          onClick={() => handleToggleVisibility(review)}
                          className="rounded-full border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {actionInProgress ? 'Updating…' : review.is_hidden ? 'Unhide' : 'Hide'}
                        </button>
                        <button
                          type="button"
                          disabled={actionInProgress}
                          onClick={() => handleDeleteReview(review)}
                          className="rounded-full border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Delete Review
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export { AdminProductReviewsPage };
