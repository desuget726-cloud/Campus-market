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

function AdminDashboard({ onLogout, initialTab = 'dashboard', onTabChange }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: 'mau9999',
    email: 'admin@campace.edu',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: true,
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState({
    username: 'mau9999',
    email: 'admin@campace.edu',
    role: 'Primary Super Admin',
    status: 'Active',
    last_login: '2026-08-13T08:10:00',
    total_actions: 148,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    sessionIp: '192.168.10.24',
  });

  // === HOISTED STATES FOR ALL PANELS (OBEYING RULES OF HOOKS) ===

  // 1. User Management States
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCollegeFilter, setUserCollegeFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [dbCollegesList, setDbCollegesList] = useState([]);
  const [dbDepartmentsList, setDbDepartmentsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEnforcementModal, setShowEnforcementModal] = useState(false);
  const [enforcementTarget, setEnforcementTarget] = useState(null);
  const [enforcementReason, setEnforcementReason] = useState('Scam attempts');
  const [customEnforcementReason, setCustomEnforcementReason] = useState('');
  const [userManagementStats, setUserManagementStats] = useState({
    totalStudents: 5240,
    activeSellers: 2340,
    activeBuyers: 4120,
    suspendedAccounts: 18,
  });
  const [studentUsers, setStudentUsers] = useState([
    { id: 1, student_id: "MAU1600002", name: "Tefesayiku", email: "desu5392@gmail.com", phone: "0962714305", college: "CCI", department: "Software Engineering", year: "Year 3", is_verified: true, status: "Active", rating: "4.8 ★", activity: [{ action: "Logged in", time: "10m ago" }] },
    { id: 2, student_id: "IT2026-001", name: "Abebe Kebede", email: "student@university.edu", phone: "0911223344", college: "CCI", department: "Information Technology", year: "Year 2", is_verified: false, status: "Active", rating: "No ratings", activity: [{ action: "Updated Profile", time: "3h ago" }] }
  ]);

  // 2. Student Verification States
  const [selectedIDPhoto, setSelectedIDPhoto] = useState(null);
  const [verificationSearchTerm, setVerificationSearchTerm] = useState('');
  const [verificationFilterDept, setVerificationFilterDept] = useState('All');
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [selectedVerificationRequest, setSelectedVerificationRequest] = useState(null);
  const [verificationRejectReason, setVerificationRejectReason] = useState('Blurry Image');
  const [verificationZoom, setVerificationZoom] = useState(1);
  const [verificationRotation, setVerificationRotation] = useState(0);
  const [verifications, setVerifications] = useState([
    { id: 1, name: "Abebe Kebede", student_id: "IT2026-001", email: "student@university.edu", department: "Information Technology", status: "Pending", uploaded_id_card: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80" },
    { id: 2, name: "Tefesayiku", student_id: "MAU1600002", email: "desu5392@gmail.com", department: "Software Engineering", status: "Verified", uploaded_id_card: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80" }
  ]);

  // 3. Product Management States
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productsList, setProductsList] = useState([
    { id: 1, title: "HP Pavilion Laptop", price: "24,000 ETB", seller: "Tefesayiku", category: "Electronics", condition: "New", status: "Pending", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80", description: "Premium lightweight laptop with 16GB RAM and a 512GB SSD for student productivity.", seller_verified: true },
    { id: 2, title: "Calculus II Textbook", price: "450 ETB", seller: "Abebe Kebede", category: "Books", condition: "Gently Used", status: "Approved", image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80", description: "Well-maintained calculus reference book with highlighted notes and exercise solutions.", seller_verified: true }
  ]);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Inappropriate Image');
  const [pendingRejectProduct, setPendingRejectProduct] = useState(null);

  // 4. Category Management States
  const [categoriesList, setCategoriesList] = useState([
    {
      id: 1, name: "Electronics", icon: "🔌", ads: "45 ads", status: "Active", subcategories: [
        { id: 11, name: "Laptops", icon: "💻", category_id: 1, ads: "12 ads" },
        { id: 12, name: "Mobile Phones", icon: "📱", category_id: 1, ads: "18 ads" }
      ]
    },
    {
      id: 2, name: "Academic Books", icon: "📚", ads: "120 ads", status: "Active", subcategories: [
        { id: 21, name: "Textbooks", icon: "📖", category_id: 2, ads: "80 ads" },
        { id: 22, name: "Reference Books", icon: "📕", category_id: 2, ads: "40 ads" }
      ]
    },
    { id: 3, name: "Laboratory Equipment", icon: "🔬", ads: "28 ads", status: "Active", subcategories: [] }
  ]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubParentId, setNewSubParentId] = useState('');
  const [catMsg, setCatMsg] = useState('');

  // 5. Order Management State
  const [ordersList, setOrdersList] = useState([
    { id: "ORD-9482", buyer_id: "MAU1600002", seller_id: "MAU1600031", buyer: "MAU1600002", seller: "Abebe K.", product_title: "Calculus Book", total_amount: 450, price: "450 ETB", order_status: "Processing", payment_status: "Successful", date: "2026-08-12T10:25:00", pickup_location: "Main Library" },
    { id: "ORD-9483", buyer_id: "MAU1600009", seller_id: "MAU1600028", buyer: "MAU1600009", seller: "Tefesayiku", product_title: "Laptop", total_amount: 24000, price: "24,000 ETB", order_status: "Completed", payment_status: "Successful", date: "2026-08-11T15:15:00", pickup_location: "Student Center" },
    { id: "ORD-9484", buyer_id: "IT2026-001", seller_id: "MAU1600040", buyer: "IT2026-001", seller: "Meron A.", product_title: "Chemistry Lab Kit", total_amount: 6800, price: "6,800 ETB", order_status: "Pending", payment_status: "Pending", date: "2026-08-10T09:42:00", pickup_location: "Science Block" },
    { id: "ORD-9485", buyer_id: "MAU1600015", seller_id: "MAU1600062", buyer: "MAU1600015", seller: "Aster Solomon", product_title: "Desk Lamp", total_amount: 1850, price: "1,850 ETB", order_status: "Ready for Pickup", payment_status: "Successful", date: "2026-08-09T17:20:00", pickup_location: "Main Library" },
    { id: "ORD-9486", buyer_id: "MAU1600054", seller_id: "MAU1600018", buyer: "MAU1600054", seller: "Hana Bekele", product_title: "Office Chair", total_amount: 3250, price: "3,250 ETB", order_status: "Out for Delivery", payment_status: "Failed", date: "2026-08-08T12:05:00", pickup_location: "Student Center" },
    { id: "ORD-9487", buyer_id: "MAU1600011", seller_id: "MAU1600032", buyer: "MAU1600011", seller: "Liya Asrat", product_title: "Wireless Earbuds", total_amount: 2900, price: "2,900 ETB", order_status: "Cancelled", payment_status: "Refunded", date: "2026-08-07T08:10:00", pickup_location: "Main Library" }
  ]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('All');
  const [orderFilterPayment, setOrderFilterPayment] = useState('All');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // 6. Reports & Complaints States
  const [reportsList, setReportsList] = useState([
    { id: 1, report_id: "RPT-2048", complaint_type: "Fake Product", product_name: "HP Pavilion Laptop", reporter: "MAU1600004", student: "Mekdes Bekele", student_id: "MAU1600004", seller_id: "MAU1600031", seller_name: "Abebe Kebede", issue: "The product listing claimed 16GB RAM and a new battery, but the seller delivered a damaged unit with only 8GB RAM and worn battery health.", priority: "High", status: "Open", date: "2026-08-12T10:25:00" },
    { id: 2, report_id: "RPT-2049", complaint_type: "Fraud/Scam", product_name: "Used iPhone 12", reporter: "MAU1600002", student: "Tefesayiku Tadesse", student_id: "MAU1600002", seller_id: "MAU1600044", seller_name: "Selam Worku", issue: "Buyer was asked to pay outside the app and the seller stopped responding after the deposit was made.", priority: "High", status: "Review", date: "2026-08-11T13:45:00" },
    { id: 3, report_id: "RPT-2050", complaint_type: "Seller Misconduct", product_name: "Math Textbook Bundle", reporter: "IT2026-001", student: "Daniel Gebre", student_id: "IT2026-001", seller_id: "MAU1600028", seller_name: "Meron Alem", issue: "Seller repeatedly sent abusive messages and attempted to pressure the buyer into a price drop after order confirmation.", priority: "Medium", status: "Open", date: "2026-08-11T09:08:00" },
    { id: 4, report_id: "RPT-2051", complaint_type: "Payment Problem", product_name: "Mechanical Pencil Set", reporter: "MAU1600015", student: "Nahom Yilma", student_id: "MAU1600015", seller_id: "MAU1600062", seller_name: "Aster Solomon", issue: "Transaction shows successful payment but item was never marked delivered or released to the buyer.", priority: "High", status: "Resolved", date: "2026-08-10T16:20:00" },
    { id: 5, report_id: "RPT-2052", complaint_type: "Order Problem", product_name: "Office Chair", reporter: "MAU1600054", student: "Yared Tesfaye", student_id: "MAU1600054", seller_id: "MAU1600018", seller_name: "Hana Bekele", issue: "Product arrived in a different condition than the posted image and no return window was provided by the seller.", priority: "Medium", status: "Open", date: "2026-08-09T11:15:00" },
    { id: 6, report_id: "RPT-2053", complaint_type: "Inappropriate Content", product_name: "Dorm Decor Catalog", reporter: "MAU1600023", student: "Ruth Alem", student_id: "MAU1600023", seller_id: "MAU1600078", seller_name: "Kidus Haftu", issue: "Marketplace listing includes explicit and inappropriate visual content violating community standards.", priority: "High", status: "Review", date: "2026-08-08T17:30:00" },
    { id: 7, report_id: "RPT-2054", complaint_type: "Buyer Misconduct", product_name: "Wireless Earbuds", reporter: "MAU1600011", student: "Biniam Kebede", student_id: "MAU1600011", seller_id: "MAU1600032", seller_name: "Liya Asrat", issue: "Buyer repeatedly used abusive language and attempted to extort a refund after receiving the item.", priority: "Low", status: "Closed", date: "2026-08-07T08:10:00" },
    { id: 8, report_id: "RPT-2055", complaint_type: "Other", product_name: "Study Desk", reporter: "MAU1600037", student: "Sofonias Hailu", student_id: "MAU1600037", seller_id: "MAU1600050", seller_name: "Biruk Dagnaw", issue: "The listing was duplicated multiple times and caused confusion in the marketplace feed.", priority: "Low", status: "Resolved", date: "2026-08-06T15:40:00" }
  ]);
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('All');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('All');
  const [reportDecision, setReportDecision] = useState('Warning');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState(false);

  // 6.5 Payments Management States
  const [paymentsList, setPaymentsList] = useState([
    { id: "TXN-1045", transaction_id: "TX-1045", buyer_id: "MAU1600002", seller_id: "MAU1600031", order_id: "ORD-1045", amount: 2500, payment_type: "Product Purchase", payment_method: "Chapa", status: "Successful", date: "2026-08-12T10:25:00" },
    { id: "TXN-1046", transaction_id: "TX-1046", buyer_id: "MAU1600009", seller_id: "MAU1600028", order_id: "ORD-1046", amount: 9500, payment_type: "Product Purchase", payment_method: "Wallet", status: "Successful", date: "2026-08-11T15:15:00" },
    { id: "TXN-1047", transaction_id: "TX-1047", buyer_id: "MAU1600015", seller_id: "MAU1600040", order_id: "ORD-1047", amount: 3200, payment_type: "Wallet Deposit", payment_method: "SantimPay", status: "Pending", date: "2026-08-10T09:42:00" },
    { id: "TXN-1048", transaction_id: "TX-1048", buyer_id: "IT2026-001", seller_id: "MAU1600039", order_id: "ORD-1048", amount: 5600, payment_type: "Seller Payout", payment_method: "Bank Transfer", status: "Failed", date: "2026-08-09T11:30:00" },
    { id: "TXN-1049", transaction_id: "TX-1049", buyer_id: "MAU1600023", seller_id: "MAU1600062", order_id: "ORD-1049", amount: 18750, payment_type: "Product Purchase", payment_method: "Chapa", status: "Successful", date: "2026-08-08T13:05:00" },
    { id: "TXN-1050", transaction_id: "TX-1050", buyer_id: "MAU1600005", seller_id: "MAU1600018", order_id: "ORD-1050", amount: 250, payment_type: "Refund", payment_method: "Wallet", status: "Pending", date: "2026-08-08T16:50:00" },
    { id: "TXN-1051", transaction_id: "TX-1051", buyer_id: "MAU1600054", seller_id: "MAU1600078", order_id: "ORD-1051", amount: 3450, payment_type: "Wallet Deposit", payment_method: "SantimPay", status: "Successful", date: "2026-08-07T08:15:00" },
    { id: "TXN-1052", transaction_id: "TX-1052", buyer_id: "MAU1600011", seller_id: "MAU1600032", order_id: "ORD-1052", amount: 6800, payment_type: "Seller Payout", payment_method: "Chapa", status: "Failed", date: "2026-08-06T18:30:00" }
  ]);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('All');
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [paymentStatusMessageId, setPaymentStatusMessageId] = useState(null);

  // 7. System Notifications / Broadcast Dashboard States
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    target: 'Everyone',
    sendType: 'now',
    scheduleDate: '',
    scheduleTime: ''
  });
  const [announcementLog, setAnnouncementLog] = useState([
    {
      id: 1,
      title: 'Campus marketplace update',
      message: 'The new student marketplace categories have been activated for the current semester. Please review and update your listings before tomorrow.',
      target: 'Everyone',
      sendType: 'now',
      status: 'Delivered',
      delivered: 11980,
      read: 9820,
      unread: 2160,
      date: '12 Aug 2026'
    },
    {
      id: 2,
      title: 'Seller verification reminder',
      message: 'All verified sellers must complete account validation before listing premium items in the marketplace.',
      target: 'Sellers',
      sendType: 'now',
      status: 'Delivered',
      delivered: 680,
      read: 540,
      unread: 140,
      date: '11 Aug 2026'
    }
  ]);
  const [notificationsSearch, setNotificationsSearch] = useState('');
  const [notificationsFilter, setNotificationsFilter] = useState('All');
  const [previewAnnouncement, setPreviewAnnouncement] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 8. Audit Logs List
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 1,
      action: 'Product Approved',
      actionType: 'Approvals',
      description: 'Admin approved the student product listing "Calculus II" and enabled it for marketplace visibility.',
      performed_by: 'admin.tekle',
      entity_type: 'Product',
      entity_id: 'PRD-2048',
      ip_address: '10.24.8.17',
      date_time: '2026-08-12T22:25:00',
      status: 'Success',
      severity: 'success'
    },
    {
      id: 2,
      action: 'User Suspended',
      actionType: 'Suspensions',
      description: 'Admin suspended MAU1600004 following a fraud investigation and restricted marketplace access.',
      performed_by: 'admin.meron',
      entity_type: 'User',
      entity_id: 'MAU1600004',
      ip_address: '10.24.8.21',
      date_time: '2026-08-12T22:31:00',
      status: 'Success',
      severity: 'warning'
    },
    {
      id: 3,
      action: 'Product Deleted',
      actionType: 'Deletions',
      description: 'Admin removed a counterfeit listing after multiple community abuse reports and verification review.',
      performed_by: 'admin.selam',
      entity_type: 'Product',
      entity_id: 'PRD-1983',
      ip_address: '10.24.9.03',
      date_time: '2026-08-12T22:42:00',
      status: 'Failed',
      severity: 'critical'
    },
    {
      id: 4,
      action: 'Admin Login',
      actionType: 'Logins',
      description: 'Administrator account login succeeded from the institution’s secure management subnet.',
      performed_by: 'admin.tekle',
      entity_type: 'Session',
      entity_id: 'SES-4382',
      ip_address: '10.24.8.14',
      date_time: '2026-08-12T21:10:00',
      status: 'Success',
      severity: 'success'
    }
  ]);
  const [auditLogSearch, setAuditLogSearch] = useState('');
  const [auditLogFilterAction, setAuditLogFilterAction] = useState('All');
  const [auditLogFilterStatus, setAuditLogFilterStatus] = useState('All');
  const [selectedLogDetails, setSelectedLogDetails] = useState(null);

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/profile?username=mau9999');
        if (!response.ok) {
          throw new Error('Admin profile endpoint unavailable');
        }

        const data = await response.json();
        if (data && data.username) {
          const nextProfile = {
            username: data.username || 'mau9999',
            email: data.email || 'admin@campace.edu',
            role: data.role || 'Primary Super Admin',
            status: data.status || 'Active',
            last_login: data.last_login || new Date().toISOString(),
            total_actions: Number(data.total_actions ?? data.totalActions ?? 0),
            avatarUrl: data.avatarUrl || data.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
            sessionIp: data.session_ip || data.sessionIp || '192.168.10.24',
          };
          setAdminProfile(nextProfile);
          setProfileForm((prev) => ({
            ...prev,
            username: nextProfile.username,
            email: nextProfile.email,
            twoFactorEnabled: data.two_factor_enabled ?? prev.twoFactorEnabled,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch admin profile details, using fallback values.', err);
      }
    };

    fetchAdminProfile();
  }, []);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/audit-logs');
        if (!response.ok) {
          throw new Error('Audit logs endpoint unavailable');
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedLogs = data.map((log, index) => ({
            id: log.id ?? index + 1,
            action: log.action ?? 'System Event',
            actionType: log.actionType ?? 'Logins',
            description: log.description ?? 'No description available.',
            performed_by: log.performed_by ?? 'system.admin',
            entity_type: log.entity_type ?? 'Unknown',
            entity_id: log.entity_id ?? 'N/A',
            ip_address: log.ip_address ?? '10.0.0.0',
            date_time: log.date_time ?? new Date().toISOString(),
            status: log.status ?? 'Success',
            severity: log.severity ?? 'success'
          }));
          setAuditLogs(mappedLogs);
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      }
    };

    fetchAuditLogs();
  }, []);

  useEffect(() => {
    const fetchVerifications = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/verifications');
        if (!response.ok) {
          throw new Error('Verification endpoint unavailable');
        }

        const data = await response.json();
        const payload = Array.isArray(data) ? data : (data.verifications || data.items || []);

        if (Array.isArray(payload) && payload.length > 0) {
          const mappedVerifications = payload.map((request, index) => ({
            id: request.id ?? request.student_id ?? index + 1,
            name: request.name ?? request.student_name ?? request.full_name ?? 'Unknown Student',
            student_id: request.student_id ?? request.studentId ?? `STU-${index + 1}`,
            email: request.email ?? request.student_email ?? 'student@campus.edu.et',
            department: request.department ?? request.college_department ?? 'General Studies',
            status: request.status ?? 'Pending',
            uploaded_id_card: request.uploaded_id_card ?? request.id_card_url ?? request.image_url ?? 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            uploaded_at: request.uploaded_at ?? request.created_at ?? new Date().toISOString(),
            reason: request.reason ?? ''
          }));

          setVerifications(mappedVerifications);
        }
      } catch (error) {
        console.error('Failed to fetch verification requests:', error);
      }
    };

    fetchVerifications();
  }, []);

  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/users');
        if (!response.ok) {
          throw new Error('Users endpoint unavailable');
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedUsers = data.map((student, index) => ({
            id: student.id ?? index + 1,
            student_id: student.student_id ?? `STU-${index + 1}`,
            name: student.name ?? `Student ${index + 1}`,
            email: student.email ?? `student${index + 1}@campus.edu.et`,
            phone: student.phone ?? 'N/A',
            college: student.college ?? 'CCI',
            department: student.department ?? 'Software Engineering',
            year: student.year ?? 'Year 1',
            is_verified: Boolean(student.is_verified),
            status: student.status ?? 'Active',
            rating: student.rating ?? 'No ratings',
            wallet_balance: student.wallet_balance ?? 0,
            active_listings: student.active_listings ?? 0,
            activity: student.activity ?? [{ action: 'Account synced', time: 'Recently' }],
          }));

          setStudentUsers(mappedUsers);

          const totalStudents = mappedUsers.length;
          const activeSellers = mappedUsers.filter(user => user.is_verified && (user.active_listings ?? 0) > 0).length;
          const activeBuyers = Math.max(totalStudents - activeSellers, 0);
          const suspendedAccounts = mappedUsers.filter(user => user.status === 'Suspended' || user.status === 'Deactivated').length;

          setUserManagementStats({
            totalStudents,
            activeSellers,
            activeBuyers,
            suspendedAccounts,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user metrics:', error);
      }
    };

    fetchUsersData();
  }, []);

  useEffect(() => {
    const fetchCatalogProducts = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/products');
        if (!response.ok) {
          throw new Error('Catalog products endpoint unavailable');
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedProducts = data.map((product, index) => ({
            id: product.id ?? index + 1,
            title: product.title ?? `Product ${index + 1}`,
            price: product.price ?? `${Math.floor(Math.random() * 9000) + 500} ETB`,
            seller: product.seller ?? 'Unknown Student',
            seller_id: product.seller_id ?? product.seller ?? 'Unknown Student',
            category: product.category ?? 'General',
            condition: product.condition ?? (index % 2 === 0 ? 'New' : 'Gently Used'),
            status: product.status ?? 'Pending',
            image: product.image ?? 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
            description: product.description ?? 'No product description provided by the seller yet.',
            seller_verified: product.seller_verified ?? product.is_verified ?? true,
          }));
          setProductsList(mappedProducts);
        }
      } catch (error) {
        console.error('Failed to fetch admin catalog products:', error);
      }
    };

    fetchCatalogProducts();
  }, []);

  // 9. System Settings Fields
  const [generalSettings, setGeneralSettings] = useState({
    marketplaceName: 'Campace Market',
    description: 'A secure campus marketplace for buying and selling university essentials.',
    supportEmail: 'support@campace.edu.et',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa'
  });
  const [productSettings, setProductSettings] = useState({
    maxImageSize: '5MB',
    maxImagesPerProduct: 5,
    requireApproval: true,
    allowEditing: true,
    autoHideSold: true
  });
  const [aiSettings, setAiSettings] = useState({
    recommendationEngine: 'Content-Based Filtering (TF-IDF)',
    numRecommendations: 5,
    minSimilarityScore: 0.20,
    enableAI: true
  });
  const [paymentSettings, setPaymentSettings] = useState({
    paymentProvider: 'Chapa',
    currency: 'ETB',
    enableOnlinePayment: true,
    paymentVerification: 'Automatic',
    refundsEnabled: true
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifs: true,
    orderNotifs: true,
    messageNotifs: true,
    approvalNotifs: true,
    paymentNotifs: true,
    announcementNotifs: true
  });
  const [securitySettings, setSecuritySettings] = useState({
    requireStudentVerification: true,
    admin2FA: true,
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    minPasswordLength: 8,
    auditLogging: true
  });
  const [studentVerificationSettings, setStudentVerificationSettings] = useState({
    allowedEmailDomain: 'university.edu.et',
    requireUniversityEmail: true,
    autoApproveStudents: false
  });
  const [moderationSettings, setModerationSettings] = useState({
    autoHideReported: true,
    requireAdminApproval: true,
    maxReportsBeforeReview: 3,
    allowStudentReports: true
  });
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');

  // KPI calculations
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalProducts: 0,
    pendingProducts: 0,
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: '0 ETB',
    pendingReports: 0,
  });

  const fetchDashboardOverview = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/analytics');
      if (!response.ok) {
        throw new Error('Admin analytics endpoint unavailable');
      }

      const data = await response.json();
      const productBreakdown = data?.productStatusBreakdown ?? data?.product_status_breakdown ?? {};
      const pendingProducts = Number(
        data?.pendingProducts ?? data?.pending_products ?? productBreakdown.Pending ?? productBreakdown['Pending'] ?? 0,
      );
      const totalStudents = Number(data?.users ?? data?.totalStudents ?? data?.total_students ?? 0);
      const totalProducts = Number(data?.products ?? data?.totalProducts ?? data?.total_products ?? 0);
      const totalOrders = Number(data?.orders ?? data?.totalOrders ?? data?.total_orders ?? 0);
      const completedOrders = Number(
        data?.completedOrders ?? data?.completed_orders ?? Math.max(totalOrders - (data?.pendingOrders ?? 0), 0),
      );
      const totalRevenue = data?.revenue ?? data?.totalRevenue ?? data?.total_revenue ?? '0 ETB';
      const pendingReports = Number(data?.pendingReports ?? data?.pending_reports ?? 0);
      const activeStudents = Number(
        data?.activeStudents ?? data?.active_students ?? Math.max(Math.round(totalStudents * 0.9), 0),
      );

      setMetrics({
        totalStudents,
        activeStudents,
        totalProducts,
        pendingProducts,
        totalOrders,
        completedOrders,
        totalRevenue,
        pendingReports,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard overview metrics:', error);
      setMetrics((prev) => ({
        ...prev,
        totalStudents: prev.totalStudents || 0,
        activeStudents: prev.activeStudents || 0,
        totalProducts: prev.totalProducts || 0,
        pendingProducts: prev.pendingProducts || 0,
        totalOrders: prev.totalOrders || 0,
        completedOrders: prev.completedOrders || 0,
        totalRevenue: prev.totalRevenue || '0 ETB',
        pendingReports: prev.pendingReports || 0,
      }));
    }
  };

  const mockAnalyticsData = {
    users: 5240,
    products: 12450,
    orders: 8920,
    revenue: '2.4M ETB',
    salesTrend: [32, 50, 44, 68, 62, 81, 96],
    revenueTrend: [18, 26, 30, 49, 52, 64, 88],
    registrations: [12, 18, 16, 26, 24, 31, 39],
    orderStatus: [
      { label: 'Completed', value: 58, color: '#10b981' },
      { label: 'Pending', value: 22, color: '#f59e0b' },
      { label: 'Processing', value: 14, color: '#3b82f6' },
      { label: 'Cancelled', value: 6, color: '#ef4444' }
    ],
    categories: [
      { name: 'Electronics', views: '18.4K', likes: '4.2K', sales: '1,280' },
      { name: 'Books', views: '12.1K', likes: '3.1K', sales: '930' },
      { name: 'Lab Equipment', views: '9.6K', likes: '2.7K', sales: '760' },
      { name: 'Accessories', views: '8.3K', likes: '2.2K', sales: '640' },
      { name: 'Stationery', views: '6.7K', likes: '1.8K', sales: '490' }
    ],
    departmentActivity: [
      { name: 'Information Technology', value: 32, color: 'bg-blue-500' },
      { name: 'Engineering', value: 26, color: 'bg-violet-500' },
      { name: 'Medicine', value: 19, color: 'bg-emerald-500' },
      { name: 'Business', value: 14, color: 'bg-amber-500' },
      { name: 'Social Science', value: 9, color: 'bg-slate-500' }
    ],
    recentActivity: [
      { time: '08:42 AM', action: 'New electronics listing approved by admin', user: 'Student • MAU1602041' },
      { time: '09:15 AM', action: 'Engineering books category gained 18% more click-through', user: 'AI Recommendation Engine' },
      { time: '10:05 AM', action: 'Payment verified for a laptop order from IT department', user: 'Finance • TXN-11842' },
      { time: '12:20 PM', action: 'Three new student accounts were verified successfully', user: 'Admin Review Queue' },
      { time: '02:40 PM', action: 'Lab equipment recommendation campaign reached 1.2K impressions', user: 'Marketing Module' }
    ]
  };

  const [analyticsData, setAnalyticsData] = useState(mockAnalyticsData);

  const analyticsSummaryCards = [
    { label: 'Users', value: analyticsData.users ?? 0, trend: '+12.8%' },
    { label: 'Products', value: analyticsData.products ?? 0, trend: '+9.4%' },
    { label: 'Orders', value: analyticsData.orders ?? 0, trend: '+17.1%' },
    { label: 'Revenue', value: analyticsData.revenue ?? '0 ETB', trend: '+23.6%' },
  ];

  const analyticsOrderStatus = Array.isArray(analyticsData.orderStatus) && analyticsData.orderStatus.length > 0
    ? analyticsData.orderStatus
    : mockAnalyticsData.orderStatus;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchDashboardOverview();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/analytics');
        if (!response.ok) throw new Error('Analytics endpoint unavailable');
        const data = await response.json();
        setAnalyticsData({ ...mockAnalyticsData, ...data });
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        setAnalyticsData(mockAnalyticsData);
      }
    };

    fetchAnalytics();
  }, []);

  // Fetch colleges list on component mount
  useEffect(() => {
    fetchCollegesData();
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      const fetchSystemSettings = async () => {
        try {
          const response = await fetch('http://127.0.0.1:8000/api/admin/settings');
          if (!response.ok) throw new Error('Settings endpoint unavailable');

          const data = await response.json();
          if (data.general) setGeneralSettings({ ...generalSettings, ...data.general });
          if (data.product) setProductSettings({ ...productSettings, ...data.product });
          if (data.ai) setAiSettings({ ...aiSettings, ...data.ai });
          if (data.payment) setPaymentSettings({ ...paymentSettings, ...data.payment });
          if (data.notifications) setNotificationSettings({ ...notificationSettings, ...data.notifications });
          if (data.security) setSecuritySettings({ ...securitySettings, ...data.security });
          if (data.studentVerification) setStudentVerificationSettings({ ...studentVerificationSettings, ...data.studentVerification });
          if (data.moderation) setModerationSettings({ ...moderationSettings, ...data.moderation });
        } catch (error) {
          console.error('Failed to fetch system settings:', error);
        }
      };

      fetchSystemSettings();
    }
  }, [activeTab]);

  // Fetch reports when reports tab is active
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsData();
    }
  }, [activeTab]);

  // Fetch payments when payments tab is active
  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPaymentsData();
    }
  }, [activeTab]);

  // Fetch orders when orders tab is active
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrdersData();
    }
  }, [activeTab]);

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

  // Fetch reports from backend
  const fetchReportsData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/reports');
      const reports = await response.json();
      setReportsList(reports || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      // Fallback to default state already set
    }
  };

  // Fetch payments from backend
  const fetchPaymentsData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/payments');
      const payments = await response.json();
      setPaymentsList(payments || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      // Fallback to default state already set
    }
  };

  // Fetch orders from backend
  const fetchOrdersData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/orders');
      if (!response.ok) {
        throw new Error('Orders endpoint unavailable');
      }
      const orders = await response.json();
      if (Array.isArray(orders) && orders.length > 0) {
        setOrdersList(orders.map((order) => ({
          ...order,
          buyer_id: order.buyer_id || order.buyer || 'Unknown',
          seller_id: order.seller_id || order.seller || 'Unknown',
          product_title: order.product_title || order.item || 'Unnamed Product',
          total_amount: Number(order.total_amount ?? order.amount ?? 0),
          price: `${Number(order.total_amount ?? order.amount ?? 0).toLocaleString('en-ET')} ETB`,
          order_status: order.order_status || 'Pending',
          payment_status: order.payment_status || order.pay_status || 'Pending',
          pickup_location: order.pickup_location || 'Main Library',
          date: order.date || new Date().toISOString()
        })));
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  // Handle payment status updates with audit logging
  const handlePaymentStatusUpdate = async (paymentId, newStatus) => {
    const payment = paymentsList.find(p => p.id === paymentId);
    if (!payment) return;

    const oldStatus = payment.status;
    const timestamp = new Date().toLocaleString();

    // Update local state
    setPaymentsList(prev => prev.map(p =>
      p.id === paymentId ? { ...p, status: newStatus } : p
    ));

    // Show temporary warning message
    setPaymentStatusMessage(`Status updated from "${oldStatus}" to "${newStatus}"`);
    setPaymentStatusMessageId(paymentId);
    setTimeout(() => setPaymentStatusMessage(''), 3000);

    // Log to audit logs
    setAuditLogs(prev => [
      {
        id: Date.now(),
        action: `Admin updated payment TXN-${paymentId} status from "${oldStatus}" to "${newStatus}" for student ${payment.student_id}. Amount: ${payment.amount}`,
        date: timestamp
      },
      ...prev
    ]);

    // Send update to backend
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/payments/${paymentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        console.error('Failed to update payment status on backend');
        // Revert local state on backend error
        setPaymentsList(prev => prev.map(p =>
          p.id === paymentId ? { ...p, status: oldStatus } : p
        ));
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
    }
  };

  const handleOrderUpdate = async (orderId, updatedOrderStatus, updatedPaymentStatus) => {
    const order = ordersList.find(item => item.id === orderId);
    if (!order) return;

    const previousOrderStatus = order.order_status;
    const previousPaymentStatus = order.payment_status;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_status: updatedOrderStatus,
          payment_status: updatedPaymentStatus,
          pickup_location: order.pickup_location || 'Main Library'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to persist order status update');
      }

      setOrdersList(prev => prev.map(item => item.id === orderId ? {
        ...item,
        order_status: updatedOrderStatus,
        payment_status: updatedPaymentStatus
      } : item));

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `Admin updated order ${orderId} status from "${previousOrderStatus}" to "${updatedOrderStatus}" and payment status from "${previousPaymentStatus}" to "${updatedPaymentStatus}".`,
        date: new Date().toLocaleString()
      }, ...prev]);

      setSelectedOrderDetails(null);
    } catch (err) {
      console.error('Error saving order status updates:', err);
      setOrdersList(prev => prev.map(item => item.id === orderId ? {
        ...item,
        order_status: previousOrderStatus,
        payment_status: previousPaymentStatus
      } : item));
    }
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'logout') {
      onLogout?.();
      return;
    }
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // State manipulation handlers
  const toggleVerification = (userId) => {
    setStudentUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_verified: !u.is_verified } : u
    ));
  };

  const applyAccountStatusChange = async (userId, newStatus, reason = '') => {
    const target = studentUsers.find(u => u.id === userId);
    if (!target) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      });

      if (!response.ok) {
        throw new Error(`User status update failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));

      setStudentUsers(prev => prev.map(user =>
        user.id === userId
          ? { ...user, status: newStatus, restriction_reason: reason || user.restriction_reason || '' }
          : user
      ));

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `User ${newStatus}`,
        actionType: 'Account Enforcement',
        description: `${target.name} (${target.student_id}) was marked as ${newStatus}${reason ? ` due to: ${reason}` : ''}.`,
        performed_by: 'admin.system',
        entity_type: 'User',
        entity_id: String(userId),
        ip_address: '127.0.0.1',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: newStatus === 'Active' ? 'success' : 'warning'
      }, ...prev]);

      try {
        await fetch('http://127.0.0.1:8000/api/student/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: target.student_id,
            title: newStatus === 'Active' ? 'Account Restored' : 'Account Restriction Notice',
            message: newStatus === 'Active'
              ? 'Your account has been restored and you can continue using the marketplace.'
              : `Your account has been restricted. Reason: ${reason || 'Policy violation'}. Please contact support for review.`
          })
        });
      } catch (notificationError) {
        console.warn('User notification endpoint unavailable; continuing without it.', notificationError);
      }

      if (payload && payload.message) {
        console.info(payload.message);
      }
    } catch (error) {
      console.error('Failed to update user status:', error);
      window.alert('Unable to update the user status. Please try again.');
    } finally {
      setShowEnforcementModal(false);
      setEnforcementTarget(null);
      setEnforcementReason('Scam attempts');
    }
  };

  const handleStatusChange = (userId, newStatus) => {
    if (newStatus === 'Suspended' || newStatus === 'Deactivated') {
      const target = studentUsers.find(u => u.id === userId);
      if (!target) return;
      setEnforcementTarget({ id: userId, name: target.name, student_id: target.student_id, status: newStatus });
      setEnforcementReason('Scam attempts');
      setCustomEnforcementReason('');
      setShowEnforcementModal(true);
      return;
    }

    applyAccountStatusChange(userId, newStatus, '');
  };

  const handleVerifyAction = async (id, actionStatus, reason = '') => {
    const target = verifications.find(v => v.id === id);
    if (!target) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/verifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionStatus,
          reason: actionStatus === 'Rejected' ? (reason || 'Verification failed') : ''
        })
      });

      if (!response.ok) {
        throw new Error(`Verification update failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));

      setVerifications(prev => prev.map(v =>
        v.id === id ? { ...v, status: actionStatus, reason: actionStatus === 'Rejected' ? (reason || 'Verification failed') : '' } : v
      ));

      setStudentUsers(prev => prev.map(u =>
        u.student_id === target.student_id ? { ...u, is_verified: actionStatus === 'Verified' } : u
      ));

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `Student verification ${actionStatus.toLowerCase()}`,
        actionType: 'Identity Review',
        description: `${target.name} (${target.student_id}) was ${actionStatus.toLowerCase()}${actionStatus === 'Rejected' ? ` for: ${reason || 'Verification failed'}` : ''}.`,
        performed_by: 'admin.system',
        entity_type: 'Verification',
        entity_id: String(id),
        ip_address: '127.0.0.1',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: actionStatus === 'Verified' ? 'success' : 'warning'
      }, ...prev]);

      try {
        await fetch('http://127.0.0.1:8000/api/student/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: target.student_id,
            title: actionStatus === 'Verified' ? 'ID Verification Approved' : 'ID Verification Rejected',
            message: actionStatus === 'Verified'
              ? 'Your student identity has been successfully verified. You can now access full marketplace features.'
              : `Your verification request was rejected. Reason: ${reason || 'Verification failed'}. Please resubmit a clear ID card.`
          })
        });
      } catch (notificationError) {
        console.warn('Notification endpoint unavailable; continuing without it.', notificationError);
      }

      if (payload && payload.message) {
        console.info(payload.message);
      }
    } catch (error) {
      console.error('Failed to update verification status:', error);
      window.alert('Unable to update the verification request. Please try again.');
    } finally {
      setShowRejectReasonModal(false);
      setSelectedVerificationRequest(null);
      setVerificationRejectReason('Blurry Image');
    }
  };

  const handleProductStatus = (id, actionStatus) => {
    setProductsList(prev => prev.map(p =>
      p.id === id ? { ...p, status: actionStatus } : p
    ));
  };

  const handleOpenRejectModal = (product) => {
    setPendingRejectProduct(product);
    setRejectReason('Inappropriate Image');
    setShowRejectModal(true);
  };

  const handleSubmitProductFlag = async () => {
    if (!pendingRejectProduct) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/products/${pendingRejectProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Flagged',
          reason: rejectReason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to flag product');
      }

      setProductsList(prev => prev.map(product =>
        product.id === pendingRejectProduct.id
          ? { ...product, status: 'Flagged', rejection_reason: rejectReason }
          : product
      ));
    } catch (error) {
      console.error('Failed to flag product:', error);
      window.alert('Unable to update the product status. Please try again.');
    } finally {
      setShowRejectModal(false);
      setPendingRejectProduct(null);
      setRejectReason('Inappropriate Image');
    }
  };

  // Handle main category creation with API integration
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName,
          icon: newCatIcon
        })
      });

      if (response.ok) {
        const newCategory = await response.json();

        // Update local state
        setCategoriesList(prev => [
          ...prev,
          {
            id: newCategory.id,
            name: newCategory.name,
            icon: newCategory.icon,
            ads: "0 ads",
            status: "Active",
            subcategories: []
          }
        ]);

        // Show success message
        setCatMsg('Category added successfully!');
        setNewCatName('');
        setNewCatIcon('📁');

        // Log to audit logs
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin created new main category "${newCatName}" with icon "${newCatIcon}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setTimeout(() => setCatMsg(''), 3000);
      } else {
        setCatMsg('Failed to add category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      setCatMsg('Error adding category');
    }
  };

  // Handle subcategory creation with API integration
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubParentId) {
      setCatMsg('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubName,
          category_id: parseInt(newSubParentId),
          icon: '📂'
        })
      });

      if (response.ok) {
        const newSubcategory = await response.json();

        // Update local state - add subcategory to parent category
        setCategoriesList(prev => prev.map(cat =>
          cat.id === parseInt(newSubParentId)
            ? {
              ...cat,
              subcategories: [
                ...(cat.subcategories || []),
                {
                  id: newSubcategory.id,
                  name: newSubcategory.name,
                  icon: newSubcategory.icon,
                  category_id: newSubcategory.category_id,
                  ads: "0 ads"
                }
              ]
            }
            : cat
        ));

        // Show success message
        setCatMsg('Subcategory added successfully!');
        setNewSubName('');
        setNewSubParentId('');

        // Log to audit logs
        const parentCat = categoriesList.find(c => c.id === parseInt(newSubParentId));
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin created subcategory "${newSubName}" under "${parentCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setTimeout(() => setCatMsg(''), 3000);
      } else {
        setCatMsg('Failed to add subcategory');
      }
    } catch (err) {
      console.error('Error adding subcategory:', err);
      setCatMsg('Error adding subcategory');
    }
  };

  // Handle category deletion with confirmation
  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Update local state - remove the deleted category
        setCategoriesList(prev => prev.filter(cat => cat.id !== id));

        // Show success message
        setCatMsg('Category deleted successfully!');
        setTimeout(() => setCatMsg(''), 3000);

        // Log to audit logs
        const deletedCat = categoriesList.find(c => c.id === id);
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin deleted category "${deletedCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);
      } else {
        setCatMsg('Failed to delete category');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      setCatMsg('Error deleting category');
    }
  };

  // Handle subcategory deletion with confirmation
  const handleDeleteSubcategory = async (catId, subId) => {
    if (!window.confirm('Are you sure you want to delete this subcategory? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/subcategories/${subId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Update local state - remove the deleted subcategory from the parent category
        setCategoriesList(prev => prev.map(cat =>
          cat.id === catId
            ? {
              ...cat,
              subcategories: cat.subcategories.filter(sub => sub.id !== subId)
            }
            : cat
        ));

        // Show success message
        setCatMsg('Subcategory deleted successfully!');
        setTimeout(() => setCatMsg(''), 3000);

        // Log to audit logs
        const parentCat = categoriesList.find(c => c.id === catId);
        const deletedSub = parentCat?.subcategories.find(s => s.id === subId);
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin deleted subcategory "${deletedSub?.name}" from "${parentCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);
      } else {
        setCatMsg('Failed to delete subcategory');
      }
    } catch (err) {
      console.error('Error deleting subcategory:', err);
      setCatMsg('Error deleting subcategory');
    }
  };

  const handleCloseCase = async (id) => {
    const report = reportsList.find(r => r.id === id);
    if (!report) return;

    setReportActionLoading(true);

    try {
      const timestamp = new Date().toLocaleString();

      // Call backend API with corrected endpoint and payload
      const response = await fetch(`http://127.0.0.1:8000/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed' })
      });

      if (response.ok) {
        // Update local state
        setReportsList(prev => prev.map(r =>
          r.id === id ? { ...r, status: 'Closed' } : r
        ));

        // Log to audit logs
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin closed report ${report.report_id}. Case marked as Closed.`,
            date: timestamp
          },
          ...prev
        ]);

        // Close modal and reset
        setSelectedReport(null);
      } else {
        console.error('Failed to close case:', response.status);
      }
    } catch (err) {
      console.error('Error closing case:', err);
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleResolveReport = async (id, decision) => {
    const report = reportsList.find(r => r.id === id);
    if (!report) return;

    const confirmed = window.confirm(`Resolve report ${report.report_id} with the decision: ${decision}?`);
    if (!confirmed) return;

    setReportActionLoading(true);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Resolved',
          decision,
          priority: report.priority,
          resolved_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        setReportsList(prev => prev.map(r =>
          r.id === id ? { ...r, status: 'Resolved', decision, priority: r.priority || 'Medium' } : r
        ));

        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin resolved report ${report.report_id} via ${decision}.`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setSelectedReport(null);
        setShowReportModal(false);
      } else {
        console.error('Failed to resolve report:', response.status);
      }
    } catch (err) {
      console.error('Error resolving report:', err);
    } finally {
      setReportActionLoading(false);
      setReportDecision('Warning');
    }
  };

  const handleOpenReportModal = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
    setReportDecision('Warning');
  };

  const handleDeleteAnnouncement = (id) => {
    const targetAnnouncement = announcementLog.find(item => item.id === id);
    if (!targetAnnouncement) return;

    const confirmed = window.confirm(`Delete the announcement "${targetAnnouncement.title}" from the history?`);
    if (!confirmed) return;

    setAnnouncementLog(prev => prev.filter(item => item.id !== id));
    if (previewAnnouncement && previewAnnouncement.id === id) {
      setPreviewAnnouncement(null);
      setShowPreviewModal(false);
    }
  };

  const handlePreviewAnnouncement = (e) => {
    e.preventDefault();

    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      alert('Please enter a title and message before previewing the broadcast.');
      return;
    }

    if (announcementForm.sendType === 'schedule' && (!announcementForm.scheduleDate || !announcementForm.scheduleTime)) {
      alert('Please choose both the schedule date and time before previewing a scheduled notification.');
      return;
    }

    setPreviewAnnouncement({
      ...announcementForm,
      id: Date.now(),
      delivered: 0,
      read: 0,
      unread: 0,
      status: announcementForm.sendType === 'schedule' ? 'Scheduled' : 'Ready to send',
      date: new Date().toLocaleString()
    });
    setShowPreviewModal(true);
  };

  const handleConfirmBroadcast = async () => {
    if (!previewAnnouncement) return;

    const payload = {
      title: previewAnnouncement.title,
      message: previewAnnouncement.message,
      target: previewAnnouncement.target,
      sendType: previewAnnouncement.sendType,
      scheduleDate: previewAnnouncement.sendType === 'schedule' ? previewAnnouncement.scheduleDate : null,
      scheduleTime: previewAnnouncement.sendType === 'schedule' ? previewAnnouncement.scheduleTime : null
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Broadcast request failed');
      }

      const createdEntry = {
        id: previewAnnouncement.id,
        title: previewAnnouncement.title,
        message: previewAnnouncement.message,
        target: previewAnnouncement.target,
        sendType: previewAnnouncement.sendType,
        status: previewAnnouncement.sendType === 'schedule' ? 'Scheduled' : 'Delivered',
        delivered: previewAnnouncement.sendType === 'schedule' ? 0 : 12450,
        read: previewAnnouncement.sendType === 'schedule' ? 0 : 9820,
        unread: previewAnnouncement.sendType === 'schedule' ? 0 : 2160,
        date: new Date().toLocaleString(),
        scheduleDate: previewAnnouncement.scheduleDate,
        scheduleTime: previewAnnouncement.scheduleTime
      };

      setAnnouncementLog(prev => [createdEntry, ...prev]);
    } catch (error) {
      console.error('Failed to send broadcast notification:', error);
      const offlineEntry = {
        id: previewAnnouncement.id,
        title: previewAnnouncement.title,
        message: previewAnnouncement.message,
        target: previewAnnouncement.target,
        sendType: previewAnnouncement.sendType,
        status: previewAnnouncement.sendType === 'schedule' ? 'Scheduled' : 'Delivered',
        delivered: previewAnnouncement.sendType === 'schedule' ? 0 : 12450,
        read: previewAnnouncement.sendType === 'schedule' ? 0 : 9820,
        unread: previewAnnouncement.sendType === 'schedule' ? 0 : 2160,
        date: new Date().toLocaleString(),
        scheduleDate: previewAnnouncement.scheduleDate,
        scheduleTime: previewAnnouncement.scheduleTime
      };
      setAnnouncementLog(prev => [offlineEntry, ...prev]);
      alert('The broadcast was queued locally because the server was unavailable. The record has been saved for later sync.');
    } finally {
      setAnnouncementForm({
        title: '',
        message: '',
        target: 'Everyone',
        sendType: 'now',
        scheduleDate: '',
        scheduleTime: ''
      });
      setPreviewAnnouncement(null);
      setShowPreviewModal(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    const payload = {
      marketplaceName: generalSettings.marketplaceName,
      description: generalSettings.description,
      supportEmail: generalSettings.supportEmail,
      currency: generalSettings.currency,
      timezone: generalSettings.timezone,
      maxImageSize: productSettings.maxImageSize,
      maxImagesPerProduct: productSettings.maxImagesPerProduct,
      requireApproval: productSettings.requireApproval,
      allowEditing: productSettings.allowEditing,
      autoHideSold: productSettings.autoHideSold,
      recommendationEngine: aiSettings.recommendationEngine,
      numRecommendations: aiSettings.numRecommendations,
      minSimilarityScore: aiSettings.minSimilarityScore,
      enableAI: aiSettings.enableAI,
      paymentProvider: paymentSettings.paymentProvider,
      enableOnlinePayment: paymentSettings.enableOnlinePayment,
      paymentVerification: paymentSettings.paymentVerification,
      refundsEnabled: paymentSettings.refundsEnabled,
      emailNotifs: notificationSettings.emailNotifs,
      orderNotifs: notificationSettings.orderNotifs,
      messageNotifs: notificationSettings.messageNotifs,
      approvalNotifs: notificationSettings.approvalNotifs,
      paymentNotifs: notificationSettings.paymentNotifs,
      announcementNotifs: notificationSettings.announcementNotifs,
      requireStudentVerification: securitySettings.requireStudentVerification,
      admin2FA: securitySettings.admin2FA,
      maxLoginAttempts: securitySettings.maxLoginAttempts,
      sessionTimeout: securitySettings.sessionTimeout,
      minPasswordLength: securitySettings.minPasswordLength,
      auditLogging: securitySettings.auditLogging,
      allowedEmailDomain: studentVerificationSettings.allowedEmailDomain,
      requireUniversityEmail: studentVerificationSettings.requireUniversityEmail,
      autoApproveStudents: studentVerificationSettings.autoApproveStudents,
      autoHideReported: moderationSettings.autoHideReported,
      requireAdminApproval: moderationSettings.requireAdminApproval,
      maxReportsBeforeReview: moderationSettings.maxReportsBeforeReview,
      allowStudentReports: moderationSettings.allowStudentReports,
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSettingsSaveMessage('System configurations saved successfully.');
      setAuditLogs(prev => [{
        id: Date.now(),
        action: 'System Settings Updated',
        actionType: 'Approvals',
        description: 'Admin updated platform configuration settings through the dashboard.',
        performed_by: 'admin.console',
        entity_type: 'Settings',
        entity_id: 1,
        ip_address: '127.0.0.1',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: 'success'
      }, ...prev]);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsSaveMessage('Could not reach the backend. Changes were not persisted.');
    }

    window.setTimeout(() => setSettingsSaveMessage(''), 3000);
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMsg('');

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileMsg('New password and confirm password do not match.');
      return;
    }

    if (profileForm.newPassword && !profileForm.currentPassword) {
      setProfileMsg('Please enter your current password before changing the password.');
      return;
    }

    setProfileLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profileForm.username,
          email: profileForm.email,
          current_password: profileForm.currentPassword,
          new_password: profileForm.newPassword,
          confirm_password: profileForm.confirmPassword,
          two_factor_enabled: profileForm.twoFactorEnabled,
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Profile update failed');
      }

      setAdminProfile((prev) => ({
        ...prev,
        username: profileForm.username || prev.username,
        email: profileForm.email || prev.email,
        status: 'Active',
      }));
      setProfileForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setProfileMsg('Profile updated successfully.');
      setAuditLogs((prev) => [{
        id: Date.now(),
        action: 'Admin Profile Updated',
        actionType: 'Logins',
        description: `Administrator ${profileForm.username} updated their account information and security settings.`,
        performed_by: profileForm.username,
        entity_type: 'Admin',
        entity_id: 1,
        ip_address: adminProfile.sessionIp || '192.168.10.24',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: 'success'
      }, ...prev]);
    } catch (error) {
      console.error('Profile update failed:', error);
      setProfileMsg(error.message || 'Unable to update profile right now.');
    } finally {
      setProfileLoading(false);
      window.setTimeout(() => setProfileMsg(''), 3000);
    }
  };

  const handleProfileAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('username', profileForm.username || adminProfile.username || 'mau9999');
    formData.append('image', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Avatar upload failed');
      }

      const avatarUrl = `${data.imageUrl || data.avatarUrl || 'http://127.0.0.1:8000/static/uploads/avatars/admin_mau9999.jpg'}?t=${Date.now()}`;
      setAdminProfile((prev) => ({ ...prev, avatarUrl }));
      setProfileMsg('Avatar uploaded successfully.');
      window.setTimeout(() => setProfileMsg(''), 2500);
    } catch (error) {
      console.error('Avatar upload failed:', error);
      setProfileMsg(error.message || 'Avatar upload failed.');
      window.setTimeout(() => setProfileMsg(''), 2500);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Security Access</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Admin Security Profile</h2>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Protected
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
                  <img
                    src="http://127.0.0.1:8000/static/uploads/avatars/mau9999.jpg"
                    alt="Admin avatar"
                    className="h-16 w-16 rounded-full border-4 border-emerald-200 object-cover shadow-md"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
                    }}
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Primary Account</p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">{profileForm.username || 'mau9999'}</h3>
                    <p className="text-sm text-slate-500">{adminProfile.role || 'Primary Super Admin'}</p>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Username</label>
                    <input
                      type="text"
                      value={profileForm.username || 'mau9999'}
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Admin Email</label>
                    <input
                      type="email"
                      value={profileForm.email || 'admin@campace.edu'}
                      onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current Password</label>
                      <input
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(e) => handleProfileFieldChange('currentPassword', e.target.value)}
                        placeholder="Enter current password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">New Password</label>
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) => handleProfileFieldChange('newPassword', e.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Confirm New Password</label>
                    <input
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(e) => handleProfileFieldChange('confirmPassword', e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {profileLoading ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>

                  {profileMsg && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      {profileMsg}
                    </div>
                  )}
                </form>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Session Analytics</h3>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Login</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">August 17, 2026 — 9:25 AM</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Local IP Address</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">127.0.0.1</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Role</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">Primary Super Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
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
                    <div key={i} className="space-y-1 text-xs font-semibold text-slate-700">
                      <div className="flex items-center justify-between">
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
          const name = u.name ?? '';
          const studentId = u.student_id ?? '';
          const email = u.email ?? '';
          const matchesSearch =
            name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            studentId.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            email.toLowerCase().includes(userSearchTerm.toLowerCase());

          const matchesCollege = userCollegeFilter ? (u.college ?? '') === userCollegeFilter : true;
          const matchesDept = userDeptFilter ? (u.department ?? '') === userDeptFilter : true;

          return matchesSearch && matchesCollege && matchesDept;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">User Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor student profiles, enforce restrictions, and verify academic IDs.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Students', value: userManagementStats.totalStudents.toLocaleString(), color: 'bg-sky-50 border-sky-200 text-sky-700' },
                { label: 'Active Sellers', value: userManagementStats.activeSellers.toLocaleString(), color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Active Buyers', value: userManagementStats.activeBuyers.toLocaleString(), color: 'bg-violet-50 border-violet-200 text-violet-700' },
                { label: 'Suspended Accounts', value: userManagementStats.suspendedAccounts.toLocaleString(), color: 'bg-amber-50 border-amber-200 text-amber-700' },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-[24px] border p-5 shadow-sm ${metric.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{metric.value}</p>
                </div>
              ))}
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
                          <div className="font-semibold text-slate-700">{(student.department ?? '').replace("Department of ", "")}</div>
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
                        <p className="text-sm font-bold text-slate-900 mt-1">{selectedUser.phone || 'Not available'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Verification</p>
                        <p className={`text-sm font-bold mt-1 ${selectedUser.is_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {selectedUser.is_verified ? 'Verified' : 'Pending'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Wallet Balance</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{Number(selectedUser.wallet_balance ?? 0).toLocaleString()} ETB</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Active Listings</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{selectedUser.active_listings ?? 0}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-xs text-slate-400">Activity Logs</h5>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {(selectedUser.activity ?? []).length > 0 ? (
                          (selectedUser.activity ?? []).map((act, i) => (
                            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border text-xs font-semibold">
                              <span className="text-slate-800">{act.action}</span>
                              <span className="text-slate-400">{act.time}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-slate-50 p-3 border text-xs font-semibold text-slate-500">No recent activity recorded.</div>
                        )}
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

            {showEnforcementModal && enforcementTarget && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Account Restriction</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{enforcementTarget.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnforcementModal(false);
                        setEnforcementTarget(null);
                        setEnforcementReason('Scam attempts');
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Reason</label>
                  <select
                    value={enforcementReason}
                    onChange={(e) => setEnforcementReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Scam attempts">Scam attempts</option>
                    <option value="Inappropriate listings">Inappropriate listings</option>
                    <option value="Policy violation">Policy violation</option>
                    <option value="Fraud investigation">Fraud investigation</option>
                    <option value="Other">Other</option>
                  </select>

                  {enforcementReason === 'Other' && (
                    <textarea
                      value={customEnforcementReason}
                      onChange={(e) => setCustomEnforcementReason(e.target.value)}
                      placeholder="Describe the restriction reason..."
                      className="mt-3 h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none transition resize-none"
                    />
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnforcementModal(false);
                        setEnforcementTarget(null);
                        setEnforcementReason('Scam attempts');
                        setCustomEnforcementReason('');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const finalReason = enforcementReason === 'Other' ? (customEnforcementReason.trim() || 'Other') : enforcementReason;
                        applyAccountStatusChange(enforcementTarget.id, enforcementTarget.status || 'Suspended', finalReason);
                      }}
                      className="flex-1 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600 transition shadow-sm"
                    >
                      Confirm Restriction
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'student-verification': {
        const departments = ['All', ...new Set(verifications.map(v => v.department).filter(Boolean))];
        const filteredVerifications = verifications.filter((verification) => {
          const matchesSearch =
            verification.name?.toLowerCase().includes(verificationSearchTerm.toLowerCase()) ||
            verification.student_id?.toLowerCase().includes(verificationSearchTerm.toLowerCase());
          const matchesDepartment = verificationFilterDept === 'All' || verification.department === verificationFilterDept;
          return matchesSearch && matchesDepartment;
        });
        const pendingVerifications = filteredVerifications.filter(v => v.status === 'Pending');
        const verifiedVerifications = filteredVerifications.filter(v => v.status === 'Verified');
        const rejectedVerifications = filteredVerifications.filter(v => v.status === 'Rejected');

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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Search student</label>
                  <input
                    type="text"
                    value={verificationSearchTerm}
                    onChange={(e) => setVerificationSearchTerm(e.target.value)}
                    placeholder="Search student name or ID..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Department</label>
                  <select
                    value={verificationFilterDept}
                    onChange={(e) => setVerificationFilterDept(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Pending Identity Verifications</h3>

              {pendingVerifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-semibold">
                  <span className="text-4xl">🎓</span>
                  <p className="mt-3">No pending verification requests match the current filters.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingVerifications.map((req) => (
                    <div key={req.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between transition hover:shadow-sm">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">{req.department}</div>
                        <h4 className="mt-1.5 text-lg font-bold text-slate-900">{req.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">ID: {req.student_id} • {req.email}</p>
                        <span className="inline-block mt-3 text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full border border-amber-100">Pending Review</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIDPhoto(req.uploaded_id_card);
                            setVerificationZoom(1);
                            setVerificationRotation(0);
                          }}
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
                          onClick={() => {
                            setSelectedVerificationRequest(req);
                            setVerificationRejectReason('Blurry Image');
                            setShowRejectReasonModal(true);
                          }}
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
                <div className="relative bg-white rounded-[28px] p-6 max-w-2xl w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <h4 className="text-lg font-bold text-slate-900">Student ID Card Preview</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIDPhoto(null);
                        setVerificationZoom(1);
                        setVerificationRotation(0);
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-4 flex items-center justify-center gap-2">
                    <button type="button" onClick={() => setVerificationZoom(prev => Math.max(1, Number((prev - 0.2).toFixed(1))))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">−</button>
                    <button type="button" onClick={() => setVerificationZoom(prev => Number((prev + 0.2).toFixed(1)))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">+</button>
                    <button type="button" onClick={() => setVerificationRotation(prev => (prev + 90) % 360)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Rotate</button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2 flex items-center justify-center h-[26rem] shadow-xs">
                    <img
                      src={selectedIDPhoto}
                      alt="Student ID Card"
                      className="max-h-full max-w-full rounded-xl object-contain border border-slate-200 transition-transform duration-200"
                      style={{ transform: `scale(${verificationZoom}) rotate(${verificationRotation}deg)` }}
                    />
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIDPhoto(null);
                        setVerificationZoom(1);
                        setVerificationRotation(0);
                      }}
                      className="flex-1 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showRejectReasonModal && selectedVerificationRequest && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reject Submission</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{selectedVerificationRequest.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectReasonModal(false);
                        setSelectedVerificationRequest(null);
                        setVerificationRejectReason('Blurry Image');
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Select or type a reason</label>
                  <select
                    value={verificationRejectReason}
                    onChange={(e) => setVerificationRejectReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Blurry Image">Blurry Image</option>
                    <option value="Expired ID">Expired ID</option>
                    <option value="Name Mismatch">Name Mismatch</option>
                    <option value="Incorrect Department">Incorrect Department</option>
                    <option value="Incomplete Documentation">Incomplete Documentation</option>
                    <option value="Other">Other</option>
                  </select>

                  {verificationRejectReason === 'Other' && (
                    <textarea
                      value={verificationRejectReason === 'Other' ? '' : verificationRejectReason}
                      onChange={(e) => setVerificationRejectReason(e.target.value)}
                      placeholder="Explain the rejection reason..."
                      className="mt-3 h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none transition resize-none"
                    />
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectReasonModal(false);
                        setSelectedVerificationRequest(null);
                        setVerificationRejectReason('Blurry Image');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyAction(selectedVerificationRequest.id, 'Rejected', verificationRejectReason)}
                      className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 transition shadow-sm"
                    >
                      Submit Rejection
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'product-management': {
        const productCategories = ['All', ...new Set(productsList.map(product => product.category).filter(Boolean))];
        const filteredProds = productsList.filter(product => {
          const matchesSearch =
            product.title?.toLowerCase().includes(prodSearch.toLowerCase()) ||
            product.seller?.toLowerCase().includes(prodSearch.toLowerCase()) ||
            product.seller_id?.toLowerCase().includes(prodSearch.toLowerCase());
          const matchesStatus = prodStatusFilter ? product.status === prodStatusFilter : true;
          const matchesCategory = productCategoryFilter === 'All' || product.category === productCategoryFilter;
          return matchesSearch && matchesStatus && matchesCategory;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Product Moderation</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Curate the campus catalog, review listings, and enforce community standards.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Products', value: '12,450', tone: 'bg-sky-50 border-sky-200 text-sky-700' },
                { label: 'Approved', value: '11,820', tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Pending Review', value: '84', tone: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'Flagged', value: '43', tone: 'bg-rose-50 border-rose-200 text-rose-700' },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-[24px] border p-5 shadow-sm ${metric.tone}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Category</label>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  {productCategories.map(category => (
                    <option key={category} value={category}>{category === 'All' ? 'All Categories' : category}</option>
                  ))}
                </select>
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
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Product</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Seller ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Condition</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProds.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={product.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'}
                              alt={product.title}
                              className="h-14 w-14 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{product.title}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{product.category}</div>
                              <div className="text-xs text-emerald-600 mt-1 font-bold">{product.price}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">
                          <div>{product.seller_id || product.seller || 'Unknown Student'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{product.seller_verified ? 'Verified Seller' : 'Unverified'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                            {product.condition || 'New'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${product.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : product.status === 'Flagged' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {product.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedProductDetails(product)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(product)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
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

            {selectedProductDetails && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative bg-white rounded-[28px] p-6 max-w-2xl w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Product Preview</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{selectedProductDetails.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProductDetails(null)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2">
                      <img
                        src={selectedProductDetails.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'}
                        alt={selectedProductDetails.title}
                        className="h-72 w-full rounded-xl object-cover"
                      />
                    </div>

                    <div className="space-y-4 text-sm">
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Price</p>
                        <p className="mt-1 text-xl font-black text-emerald-600">{selectedProductDetails.price}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Condition</p>
                        <p className="mt-1 text-base font-bold text-slate-900">{selectedProductDetails.condition || 'New'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Seller Verification</p>
                        <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedProductDetails.seller_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedProductDetails.seller_verified ? 'Verified' : 'Pending Review'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Complete Description</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedProductDetails.description || 'No description provided.'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProductDetails(null)}
                    className="w-full mt-6 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            )}

            {showRejectModal && pendingRejectProduct && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Flag Listing</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{pendingRejectProduct.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectModal(false);
                        setPendingRejectProduct(null);
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Choose a reason</label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Inappropriate Image">Inappropriate Image</option>
                    <option value="Incorrect Pricing">Incorrect Pricing</option>
                    <option value="Misleading Description">Misleading Description</option>
                    <option value="Duplicate Listing">Duplicate Listing</option>
                    <option value="Fraudulent / Scam">Fraudulent / Scam</option>
                    <option value="Policy Violation">Policy Violation</option>
                  </select>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectModal(false);
                        setPendingRejectProduct(null);
                        setRejectReason('Inappropriate Image');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitProductFlag}
                      className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 transition cursor-pointer"
                    >
                      Submit Flag
                    </button>
                  </div>
                </div>
              </div>
            )}
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

            <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">

              {/* Left Column: Active Categories with Nested Subcategories */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Marketplace Directories</h3>
                <div className="space-y-4">
                  {categoriesList.map((cat) => (
                    <div key={cat.id} className="rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 space-y-3">
                      {/* Main Category Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cat.icon || '📁'}</span>
                          <div>
                            <div className="font-bold text-slate-900">{cat.name}</div>
                            <div className="text-xs text-slate-400">{cat.ads}</div>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${cat.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                          {cat.status}
                        </span>
                      </div>

                      {/* Nested Subcategories */}
                      {cat.subcategories && cat.subcategories.length > 0 && (
                        <div className="ml-8 space-y-2 border-l-2 border-slate-200 pl-4">
                          {cat.subcategories.map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{sub.icon || '📂'}</span>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">{sub.name}</div>
                                  <div className="text-xs text-slate-400">{sub.ads}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!cat.subcategories || cat.subcategories.length === 0) && (
                        <div className="ml-8 text-xs text-slate-400 italic py-2">No subcategories yet</div>
                      )}
                    </div>
                  ))}
                  {categoriesList.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No categories yet. Create one using the form on the right.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Forms for Creating Categories & Subcategories */}
              <div className="space-y-4">

                {/* Status Message */}
                {catMsg && (
                  <div className={`rounded-2xl p-4 text-sm font-semibold ${catMsg.includes('success')
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                    {catMsg}
                  </div>
                )}

                {/* Create Main Category Form */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Create Main Category</h3>
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
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Icon (Emoji)</label>
                      <input
                        type="text"
                        placeholder="e.g. 📁"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        maxLength={3}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-emerald-500 py-3 font-bold text-white hover:bg-emerald-600 transition shadow-md cursor-pointer"
                    >
                      ✓ Add Category
                    </button>
                  </form>
                </div>

                {/* Create Subcategory Form */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Create Subcategory</h3>
                  <form onSubmit={handleAddSubcategory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Parent Category</label>
                      <select
                        required
                        value={newSubParentId}
                        onChange={(e) => setNewSubParentId(e.target.value)}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition cursor-pointer"
                      >
                        <option value="">Select a category...</option>
                        {categoriesList.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Subcategory Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Microscopes"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-blue-500 py-3 font-bold text-white hover:bg-blue-600 transition shadow-md cursor-pointer"
                    >
                      ✓ Add Subcategory
                    </button>
                  </form>
                </div>

              </div>

            </div>

          </div>
        );
      case 'orders': {
        const filteredOrders = ordersList.filter((order) => {
          const query = orderSearch.toLowerCase();
          const matchesSearch = !query ||
            order.id.toLowerCase().includes(query) ||
            (order.buyer_id || order.buyer || '').toLowerCase().includes(query) ||
            (order.seller_id || order.seller || '').toLowerCase().includes(query) ||
            (order.product_title || order.item || '').toLowerCase().includes(query);

          const matchesStatus = orderFilterStatus === 'All' || order.order_status === orderFilterStatus;
          const matchesPayment = orderFilterPayment === 'All' || order.payment_status === orderFilterPayment;

          return matchesSearch && matchesStatus && matchesPayment;
        });

        const orderMetrics = {
          totalOrders: 1248,
          processing: 32,
          completed: 1180,
          cancelled: 36,
          totalSales: '2,450,000 ETB'
        };

        const getOrderStatusBadge = (status) => {
          if (status === 'Completed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          if (status === 'Pending' || status === 'Processing') return 'bg-amber-100 text-amber-700 border border-amber-200';
          if (status === 'Cancelled' || status === 'Returned') return 'bg-rose-100 text-rose-700 border border-rose-200';
          if (status === 'Ready for Pickup') return 'bg-sky-100 text-sky-700 border border-sky-200';
          if (status === 'Out for Delivery') return 'bg-violet-100 text-violet-700 border border-violet-200';
          return 'bg-slate-100 text-slate-600 border border-slate-200';
        };

        const getPaymentStatusBadge = (status) => {
          if (status === 'Successful') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          if (status === 'Pending') return 'bg-amber-100 text-amber-700 border border-amber-200';
          if (status === 'Failed') return 'bg-red-100 text-red-700 border border-red-200';
          if (status === 'Refunded') return 'bg-slate-100 text-slate-700 border border-slate-200';
          return 'bg-sky-100 text-sky-700 border border-sky-200';
        };

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Order Operations Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-300">Track student orders, fulfillment progress, payment confirmation, and pickup logistics across the marketplace.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200">
                  <span>💰</span>
                  <span>{orderMetrics.totalSales}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-100/70 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{orderMetrics.totalOrders.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Processing / Pending</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{orderMetrics.processing.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Completed</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{orderMetrics.completed.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">Cancelled</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{orderMetrics.cancelled.toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-lg font-black text-slate-950">
                Total Sales: <span className="text-sky-700">{orderMetrics.totalSales}</span>
              </p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search Order ID / Student ID..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={orderFilterStatus}
                  onChange={(e) => setOrderFilterStatus(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Order Status: All</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready for Pickup">Ready for Pickup</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Returned">Returned</option>
                </select>

                <select
                  value={orderFilterPayment}
                  onChange={(e) => setOrderFilterPayment(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Payment Status: All</option>
                  <option value="Pending">Pending</option>
                  <option value="Successful">Successful</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Buyer & Seller IDs</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Product Title</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Total Amount</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{order.id}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setSelectedOrderDetails(order)} className="text-left text-sm font-semibold text-sky-700 underline-offset-2 hover:underline">{order.buyer_id || order.buyer}</button>
                            <button type="button" onClick={() => setSelectedOrderDetails(order)} className="text-left text-xs text-slate-500 underline-offset-2 hover:underline">{order.seller_id || order.seller}</button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">{order.product_title || order.item}</div>
                          <div className="mt-1 text-xs text-slate-500">{new Date(order.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-4 font-black text-slate-950">{order.price || `${Number(order.total_amount ?? 0).toLocaleString('en-ET')} ETB`}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getOrderStatusBadge(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStatusBadge(order.payment_status || order.pay_status)}`}>
                            {order.payment_status || order.pay_status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredOrders.length === 0 && (
                <div className="mt-6 text-center text-slate-500">
                  <p className="font-semibold">No orders match the selected filters.</p>
                </div>
              )}
            </div>

            {selectedOrderDetails && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">Order Details</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedOrderDetails.id}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetails(null)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Buyer</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.buyer_id || selectedOrderDetails.buyer}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.seller_id || selectedOrderDetails.seller}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.product_title || selectedOrderDetails.item}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Price</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.price || `${Number(selectedOrderDetails.total_amount ?? 0).toLocaleString('en-ET')} ETB`}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Date(selectedOrderDetails.date).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Pickup Location</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.pickup_location || 'Main Library'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.payment_status || selectedOrderDetails.pay_status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Fulfillment Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.order_status}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Update Order Status</label>
                      <select
                        value={selectedOrderDetails.order_status}
                        onChange={(e) => setSelectedOrderDetails({ ...selectedOrderDetails, order_status: e.target.value })}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Ready for Pickup">Ready for Pickup</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Returned">Returned</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Update Payment Status</label>
                      <select
                        value={selectedOrderDetails.payment_status || selectedOrderDetails.pay_status}
                        onChange={(e) => setSelectedOrderDetails({ ...selectedOrderDetails, payment_status: e.target.value })}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Successful">Successful</option>
                        <option value="Failed">Failed</option>
                        <option value="Refunded">Refunded</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetails(null)}
                      className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderUpdate(selectedOrderDetails.id, selectedOrderDetails.order_status, selectedOrderDetails.payment_status || selectedOrderDetails.pay_status)}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'payments':
        const filteredPayments = paymentsList.filter((payment) => {
          const searchMatch = !paymentSearchTerm ||
            payment.transaction_id.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
            payment.buyer_id.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
            payment.seller_id.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
            payment.order_id.toLowerCase().includes(paymentSearchTerm.toLowerCase());

          const statusMatch = paymentStatusFilter === 'All' || payment.status === paymentStatusFilter;
          const typeMatch = paymentTypeFilter === 'All' || payment.payment_type === paymentTypeFilter;

          return searchMatch && statusMatch && typeMatch;
        });

        const paymentMetrics = {
          totalTransactions: 1245,
          successful: 1180,
          pending: 45,
          failed: 20,
          totalRevenue: '2,450,000 ETB'
        };

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <h2 className="text-2xl font-black">Payment Operations Dashboard</h2>
              <p className="mt-1 text-sm text-slate-300">Monitor digital payments, payout flows, wallet loads, refunds, and operational risk across the marketplace.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-100/70 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Transactions</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{paymentMetrics.totalTransactions.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Successful</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{paymentMetrics.successful.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Pending</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{paymentMetrics.pending.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-red-100 bg-red-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700">Failed</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{paymentMetrics.failed.toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-lg font-black text-slate-950">
                Total Revenue: <span className="text-sky-700">{paymentMetrics.totalRevenue}</span>
              </p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Transaction Registry</h3>
                  <p className="text-sm text-slate-500">Search and filter the latest marketplace payment records.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Export CSV</button>
                  <button type="button" className="rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800">Export PDF</button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={paymentSearchTerm}
                  onChange={(e) => setPaymentSearchTerm(e.target.value)}
                  placeholder="Search Transaction ID..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Status: All</option>
                  <option value="Successful">Successful</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>

                <select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Payment Type: All</option>
                  <option value="Product Purchase">Product Purchase</option>
                  <option value="Wallet Deposit">Wallet Deposit</option>
                  <option value="Seller Payout">Seller Payout</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Transaction ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Buyer ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Seller ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Amount</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Type</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Method</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Date</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{payment.transaction_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{payment.buyer_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{payment.seller_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{payment.order_id}</td>
                        <td className="px-4 py-4 font-black text-slate-950">{new Intl.NumberFormat('en-ET').format(payment.amount)} ETB</td>
                        <td className="px-4 py-4 text-slate-700">{payment.payment_type}</td>
                        <td className="px-4 py-4 text-slate-700">{payment.payment_method}</td>
                        <td className="px-4 py-4">
                          {payment.status === 'Successful' ? (
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
                              <span>🔒</span>
                              <span>Successful</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <select
                                value={payment.status}
                                onChange={(e) => handlePaymentStatusUpdate(payment.id, e.target.value)}
                                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-sky-500 focus:outline-none"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Failed">Failed</option>
                                <option value="Successful">Successful</option>
                              </select>
                              {paymentStatusMessageId === payment.id && paymentStatusMessage && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                  ⚠️ {paymentStatusMessage}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{new Date(payment.date).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentDetail(payment)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredPayments.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                  <p className="text-base font-bold">No matching transactions found.</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" onClick={() => alert('CSV export is ready for download.')} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800">Export CSV</button>
              <button type="button" onClick={() => alert('PDF export is ready for download.')} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Export PDF</button>
            </div>

            {selectedPaymentDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sky-600">Transaction Detail</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedPaymentDetail.transaction_id}</h3>
                    </div>
                    <button type="button" onClick={() => setSelectedPaymentDetail(null)} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600">✕</button>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Transaction ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.transaction_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Buyer</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.buyer_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.seller_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Order ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.order_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Amount</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Intl.NumberFormat('en-ET').format(selectedPaymentDetail.amount)} ETB</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Method</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.payment_method}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Date(selectedPaymentDetail.date).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Type</p>
                    <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.payment_type}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'reports': {
        const filteredReports = reportsList.filter((report) => {
          const searchValue = reportSearchTerm.toLowerCase();
          const matchesSearch = !searchValue ||
            report.report_id.toLowerCase().includes(searchValue) ||
            report.student.toLowerCase().includes(searchValue) ||
            report.product_name.toLowerCase().includes(searchValue) ||
            report.issue.toLowerCase().includes(searchValue) ||
            report.complaint_type.toLowerCase().includes(searchValue);

          const matchesType = reportTypeFilter === 'All' || report.complaint_type === reportTypeFilter;
          const matchesStatus = reportStatusFilter === 'All' || report.status === reportStatusFilter;
          const matchesPriority = reportPriorityFilter === 'All' || report.priority === reportPriorityFilter;

          return matchesSearch && matchesType && matchesStatus && matchesPriority;
        });

        const reportStats = {
          total: 42,
          open: 12,
          underReview: 8,
          resolved: 22,
          highPriority: 3,
        };

        const getPriorityBadge = (priority) => {
          if (priority === 'Low') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          if (priority === 'Medium') return 'bg-amber-100 text-amber-700 border border-amber-200';
          return 'bg-rose-100 text-rose-700 border border-rose-200';
        };

        const getStatusBadge = (status) => {
          if (status === 'Open') return 'bg-sky-100 text-sky-700 border border-sky-200';
          if (status === 'Review') return 'bg-violet-100 text-violet-700 border border-violet-200';
          if (status === 'Resolved' || status === 'Closed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          return 'bg-slate-100 text-slate-600 border border-slate-200';
        };

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Reports & Complaints Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-300">Monitor marketplace disputes, fraud, content violations, and moderation outcomes for final-year project defense.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
                  <span>🚨</span>
                  <span>High Priority: {reportStats.highPriority}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-100/70 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{reportStats.total}</p>
              </div>
              <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Open Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{reportStats.open}</p>
              </div>
              <div className="rounded-[24px] border border-violet-100 bg-violet-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">Under Review</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{reportStats.underReview}</p>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Resolved Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{reportStats.resolved}</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  type="text"
                  value={reportSearchTerm}
                  onChange={(e) => setReportSearchTerm(e.target.value)}
                  placeholder="Search report/student..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={reportTypeFilter}
                  onChange={(e) => setReportTypeFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Complaint Type: All</option>
                  <option value="Product Issue">Product Issue</option>
                  <option value="Fraud/Scam">Fraud/Scam</option>
                  <option value="Seller Misconduct">Seller Misconduct</option>
                  <option value="Buyer Misconduct">Buyer Misconduct</option>
                  <option value="Payment Problem">Payment Problem</option>
                  <option value="Order Problem">Order Problem</option>
                  <option value="Fake Product">Fake Product</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Status: All</option>
                  <option value="Open">Open</option>
                  <option value="Review">Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>

                <select
                  value={reportPriorityFilter}
                  onChange={(e) => setReportPriorityFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Priority: All</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Report ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Type</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Issue / Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Reporter</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Priority</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Date</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((rep) => (
                      <tr key={rep.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{rep.report_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{rep.complaint_type}</td>
                        <td className="px-4 py-4 text-slate-700 max-w-md">
                          <div className="font-semibold text-slate-900">{rep.product_name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{rep.issue}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-600">
                          <div className="text-sm font-semibold text-slate-900">{rep.student}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{rep.student_id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${getPriorityBadge(rep.priority)}`}>
                            {rep.priority === 'Low' && '🟢'}
                            {rep.priority === 'Medium' && '🟡'}
                            {rep.priority === 'High' && '🔴'}
                            {rep.priority}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(rep.status)}`}>
                            {rep.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{new Date(rep.date).toLocaleDateString()}</td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenReportModal(rep)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredReports.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="font-semibold">No reports match the selected filters.</p>
                </div>
              )}
            </div>

            {selectedReport && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">Report Resolution</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedReport.report_id}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedReport(null); setShowReportModal(false); }}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Complaint Type</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.complaint_type}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Priority</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.priority}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reporter</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.student}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Student ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.student_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reported Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.seller_name || selectedReport.seller_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.product_name}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 md:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Issue Detail</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedReport.issue}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Date(selectedReport.date).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" onClick={() => alert('Evidence photo opened in a new panel.')} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100">View Evidence Photo</button>
                    <button type="button" onClick={() => alert('Conversation logs opened for the reported case.')} className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">View Conversation Logs</button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Admin Decision</label>
                    <select
                      value={reportDecision}
                      onChange={(e) => setReportDecision(e.target.value)}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="Warning">Warning</option>
                      <option value="Remove Product">Remove Product</option>
                      <option value="Suspend User">Suspend User</option>
                      <option value="Refund">Refund</option>
                      <option value="Reject">Reject</option>
                    </select>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedReport(null); setShowReportModal(false); }}
                      className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveReport(selectedReport.id, reportDecision)}
                      disabled={reportActionLoading}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {reportActionLoading ? 'Resolving...' : 'Resolve'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'ai-recommendations':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-indigo-200">AI Recommendation Dashboard</p>
                  <h2 className="mt-2 text-3xl font-black">Final-Year Project Defense</h2>
                </div>
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Model • Active
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Requests', value: '18,420', accent: 'bg-slate-100 border-slate-200 text-slate-950', small: 'text-slate-500' },
                { label: 'Clicks', value: '7,820', accent: 'bg-sky-50 border-sky-100 text-slate-950', small: 'text-sky-600' },
                { label: 'CTR', value: '42.4%', accent: 'bg-emerald-50 border-emerald-100 text-emerald-600', small: 'text-emerald-600' },
                { label: 'Purchase Conversion', value: '1,460', accent: 'bg-violet-50 border-violet-100 text-violet-700', small: 'text-violet-600' }
              ].map((item) => (
                <div key={item.label} className={`rounded-[24px] border p-5 shadow-sm ${item.accent}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.small}`}>{item.label}</p>
                  <p className="mt-4 text-3xl font-black">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Weekly Performance</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Requests vs Clicks</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Requests</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Clicks</span>
                  </div>
                </div>

                <svg viewBox="0 0 640 250" className="h-64 w-full">
                  <defs>
                    <linearGradient id="requestsFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="clicksFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="20" x2="620" y1={30 + line * 46} y2={30 + line * 46} stroke="#e2e8f0" strokeDasharray="4 8" />
                  ))}

                  <path d="M20 180 C110 170, 150 140, 210 150 S330 80, 390 110 S520 60, 620 40 L620 220 L20 220 Z" fill="url(#requestsFill)" opacity="0.85" />
                  <path d="M20 195 C110 178, 155 160, 214 165 S328 128, 390 146 S520 105, 620 90 L620 220 L20 220 Z" fill="url(#clicksFill)" opacity="0.8" />

                  <path d="M20 180 C110 170, 150 140, 210 150 S330 80, 390 110 S520 60, 620 40" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
                  <path d="M20 195 C110 178, 155 160, 214 165 S328 128, 390 146 S520 105, 620 90" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />

                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => (
                    <g key={label}>
                      <circle cx={20 + index * 86} cy={index === 0 ? 180 : index === 1 ? 170 : index === 2 ? 140 : index === 3 ? 150 : index === 4 ? 110 : index === 5 ? 60 : 40} r="4" fill={index % 2 === 0 ? '#4f46e5' : '#38bdf8'} />
                      <text x={20 + index * 86} y="235" fill="#64748b" fontSize="12" textAnchor="middle">{label}</text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">AI Recommendation Model</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Configuration</h3>

                <div className="mt-5 space-y-3">
                  {[
                    ['Algorithm', 'Content-Based Filtering'],
                    ['Text Vectorization', 'TF-IDF'],
                    ['Similarity Metric', 'Cosine Similarity'],
                    ['Output Limit', '10 Recommended Products'],
                    ['Features Analyzed', 'Titles, Category, Description, User Behavior']
                  ].map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{key}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  The system analyzes product titles, descriptions, categories, and user interactions to recommend products that are similar to the student's interests and browsing behavior.
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Top Recommendations</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Top Recommended Products</h3>
                  </div>
                  <button type="button" className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                    Updated 2h ago
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Views</th>
                        <th className="px-4 py-3">Clicks</th>
                        <th className="px-4 py-3">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Dell XPS 15 Laptop', '9,420', '2,420', '26.4%'],
                        ['Chemistry Lab Kit', '7,860', '1,980', '21.7%'],
                        ['Engineering Calculus Book', '6,310', '1,520', '19.9%'],
                        ['USB-C Type C Dock', '5,880', '1,340', '18.8%'],
                        ['Wireless Mechanical Mouse', '4,760', '1,120', '16.2%']
                      ].map(([product, views, clicks, conversion]) => (
                        <tr key={product} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-3 font-semibold text-slate-800">{product}</td>
                          <td className="px-4 py-3 text-slate-600">{views}</td>
                          <td className="px-4 py-3 text-slate-600">{clicks}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{conversion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Category Insights</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Category Recommendation Performance</h3>

                <div className="mt-5 space-y-5">
                  {[
                    ['Electronics', 88, 'bg-indigo-500'],
                    ['Books & Materials', 76, 'bg-emerald-500'],
                    ['Lab Equipment', 71, 'bg-sky-500'],
                    ['Accessories', 62, 'bg-violet-500'],
                    ['Stationery', 54, 'bg-amber-500']
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{label}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Model Health</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Status & Performance Accuracies</h3>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">DB Records</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">142k</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">User Profiles</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">18.4k</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Products Indexed</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">9.6k</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Precision@5</div>
                    <div className="mt-2 text-3xl font-black text-emerald-700">87.2%</div>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Recall@5</div>
                    <div className="mt-2 text-3xl font-black text-sky-700">81.4%</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Diagnostics</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Alerts</h3>

                <div className="mt-5 space-y-3">
                  {[
                    { type: 'success', title: 'Recommendation freshness', text: 'Model updated successfully with the latest product catalog and clickstream data.', badge: 'Stable' },
                    { type: 'warning', title: 'Low confidence cluster', text: 'Electronics subcategory still needs more behavioral signals for better ranking.', badge: 'Check' },
                    { type: 'info', title: 'Search relevance boosted', text: 'Cross-sell recommendations improved after the latest category weighting update.', badge: 'Improved' }
                  ].map((alert) => (
                    <div key={alert.title} className={`rounded-2xl border p-4 ${alert.type === 'success' ? 'border-emerald-200 bg-emerald-50' : alert.type === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${alert.type === 'success' ? 'bg-emerald-500' : alert.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                          <span className="text-sm font-bold text-slate-800">{alert.title}</span>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${alert.type === 'success' ? 'bg-emerald-100 text-emerald-700' : alert.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                          {alert.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{alert.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#111c3a] to-[#172554] p-6 text-white shadow-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-300">Marketplace Analytics</p>
                  <h2 className="mt-2 text-3xl font-black">Academic Performance Dashboard</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Metrics
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {analyticsSummaryCards.map((item) => (
                <div key={item.label} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">{item.trend}</span>
                  </div>
                  <p className="mt-4 text-3xl font-black text-slate-950">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Up trending
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Sales Overview</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Sales & Revenue</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                    {['7 Days', '30 Days', 'This Year'].map((period, index) => (
                      <button
                        key={period}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${index === 0 ? 'bg-[#111c3a] text-white' : 'text-slate-600'}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                <svg viewBox="0 0 640 260" className="h-64 w-full">
                  <defs>
                    <linearGradient id="salesBg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="30" x2="610" y1={30 + line * 46} y2={30 + line * 46} stroke="#e2e8f0" strokeDasharray="4 8" />
                  ))}

                  <path d="M30 210 C90 185, 140 150, 180 165 S260 120, 310 135 S400 80, 450 95 S510 60, 610 40 L610 235 L30 235 Z" fill="url(#salesBg)" opacity="0.7" />
                  <path d="M30 210 C90 185, 140 150, 180 165 S260 120, 310 135 S400 80, 450 95 S510 60, 610 40" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />

                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((label, index) => (
                    <g key={label}>
                      <circle cx={30 + index * 82} cy={[210, 185, 150, 165, 120, 135, 40][index]} r="4" fill="#4f46e5" />
                      <text x={30 + index * 82} y="245" fill="#64748b" fontSize="11" textAnchor="middle">{label}</text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Order Distribution</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Order Status</h3>

                <div className="mt-5 flex items-center justify-center">
                  <svg viewBox="0 0 220 220" className="h-52 w-52">
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#e2e8f0" strokeWidth="26" />
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#10b981" strokeWidth="26" strokeDasharray="154 198" strokeLinecap="round" strokeDashoffset="0" transform="rotate(-90 110 110)" />
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#f59e0b" strokeWidth="26" strokeDasharray="84 268" strokeLinecap="round" strokeDashoffset="-154" transform="rotate(-90 110 110)" />
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#3b82f6" strokeWidth="26" strokeDasharray="52 300" strokeLinecap="round" strokeDashoffset="-238" transform="rotate(-90 110 110)" />
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#ef4444" strokeWidth="26" strokeDasharray="23 329" strokeLinecap="round" strokeDashoffset="-290" transform="rotate(-90 110 110)" />
                    <text x="110" y="108" textAnchor="middle" className="fill-slate-900 text-4xl font-black">8.9K</text>
                    <text x="110" y="128" textAnchor="middle" className="fill-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Orders</text>
                  </svg>
                </div>

                <div className="mt-5 space-y-2">
                  {analyticsOrderStatus.map((status) => (
                    <div key={status.label} className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color ?? '#64748b' }} />
                        {status.label}
                      </div>
                      <span>{typeof status.value === 'number' ? `${status.value}%` : status.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Student Growth</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">New Student Registrations</h3>

                <svg viewBox="0 0 640 220" className="mt-4 h-56 w-full">
                  <defs>
                    <linearGradient id="regBg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <line key={index} x1="20" x2="610" y1={25 + index * 40} y2={25 + index * 40} stroke="#e2e8f0" strokeDasharray="4 8" />
                  ))}
                  <path d="M20 170 C80 150, 110 140, 160 120 S260 85, 320 100 S420 50, 480 75 S560 30, 610 40 L610 200 L20 200 Z" fill="url(#regBg)" />
                  <path d="M20 170 C80 150, 110 140, 160 120 S260 85, 320 100 S420 50, 480 75 S560 30, 610 40" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" />

                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((label, index) => (
                    <g key={label}>
                      <circle cx={20 + index * 82} cy={[170, 150, 140, 120, 100, 75, 40][index]} r="4" fill="#0ea5e9" />
                      <text x={20 + index * 82} y="210" textAnchor="middle" fill="#64748b" fontSize="11">{label}</text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Performance</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Category Performance</h3>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Views</th>
                        <th className="px-3 py-3">Likes</th>
                        <th className="px-3 py-3">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.categories.map((category) => (
                        <tr key={category.name} className="border-t border-slate-200 bg-white">
                          <td className="px-3 py-3 font-semibold text-slate-800">{category.name}</td>
                          <td className="px-3 py-3 text-slate-600">{category.views}</td>
                          <td className="px-3 py-3 text-slate-600">{category.likes}</td>
                          <td className="px-3 py-3 font-bold text-emerald-600">{category.sales}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">User Distribution</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Marketplace Activity by Department</h3>

                <div className="mt-5 space-y-5">
                  {analyticsData.departmentActivity.map((department) => (
                    <div key={department.name}>
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{department.name}</span>
                        <span>{department.value}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${department.color}`} style={{ width: `${department.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#111c3a] to-indigo-950 p-5 text-white shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-200">AI Recommendation Summary</p>
                <h3 className="mt-1 text-xl font-black">Performance Overview</h3>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Recommendation Accuracy</div>
                    <div className="mt-2 text-3xl font-black text-emerald-300">87.2%</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-300">CTR Improvement</div>
                    <div className="mt-2 text-3xl font-black text-sky-300">+19.6%</div>
                  </div>
                  <p className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-slate-200">
                    The recommendation engine continues to improve discovery quality by analyzing product content, category relevance, and browsing behavior on the campus marketplace.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-[#111c3a] p-5 text-white shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300">System Feed</p>
                  <h3 className="mt-1 text-xl font-black">Recent Marketplace Activity</h3>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {analyticsData.recentActivity.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div className="flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-white">{item.action}</p>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">{item.time}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{item.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'notifications':
        const filteredAnnouncements = announcementLog.filter((item) => {
          const searchQuery = notificationsSearch.trim().toLowerCase();
          const matchesSearch = !searchQuery ||
            item.title.toLowerCase().includes(searchQuery) ||
            item.message.toLowerCase().includes(searchQuery) ||
            item.target.toLowerCase().includes(searchQuery);
          const matchesFilter = notificationsFilter === 'All' || item.target === notificationsFilter;
          return matchesSearch && matchesFilter;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-600">Broadcast center</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Campus Notification Dashboard</h2>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
                  Live Campaigns
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Sent', value: '12,450', accent: 'bg-violet-50 text-violet-700', icon: '📣' },
                { label: 'Delivered', value: '11,980', accent: 'bg-emerald-50 text-emerald-700', icon: '✅' },
                { label: 'Read', value: '9,820', accent: 'bg-sky-50 text-sky-700', icon: '👁️' },
                { label: 'Unread', value: '2,160', accent: 'bg-amber-50 text-amber-700', icon: '🔔' }
              ].map((card) => (
                <div key={card.label} className={`rounded-[28px] border border-slate-200 p-5 shadow-sm ${card.accent}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                      <p className="mt-3 text-3xl font-black">{card.value}</p>
                    </div>
                    <div className="text-2xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr] items-start">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Archive</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Historical Announcements</h3>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={notificationsSearch}
                      onChange={(e) => setNotificationsSearch(e.target.value)}
                      placeholder="Search notifications"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                    />
                    <select
                      value={notificationsFilter}
                      onChange={(e) => setNotificationsFilter(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                    >
                      <option value="All">All</option>
                      <option value="Everyone">Everyone</option>
                      <option value="Buyers">Buyers</option>
                      <option value="Sellers">Sellers</option>
                      <option value="IT Department">IT Department</option>
                      <option value="Engineering Department">Engineering Department</option>
                      <option value="Medicine Department">Medicine Department</option>
                      <option value="Business Department">Business Department</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {filteredAnnouncements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No notifications match the current search or filter.
                    </div>
                  ) : (
                    filteredAnnouncements.map((log) => (
                      <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="max-w-[75%]">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-600">
                              <span>{log.target}</span>
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">{log.status}</span>
                            </div>
                            <h4 className="mt-2 text-base font-black text-slate-950">{log.title}</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{log.message}</p>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{log.date}</p>
                          </div>
                          <div className="flex gap-2 sm:flex-col">
                            <button
                              type="button"
                              onClick={() => setPreviewAnnouncement(log)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-violet-200 hover:text-violet-700"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(log.id)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Delivered</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.delivered.toLocaleString()}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Read</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.read.toLocaleString()}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Unread</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.unread.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-200 pb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Composer</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Compose Broadcast</h3>
                </div>

                <form onSubmit={handlePreviewAnnouncement} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Title</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="Final exam schedule update"
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Target</label>
                    <select
                      value={announcementForm.target}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, target: e.target.value })}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    >
                      <option value="Everyone">Everyone</option>
                      <option value="Buyers">Buyers</option>
                      <option value="Sellers">Sellers</option>
                      <option value="IT Department">IT Department</option>
                      <option value="Engineering Department">Engineering Department</option>
                      <option value="Medicine Department">Medicine Department</option>
                      <option value="Business Department">Business Department</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Message</label>
                    <textarea
                      rows="5"
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      placeholder="Write your announcement for the campus community..."
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Delivery</label>
                    <div className="mt-2 flex gap-4">
                      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          name="sendType"
                          checked={announcementForm.sendType === 'now'}
                          onChange={() => setAnnouncementForm({ ...announcementForm, sendType: 'now' })}
                        />
                        Send Now
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          name="sendType"
                          checked={announcementForm.sendType === 'schedule'}
                          onChange={() => setAnnouncementForm({ ...announcementForm, sendType: 'schedule' })}
                        />
                        Schedule
                      </label>
                    </div>
                  </div>

                  {announcementForm.sendType === 'schedule' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Date</label>
                        <input
                          type="date"
                          value={announcementForm.scheduleDate}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, scheduleDate: e.target.value })}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Time</label>
                        <input
                          type="time"
                          value={announcementForm.scheduleTime}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, scheduleTime: e.target.value })}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({
                        title: '',
                        message: '',
                        target: 'Everyone',
                        sendType: 'now',
                        scheduleDate: '',
                        scheduleTime: ''
                      })}
                      className="rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {showPreviewModal && previewAnnouncement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-600">Preview</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Notification Card</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(false)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                        {previewAnnouncement.target}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {previewAnnouncement.sendType === 'schedule' ? 'Scheduled' : 'Instant'}
                      </span>
                    </div>
                    <h4 className="mt-4 text-xl font-black text-slate-950">{previewAnnouncement.title}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{previewAnnouncement.message}</p>
                    {previewAnnouncement.sendType === 'schedule' && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs font-semibold text-slate-600">
                        Scheduled for {previewAnnouncement.scheduleDate} at {previewAnnouncement.scheduleTime}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(false)}
                      className="flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBroadcast}
                      className="flex-1 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      Confirm Send
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      case 'audit-logs':
        const filteredAuditLogs = auditLogs.filter((log) => {
          const matchesSearch = !auditLogSearch.trim() ||
            `${log.action} ${log.description} ${log.performed_by} ${log.entity_type} ${log.entity_id}`
              .toLowerCase()
              .includes(auditLogSearch.trim().toLowerCase());

          const matchesAction = auditLogFilterAction === 'All' || log.actionType === auditLogFilterAction;
          const matchesStatus = auditLogFilterStatus === 'All' || log.status === auditLogFilterStatus;

          return matchesSearch && matchesAction && matchesStatus;
        });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Security console</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Security & Action Audit Logs</h2>
                </div>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">
                  Defense ready
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Events', value: '2,450', accent: 'bg-slate-100 text-slate-800', icon: '📊' },
                { label: 'Logins', value: '820', accent: 'bg-sky-50 text-sky-700', icon: '🔐' },
                { label: 'Admin Actions', value: '1,420', accent: 'bg-violet-50 text-violet-700', icon: '🛡️' },
                { label: 'Security Alerts', value: '18', accent: 'bg-rose-50 text-rose-700', icon: '🚨' }
              ].map((card) => (
                <div key={card.label} className={`rounded-[28px] border border-slate-200 p-5 shadow-sm ${card.accent}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                      <p className="mt-3 text-3xl font-black">{card.value}</p>
                    </div>
                    <div className="text-2xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Activity stream</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Access & Enforcement Timeline</h3>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={auditLogSearch}
                    onChange={(e) => setAuditLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <select
                    value={auditLogFilterAction}
                    onChange={(e) => setAuditLogFilterAction(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="All">Action: All</option>
                    <option value="Logins">Logins</option>
                    <option value="Approvals">Approvals</option>
                    <option value="Suspensions">Suspensions</option>
                    <option value="Deletions">Deletions</option>
                  </select>
                  <select
                    value={auditLogFilterStatus}
                    onChange={(e) => setAuditLogFilterStatus(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="All">Status: All</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {filteredAuditLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    No audit logs match the current search and filters.
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const statusBadge =
                      log.severity === 'success'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : log.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200';

                    const indicator =
                      log.severity === 'success'
                        ? '✓'
                        : log.severity === 'warning'
                          ? '⚠️'
                          : '🔴';

                    return (
                      <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${statusBadge}`}>
                              {indicator}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${statusBadge}`}>
                                  {log.status}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{log.actionType}</span>
                              </div>
                              <p className="mt-2 text-base font-black text-slate-950">{log.action}</p>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{log.description}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 xl:flex-col">
                            <button
                              type="button"
                              onClick={() => setSelectedLogDetails(log)}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                            >
                              View Details
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Performed By</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{log.performed_by}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Entity</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{log.entity_type}: {log.entity_id}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date & Time</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{new Date(log.date_time).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => alert('CSV export is ready for download.')}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => alert('PDF export is ready for download.')}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Export PDF
              </button>
            </div>

            {selectedLogDetails && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Diagnostic</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Technical Log Details</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLogDetails(null)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      ['Action', selectedLogDetails.action],
                      ['Performed By', selectedLogDetails.performed_by],
                      ['Entity Type', selectedLogDetails.entity_type],
                      ['Entity ID', selectedLogDetails.entity_id],
                      ['IP Address', selectedLogDetails.ip_address],
                      ['Exact DateTime', new Date(selectedLogDetails.date_time).toLocaleString()],
                      ['Status', selectedLogDetails.status]
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
                        <span className="text-sm font-semibold text-slate-800 text-right">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedLogDetails(null)}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      case 'settings':
        const toggleCard = (label, checked, onChange) => (
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>{label}</span>
            <button
              type="button"
              onClick={onChange}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        );

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-600">Platform controls</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">System Configuration Dashboard</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Settings
                </span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">General</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Marketplace Name</label>
                    <input value={generalSettings.marketplaceName} onChange={(e) => setGeneralSettings({ ...generalSettings, marketplaceName: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Description</label>
                    <textarea rows="3" value={generalSettings.description} onChange={(e) => setGeneralSettings({ ...generalSettings, description: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Support Email</label>
                      <input value={generalSettings.supportEmail} onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Currency</label>
                      <select value={generalSettings.currency} onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option value="ETB">ETB</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Timezone</label>
                    <select value={generalSettings.timezone} onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
                      <option value="UTC">UTC</option>
                      <option value="Africa/Nairobi">Africa/Nairobi</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Product</h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Image Size</label>
                      <input value={productSettings.maxImageSize} onChange={(e) => setProductSettings({ ...productSettings, maxImageSize: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Images / Product</label>
                      <input type="number" value={productSettings.maxImagesPerProduct} onChange={(e) => setProductSettings({ ...productSettings, maxImagesPerProduct: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  {toggleCard('Require Approval', productSettings.requireApproval, () => setProductSettings({ ...productSettings, requireApproval: !productSettings.requireApproval }))}
                  {toggleCard('Allow Editing', productSettings.allowEditing, () => setProductSettings({ ...productSettings, allowEditing: !productSettings.allowEditing }))}
                  {toggleCard('Auto Hide Sold', productSettings.autoHideSold, () => setProductSettings({ ...productSettings, autoHideSold: !productSettings.autoHideSold }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">AI Recommendation</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recommendation Engine</label>
                    <select value={aiSettings.recommendationEngine} onChange={(e) => setAiSettings({ ...aiSettings, recommendationEngine: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option>Content-Based Filtering (TF-IDF)</option>
                      <option>Collaborative Filtering</option>
                      <option>Hybrid Recommendation</option>
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recommendations</label>
                      <input type="number" value={aiSettings.numRecommendations} onChange={(e) => setAiSettings({ ...aiSettings, numRecommendations: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Min Similarity Score</label>
                      <input type="number" step="0.01" value={aiSettings.minSimilarityScore} onChange={(e) => setAiSettings({ ...aiSettings, minSimilarityScore: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  {toggleCard('Enable AI', aiSettings.enableAI, () => setAiSettings({ ...aiSettings, enableAI: !aiSettings.enableAI }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Payment</h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Provider</label>
                      <select value={paymentSettings.paymentProvider} onChange={(e) => setPaymentSettings({ ...paymentSettings, paymentProvider: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option>Chapa</option>
                        <option>Telebirr</option>
                        <option>CBE Birr</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Currency</label>
                      <select value={paymentSettings.currency} onChange={(e) => setPaymentSettings({ ...paymentSettings, currency: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option value="ETB">ETB</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Verification</label>
                    <select value={paymentSettings.paymentVerification} onChange={(e) => setPaymentSettings({ ...paymentSettings, paymentVerification: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option>Automatic</option>
                      <option>Manual</option>
                    </select>
                  </div>
                  {toggleCard('Enable Online Payment', paymentSettings.enableOnlinePayment, () => setPaymentSettings({ ...paymentSettings, enableOnlinePayment: !paymentSettings.enableOnlinePayment }))}
                  {toggleCard('Refunds Enabled', paymentSettings.refundsEnabled, () => setPaymentSettings({ ...paymentSettings, refundsEnabled: !paymentSettings.refundsEnabled }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Notifications</h3>
                <div className="mt-4 space-y-3">
                  {toggleCard('Email Notifications', notificationSettings.emailNotifs, () => setNotificationSettings({ ...notificationSettings, emailNotifs: !notificationSettings.emailNotifs }))}
                  {toggleCard('Order Notifications', notificationSettings.orderNotifs, () => setNotificationSettings({ ...notificationSettings, orderNotifs: !notificationSettings.orderNotifs }))}
                  {toggleCard('Message Notifications', notificationSettings.messageNotifs, () => setNotificationSettings({ ...notificationSettings, messageNotifs: !notificationSettings.messageNotifs }))}
                  {toggleCard('Approval Notifications', notificationSettings.approvalNotifs, () => setNotificationSettings({ ...notificationSettings, approvalNotifs: !notificationSettings.approvalNotifs }))}
                  {toggleCard('Payment Notifications', notificationSettings.paymentNotifs, () => setNotificationSettings({ ...notificationSettings, paymentNotifs: !notificationSettings.paymentNotifs }))}
                  {toggleCard('Announcement Notifications', notificationSettings.announcementNotifs, () => setNotificationSettings({ ...notificationSettings, announcementNotifs: !notificationSettings.announcementNotifs }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Security</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Require Student Verification', securitySettings.requireStudentVerification, () => setSecuritySettings({ ...securitySettings, requireStudentVerification: !securitySettings.requireStudentVerification }))}
                  {toggleCard('Admin 2FA', securitySettings.admin2FA, () => setSecuritySettings({ ...securitySettings, admin2FA: !securitySettings.admin2FA }))}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Login Attempts</label>
                      <input type="number" value={securitySettings.maxLoginAttempts} onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Session Timeout (min)</label>
                      <input type="number" value={securitySettings.sessionTimeout} onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Min Password Length</label>
                      <input type="number" value={securitySettings.minPasswordLength} onChange={(e) => setSecuritySettings({ ...securitySettings, minPasswordLength: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Audit Logging</label>
                      <div className="mt-2">
                        {toggleCard('', securitySettings.auditLogging, () => setSecuritySettings({ ...securitySettings, auditLogging: !securitySettings.auditLogging }))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Student Verification</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Allowed Email Domain</label>
                    <input value={studentVerificationSettings.allowedEmailDomain} onChange={(e) => setStudentVerificationSettings({ ...studentVerificationSettings, allowedEmailDomain: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  {toggleCard('Require University Email', studentVerificationSettings.requireUniversityEmail, () => setStudentVerificationSettings({ ...studentVerificationSettings, requireUniversityEmail: !studentVerificationSettings.requireUniversityEmail }))}
                  {toggleCard('Auto Approve Students', studentVerificationSettings.autoApproveStudents, () => setStudentVerificationSettings({ ...studentVerificationSettings, autoApproveStudents: !studentVerificationSettings.autoApproveStudents }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Moderation</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Auto Hide Reported', moderationSettings.autoHideReported, () => setModerationSettings({ ...moderationSettings, autoHideReported: !moderationSettings.autoHideReported }))}
                  {toggleCard('Require Admin Approval', moderationSettings.requireAdminApproval, () => setModerationSettings({ ...moderationSettings, requireAdminApproval: !moderationSettings.requireAdminApproval }))}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Reports Before Review</label>
                    <input type="number" value={moderationSettings.maxReportsBeforeReview} onChange={(e) => setModerationSettings({ ...moderationSettings, maxReportsBeforeReview: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  {toggleCard('Allow Student Reports', moderationSettings.allowStudentReports, () => setModerationSettings({ ...moderationSettings, allowStudentReports: !moderationSettings.allowStudentReports }))}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Ready to apply?</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">These values will be persisted to the admin settings store and logged for review.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSystemSettings}
                  className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-600"
                >
                  Save System Configurations
                </button>
              </div>
              {settingsSaveMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {settingsSaveMessage}
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pt-16 lg:pt-0">
      <div className="flex min-h-screen flex-col gap-2 px-2 py-2 lg:h-[calc(100vh-80px)] lg:overflow-hidden lg:flex-row lg:px-4">
        {/* Dark Navy Collapsible Sidebar with Custom Scrollbar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#111c3a] p-6 text-white shadow-xl transition-all duration-300 ease-in-out
          lg:static lg:translate-x-0 lg:h-full lg:overflow-visible lg:shrink-0 lg:shadow-none lg:inset-auto lg:left-auto lg:inset-y-auto
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
        <main className="flex-1 lg:h-full lg:overflow-y-auto lg:pr-2">
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

      {showProfileModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-slate-700/60 bg-[#0f172a] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">Admin Profile</p>
                <h3 className="mt-2 text-2xl font-black text-white">Single Administrator Console</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-full border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1.1fr]">
              <div className="space-y-6 rounded-[28px] border border-slate-700 bg-slate-900/80 p-5 shadow-inner">
                <div className="flex items-center gap-4 border-b border-slate-700 pb-5">
                  <img
                    src={adminProfile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                    alt="Admin avatar"
                    className="h-20 w-20 rounded-full border-4 border-sky-400 object-cover shadow-lg shadow-sky-500/20"
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overview</p>
                    <h4 className="mt-2 text-2xl font-black text-white">{profileForm.username || adminProfile.username}</h4>
                    <p className="mt-1 text-sm text-slate-300">{profileForm.email || adminProfile.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</p>
                    <p className="mt-2 text-base font-bold text-white">{adminProfile.role}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                    <p className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      {adminProfile.status}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Last Login</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{new Date(adminProfile.last_login || new Date().toISOString()).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Actions</p>
                    <p className="mt-2 text-2xl font-black text-white">{adminProfile.total_actions || auditLogs.length || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Two-Factor Authentication</p>
                    <button
                      type="button"
                      onClick={() => handleProfileFieldChange('twoFactorEnabled', !profileForm.twoFactorEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${profileForm.twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${profileForm.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-300">Security status: {profileForm.twoFactorEnabled ? 'Enabled' : 'Disabled'} • Session IP: {adminProfile.sessionIp || '192.168.10.24'}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-700 bg-slate-900/80 p-5 shadow-inner">
                <div className="mb-5 flex items-center justify-between border-b border-slate-700 pb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Profile Settings</p>
                    <h4 className="mt-2 text-xl font-black text-white">Update Access Details</h4>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Username</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => handleProfileFieldChange('username', e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Current Password</label>
                      <input
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(e) => handleProfileFieldChange('currentPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">New Password</label>
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) => handleProfileFieldChange('newPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Confirm Password</label>
                      <input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => handleProfileFieldChange('confirmPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Avatar Upload</p>
                        <p className="mt-2 text-sm text-slate-300">Upload a new profile photo from your device.</p>
                      </div>
                      <label className="cursor-pointer rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-400">
                        Browse
                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarUpload} />
                      </label>
                    </div>
                  </div>

                  {profileMsg && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                      {profileMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {profileLoading ? 'Saving profile...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;