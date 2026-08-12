import { useEffect, useState } from 'react';

const adminTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M4 6h16M4 12h16M4 18h16' },
  { id: 'user-management', label: 'User Management', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422M12 14L5.84 10.578' },
  { id: 'student-verification', label: 'Student Verification', icon: 'M12 11c2.761 0 5-2.238 5-5S14.761 1 12 1 7 3.238 7 6s2.239 5 5 5z M4 23c0-4.418 3.582-8 8-8s8 3.582 8 8' },
  { id: 'product-management', label: 'Product Management', icon: 'M4 7h16v13H4z M8 7v-3h8v3' },
  { id: 'categories', label: 'Categories', icon: 'M5 5h14v4H5z M5 15h14v4H5z' },
  { id: 'orders', label: 'Orders', icon: 'M6 6h12l2 10H4z M8 22h8' },
  { id: 'payments', label: 'Payments', icon: 'M6 7h12v10H6z M9 12h6 M12 16v2' },
  { id: 'reports', label: 'Reports', icon: 'M6 5h12v14H6z M9 9h6 M9 13h4' },
  { id: 'ai-recommendations', label: 'AI Recommendations', icon: 'M12 4a8 8 0 00-8 8c0 4.418 3.582 8 8 8s8-3.582 8-8a8 8 0 00-8-8z M12 8v4 M12 16h.01' },
  { id: 'analytics', label: 'Analytics', icon: 'M5 19h14M9 15v-4M15 15V9' },
  { id: 'notifications', label: 'Notifications', icon: 'M18 13v-3a6 6 0 10-12 0v3l-2 2v1h16v-1l-2-2z M13.73 21a2 2 0 01-3.46 0' },
  { id: 'audit-logs', label: 'Audit Logs', icon: 'M6 4h12v4H6z M6 12h12v4H6z M10 20h4' },
  { id: 'settings', label: 'Settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z M4.93 4.93l2.12 2.12 M17.95 17.95l2.12 2.12 M4.93 19.07l2.12-2.12 M17.95 6.05l2.12-2.12' },
  { id: 'logout', label: 'Logout', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1' }
];

function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // === HOISTED STATES FOR ALL PANELS (OBEYING RULES OF HOOKS) ===

  // 1. User Management States
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCollegeFilter, setUserCollegeFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [dbCollegesList, setDbCollegesList] = useState([]);
  const [dbDepartmentsList, setDbDepartmentsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [studentUsers, setStudentUsers] = useState([
    { id: 1, student_id: "MAU1600002", name: "Tefesayiku", email: "desu5392@gmail.com", phone: "0962714305", college: "CCI", department: "Software Engineering", year: "Year 3", is_verified: true, status: "Active", rating: "4.8 ★", activity: [{ action: "Logged in", time: "10m ago" }] },
    { id: 2, student_id: "IT2026-001", name: "Abebe Kebede", email: "student@university.edu", phone: "0911223344", college: "CCI", department: "Information Technology", year: "Year 2", is_verified: false, status: "Active", rating: "No ratings", activity: [{ action: "Updated Profile", time: "3h ago" }] }
  ]);

  // 2. Student Verification States
  const [selectedIDPhoto, setSelectedIDPhoto] = useState(null);
  const [verifications, setVerifications] = useState([
    { id: 1, name: "Abebe Kebede", student_id: "IT2026-001", email: "student@university.edu", department: "Information Technology", status: "Pending", uploaded_id_card: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80" },
    { id: 2, name: "Tefesayiku", student_id: "MAU1600002", email: "desu5392@gmail.com", department: "Software Engineering", status: "Verified", uploaded_id_card: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80" }
  ]);

  // 3. Product Management States
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState('');
  const [productsList, setProductsList] = useState([
    { id: 1, title: "HP Pavilion Laptop", price: "24,000 ETB", seller: "Tefesayiku", category: "Electronics", status: "Pending" },
    { id: 2, title: "Calculus II Textbook", price: "450 ETB", seller: "Abebe Kebede", category: "Books", status: "Approved" }
  ]);

  // 4. Category Management States
  const [newCatName, setNewCatName] = useState('');
  const [categoriesList, setCategoriesList] = useState([
    { id: 1, name: "Electronics", status: "Active", ads: 420 },
    { id: 2, name: "Academic Books", status: "Active", ads: 850 },
    { id: 3, name: "Clothing", status: "Inactive", ads: 120 }
  ]);

  // 5. Order Management State
  const [ordersList, setOrdersList] = useState([
    { id: "ORD-9482", buyer: "MAU1600002", seller: "Abebe K.", item: "Calculus Book", price: "450 ETB", order_status: "Processing", pay_status: "Successful", date: "12 Aug 2026" },
    { id: "ORD-9483", buyer: "MAU1600009", seller: "Tefesayiku", item: "Laptop", price: "24,000 ETB", order_status: "Completed", pay_status: "Successful", date: "11 Aug 2026" }
  ]);

  // 6. Reports & Complaints States
  const [reportsList, setReportsList] = useState([
    { id: 1, reporter: "MAU1600004", target: "HP Laptop ad", reason: "Incorrect product information", status: "Pending" },
    { id: 2, reporter: "MAU1600002", target: "Suspicious seller", reason: "Fraud attempt", status: "Reviewed" }
  ]);

  // 7. System Notifications / Announcement Form States
  const [announcement, setAnnouncement] = useState({ message: "", target: "Everyone" });
  const [announcementLog, setAnnouncementLog] = useState([
    { id: 1, msg: "New marketplace category available.", target: "Everyone", date: "12 Aug 2026" },
    { id: 2, msg: "Please verify your student account.", target: "Sellers", date: "11 Aug 2026" }
  ]);

  // 8. Audit Logs List
  const [auditLogs, setAuditLogs] = useState([
    { id: 1, action: "Admin approved product listing 'Calculus II'", date: "12 Aug 2026 — 10:25 PM" },
    { id: 2, action: "Admin suspended user MAU1600004 for fraud report", date: "12 Aug 2026 — 10:31 PM" },
    { id: 3, action: "Admin rejected report on student Abebe Kebede", date: "12 Aug 2026 — 10:42 PM" }
  ]);

  // 9. System Settings Fields
  const [sysSettings, setSysSettings] = useState({
    marketplaceName: "Campace Market",
    maxImageSize: "5MB",
    recommendationWeight: "Content-Based Filtering (TF-IDF)"
  });

  // KPI calculations
  const [metrics, setMetrics] = useState({
    totalStudents: 4812,
    activeStudents: 4320,
    totalProducts: 1245,
    pendingProducts: 84,
    totalOrders: 612,
    completedOrders: 580,
    totalRevenue: "$24,580.00",
    pendingReports: 3
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  // Fetch colleges list on component mount
  useEffect(() => {
    fetchCollegesData();
  }, []);

  // Fetch departments whenever college filter changes
  useEffect(() => {
    if (activeTab === 'user-management') {
      if (userCollegeFilter) {
        fetchDepartmentsData(userCollegeFilter);
      } else {
        fetchDepartmentsData(null); // Fetch all departments
      }
      // Reset department filter when college changes
      setUserDeptFilter('');
    }
  }, [userCollegeFilter, activeTab]);

  // Fetch colleges from backend
  const fetchCollegesData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/colleges');
      const colleges = await response.json();
      setDbCollegesList(colleges || []);
    } catch (err) {
      console.error('Failed to fetch colleges:', err);
      setDbCollegesList([]);
    }
  };

  // Fetch departments from backend (optionally filtered by college)
  const fetchDepartmentsData = async (selectedCollege = null) => {
    try {
      const url = selectedCollege
        ? `http://localhost:8000/api/admin/departments?college=${encodeURIComponent(selectedCollege)}`
        : 'http://localhost:8000/api/admin/departments';

      const response = await fetch(url);
      const departments = await response.json();
      setDbDepartmentsList(departments || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDbDepartmentsList([]);
    }
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'logout') {
      onLogout?.();
      return;
    }
    setActiveTab(tabId);
  };

  // State manipulation handlers
  const toggleVerification = (userId) => {
    setStudentUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_verified: !u.is_verified } : u
    ));
  };

  const handleStatusChange = (userId, newStatus) => {
    setStudentUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, status: newStatus } : u
    ));
  };

  const handleVerifyAction = (id, actionStatus) => {
    setVerifications(prev => prev.map(v =>
      v.id === id ? { ...v, status: actionStatus } : v
    ));
    const target = verifications.find(v => v.id === id);
    if (target) {
      setStudentUsers(prev => prev.map(u =>
        u.student_id === target.student_id ? { ...u, is_verified: actionStatus === 'Verified' } : u
      ));
    }
  };

  const handleProductStatus = (id, actionStatus) => {
    setProductsList(prev => prev.map(p =>
      p.id === id ? { ...p, status: actionStatus } : p
    ));
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCategoriesList(prev => [
      ...prev,
      { id: Date.now(), name: newCatName, status: "Active", ads: 0 }
    ]);
    setNewCatName('');
  };

  const handleCategoryStatus = (id) => {
    setCategoriesList(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === "Active" ? "Inactive" : "Active" } : c
    ));
  };

  const handleReportAction = (id, action) => {
    setReportsList(prev => prev.map(r =>
      r.id === id ? { ...r, status: action } : r
    ));
  };

  const handleSendAnnouncement = (e) => {
    e.preventDefault();
    if (!announcement.message.trim()) return;
    setAnnouncementLog(prev => [
      { id: Date.now(), msg: announcement.message, target: announcement.target, date: "12 Aug 2026" },
      ...prev
    ]);
    setAnnouncement({ message: "", target: "Everyone" });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Marketplace Overview</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Your quick operational overview across campus marketplace activity.</p>
            </div>

            {/* 8 Core KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Students</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalStudents}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Active Students</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.activeStudents}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Products</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalProducts}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Pending Products</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-amber-600">{metrics.pendingProducts}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalOrders}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Completed Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-emerald-600">{metrics.completedOrders}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Revenue</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-blue-600">{metrics.totalRevenue}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Pending Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-rose-600">{metrics.pendingReports}</p>
              </div>
            </div>

            {/* 4 Interactive SVG/CSS Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">User Growth & Product Uploads</h3>
                <div className="relative h-44 w-full mt-2">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M 0,90 Q 25,60 50,45 T 100,15 L 100,100 L 0,100 Z" fill="url(#growthGrad)" />
                    <path d="M 0,90 Q 25,60 50,45 T 100,15" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                    <path d="M 0,80 Q 25,75 50,60 T 100,30" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                  </svg>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-blue-500 rounded-full inline-block" /> User Growth</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-emerald-500 rounded-full inline-block border-2 border-dashed border-white" /> Product Uploads</span>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Sales & Revenue Trend</h3>
                <div className="h-44 w-full flex items-end justify-between gap-3 px-2 mt-2">
                  {[
                    { m: "Sep", h: "h-[30%]" },
                    { m: "Oct", h: "h-[45%]" },
                    { m: "Nov", h: "h-[65%]" },
                    { m: "Dec", h: "h-[50%]" },
                    { m: "Jan", h: "h-[85%]" },
                    { m: "Feb", h: "h-[95%]" }
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className={`w-full rounded-t-lg bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all duration-300 ${bar.h}`} />
                      <span className="text-[10px] text-slate-500 font-bold">{bar.m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Popular Directory Categories</h3>
                <div className="space-y-4 py-2">
                  {[
                    { label: "Electronics", val: "45%", color: "bg-blue-500" },
                    { label: "Academic Books", val: "30%", color: "bg-emerald-500" },
                    { label: "Stationery", val: "15%", color: "bg-amber-500" },
                    { label: "Laboratory Equipment", val: "10%", color: "bg-rose-500" }
                  ].map((cat, i) => (
                    <div key={i} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span>{cat.label}</span>
                        <span>{cat.val}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cat.color}`} style={{ width: cat.val }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Order Status Breakdown</h3>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="relative h-28 w-28 shrink-0">
                    <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                      <circle cx="18" cy="16" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      <circle cx="18" cy="16" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="80 20" strokeDashoffset="0" />
                      <circle cx="18" cy="16" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-80" />
                      <circle cx="18" cy="16" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="5 95" strokeDashoffset="-95" />
                    </svg>
                  </div>
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex items-center gap-2"><span className="h-3 w-3 bg-emerald-500 rounded-full" /> Completed (80%)</div>
                    <div className="flex items-center gap-2"><span className="h-3 w-3 bg-blue-500 rounded-full" /> Processing (15%)</div>
                    <div className="flex items-center gap-2"><span className="h-3 w-3 bg-amber-500 rounded-full" /> Pending (5%)</div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        );
      case 'user-management': {
        const filteredUsers = studentUsers.filter(u => {
          const matchesSearch =
            u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            u.student_id.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearchTerm.toLowerCase());

          const matchesCollege = userCollegeFilter ? u.college === userCollegeFilter : true;
          const matchesDept = userDeptFilter ? u.department === userDeptFilter : true;

          return matchesSearch && matchesCollege && matchesDept;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">User Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor student profiles, enforce restrictions, and verify academic IDs.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Search Directory</label>
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by College</label>
                <select
                  value={userCollegeFilter}
                  onChange={(e) => setUserCollegeFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Colleges</option>
                  {dbCollegesList.map(college => (
                    <option key={college} value={college}>{college}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Department</label>
                <select
                  value={userDeptFilter}
                  onChange={(e) => setUserDeptFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Departments</option>
                  {dbDepartmentsList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Student</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">College</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Department</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Phone</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Verified</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Enforcement Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{student.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{student.student_id} • {student.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{student.college}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{student.department.replace("Department of ", "")}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{student.phone || 'No Phone'}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleVerification(student.id)}
                            className={`rounded-full px-3 py-1 text-xs font-bold border transition cursor-pointer ${student.is_verified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                          >
                            {student.is_verified ? 'Verified ✓' : 'Unverified'}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${student.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            student.status === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(student)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              Details
                            </button>
                            <select
                              value={student.status}
                              onChange={(e) => handleStatusChange(student.id, e.target.value)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:outline-none transition cursor-pointer"
                            >
                              <option value="Active">Active</option>
                              <option value="Suspended">Suspend</option>
                              <option value="Deactivated">Deactivate</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedUser && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">{selectedUser.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">Full operational log trail • {selectedUser.student_id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Campus Phone</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{selectedUser.phone}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Seller Rating</p>
                        <p className="text-sm font-bold text-emerald-600 mt-1">{selectedUser.rating}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-xs text-slate-400">Activity Logs</h5>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {selectedUser.activity.map((act, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border text-xs font-semibold">
                            <span className="text-slate-800">{act.action}</span>
                            <span className="text-slate-400">{act.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="w-full mt-6 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
                  >
                    Close Log View
                  </button>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'student-verification': {
        const pendingVerifications = verifications.filter(v => v.status === 'Pending');
        const verifiedVerifications = verifications.filter(v => v.status === 'Verified');
        const rejectedVerifications = verifications.filter(v => v.status === 'Rejected');

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Student Verification</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Review and verify student identities, academic IDs, and campus emails.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-amber-50/50 border border-amber-100 p-5">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Requests</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{pendingVerifications.length} Students</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50/50 border border-emerald-100 p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Verified Accounts</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{verifiedVerifications.length} Students</p>
              </div>
              <div className="rounded-[24px] bg-slate-100/50 border border-slate-200/60 p-5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected Requests</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{rejectedVerifications.length} Students</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Pending Identity Verifications</h3>

              {pendingVerifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-semibold">
                  <span className="text-4xl">🎓</span>
                  <p className="mt-3">No pending verification requests on campus.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingVerifications.map((req) => (
                    <div key={req.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between transition hover:shadow-xs">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">{req.department}</div>
                        <h4 className="mt-1.5 text-lg font-bold text-slate-900">{req.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">ID: {req.student_id} • {req.email}</p>
                        <span className="inline-block mt-3 text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full border border-amber-100">Pending Review</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedIDPhoto(req.uploaded_id_card)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          View ID Card
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyAction(req.id, 'Verified')}
                          className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition shadow-xs cursor-pointer"
                        >
                          Verify Student
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyAction(req.id, 'Rejected')}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedIDPhoto && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <h4 className="text-lg font-bold text-slate-900">Student ID Card Preview</h4>
                    <button
                      type="button"
                      onClick={() => setSelectedIDPhoto(null)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2 flex items-center justify-center h-64 shadow-xs">
                    <img src={selectedIDPhoto} alt="Student ID Card" className="h-full w-full object-cover rounded-xl" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIDPhoto(null)}
                    className="w-full mt-4 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'product-management': {
        const filteredProds = productsList.filter(p => {
          const matchesSearch = p.title.toLowerCase().includes(prodSearch.toLowerCase()) || p.seller.toLowerCase().includes(prodSearch.toLowerCase());
          const matchesStatus = prodStatusFilter ? p.status === prodStatusFilter : true;
          return matchesSearch && matchesStatus;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Product Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Approve, reject, or flag student catalog product uploads.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Search Products</label>
                <input
                  type="text"
                  placeholder="Search by title or seller..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Status</label>
                <select
                  value={prodStatusFilter}
                  onChange={(e) => setProdStatusFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Flagged">Flagged</option>
                </select>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Product Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Seller ID / Campus</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProds.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{product.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{product.category} • {product.price}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {product.seller}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${product.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            product.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleProductStatus(product.id, 'Approved')}
                              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition shadow-xs cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProductStatus(product.id, 'Flagged')}
                              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            >
                              Reject/Flag
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      }
      case 'categories':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Category Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Organize, modify, and disable marketplace catalog categories.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
              {/* Active Categories List */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Marketplace Directories</h3>
                <div className="space-y-3">
                  {categoriesList.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 border border-slate-200/50">
                      <div>
                        <div className="font-bold text-slate-900">{cat.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{cat.ads} listings active</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${cat.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                          {cat.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCategoryStatus(cat.id)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Toggle State
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Category Form Container */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Create Directory</h3>
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Category Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Laboratory Equipment"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                  <button type="submit" className="w-full rounded-full bg-emerald-500 py-3 font-bold text-white hover:bg-emerald-600 transition shadow-md cursor-pointer">
                    Add Directory
                  </button>
                </form>
              </div>
            </div>

          </div>
        );
      case 'orders':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Order Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor dynamic student trade receipts, buyer fulfillment, and transactional logs.</p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Order ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Buyer & Seller</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Product Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Fulfillment</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersList.map((order) => (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-bold text-slate-900">{order.id}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">Buyer: {order.buyer}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Seller: {order.seller}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{order.item}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{order.price} • {order.date}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${order.order_status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 text-xs font-bold">
                            {order.pay_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      case 'payments':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Payment Operations Audit</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor wallet loads, payouts, successful transactions, and dispute resolutions.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] bg-slate-100/50 border p-5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Transactions</p>
                <p className="mt-3 text-3xl font-black text-slate-950">8,920</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50/50 border border-emerald-100 p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Successful Payouts</p>
                <p className="mt-3 text-3xl font-black text-slate-950">8,510</p>
              </div>
              <div className="rounded-[24px] bg-amber-50/50 border border-amber-100 p-5">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Settlement</p>
                <p className="mt-3 text-3xl font-black text-slate-950">210</p>
              </div>
              <div className="rounded-[24px] bg-red-50/50 border border-red-100 p-5">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Failed Operations</p>
                <p className="mt-3 text-3xl font-black text-slate-950">150</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Historical Transactions Log</h3>
              <div className="space-y-3">
                {[
                  { tx: "TX-90483", type: "Chapa Deposit", amount: "+ 2,400 ETB", status: "Successful", date: "12 Aug 2026" },
                  { tx: "TX-90482", type: "Checkout Purchase", amount: "- 450 ETB", status: "Successful", date: "11 Aug 2026" },
                  { tx: "TX-90481", type: "Refund Resolution", amount: "+ 120 ETB", status: "Failed", date: "10 Aug 2026" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 border border-slate-200/50 text-sm font-semibold">
                    <div>
                      <p className="text-slate-900 font-bold">{item.tx} • {item.type}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.amount.startsWith('+') ? 'text-emerald-600' : 'text-slate-800'}`}>{item.amount}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold ${item.status === 'Successful' ? 'text-emerald-700' : 'text-red-700'}`}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        );
      case 'reports':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Reports & Complaints</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Review flagged listings, appropriate content violations, and merchant issues.</p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Flagged Target</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Reporter</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Accusation / Reason</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Fulfillment</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Moderate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsList.map((rep) => (
                      <tr key={rep.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-bold text-slate-900">{rep.target}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{rep.reporter}</td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-500">{rep.reason}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${rep.status === 'Warned' || rep.status === 'Removed' ? 'bg-red-50 text-red-700 border-red-100' :
                            rep.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                            {rep.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleReportAction(rep.id, 'Warned')}
                              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition"
                            >
                              Warn
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReportAction(rep.id, 'Removed')}
                              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      case 'ai-recommendations':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">AI Recommendation Performance</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor content-based recommendation counts, model CTRs, and search alignments.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-slate-100/50 border p-5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recommendation Requests</p>
                <p className="mt-3 text-3xl font-black text-slate-950">18,420</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Recommendations Clicked</p>
                <p className="mt-3 text-3xl font-black text-slate-950">7,820</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50/50 border border-emerald-100 p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Click-Through Rate (CTR)</p>
                <p className="mt-3 text-3xl font-black text-emerald-600">42.4%</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Content-Based Model Configuration (TF-IDF)</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                Our campus marketplace features a Content-Based Filtering algorithm matching listing vectors using Term Frequency-Inverse Document Frequency (TF-IDF) calculations. This optimizes search relevance based on student directory queries.
              </p>
            </div>

          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Advanced Analytics</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor new user signups, daily marketplace trades, and popular catalog lists.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-2 mb-4">Most Liked & View Categories</h3>
                <div className="space-y-4">
                  {[
                    { label: "Electronics (Laptops)", val: "85%", color: "bg-blue-500" },
                    { label: "Academic Books (Calculus)", val: "60%", color: "bg-emerald-500" },
                    { label: "Mobile Accessories", val: "45%", color: "bg-amber-500" }
                  ].map((item, i) => (
                    <div key={i} className="space-y-1 text-xs font-semibold">
                      <div className="flex justify-between">
                        <span>{item.label}</span>
                        <span>{item.val}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: item.val }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">System Broadcast Notifications</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Create global announcements or target specific student user groups.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
              {/* Broadcast Logs */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Historical Announcements</h3>
                <div className="space-y-4">
                  {announcementLog.map((log) => (
                    <div key={log.id} className="rounded-2xl bg-slate-50/50 p-4 border border-slate-200/50">
                      <div className="text-xs uppercase tracking-widest text-blue-600 font-bold">Target: {log.target}</div>
                      <p className="mt-1.5 text-sm text-slate-900 font-semibold">{log.msg}</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold">{log.date}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compose Announcement */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Compose Broadcast</h3>
                <form onSubmit={handleSendAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Select Audience</label>
                    <select
                      value={announcement.target}
                      onChange={(e) => setAnnouncement({ ...announcement, target: e.target.value })}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Everyone">Everyone on Campus</option>
                      <option value="Sellers">Sellers Only</option>
                      <option value="Buyers">Buyers Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Announcement Message</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="e.g. Scheduled system maintenance..."
                      value={announcement.message}
                      onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full rounded-full bg-emerald-500 py-3 font-bold text-white hover:bg-emerald-600 transition shadow-md cursor-pointer">
                    Broadcast Now
                  </button>
                </form>
              </div>
            </div>

          </div>
        );
      case 'audit-logs':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Security & Action Audit Logs</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Track chronological administrator security operations and enforcement histories.</p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Operations Timeline</h3>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 border border-slate-200/50 text-sm font-semibold">
                    <span className="text-xl">📜</span>
                    <div>
                      <p className="text-slate-900 font-bold">{log.action}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900 max-w-xl mx-auto">
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950 border-b pb-3 mb-6">System Settings</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Marketplace Name</label>
                  <input
                    type="text"
                    value={sysSettings.marketplaceName}
                    onChange={(e) => setSysSettings({ ...sysSettings, marketplaceName: e.target.value })}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Max Upload Image Size</label>
                  <input
                    type="text"
                    value={sysSettings.maxImageSize}
                    onChange={(e) => setSysSettings({ ...sysSettings, maxImageSize: e.target.value })}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Recommendation Weights Engine</label>
                  <input
                    type="text"
                    disabled
                    value={sysSettings.recommendationWeight}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => alert('Settings saved successfully!')}
                  className="w-full rounded-full bg-emerald-500 py-3.5 font-bold text-white hover:bg-emerald-600 transition shadow-md cursor-pointer"
                >
                  Save System Configurations
                </button>
              </div>
            </div>

          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">

        {/* Dark Navy Collapsible Sidebar with Custom Scrollbar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#111c3a] p-6 text-white shadow-xl transition-all duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-72 lg:ml-0'}
        `}>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="rounded-3xl bg-slate-900/40 px-4 py-3 text-sm uppercase tracking-[0.24em] text-slate-400">
                Admin Console
              </div>
              <div className="mt-5">
                <h1 className="text-2xl font-bold text-white">Campace Admin</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Control users, products, orders and campus operations from one view.
                </p>
              </div>
            </div>
          </div>

          <nav className="flex max-h-[calc(100vh-180px)] flex-col overflow-y-auto pr-1 scrollbar-thin scrollbar-track-slate-900/20 scrollbar-thumb-slate-600/60">
            {adminTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`mb-2 flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left text-sm font-semibold transition duration-200 cursor-pointer ${isActive
                    ? 'bg-[#1d4ed8] text-white shadow-md'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                </button>
              );
            })}
          </nav>
        </aside>

        {isSidebarOpen && (
          <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden" />
        )}

        {/* Main Panel Content Area */}
        <main className="flex-1">
          <div className="mb-6 flex flex-col gap-4 rounded-[32px] bg-white p-6 text-slate-950 shadow-sm border border-slate-200/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {!isSidebarOpen && (
                  <button onClick={() => setIsSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition cursor-pointer hidden lg:flex">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16" />
                    </svg>
                  </button>
                )}
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Administrator</p>
                  <h2 className="mt-2 text-3xl font-bold">Campus Marketplace Admin</h2>
                </div>
              </div>
            </div>
          </div>

          <section className="rounded-[32px] bg-slate-50 shadow-sm">
            {isReady ? renderTabContent() : (
              <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                Loading admin tools...
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;