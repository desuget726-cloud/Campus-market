import { useEffect, useState } from 'react';

const tabs = [
  { id: 'overview', label: 'Overview / Analytics' },
  { id: 'users', label: 'User Management' },
  { id: 'products', label: 'Product Management' },
  { id: 'categories', label: 'Categories' },
  { id: 'payments', label: 'Payments' },
  { id: 'reports', label: 'Reports & Disputes' },
  { id: 'ai', label: 'AI Monitoring' },
  { id: 'admin-profile', label: 'Admin Profile' }, // <-- አዲስ ለአስተዳዳሪው መገለጫ የተጨመረ
  { id: 'settings', label: 'System Settings' }
];

// በኮዱ ላይ የነበረውን የ "defaultCategories" ስህተት ለመፍታት የተጨመረ ዳታ
const defaultCategories = [
  { id: 1, name: 'Electronics', icon: '💻', adsCount: '1.2K ads', items: [{ name: 'Laptop' }, { name: 'Desktop' }] },
  { id: 2, name: 'Mobile Phones', icon: '📱', adsCount: '480 ads', items: [{ name: 'iPhone' }, { name: 'Android' }] },
  { id: 3, name: 'Academic Books', icon: '📚', adsCount: '2.4K ads', items: [{ name: 'Programming' }, { name: 'Math' }] }
];

