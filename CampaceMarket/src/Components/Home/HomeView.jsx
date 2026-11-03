import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductDetails from './ProductDetails';
import HeroSection from './HeroSection';
import { apiUrl } from '../../api/config';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import { useLanguage } from '../../context/LanguageContext';
import { filterPublicProducts, getStudentAccessToken } from '../../utils/publicListings';

const fetchWithTimeout = (url, timeoutMs = 15000, parentSignal, init = {}) => {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', abortFromParent);
  });
};

const waitBeforeRetry = (signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const timeoutId = window.setTimeout(done, 4000);
  function done() {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', done);
    resolve();
  }
  signal?.addEventListener('abort', done, { once: true });
});

const fetchWithRetries = async (url, signal, init) => {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (signal?.aborted) {
      const abortError = new Error('Request cancelled');
      abortError.name = 'AbortError';
      throw abortError;
    }
    try {
      const response = await fetchWithTimeout(url, 15000, signal, init);
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      return response;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt < 3) await waitBeforeRetry(signal);
    }
  }
  throw lastError;
};

const getProductPrice = (product) => {
  const price = Number(String(product?.price ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(price) ? price : 0;
};

const getProductTimestamp = (product) => {
  const timestamp = new Date(product?.created_at || product?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getProductViews = (product) => {
  const views = Number(product?.views ?? product?.view_count ?? product?.stats?.views ?? 0);
  return Number.isFinite(views) ? views : 0;
};

const getListingFailureKind = (error) => (
  (typeof navigator !== 'undefined' && navigator.onLine === false) || error instanceof TypeError
    ? 'offline'
    : 'generic'
);

const formatEtb = (value, language = 'en') => {
  if (value === null || value === undefined || value === '') return 'Price unavailable';

  const numericValue = Number(String(value).replace(/[$,\s]|ETB/gi, ''));
  if (Number.isFinite(numericValue)) {
    const locale = language === 'am' ? 'am-ET' : 'en-ET';
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(numericValue)} ETB`;
  }

  return `${String(value).replace(/\$/g, '').replace(/\s*ETB\s*/gi, '').trim()} ETB`;
};

const CompactEtbPrice = ({ value, className, language }) => {
  return (
    <p className={className}>{formatEtb(value, language)}</p>
  );
};

const getPrimaryImage = (product) => {
  const image = product?.image;
  if (Array.isArray(image)) return resolveImageUrl(image[0]);
  if (typeof image !== 'string') return IMAGE_PLACEHOLDER;

  try {
    const parsedImage = JSON.parse(image);
    return resolveImageUrl(Array.isArray(parsedImage) ? parsedImage[0] : image);
  } catch {
    return resolveImageUrl(image);
  }
};

const getCategoryAdCount = (value) => {
  const match = String(value || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return 0;
  const multiplier = { K: 1000, M: 1000000, B: 1000000000 }[String(match[2] || '').toUpperCase()] || 1;
  return Number(match[1]) * multiplier;
};

function HomeView({ onAction, user, initialProductId, pendingProductAction, onPendingProductActionHandled, onNavigate, onNavigateToMessages, onBackToSellerHub }) {
  const { t, language } = useLanguage();
  const contentContainerClass = 'w-full px-4 sm:px-6 lg:px-10 2xl:px-16';
  const PAGE_SIZE = 12;
  const [categories, setCategories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortOrder, setSortOrder] = useState('newest');
  const [wishlistState, setWishlistState] = useState({ studentId: '', items: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isLoadErrorDismissed, setIsLoadErrorDismissed] = useState(false);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchedTitle, setSearchedTitle] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [recommendationsStudentId, setRecommendationsStudentId] = useState('');
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const aiScrollRef = useRef(null);
  const allProductsSectionRef = useRef(null);
  const latestProductsRequestRef = useRef(0);
  const lastProductRequestRef = useRef({});
  const searchDebounceTimeoutRef = useRef(null);
  const hasSignedInUser = Boolean(user);
  const selectedProductAccessToken = getStudentAccessToken(user);
  const studentAccessToken = getStudentAccessToken(user);
  const currentStudentId = user?.studentId || user?.student_id;
  const wishlistItems = wishlistState.studentId === String(currentStudentId || '')
    ? wishlistState.items
    : {};

  useEffect(() => () => {
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!currentStudentId) return undefined;

    let active = true;
    const accessToken = studentAccessToken;
    fetch(`${API_BASE_URL}/api/student/wishlist?student_id=${encodeURIComponent(currentStudentId)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your wishlist.');
        return response.json();
      })
      .then((items) => {
        if (!active) return;
        const nextWishlistItems = {};
        (Array.isArray(items) ? items : []).forEach((item) => {
          if (item?.product_id != null) nextWishlistItems[String(item.product_id)] = item.id || true;
        });
        setWishlistState({ studentId: String(currentStudentId), items: nextWishlistItems });
      })
      .catch((error) => {
        if (active) console.error('Unable to load the product wishlist.', error);
      });

    return () => { active = false; };
  }, [currentStudentId, studentAccessToken]);

  const openProduct = (product) => {
    if (!product?.id) return;
    setSelectedProduct(product);
    onAction?.(product);
  };

  const handleProductCardKeyDown = (event, product) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProduct(product);
    }
  };

  const visibleCategories = showAllCategories ? categories : categories.slice(0, 8);

  const fetchCategories = useCallback(async (signal) => {
    try {
      const init = studentAccessToken
        ? { headers: { Authorization: `Bearer ${studentAccessToken}` } }
        : undefined;
      const response = await fetchWithRetries(apiUrl('/api/categories'), signal, init);
      const data = await response.json();
      const normalizedCategories = (Array.isArray(data) ? data : []).map((category) => ({
        ...category,
        items: Array.isArray(category.sub_categories)
          ? category.sub_categories.map((subCategory) => ({
            name: subCategory.name,
            icon: subCategory.icon || '📦',
            adsCount: subCategory.adsCount || `${subCategory.count || 0} ads`,
          }))
          : Array.isArray(category.items) ? category.items : [],
      }));
      setCategories(normalizedCategories);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Category fetch error:', error);
        setCategories([]);
      }
    }
  }, [studentAccessToken]);

  const fetchProducts = useCallback(async ({ search, category, subcategory, department } = {}, signal) => {
    const requestId = latestProductsRequestRef.current + 1;
    latestProductsRequestRef.current = requestId;
    lastProductRequestRef.current = { search, category, subcategory, department };
    setLoading(true);
    setLoadError(null);
    setIsLoadErrorDismissed(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      if (department) params.set('department', department);

      const url = params.toString()
        ? `/api/products?${params.toString()}`
        : '/api/products';
      const token = getStudentAccessToken(user);
      const init = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const response = await fetchWithRetries(apiUrl(url), signal, init);
      const data = await response.json();
      if (requestId === latestProductsRequestRef.current) {
        setSearchResults(filterPublicProducts(data, user));
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Product fetch error:', error);
      if (requestId === latestProductsRequestRef.current && error.name !== 'AbortError') {
        setLoadError({ kind: getListingFailureKind(error) });
        setSearchResults([]);
      }
    } finally {
      if (requestId === latestProductsRequestRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    const startTimeoutId = window.setTimeout(async () => {
      const department = user?.department || user?.college || user?.departmentName || '';
      await Promise.all([
        fetchCategories(controller.signal),
        fetchProducts({ department: department || undefined }, controller.signal),
      ]);
    }, 0);
    return () => {
      window.clearTimeout(startTimeoutId);
      controller.abort();
    };
  }, [fetchCategories, fetchProducts, user?.department, user?.college, user?.departmentName]);

  useEffect(() => {
    if (!loading) window.dispatchEvent(new Event('campace:content-rendered'));
  }, [categories, loading, searchResults]);

  useEffect(() => {
    if (!initialProductId) return;

    const productFromResults = searchResults.find((item) => String(item.id) === String(initialProductId));
    if (productFromResults) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProduct(productFromResults);
      return;
    }

    const fetchSelectedProduct = async () => {
      try {
        const response = await fetchWithTimeout(
          apiUrl(`/api/products/${initialProductId}`),
          15000,
          undefined,
          { headers: selectedProductAccessToken ? { Authorization: `Bearer ${selectedProductAccessToken}` } : {} },
        );
        if (!response.ok) throw new Error('Failed to load selected product');
        setSelectedProduct(await response.json());
      } catch (error) {
        console.error('Selected product fetch error:', error);
      }
    };

    fetchSelectedProduct();
  }, [initialProductId, searchResults, selectedProductAccessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.studentId) return () => { cancelled = true; };

    const fetchRecommendations = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/recommendations?student_id=${encodeURIComponent(user.studentId)}`,
          {
            headers: studentAccessToken
              ? { Authorization: `Bearer ${studentAccessToken}` }
              : {},
          },
        );
        if (!response.ok) throw new Error('Failed to load recommendations');

        const data = await response.json();
        const recommendations = Array.isArray(data)
          ? data
          : data?.recommendations || data?.items || [];
        if (!cancelled) {
          setAiRecommendations(filterPublicProducts(recommendations, user));
          setRecommendationsStudentId(user.studentId);
        }
      } catch {
        if (!cancelled) {
          setAiRecommendations([]);
          setRecommendationsStudentId(user.studentId);
        }
      }
    };

    fetchRecommendations();
    return () => { cancelled = true; };
  }, [user?.studentId, studentAccessToken, user]);

  const scrollAiRecommendations = (direction) => {
    const container = aiScrollRef.current;
    if (!container) return;

    const visibleCards = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 4;
    container.scrollBy({
      left: direction * (container.clientWidth / visibleCards),
      behavior: 'smooth',
    });
  };

  const performSearch = async (query, category = selectedCategory) => {
    const trimmedSearch = query.trim();
    const department = user?.department || user?.college || user?.departmentName || '';
    setVisibleCount(PAGE_SIZE);
    setSearchedTitle(
      [trimmedSearch && t('home.resultsFor').replace('{query}', trimmedSearch), category]
        .filter(Boolean)
        .join(' · ')
    );
    if (!trimmedSearch && !category) {
      await fetchProducts({ department: department || undefined });
      return;
    }
    await fetchProducts({
      search: trimmedSearch || undefined,
      category: category || undefined,
      department: department || undefined,
    });
  };

  const scheduleSearch = (query) => {
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    searchDebounceTimeoutRef.current = window.setTimeout(() => {
      void performSearch(query);
    }, 300);
  };

  const handleSearch = (event) => {
    event?.preventDefault();
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    void performSearch(searchQuery, selectedCategory);
  };

  const handleSearchInputChange = (value) => {
    setSearchQuery(value);
    scheduleSearch(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setVisibleCount(PAGE_SIZE);
    setSearchedTitle('');
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    void performSearch('', '');
  };

  const handleCategoryClick = async (categoryName) => {
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    setVisibleCount(PAGE_SIZE);
    setIsDirectoryOpen(false);
    setSearchQuery('');
    setSelectedCategory(categoryName);
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ category: categoryName, department: department || undefined });
    setSearchedTitle(categoryName);
    setHoveredCategoryId(null);
  };

  const handleSubCategoryClick = async (subCategoryName, categoryName) => {
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    setVisibleCount(PAGE_SIZE);
    setIsDirectoryOpen(false);
    setSearchQuery(subCategoryName);
    setSelectedCategory('');
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ subcategory: subCategoryName, department: department || undefined });
    setSearchedTitle(`${categoryName} > ${subCategoryName}`);
    setHoveredCategoryId(null);
  };

  const handleQuickFilter = (query) => {
    if (searchDebounceTimeoutRef.current) window.clearTimeout(searchDebounceTimeoutRef.current);
    setSearchQuery(query);
    setSelectedCategory('');
    void performSearch(query, '');
    allProductsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const retryLastProductRequest = () => fetchProducts(lastProductRequestRef.current);
  const sortedProducts = [...searchResults].sort((left, right) => {
    if (sortOrder === 'price-low') return getProductPrice(left) - getProductPrice(right);
    if (sortOrder === 'price-high') return getProductPrice(right) - getProductPrice(left);
    if (sortOrder === 'popular') return getProductViews(right) - getProductViews(left);
    return getProductTimestamp(right) - getProductTimestamp(left);
  });
  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const listingFailureMessage = loadError?.kind === 'offline'
    ? t('home.noConnection')
    : t('home.listingsFailure');

  const handleShowMoreProducts = () => {
    setVisibleCount((current) => Math.min(current + PAGE_SIZE, searchResults.length));
  };

  const handleShowLessProducts = () => {
    setVisibleCount(PAGE_SIZE);
    allProductsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleWishlistToggle = async (event, product) => {
    event.stopPropagation();
    const studentId = user?.studentId || user?.student_id;
    if (!studentId) {
      onNavigate?.('login');
      return;
    }

    const productId = String(product.id);
    const wishlistItemId = wishlistItems[productId];
    const accessToken = getStudentAccessToken(user);
    try {
      const response = wishlistItemId
        ? await fetch(`${API_BASE_URL}/api/student/wishlist/${wishlistItemId}`, { method: 'DELETE' })
        : await fetch(`${API_BASE_URL}/api/student/wishlist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ student_id: studentId, product_id: Number(product.id) }),
        });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Unable to update your wishlist.');
      }

      if (wishlistItemId) {
        setWishlistState((current) => {
          const nextItems = { ...current.items };
          delete nextItems[productId];
          return { ...current, items: nextItems };
        });
        toast.success('Removed from wishlist.');
      } else {
        const item = await response.json().catch(() => ({}));
        setWishlistState((current) => ({
          studentId: String(currentStudentId),
          items: {
            ...(current.studentId === String(currentStudentId) ? current.items : {}),
            [productId]: item.id || true,
          },
        }));
        toast.success('Added to wishlist.');
      }
    } catch (error) {
      console.error('Unable to update the product wishlist.', error);
      toast.error(error.message || 'Unable to update your wishlist.');
    }
  };

  return (
    <div className="w-full">
      {selectedProduct ? (
        <div className="w-full">
          <ProductDetails
            product={selectedProduct}
            currentUser={user}
            pendingAction={pendingProductAction}
            onPendingActionHandled={onPendingProductActionHandled}
            onNavigate={onNavigate}
            onNavigateToMessages={onNavigateToMessages}
            onBack={() => {
              if (onBackToSellerHub) {
                onBackToSellerHub();
                return;
              }
              setSelectedProduct(null);
            }}
            onStartChat={() => {
              console.log('Start chat with seller', selectedProduct);
            }}
          />
        </div>
      ) : (
        <div className="w-full space-y-6 pt-1">
          <HeroSection
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchInputChange}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onSearch={handleSearch}
            onQuickFilter={handleQuickFilter}
            searchPlaceholder="Search books, laptops, dorm gear..."
          />

          {loadError && hasSignedInUser && !isLoadErrorDismissed && (
            <div className={contentContainerClass}>
              <div role="status" className="notranslate flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{listingFailureMessage}</p>
                  {import.meta.env.DEV && <p className="mt-1 text-xs text-slate-600">{t('home.developmentHint')}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={retryLastProductRequest} className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">{t('home.tryAgain')}</button>
                  <button type="button" aria-label={t('home.dismiss')} onClick={() => setIsLoadErrorDismissed(true)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-amber-800 hover:bg-amber-100">×</button>
                </div>
              </div>
            </div>
          )}

          <div className={`${contentContainerClass} space-y-6`}>
            <div className="flex justify-start md:hidden">
              <button
                type="button"
                onClick={() => setIsDirectoryOpen(true)}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <span aria-hidden="true">☰</span> {t('home.browseDirectory')}
              </button>
            </div>

            {isDirectoryOpen && (
              <div
                onClick={() => setIsDirectoryOpen(false)}
                className="fixed inset-0 z-40 bg-transparent md:hidden"
              />
            )}

            <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className={`fixed left-3 top-[136px] z-50 h-[min(70vh,600px)] min-h-0 w-[260px] max-w-[280px] -translate-x-[calc(100%+1rem)] overflow-hidden rounded-xl bg-white p-0 shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 md:sticky md:top-[88px] md:z-30 md:h-fit md:w-auto md:max-w-none md:translate-x-0 md:overflow-visible md:rounded-none md:bg-transparent md:p-0 md:shadow-none ${isDirectoryOpen ? 'translate-x-0' : ''}`} onMouseLeave={() => setHoveredCategoryId(null)}>
                <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)] md:h-auto md:min-h-[500px] md:overflow-visible md:rounded-[24px] md:shadow-sm">
                  <div className="flex shrink-0 items-center justify-between border-b pb-2 md:block">
                    <h3 className="m-4 text-md font-bold text-slate-900">Directory</h3>
                    <button type="button" onClick={() => setIsDirectoryOpen(false)} className="mr-4 rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Close directory">✕</button>
                  </div>
                  <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] md:block md:flex-none md:overflow-visible md:overscroll-auto md:[scrollbar-width:auto] md:gap-0 md:divide-y md:divide-slate-100">
                    {visibleCategories.map((cat) => (
                      <li
                        key={cat.id}
                        onMouseEnter={() => setHoveredCategoryId(cat.id)}
                        className={`group relative min-w-0 ${getCategoryAdCount(cat.adsCount) === 0 ? 'opacity-60' : ''}`}
                      >
                        <button
                          onClick={() => handleCategoryClick(cat.name)}
                          className="flex min-h-[48px] w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium leading-tight text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 md:justify-between md:rounded-2xl md:px-4 md:py-3.5 md:text-sm first:md:rounded-t-[24px] last:md:rounded-b-[24px]"
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-xl transition group-hover:bg-emerald-50 md:h-11 md:w-11">
                              {cat.icon}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col md:flex-none">
                              <span className="min-w-0 break-words text-sm font-medium leading-tight text-slate-800 group-hover:text-emerald-600 md:truncate md:text-sm md:font-semibold md:leading-normal">{cat.name}</span>
                              <span className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">{getCategoryAdCount(cat.adsCount) === 0 ? 'Coming Soon' : cat.adsCount}</span>
                            </span>
                          </span>
                          <span className="hidden text-slate-400 transition-transform group-hover:translate-x-1 md:block">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </button>

                        {hoveredCategoryId === cat.id && (
                          <div
                            className="absolute left-full top-0 ml-2 w-80 rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl transition duration-150 animate-fade-in z-40"
                            onMouseEnter={() => setHoveredCategoryId(cat.id)}
                          >
                            <h4 className="mb-3 text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-2">
                              <span>{cat.icon}</span> {cat.name}
                            </h4>
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                              {cat.items?.map((subItem) => (
                                <button
                                  key={subItem.name}
                                  onClick={() => handleSubCategoryClick(subItem.name, cat.name)}
                                  className="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 hover:text-emerald-600 transition group/sub"
                                >
                                  <span className="flex items-center gap-2.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-md border border-slate-100 group-hover/sub:bg-emerald-50 transition">
                                      {subItem.icon}
                                    </span>
                                    <span className="flex flex-col min-w-0">
                                      <span className="text-xs font-semibold text-slate-700 truncate group-hover/sub:text-emerald-600">{subItem.name}</span>
                                      <span className="text-[10px] text-slate-400 mt-0.5">{subItem.adsCount}</span>
                                    </span>
                                  </span>
                                  <span className="text-slate-300 group-hover/sub:translate-x-0.5 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="sticky bottom-0 z-10 w-full shrink-0 border-t border-slate-100 bg-white px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:static md:py-4">
                    <button
                      type="button"
                      onClick={() => setShowAllCategories((prev) => !prev)}
                      className="btn-primary w-full rounded-full px-4 py-2 text-sm font-semibold transition"
                    >
                      {showAllCategories ? (
                        <span className="flex items-center justify-center gap-2">Show Less <span></span></span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">Show More <span></span></span>
                      )}
                    </button>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 space-y-8">
                {user?.studentId && recommendationsStudentId === user.studentId && aiRecommendations.length > 0 && (
                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Personalized for you</p>
                        <h3 className="mt-1 text-2xl font-black text-slate-950">AI Recommendations</h3>
                        <p className="mt-1 text-sm text-slate-500">Relevant products selected from your campus marketplace activity.</p>
                      </div>
                      {aiRecommendations.length > 0 && <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => scrollAiRecommendations(-1)} aria-label="Previous AI recommendations" className="btn-primary flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition">&lt;</button>
                        <button type="button" onClick={() => scrollAiRecommendations(1)} aria-label="Next AI recommendations" className="btn-primary flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition">&gt;</button>
                      </div>}
                    </div>

                    <div ref={aiScrollRef} className="mt-5 flex snap-x items-stretch gap-2 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
                      {aiRecommendations.map((product, index) => (
                        <article key={product.id ?? `${product.title}-${index}`} onClick={() => openProduct(product)} onKeyDown={(event) => handleProductCardKeyDown(event, product)} role="button" tabIndex={0} className="flex h-full min-w-0 w-[calc(25%_-_0.375rem)] shrink-0 snap-start cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-md sm:w-[calc(33.333%_-_0.667rem)] lg:w-[calc(25%_-_0.75rem)]">
                          <img src={resolveImageUrl(getPrimaryImage(product))} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} alt={product.title || 'Recommended product'} className="aspect-square w-full rounded-xl object-cover sm:aspect-[4/3] sm:rounded-none" />
                          <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
                            <div className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                              <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.category || 'Marketplace pick'}</span>
                              {product.subcategory && <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.subcategory}</span>}
                            </div>
                            <h4 className="mt-1 line-clamp-2 text-[10px] leading-tight text-slate-950 sm:line-clamp-1 sm:text-sm sm:leading-normal sm:font-black">{product.title || 'Recommended product'}</h4>
                            <p
                              className="mt-1 hidden overflow-hidden text-ellipsis text-sm text-gray-600 sm:mb-3 sm:block"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                maxHeight: '4.5rem',
                                lineHeight: '1.5rem',
                              }}
                              title={product.description}
                            >
                              {product.description}
                            </p>
                            <div className="mt-auto flex min-w-0 flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                              <CompactEtbPrice value={product.price} className="min-w-0 text-[10px] font-bold text-slate-700 sm:text-base" />
                              <button type="button" onClick={(event) => { event.stopPropagation(); openProduct(product); }} className="hidden w-full shrink-0 cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-600 sm:inline-flex sm:w-auto">View Details</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-xl font-bold text-slate-900">{searchedTitle || t('home.allProducts')}</h3>
                    {!loading && !loadError && <span className="text-sm text-slate-500">{t('home.itemsFound').replace('{count}', String(searchResults.length))}</span>}
                  </div>
                  <label className="sr-only" htmlFor="catalog-sort">Sort products</label>
                  <select
                    id="catalog-sort"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="popular">Most Popular</option>
                  </select>
                </div>

                {loading ? (
                  <section className="notranslate rounded-[24px] border border-slate-200 bg-white p-5 sm:p-8" role="status">
                    <p className="text-center text-sm font-semibold text-slate-600">{t('home.listingsLoading')}</p>
                    <div aria-hidden="true" className="mt-5 grid min-w-0 gap-2 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                      {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl">
                          <div className="aspect-square bg-slate-100 sm:aspect-[4/3]" />
                          <div className="space-y-2 p-3"><div className="h-3 w-3/4 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : loadError ? (
                  hasSignedInUser || (!isLoadErrorDismissed && (
                    <section className="notranslate relative rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-700 sm:p-8" role="status">
                      <button type="button" aria-label={t('home.dismiss')} onClick={() => setIsLoadErrorDismissed(true)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-200">×</button>
                      <p className="font-semibold">{listingFailureMessage}</p>
                      {import.meta.env.DEV && <p className="mt-1 text-xs text-slate-500">{t('home.developmentHint')}</p>}
                      <button type="button" onClick={retryLastProductRequest} className="mt-4 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100">{t('home.tryAgain')}</button>
                    </section>
                  ))
                ) : searchResults.length === 0 ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-center text-slate-500 sm:p-12">
                    <span className="text-4xl">🔍</span>
                    <p className="mt-3 break-words text-lg font-semibold">{searchQuery.trim() ? t('home.noProductsFound').replace('{query}', searchQuery.trim()) : t('home.noProductsAvailable')}</p>
                    {searchQuery.trim() && <button type="button" onClick={clearSearch} className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">{t('home.clearSearch')}</button>}
                  </div>
                ) : (
                  <div ref={allProductsSectionRef} className="min-w-0">
                    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                      {visibleProducts.map((product, idx) => (
                        <article key={product.id ?? idx} onClick={() => openProduct(product)} onKeyDown={(event) => handleProductCardKeyDown(event, product)} role="button" tabIndex={0} className="flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md sm:rounded-[24px]">
                          <div className="relative min-w-0">
                            <img src={resolveImageUrl(getPrimaryImage(product))} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} alt={product.title} className="aspect-square w-full rounded-xl bg-slate-50/50 p-2 object-contain md:rounded-none" />
                            <span className="absolute top-2.5 left-2.5 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-xs backdrop-blur-xs">
                              {String(product.condition || '').toLowerCase().includes('new') ? '✨ New' : '👌 Used'}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => handleWishlistToggle(event, product)}
                              aria-label={`${wishlistItems[String(product.id)] ? 'Remove' : 'Add'} ${product.title} ${wishlistItems[String(product.id)] ? 'from' : 'to'} wishlist`}
                              aria-pressed={Boolean(wishlistItems[String(product.id)])}
                              className="absolute top-2.5 right-2.5 rounded-full bg-white/90 p-1.5 text-slate-400 shadow-xs transition hover:bg-white hover:text-red-500"
                            >
                              <Heart className={`h-4 w-4 ${wishlistItems[String(product.id)] ? 'fill-current text-red-500' : ''}`} aria-hidden="true" />
                            </button>
                            <div className="flex min-w-0 flex-col p-2 sm:p-4">
                              <div className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                                <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.category}</span>
                                {product.subcategory && <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.subcategory}</span>}
                              </div>
                              <h4 className="mt-1 line-clamp-2 break-words text-sm leading-tight text-slate-900 sm:line-clamp-1 sm:leading-normal sm:font-semibold">{product.title}</h4>
                              <p className="mt-1 text-xs text-slate-400">📍 {product.handover_location || product.pickup_location || 'Campus'}</p>
                              <p
                                className="mt-1 hidden overflow-hidden text-ellipsis text-sm text-gray-600 sm:mb-3 sm:block"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  maxHeight: '4.5rem',
                                  lineHeight: '1.5rem',
                                }}
                                title={product.description}
                              >
                                {product.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-auto flex min-w-0 flex-col justify-between p-4 pb-5">
                            <div className="flex min-w-0 flex-col gap-2 border-t border-slate-50 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                              <CompactEtbPrice value={product.price} language={language} className="min-w-0 whitespace-nowrap text-sm font-bold text-slate-900 sm:text-base sm:font-semibold" />
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openProduct(product);
                                }}
                                className="inline-flex min-h-[40px] w-full shrink-0 cursor-pointer items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-600 sm:w-auto"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    {searchResults.length > PAGE_SIZE && (
                      <div className="mt-8 mb-12 flex flex-col items-center gap-2">
                        <p className="text-sm text-slate-500">Showing {visibleCount} of {searchResults.length}</p>
                        <button
                          type="button"
                          onClick={visibleCount < searchResults.length ? handleShowMoreProducts : handleShowLessProducts}
                          className="btn-primary rounded-full px-4 py-2 text-sm font-semibold transition"
                        >
                          {visibleCount < searchResults.length ? 'Load More Products' : 'Show Less'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeView;
