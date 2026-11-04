import { ChevronDown, PackageOpen, Search, X } from 'lucide-react';

const QUICK_FILTERS = [
  { icon: '💻', label: 'Laptops', query: 'Laptops' },
  { icon: '📱', label: 'Phones', query: 'Mobile Phones' },
  { icon: '📚', label: 'Textbooks', query: 'Academic Books' },
  { icon: '🎧', label: 'Audio', query: 'Earphone' },
];

function HeroSection({
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
    <section className="w-full border-b border-sky-100 bg-gradient-to-b from-sky-100/90 via-sky-50/60 to-white py-10 text-center">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-800 shadow-xs">
          🎓 Verified UniXchange Community
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          UniXchange
        </h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Find textbooks, tech &amp; essentials from fellow students
        </p>

        <form
          onSubmit={onSearch}
          role="search"
          className="mx-auto mt-6 flex w-full max-w-3xl flex-col items-stretch gap-2 rounded-2xl border border-sky-200/80 bg-white p-1.5 shadow-lg shadow-sky-900/5 transition-all focus-within:ring-2 focus-within:ring-sky-500 sm:flex-row sm:items-center"
        >
          <label className="relative flex min-h-10 w-full shrink-0 items-center border-b border-slate-200 pb-2 text-xs font-medium text-slate-700 sm:w-auto sm:min-w-[180px] sm:border-r sm:border-b-0 sm:pb-0 sm:pr-2 sm:text-sm sm:mr-1">
            <PackageOpen className="pointer-events-none absolute left-2 h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Product category</span>
            <select
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-full w-full appearance-none rounded-lg bg-white py-2 pl-8 pr-8 text-xs font-medium text-slate-700 outline-none sm:text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id || category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-500" aria-hidden="true" />
          </label>

          <label className="relative flex min-h-10 w-full min-w-0 flex-1 items-center">
            <span className="sr-only">Search UniXchange listings</span>
            <Search className="absolute left-3 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full w-full min-w-0 rounded-lg bg-white px-2 py-2 pl-10 pr-10 text-xs text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
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
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 sm:w-auto sm:text-sm"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>

        <div className="mx-auto mt-4 flex w-full flex-wrap items-center justify-center gap-2">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.query}
              type="button"
              onClick={() => onQuickFilter(filter.query)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-sky-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:border-sky-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <span aria-hidden="true">{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
