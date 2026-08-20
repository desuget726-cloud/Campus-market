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
import './App.css';

const SESSION_STORAGE_KEY = 'campaceSession';

function App() {
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

  const activeRole = userRole || user?.role || null;
  const expectedDashboardView = activeRole === 'admin' ? 'admin-dashboard' : activeRole === 'student' ? 'student-dashboard' : null;

  useEffect(() => {
    if (!user || !['admin-dashboard', 'student-dashboard'].includes(currentView)) return;
    const session = { user, currentView, dashboardTab, adminTab, studentTab, userRole: activeRole };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [currentView, dashboardTab, adminTab, studentTab, user, activeRole]);

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
    setUser(studentData);
  };

  const handleLoginSuccess = (userData, role) => {
    const nextView = role === 'admin' ? 'admin-dashboard' : 'student-dashboard';

    const username =
      nextView === 'admin-dashboard'
        ? (userData?.name || 'Admin')
        : userData?.studentId || userData?.name || 'Student';

    setUser(userData);
    setUserRole(role);
    setDashboardTab('home');
    setStudentTab('home');
    setPendingView(nextView);
    setPendingUsername(username);
    setShowSuccessModal(true);
  };

  const handleContinueToDashboard = () => {
    setShowSuccessModal(false);
    setCurrentView(activeRole === 'admin' ? 'admin-dashboard' : 'student-dashboard');
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

  const isDashboardView = ['student-dashboard', 'admin-dashboard'].includes(currentView);

  const handleNavigate = (view) => {
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
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

      <main className={`${isDashboardView ? 'w-full flex-1' : 'mx-auto max-w-7xl'} flex-grow px-4 py-6 sm:px-6 lg:px-8 lg:py-8`}>
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
          />
        )}
      </main>

      <Footer onNavigate={setCurrentView} />
    </div>
  );
}

export default App;