import { useState } from 'react';
import logo1 from '../../assets/logo1.jpg';

function Navbar({ onNavigate, user, userRole, onLogout, unreadCount, onNotificationClick }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="bg-blue-600 text-white border-b border-blue-700 sticky top-0 z-[999]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[120px] flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
          <img src={logo1} alt="Campace Logo" className="h-10 w-10 rounded-full object-cover" />
          <div className="flex items-center gap-1 text-2xl font-black text-white">

            <span className="text-slate-300">Campus</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button onClick={() => onNavigate('home')} className="text-sm font-semibold text-white hover:text-blue-200 transition">Home</button>
          <button onClick={() => onNavigate('about')} className="text-sm font-semibold text-white hover:text-blue-200 transition">About</button>
          <button onClick={() => onNavigate('services')} className="text-sm font-semibold text-white hover:text-blue-200 transition">Services</button>
          <button onClick={() => onNavigate('contact')} className="text-sm font-semibold text-white hover:text-blue-200 transition">Contact</button>
          {user && (
            <button
              type="button"
              onClick={() => onNavigate(userRole === 'admin' ? 'admin-dashboard' : 'student-dashboard')}
              className="text-xs font-bold text-blue-600 bg-white px-4 py-1.5 rounded-full hover:bg-blue-50 transition shadow-sm"
            >
              Dashboard
            </button>
          )}
        </nav>

        {/* Right side: Login/Register OR Profile Dropdown */}
        <div className="flex items-center gap-4 relative">
          {user ? (
            // Logged In Dropdown View
            <div className="relative flex items-center gap-4">
              <button
                type="button"
                onClick={onNotificationClick}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-white transition hover:bg-white/10"
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
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 focus:outline-none cursor-pointer"
                  title="Account Menu"
                >
                  <img
                    src={user?.studentId ? `http://127.0.0.1:8000/static/uploads/avatars/${user.studentId}.jpg` : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"}
                    alt="Student Avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
                    }}
                    className="h-11 w-11 rounded-full object-cover border-[3px] border-green-500 shadow-sm"
                  />
                  <span className="hidden sm:inline text-md font-bold text-white">{user.name || "Student"}</span>
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-2xl z-50">
                    <div className="px-3 py-3 border-b border-slate-800">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signed in as</p>
                      <p className="text-sm font-bold text-white truncate mt-1">{user.name || 'Student'}</p>
                      {user.email && <p className="text-xs text-slate-400 truncate">{user.email}</p>}
                    </div>

                    <div className="py-2">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onNavigate('student-dashboard-profile');
                        }}
                        className="w-full text-left rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition font-medium"
                      >
                        Profile
                      </button>

                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left rounded-xl px-4 py-2 text-sm text-red-400 hover:bg-slate-800 transition font-semibold"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Logged Out Login/Register View
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('login')}
                className="rounded-full border border-slate-700 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              >
                Login
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

export default Navbar;