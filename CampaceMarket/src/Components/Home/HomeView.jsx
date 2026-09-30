import { useState, useEffect, useRef } from 'react';
import ProductDetails from './ProductDetails';
import { apiUrl } from '../../api/config';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import logs from '../../assets/logs.png';
import c2 from '../../assets/c2.jpg';
import laptop_586 from '../../assets/laptop_586.webp';
import phone1 from '../../assets/phone1.jpg';
import c3 from '../../assets/c3.jpg';
import c7 from '../../assets/c7.jpg';

const fetchWithTimeout = (url, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
};

const bannerImages = [
  logs,
  // c2,
  c3,
  laptop_586,
  phone1,
  c7
];

const formatEtb = (value) => {
  if (value === null || value === undefined || value === '') return 'Price unavailable';

  const numericValue = Number(String(value).replace(/[$,\s]|ETB/gi, ''));
  if (Number.isFinite(numericValue)) {
    return `${numericValue.toLocaleString('en-ET')} ETB`;
  }

  return `${String(value).replace(/\$/g, '').replace(/\s*ETB\s*/gi, '').trim()} ETB`;
};

const CompactEtbPrice = ({ value, className }) => {
  const formattedPrice = formatEtb(value);
  const hasEtbSuffix = formattedPrice.endsWith(' ETB');

  return (
    <p className={className}>
      {hasEtbSuffix ? formattedPrice.slice(0, -4) : formattedPrice}
      {hasEtbSuffix && <span className="hidden sm:inline"> ETB</span>}
    </p>
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

function HomeView({ onAction, user, initialProductId, onUserUpdate, onNavigate, onNavigateToMessages }) {
  const contentContainerClass = 'mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-10 2xl:px-16';
  const [categories, setCategories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedTitle, setSearchedTitle] = useState('All Products');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const aiScrollRef = useRef(null);

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

  const handlePrevBanner = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + bannerImages.length) % bannerImages.length);
  };

  const handleNextBanner = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetchWithTimeout(apiUrl('/api/categories'));
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
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
      console.error('Category fetch error:', error);
      setLoadError('The marketplace service is unavailable. Please check the backend and try again.');
      setCategories([]);
    }
  };

  const fetchProducts = async ({ search, category, subcategory, department } = {}) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      if (department) params.set('department', department);

      const url = params.toString()
        ? `/api/products?${params.toString()}`
        : '/api/products';
      const response = await fetchWithTimeout(apiUrl(url));
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Product fetch error:', error);
      setLoadError('The marketplace service is unavailable. Please check the backend and try again.');
      setSearchResults([]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setLoadError('');
      const department = user?.department || user?.college || user?.departmentName || '';
      try {
        await Promise.all([
          fetchCategories(),
          fetchProducts({ department: department || undefined }),
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [user?.department, user?.college, user?.departmentName]);

  useEffect(() => {
    if (!loading) window.dispatchEvent(new Event('campace:content-rendered'));
  }, [categories, loading, searchResults]);

  useEffect(() => {
    if (!initialProductId) return;

    const productFromResults = searchResults.find((item) => String(item.id) === String(initialProductId));
    if (productFromResults) {
      setSelectedProduct(productFromResults);
      return;
    }

    const fetchSelectedProduct = async () => {
      try {
        const response = await fetchWithTimeout(apiUrl(`/api/products/${initialProductId}`));
        if (!response.ok) throw new Error('Failed to load selected product');
        setSelectedProduct(await response.json());
      } catch (error) {
        console.error('Selected product fetch error:', error);
      }
    };

    fetchSelectedProduct();
  }, [initialProductId, searchResults]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user?.studentId) {
        setAiRecommendations([]);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/recommendations?student_id=${encodeURIComponent(user.studentId)}`
        );
        if (!response.ok) throw new Error('Failed to load AI recommendations');

        const data = await response.json();
        const recommendations = Array.isArray(data)
          ? data
          : data.recommendations || data.items || [];
        setAiRecommendations(Array.isArray(recommendations) ? recommendations : []);
      } catch (error) {
        console.error('Recommendation fetch error:', error);
        setAiRecommendations([]);
      }
    };

    fetchRecommendations();
  }, [user?.studentId]);

  const scrollAiRecommendations = (direction) => {
    const container = aiScrollRef.current;
    if (!container) return;

    const visibleCards = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 4;
    container.scrollBy({
      left: direction * (container.clientWidth / visibleCards),
      behavior: 'smooth',
    });
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    const trimmedSearch = searchQuery.trim();
    const department = user?.department || user?.college || user?.departmentName || '';
    if (!trimmedSearch) {
      await fetchProducts({ department: department || undefined });
      setSearchedTitle('All Products');
      return;
    }
    await fetchProducts({ search: trimmedSearch, department: department || undefined });
    setSearchedTitle(`Results for "${trimmedSearch}"`);
  };

  const handleCategoryClick = async (categoryName) => {
    setIsDirectoryOpen(false);
    setSearchQuery('');
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ category: categoryName, department: department || undefined });
    setSearchedTitle(categoryName);
    setHoveredCategoryId(null);
  };

  const handleSubCategoryClick = async (subCategoryName, categoryName) => {
    setIsDirectoryOpen(false);
    setSearchQuery(subCategoryName);
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ subcategory: subCategoryName, department: department || undefined });
    setSearchedTitle(`${categoryName} > ${subCategoryName}`);
    setHoveredCategoryId(null);
  };

  return (
    <div className="w-full">
      {loading ? (
        <div className={contentContainerClass}>
          <div className="rounded-[28px] bg-white border border-slate-200 p-12 text-center text-slate-600 shadow-md haight=500">
            <p className="text-lg font-semibold text-slate-900">Loading marketplace data…</p>
            <p className="mt-2 text-sm">Please wait while categories and products are loaded.</p>
          </div>
        </div>
      ) : selectedProduct ? (
        <div className="w-full">
          <ProductDetails
            product={selectedProduct}
            currentUser={user}
            onNavigate={onNavigate}
            onNavigateToMessages={onNavigateToMessages}
            onBack={() => setSelectedProduct(null)}
            onStartChat={() => {
              console.log('Start chat with seller', selectedProduct);
            }}
          />
        </div>
      ) : (
        <div className="w-full space-y-6 pt-1">
          {loadError && <div className={contentContainerClass}><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div></div>}
          <section className="group relative w-full rounded-none border-b border-slate-200/40 overflow-hidden shadow-md text-center text-slate-100 h-[600px]">
            {bannerImages.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`Campus banner ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out z-0 ${currentImageIndex === index ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            <button
              type="button"
              onClick={handlePrevBanner}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/30 hover:bg-black/50 text-white p-3.5"
              aria-label="Previous banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 011.414 1.414L9.414 11l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNextBanner}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/30 hover:bg-black/50 text-white p-3.5"
              aria-label="Next banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L13.414 9l-4.707 4.707a1 1 0 01-1.414-1.414L10.586 9 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="relative z-20">
              <h2 className="text-3xl font-bold text-white">Find What You Need on Campus</h2>
              <p className="mt-2 text-slate-200">Browse peer listings or search specific academic items instantly.</p>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 justify-center">
              {bannerImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentImageIndex(index)}
                  aria-label={`Show banner ${index + 1}`}
                  className={currentImageIndex === index ? 'w-6 h-2.5 rounded-full bg-white' : 'w-2.5 h-2.5 rounded-full bg-white/40 hover:bg-white/70'}
                />
              ))}
            </div>
          </section>

          <div className={`${contentContainerClass} space-y-6`}>
            <div className="mx-auto w-full max-w-3xl">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 p-2 rounded-full bg-white border border-slate-200 shadow-md max-w-3xl mx-auto w-full">
                <input
                  type="text"
                  placeholder="Search books, laptops, lab coats, calculators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-full px-6 py-3.5 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
                />
                <button
                  type="submit"
                  className="btn-primary rounded-full px-8 py-3.5 font-semibold transition shadow-md whitespace-nowrap"
                >
                  Search Materials
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={() => setIsDirectoryOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 md:hidden"
            >
              <span aria-hidden="true">☰</span> Browse Directory
            </button>

            {isDirectoryOpen && (
              <div
                onClick={() => setIsDirectoryOpen(false)}
                className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
              />
            )}

            <div className="grid gap-8 md:grid-cols-[280px_1fr]">
              <aside className={`fixed inset-y-0 left-0 z-50 w-80 -translate-x-full overflow-y-auto bg-white p-3 shadow-2xl transition-transform duration-300 md:sticky md:top-[88px] md:z-30 md:h-fit md:w-auto md:translate-x-0 md:overflow-visible md:bg-transparent md:p-0 md:shadow-none ${isDirectoryOpen ? 'translate-x-0' : ''}`} onMouseLeave={() => setHoveredCategoryId(null)}>
                <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm min-h-[500px]">
                  <div className="flex items-center justify-between border-b pb-2 md:block">
                    <h3 className="m-4 text-md font-bold text-slate-900">Directory</h3>
                    <button type="button" onClick={() => setIsDirectoryOpen(false)} className="mr-4 rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Close directory">✕</button>
                  </div>
                  <ul className="grid grid-cols-4 gap-2 md:block md:gap-0 md:divide-y md:divide-slate-100">
                    {visibleCategories.map((cat) => (
                      <li
                        key={cat.id}
                        onMouseEnter={() => setHoveredCategoryId(cat.id)}
                        className={`group relative min-w-0 ${getCategoryAdCount(cat.adsCount) === 0 ? 'opacity-60' : ''}`}
                      >
                        <button
                          onClick={() => handleCategoryClick(cat.name)}
                          className="flex w-full min-w-0 flex-col items-center justify-start gap-1 rounded-xl px-1 py-2 text-center text-[11px] leading-tight text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 focus-visible:bg-indigo-50 focus-visible:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 md:flex-row md:items-center md:justify-between md:gap-3 md:rounded-2xl md:px-4 md:py-3.5 md:text-left md:text-sm first:md:rounded-t-[24px] last:md:rounded-b-[24px]"
                        >
                          <span className="flex w-full min-w-0 flex-col items-center gap-1 md:w-auto md:flex-row md:gap-3">
                            <span className="flex aspect-square w-full shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-xl transition group-hover:bg-emerald-50 md:aspect-auto md:h-11 md:w-11">
                              {cat.icon}
                            </span>
                            <span className="flex w-full min-w-0 flex-col md:w-auto">
                              <span className="line-clamp-2 break-words text-[11px] leading-tight font-semibold text-slate-800 group-hover:text-emerald-600 md:truncate md:text-sm md:leading-normal">{cat.name}</span>
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
                  <div className="border-t border-slate-100 px-4 py-4">
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
                {user?.studentId && aiRecommendations.length > 0 && (
                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Personalized for you</p>
                        <h3 className="mt-1 text-2xl font-black text-slate-950">AI Recommendations</h3>
                        <p className="mt-1 text-sm text-slate-500">Relevant products selected from your campus marketplace activity.</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => scrollAiRecommendations(-1)} aria-label="Previous AI recommendations" className="btn-primary flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition">&lt;</button>
                        <button type="button" onClick={() => scrollAiRecommendations(1)} aria-label="Next AI recommendations" className="btn-primary flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition">&gt;</button>
                      </div>
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
                            <p className="mt-1 hidden line-clamp-1 text-xs text-slate-500 sm:block">{product.description}</p>
                            <div className="mt-auto flex min-w-0 flex-col gap-2 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                              <CompactEtbPrice value={product.price} className="min-w-0 text-[10px] font-bold text-slate-700 sm:text-base" />
                              <button type="button" onClick={(event) => { event.stopPropagation(); openProduct(product); }} className="btn-primary hidden w-full shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:inline-flex sm:w-auto">View Details</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">{searchedTitle}</h3>
                  <span className="text-sm text-slate-500">{searchResults.length} items found</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-12 text-center text-slate-500">
                    <span className="text-4xl">🔍</span>
                    <p className="mt-3 text-lg font-semibold">No products found matching that query.</p>
                    <p className="text-sm text-slate-400 mt-1">Try selecting another subcategory from the sidebar.</p>
                  </div>
                ) : (
                  <div className="grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {searchResults.map((product, idx) => (
                      <article key={product.id ?? idx} onClick={() => openProduct(product)} onKeyDown={(event) => handleProductCardKeyDown(event, product)} role="button" tabIndex={0} className="flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md sm:rounded-[24px]">
                        <div>
                          <img src={resolveImageUrl(getPrimaryImage(product))} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} alt={product.title} className="aspect-square w-full rounded-xl object-cover sm:aspect-[4/3] sm:rounded-none" />
                          <div className="flex min-w-0 flex-col p-2 sm:p-4">
                            <div className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                              <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.category}</span>
                              {product.subcategory && <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{product.subcategory}</span>}
                            </div>
                            <h4 className="mt-1 line-clamp-2 text-[10px] leading-tight text-slate-900 sm:line-clamp-1 sm:text-sm sm:leading-normal sm:font-semibold">{product.title}</h4>
                            <p className="mt-1 hidden line-clamp-1 text-xs text-slate-500 sm:block">{product.description}</p>
                          </div>
                        </div>
                        <div className="mt-auto min-w-0 p-3 pt-0 sm:p-4 sm:pt-0">
                          <div className="flex min-w-0 flex-col gap-2 border-t border-slate-50 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <CompactEtbPrice value={product.price} className="min-w-0 text-[10px] font-bold text-slate-900 sm:text-base" />
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openProduct(product);
                              }}
                              className="btn-primary hidden w-full shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:inline-flex sm:w-auto"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
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
