import { useState } from 'react';
import logo1 from '../../assets/logo1.jpg';
import { useLanguage } from '../../context/LanguageContext';

function Navbar({ onNavigate, user, userRole, onLogout, unreadCount, onNotificationClick, onAdminProfileClick, onStudentProfileClick }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const effectiveRole = userRole || user?.role || 'student';
  const isAdmin = effectiveRole === 'admin';
  const displayName = isAdmin ? (user?.username || user?.name || 'mau9999') : (user?.name || user?.studentId || 'Student');
  const displayEmail = user?.email || 'student@campus.edu';
  const avatarSrc = user?.avatarUrl || (isAdmin
    ? `http://127.0.0.1:8000/static/uploads/avatars/${user?.username || 'mau9999'}.jpg`
    : (user?.studentId ? `/static/uploads/avatars/${user.studentId}.jpg` : ''));

  return (
    <header className="bg-blue-600 text-white border-b border-blue-700 sticky top-0 z-[999]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[100px] flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
          <img src={logo1} alt="Campace Logo" className="h-10 w-10 rounded-full object-cover" />
          <div className="flex items-center gap-1 text-2xl font-black text-white">

            <span className="text-slate-300">Campus</span>
          </div>
          <button
            type="button"
            aria-label="Open mobile navigation"
            aria-expanded={isMobileMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setIsMobileMenuOpen(true);
            }}
            className="block rounded-lg p-2 text-white transition hover:bg-white/10 md:hidden"
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button onClick={() => onNavigate('home')} className="text-sm font-bold text-white hover:text-slate-200 transition duration-150">Home</button>
          <button onClick={() => onNavigate('about')} className="text-sm font-bold text-white hover:text-slate-200 transition duration-150">About</button>
          <button onClick={() => onNavigate('services')} className="text-sm font-bold text-white hover:text-slate-200 transition duration-150">Services</button>
          <button onClick={() => onNavigate('contact')} className="text-sm font-bold text-white hover:text-slate-200 transition duration-150">Contact</button>

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

        {/* Right side: Login/Register OR Profile Dropdown */}
        <div className="flex items-center gap-4 relative">
          <div className="hidden items-center gap-1 text-sm font-semibold md:flex" aria-label={t('navbar.language')}>
            <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'text-white' : 'text-blue-200'}>{t('navbar.english')}</button>
            <span className="text-blue-200" aria-hidden="true">|</span>
            <button type="button" onClick={() => setLanguage('am')} className={language === 'am' ? 'text-white' : 'text-blue-200'}>{t('navbar.amharic')}</button>
          </div>
          {user ? (
            // Logged In Dropdown View
            <div className="relative flex items-center gap-4">
              <button
                type="button"
                onClick={onNotificationClick}
                aria-label="Open notifications"
                className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-transparent text-white transition hover:bg-white/10 hover:text-slate-200 focus:outline-none"
                title="Notifications"
              >
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z" />
                </svg>
                {unreadCount > 0 && (
                  <span className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white border-2 border-blue-600">
                    {unreadCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-slate-50"
                  title="Account Menu"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-50">
                    {isAdmin ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z" />
                      </svg>
                    ) : avatarSrc ? (
                      <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-emerald-600' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z' /></svg>`; }} />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-8 9c0-2.761 3.582-5 8-5s8 2.239 8 5v1H8v-1z" />
                      </svg>
                    )}
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <div className="text-sm font-bold leading-tight text-slate-900">{displayName}</div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{isAdmin ? 'SUPER ADMIN' : 'STUDENT'}</div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
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

      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close mobile navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 p-6 text-white shadow-2xl animate-slide-in md:hidden" aria-label="Mobile navigation">
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