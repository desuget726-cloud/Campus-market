import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, LayoutDashboard, LogOut, Menu, MessageCircle, Package, Plus, Search, Settings, ShoppingBag, ShoppingCart } from 'lucide-react';
import logs from '../../assets/logs.png';
import { useLanguage } from '../../context/LanguageContext';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import { useCart } from '../../context/CartContext';

function Navbar({ onNavigate, onProductSearch, user, userRole, onLogout, unreadCount, onNotificationClick, notificationDrawerOpen = false, onAdminSettingsClick, activeStudentMode, variant = 'public' }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileImageOpen, setIsProfileImageOpen] = useState(false);
  const [searchText, setSearchText] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('search') || ''
  ));
  const [messageCountState, setMessageCountState] = useState({ studentId: '', count: 0 });
  const [profileState, setProfileState] = useState(() => ({ source: user, value: user }));
  const profileUser = profileState.source === user ? profileState.value : user;
  const languageMenuRef = useRef(null);
  const headerRef = useRef(null);
  const { t, language, setLanguage } = useLanguage();
  const { items: cartItems, cartBadgeDismissed } = useCart();
  const isDashboardLayout = variant === 'dashboard';
  const shouldShowNavbarSearch = Boolean(user)
    || (typeof window !== 'undefined' && window.location.pathname !== '/');
  const effectiveRole = String(userRole || user?.role || 'student').toLowerCase().trim().replace(/_/g, ' ');
  const isAdmin = ['admin', 'sub admin', 'super admin', 'superadministrator'].includes(effectiveRole);
  const searchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
  const currentDashboardTab = searchParams?.get('tab') || '';
  const isSellerModeActive = Boolean(user && !isAdmin && (
    activeStudentMode === 'seller'
    || searchParams?.get('mode') === 'seller'
    || currentDashboardTab === 'seller'
    || currentDashboardTab === 'inventory'
    || currentDashboardTab.startsWith('seller_hub')
  ));
  const studentId = isAdmin ? '' : String(user?.studentId || user?.student_id || '').trim();
  const accessToken = user?.access_token || user?.accessToken || user?.token || user?.session_token || user?.sessionToken || '';
  const unreadMessageCount = messageCountState.studentId === studentId ? messageCountState.count : 0;
  const cartCount = cartBadgeDismissed ? 0 : (cartItems || []).reduce(
    (total, item) => total + Math.max(0, Number(item.quantity) || 1),
    0,
  );
  const displayUser = isAdmin ? { ...user, ...profileUser } : user;
  const displayName = isAdmin
    ? (displayUser?.username || displayUser?.name || 'Admin')
    : (displayUser?.name || displayUser?.studentId || 'Student');
  const displayEmail = displayUser?.email || 'Email unavailable';
  const displayRole = String(displayUser?.role || effectiveRole).toUpperCase();
  const handleBrowseClick = () => {
    if (!user) {
      onNavigate('login', { redirect: 'browse-market' });
      return;
    }
    if (!isAdmin) {
      onNavigate('/dashboard?mode=buyer');
      return;
    }
    onNavigate('admin-dashboard');
  };
  const handleSellClick = () => {
    if (!user) {
      onNavigate('login', { redirect: 'post-item' });
      return;
    }
    onNavigate(isAdmin ? 'admin-dashboard' : '/dashboard?mode=seller');
  };
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    onProductSearch?.(searchText.trim());
  };

  useEffect(() => {
    if (!studentId || !accessToken) return undefined;

    let active = true;
    let requestInFlight = false;
    const fetchUnreadMessages = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/messages/unread-count?student_id=${encodeURIComponent(studentId)}`,
          {
            credentials: 'include',
            ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
          },
        );
        if (!response.ok) return;
        const data = await response.json();
        const parsedCount = Number(data.unreadCount ?? data.unread_count ?? 0);
        if (active) {
          setMessageCountState({ studentId, count: Number.isFinite(parsedCount) ? parsedCount : 0 });
        }
      } catch (error) {
        console.error('Unable to load unread message count:', error);
      } finally {
        requestInFlight = false;
      }
    };

    void fetchUnreadMessages();
    const intervalId = window.setInterval(fetchUnreadMessages, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [accessToken, studentId]);
  const languageSelector = (
    <div className="notranslate relative shrink-0" ref={languageMenuRef}>
      <button
        type="button"
        aria-label={t('navbar.language')}
        aria-haspopup="menu"
        aria-expanded={isLanguageMenuOpen}
        aria-controls="navbar-language-menu"
        onClick={() => setIsLanguageMenuOpen((isOpen) => !isOpen)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/30 bg-white/10 px-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 max-[400px]:px-1 md:h-10 md:gap-2 md:px-3 md:text-sm"
      >
        <span>{language === 'am' ? 'አማርኛ' : 'English'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform md:h-4 md:w-4 ${isLanguageMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isLanguageMenuOpen && (
        <div id="navbar-language-menu" role="menu" aria-label={t('navbar.language')} className="absolute right-0 top-full z-[60] mt-2 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-800 shadow-xl">
          {[
            ['en', 'English'],
            ['am', 'አማርኛ'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              onClick={() => {
                setLanguage(code);
                setIsLanguageMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 ${language === code ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'}`}
            >
              <span>{label}</span>
              {language === code && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const avatarSrc = displayUser?.avatarUrl || displayUser?.avatar_url || (isAdmin
    ? ''
    : (displayUser?.studentId ? `/static/uploads/avatars/${displayUser.studentId}.jpg` : ''));
  const resolvedAvatarSrc = avatarSrc ? resolveImageUrl(avatarSrc) : IMAGE_PLACEHOLDER;

  useEffect(() => {
    if (!isProfileImageOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsProfileImageOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isProfileImageOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) setIsLanguageMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsLanguageMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    const syncSearchFromUrl = () => {
      setSearchText(new URLSearchParams(window.location.search).get('search') || '');
    };
    window.addEventListener('popstate', syncSearchFromUrl);
    return () => window.removeEventListener('popstate', syncSearchFromUrl);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (!headerRef.current?.contains(event.target)) setIsMobileMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    let cancelled = false;
    const fetchAdminProfile = async () => {
      try {
        const savedSession = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
        const sessionUser = savedSession?.user || savedSession || {};
        const storedRole = String(savedSession?.userRole || sessionUser?.role || '')
          .toLowerCase()
          .replace(/[\s-]+/g, '_');
        if (!savedSession?.user || !['admin', 'sub_admin', 'super_admin'].includes(storedRole)) return;
        const token = savedSession?.access_token
          || savedSession?.accessToken
          || sessionUser?.access_token
          || sessionUser?.accessToken
          || sessionUser?.token;
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setProfileState((current) => ({
            source: user,
            value: { ...(current.source === user ? current.value : user), ...data },
          }));
        }
      } catch (error) {
        console.warn('Failed to refresh the admin navbar profile.', error);
      }
    };

    fetchAdminProfile();
    return () => { cancelled = true; };
  }, [isAdmin, user, userRole]);

  return (
    <header
      ref={headerRef}
      className="site-navbar sticky top-0 z-50 h-[72px] w-full shrink-0 border-b border-slate-800 text-white shadow-sm"
    >
      <div ref={headerRef} className="mx-auto flex h-full w-full max-w-[1600px] min-w-0 items-center gap-2 px-2 sm:gap-3 sm:px-4 lg:gap-5 lg:px-6">

        {isDashboardLayout && (
          <button
            type="button"
            aria-label="Open dashboard navigation"
            aria-controls={isAdmin ? 'admin-sidebar' : 'student-sidebar'}
            onClick={() => window.dispatchEvent(new Event('campace:toggle-dashboard-sidebar'))}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2 max-[400px]:gap-1">
          <button type="button" aria-label="Go to marketplace" className="flex shrink-0 cursor-pointer items-center gap-2 bg-transparent text-left max-[500px]:gap-1" onClick={() => onNavigate('home')}>
            <img
              src={logs}
              alt="UniXchange logo"
              className="notranslate h-9 w-9 shrink-0 rounded-full border-2 border-white/80 bg-white/90 object-cover p-1 shadow-md sm:h-11 sm:w-11"
            />
            <span className="notranslate whitespace-nowrap text-base font-black tracking-tight text-white max-[500px]:hidden sm:text-lg">UniXchange</span>
          </button>
        </div>

        {shouldShowNavbarSearch && (
          <form onSubmit={handleSearchSubmit} role="search" className="mx-1 flex min-w-[4rem] max-w-[42rem] flex-1 justify-center sm:mx-3 lg:mx-6">
            <div className="flex h-9 w-full min-w-0 overflow-hidden rounded-lg bg-white shadow-sm sm:h-10">
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search products"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="min-w-0 flex-1 bg-white px-2 text-xs text-slate-900 outline-none placeholder:text-slate-500 sm:px-4 sm:text-sm"
              />
              <button type="submit" aria-label="Search" title="Search products" className="flex w-9 shrink-0 items-center justify-center bg-sky-600 text-white transition hover:bg-sky-700 sm:w-12">
                <Search className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {/* Right side: Login/Register OR Profile Dropdown */}
        <div className="relative ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {!user && !isDashboardLayout && (
            <button
              type="button"
              aria-label="Toggle mobile navigation"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {user ? (
            // Logged In Dropdown View
            <div className="relative flex min-w-0 max-w-full items-center gap-2 sm:gap-3 max-[400px]:gap-1">
              {!isAdmin && (
                <button
                  type="button"
                  aria-label={isSellerModeActive ? 'Browse Market' : 'Sell an Item'}
                  onClick={isSellerModeActive ? handleBrowseClick : handleSellClick}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-white text-sm font-semibold text-sky-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:px-3"
                  title={isSellerModeActive ? 'Browse Market' : 'Sell an Item'}
                >
                  {isSellerModeActive
                    ? <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    : <Plus className="h-4 w-4" aria-hidden="true" />}
                  <span className="hidden sm:inline">{isSellerModeActive ? 'Browse Market' : 'Sell an Item'}</span>
                </button>
              )}
              <div className="hidden sm:block">{languageSelector}</div>
              <button
                type="button"
                onClick={() => onNavigate(isAdmin ? 'admin-dashboard' : '/dashboard?tab=messages', isAdmin ? { tab: 'support' } : undefined)}
                aria-label="Messages"
                title="Messages"
                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {!isAdmin && unreadMessageCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-slate-900 bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard?mode=buyer&tab=cart')}
                  aria-label="Cart"
                  title="Cart"
                  className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                  {cartCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-slate-900 bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onNotificationClick}
                aria-label="Open notifications"
                aria-haspopup="dialog"
                aria-expanded={notificationDrawerOpen}
                aria-controls="notification-drawer"
                className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-transparent text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                title="Notifications"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-slate-900 bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <div className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-1 py-1 text-left transition hover:bg-white/15 sm:gap-2 sm:px-2">
                  <button
                    type="button"
                    aria-label="Open account menu"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    aria-expanded={isDropdownOpen}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white transition hover:ring-2 hover:ring-sky-300 sm:h-9 sm:w-9"
                  >
                    {avatarSrc ? (
                      <img src={resolvedAvatarSrc} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="flex cursor-pointer items-center gap-1 text-left sm:gap-2"
                    title="Account Menu"
                    aria-expanded={isDropdownOpen}
                    aria-label="Open account menu"
                  >
                    <div className="hidden leading-tight lg:block">
                      <div className="text-sm font-bold leading-tight text-white">{displayName}</div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">{displayRole}</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </div>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                      <button
                        type="button"
                        aria-label={`View ${displayName}'s profile picture`}
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsProfileImageOpen(true);
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white"
                      >
                        {avatarSrc ? <img src={resolvedAvatarSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-slate-700">{displayName.slice(0, 1)}</span>}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                        <p className="truncate text-xs text-slate-500">{displayEmail}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onNavigate(isAdmin ? 'admin-dashboard' : '/dashboard');
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      Dashboard
                    </button>
                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onNavigate('/dashboard?mode=buyer&tab=orders');
                        }}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Package className="h-4 w-4" aria-hidden="true" />
                        My Orders
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (isAdmin && onAdminSettingsClick) onAdminSettingsClick();
                        else onNavigate(isAdmin ? 'admin-dashboard' : '/dashboard?tab=settings', isAdmin ? { tab: 'settings' } : undefined);
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Settings
                    </button>
                    <div className="border-t border-slate-200" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onLogout?.();
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Logged Out Login/Register View
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-white/60 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
              >
                🛒 Browse Market
              </button>
              <button
                type="button"
                onClick={handleSellClick}
                className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-white/80 bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
              >
                + Sell an Item
              </button>
              {languageSelector}
              <button
                onClick={() => onNavigate('login')}
                className="hidden min-h-10 cursor-pointer items-center rounded-xl border border-white/25 px-4 font-semibold text-white transition duration-200 hover:border-white/50 hover:bg-white/10 md:flex"
              >
                {t('navbar.login')}
              </button>
              <button
                onClick={() => onNavigate('register')}
                className="hidden min-h-10 cursor-pointer items-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:flex"
              >
                {t('navbar.signup')}
              </button>
            </div>
          )}
        </div>

      </div>

      {!user && !isDashboardLayout && isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close mobile navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
          <aside id="mobile-navigation" className="absolute left-0 right-0 top-full z-50 mx-3 mt-2 w-auto rounded-xl bg-slate-900 p-2 text-white shadow-lg md:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-2 px-4">
              <button
                type="button"
                onClick={() => {
                  handleBrowseClick();
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[48px] w-full rounded-xl border border-white/50 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Browse Market
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('login');
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[48px] w-full rounded-lg border border-white/40 text-center font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t('navbar.login')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('register');
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[48px] w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
              >
                {t('navbar.signup')}
              </button>
            </div>
          </aside>
        </>
      )}
      {isProfileImageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsProfileImageOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${displayName}'s profile picture`}
            className="relative flex flex-col items-center rounded-2xl bg-slate-900/90 p-8 text-center text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close profile picture"
              onClick={() => setIsProfileImageOpen(false)}
              className="absolute right-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-2xl text-white transition hover:bg-white/15"
            >
              ✕
            </button>
            <img
              src={resolvedAvatarSrc}
              alt={displayName}
              className="h-72 w-72 rounded-full border-4 border-white object-cover shadow-2xl"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = IMAGE_PLACEHOLDER;
              }}
            />
            <p className="mt-5 text-xl font-bold">{displayName}</p>
            <p className="mt-1 text-sm font-medium text-slate-300">Verified Student</p>
          </section>
        </div>
      )}
    </header>
  );
}

export default Navbar;