import { useEffect, useState } from 'react';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../utils/notify';
import { filterPublicProducts, getStudentAccessToken } from '../../utils/publicListings';

const SKELETON_COUNT = 4;

function SimilarProductCard({ product, language, soldOutLabel, categoryLabel, onNavigate }) {
  const parsedPrice = Number.parseFloat(String(product.price ?? '').replace(/[^\d.-]/g, ''));
  const price = Number.isFinite(parsedPrice)
    ? `${parsedPrice.toLocaleString(language === 'am' ? 'am-ET' : 'en-ET', { maximumFractionDigits: 2 })} ETB`
    : '— ETB';
  const isSoldOut = Number(product.stock) <= 0 || String(product.status || '').toLowerCase() === 'sold';
  const openProduct = () => onNavigate?.('product-details', { productId: product.id });
  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openProduct();
  };

  return (
    <button
      type="button"
      tabIndex={0}
      aria-label={`${product.title || ''}. ${price}. ${categoryLabel}: ${product.category || ''}`}
      onClick={openProduct}
      onKeyDown={handleKeyDown}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={resolveImageUrl(product.image)}
          alt={product.title || ''}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = IMAGE_PLACEHOLDER;
          }}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {isSoldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
            {soldOutLabel}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col p-4">
        <span className="line-clamp-1 text-lg font-black text-emerald-700">{price}</span>
        <span className="mt-2 line-clamp-2 break-words text-base font-bold text-slate-900">
          {product.title}
        </span>
        <span className="mt-3 line-clamp-1 text-sm font-medium text-slate-500">
          {categoryLabel}: {product.category}
        </span>
      </span>
    </button>
  );
}

export default function SimilarProductsSection({ productId, currentUser, onNavigate }) {
  const { t, language } = useLanguage();
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState({
    requestKey: '',
    products: [],
    loading: false,
    error: '',
  });
  const id = String(productId || '');
  const requestKey = `${id}:${retryCount}`;
  const accessToken = getStudentAccessToken(currentUser);
  const isCurrentResult = result.requestKey === requestKey;
  const loading = !isCurrentResult || result.loading;
  const error = isCurrentResult ? result.error : '';
  const products = isCurrentResult ? result.products : [];

  useEffect(() => {
    if (!id) return undefined;

    let active = true;
    fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}/similar`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(typeof data?.detail === 'string' ? data.detail : 'Unable to load similar products.');
        }
        if (!Array.isArray(data)) {
          throw new Error('Invalid similar products response.');
        }
        return filterPublicProducts(data, currentUser).slice(0, 8);
      })
      .then((items) => {
        if (active) setResult({ requestKey, products: items, loading: false, error: '' });
      })
      .catch((requestError) => {
        if (active) setResult({
          requestKey,
          products: [],
          loading: false,
          error: getErrorMessage(requestError),
        });
      });

    return () => {
      active = false;
    };
  }, [id, retryCount, requestKey, accessToken, currentUser]);

  if (!id) return null;

  if (!loading && !error && products.length === 0) return null;

  return (
    <section
      className="order-7 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:order-none"
      aria-labelledby="similar-products-heading"
      aria-busy={loading}
    >
      <h2 id="similar-products-heading" className="text-xl font-black text-slate-900">
        {t('productDetails.buyer.similarProducts')}
      </h2>
      {loading ? (
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-slate-200"
              aria-hidden="true"
            >
              <div className="aspect-[4/3] animate-pulse bg-slate-200" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert">
          <p className="text-sm font-semibold text-rose-800">
            {t('productDetails.buyer.similarProductsError')}
          </p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-3 rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            {t('productDetails.buyer.similarProductsRetry')}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {products.map((similar) => (
            <SimilarProductCard
              key={similar.id}
              product={similar}
              language={language}
              soldOutLabel={t('productDetails.buyer.soldOut')}
              categoryLabel={t('productDetails.buyer.category')}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
