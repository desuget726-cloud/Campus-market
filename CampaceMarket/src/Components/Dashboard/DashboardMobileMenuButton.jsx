function DashboardMobileMenuButton({ isOpen, onToggle, tone = 'light' }) {
    const toneClasses = tone === 'dark'
        ? 'text-white hover:bg-white/10 focus-visible:ring-white'
        : 'text-slate-700 hover:bg-slate-100 focus-visible:ring-sky-500';

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-controls="student-mobile-navigation"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 md:hidden ${toneClasses}`}
        >
            <span className="text-2xl leading-none" aria-hidden="true">☰</span>
        </button>
    );
}

export default DashboardMobileMenuButton;