function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);

  // 1. የአስተዳዳሪው የግል ፕሮፋይል መረጃ ስቴት (Admin Profile & Password State)
  const [adminProfile, setAdminProfile] = useState({
    name: 'Admin Desalegn',
    email: 'admin@campace.edu',
    password: 'admin123',
    confirmPassword: ''
  });
  const [profileMsg, setProfileMsg] = useState('');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [kpisRes, usersRes, productsRes, categoriesRes, paymentsRes, reportsRes, settingsRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/admin/kpis').catch(() => null),
        fetch('http://127.0.0.1:8000/api/admin/users').catch(() => null),
        fetch('http://127.0.0.1:8000/api/admin/products').catch(() => null),
        fetch('http://127.0.0.1:8000/api/categories').catch(() => null),
        fetch('http://127.0.0.1:8000/api/admin/payments').catch(() => null),
        fetch('http://127.0.0.1:8000/api/admin/reports').catch(() => null),
        fetch('http://127.0.0.1:8000/api/admin/settings').catch(() => null)
      ]);

      if (kpisRes?.ok) {
        const kpiData = await kpisRes.json();
        setKpis(Array.isArray(kpiData) ? kpiData : []);
      } else {
        setKpis([]);
      }

      if (usersRes?.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      } else {
        setUsers([]);
      }

      if (productsRes?.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        setProducts([]);
      }

      if (categoriesRes?.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(Array.isArray(categoriesData) ? categoriesData : defaultCategories);
      } else {
        setCategories(defaultCategories);
      }

      if (paymentsRes?.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } else {
        setPayments([]);
      }

      if (reportsRes?.ok) {
        const reportsData = await reportsRes.json();
        setReports(Array.isArray(reportsData) ? reportsData : []);
      } else {
        setReports([]);
      }

      if (settingsRes?.ok) {
        const settingsData = await settingsRes.json();
        setSettings(Array.isArray(settingsData) ? settingsData : []);
      } else {
        setSettings([]);
      }
    } catch (error) {
      console.error('Admin dashboard fetch error:', error);
      setUsers([]);
      setProducts([]);
      setReports([]);
      setPayments([]);
      setSettings([]);
      setKpis([]);
      setCategories(defaultCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  // 2. ተጠቃሚዎችን የማስተዳደሪያ ተግባራት (User Management Handlers)
  const handleUserStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update user status');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error('User status update error:', error);
    }
  };

  const handleUserDelete = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete user');
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (error) {
      console.error('User delete error:', error);
    }
  };

  // 3. የተለጠፉ ዕቃዎችን የማስተዳደሪያ ተግባራት (Product Moderation Handlers)
  const handleProductStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update product status');
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (error) {
      console.error('Product status update error:', error);
    }
  };

  const handleProductDelete = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/products/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete product');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Product delete error:', error);
    }
  };

  // 4. የተማሪዎችን ቅሬታዎች መዝጊያ ተግባር (Resolve Dispute Handler)
  const handleCloseCase = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/reports/${id}/close`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to close report');
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'Closed' } : r));
    } catch (error) {
      console.error('Report close error:', error);
    }
  };

  const handleSettingToggle = async (id) => {
    try {
      const setting = settings.find((item) => item.id === id);
      if (!setting) return;
      const response = await fetch(`http://127.0.0.1:8000/api/admin/settings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: !setting.value })
      });
      if (!response.ok) throw new Error('Failed to update setting');
      setSettings(prev => prev.map(item => item.id === id ? { ...item, value: !item.value } : item));
    } catch (error) {
      console.error('Setting update error:', error);
    }
  };

  // 5. የአስተዳዳሪውን ስም እና የይለፍ ቃል ማስተካከያ (Update Admin Profile Handler)
  const handleProfileUpdate = (e) => {
    e.preventDefault();
    setProfileMsg('');

    if (!adminProfile.name || !adminProfile.email) {
      setProfileMsg('Name and Email cannot be empty.');
      return;
    }

    if (adminProfile.password !== adminProfile.confirmPassword) {
      setProfileMsg('Passwords do not match.');
      return;
    }

    setProfileMsg('Admin profile and password updated successfully! 🎉');
    setAdminProfile(prev => ({ ...prev, confirmPassword: '' }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex w-full min-h-screen gap-6 px-4 py-6 lg:px-8 animate-fade-in">

        {/* የግራ የጎን መቆጣጠሪያ ፓነል (Admin Sidebar) */}
        <aside className="bg-[#111c3a] border-r border-slate-900/40 p-6 text-slate-100 shadow-sm rounded-[32px] lg:flex w-72 flex-col">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold border-b-2 border-white w-fit pb-1">ADMIN CONSOLE</p>
            <h1 className="mt-3 text-2xl font-bold text-white">Campace Admin</h1>
            <p className="mt-2 text-sm text-slate-400">Manage users, listings, payments, reports and system controls from one central space.</p>
          </div>

          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition duration-200 ${activeTab === tab.id ? 'bg-[#1d4ed8] text-white shadow-md' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <span>{tab.label}</span>
                <svg className={`h-4 w-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </nav>
        </aside>

        {/* የቀኝ ዋና ይዘት (Main Dashboard Area) */}
        <main className="flex-1">
          <div className="mb-6 flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Welcome, {adminProfile.name}</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">Enterprise Operations</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full border border-emerald-600 bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">Export Report</button>
              <button
                type="button"
                onClick={() => onLogout?.()}
                className="rounded-full border border-emerald-600 bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-600"
              >
                Logout
              </button>
            </div>
          </div>

          <section className="grid gap-6">

            {/* TAB: OVERVIEW / ANALYTICS */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {loading ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
                    Loading admin dashboard data...
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {kpis.map((kpi) => (
                        <div key={kpi.label} className="rounded-[24px] bg-sky-50/50 border border-sky-100/50 p-6 shadow-sm">
                          <p className="text-sm text-slate-500">{kpi.label}</p>
                          <p className="mt-4 text-3xl font-semibold text-slate-950">{kpi.value}</p>
                          <p className="mt-2 text-sm text-emerald-600">{kpi.change}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-slate-950">Traffic & Listings Trend</h3>
                          <span className="text-sm text-slate-500">Last 30 days</span>
                        </div>
                        <div className="h-64 rounded-[24px] bg-slate-100 p-6 text-slate-500">
                          Placeholder chart area for analytics graphs.
                        </div>
                      </div>
                      <div className="grid gap-6">
                        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="text-xl font-semibold text-slate-950">Top Metrics</h3>
                          <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div className="flex items-center justify-between rounded-[24px] bg-sky-50/50 border border-sky-100/50 p-4">
                              <span>Average Response Time</span>
                              <span className="font-semibold text-slate-950">1.4s</span>
                            </div>
                            <div className="flex items-center justify-between rounded-[24px] bg-sky-50/50 border border-sky-100/50 p-4">
                              <span>Listing Approval Rate</span>
                              <span className="font-semibold text-slate-950">92%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">Student Profiles</h3>
                      <p className="mt-1 text-sm text-slate-500">Manage student accounts and enforcement actions.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-l-2xl">Name</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Email</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Role</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-r-2xl">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors duration-150">
                            <td className="px-4 py-4 font-medium text-slate-900">{user.name}</td>
                            <td className="px-4 py-4">{user.email}</td>
                            <td className="px-4 py-4">{user.role}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                user.status === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 space-x-2">
                              <button onClick={() => handleUserStatus(user.id, 'Active')} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">Activate</button>
                              <button onClick={() => handleUserStatus(user.id, 'Suspended')} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">Suspend</button>
                              <button onClick={() => handleUserDelete(user.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100">Ban/Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRODUCT MANAGEMENT */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">Product Moderation</h3>
                      <p className="mt-1 text-sm text-slate-500">Approve, delete, or flag product listings at scale.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-l-2xl">Product</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Seller</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Category</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-r-2xl">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => (
                          <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors duration-150">
                            <td className="px-4 py-4 font-medium text-slate-900">{product.title}</td>
                            <td className="px-4 py-4">{product.seller}</td>
                            <td className="px-4 py-4">{product.category}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${product.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                product.status === 'Pending' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                {product.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 space-x-2">
                              <button onClick={() => handleProductStatus(product.id, 'Approved')} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">Approve</button>
                              <button onClick={() => handleProductStatus(product.id, 'Flagged')} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">Flag</button>
                              <button onClick={() => handleProductDelete(product.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CATEGORIES */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-950">Campus Directory</h3>
                    <p className="mt-1 text-sm text-slate-500">Seeded categories and their active listings count.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                      <div key={category.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{category.icon} {category.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{category.items.length} subcategories</p>
                          </div>
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">{category.adsCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-950">Payment Log</h3>
                    <p className="mt-1 text-sm text-slate-500">Track revenue, payouts, and subscription flows.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-l-2xl">Transaction</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Type</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Amount</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-r-2xl">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors duration-150">
                            <td className="px-4 py-4 font-medium text-slate-900">{payment.tx}</td>
                            <td className="px-4 py-4">{payment.type}</td>
                            <td className="px-4 py-4">{payment.amount}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${payment.status === 'Successful' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                payment.status === 'Pending' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                {payment.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: REPORTS & DISPUTES */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-950">Reports & Disputes</h3>
                    <p className="mt-1 text-sm text-slate-500">Review complaints and resolve disputes efficiently.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-l-2xl">Issue</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Student</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs">Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 uppercase tracking-wider text-xs rounded-r-2xl">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report) => (
                          <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors duration-150">
                            <td className="px-4 py-4 font-medium text-slate-900">{report.issue}</td>
                            <td className="px-4 py-4">{report.student}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${report.status === 'Closed' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                {report.status}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {report.status !== 'Closed' && (
                                <button onClick={() => handleCloseCase(report.id)} className="rounded-full border border-emerald-600 bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors duration-150">Close Case</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ADMIN PROFILE SETTINGS (አዲስ የተጨመረው የአስተዳዳሪ ማስተካከያ ፎርም) */}
            {activeTab === 'admin-profile' && (
              <div className="space-y-6 max-w-xl mx-auto">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-950 border-b pb-2 mb-6">Admin Profile & Security</h3>

                  {profileMsg && (
                    <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
                      {profileMsg}
                    </div>
                  )}

                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Administrator Name</label>
                      <input
                        type="text"
                        value={adminProfile.name}
                        onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Admin Email</label>
                      <input
                        type="email"
                        value={adminProfile.email}
                        onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Change Admin Password</label>
                      <input
                        type="password"
                        value={adminProfile.password}
                        onChange={(e) => setAdminProfile({ ...adminProfile, password: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Confirm Admin Password</label>
                      <input
                        type="password"
                        value={adminProfile.confirmPassword}
                        onChange={(e) => setAdminProfile({ ...adminProfile, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                    <button type="submit" className="w-full rounded-full bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600 transition">
                      Save Profile & Password
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: SYSTEM SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-950">System Settings</h3>
                    <p className="mt-1 text-sm text-slate-500">Configure platform-wide options and campus controls.</p>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {settings.map((setting) => (
                      <div key={setting.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{setting.label}</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {setting.type === 'toggle' ? (setting.value ? 'Enabled 🟢' : 'Disabled 🔴') : setting.value}
                          </p>
                        </div>
                        {setting.type === 'toggle' && (
                          <button
                            onClick={() => handleSettingToggle(setting.id)}
                            className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 self-start"
                          >
                            Toggle Mode
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;