import { useEffect, useState } from 'react';
import Navbar from './Components/Navbars/Navbar';
import RegisterForm from './Components/Authontication/RegisterForm';
import LoginForm from './Components/Authontication/LoginForm';
import HomeView from './Components/Home/HomeView';
import AboutView from './Components/Views/AboutView';
import ServicesView from './Components/Views/ServicesView';
import ContactView from './Components/Views/ContactView';
import Footer from './Components/Layout/Footer';
import AdminDashboard from './Components/Dashboard/AdminDashboard';
import StudentDashboard from './Components/Dashboard/StudentDashboard';
import SuccessModal from './Components/Authontication/SuccessModal';
import AuthInfoModal from './Components/Authontication/AuthInfoModal';
import PaymentSuccessToast from './Components/Notifications/PaymentSuccessToast';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from 'react-hot-toast';
import './App.css';

const SESSION_STORAGE_KEY = 'campaceSession';

function AppContent() {
  const persistSession = (nextUser = user, nextRole = activeRole, nextCurrentView = currentView, nextDashboardTab = dashboardTab, nextStudentTab = studentTab) => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const existingSession = saved ? JSON.parse(saved) : {};

      const session = {
        ...existingSession,
        user: nextUser || existingSession.user || null,
        userRole: nextRole || existingSession.userRole || null,
        currentView: nextCurrentView,
        dashboardTab: nextDashboardTab,
        studentTab: nextStudentTab,
      };

      if (session.user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to persist session:', error);
    }
  };

  const [currentView, setCurrentView] = useState(() => {
    if (typeof window === 'undefined') return 'home';
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.currentView || 'home';
    } catch (error) {
      return 'home';
    }
  });
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.user || null;
    } catch (error) {
      return null;
    }
  });
  const [userRole, setUserRole] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const session = saved ? JSON.parse(saved) : null;
      return session?.userRole || null;
    } catch (error) {
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
    } catch (error) {
      return 'home';
    }
  });
  const [adminTab, setAdminTab] = useState('dashboard');
  const [studentTab, setStudentTab] = useState('home');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingView, setPendingView] = useState('home');
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingProductId, setPendingProductId] = useState(null);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [showFooterPrivacy, setShowFooterPrivacy] = useState(false);
  const [showFooterTerms, setShowFooterTerms] = useState(false);

  const activeRole = userRole || user?.role || null;
  const expectedDashboardView = activeRole === 'admin' ? 'admin-dashboard' : activeRole === 'student' ? 'student-dashboard' : null;

  useEffect(() => {
    if (!user || !['admin-dashboard', 'student-dashboard'].includes(currentView)) return;
    persistSession(user, activeRole, currentView, dashboardTab, studentTab);
  }, [currentView, dashboardTab, adminTab, studentTab, user, activeRole]);

  useEffect(() => {
    if (!user) return;

    const loadSessionTimeout = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/settings');
        if (!response.ok) return;
        const data = await response.json();
        const configuredTimeout = Number(data?.security?.sessionTimeout);
        if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
          setSessionTimeoutMinutes(configuredTimeout);
        }
      } catch (error) {
        console.error('Failed to load session timeout:', error);
      }
    };

    loadSessionTimeout();
  }, [user]);

  useEffect(() => {
    const syncUserFromSession = () => {
      try {
        const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
        const session = saved ? JSON.parse(saved) : null;
        if (session?.user) setUser(session.user);
      } catch (error) {
        console.error('Failed to synchronize user session:', error);
      }
    };

    window.addEventListener('storage', syncUserFromSession);
    return () => window.removeEventListener('storage', syncUserFromSession);
  }, []);

  useEffect(() => {
    if (!user || !activeRole || !expectedDashboardView) return;

    const dashboardViews = new Set(['student-dashboard', 'admin-dashboard', 'student-dashboard-profile']);

    if (dashboardViews.has(currentView) && currentView !== expectedDashboardView) {
      setCurrentView(expectedDashboardView);
    }
  }, [user, activeRole, currentView, expectedDashboardView]);

  useEffect(() => {
    if (!user?.studentId || userRole !== 'student') {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/student/notifications/unread-count?student_id=${encodeURIComponent(
            user.studentId,
          )}`,
        );

        const data = await response.json();
        if (response.ok) {
          setUnreadCount(data.unreadCount ?? 0);
        } else {
          setUnreadCount(0);
          console.error('Unread count fetch failed:', data);
        }
      } catch (error) {
        setUnreadCount(0);
        console.error('Unread count request failed:', error);
      }
    };

    fetchUnreadCount();
  }, [user, userRole]);

  const handleRegisterSuccess = (studentData) => {
    const nextUser = { ...studentData, access_token: studentData?.access_token || studentData?.accessToken || null };
    setUser(nextUser);
    persistSession(nextUser, 'student', 'student-dashboard', 'home', 'home');
  };

  const handleLoginSuccess = (userData, role) => {
    const nextView = role === 'admin' ? 'admin-dashboard' : 'student-dashboard';

    const username =
      nextView === 'admin-dashboard'
        ? (userData?.name || 'Admin')
        : userData?.studentId || userData?.name || 'Student';

    const nextUser = { ...userData, access_token: userData?.access_token || userData?.accessToken || null };
    setUser(nextUser);
    setUserRole(role);
    setDashboardTab('home');
    setStudentTab('home');
    persistSession(nextUser, role, 'login', 'home', 'home');
    setPendingView(nextView);
    setPendingUsername(username);
    setShowSuccessModal(true);
  };

  const handleContinueToDashboard = () => {
    setShowSuccessModal(false);
    setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
    persistSession(user, activeRole, activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard', dashboardTab, studentTab);
  };

  const handleLogout = () => {
    setUser(null);
    setUserRole(null);
    setUnreadCount(0);
    setCurrentView('home');
    setDashboardTab('home');
    setStudentTab('home');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (!user || !activeRole || !['admin-dashboard', 'student-dashboard'].includes(currentView)) return;

    let timeoutId;
    const expireSession = () => {
      window.localStorage.clear();
      setUser(null);
      setUserRole(null);
      setUnreadCount(0);
      setShowSuccessModal(false);
      setCurrentView('login');
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
  }, [activeRole, currentView, sessionTimeoutMinutes, user]);

  const isDashboardView = ['student-dashboard', 'admin-dashboard'].includes(currentView);

  const handleNavigate = (view, params = {}) => {
    if (view === 'signup') {
      setCurrentView('register');
      return;
    }

    if (view === 'product-details' || view === 'ProductDetails') {
      setPendingProductId(params.productId ?? params.product_id ?? null);
      setCurrentView('home');
      return;
    }

    if (activeRole === 'admin') {
      if (view === 'student-dashboard' || view === 'student-dashboard-profile') {
        setCurrentView('admin-dashboard');
        return;
      }
      if (view === 'admin-dashboard') {
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
        setCurrentView('student-dashboard');
        return;
      }
    }

    if (view === 'student-dashboard-profile') {
      setStudentTab('profile');
      setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
      return;
    }

    setCurrentView(view);
  };

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
      const response = await fetch('http://127.0.0.1:8000/api/student/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 7000,
          style: {
            background: '#047857',
            color: '#ffffff',
            border: '2px solid #34d399',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(4, 120, 87, 0.35)',
            fontSize: '16px',
            fontWeight: 800,
            maxWidth: 'min(92vw, 560px)',
            padding: '16px 20px',
          },
          success: {
            iconTheme: {
              primary: '#ffffff',
              secondary: '#047857',
            },
          },
        }}
      />
      <PaymentSuccessToast />
      <Navbar
        onNavigate={handleNavigate}
        user={user}
        userRole={userRole}
        onLogout={handleLogout}
        unreadCount={unreadCount}
        onNotificationClick={handleNotificationClick}
        onAdminProfileClick={() => {
          setAdminTab('profile');
          setCurrentView('admin-dashboard');
        }}
        onStudentProfileClick={() => {
          setStudentTab('profile');
          setCurrentView('student-dashboard');
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col pt-20 lg:flex-row">
        <main className={`${isDashboardView ? 'w-full flex-1 min-h-0' : 'mx-auto max-w-7xl'} flex-grow px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8`}>
          {currentView === 'login' && (
            <div className="py-8">
              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                onCancel={() => setCurrentView('home')}
                onToggleRegister={() => setCurrentView('register')}
              />
            </div>
          )}

          {currentView === 'register' && (
            <div className="py-8">
              <RegisterForm
                onRegisterSuccess={handleRegisterSuccess}
                onCancel={() => setCurrentView('home')}
              />
            </div>
          )}

          {currentView === 'home' && (
            <HomeView
              user={user}
              initialProductId={pendingProductId}
              onAction={(product) => console.log('view', product)}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              onNavigateToMessages={() => {
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

          {currentView === 'about' && <AboutView />}

          {currentView === 'services' && <ServicesView />}

          {currentView === 'contact' && <ContactView />}
          {activeRole === 'admin' && currentView === 'admin-dashboard' && (
            <AdminDashboard
              onLogout={handleLogout}
              user={user}
              onUserUpdate={setUser}
              initialTab={adminTab}
              onTabChange={(tab) => setAdminTab(tab)}
            />
          )}
          {activeRole === 'student' && currentView === 'student-dashboard' && (
            <StudentDashboard
              onLogout={handleLogout}
              user={user}
              initialTab={studentTab}
              onTabChange={setStudentTab}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              onOpenPrivacy={() => setShowFooterPrivacy(true)}
              onOpenTerms={() => setShowFooterTerms(true)}
            />
          )}
          {!activeRole && currentView === 'student-dashboard' && (
            <StudentDashboard
              onLogout={handleLogout}
              user={user}
              initialTab={studentTab}
              onTabChange={setStudentTab}
              onUserUpdate={setUser}
              onNavigate={handleNavigate}
              onOpenPrivacy={() => setShowFooterPrivacy(true)}
              onOpenTerms={() => setShowFooterTerms(true)}
            />
          )}
        </main>
      </div>

      <Footer
        onNavigate={handleNavigate}
        onOpenPrivacy={() => setShowFooterPrivacy(true)}
        onOpenTerms={() => setShowFooterTerms(true)}
      />

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