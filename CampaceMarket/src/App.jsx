import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from './Components/Navbars/Navbar';
import TopBar from './Components/Navbars/TopBar';
import RegisterForm from './Components/Authontication/RegisterForm';
import LoginForm from './Components/Authontication/LoginForm';
import HomeView from './Components/Home/HomeView';
import AboutView from './Components/Views/AboutView';
import ServicesView from './Components/Views/ServicesView';
import ContactView from './Components/Views/ContactView';
import SellerProfileView from './Components/Views/SellerProfileView';
import Footer from './Components/Layout/Footer';
import PolicyView from './Components/Views/PolicyView';
import AdminDashboard from './Components/Dashboard/AdminDashboard';
import StudentDashboard from './Components/Dashboard/StudentDashboard';
import SuccessModal from './Components/Authontication/SuccessModal';
import AuthInfoModal from './Components/Authontication/AuthInfoModal';
import PaymentSuccessToast from './Components/Notifications/PaymentSuccessToast';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider } from './context/CartContext';
import { Toaster } from 'react-hot-toast';
import { API_BASE_URL } from './config';
import { getAdminSettings } from './api/adminSettings';
import {
  clearPendingProductAction,
  getPendingProductAction,
  getProductIdFromReturnTo,
  normalizeInternalReturnTo,
} from './utils/productActionState';
import { parseOrderDashboardLink } from './utils/orderDashboardLink';
import { parseStudentDashboardLink } from './utils/studentDashboardLink';
import { getAdminSectionFromSearch, normalizeAdminSection, setAdminSectionUrl } from './utils/adminDashboardSection';
import { isSessionExpiryResponse } from './utils/sessionExpiry';
import { notifySuccess } from './utils/notify';
import './App.css';

const SESSION_STORAGE_KEY = 'campaceSession';
const ADMIN_SECTION_SESSION_KEY = 'campaceAdminSection';
const getStudentId = (student) => String(student?.studentId || student?.student_id || '').trim();
const getAccessToken = (session, sessionUser) => (
  sessionUser?.access_token
  || sessionUser?.accessToken
  || sessionUser?.token
  || session?.access_token
  || session?.accessToken
  || session?.token
  || ''
);
const getStoredAccessToken = () => {
  try {
    const directToken = window.localStorage.getItem('token');
    if (directToken) return directToken;
    const storedSession = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return getAccessToken(storedSession, storedSession?.user);
  } catch (error) {
    console.error('Failed to read the stored access token:', error);
    return '';
  }
};
const getStudentDashboardLink = () => {
  if (typeof window === 'undefined') {
    return { tab: 'home', section: null, itemId: null };
  }
  const orderLink = parseOrderDashboardLink(window.location.href);
  if (orderLink?.hasOrderParameter) return orderLink;
  return parseStudentDashboardLink(window.location.href)
    || { tab: 'home', section: null, itemId: null };
};

const getStoredAdminTab = () => {
  if (typeof window === 'undefined') return 'dashboard';

  try {
    const sessionSection = window.sessionStorage.getItem(ADMIN_SECTION_SESSION_KEY);
    if (sessionSection) return normalizeAdminSection(sessionSection, 'dashboard');
  } catch (error) {
    console.warn('Failed to read the pending admin section from sessionStorage:', error);
  }

  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const session = saved ? JSON.parse(saved) : null;
    return normalizeAdminSection(session?.adminTab || getAdminSectionFromSearch(window.location.search, 'dashboard'), 'dashboard');
  } catch {
    return 'dashboard';
  }
};

const persistAdminTab = (nextTab) => {
  if (typeof window === 'undefined') return;

  const normalizedTab = normalizeAdminSection(nextTab, 'dashboard');
  try {
    window.sessionStorage.setItem(ADMIN_SECTION_SESSION_KEY, normalizedTab);
  } catch (error) {
    console.warn('Failed to persist the active admin section:', error);
  }
};

