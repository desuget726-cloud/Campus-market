import { ChevronDown, ChevronLeft, ChevronRight, PackageOpen, Search, X } from 'lucide-react';

const QUICK_FILTERS = [
  { label: '💻 Laptops', query: 'Laptops' },
  { label: '📱 Mobile Phones', query: 'Mobile Phones' },
  { label: '📚 Academic Books', query: 'Academic Books' },
  { label: '🎧 Earphone', query: 'Earphone' },
  // { label: '🖨️ Dorm Gear', query: 'Dorm Gear' },
];

function HeroSection({
  bannerImages,
  currentImageIndex,
  onPreviousBanner,
  onNextBanner,
  onSelectBanner,
  searchQuery,
  onSearchQueryChange,
  categories,
  selectedCategory,
  onCategoryChange,
  onSearch,
  onQuickFilter,
  searchPlaceholder,
}) {
  return (
    <section className="group relative isolate flex min-h-[560px] w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-16 text-center sm:min-h-[600px] sm:px-8">
      {bannerImages.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${currentImageIndex === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <button
        type="button"
        onClick={onPreviousBanner}
        aria-label="Previous banner"
        className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50 sm:left-6 sm:h-12 sm:w-12"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onNextBanner}
        aria-label="Next banner"
        className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50 sm:right-6 sm:h-12 sm:w-12"
      >
        <ChevronRight className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-5xl">
          UniXchange 
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-200 drop-shadow sm:text-lg">
          Buy, sell, and exchange textbooks, electronics, and dorm gear safely with fellow students.
        </p>

        <form
          onSubmit={onSearch}
          role="search"
          className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center gap-2 rounded-2xl border border-white/30 bg-white/95 p-2 text-slate-800 shadow-2xl backdrop-blur-sm sm:flex-row"
        >
          <label className="relative flex min-h-12 w-full shrink-0 items-center sm:w-auto sm:min-w-[190px]">
            <PackageOpen className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Product category</span>
            <select
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-full w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id || category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" aria-hidden="true" />
          </label>

          <label className="relative flex min-h-12 w-full min-w-0 flex-1 items-center">
            <span className="sr-only">Search campus listings</span>
            <Search className="absolute left-3 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Clear search"
                className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </label>

          <button
            type="submit"
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-500 px-6 py-2.5 font-medium text-white shadow-md transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>

        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-2">
          <span className="px-1 text-xs font-semibold text-slate-200 sm:text-sm">Popular:</span>
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.query}
              type="button"
              onClick={() => onQuickFilter(filter.query)}
              className="cursor-pointer rounded-full border border-white/15 bg-white/15 px-3.5 py-1.5 text-xs text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:text-sm"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 justify-center gap-2">
        {bannerImages.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectBanner(index)}
            aria-label={`Show banner ${index + 1}`}
            aria-current={currentImageIndex === index ? 'true' : undefined}
            className={`h-2.5 rounded-full transition-all ${currentImageIndex === index ? 'w-6 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'}`}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroSection;
