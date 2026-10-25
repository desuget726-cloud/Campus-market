import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { resolveImageUrl } from '../../config';

function getInitials(name) {
  return String(name || 'Admin')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function AdminProfileMenu({
  user,
  onLogout,
  onNavigate,
  onSettings,
  collapsed = false,
  header = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const wasOpenRef = useRef(false);
  const name = user?.username || user?.name || user?.full_name || user?.fullName || 'Admin';
  const email = user?.email || 'Email unavailable';
  const avatarUrl = user?.avatarUrl || user?.avatar_url || user?.image_url || '';
  const avatarFailed = failedAvatarUrl === avatarUrl;

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const firstMenuItem = rootRef.current?.querySelector('[role="menuitem"]');
    firstMenuItem?.focus();
    return undefined;
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };
  const handleMenuAction = (action) => {
    closeMenu();
    action?.();
  };
  const renderAvatar = (className) => (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-500/20 font-bold text-sky-100 ${className}`}>
      {avatarUrl && !avatarFailed ? (
        <img
          src={resolveImageUrl(avatarUrl)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedAvatarUrl(avatarUrl)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );

  const menuPlacement = header
    ? 'absolute right-0 top-full mt-2'
    : collapsed
      ? 'absolute bottom-0 left-full ml-2'
      : 'absolute bottom-full left-3 right-3 mb-2';

  return (
    <div ref={rootRef} className={`relative ${header ? '' : 'w-full'}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Open admin profile menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center rounded-xl bg-white/5 text-left text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
          header
            ? 'h-10 w-10 justify-center'
            : collapsed
              ? 'h-12 justify-center px-1'
              : 'gap-3 px-3 py-2.5'
        }`}
      >
        {renderAvatar(header ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm')}
        {!header && !collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{name}</span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">ADMIN</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Admin profile menu"
          className={`${menuPlacement} z-[60] w-60 overflow-hidden rounded-xl border border-white/10 bg-[#111c3a] py-1 text-sm text-white shadow-xl`}
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate font-bold">{name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-300">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onNavigate)}
            className="block w-full px-4 py-2.5 text-left font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
          >
            My Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onSettings)}
            className="block w-full px-4 py-2.5 text-left font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
          >
            Settings
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (!window.confirm('Are you sure you want to log out?')) return;
              handleMenuAction(onLogout);
            }}
            className="block w-full px-4 py-2.5 text-left font-semibold text-rose-300 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminProfileMenu;