const persistSession = (nextUser, nextRole, nextCurrentView, nextDashboardTab, nextStudentTab) => {
  if (typeof window === 'undefined') return;

  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const existingSession = saved ? JSON.parse(saved) : {};
    const sessionUser = nextUser || existingSession.user || null;
    const accessToken = sessionUser?.access_token || sessionUser?.accessToken || sessionUser?.token || existingSession.access_token || existingSession.accessToken || existingSession.token || '';

    const session = {
      ...existingSession,
      user: sessionUser,
      userRole: nextRole || existingSession.userRole || sessionUser?.role || null,
      access_token: accessToken,
      accessToken,
      currentView: nextCurrentView,
      dashboardTab: nextDashboardTab,
      studentTab: nextStudentTab,
      // Keep the active admin section in sessionStorage so a new login starts on Dashboard,
      // while refreshes within the same session still restore the last visited section.
    };

    if (session.user) {
      const normalizedUser = {
        ...session.user,
        access_token: accessToken,
        accessToken,
        token: accessToken || session.user.token || '',
      };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        ...session,
        user: normalizedUser,
      }));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to persist session:', error);
  }
};

function AppContent() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window === 'undefined') return 'home';
    try {
      const pathname = window.location.pathname.replace(/\/+$/, '').toLowerCase();
      if (pathname === '/dashboard') return 'student-dashboard';
      if (pathname === '/login') return 'login';
      if (pathname === '/signup' || pathname === '/register') return 'register';
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.currentView || 'home';
    } catch {
      return 'home';
    }
  });
  const [isStudentSessionVerified, setIsStudentSessionVerified] = useState(false);
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.user || null;
    } catch {
      return null;
    }
  });
  const [userRole, setUserRole] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.userRole || null;
    } catch {
      return null;
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [dashboardTab, setDashboardTab] = useState(() => {
    if (typeof window === 'undefined') return 'home';
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.dashboardTab || 'home';
    } catch {
      return 'home';
    }
  });
  const [adminTab, setAdminTab] = useState(() => getStoredAdminTab());
  const [studentDashboardLink, setStudentDashboardLink] = useState(getStudentDashboardLink);
  const [studentTab, setStudentTab] = useState(() => studentDashboardLink.tab || 'home');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingUsername] = useState('');
  const [pendingProductId, setPendingProductId] = useState(() => (
    typeof window === 'undefined'
      ? null
      : getProductIdFromReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  ));
  const [returnToSellerHubOnProductBack, setReturnToSellerHubOnProductBack] = useState(false);
  const [pendingProductAction, setPendingProductAction] = useState(null);
  const [pendingSellerProductEdit, setPendingSellerProductEdit] = useState(null);
  const [pendingMessagesProductId, setPendingMessagesProductId] = useState(null);
  const [pendingSellerId, setPendingSellerId] = useState(null);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [showFooterPrivacy, setShowFooterPrivacy] = useState(false);
  const [showFooterTerms, setShowFooterTerms] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const unauthorizedHandledRef = useRef(false);
  const [isRestoringStudentSession, setIsRestoringStudentSession] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      const storedUser = session?.user;
      return Boolean(storedUser && (session?.userRole || storedUser.role) === 'student');
    } catch {
      return false;
    }
  });

  const activeRole = userRole || user?.role || null;
  const hasUser = Boolean(user);
  const serializedUser = user ? JSON.stringify(user) : '';
  const studentAccessToken = getAccessToken(null, user);
  const studentId = isStudentSessionVerified && userRole === 'student' ? getStudentId(user) : '';
  const expectedDashboardView = activeRole === 'admin' ? 'admin-dashboard' : activeRole === 'student' ? 'student-dashboard' : null;

  const handleLogout = () => {
    const token = getAccessToken(null, user);
    const logoutRequest = activeRole === 'admin'
      ? fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      : fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    void logoutRequest.catch((error) => console.error('Logout request failed:', error));
    setUser(null);
    setUserRole(null);
    setIsStudentSessionVerified(false);
    setUnreadCount(0);
    setCurrentView('home');
    setDashboardTab('home');
    setStudentTab('home');
    setAdminTab('dashboard');
    setLoginMessage('');
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(ADMIN_SECTION_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear the local session:', error);
    }
  };

  const handleAdminLogout = () => {
    handleLogout();
    setCurrentView('login');
  };

  const handleApiUnauthorized = useCallback((event) => {
    if (unauthorizedHandledRef.current) return;
    unauthorizedHandledRef.current = true;
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear the expired session:', error);
    }
    setUser(null);
    setUserRole(null);
    setIsStudentSessionVerified(false);
    setUnreadCount(0);
    setShowSuccessModal(false);
    setCurrentView('login');
    setDashboardTab('home');
    setStudentTab('home');
    setAdminTab('dashboard');
    const code = event?.detail?.code;
    const message = code === 'session_replaced'
      ? 'This admin session was replaced by a newer login. Please sign in again.'
      : code === 'session_inactive'
        ? 'Your admin session expired due to inactivity. Please sign in again.'
        : code === 'session_revoked'
          ? 'Your admin session was revoked. Please sign in again.'
          : 'Session expired, please log in again';
    setLoginMessage(message);
    try {
      window.sessionStorage.removeItem(ADMIN_SECTION_SESSION_KEY);
    } catch {
      // Ignore session storage cleanup failures during logout.
    }
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;
    const wrappedFetch = async (...args) => {
      const request = args[0] instanceof Request ? args[0] : null;
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || args[0]?.href;
      const requestHeaders = new Headers(request?.headers);
      new Headers(args[1]?.headers).forEach((value, name) => requestHeaders.set(name, value));
      const token = getStoredAccessToken();
      if (token && !requestHeaders.has('Authorization')) {
        try {
          const apiOrigin = new URL(API_BASE_URL || window.location.origin, window.location.origin).origin;
          const requestedUrl = new URL(requestUrl, window.location.origin);
          const isRelativeApiRequest = typeof requestUrl === 'string'
            && !/^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(requestUrl)
            && requestedUrl.origin === window.location.origin
            && requestedUrl.pathname.startsWith('/api/');
          if (
            requestedUrl.pathname.startsWith('/api/')
            && (requestedUrl.origin === apiOrigin || isRelativeApiRequest)
          ) {
            requestHeaders.set('Authorization', /^Bearer\s/i.test(token) ? token : `Bearer ${token}`);
            args = [
              args[0],
              { ...args[1], headers: requestHeaders },
            ];
          }
        } catch (error) {
          console.error('Failed to attach authorization to an API request:', error);
        }
      }

      const response = await originalFetch.apply(window, args);
      if (response.status === 401) {
        const request = args[0] instanceof Request ? args[0] : null;
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || args[0]?.href;
        const headers = new Headers(request?.headers);
        new Headers(args[1]?.headers).forEach((value, name) => headers.set(name, value));
        let storedSessionExists = false;
        try {
          const storedSession = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
          storedSessionExists = Boolean(
            window.localStorage.getItem('token')
            || (
              storedSession?.user
              && (storedSession?.userRole || storedSession.user.role)
              && getAccessToken(storedSession, storedSession.user)
            ),
          );
        } catch (error) {
          console.error('Failed to inspect the stored session after an API 401:', error);
        }

        const payload = await response.clone().json().catch(() => null);
        const errorCode = payload?.error_code
          || (typeof payload?.detail === 'object' && !Array.isArray(payload.detail)
            ? payload.detail.code
            : null);
        if (isSessionExpiryResponse({
          responseStatus: response.status,
          requestUrl,
          apiBaseUrl: API_BASE_URL,
          storedSessionExists,
          authorizationHeader: headers.get('Authorization') || '',
          credentials: args[1]?.credentials || request?.credentials || 'same-origin',
          errorCode,
        })) {
          const detail = payload?.detail;
          window.dispatchEvent(new CustomEvent('campace:api-unauthorized', {
            detail: {
              code: typeof detail === 'object' && !Array.isArray(detail) ? detail.code : null,
            },
          }));
        }
      }
      return response;
    };
    window.fetch = wrappedFetch;
    window.addEventListener('campace:api-unauthorized', handleApiUnauthorized);
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
      window.removeEventListener('campace:api-unauthorized', handleApiUnauthorized);
    };
  }, [handleApiUnauthorized]);

  useEffect(() => {
    let cancelled = false;

    let storedSession = null;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      storedSession = saved ? JSON.parse(saved) : null;
    } catch {
      storedSession = null;
    }

    const storedUser = storedSession?.user;
    const storedRole = storedSession?.userRole || storedUser?.role;
    if (!storedUser || storedRole !== 'student') {
      return () => {
        cancelled = true;
      };
    }

    const accessToken = getAccessToken(storedSession, storedUser);
    fetch(`${API_BASE_URL}/api/auth/session`, {
      credentials: 'include',
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          } else {
            console.error('Unable to verify the stored student session:', response.status);
          }
          setUser(null);
          setUserRole(null);
          setIsStudentSessionVerified(false);
          setCurrentView('login');
          return;
        }

        const data = await response.json();
        if (!data?.user || data.role !== 'student' || !getStudentId(data.user) || cancelled) {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          setUser(null);
          setUserRole(null);
          setIsStudentSessionVerified(false);
          setCurrentView('login');
          return;
        }

        setUser((currentUser) => {
          const nextUser = {
            ...(currentUser || {}),
            ...data.user,
            access_token: data.access_token || accessToken || null,
          };
          persistSession(
            nextUser,
            'student',
            'student-dashboard',
            storedSession?.dashboardTab || 'home',
            storedSession?.studentTab || 'home',
          );
          return nextUser;
        });
        setUserRole('student');
        setIsStudentSessionVerified(true);
        setCurrentView((view) => view === 'login' || view === 'home' ? 'student-dashboard' : view);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Unable to verify the stored student session:', error);
        setUser(null);
        setUserRole(null);
        setIsStudentSessionVerified(false);
        setCurrentView('login');
      })
      .finally(() => {
        if (!cancelled) setIsRestoringStudentSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!serializedUser || !['admin-dashboard', 'student-dashboard'].includes(currentView)) return;
    persistSession(JSON.parse(serializedUser), activeRole, currentView, dashboardTab, studentTab);
  }, [currentView, dashboardTab, adminTab, studentTab, serializedUser, activeRole]);

  useEffect(() => {
    if (!hasUser || activeRole !== 'admin' || currentView !== 'admin-dashboard' || typeof window === 'undefined') return;

    const requestedTab = getAdminSectionFromSearch(window.location.search, adminTab);
    const nextTab = normalizeAdminSection(adminTab, 'dashboard');
    const nextUrl = setAdminSectionUrl(window.location.pathname, window.location.search, nextTab);
    const nextValue = `${window.location.pathname}${window.location.search}`;
    if (nextValue !== nextUrl) {
      const fullUrl = `${nextUrl}${window.location.hash}`;
      window.history.replaceState({}, '', fullUrl);
    } else if (requestedTab !== nextTab && !window.location.search) {
      window.history.replaceState({}, '', `${nextUrl}${window.location.hash}`);
    }
    persistAdminTab(nextTab);
  }, [activeRole, adminTab, currentView, hasUser]);

  useEffect(() => {
    const loadSessionTimeout = async () => {
      try {
        const data = await getAdminSettings();
        const configuredTimeout = Number(data?.security?.sessionTimeout);
        if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
          setSessionTimeoutMinutes((current) => current === configuredTimeout ? current : configuredTimeout);
        }
      } catch (error) {
        console.error('Failed to load session timeout:', error);
      }
    };

    loadSessionTimeout();
  }, []);

  useEffect(() => {
    const syncUserFromSession = () => {
      try {
        const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
        const session = saved ? JSON.parse(saved) : null;
        const role = session?.userRole || session?.user?.role;
        if (
          !session?.user
          || !getAccessToken(session, session.user)
          || !['admin', 'student'].includes(String(role || '').toLowerCase())
        ) {
          setUser(null);
          setUserRole(null);
          setIsStudentSessionVerified(false);
          setUnreadCount(0);
          setShowSuccessModal(false);
          setCurrentView('login');
          setLoginMessage('You were signed out in another tab.');
          return;
        }
        setUser(session.user);
        setUserRole(role || null);
        setIsStudentSessionVerified(
          (session.userRole || session.user.role) === 'student' && Boolean(getStudentId(session.user)),
        );
        setCurrentView((session.userRole || session.user.role) === 'admin'
          ? 'admin-dashboard'
          : 'student-dashboard');
        unauthorizedHandledRef.current = false;
      } catch (error) {
        console.error('Failed to synchronize user session:', error);
      }
    };

    window.addEventListener('storage', syncUserFromSession);
    return () => window.removeEventListener('storage', syncUserFromSession);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!hasUser || !activeRole || !expectedDashboardView) return;

    const dashboardViews = new Set(['student-dashboard', 'admin-dashboard', 'student-dashboard-profile']);

    if (dashboardViews.has(currentView) && currentView !== expectedDashboardView) {
      setCurrentView(expectedDashboardView);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hasUser, activeRole, currentView, expectedDashboardView]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!studentId || !studentAccessToken) {
      setUnreadCount((current) => current === 0 ? current : 0);
      return;
    }

    let cancelled = false;
    let requestInFlight = false;
    const fetchUnreadCount = async () => {
      if (cancelled || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/notifications/unread-count?student_id=${encodeURIComponent(
            studentId,
          )}`,
          {
            credentials: 'include',
            headers: { Authorization: `Bearer ${studentAccessToken}` },
          },
        );

        const data = await response.json();
        if (cancelled) return;
        if (response.ok) {
          const parsedCount = Number(data.unreadCount ?? 0);
          const nextCount = Number.isFinite(parsedCount) ? parsedCount : 0;
          setUnreadCount((current) => current === nextCount ? current : nextCount);
        } else {
          setUnreadCount((current) => current === 0 ? current : 0);
          console.error('Unread count fetch failed:', data);
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadCount((current) => current === 0 ? current : 0);
          console.error('Unread count request failed:', error);
        }
      } finally {
        requestInFlight = false;
      }
    };

    void fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [studentAccessToken, studentId]);

  const handleRegisterSuccess = () => {
    setUser(null);
    setUserRole(null);
    setIsStudentSessionVerified(false);
    setUnreadCount(0);
    setCurrentView('login');
    setLoginMessage('');
    notifySuccess('Registration complete! Please sign in to continue.');
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(ADMIN_SECTION_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear the previous session after registration:', error);
    }
  };

  const handleLoginSuccess = (userData, role) => {
    unauthorizedHandledRef.current = false;
    setLoginMessage('');
    const productAction = getPendingProductAction();
    const returnTo = normalizeInternalReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
    const productId = getProductIdFromReturnTo(returnTo) || productAction?.returnTo || null;
    const nextView = productId ? 'home' : role === 'admin' ? 'admin-dashboard' : 'student-dashboard';
    const nextSection = role === 'admin' ? 'dashboard' : 'home';

    const nextUser = { ...userData, access_token: userData?.access_token || userData?.accessToken || null };
    setUser(nextUser);
    setUserRole(role);
    setIsStudentSessionVerified(role === 'student' && Boolean(getStudentId(nextUser)));
    setPendingProductId(productId);
    setPendingProductAction(productId ? productAction : null);
    setDashboardTab('home');
    setStudentTab('home');
    setAdminTab(nextSection);
    persistAdminTab(nextSection);
    setCurrentView(nextView);
    setShowSuccessModal(false);
    if (returnTo) {
      window.history.replaceState({}, '', returnTo);
    }
    persistSession(nextUser, role, nextView, 'home', 'home');
  };

  const handleContinueToDashboard = () => {
    setShowSuccessModal(false);
    setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
    persistSession(user, activeRole, activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard', dashboardTab, studentTab);
  };

  useEffect(() => {
    if (!hasUser || !activeRole || !['admin-dashboard', 'student-dashboard'].includes(currentView)) return;

    let timeoutId;
    const expireSession = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
    } catch (error) {
        console.error('Session expiry logout request failed:', error);
      } finally {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
        setUserRole(null);
        setUnreadCount(0);
        setShowSuccessModal(false);
        setCurrentView('login');
        setDashboardTab('home');
        setStudentTab('home');
      }
    };
    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(expireSession, sessionTimeoutMinutes * 60 * 1000);
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout, { passive: true }));
    resetTimeout();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [activeRole, currentView, sessionTimeoutMinutes, hasUser]);

  const isDashboardView = ['student-dashboard', 'admin-dashboard'].includes(currentView);
  const isStudentMessagesView = currentView === 'student-dashboard' && studentTab === 'messages';
  const isHomeView = currentView === 'home';

  const handleStudentDashboardFallback = useCallback(() => {
    setStudentDashboardLink({ tab: 'home', section: null, itemId: null });
    setStudentTab('home');
    setCurrentView('student-dashboard');
    window.history.replaceState({}, '', '/dashboard?tab=home');
  }, []);

  const handleStudentTabChange = useCallback((tab) => {
    if (studentDashboardLink.tab === tab) {
      setStudentTab(tab);
      return;
    }
    setStudentDashboardLink({ tab, section: null, itemId: null });
    setStudentTab(tab);
  }, [studentDashboardLink.tab]);

  const handleNavigate = (view, params = {}) => {
    const dashboardLink = typeof view === 'string' ? parseOrderDashboardLink(view) : null;
    if (dashboardLink?.hasOrderParameter) {
      setStudentTab(dashboardLink.tab);
      setStudentDashboardLink(dashboardLink);
      setCurrentView('student-dashboard');
      const nextUrl = new URL(view, window.location.origin);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const destination = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (destination !== currentUrl) {
        window.history.pushState({ dashboardOrderId: dashboardLink.orderId }, '', destination);
      }
      return;
    }
    const studentDashboardLinkFromUrl = typeof view === 'string'
      ? parseStudentDashboardLink(view)
      : null;
    if (studentDashboardLinkFromUrl) {
      setStudentDashboardLink(studentDashboardLinkFromUrl);
      setStudentTab(studentDashboardLinkFromUrl.tab);
      setCurrentView('student-dashboard');
      const nextUrl = new URL(view, window.location.origin);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const destination = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (destination !== currentUrl) window.history.pushState({}, '', destination);
      return;
    }

    if (view === 'login' || view === 'register' || view === 'signup') {
      if (user) {
        setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
        return;
      }
      const nextView = view === 'signup' ? 'register' : view;
      setLoginMessage(params.message || '');
      const returnTo = nextView === 'login' ? normalizeInternalReturnTo(params.returnTo) : null;
      if (returnTo) {
        window.history.pushState({}, '', `/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
      setCurrentView(nextView);
      return;
    }

    if (view === 'product-details' || view === 'ProductDetails') {
      const productId = params.productId ?? params.product_id ?? null;
      if (params.returnTo === 'seller-hub') {
        setReturnToSellerHubOnProductBack(true);
      } else if (currentView !== 'home') {
        setReturnToSellerHubOnProductBack(false);
      }
      setPendingMessagesProductId(null);
      setPendingProductId(productId);
      setPendingProductAction(params.action === 'pay' && productId
        ? { returnTo: String(productId), action: 'pay', quantity: 1 }
        : null);
      setCurrentView('home');
      return;
    }

    if (view === 'seller-profile') {
      setPendingSellerId(params.sellerId ?? params.seller_id ?? null);
      setCurrentView('seller-profile');
      return;
    }

    if (activeRole === 'admin') {
      if (view === 'student-dashboard' || view === 'student-dashboard-profile') {
        setCurrentView('admin-dashboard');
        return;
      }
      if (view === 'admin-dashboard') {
        const nextTab = params.tab
          ? normalizeAdminSection(params.tab, 'dashboard')
          : getAdminSectionFromSearch(window.location.search, 'dashboard');
        setAdminTab(normalizeAdminSection(nextTab, 'dashboard'));
        setCurrentView('admin-dashboard');
        return;
      }
    }

    if (activeRole === 'student') {
      if (view === 'admin-dashboard') {
        setCurrentView('student-dashboard');
        return;
      }
      if (view === 'student-dashboard-profile') {
        setStudentTab('profile');
        setCurrentView('student-dashboard');
        return;
      }
      if (view === 'student-dashboard') {
        if (params.tab) setStudentTab(params.tab);
        if (params.editProduct) {
          setPendingSellerProductEdit(params.editProduct);
          setStudentTab('seller');
        }
        setCurrentView('student-dashboard');
        return;
      }
    }

    if (view === 'student-dashboard-profile') {
      setStudentTab('profile');
      setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
      return;
    }

    if (view === 'home') {
      window.scrollTo(0, 0);
    }
    setCurrentView(view);
  };

  useEffect(() => {
    const syncViewFromHistory = () => {
      const dashboardLink = parseOrderDashboardLink(window.location.href);
      if (dashboardLink?.hasOrderParameter) {
        setStudentTab(dashboardLink.tab);
        setCurrentView('student-dashboard');
        return;
      }

      const studentDashboardLinkFromUrl = parseStudentDashboardLink(window.location.href);
      if (studentDashboardLinkFromUrl) {
        setStudentDashboardLink(studentDashboardLinkFromUrl);
        setStudentTab(studentDashboardLinkFromUrl.tab);
        setCurrentView('student-dashboard');
        return;
      }

      const pathname = window.location.pathname.replace(/\/+$/, '').toLowerCase();
      if (pathname === '/dashboard') {
        setStudentTab('home');
        setCurrentView('student-dashboard');
      } else if (pathname === '/login') {
        setCurrentView('login');
      } else if (pathname === '/signup' || pathname === '/register') {
        setCurrentView('register');
      } else if (!pathname || pathname === '/') {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', syncViewFromHistory);
    return () => window.removeEventListener('popstate', syncViewFromHistory);
  }, []);

  useEffect(() => {
    if (!hasUser || !['login', 'register'].includes(currentView)) return;
    setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
  }, [activeRole, currentView, hasUser]);

  const handleNotificationClick = async () => {
    const effectiveRole = userRole || user?.role;

    if (effectiveRole === 'admin') {
      setCurrentView('admin-dashboard');
      setAdminTab('notifications');
      return;
    }

    if (effectiveRole !== 'student' || !user?.studentId) return;

    setCurrentView('student-dashboard');
    setStudentTab('notifications');

    try {
      const response = await fetch(`${API_BASE_URL}/api/student/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.access_token || user?.accessToken || user?.token || ''}`,
        },
        body: JSON.stringify({ student_id: user.studentId }),
      });

      if (response.ok) {
        setUnreadCount(0);
      } else {
        const data = await response.json().catch(() => null);
        console.error('Failed to mark notifications as read:', data);
      }
    } catch (error) {
      console.error('Notification mark-read request failed:', error);
    }
  };

  return (
    <CartProvider user={isStudentSessionVerified && activeRole === 'student' ? user : null}>
    <div className={`flex min-h-[100dvh] h-auto flex-col ${['login', 'register'].includes(currentView) ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-800'} ${currentView === 'admin-dashboard' ? 'lg:h-dvh lg:overflow-hidden' : ''}`}>
      <Toaster
        position="top-right"
        containerStyle={{ top: 92, right: 20, zIndex: 9999 }}
        toastOptions={{
          duration: 7000,
          pauseOnHover: true,
          style: {
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: '12px 18px',
            fontSize: '16px',
            fontWeight: 600,
            maxWidth: 'min(92vw, 560px)',
            color: '#FFFFFF',
          },
          success: {
            style: {
              background: '#16A34A',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '12px 18px',
              fontWeight: 600,
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#16A34A',
            },
          },
          error: {
            style: {
              background: '#DC2626',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '12px 18px',
              fontWeight: 600,
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#DC2626',
            },
          },
          info: {
            style: {
              background: '#0284C7',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '12px 18px',
              fontWeight: 600,
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#0284C7',
            },
          },
        }}
      />
      <PaymentSuccessToast />
      {!['login', 'register'].includes(currentView) && currentView !== 'student-dashboard' && !hasUser && !isRestoringStudentSession && <TopBar onNavigate={handleNavigate} />}
      {!['login', 'register'].includes(currentView) && (
        <Navbar
          variant={isDashboardView ? 'dashboard' : 'public'}
          onNavigate={handleNavigate}
          user={user}
          userRole={userRole}
          onLogout={activeRole === 'admin' ? handleAdminLogout : handleLogout}
          unreadCount={unreadCount}
          onNotificationClick={handleNotificationClick}
          activeAdminTab={adminTab}
          onAdminProfileClick={() => {
            setAdminTab('profile');
            setCurrentView('admin-dashboard');
          }}
          onAdminSettingsClick={() => {
            setAdminTab('settings');
            setCurrentView('admin-dashboard');
          }}
          onStudentProfileClick={() => {
            setStudentTab('profile');
            setCurrentView('student-dashboard');
          }}
        />
      )}
      <div className={`flex flex-1 flex-col ${['login', 'register'].includes(currentView) ? '' : 'app-page-shell'} lg:flex-row ${isStudentMessagesView ? 'h-[calc(100dvh-72px)] min-h-0 overflow-hidden' : currentView === 'admin-dashboard' ? 'lg:!min-h-0 lg:h-[calc(100dvh-72px)] lg:overflow-hidden' : currentView === 'student-dashboard' ? 'h-[calc(100dvh-72px)] !min-h-0 overflow-hidden' : 'min-h-0'}`}>
        <main className={isStudentMessagesView
          ? 'app-main-content app-main-content--messages min-h-0 min-w-0 w-full flex-1 overflow-hidden'
          : ['login', 'register'].includes(currentView)
            ? 'app-main-content w-full min-w-0 flex-1'
            : isHomeView
              ? 'app-main-content w-full min-w-0 flex-1 px-0'
              : ['about', 'services', 'contact'].includes(currentView)
                ? 'app-main-content w-full min-w-0 flex-1 px-0'
              : `app-main-content ${isDashboardView ? `w-full flex-1 ${currentView === 'admin-dashboard' ? 'lg:!min-h-0 lg:h-full !pb-0' : currentView === 'student-dashboard' ? '!min-h-0 h-full !pb-0' : 'min-h-0'}` : 'mx-auto max-w-7xl'} flex-grow ${currentView === 'student-dashboard' || currentView === 'admin-dashboard' ? 'px-0' : isDashboardView ? 'px-3 sm:px-4 lg:px-6' : 'px-4 sm:px-6 lg:px-8'}`}>
          {currentView === 'login' && !user && (
            <div className="py-8">
              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                sessionExpiredMessage={loginMessage}
                onCancel={() => {
                  setLoginMessage('');
                  setCurrentView('home');
                }}
                onToggleRegister={() => {
                  setLoginMessage('');
                  setCurrentView('register');
                }}
              />
            </div>
          )}

          {currentView === 'register' && (
            <div className="min-h-full">
              <RegisterForm
                onRegisterSuccess={handleRegisterSuccess}
                onCancel={() => setCurrentView('home')}
                onToggleLogin={() => setCurrentView('login')}
              />
            </div>
          )}

          {currentView === 'home' && (
            <HomeView
              user={user ? { ...user, role: user.role || userRole } : user}
              initialProductId={pendingProductId}
              pendingProductAction={pendingProductAction}
              onBackToSellerHub={returnToSellerHubOnProductBack ? () => {
                setReturnToSellerHubOnProductBack(false);
                setPendingProductId(null);
                setPendingProductAction(null);
                handleNavigate('/dashboard?tab=seller');
              } : undefined}
              onPendingProductActionHandled={() => {
                clearPendingProductAction();
                setPendingProductId(null);
                setPendingProductAction(null);
              }}
              onAction={(product) => console.log('view', product)}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              onNavigateToMessages={(productId) => {
                setPendingMessagesProductId(productId);
                setStudentTab('messages');
                setCurrentView('student-dashboard');
              }}
            />
          )}

          {showSuccessModal && (
            <SuccessModal
              username={pendingUsername}
              onContinue={handleContinueToDashboard}
            />
          )}

          {currentView === 'about' && <AboutView onNavigate={handleNavigate} />}

          {currentView === 'services' && <ServicesView />}

          {currentView === 'contact' && <ContactView user={user} />}
          {['terms', 'privacy', 'refund-dispute'].includes(currentView) && <PolicyView type={currentView} onNavigate={handleNavigate} />}
          {currentView === 'seller-profile' && (
            <SellerProfileView
              sellerId={pendingSellerId}
              onBack={() => setCurrentView('home')}
              onNavigate={handleNavigate}
            />
          )}
          {activeRole === 'admin' && currentView === 'admin-dashboard' && (
            <AdminDashboard
              onLogout={handleAdminLogout}
              onNavigate={handleNavigate}
              onSessionExpired={handleApiUnauthorized}
              user={user}
              onUserUpdate={setUser}
              initialTab={adminTab}
              onTabChange={(tab) => setAdminTab(tab)}
            />
          )}
          {!isRestoringStudentSession && isStudentSessionVerified && activeRole === 'student' && currentView === 'student-dashboard' && (
            <StudentDashboard
              user={user}
              initialTab={studentTab}
              dashboardLink={studentDashboardLink}
              onDashboardLinkInvalid={handleStudentDashboardFallback}
              onTabChange={handleStudentTabChange}
              initialProductToEdit={pendingSellerProductEdit}
              onInitialProductEditHandled={() => setPendingSellerProductEdit(null)}
              initialMessagesProductId={pendingMessagesProductId}
              onClearProductInquiryFilter={() => setPendingMessagesProductId(null)}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              appUnreadNotificationCount={unreadCount}
              onOpenPrivacy={() => setShowFooterPrivacy(true)}
              onOpenTerms={() => setShowFooterTerms(true)}
            />
          )}
          {!activeRole && currentView === 'student-dashboard' && (
            <StudentDashboard
              user={user}
              initialTab={studentTab}
              dashboardLink={studentDashboardLink}
              onDashboardLinkInvalid={handleStudentDashboardFallback}
              onTabChange={handleStudentTabChange}
              initialProductToEdit={pendingSellerProductEdit}
              onInitialProductEditHandled={() => setPendingSellerProductEdit(null)}
              initialMessagesProductId={pendingMessagesProductId}
              onClearProductInquiryFilter={() => setPendingMessagesProductId(null)}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              appUnreadNotificationCount={unreadCount}
              onOpenPrivacy={() => setShowFooterPrivacy(true)}
              onOpenTerms={() => setShowFooterTerms(true)}
            />
          )}
        </main>
      </div>

      {!isDashboardView && !['login', 'register'].includes(currentView) && <Footer onNavigate={handleNavigate} />}

      {(showFooterPrivacy || showFooterTerms) && (
        <AuthInfoModal
          type={showFooterPrivacy ? 'privacy' : 'terms'}
          defaultStudentId={user?.studentId || ''}
          onClose={() => {
            setShowFooterPrivacy(false);
            setShowFooterTerms(false);
          }}
        />
      )}
    </div>
    </CartProvider>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
