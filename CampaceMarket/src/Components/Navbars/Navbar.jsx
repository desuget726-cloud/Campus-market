import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import logs from '../../assets/logs.png';
import { useLanguage } from '../../context/LanguageContext';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';

function Navbar({ onNavigate, user, userRole, onLogout, unreadCount, onNotificationClick, onAdminProfileClick, onStudentProfileClick, variant = 'public' }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(user);
  const languageMenuRef = useRef(null);
  const { t, language, setLanguage } = useLanguage();
  const isDashboardLayout = variant === 'dashboard';
  useEffect(() => {
    const openMobileNavigation = () => setIsMobileMenuOpen(true);
    window.addEventListener('campace:open-public-mobile-navigation', openMobileNavigation);
    return () => window.removeEventListener('campace:open-public-mobile-navigation', openMobileNavigation);
  }, []);
  const effectiveRole = String(userRole || user?.role || 'student').toLowerCase().trim().replace(/_/g, ' ');
  const isAdmin = ['admin', 'sub admin', 'super admin', 'superadministrator'].includes(effectiveRole);
  const displayUser = isAdmin ? { ...user, ...profileUser } : user;
  const displayName = isAdmin
    ? (displayUser?.username || displayUser?.name || 'Admin')
    : (displayUser?.name || displayUser?.studentId || 'Student');
  const displayEmail = displayUser?.email || 'Email unavailable';
  const displayRole = String(displayUser?.role || effectiveRole).toUpperCase();
  const avatarSrc = displayUser?.avatarUrl || displayUser?.avatar_url || (isAdmin
    ? ''
    : (displayUser?.studentId ? `/static/uploads/avatars/${displayUser.studentId}.jpg` : ''));

  useEffect(() => {
    setProfileUser(user);
  }, [user]);

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
    if (!isAdmin) return undefined;

    let cancelled = false;
    const fetchAdminProfile = async () => {
      try {
        const savedSession = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
        const sessionUser = savedSession?.user || savedSession || {};
        const token = user?.access_token || user?.accessToken || sessionUser?.access_token || sessionUser?.accessToken || savedSession?.access_token || savedSession?.accessToken;
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) setProfileUser((current) => ({ ...current, ...data }));
      } catch (error) {
        console.warn('Failed to refresh the admin navbar profile.', error);
      }
    };

    fetchAdminProfile();
    return () => { cancelled = true; };
  }, [isAdmin, user?.accessToken, user?.access_token, userRole]);

  return (
    <header className="site-navbar fixed top-0 left-0 right-0 z-[100] h-[var(--header-h)] border-b border-blue-900 text-white">
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">

        <div className="flex shrink-0 items-center gap-2 max-[400px]:gap-1">
          <div className="flex shrink-0 cursor-pointer items-center gap-2 max-[500px]:gap-1" onClick={() => onNavigate(isDashboardLayout ? (isAdmin ? 'admin-dashboard' : 'student-dashboard') : 'home')}>
            <img
              src={logs}
              alt="UniXchange logo"
              className="notranslate h-11 w-11 shrink-0 rounded-full border-2 border-white/80 bg-white/90 object-cover p-1 shadow-md sm:h-14 sm:w-14"
            />
            <span className="notranslate whitespace-nowrap text-[15px] font-black tracking-tight text-white max-[359px]:hidden sm:text-[18px] md:text-[2rem]">UniXchange</span>
          </div>
        </div>

        {/* Navigation Links */}
        {!isDashboardLayout && (
          <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:gap-x-5 md:flex">
            <button onClick={() => onNavigate('home')} className="text-sm font-bold text-white hover:text-white/80 transition duration-150">Home</button>
            <button onClick={() => onNavigate('about')} className="text-sm font-bold text-white hover:text-white/80 transition duration-150">About</button>
            <button onClick={() => onNavigate('services')} className="text-sm font-bold text-white hover:text-white/80 transition duration-150">Services</button>
            <button onClick={() => onNavigate('contact')} className="text-sm font-bold text-white hover:text-white/80 transition duration-150">Contact</button>

            {user && (
              <button
                type="button"
                onClick={() => onNavigate(userRole === 'admin' ? 'admin-dashboard' : 'student-dashboard')}
                className="text-xs font-bold text-blue-600 bg-white px-4 py-1.5 rounded-full hover:bg-blue-50 transition shadow-sm"
              >
                DASHBOARD
              </button>
            )}
          </nav>
        )}

        {/* Right side: Login/Register OR Profile Dropdown */}
        <div className="relative ml-auto flex min-w-0 max-w-full shrink-0 items-center gap-2 sm:gap-3 max-[400px]:gap-1">
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
          {user ? (
            // Logged In Dropdown View
            <div className="relative flex min-w-0 max-w-full items-center gap-2 sm:gap-3 max-[400px]:gap-1">
              <button
                type="button"
                onClick={onNotificationClick}
                aria-label="Open notifications"
                className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-transparent text-white transition hover:bg-white/10 hover:text-slate-200 focus:outline-none max-[400px]:h-8 max-[400px]:w-8 md:h-11 md:w-11"
                title="Notifications"
              >
                <svg className="h-6 w-6 text-white md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z" />
                </svg>
                {unreadCount > 0 && (
                  <span className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-white text-white border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 text-left shadow-sm transition hover:bg-slate-50 max-[400px]:gap-0.5 max-[400px]:px-0.5 md:gap-3 md:px-2 md:py-1.5"
                  title="Account Menu"
                >
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 max-[400px]:h-7 max-[400px]:w-7 md:h-10 md:w-10">
                    {avatarSrc ? (
                      <img src={resolveImageUrl(avatarSrc)} alt={displayName} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z" />
                      </svg>
                    )}
                  </div>
                  <div className="hidden leading-tight md:block">
                    <div className="text-sm font-bold leading-tight text-slate-900">{displayName}</div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{displayRole}</div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 max-[400px]:h-3 max-[400px]:w-3 md:h-4 md:w-4 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-14 z-50 w-60 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-lg">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Signed in as</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{displayName}</p>
                      <p className="text-xs text-slate-400">{displayEmail}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);

                        if (user?.role === 'student' || userRole === 'student') {
                          if (onStudentProfileClick) {
                            onStudentProfileClick();
                          } else if (onNavigate) {
                            onNavigate('student-dashboard');
                          }
                          return;
                        }

                        if (onAdminProfileClick) {
                          onAdminProfileClick();
                        } else if (onNavigate) {
                          onNavigate('admin-dashboard');
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z" />
                      </svg>
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onLogout?.();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-slate-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1" />
                      </svg>
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
                onClick={() => onNavigate('login')}
                className="hidden cursor-pointer font-semibold text-white hover:text-blue-200 md:flex"
              >
                {t('navbar.login')}
              </button>
              <button
                onClick={() => onNavigate('register')}
                className="hidden cursor-pointer font-semibold text-white hover:text-blue-200 md:flex"
              >
                {t('navbar.signup')}
              </button>
            </div>
          )}
        </div>

      </div>

      {!isDashboardLayout && isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close mobile navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          />
          <aside id="mobile-navigation" className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 p-6 text-white shadow-2xl animate-slide-in md:hidden" aria-label="Mobile navigation">
            <div className="flex items-center justify-between border-b border-slate-700 pb-5">
              <span className="text-lg font-bold">Campus Menu</span>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-300 transition hover:bg-slate-800 hover:text-white">✕</button>
            </div>
            <nav className="mt-8 flex flex-col gap-2">
              {[
                ['Home', 'home'],
                ['About', 'about'],
                ['Services', 'services'],
                ['Contact', 'contact'],
              ].map(([label, view]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNavigate(view);
                  }}
                  className="rounded-xl px-4 py-3 text-left text-base font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-blue-400"
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="border-t border-slate-800 pt-6 mt-auto flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  onNavigate('login');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left text-base font-semibold text-white hover:text-blue-400 transition-colors py-2 block w-full"
              >
                {t('navbar.login')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('register');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left text-base font-semibold text-white hover:text-blue-400 transition-colors py-2 block w-full"
              >
                {t('navbar.signup')}
              </button>
            </div>
          </aside>
        </>
      )}
    </header>
  );
}

export default Navbar;