import { useState, useEffect, useRef } from 'react';
import SellerOperationsCenter from './SellerOperationsCenter';
import NotificationCenter from './NotificationCenter';
import SettingsCenter from './SettingsCenter';

const universityStructure = {
  "College of Computing and Informatics (CCI)": [
    "Department of Computer Science",
    "Department of Information Technology (IT)",
    "Department of Software Engineering"
  ],
  "College of Natural and Computational Sciences (CNCS)": [
    "Department of Biology",
    "Department of Chemistry",
    "Department of Geology",
    "Department of Mathematics",
    "Department of Physics",
    "Department of Statistics",
    "Department of Sport Science"
  ],
  "College of Agriculture and Natural Resource": [
    "Department of Agro-Economics",
    "Department of Agribusiness and Value Chain Management",
    "Department of Animal Science",
    "Department of Forestry",
    "Department of Horticulture",
    "Department of Natural Resource Management",
    "Department of Plant Science",
    "Department of Rural Development and Agricultural Extension"
  ],
  "College of Business and Economics": [
    "Department of Accounting and Finance",
    "Department of Economics",
    "Department of Management",
    "Department of Marketing Management"
  ],
  "College of Social Sciences and Humanities": [
    "Department of Amharic Language and Literature",
    "Department of English Language and Literature",
    "Department of Geography and Environmental Studies",
    "Department of History and Heritage Management",
    "Department of Political Science and International Relations"
  ],
  "School of Law": [
    "Department of Law (LLB)"
  ]
};

const getStudentAvatar = (studentId) => (
  studentId
    ? `http://127.0.0.1:8000/static/uploads/avatars/${encodeURIComponent(studentId)}.jpg`
    : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'
);


function StudentDashboard({ user, onLogout, initialTab = 'home', onTabChange, onUserUpdate, onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // ምስል 2 ላይ የተጠየቀው የጎን ፓነል መክፈቻ/መዝጊያ ስቴት
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // የጎን መቆጣጠሪያ ታብ
  const [buyerTab, setBuyerTab] = useState('search'); // የገዢዎች ንዑስ ታብ (Search, Wishlist, Cart, Orders, Payments)
  const [settingsTab, setSettingsTab] = useState('account');

  const [notifications, setNotifications] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const initialConversations = [
    {
      id: 'conv-sara',
      studentId: 'STU-1001',
      name: 'Sara Bekele',
      status: 'online',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      lastMessage: 'Can we confirm the defense rehearsal slot?',
      timestamp: '2 min ago',
      unread: 2,
      product: {
        id: 18,
        title: 'Final Year Project Prototype Kit',
        price: 7800,
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80'
      },
      messages: [
        { id: 'm1', sender: 'them', text: 'Hi! I saw your project prototype and it looks great.', time: '09:42 AM' },
        { id: 'm2', sender: 'me', text: 'Thanks! I am refining the final demo slides right now.', time: '09:43 AM' },
        { id: 'm3', sender: 'them', text: 'Can we confirm the defense rehearsal slot after class?', time: '09:45 AM' },
      ]
    },
    {
      id: 'conv-abdi',
      studentId: 'STU-1002',
      name: 'Abdi Tadesse',
      status: 'offline',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      lastMessage: 'The system demo is ready to test.',
      timestamp: '18 min ago',
      unread: 1,
      product: null,
      messages: [
        { id: 'm4', sender: 'them', text: 'I uploaded the latest API test logs for review.', time: '09:16 AM' },
        { id: 'm5', sender: 'me', text: 'Thanks, I will review them before the evening check-in.', time: '09:18 AM' },
        { id: 'm6', sender: 'them', text: 'The system demo is ready to test.', time: '09:19 AM' },
      ]
    },
    {
      id: 'conv-lina',
      studentId: 'STU-1003',
      name: 'Lina Mekonnen',
      status: 'online',
      avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',
      lastMessage: 'I can help you rehearse your Q&A flow.',
      timestamp: '1 hour ago',
      unread: 0,
      product: {
        id: 29,
        title: 'Smart Attendance Sensor Kit',
        price: 6400,
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80'
      },
      messages: [
        { id: 'm7', sender: 'them', text: 'I can help you rehearse your Q&A flow.', time: '08:40 AM' },
        { id: 'm8', sender: 'me', text: 'That would be great. I will send the latest version of my slides.', time: '08:42 AM' },
      ]
    },
  ];
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0]?.id || '');
  const [conversationsList, setConversationsList] = useState(initialConversations);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [activeChatMessages, setActiveChatMessages] = useState(initialConversations[0]?.messages || []);
  const [typingInput, setTypingInput] = useState('');
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [mobileChatView, setMobileChatView] = useState('list');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAddChatModal, setShowAddChatModal] = useState(false);
  const [showProfileDetailsModal, setShowProfileDetailsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [blockedConversations, setBlockedConversations] = useState({});
  const [blockedUsers, setBlockedUsers] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedBlockedUsers = JSON.parse(window.localStorage.getItem('campaceBlockedUsers') || '[]');
      return Array.isArray(savedBlockedUsers) ? savedBlockedUsers.map(String) : [];
    } catch (error) {
      console.warn('Unable to load blocked users:', error);
      return [];
    }
  });
  const [unreadCount, setUnreadCount] = useState(initialConversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0));
  const socketRef = useRef(null);
  const activePeerIdRef = useRef('');
  const typingTimeoutRef = useRef(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const walletBalanceRef = useRef(walletBalance);
  const [loading, setLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Campus AI assistant. Ask me anything about textbooks, gadget pricing, or campus trading tips!'
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const aiScrollRef = useRef(null);
  const aiAbortControllerRef = useRef(null);
  const suggestedPrompts = [
    '🔍 Laptops under 25k ETB',
    '📖 CCI Textbooks',
    '💡 Pricing Tips',
    '🧥 Best study gear under 5k ETB'
  ];

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    studentId: user?.studentId || '',
    email: user?.email || '',
    phone: user?.phone || '',
    college: user?.college || '',
    department: user?.department || '',
    password: '',
    confirmPassword: ''
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // ለድጋፍ ፎም መቆጣጠሪያዎች (Support/Report Form States)
  const [supportIssue, setSupportIssue] = useState('');
  const [supportMsg, setSupportMsg] = useState('');

  // የገዢው ዳሽቦርድ መረጃዎችን ከዳታቤዝ ለመጥራት የተዘጋጁ ስቴቶች (Buyer States)
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlistBadgeCount, setWishlistBadgeCount] = useState(0);
  const [cartBadgeCount, setCartBadgeCount] = useState(0);
  const [orders, setOrders] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState({ balance: 0.00, recentTx: 'No transactions yet' });
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [highlights, setHighlights] = useState({ aiPicks: 0, latestListings: 0, cartValue: 0.00, pendingMessages: 0 });
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recentCampusActivity, setRecentCampusActivity] = useState([]);

  // የሻጭ/ምርት መለጠፊያ ፎርም ስቴት (Seller Product Posting Form States)
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    title: '',
    category: '',
    subcategory: '',
    price: '',
    quantity: '1',
    condition: 'New',
    pickupLocation: '',
    description: '',
    image: null
  });
  const [productError, setProductError] = useState('');
  const [productSuccessMsg, setProductSuccessMsg] = useState('');
  const [productSubmitting, setProductSubmitting] = useState(false);

  // Dynamic categories from backend
  const [categories, setCategories] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [selectedCategoryObj, setSelectedCategoryObj] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCategory, setSearchCategory] = useState('');
  const [searchSubcategory, setSearchSubcategory] = useState('');
  const [wishlistMessage, setWishlistMessage] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [myListings, setMyListings] = useState([]);
  const [sellerData, setSellerData] = useState({
    totalListings: 0,
    receivedOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    incomingOrders: [],
    activeListings: []
  });
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploadMessage, setAvatarUploadMessage] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  const normalizePrice = (possiblePrice) => {
    if (typeof possiblePrice === 'number') return possiblePrice;
    if (!possiblePrice) return 0;
    const numeric = parseFloat(String(possiblePrice).replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const formatETB = (value) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return '0 ETB';
    return `${numeric.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB`;
  };

  const normalizeOrderStatus = (value) => {
    const raw = String(value || 'Processing').trim();
    if (!raw) return 'Processing';
    const normalized = raw.toLowerCase();
    if (normalized.includes('complete')) return 'Completed';
    if (normalized.includes('ready')) return 'Ready for Pickup';
    if (normalized.includes('process')) return 'Processing';
    if (normalized.includes('placed')) return 'Order Placed';
    return raw;
  };

  const normalizePaymentStatus = (value) => {
    const raw = String(value || 'Successful').trim();
    if (!raw) return 'Successful';
    const normalized = raw.toLowerCase();
    if (normalized.includes('fail')) return 'Failed';
    if (normalized.includes('pend')) return 'Pending';
    if (normalized.includes('refun')) return 'Refunded';
    return 'Successful';
  };

  const getEffectiveStudentId = () => user?.studentId || user?.username || user?.email || '';

  const getSafeCartPayload = (productIdValue) => {
    const normalizedStudentId = String(user?.studentId ?? user?.student_id ?? getEffectiveStudentId() ?? '').trim();
    const normalizedProductId = Number.parseInt(String(productIdValue ?? '').trim(), 10);

    return {
      student_id: normalizedStudentId,
      product_id: Number.isFinite(normalizedProductId) ? normalizedProductId : null,
    };
  };

  const getErrorString = async (response) => {
    try {
      const errData = await response.json();

      if (typeof errData?.detail === 'string') {
        return errData.detail;
      }

      if (Array.isArray(errData?.detail)) {
        return errData.detail[0]?.msg || errData.detail[0]?.message || 'Failed to complete action.';
      }

      if (errData && typeof errData === 'object') {
        const detail = errData.detail;
        if (Array.isArray(detail)) {
          return detail[0]?.msg || detail[0]?.message || 'Failed to complete action.';
        }
        if (typeof detail === 'string') {
          return detail;
        }
        if (typeof detail?.msg === 'string') {
          return detail.msg;
        }
        if (typeof detail?.message === 'string') {
          return detail.message;
        }
      }

      return 'Failed to complete action.';
    } catch (err) {
      return 'Failed to complete action.';
    }
  };

  const cartTotal = cart.reduce((total, item) => total + normalizePrice(item.price) * (item.quantity || 1), 0);
  const derivedCartItemCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
  const cartItemCount = cartBadgeCount || derivedCartItemCount;
  const wishlistCount = wishlistBadgeCount || wishlist.length;
  const orderCount = orders.length;
  const currentWalletBalance = Number(paymentInfo?.balance ?? walletBalance ?? user?.wallet_balance ?? 0);
  const platformFee = cartTotal * 0.035;
  const checkoutTotal = cartTotal + platformFee;
  const walletHasSufficientFunds = currentWalletBalance >= checkoutTotal;

  const defaultTransactionLedger = [
    { id: 1, type: 'deposit', label: 'Chapa wallet load', amount: 6000, status: 'Successful', date: '2026-08-13', hash: 'CHA_3F2A1D71A9' },
    { id: 2, type: 'purchase', label: 'Intro to Machine Learning', amount: -1750, status: 'Completed', date: '2026-08-11', hash: 'TXN_9C4E7D2A11' },
    { id: 3, type: 'deposit', label: 'Chapa wallet load', amount: 2500, status: 'Successful', date: '2026-08-09', hash: 'CHA_5A8E9C4D22' },
    { id: 4, type: 'purchase', label: 'Campus backpack', amount: -2200, status: 'Completed', date: '2026-08-06', hash: 'TXN_1D4F7B8E90' },
  ];

  const transactionLedger = Array.isArray(paymentInfo?.transactions) && paymentInfo.transactions.length
    ? paymentInfo.transactions
    : defaultTransactionLedger;

  const getTransactionSummaryText = (tx) => {
    if (!tx) return 'No transactions yet';

    const label = tx.label || tx.type || 'Transaction';
    const amount = Number(tx.amount ?? tx.value ?? 0);
    const isDeposit = amount >= 0 || String(tx.type || '').toLowerCase().includes('deposit');
    const sign = isDeposit ? '+' : '-';
    const formatted = formatETB(Math.abs(amount));

    return `${label} — ${sign}${formatted}`;
  };

  const latestTransaction = transactionLedger[0] || null;
  const recentTransactionText = Array.isArray(paymentInfo?.transactions) && paymentInfo.transactions.length
    ? getTransactionSummaryText(paymentInfo.transactions[0])
    : paymentInfo?.recentTx || getTransactionSummaryText(latestTransaction) || 'No transactions yet';

  const buyerSubTabs = [
    { id: 'search', label: 'Search / Browse', badge: 0 },
    { id: 'wishlist', label: 'Wishlist', badge: wishlistCount },
    { id: 'cart', label: 'Cart', badge: cartItemCount },
    { id: 'orders', label: 'Orders', badge: orderCount },
    { id: 'payments', label: 'Payments', badge: transactionLedger.length },
  ];

  const sellerStatusSummary = (() => {
    if (!myListings.length) {
      return { label: 'Pending', tone: 'amber', details: 'No listings posted yet' };
    }

    const statuses = myListings.map((item) => String(item.status || 'Pending').toLowerCase());
    if (statuses.some((status) => status.includes('flag') || status.includes('reject'))) {
      return { label: 'Flagged', tone: 'rose', details: `${statuses.filter((status) => status.includes('flag') || status.includes('reject')).length} listing(s) flagged` };
    }
    if (statuses.some((status) => status.includes('pending'))) {
      return { label: 'Pending', tone: 'amber', details: `${statuses.filter((status) => status.includes('pending')).length} listing(s) awaiting review` };
    }
    return { label: 'Approved', tone: 'emerald', details: `${statuses.length} listing(s) approved` };
  })();

  const fetchProducts = async ({ search, category, subcategory, limit, department } = {}) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      if (limit) params.set('limit', String(limit));
      if (department) params.set('department', department);
      const url = `http://127.0.0.1:8000/api/products${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load products');
      const productData = await res.json();
      setSearchResults(Array.isArray(productData) ? productData : []);
    } catch (err) {
      console.error('Error loading products:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchMyListings = async () => {
    if (!user?.studentId) {
      setMyListings([]);
      setSellerData({
        totalListings: 0,
        pendingOrders: 0,
        incomingOrders: [],
        activeListings: []
      });
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/student/seller/dashboard-data?student_id=${encodeURIComponent(user.studentId)}`);
      if (!response.ok) throw new Error('Failed to load seller dashboard data');
      const data = await response.json();
      setSellerData({
        totalListings: Number(data.totalListings ?? data.total_listings ?? myListings.length ?? 0) || 0,
        receivedOrders: Number(data.receivedOrders ?? data.received_orders ?? 0) || 0,
        totalRevenue: Number(data.totalRevenue ?? data.total_revenue ?? 8450) || 0,
        pendingOrders: Number(data.pendingOrders ?? data.pending_orders ?? 3) || 0,
        incomingOrders: Array.isArray(data.incomingOrders ?? data.incoming_orders) ? (data.incomingOrders ?? data.incoming_orders) : [],
        activeListings: Array.isArray(data.activeListings ?? data.active_listings) ? (data.activeListings ?? data.active_listings) : []
      });
    } catch (err) {
      console.error('Error fetching seller dashboard data:', err);
      setSellerData({
        totalListings: myListings.length || 8,
        receivedOrders: 12,
        totalRevenue: 8450,
        pendingOrders: 3,
        incomingOrders: [],
        activeListings: []
      });
    }
  };

  useEffect(() => {
    if (!user?.studentId) return;

    const loadSellerAnalytics = async () => {
      await fetchMyListings();
      await fetchSellerDashboardData();
    };

    loadSellerAnalytics();
  }, [user?.studentId]);

  useEffect(() => {
    if (activeTab === 'profile') {
      setActiveTab('settings');
      setSettingsTab('account');
    }
  }, [activeTab]);

  const resetSearchFilters = () => {
    setSearchCategory('');
    setSearchSubcategory('');
    setSearchQuery('');
  };

  const studentId = user?.studentId || '';

  useEffect(() => {
    const fetchModalDropdownData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/categories');
        if (!response.ok) return;

        const catData = await response.json();
        setCategories(catData);
        setDbCategories(catData);
      } catch (err) {
        console.error('Error fetching dropdown data:', err);
      }
    };

    fetchModalDropdownData();
  }, []);

  useEffect(() => {
    if (!studentId || activeTab !== 'notifications') return;

    const fetchNotificationsData = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/notifications?student_id=${studentId}`);
        if (!response.ok) return;

        const notifData = await response.json();
        const notificationItems = Array.isArray(notifData)
          ? notifData
          : notifData.notifications || notifData.allNotifications || [];
        const normalizedNotifications = notificationItems.map((notification) => ({
          ...notification,
          read: Boolean(notification.read ?? notification.is_read),
          type: notification.type || notification.category || 'system',
        }));
        setNotifications((previousNotifications) => (
          JSON.stringify(previousNotifications) === JSON.stringify(normalizedNotifications)
            ? previousNotifications
            : normalizedNotifications
        ));
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    fetchNotificationsData();
  }, [activeTab, studentId]);

  useEffect(() => {
    if (!studentId || activeTab !== 'buyer') return;

    const fetchBuyerDashboardData = async () => {
      try {
        const [wishRes, cartRes, orderRes, payRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/student/wishlist?student_id=${studentId}`),
          fetch(`http://127.0.0.1:8000/api/student/cart?student_id=${studentId}`),
          fetch(`http://127.0.0.1:8000/api/student/orders?student_id=${studentId}`),
          fetch(`http://127.0.0.1:8000/api/student/payments?student_id=${studentId}`),
        ]);

        if (wishRes.ok) {
          const wishData = await wishRes.json();
          setWishlist(wishData);
          setWishlistBadgeCount(Array.isArray(wishData) ? wishData.length : Number(wishData?.wishlist_count ?? wishData?.wishlist_item_count ?? 0));
        }

        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCart(cartData.items || []);
          const nextCartCount = Number(cartData?.meta?.cart_count ?? cartData?.meta?.cart_item_count ?? cartData?.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) ?? 0);
          setCartBadgeCount(Number.isFinite(nextCartCount) ? nextCartCount : 0);
        }

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrders(orderData);
        }

        if (payRes.ok) {
          const payData = await payRes.json();
          const nextBalance = Number(payData?.balance ?? payData?.walletBalance ?? payData?.wallet_balance ?? 0);
          const normalizedBalance = Number.isFinite(nextBalance) ? nextBalance : 0;
          const normalizedTransactions = Array.isArray(payData?.transactions) ? payData.transactions : [];

          setPaymentInfo({
            balance: normalizedBalance,
            recentTx: payData?.recentTx || payData?.recent_tx || (normalizedTransactions[0] ? getTransactionSummaryText(normalizedTransactions[0]) : 'No transactions yet'),
            transactions: normalizedTransactions,
          });

          const balanceChanged = normalizedBalance !== walletBalanceRef.current;
          if (balanceChanged) {
            walletBalanceRef.current = normalizedBalance;
            setWalletBalance(normalizedBalance);
          }

          if (balanceChanged && onUserUpdate) {
            onUserUpdate((currentUser) => currentUser ? { ...currentUser, wallet_balance: normalizedBalance } : currentUser);
          }
        }
      } catch (err) {
        console.error('Error fetching buyer data:', err);
      }
    };

    fetchBuyerDashboardData();
    // onUserUpdate is intentionally excluded because the parent recreates it on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, studentId]);

  useEffect(() => {
    if (!studentId) return;

    const fetchUserHighlights = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/highlights?student_id=${studentId}`);
        if (!response.ok) return;

        const highlightData = await response.json();
        setHighlights(highlightData);
      } catch (err) {
        console.error('Error fetching highlights:', err);
      }
    };

    const fetchRecommendations = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/recommendations?student_id=${encodeURIComponent(studentId)}`);
        if (!response.ok) return;

        const recommendationData = await response.json();
        setRecommendedProducts(Array.isArray(recommendationData) ? recommendationData : (recommendationData.recommendations || []));
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      }
    };

    const fetchRecentActivity = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/recent-activity?student_id=${encodeURIComponent(studentId)}`);
        if (!response.ok) return;

        const activityData = await response.json();
        setRecentCampusActivity(Array.isArray(activityData) ? activityData : (activityData.items || []));
      } catch (err) {
        console.error('Error fetching recent activity:', err);
      }
    };

    if (user?.avatarUrl) {
      const normalizedAvatarUrl = user.avatarUrl.includes('?')
        ? user.avatarUrl
        : `${user.avatarUrl}?t=${Date.now()}`;

      setAvatarUrl((prev) => (prev === normalizedAvatarUrl ? prev : normalizedAvatarUrl));
    } else {
      setAvatarUrl('');
    }

    fetchUserHighlights();
    fetchRecommendations();
    fetchRecentActivity();
  }, [studentId, user?.avatarUrl, user?.department]);

  const loadSearchDefaults = async () => {
    if (activeTab !== 'buyer' || buyerTab !== 'search') return;
    await fetchProducts({ limit: 10, department: user?.department });
  };

  useEffect(() => {
    if (activeTab !== 'buyer' || buyerTab !== 'search') return;
    loadSearchDefaults();
    // loadSearchDefaults is recreated on render; these state values control when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, buyerTab, user?.department]);

  // Load personalized recommendations for AI Advisor tab
  useEffect(() => {
    if (activeTab !== 'ai-advisor') return;
    if (!user?.department) return;

    const loadAiRecommendations = async () => {
      try {
        await fetchProducts({ limit: 12, department: user?.department });
      } catch (err) {
        console.error('Error loading AI advisor recommendations:', err);
      }
    };

    loadAiRecommendations();
  }, [activeTab, user?.department]);

  useEffect(() => {
    const requestedTab = initialTab === 'profile' ? 'settings' : initialTab;
    if (requestedTab) {
      setActiveTab((currentTab) => currentTab === requestedTab ? currentTab : requestedTab);
    }
  }, [initialTab]);

  const lastSyncedTabRef = useRef(null);

  useEffect(() => {
    if (onTabChange && activeTab !== lastSyncedTabRef.current) {
      lastSyncedTabRef.current = activeTab;
      onTabChange(activeTab);
    }
    // The parent recreates onTabChange; activeTab is the only value that controls this sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!user?.studentId) return;

    let isMounted = true;

    const fetchUnreadCounts = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/student/notifications/unread-count?student_id=${encodeURIComponent(user.studentId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const totalUnread = Number(data.unreadCount ?? data.unread_count ?? 0);

        if (isMounted) {
          setUnreadNotificationCount(totalUnread);
          setUnreadMessageCount((prev) => (totalUnread > 0 ? totalUnread : prev));
        }
      } catch (err) {
        console.error('Error fetching unread notification count:', err);
      }
    };

    const fetchWalletBalance = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/student/payments?student_id=${user.studentId}`);
        if (!res.ok) return;
        const data = await res.json();
        const nextBalance = Number(data.balance ?? data.walletBalance ?? data.wallet_balance ?? 0);
        const normalizedBalance = Number.isFinite(nextBalance) ? nextBalance : 0;
        const normalizedTransactions = Array.isArray(data?.transactions) ? data.transactions : [];

        if (isMounted) {
          const balanceChanged = normalizedBalance !== walletBalanceRef.current;
          if (balanceChanged) {
            walletBalanceRef.current = normalizedBalance;
            setWalletBalance(normalizedBalance);
          }
          setPaymentInfo((prev) => ({
            balance: normalizedBalance,
            recentTx: data?.recentTx || data?.recent_tx || (normalizedTransactions[0] ? getTransactionSummaryText(normalizedTransactions[0]) : prev?.recentTx || 'No transactions yet'),
            transactions: normalizedTransactions.length ? normalizedTransactions : prev?.transactions || [],
          }));

          if (balanceChanged && onUserUpdate) {
            onUserUpdate((currentUser) => currentUser ? { ...currentUser, wallet_balance: normalizedBalance } : currentUser);
          }
        }
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
      }
    };

    fetchUnreadCounts();
    fetchWalletBalance();

    const handleRefreshOnFocus = () => {
      fetchWalletBalance();
    };

    window.addEventListener('focus', handleRefreshOnFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleRefreshOnFocus);
    };
    // onUserUpdate and getTransactionSummaryText are intentionally excluded from this
    // student-scoped fetch to prevent parent callback identity changes from refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.studentId]);

  useEffect(() => {
    const safeNotifications = Array.isArray(notifications) ? notifications : [];

    if (safeNotifications.length === 0) {
      setUnreadMessageCount(0);
      return;
    }

    const messageCount = safeNotifications.filter((notification) => {
      if (notification.read) return false;
      const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
      return /message|chat|reply|inbox/.test(text);
    }).length;

    setUnreadMessageCount(messageCount);
  }, [notifications]);

  // 2. ተማሪው ቅሬታውን ለአስተዳዳሪው የሚልክበት አሠራር (Submit Support Ticket)
  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSupportMsg('');
    if (!supportIssue.trim()) return;

    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.studentId,
          student_name: user.name,
          issue: supportIssue
        })
      });
      if (res.ok) {
        setSupportIssue('');
        setSupportMsg('Your support ticket has been submitted to the Admin! 🎉');
        setTimeout(() => setShowSupportModal(false), 2000);
      } else {
        setSupportMsg('Failed to submit support ticket.');
      }
    } catch (err) {
      setSupportMsg('Connection error. Please try again.');
    }
  };

  const handleAvatarUploadSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile) {
      setAvatarUploadMessage('Please choose an image file first.');
      return;
    }

    setAvatarUploading(true);
    setAvatarUploadMessage('');

    const formData = new FormData();
    formData.append('student_id', user.studentId);
    formData.append('image', avatarFile);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        setAvatarUploadMessage(errorBody?.detail || 'Upload failed. Please try again.');
        return;
      }

      // Read the returned JSON and update the avatar URL with a cache-busting timestamp
      const data = await res.json().catch(() => null);
      const returnedUrl = data?.imageUrl || data?.url || '';
      if (returnedUrl) {
        const sep = returnedUrl.includes('?') ? '&' : '?';
        const urlWithTs = `${returnedUrl}${sep}t=${new Date().getTime()}`;
        setAvatarUrl(urlWithTs);

        if (onUserUpdate) {
          onUserUpdate((currentUser) => {
            const updatedUser = { ...(currentUser || user), avatarUrl: urlWithTs };

            if (typeof window !== 'undefined') {
              const saved = window.localStorage.getItem('campaceSession');
              const session = saved ? JSON.parse(saved) : {};
              window.localStorage.setItem('campaceSession', JSON.stringify({
                ...session,
                user: updatedUser,
              }));
            }

            return updatedUser;
          });
        }
      }
      setAvatarUploadMessage('Avatar uploaded successfully.');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setAvatarUploadMessage('Upload failed. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'college' ? { department: '' } : {})
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMessage('');
    setProfileSaving(true);

    if (!/^0\d{9}$/.test(profileForm.phone)) {
      setProfileMessage('Please enter a valid phone number (e.g., 0962714305).');
      setProfileSaving(false);
      return;
    }

    if (profileForm.password !== profileForm.confirmPassword) {
      setProfileMessage('Passwords do not match.');
      setProfileSaving(false);
      return;
    }

    try {
      const payload = {
        student_id: user.studentId,
        name: profileForm.name,
        phone: profileForm.phone,
        college: profileForm.college,
        department: profileForm.department,
      };

      if (profileForm.password) {
        payload.password = profileForm.password;
      }

      const res = await fetch('http://127.0.0.1:8000/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save profile.');
      }

      const updatedUser = {
        ...user,
        name: data.user.name,
        phone: data.user.phone,
        college: data.user.college,
        department: data.user.department,
      };

      onUserUpdate(updatedUser);
      setProfileMessage('Profile updated successfully.');
      setProfileForm((prev) => ({ ...prev, password: '' }));

      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('campaceSession');
        const session = saved ? JSON.parse(saved) : {};
        window.localStorage.setItem('campaceSession', JSON.stringify({
          ...session,
          user: updatedUser,
        }));
      }
    } catch (err) {
      console.error('Profile update failed:', err);
      setProfileMessage(err.message || 'Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSearchSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    await fetchProducts({
      search: searchQuery,
      category: searchCategory,
      subcategory: searchSubcategory,
    });
    setBuyerTab('search');
  };

  const handleAddToWishlist = async (productId) => {
    setWishlistMessage('');
    setCartMessage('');

    const effectiveStudentId = getEffectiveStudentId();
    if (!effectiveStudentId) {
      setWishlistMessage('Student identity is unavailable. Please log in again.');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user?.studentId || user?.student_id || effectiveStudentId,
          product_id: parseInt(productId, 10)
        })
      });

      if (!res.ok) {
        const message = await getErrorString(res);
        setWishlistMessage(message);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const baseProduct =
        searchResults.find((item) => String(item.id) === String(productId)) ||
        recommendedProducts.find((item) => String(item.id) === String(productId)) ||
        null;

      const newWishlistItem = {
        id: data.id ?? Date.now(),
        student_id: effectiveStudentId,
        product_id: productId,
        created_at: data.created_at ?? new Date().toISOString(),
        title: baseProduct?.title || 'Product',
        price: baseProduct?.price ?? 0,
        description: baseProduct?.description || '',
        image: baseProduct?.image || '',
        category: baseProduct?.category || '',
        subcategory: baseProduct?.subcategory || '',
        seller: baseProduct?.seller || '',
        status: baseProduct?.status || 'Active',
      };

      setWishlist((prev) => {
        const alreadyExists = prev.some((item) => String(item.product_id ?? item.id) === String(productId));
        return alreadyExists ? prev : [...prev, newWishlistItem];
      });
      setWishlistBadgeCount((prev) => Math.max(prev, wishlist.length + 1));
      setWishlistMessage('Added to wishlist.');
      setBuyerTab('wishlist');
    } catch (err) {
      console.error('Error adding to wishlist:', err);
      setWishlistMessage('Connection error. Please try again.');
    }
  };

  const handleAddToCartFromSearch = async (productId) => {
    setCartMessage('');
    setWishlistMessage('');

    const safePayload = getSafeCartPayload(productId);
    if (!safePayload.student_id) {
      setCartMessage('Student identity is unavailable. Please log in again.');
      return;
    }
    if (safePayload.product_id === null || !Number.isFinite(safePayload.product_id)) {
      setCartMessage('Invalid product selection. Please try again.');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload)
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextCartCount = Number(data.cart_count ?? data.cart_item_count ?? cartItemCount + 1);
        const nextWishlistCount = Number(data.wishlist_count ?? data.wishlist_item_count ?? wishlistCount);
        setCartBadgeCount(Number.isFinite(nextCartCount) ? nextCartCount : cartItemCount + 1);
        setWishlistBadgeCount(Number.isFinite(nextWishlistCount) ? nextWishlistCount : wishlistCount);
        await fetchDashboardData();
        setCartMessage('Added to cart.');
        setBuyerTab('cart');
      } else {
        const message = await getErrorString(res);
        setCartMessage(message);
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
      setCartMessage('Connection error. Please try again.');
    }
  };

  const handleRemoveFromWishlist = async (itemId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/student/wishlist/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setWishlist((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (err) {
      console.error('Error removing wishlist item:', err);
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/student/cart/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCart((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (err) {
      console.error('Error removing cart item:', err);
    }
  };

  const handleSubmitReview = async (orderIdOverride = reviewOrderId) => {
    const targetOrderId = Number(orderIdOverride ?? reviewOrderId);
    if (!targetOrderId || !reviewComment.trim()) {
      setReviewFeedback('Please choose an order and add a comment.');
      return;
    }
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user?.studentId || user?.student_id || getEffectiveStudentId(),
          order_id: targetOrderId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      if (res.ok) {
        setReviewFeedback('Review submitted. Thank you!');
        setOrders((prev) => prev.map((order) => order.id === targetOrderId ? { ...order, reviewed: true, payment_status: 'Successful' } : order));
        setReviewOrderId(null);
        setReviewComment('');
        setReviewRating(5);
      } else {
        setReviewFeedback('Could not submit review.');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setReviewFeedback('Connection error. Please try again.');
    }
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setDepositError('');
    const amount = Number(depositAmount);

    if (!amount || amount <= 0) {
      setDepositError('Please enter a valid deposit amount.');
      return;
    }

    if (!user?.studentId) {
      setDepositError('Student ID is missing. Please log in again.');
      return;
    }

    setDepositLoading(true);
    try {
      const payload = {
        student_id: user.studentId,
        amount
      };

      if (user.email) {
        payload.email = user.email;
      }

      const res = await fetch('http://127.0.0.1:8000/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to initialize payment.');
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      throw new Error('No checkout URL returned from payment gateway.');
    } catch (err) {
      console.error('Deposit initialization failed:', err);
      setDepositError(err.message || 'Could not start the payment flow.');
    } finally {
      setDepositLoading(false);
    }
  };

  const isWishlistItemAvailable = (item) => {
    const statusValue = String(item?.status || '').trim().toLowerCase();
    return statusValue === 'approved' || statusValue === 'available';
  };

  const handleFindSimilar = (item) => {
    const query = `Find similar ${item?.category || 'campus'} items for ${item?.title || 'this product'} with a similar price range and good quality.`;
    setAiInput(query);
    setActiveTab('ai-advisor');
  };

  const handleMoveToCart = async (wishlistItemId, productId) => {
    const safePayload = getSafeCartPayload(productId);
    if (!safePayload.student_id) {
      return;
    }
    if (safePayload.product_id === null || !Number.isFinite(safePayload.product_id)) {
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload)
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextCartCount = Number(data.cart_count ?? data.cart_item_count ?? cartItemCount + 1);
        const nextWishlistCount = Number(data.wishlist_count ?? data.wishlist_item_count ?? wishlistCount);
        setCartBadgeCount(Number.isFinite(nextCartCount) ? nextCartCount : cartItemCount + 1);
        setWishlistBadgeCount(Number.isFinite(nextWishlistCount) ? nextWishlistCount : wishlistCount);

        const deleteRes = await fetch(`http://127.0.0.1:8000/api/student/wishlist/${wishlistItemId}`, { method: 'DELETE' });
        if (deleteRes.ok) {
          setWishlist((prev) => prev.filter((item) => item.id !== wishlistItemId));
        }
        setBuyerTab('cart');
      }
    } catch (err) {
      console.error("Error moving item to cart:", err);
    }
  };

  const handleMoveAllToCart = async () => {
    const availableItems = wishlist.filter((item) => isWishlistItemAvailable(item));
    if (!availableItems.length) return;

    for (const item of availableItems) {
      await handleMoveToCart(item.id, item.product_id);
    }
  };

  // 5. አዲስ ምርት (እቃ) መለጠፊያ (Post Product Handler)
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setProductError('');
    setProductSuccessMsg('');

    const itemName = (productForm.name || productForm.title || '').trim();
    if (!itemName || !productForm.category || !productForm.price || !productForm.image) {
      setProductError('Please fill in Name, Category, Price and add an image.');
      return;
    }

    setProductSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', itemName);
      formData.append('title', itemName);
      formData.append('category', productForm.category);
      formData.append('subcategory', productForm.subcategory || '');
      formData.append('price', String(productForm.price));
      formData.append('quantity', String(productForm.quantity || 1));
      formData.append('condition', productForm.condition || 'New');
      formData.append('pickup_location', productForm.pickupLocation || '');
      formData.append('description', productForm.description || '');
      formData.append('student_id', user?.studentId || '');
      formData.append('status', 'Pending');
      if (productForm.image) {
        formData.append('image', productForm.image);
      }

      const response = await fetch('http://127.0.0.1:8000/api/products', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setProductError(errorData?.detail || 'Could not post product.');
        return;
      }

      setProductSuccessMsg('Product submitted successfully and is awaiting admin approval.');
      setProductForm({
        name: '',
        title: '',
        category: '',
        subcategory: '',
        price: '',
        quantity: '1',
        condition: 'New',
        pickupLocation: '',
        description: '',
        image: null
      });
      setSelectedCategoryObj(null);
      await fetchMyListings();
      await fetchSellerDashboardData();

      setTimeout(() => {
        setShowProductModal(false);
        setProductSuccessMsg('');
      }, 1800);
    } catch (err) {
      console.error('Error submitting new product:', err);
      setProductError('Connection error. Please try again.');
    } finally {
      setProductSubmitting(false);
    }
  };

  const parseInlineProductCards = (text) => {
    if (!text) return [];
    const regex = /\[PRODUCT:(\d+):([^\]]+):([^\]]+)\]/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const [, id, title, price] = match;
      matches.push({
        id: Number(id),
        title: title.trim(),
        price: price.trim(),
        raw: match[0],
      });
    }

    return matches;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      aiScrollRef.current?.scrollTo({
        top: aiScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [chatHistory, isTyping]);

  const handleAiSend = async (messageText = aiInput) => {
    const trimmed = String(messageText || '').trim();
    if (!trimmed || isTyping) return;

    setIsTyping(true);
    setChatHistory((prev) => [...prev, { role: 'user', text: trimmed }]);
    setAiInput('');
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    try {
      // Send to Academic Defense AI Advisor endpoint
      const payload = {
        message: trimmed,
        student_id: user?.studentId,
        department: user?.department,
        context: 'academic_defense'
      };

      const res = await fetch('http://127.0.0.1:8000/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        // AI response with optional product recommendations
        setChatHistory((prev) => [...prev, { role: 'assistant', text: data.reply }]);

        // If advisor included recommendations, update recommended products
        if (data.recommendations && Array.isArray(data.recommendations)) {
          setRecommendedProducts(data.recommendations);
        }
      } else {
        const errorMsg = data.detail || data.error || 'Sorry, I could not answer that right now.';
        setChatHistory((prev) => [...prev, { role: 'assistant', text: errorMsg }]);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setChatHistory((prev) => [...prev, { role: 'assistant', text: '⚠️ AI Generation stopped by the user.' }]);
        return;
      }
      console.error('AI advisor error:', err);
      setChatHistory((prev) => [...prev, {
        role: 'assistant',
        text: '⚠️ Connection error. Please try again in a moment. Ensure the backend server is running at http://127.0.0.1:8000'
      }]);
    } finally {
      if (aiAbortControllerRef.current === abortController) {
        aiAbortControllerRef.current = null;
      }
      setIsTyping(false);
    }
  };

  const handleStopAiGeneration = () => {
    aiAbortControllerRef.current?.abort();
  };

  const handleClearChat = () => {
    aiAbortControllerRef.current?.abort();
    setChatHistory([
      {
        role: 'assistant',
        text: 'Hello! I am your Campus AI assistant. Ask me anything about textbooks, gadget pricing, or campus trading tips!'
      }
    ]);
    setAiInput('');
    setIsTyping(false);
  };

  const handleCheckout = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.studentId })
      });
      const result = await res.json().catch(() => null);
      if (res.ok) {
        setCart([]);
        if (result?.orders && Array.isArray(result.orders)) {
          setOrders(result.orders);
        }
        setBuyerTab('orders');
      }
    } catch (err) {
      console.error("Error completing checkout:", err);
    }
  };

  const handleSecureCheckout = async () => {
    if (!cart.length || !walletHasSufficientFunds) return;

    const secureTotal = checkoutTotal;
    const nextWalletBalance = Math.max(currentWalletBalance - secureTotal, 0);

    try {
      setCart([]);
      setWalletBalance(nextWalletBalance);
      setPaymentInfo((prev) => ({
        ...prev,
        balance: nextWalletBalance,
        recentTx: `Secure checkout complete for ${formatETB(secureTotal)}`
      }));
      setOrders((prev) => [
        {
          id: Date.now(),
          title: cart[0]?.title || 'Campus purchase',
          status: 'Processing',
          price: secureTotal,
          reviewed: false,
          pickup_location: 'Campus Bookstore'
        },
        ...prev,
      ]);
      setBuyerTab('orders');
    } catch (err) {
      console.error('Secure checkout simulation failed:', err);
    }
  };

  const updateCartItemQuantity = (itemId, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const currentQuantity = Number(item.quantity) || 1;
      const nextQuantity = Math.max(1, currentQuantity + delta);
      return { ...item, quantity: nextQuantity };
    }));
  };

  const walletShortfall = Math.max(0, checkoutTotal - currentWalletBalance);

  const handleTopUpFromCart = () => {
    const nextDeposit = Math.ceil(walletShortfall || 500);
    setBuyerTab('payments');
    setDepositAmount(String(nextDeposit));
    setDepositError('');
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const notificationUnreadCount = safeNotifications.filter((notif) => !notif.read).length;
  const [productDetails, setProductDetails] = useState({});

  // Fetch conversations list from backend
  useEffect(() => {
    if (!user?.studentId) return;

    const fetchConversations = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/student/messages/conversations?student_id=${user.studentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.conversations && Array.isArray(data.conversations)) {
            setConversationsList(data.conversations);
            setActiveConversationId(data.conversations[0]?.id || '');
            setActiveChatMessages(data.conversations[0]?.messages || []);
          }
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setConversationsList([]);
        setActiveConversationId('');
        setActiveChatMessages([]);
      } finally {
        setConversationsLoaded(true);
      }
    };

    fetchConversations();
  }, [user?.studentId]);

  useEffect(() => {
    const nextUnreadCount = conversationsList.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0);
    setUnreadCount(nextUnreadCount);
    setUnreadMessageCount(nextUnreadCount);
  }, [conversationsList]);

  // Fetch chat history when conversation is selected
  useEffect(() => {
    if (!conversationsLoaded || !user?.studentId || !activeConversationId) return;

    const selectedConversation = conversationsList.find((conversation) => conversation.id === activeConversationId) || conversationsList[0];
    if (!selectedConversation || !selectedConversation.studentId) return;

    const fetchChatHistory = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/student/messages/chat-history?sender_id=${user.studentId}&receiver_id=${selectedConversation.studentId}`);
        if (res.ok) {
          const data = await res.json();
          const messages = Array.isArray(data) ? data : data.messages;
          if (Array.isArray(messages)) {
            const formattedMessages = messages.map((msg) => ({
              id: msg.id,
              sender_id: msg.sender_id,
              sender: msg.sender_id === user.studentId ? 'me' : 'them',
              text: msg.message_text,
              created_at: msg.created_at,
              productId: msg.product_id,
              is_read: Boolean(msg.is_read),
            }));
            setActiveChatMessages(formattedMessages);
          }
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
    };

    fetchChatHistory();
  }, [activeConversationId, user?.studentId, conversationsList, conversationsLoaded]);

  // Fetch product details for messages with product attachments
  useEffect(() => {
    const productIdsToFetch = new Set();
    activeChatMessages.forEach((msg) => {
      if (msg.productId && !productDetails[msg.productId]) {
        productIdsToFetch.add(msg.productId);
      }
    });

    if (productIdsToFetch.size === 0) return;

    productIdsToFetch.forEach((productId) => {
      fetch(`http://127.0.0.1:8000/api/products/${productId}`)
        .then((res) => res.json())
        .then((data) => {
          setProductDetails((prev) => ({
            ...prev,
            [productId]: data,
          }));
        })
        .catch((error) => console.error(`Error fetching product ${productId}:`, error));
    });
  }, [activeChatMessages]);

  const activeConversation = conversationsList.find((conversation) => conversation.id === activeConversationId) || conversationsList[0] || null;
  const isActiveConversationBlocked = Boolean(activeConversation?.id && blockedConversations[activeConversation.id]);
  const filteredConversations = conversationsList.filter((conversation) => {
    const partnerId = String(conversation.studentId || conversation.student_id || String(conversation.id || '').replace(/^conv-/, ''));
    return !blockedUsers.includes(partnerId) && String(conversation.name || '').toLowerCase().includes(conversationSearch.trim().toLowerCase());
  });

  useEffect(() => {
    activePeerIdRef.current = String(activeConversation?.studentId || String(activeConversationId || '').replace(/^conv-/, ''));
    setPeerIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [activeConversation, activeConversationId]);

  useEffect(() => {
    if (!user?.studentId || typeof window === 'undefined') return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://127.0.0.1:8000/api/student/chat/ws/${user.studentId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Student chat WebSocket connected:', user.studentId);
    };

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        const incoming = packet?.data || packet;
        const eventType = incoming?.type || incoming?.event;
        if (eventType === 'online_status') {
          const presenceStudentId = String(incoming.student_id || '');
          const presenceStatus = incoming.status === 'online' ? 'online' : 'offline';
          if (presenceStudentId) {
            setConversationsList((previousConversations) => previousConversations.map((conversation) => {
              const conversationStudentId = String(
                conversation.studentId || conversation.student_id || String(conversation.id || '').replace(/^conv-/, '')
              );
              return conversationStudentId === presenceStudentId
                ? { ...conversation, status: presenceStatus }
                : conversation;
            }));
          }
          return;
        }
        if (eventType === 'typing' || eventType === 'user_typing') {
          const typingSenderId = String(incoming.sender_id || incoming.user_id || incoming.student_id || '');
          if (typingSenderId && typingSenderId === activePeerIdRef.current) {
            const isTypingFromPeer = incoming.is_typing !== false && incoming.typing !== false;
            setPeerIsTyping(isTypingFromPeer);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (isTypingFromPeer) {
              typingTimeoutRef.current = setTimeout(() => setPeerIsTyping(false), 3000);
            }
          }
          return;
        }
        const message = incoming?.type === 'incoming_message' ? incoming : null;
        if (!message) return;

        const counterpartId = message.sender_id === user.studentId ? message.receiver_id : message.sender_id;
        const counterpartConversationId = `conv-${counterpartId}`;

        // Append message to active chat if this is the current conversation
        if (activeConversationId === counterpartConversationId || activeConversationId?.includes(counterpartId)) {
          setActiveChatMessages((prev) => [
            ...prev,
            {
              id: message.id,
              sender_id: message.sender_id,
              sender: message.sender_id === user.studentId ? 'me' : 'them',
              text: message.message_text,
              created_at: message.created_at,
              productId: message.product_id,
              is_read: Boolean(message.is_read),
            }
          ]);
        }

        // Update conversation list
        setConversationsList((prev) => {
          const conversationIndex = prev.findIndex(
            (conversation) =>
              conversation.studentId === counterpartId ||
              conversation.id === counterpartId ||
              conversation.id === counterpartConversationId
          );

          if (conversationIndex === -1) {
            return prev;
          }

          return prev.map((item, index) => {
            if (index !== conversationIndex) return item;
            const isIncomingToCurrentUser = message.receiver_id === user.studentId;
            return {
              ...item,
              lastMessage: message.message_text,
              timestamp: 'just now',
              unread: isIncomingToCurrentUser ? Number(item.unread || 0) + 1 : 0,
            };
          });
        });
      } catch (error) {
        console.warn('Unable to parse student chat socket payload:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('Student chat socket error:', error);
    };

    socket.onclose = () => {
      console.log('Student chat WebSocket disconnected');
    };

    window.__campusSocket = socket;

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      delete window.__campusSocket;
    };
  }, [user?.studentId]);

  const sendChatMessage = () => {
    const safeMessage = typingInput.trim();
    if (!safeMessage || !activeConversation || isActiveConversationBlocked) return;

    const receiverId = activeConversation.studentId || (String(activeConversation.id || '').replace(/^conv-/, '') || null);
    if (!receiverId) {
      console.warn('No receiver id available for this chat conversation.');
      return;
    }

    const now = new Date();
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender_id: user?.studentId,
      sender: 'me',
      text: safeMessage,
      created_at: now.toISOString(),
      productId: activeConversation?.product?.id || null,
    };

    setActiveChatMessages((prev) => [...prev, newMessage]);
    setTypingInput('');
    setConversationsList((prev) => prev.map((conversation) =>
      conversation.id === activeConversation.id
        ? { ...conversation, unread: 0, lastMessage: safeMessage, timestamp: 'just now' }
        : conversation
    ));

    const payload = {
      receiver_id: receiverId,
      message_text: safeMessage,
      product_id: activeConversation?.product?.id ?? null,
    };

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.log('WebSocket transmit fallback:', payload);
    }
  };

  const persistBlockedUsers = (nextBlockedUsers) => {
    setBlockedUsers(nextBlockedUsers);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('campaceBlockedUsers', JSON.stringify(nextBlockedUsers));
    }
  };

  const handleViewProductFromChat = (productId) => {
    if (!productId) return;
    setActiveTab('buyer');
    setBuyerTab('search');
    onNavigate?.('product-details', { productId });
  };

  const handleBlockUser = (partnerId, partnerName) => {
    const normalizedPartnerId = String(partnerId || '').trim();
    if (!normalizedPartnerId || blockedUsers.includes(normalizedPartnerId)) return;
    const shouldBlock = typeof window === 'undefined' || window.confirm(`Block ${partnerName || normalizedPartnerId}?`);
    if (!shouldBlock) return;

    persistBlockedUsers([...blockedUsers, normalizedPartnerId]);
    setBlockedConversations((previous) => ({ ...previous, [`conv-${normalizedPartnerId}`]: true }));
    setTypingInput('');
    setShowChatDropdown(false);
    setMobileChatView('list');
    setActiveChatMessages([]);
    setActiveConversationId('');
  };

  const handleUnblockUser = (partnerId, partnerName) => {
    const normalizedPartnerId = String(partnerId || '').trim();
    const shouldUnblock = typeof window === 'undefined' || window.confirm(`Unblock ${partnerName || normalizedPartnerId}?`);
    if (!shouldUnblock) return;

    persistBlockedUsers(blockedUsers.filter((blockedUserId) => blockedUserId !== normalizedPartnerId));
    setBlockedConversations((previous) => {
      const nextBlockedConversations = { ...previous };
      delete nextBlockedConversations[`conv-${normalizedPartnerId}`];
      return nextBlockedConversations;
    });
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    const reason = reportReason.trim();
    const partnerId = activeConversation?.studentId || String(activeConversation?.id || '').replace(/^conv-/, '');
    if (!reason || !partnerId || !user?.studentId) return;

    setIsSubmittingReport(true);
    setReportStatus('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.studentId,
          student_name: user.name,
          issue: `Report against ${partnerId}: ${reason}`
        })
      });

      if (!res.ok) {
        throw new Error('Report request failed');
      }

      setReportReason('');
      setReportStatus('Your complaint was submitted for Admin review.');
      setTimeout(() => {
        setShowReportModal(false);
        setReportStatus('');
      }, 1500);
    } catch (error) {
      console.error('Unable to submit chat report:', error);
      setReportStatus('Unable to submit the complaint. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleChatMenuAction = (action) => {
    setShowChatDropdown(false);

    if (action === 'profile') {
      setShowProfileDetailsModal(true);
      return;
    }

    if (action === 'product') {
      if (activeConversation?.product?.id) {
        handleViewProductFromChat(activeConversation.product.id);
      } else {
        setReportStatus('No product is attached to this conversation.');
      }
      return;
    }

    if (action === 'report') {
      setReportReason('');
      setReportStatus('');
      setShowReportModal(true);
      return;
    }

    if (action === 'block') {
      const partnerId = activeConversation?.studentId || activeConversation?.student_id || String(activeConversation?.id || '').replace(/^conv-/, '');
      handleBlockUser(partnerId, activeConversation?.name);
    }

    if (action === 'delete') {
      if (activeConversation?.id) {
        const remainingConversations = conversationsList.filter((conversation) => conversation.id !== activeConversation.id);
        setConversationsList(remainingConversations);
        setActiveConversationId(remainingConversations[0]?.id || '');
        setActiveChatMessages([]);
        setMobileChatView('list');
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.studentId || safeNotifications.length === 0) return;

    setIsMarkingRead(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.studentId })
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((notification) => ({
          ...notification,
          read: true
        })));
      }
    } catch (err) {
      console.error('Error marking notifications read:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 pt-2 text-slate-900">
      <div className="flex min-h-screen w-full flex-col gap-3 lg:h-[calc(100vh-56px)] lg:overflow-hidden lg:flex-row lg:items-start lg:gap-3 lg:pt-1 lg:pb-2">

        {/* 1. የግራ የጎን መቆጣጠሪያ ፓነል (Responsive Collapsible Student Sidebar) */}
        <aside className={`
          flex w-72 flex-col bg-[#111c3a] p-6 text-white transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-50
          lg:static lg:mt-0 lg:translate-x-0 lg:h-fit lg:overflow-visible lg:overflow-y-visible lg:shrink-0 lg:rounded-[32px] lg:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarCollapsed ? 'w-24 p-3' : 'w-72 p-6'}
        `}>
          <div className={`mb-8 flex items-start justify-between ${isSidebarCollapsed ? 'flex-col gap-3' : ''}`}>
            <div className={`${isSidebarCollapsed ? 'w-full text-center' : ''}`}>
              <div className="flex items-center gap-2">
                <p className={`text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold border-b-2 border-white/80 w-fit pb-1 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>STUDENT DASHBOARD</p>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:border-slate-500 hover:text-white cursor-pointer lg:hidden"
                  title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {isSidebarCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                    )}
                  </svg>
                </button>
              </div>
              {!isSidebarCollapsed && (
                <>
                  <h1 className="mt-3 text-2xl font-bold text-white">Campus Portal</h1>
                  <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
                    Verified Student
                  </span>
                </>
              )}
            </div>

            {!isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer lg:hidden"
                title="Close sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <nav className={`space-y-2 ${isSidebarCollapsed ? 'items-center' : ''}`}>
            {[
              { key: 'home', label: 'Home' },
              { key: 'buyer', label: 'Buyer Hub' },
              { key: 'seller', label: 'Seller Hub' },
              { key: 'messages', label: 'Messages', badge: unreadCount || unreadMessageCount },
              { key: 'ai-advisor', label: 'AI Advisor' },
              { key: 'notifications', label: 'Notifications', badge: unreadNotificationCount },
              { key: 'settings', label: 'Settings' },
            ].map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key);
                    if (onTabChange) {
                      onTabChange(item.key);
                    }
                  }}
                  className={`group rounded-2xl px-3 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-colors duration-200 ease-out ${isActive ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                  title={item.label}
                >
                  <span className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                    {item.badge > 0 && (
                      <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ring-2 ring-[#111c3a] ${item.key === 'notifications' ? 'bg-amber-500 text-slate-950' : 'bg-red-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </span>
                  {!isSidebarCollapsed && (
                    <svg className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-4 pt-5 transition-all duration-300">
            <div className={`rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/20 backdrop-blur-sm ${isSidebarCollapsed ? 'p-3' : ''}`}>
              {!isSidebarCollapsed ? (
                <>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    <span>Wallet</span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">Live</span>
                  </div>
                  <div className="mt-3 text-lg font-bold text-white">Wallet: {Number(walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">ETB</div>
                  <div className="text-[10px] font-semibold text-white">{Number(walletBalance || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                </div>
              )}
            </div>

            {/* {user && (user.role === 'student') && (
              <div className={`mt-4 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-3 shadow-inner shadow-slate-950/20 ${isSidebarCollapsed ? 'px-2 py-3' : ''}`}>
                <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-2 text-center' : 'gap-3'}`}>
                  <img
                    src={avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80'}
                    alt="Student avatar"
                    className={`rounded-full object-cover ring-2 ring-slate-700 ${isSidebarCollapsed ? 'h-10 w-10' : 'h-11 w-11'}`}
                  />
                  {!isSidebarCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{user?.name || user?.studentId || 'Student'}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">✓</span>
                        Verified
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )} */}
          </div>
        </aside>

        {/* በሞባይል ስልኮች ላይ የጎን ማውጫው ሲከፈት በስተጀርባ የሚመጣ ጥቁር ጥላ (Mobile Overlay Backdrop) */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* 2. የቀኝ ዋና ይዘት ማሳያ ሰሌዳ (Main Content Panel) */}
        <main className="min-w-0 flex-1 px-2 transition-all duration-300 sm:px-3 lg:h-full lg:overflow-y-scroll lg:pr-2 lg:pt-1">

          {/* ፖፕአፕ የድጋፍ ፎርም (Support Modal) */}
          {showSupportModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="relative bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Request Support / Report Issue</h3>

                {supportMsg && (
                  <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
                    {supportMsg}
                  </div>
                )}

                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                    <input type="text" disabled value={user?.name || ''} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Student ID</label>
                    <input type="text" disabled value={user?.studentId || ''} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Describe your issue or complaint</label>
                    <textarea
                      rows="4"
                      value={supportIssue}
                      onChange={(e) => setSupportIssue(e.target.value)}
                      placeholder="Detail your complaint here..."
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                    ></textarea>
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 rounded-full bg-emerald-500 border border-slate-950 py-3 font-semibold text-white hover:bg-emerald-600 transition cursor-pointer">
                      Submit Ticket
                    </button>
                    <button type="button" onClick={() => setShowSupportModal(false)} className="flex-1 rounded-full border border-slate-200 bg-white py-3 font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="grid gap-6 px-4 animate-fade-in">

            {/* 1. ገጽ 1፦ የዳሽቦርዱ መግቢያ (Home Tab) */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">

                    {/* ዴስክቶፕ ላይ ማውጫው ከተዘጋ በኋላ ለመክፈቻ የሚሆን የ [|] ቁልፍ (ምስል 2 - Sidebar Toggle Open Button) */}
                    {!isSidebarOpen && (
                      <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition cursor-pointer hidden lg:flex"
                        title="Open sidebar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16" />
                        </svg>
                      </button>
                    )}

                    {/* በሞባይል ስልኮች ላይ የሚታየው የሜኑ መክፈቻ ቁልፍ (Mobile Hamburger Menu) */}
                    <button
                      onClick={() => setIsSidebarOpen(prev => !prev)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition cursor-pointer lg:hidden"
                      title="Menu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>

                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Student Experience</p>
                      <h2 className="mt-2 text-3xl font-semibold text-slate-950">Unified buyer + seller dashboard</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab('notifications')} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 cursor-pointer">Notifications</button>
                    <button onClick={() => setShowSupportModal(true)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-600 cursor-pointer">Support</button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                  {/* AI Recommendations */}
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between border-b pb-2">
                      <h3 className="text-xl font-bold text-slate-900">AI Recommendations</h3>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Department Match</span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {recommendedProducts.length ? (
                        recommendedProducts.map((item) => (
                          <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                            <div className="mb-4 h-32 w-full overflow-hidden rounded-[18px] bg-slate-200">
                              <img
                                src={item.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80'}
                                alt={item.title || 'Recommended marketplace product'}
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80';
                                }}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                {item.category || 'Recommended'}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{item.match || 'High match'}</span>
                            </div>
                            <h4 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h4>
                            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description || 'Popular campus item tailored to your department.'}</p>
                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-lg font-black text-slate-950">{formatETB(item.price)}</span>
                              <button type="button" className="rounded-full bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800 transition cursor-pointer">View</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[24px] bg-slate-50 p-4 border border-slate-100 text-sm text-slate-500 md:col-span-2">
                          No recommendations are available yet for your department.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Quick Actions</h3>
                      <div className="space-y-2">
                        <button onClick={() => setActiveTab('buyer')} className="w-full text-left rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition cursor-pointer">Continue browsing marketplace</button>
                        <button onClick={() => setActiveTab('buyer')} className="w-full text-left rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition cursor-pointer">Check seller orders</button>
                      </div>
                    </div>

                    {/* Recent Campus Activity */}
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Recent Campus Activity</h3>
                      <div className="space-y-3">
                        {recentCampusActivity.length ? (
                          recentCampusActivity.map((item, index) => (
                            <div key={`${item.title || 'activity'}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{item.time || 'Now'}</span>
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900">{item.title || item.action || 'Marketplace update'}</p>
                              <p className="mt-1 text-xs text-slate-600">{item.description || item.detail || 'Fresh student marketplace activity.'}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                            New products are being listed across campus.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* My Seller Status */}
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">My Seller Status</h3>
                      <div className={`rounded-[24px] border p-4 ${sellerStatusSummary.tone === 'amber' ? 'border-amber-200 bg-amber-50' : sellerStatusSummary.tone === 'rose' ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${sellerStatusSummary.tone === 'amber' ? 'bg-amber-100 text-amber-700' : sellerStatusSummary.tone === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {sellerStatusSummary.label}
                          </span>
                          <span className="text-xl font-black text-slate-900">{myListings.length}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{sellerStatusSummary.details}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ገጽ 2፦ የገዢዎች መቆጣጠሪያ ሰሌዳ (Buyer Hub) */}
            {activeTab === 'buyer' && (
              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-950">Buyer Hub</h3>
                  <p className="text-sm text-slate-500 mt-1">Search products, manage your wishlist, cart, orders, and payments.</p>

                  {/* Buyer Hub Sub-tabs (White Pill Buttons) */}
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {buyerSubTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setBuyerTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition border border-slate-200 cursor-pointer ${buyerTab === tab.id ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-800 hover:bg-slate-50'}`}
                      >
                        <span>{tab.label}</span>
                        {tab.badge > 0 && (
                          <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${buyerTab === tab.id ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-tab 1: Search / Browse */}
                {buyerTab === 'search' && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Search & Browse Marketplace</h3>
                        <p className="text-sm text-slate-500 mt-1">Find student listings by name, category, or subcategory.</p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button onClick={handleSearchSubmit} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition cursor-pointer">Search</button>
                        <button onClick={() => { resetSearchFilters(); fetchProducts(); }} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition cursor-pointer">Reset</button>
                      </div>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr]">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Search</label>
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search for textbooks, phones, bags..."
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Category</label>
                        <select
                          value={searchCategory}
                          onChange={(e) => {
                            setSearchCategory(e.target.value);
                            setSearchSubcategory('');
                          }}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        >
                          <option value="">All categories</option>
                          {categories.map((cat) => (
                            <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Subcategory</label>
                        <select
                          value={searchSubcategory}
                          onChange={(e) => setSearchSubcategory(e.target.value)}
                          disabled={!searchCategory}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">All subcategories</option>
                          {categories.find((cat) => cat.name === searchCategory)?.items?.map((sub) => (
                            <option key={sub.name} value={sub.name}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </form>

                    <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      {wishlistMessage && <p className="text-sm text-emerald-700">{wishlistMessage}</p>}
                      {cartMessage && <p className="text-sm text-emerald-700">{cartMessage}</p>}
                      {searchLoading ? (
                        <p className="text-sm text-slate-500">Searching listings…</p>
                      ) : searchResults.length === 0 ? (
                        <p className="text-sm text-slate-500">No products match your search yet. Try a different keyword or category.</p>
                      ) : (
                        <div className="space-y-4">
                          {searchResults.map((item) => (
                            <div key={item.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                                <img
                                  src={item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}
                                  alt={item.title}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
                                  }}
                                  className="h-24 w-32 rounded-2xl object-cover"
                                />
                                <div>
                                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.category} / {item.subcategory || 'General'}</p>
                                  <h4 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h4>
                                  <p className="mt-1 text-sm text-slate-500">{item.description || item.summary || 'No description available.'}</p>
                                  <p className="mt-2 font-bold text-slate-900">${item.price}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleAddToCartFromSearch(item.id)} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">Add to Cart</button>
                                <button type="button" onClick={() => handleAddToWishlist(item.id)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Add to Wishlist</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Wishlist */}
                {buyerTab === 'wishlist' && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Your Wishlist</h3>
                        <p className="text-sm text-slate-500">Keep your shortlisted campus essentials ready for checkout.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {wishlist.length > 1 && (
                          <button
                            type="button"
                            onClick={handleMoveAllToCart}
                            className="rounded-full bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
                          >
                            Move All to Cart
                          </button>
                        )}
                        {wishlistMessage && <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{wishlistMessage}</p>}
                      </div>
                    </div>

                    {wishlist.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-3xl">💡</div>
                        <p className="mt-5 text-lg font-semibold text-slate-900">Your wishlist is empty</p>
                        <p className="mt-2 text-sm text-slate-500">Save items you like and they will appear here for quick checkout.</p>
                      </div>
                    ) : (
                      <div className="mt-6 space-y-4">
                        {wishlist.map((item) => {
                          const available = isWishlistItemAvailable(item);
                          const itemPrice = formatETB(normalizePrice(item.price));

                          return (
                            <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:shadow-md">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex items-center gap-4">
                                  <img
                                    src={item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}
                                    alt={item.title}
                                    className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <h4 className="truncate text-base font-bold text-slate-900">{item.title}</h4>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{itemPrice}</p>
                                    {item.category && (
                                      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                        {item.category}{item.subcategory ? ` • ${item.subcategory}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="ml-auto flex flex-col items-end gap-3">
                                  <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ${available ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {available ? '🟢 Available' : '🔴 Sold / Unavailable'}
                                  </span>

                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveToCart(item.id, item.product_id)}
                                      disabled={!available}
                                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${available ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'cursor-not-allowed bg-slate-200 text-slate-500'}`}
                                    >
                                      Move to Cart
                                    </button>

                                    {!available && (
                                      <button
                                        type="button"
                                        onClick={() => handleFindSimilar(item)}
                                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
                                      >
                                        Find Similar
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFromWishlist(item.id)}
                                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 2: Cart */}
                {buyerTab === 'cart' && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Your Shopping Cart</h3>
                        <p className="text-sm text-slate-500">Review items before checkout and remove anything you no longer need.</p>
                      </div>
                      {cartMessage && <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{cartMessage}</p>}
                    </div>

                    {cart.length === 0 ? (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-400 text-center py-6">Your cart is empty.</p>
                      </div>
                    ) : (
                      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                        <div className="space-y-4">
                          {cart.map((item) => {
                            const itemQuantity = Number(item.quantity) || 1;
                            const lineTotal = normalizePrice(item.price) * itemQuantity;

                            return (
                              <div key={item.id} className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
                                <img
                                  src={item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}
                                  alt={item.title}
                                  className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-sm"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
                                  }}
                                />

                                <div className="min-w-0">
                                  <h4 className="truncate text-base font-semibold text-slate-900">{item.title}</h4>
                                  <p className="mt-1 text-sm text-slate-500">Seller: {item.seller || 'Campus Seller'}</p>
                                  <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() => updateCartItemQuantity(item.id, -1)}
                                        className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-slate-700 transition hover:bg-slate-100"
                                        aria-label={`Decrease quantity for ${item.title}`}
                                      >
                                        −
                                      </button>
                                      <span className="min-w-12 px-2 text-center text-sm font-semibold text-slate-900">{itemQuantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => updateCartItemQuantity(item.id, 1)}
                                        className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-slate-700 transition hover:bg-slate-100"
                                        aria-label={`Increase quantity for ${item.title}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500">Unit {formatETB(normalizePrice(item.price))}</span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                  <span className="text-lg font-bold text-slate-900">{formatETB(lineTotal)}</span>
                                  <button
                                    onClick={() => handleRemoveFromCart(item.id)}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <span>Invoice</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] ${walletHasSufficientFunds ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {walletHasSufficientFunds ? 'Funds Available' : 'Low Balance'}
                            </span>
                          </div>

                          <div className="mt-5 space-y-3 text-sm text-slate-700">
                            <div className="flex items-center justify-between">
                              <span>Subtotal</span>
                              <span className="font-semibold text-slate-900">{formatETB(cartTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Platform Fee</span>
                              <span className="font-semibold text-slate-900">{formatETB(platformFee)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
                              <span>Total</span>
                              <span>{formatETB(checkoutTotal)}</span>
                            </div>
                          </div>

                          <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Wallet Check</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm text-slate-600">Student Wallet</span>
                              <span className="text-lg font-bold text-slate-900">{formatETB(currentWalletBalance)}</span>
                            </div>
                            <p className={`mt-2 text-xs font-medium ${walletHasSufficientFunds ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {walletHasSufficientFunds ? 'Sufficient funds to complete checkout securely.' : `Top up ${formatETB(walletShortfall)} to complete this purchase.`}
                            </p>
                          </div>

                          <div className="mt-5 space-y-3">
                            <button
                              onClick={handleSecureCheckout}
                              disabled={!cart.length || !walletHasSufficientFunds}
                              className="w-full rounded-full bg-emerald-500 py-3.5 font-bold text-white hover:bg-emerald-600 transition disabled:cursor-not-allowed disabled:bg-emerald-300"
                            >
                              {walletHasSufficientFunds ? 'Pay with Wallet' : 'Insufficient Wallet Balance'}
                            </button>

                            <button
                              onClick={handleTopUpFromCart}
                              className="w-full rounded-full bg-sky-600 py-3.5 font-bold text-white hover:bg-sky-700 transition"
                            >
                              Top Up via Chapa
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 3: My Orders */}
                {buyerTab === 'orders' && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="border-b border-slate-200 pb-2 text-xl font-bold text-slate-900">Your Orders</h3>
                        <p className="mt-3 text-sm text-slate-500">Track fulfillment, pickup details, and post-purchase feedback for every order.</p>
                      </div>
                      {reviewFeedback && <p className="rounded-full bg-sky-50 px-4 py-2 text-sm text-sky-700">{reviewFeedback}</p>}
                    </div>

                    {orders.length === 0 ? (
                      <div className="rounded-[28px] border border-dashed border-emerald-200 bg-emerald-50 p-8 text-center">
                        <p className="text-lg font-semibold text-slate-900">No orders yet</p>
                        <p className="mt-2 text-sm text-slate-600">Your purchases will appear here once you place an order.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setBuyerTab('search');
                            setActiveTab('buyer');
                          }}
                          className="mt-5 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                        >
                          Browse Marketplace
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {orders.map((order) => {
                          const orderStatus = normalizeOrderStatus(order.fulfillment_status || order.status || 'Processing');
                          const paymentStatus = normalizePaymentStatus(order.payment_status || order.paymentStatus || order.pay_status || 'Successful');
                          const sellerName = order.seller_name || order.sellerName || order.seller || 'Campus Seller';
                          const pickupLocation = order.pickup_location || order.pickupLocation || 'Engineering Building';
                          const timelineSteps = ['Order Placed', 'Processing', 'Ready for Pickup', 'Completed'];
                          const stepIndexMap = {
                            'Order Placed': 0,
                            'Processing': 1,
                            'Ready for Pickup': 2,
                            'Completed': 3,
                          };
                          const currentStep = stepIndexMap[orderStatus] ?? 0;
                          const currentFillIndex = Math.max(0, Math.min(timelineSteps.length - 1, currentStep));

                          return (
                            <div key={order.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Order #{order.id}</p>
                                  <h4 className="mt-2 text-xl font-bold text-slate-900">{order.title || order.product_title || 'Campus Purchase'}</h4>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{orderStatus}</span>
                                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{paymentStatus}</span>
                                </div>
                              </div>

                              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Price</p>
                                  <p className="mt-2 text-xl font-bold text-slate-900">{formatETB(normalizePrice(order.price))}</p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Seller</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onNavigate) {
                                        onNavigate('student-dashboard-profile');
                                      } else {
                                        setActiveTab('profile');
                                      }
                                    }}
                                    className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                                  >
                                    {sellerName}
                                  </button>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fulfillment Status</p>
                                  <p className="mt-2 text-base font-bold text-slate-900">{orderStatus}</p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Payment Status</p>
                                  <p className="mt-2 text-base font-bold text-slate-900">{paymentStatus}</p>
                                </div>
                              </div>

                              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pickup Location</p>
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{pickupLocation}</span>
                                </div>
                                <p className="mt-3 text-sm text-slate-600">Collect your item from <span className="font-semibold text-slate-800">{pickupLocation}</span> on campus.</p>
                              </div>

                              <div className="mt-6">
                                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Trade Progress</p>
                                <div className="grid gap-3 md:grid-cols-4">
                                  {timelineSteps.map((step, index) => {
                                    const isActive = index <= currentFillIndex;
                                    const isCurrent = index === currentFillIndex;

                                    return (
                                      <div key={`${order.id}-${step}`} className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`flex h-3 w-3 items-center justify-center rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                          <span className={`text-[11px] font-semibold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step}</span>
                                        </div>
                                        {index < timelineSteps.length - 1 && (
                                          <div className={`mt-2 h-1.5 w-full rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                        )}
                                        {isCurrent && (
                                          <span className="mt-2 inline-flex rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">Current</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {orderStatus === 'Completed' && (
                                <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h5 className="text-lg font-bold text-slate-900">Rate this purchase</h5>
                                    {order.reviewed ? (
                                      <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">Reviewed</span>
                                    ) : (
                                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Awaiting review</span>
                                    )}
                                  </div>

                                  {!order.reviewed ? (
                                    <div className="mt-4 space-y-4">
                                      <div className="flex items-center gap-3">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button
                                            key={`${order.id}-star-${star}`}
                                            type="button"
                                            onClick={() => setReviewRating(star)}
                                            className={`text-2xl transition ${star <= reviewRating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
                                            aria-label={`Rate ${star} out of 5`}
                                          >
                                            ★
                                          </button>
                                        ))}
                                        <span className="text-sm font-semibold text-slate-700">{reviewRating}/5</span>
                                      </div>

                                      <textarea
                                        rows="3"
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Tell us about the item quality, seller experience, and pickup process..."
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => handleSubmitReview(order.id)}
                                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                      >
                                        Submit Review
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="mt-4 text-sm text-emerald-700">Your review has already been submitted for this order.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 4: Payments */}
                {buyerTab === 'payments' && (
                  <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Transactions & Wallet</h3>
                        <div className="space-y-4">
                          <div className="rounded-2xl bg-sky-50/40 border border-sky-100 p-4">
                            <p className="text-xs text-sky-600 font-semibold uppercase">Wallet Balance</p>
                            <p className="mt-2 text-3xl font-black text-slate-900">{formatETB(currentWalletBalance)}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-500 font-semibold uppercase">Recent Transaction</p>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 border border-slate-200">Live</span>
                            </div>
                            <p className="text-md font-semibold text-slate-800 mt-2">{recentTransactionText}</p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Transaction Ledger</h4>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{transactionLedger.length} records</span>
                          </div>
                          <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                            {transactionLedger.map((tx) => {
                              const amount = Number(tx.amount ?? tx.value ?? 0);
                              const isDeposit = amount >= 0;

                              return (
                                <div key={tx.id || tx.hash || `${tx.label}-${tx.date}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{tx.label || tx.type || 'Transaction'}</p>
                                      <p className="mt-1 text-xs text-slate-500">{tx.date || '2026-08-13'} • {tx.status || 'Successful'}</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${isDeposit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                      {isDeposit ? 'Deposit' : 'Purchase'}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between">
                                    <span className={`text-lg font-black ${isDeposit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                      {isDeposit ? '+' : '-'}{formatETB(Math.abs(amount))}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500">Hash: {tx.hash || 'N/A'}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Deposit via Chapa</h3>
                        <p className="text-sm text-slate-500">Top up your wallet securely through Chapa checkout.</p>
                        <form onSubmit={handleDepositSubmit} className="mt-5 space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700">Amount (ETB)</label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              placeholder="Enter amount to deposit"
                              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                            />
                          </div>
                          {depositError && <p className="text-sm text-red-600">{depositError}</p>}
                          <button
                            type="submit"
                            disabled={depositLoading}
                            className="w-full rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition disabled:cursor-not-allowed disabled:bg-emerald-300"
                          >
                            {depositLoading ? 'Redirecting to Chapa…' : 'Deposit via Chapa'}
                          </button>
                          <p className="text-xs text-slate-500">Your wallet is protected by a secure, student-friendly payment flow.</p>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ገጽ 3፦ የሻጭ ሰሌዳ - አዲስ ምርት መለጠፊያ (Seller Hub) */}
            {activeTab === 'seller' && (
              <SellerOperationsCenter
                sellerData={sellerData}
                myListings={myListings}
                setMyListings={setMyListings}
                setSellerData={setSellerData}
                onAddProduct={() => setShowProductModal(true)}
                onNavigate={onTabChange}
              />
            )}

            {false && activeTab === 'seller' && (() => {
              const sellerFallbackStats = {
                totalListings: 8,
                receivedOrders: 12,
                totalRevenue: 8450,
                pendingOrders: 3,
              };

              const sellerStats = {
                totalListings: myListings.length || sellerData?.totalListings || sellerFallbackStats.totalListings,
                receivedOrders: sellerData?.receivedOrders || sellerFallbackStats.receivedOrders,
                totalRevenue: sellerData?.totalRevenue || sellerFallbackStats.totalRevenue,
                pendingOrders: sellerData?.pendingOrders || sellerFallbackStats.pendingOrders,
              };

              const listingRows = Array.isArray(sellerData?.activeListings) && sellerData.activeListings.length
                ? sellerData.activeListings
                : myListings.length
                  ? myListings
                  : [];

              const incomingOrders = Array.isArray(sellerData?.incomingOrders) && sellerData.incomingOrders.length
                ? sellerData.incomingOrders
                : [
                  { id: 'ORD-2048', customerId: 'STU-1048', product: 'Dell XPS 13', price: 18500, status: 'Accepted' },
                  { id: 'ORD-2050', customerId: 'STU-2047', product: 'Biology Lab Manual', price: 950, status: 'Preparing' },
                  { id: 'ORD-2052', customerId: 'STU-3122', product: 'Campus Backpack', price: 1350, status: 'Pending' },
                ];

              const topProducts = [...listingRows]
                .map((item, index) => ({
                  ...item,
                  views: Number(item.views ?? item.views_count ?? (index + 1) * 220 + 120),
                  likes: Number(item.likes ?? item.likes_count ?? (index + 1) * 35),
                  orders: Number(item.orders ?? item.order_count ?? (index + 1) * 3),
                }))
                .sort((a, b) => (b.views + b.orders * 18) - (a.views + a.orders * 18))
                .slice(0, 3);

              const handleSellerOrderAction = (orderId, nextStatus) => {
                const targetId = String(orderId);
                setSellerData((prev) => ({
                  ...prev,
                  incomingOrders: Array.isArray(prev.incomingOrders)
                    ? prev.incomingOrders.map((order) =>
                      String(order.id ?? order.order_id ?? order.orderId) === targetId
                        ? { ...order, status: nextStatus }
                        : order,
                    )
                    : [],
                }));
              };

              const sellerKpis = [
                { label: 'My Listings', value: sellerStats.totalListings, icon: '▣' },
                { label: 'Received Orders', value: sellerStats.receivedOrders, icon: '▤' },
                { label: 'Total Revenue', value: `${Number(sellerStats.totalRevenue).toLocaleString('en-US')} ETB`, icon: '◈' },
                { label: 'Pending Orders', value: sellerStats.pendingOrders, icon: '◔' },
              ];

              return (
                <div className="space-y-8">
                  <div className="grid gap-6 xl:grid-cols-4">
                    {sellerKpis.map((card) => (
                      <div key={card.label} className="group rounded-[24px] border border-sky-100 bg-sky-50/50 p-6 transition hover:shadow-lg hover:shadow-sky-200/40">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                            <p className="mt-4 text-3xl font-bold text-slate-950">{card.value}</p>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-600 text-xl">
                            {card.icon}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-950">My Listings</h3>
                          <p className="text-sm text-slate-500">Keep your stock current and ready for campus buyers.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowProductModal(true)}
                          className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition"
                        >
                          + Add Product
                        </button>
                      </div>

                      {listingRows.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-3xl">📦</div>
                          <p className="mt-4 text-lg font-semibold text-slate-900">No active listings yet</p>
                          <p className="mt-2 text-sm text-slate-500">Add your first item so buyers can discover it on campus.</p>
                          <button
                            type="button"
                            onClick={() => setShowProductModal(true)}
                            className="mt-5 inline-flex items-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition"
                          >
                            + Add Product
                          </button>
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4">
                          {listingRows.map((item) => (
                            <div key={item.id ?? item.product_id ?? item.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center gap-4">
                                <div className="h-[60px] w-[60px] overflow-hidden rounded-[18px] bg-slate-100">
                                  <img
                                    src={item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80'}
                                    alt={item.title || 'Listing'}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80';
                                    }}
                                    className="h-full w-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="truncate text-base font-bold text-slate-900">{item.title || item.name || 'Untitled listing'}</p>
                                      <p className="text-xs text-slate-500">{item.category || 'General'} · {item.subcategory || 'Campus item'}</p>
                                    </div>
                                    <p className="text-sm font-bold text-emerald-600">{Number(item.price ?? 0).toLocaleString('en-US')} ETB</p>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span>Views: {item.views ?? item.view_count ?? 148}</span>
                                    <span>Likes: {item.likes ?? item.like_count ?? 24}</span>
                                    <span>Orders: {item.orders ?? item.order_count ?? 3}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">Edit</button>
                                <button type="button" className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition">View</button>
                                <button type="button" className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-950">Incoming Orders</h3>
                          <p className="text-sm text-slate-500">Customer orders waiting for action.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Queue</span>
                      </div>

                      {incomingOrders.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                          <p className="text-lg font-semibold text-slate-900">No incoming orders yet</p>
                          <p className="mt-2 text-sm text-slate-500">Your customer orders will appear here once they start purchasing.</p>
                        </div>
                      ) : (
                        <div className="mt-6 overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-y-2 text-left">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                <th className="pb-2 pr-4">Order ID</th>
                                <th className="pb-2 pr-4">Customer ID</th>
                                <th className="pb-2 pr-4">Product</th>
                                <th className="pb-2 pr-4">Price</th>
                                <th className="pb-2 pr-4">Status</th>
                                <th className="pb-2 pr-4">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomingOrders.map((order) => {
                                const orderKey = order.id ?? order.order_id ?? order.orderId;
                                const nextStatuses = ['Accept', 'Reject', 'Mark as Preparing', 'Mark as Ready for Pickup', 'Mark as Delivered'];

                                return (
                                  <tr key={orderKey} className="rounded-2xl border border-slate-200 bg-slate-50">
                                    <td className="py-3 pr-4 text-sm font-semibold text-slate-900">{orderKey}</td>
                                    <td className="py-3 pr-4 text-sm text-slate-700">{order.customerId ?? order.customer_id ?? 'STU-0000'}</td>
                                    <td className="py-3 pr-4 text-sm text-slate-700">{order.product ?? order.productName ?? order.title ?? 'Campus item'}</td>
                                    <td className="py-3 pr-4 text-sm font-semibold text-slate-900">{Number(order.price ?? 0).toLocaleString('en-US')} ETB</td>
                                    <td className="py-3 pr-4">
                                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${order.status === 'Pending' ? 'bg-amber-100 text-amber-700' : order.status === 'Accepted' || order.status === 'Preparing' || order.status === 'Ready for Pickup' || order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {order.status || 'Pending'}
                                      </span>
                                    </td>
                                    <td className="py-3 pr-4">
                                      <div className="flex flex-wrap gap-2">
                                        {nextStatuses.map((status) => (
                                          <button
                                            key={`${orderKey}-${status}`}
                                            type="button"
                                            onClick={() => handleSellerOrderAction(orderKey, status)}
                                            className="rounded-full border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 transition"
                                          >
                                            {status}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-950">Sales Overview</h3>
                      <div className="mt-5 space-y-4">
                        <div className="rounded-[20px] bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Earnings</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div>
                              <p className="text-xs text-slate-500">Today</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">450 ETB</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">This Week</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">2,450 ETB</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">This Month</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">8,450 ETB</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[20px] bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Order Status</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-slate-500">Total</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">{sellerStats.receivedOrders}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Completed</p>
                              <p className="mt-1 text-lg font-bold text-emerald-600">{Math.max(0, sellerStats.receivedOrders - 3)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Pending</p>
                              <p className="mt-1 text-lg font-bold text-amber-600">{sellerStats.pendingOrders}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Cancelled</p>
                              <p className="mt-1 text-lg font-bold text-rose-600">2</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-950">Top Performing Products</h3>
                      <div className="mt-5 space-y-4">
                        {topProducts.length === 0 ? (
                          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                            No metrics available yet.
                          </div>
                        ) : (
                          topProducts.map((item, index) => (
                            <div key={item.id ?? `${item.title}-${index}`} className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
                                #{index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                <p className="text-xs text-slate-500">{item.views ?? 0} views · {item.orders ?? 0} sales</p>
                              </div>
                              <span className="text-sm font-bold text-emerald-600">{Number(item.price ?? 0).toLocaleString('en-US')} ETB</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'ai-advisor' && (
              <div className="space-y-6">
                {/* Main AI Chat Container */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    {/* Header with Status & Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-950">Academic Defense AI Advisor</h3>
                        <p className="text-sm text-slate-500 mt-1">Expert guidance on study materials, pricing strategies, and campus resources for your defense readiness.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                          🟢 Active
                        </span>
                        <button
                          type="button"
                          onClick={handleClearChat}
                          className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95"
                          title="Clear Chat"
                        >
                          🗑️ Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleClearChat();
                            setAiInput('');
                          }}
                          className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95"
                          title="New Conversation"
                        >
                          ✨ New
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
                            if (lastAssistantMsg) {
                              navigator.clipboard.writeText(lastAssistantMsg.text);
                              alert('Response copied to clipboard!');
                            }
                          }}
                          className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95"
                          title="Copy Response"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>

                    {/* Quick-Start Chips - Dynamic Prompts */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Quick Start Prompts</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handleAiSend(prompt)}
                            className="group rounded-full border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100 px-4 py-2.5 text-xs font-semibold text-sky-700 shadow-sm hover:shadow-lg hover:border-sky-400 hover:from-sky-100 hover:to-sky-200 transition-all active:scale-95"
                          >
                            <span>{prompt}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAiSend('🎓 Defense tips for ' + (user?.department || 'my field'))}
                          className="group rounded-full border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 px-4 py-2.5 text-xs font-semibold text-violet-700 shadow-sm hover:shadow-lg hover:border-violet-400 transition-all active:scale-95"
                        >
                          🎓 Defense Tips
                        </button>
                      </div>
                    </div>

                    {/* Chat History */}
                    <div className="rounded-[28px] border border-slate-200 bg-sky-50 p-5 h-[480px] flex flex-col">
                      <div ref={aiScrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {chatHistory.map((message, index) => {
                          const productMatches = message.role === 'assistant' ? parseInlineProductCards(message.text) : [];
                          const renderedText = productMatches.length ? message.text.replace(/\[PRODUCT:[^\]]+\]/g, '') : message.text;

                          return (
                            <div key={index} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-6 shadow-md ${message.role === 'assistant' ? 'bg-gradient-to-br from-white to-slate-50 text-slate-900 border border-slate-200' : 'bg-emerald-500 text-white'}`}>
                                {renderedText && <div className="whitespace-pre-wrap font-medium">{renderedText}</div>}

                                {message.product_id && message.product && (
                                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-slate-900">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Discussing Item</p>
                                    <p className="mt-1 text-sm font-bold">{message.product.title}</p>
                                    {message.product.price !== undefined && (
                                      <p className="mt-1 text-xs font-semibold text-emerald-700">{message.product.price} ETB</p>
                                    )}
                                  </div>
                                )}

                                {/* Dynamic Product Cards */}
                                {productMatches.length > 0 && (
                                  <div className="mt-4 space-y-3">
                                    {productMatches.map((product, pIdx) => {
                                      const productObj = recommendedProducts.find(p => p.id === product.id) || {};
                                      return (
                                        <div key={`${product.id}-${pIdx}`} className="rounded-[20px] border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-4 text-slate-900 shadow-lg hover:shadow-xl hover:border-emerald-300 transition-all">
                                          <div className="flex items-start gap-3">
                                            {/* Product Image */}
                                            <div className="flex-shrink-0">
                                              <div className="h-16 w-16 rounded-[14px] bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden">
                                                {productObj.image ? (
                                                  <img src={productObj.image} alt={product.title} className="h-full w-full object-cover" />
                                                ) : (
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                  </svg>
                                                )}
                                              </div>
                                            </div>
                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between gap-2 mb-2">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 rounded-full px-2.5 py-0.5">✨ AI Recommended</p>
                                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 whitespace-nowrap">{product.price} ETB</span>
                                              </div>
                                              <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{product.title}</h4>
                                              {productObj.category && <p className="text-[11px] text-slate-500 mt-1">{productObj.category}</p>}
                                            </div>
                                          </div>
                                          <div className="flex gap-2 mt-3">
                                            <button
                                              type="button"
                                              onClick={() => handleAddToCartFromSearch(product.id)}
                                              className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all"
                                            >
                                              🛒 Add to Cart
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleViewProductFromChat(message.product_id || product.id)}
                                              className="flex-1 rounded-full border-2 border-sky-300 bg-sky-50 hover:bg-sky-100 px-3 py-2.5 text-xs font-semibold text-sky-700 transition-all"
                                            >
                                              👁️ View
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Typing Indicator */}
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="rounded-3xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-600 shadow-md">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
                                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500 [animation-delay:150ms]" />
                                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500 [animation-delay:300ms]" />
                                <span className="ml-2 text-slate-500 font-medium">🤖 Thinking…</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input Box */}
                      <div className="mt-4 flex items-center gap-3 rounded-full border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-4 shadow-md focus-within:shadow-lg focus-within:border-emerald-300 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          placeholder="Ask about study resources, exam prep, project materials…"
                          className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAiSend();
                            }
                          }}
                        />
                        {isTyping ? (
                          <button type="button" onClick={handleStopAiGeneration} className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-600">Stop</button>
                        ) : (
                          <button type="button" onClick={() => handleAiSend()} disabled={!aiInput.trim()} className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16027068 C3.50612381,-0.1 2.40999899,0.0570974055 1.77946707,0.4870386 C0.994623095,1.11 0.8376543,2.20 1.15159189,3.1 L3.03521743,9.5 C3.03521743,9.68012422 3.34915502,9.83721169 3.50612381,9.83721169 L16.6915026,10.6227347 C16.6915026,10.6227347 17.1624089,10.6227347 17.1624089,11.0526759 C17.1624089,11.4860699 16.6915026,11.4860699 16.6915026,12.4744748 Z" /></svg>
                            Send
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended for You Widget */}
                {recommendedProducts.length > 0 && (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-slate-950">📚 Recommended for You</h4>
                        <p className="text-xs text-slate-500 mt-1">Based on your {user?.department || 'department'}</p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.1em] text-sky-600 bg-sky-100 rounded-full px-3 py-1.5">
                        {recommendedProducts.length} Items
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {recommendedProducts.slice(0, 4).map((item) => (
                        <div key={item.id} className="group rounded-[20px] border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-4 hover:shadow-lg transition-all">
                          <div className="relative mb-3 h-32 w-full overflow-hidden rounded-[14px] bg-slate-100 border border-slate-200">
                            {item.image ? (
                              <img src={item.image} alt={item.title} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2">{item.title}</h5>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-bold text-emerald-600">{item.price} ETB</span>
                            {item.category && <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{item.category}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddToCartFromSearch(item.id)}
                            className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all shadow-sm hover:shadow-md"
                          >
                            🛒 Add to Cart
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="mx-auto w-full max-w-[1300px] px-0 py-2 sm:px-2">
                <div className="flex h-auto min-h-[620px] w-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white sm:rounded-[32px] lg:h-[620px] lg:flex-row">
                  <aside className={`max-h-[360px] min-h-[280px] w-full shrink-0 flex-col justify-between border-b border-slate-100 p-4 sm:p-6 lg:flex lg:h-full lg:max-h-none lg:min-h-0 lg:w-[360px] lg:border-b-0 lg:border-r ${mobileChatView === 'list' ? 'flex' : 'hidden'}`}>
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Peer chat</p>
                          <h3 className="mt-1 text-xl font-bold text-slate-900">Messages</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddChatModal(true)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-600 shadow-sm hover:bg-slate-100"
                          aria-label="New chat"
                        >
                          +
                        </button>
                      </div>

                      <label className="relative mt-4 block">
                        <span className="sr-only">Search conversations</span>
                        <input
                          type="search"
                          value={conversationSearch}
                          onChange={(event) => setConversationSearch(event.target.value)}
                          placeholder="Search conversations..."
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span>
                      </label>

                      <div className="mt-4 max-h-[190px] space-y-3 overflow-y-auto lg:max-h-none">
                        {filteredConversations.length > 0 ? filteredConversations.map((conversation) => {
                          const isActive = conversation.id === activeConversationId;
                          const participantOnline = conversation.status === 'online';

                          return (
                            <button
                              key={conversation.id}
                              type="button"
                              onClick={() => {
                                setActiveConversationId(conversation.id);
                                setActiveChatMessages([]);
                                setMobileChatView('chat');
                              }}
                              className={`relative flex w-full items-center gap-3 rounded-[24px] border px-3 py-3 text-left transition ${isActive ? 'border-sky-200 bg-sky-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-100'}`}
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={getStudentAvatar(conversation.studentId || conversation.student_id || String(conversation.id || '').replace(/^conv-/, ''))}
                                  alt={conversation.name}
                                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                                />
                                <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${participantOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-bold text-slate-900">{conversation.name}</p>
                                  <span className="shrink-0 text-[10px] text-slate-400">{conversation.timestamp}</span>
                                </div>
                                <p className="mt-1 truncate pr-7 text-xs text-slate-500">{conversation.lastMessage}</p>
                              </div>
                              {Number(conversation.unread) > 0 && (
                                <span className="absolute right-3 top-1/2 inline-flex h-5 min-w-[20px] -translate-y-1/2 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
                                  {conversation.unread}
                                </span>
                              )}
                            </button>
                          );
                        }) : (
                          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">No conversations found.</p>
                        )}
                      </div>
                    </div>
                  </aside>

                  <section className={`relative h-[600px] min-w-0 flex-1 flex-col justify-between bg-slate-50/25 p-4 sm:p-6 lg:flex ${mobileChatView === 'chat' ? 'flex' : 'hidden'}`}>
                    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-4">
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <button type="button" onClick={() => setMobileChatView('list')} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to conversations">←</button>
                        <div className="relative shrink-0">
                          <img
                            src={getStudentAvatar(activeConversation?.studentId || activeConversation?.student_id || String(activeConversation?.id || '').replace(/^conv-/, ''))}
                            alt={activeConversation?.name || 'Student'}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${activeConversation?.status === 'online' ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900">{activeConversation?.name || 'Student'}</p>
                          {peerIsTyping ? (
                            <p className="text-xs font-semibold text-sky-600 animate-pulse">{activeConversation?.name || 'Student'} is typing...</p>
                          ) : (
                            <p className="text-xs text-slate-500">{activeConversation?.status === 'online' ? '🟢 Online' : '⚪ Offline'}</p>
                          )}
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowChatDropdown((visible) => !visible)}
                          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
                          aria-label="Conversation actions"
                        >
                          ⋮
                        </button>
                        {showChatDropdown && (
                          <div className="absolute right-0 top-12 z-10 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                            <button type="button" onClick={() => handleChatMenuAction('profile')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">View Profile</button>
                            <button type="button" onClick={() => handleChatMenuAction('product')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">View Product</button>
                            <button type="button" onClick={() => handleChatMenuAction('report')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Report User</button>
                            <button type="button" onClick={() => handleChatMenuAction('block')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Block User</button>
                            <button type="button" onClick={() => handleChatMenuAction('delete')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">Delete Conversation</button>
                          </div>
                        )}
                      </div>
                    </header>

                    <div className="min-h-0 flex flex-1 flex-col overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-2 py-4 pb-24">
                      {activeChatMessages.map((message) => {
                        const isOwnMessage = message.sender_id
                          ? String(message.sender_id) === String(user?.studentId)
                          : message.sender === 'me';
                        const messageDate = new Date(message.created_at || message.time);
                        const messageTime = Number.isNaN(messageDate.getTime())
                          ? message.time || 'Unknown time'
                          : messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const product = message.productId ? productDetails[message.productId] : null;

                        return (
                          <div key={message.id}>
                            <div className={`mb-4 flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                              {!isOwnMessage && (
                                <img src={getStudentAvatar(message.sender_id || activeConversation?.studentId)} alt={activeConversation?.name || 'Student'} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                              )}
                              <div className={`max-w-[78%] rounded-[22px] px-4 py-3 shadow-sm ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                <p className="text-sm leading-6">{message.text}</p>
                                <div className={`mt-2 flex items-center gap-1 text-[10px] ${isOwnMessage ? 'text-blue-100' : 'text-slate-500'}`}>
                                  <span>{messageTime}</span>
                                  {isOwnMessage && <span>{message.is_read ? '✓✓' : '✓'}</span>}
                                </div>
                              </div>
                              {isOwnMessage && (
                                <img src={getStudentAvatar(user?.studentId)} alt={user?.name || 'You'} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                              )}
                            </div>

                            {product && (
                              <div className={`mb-4 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                <div className="w-full max-w-xs rounded-[24px] border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
                                  {product.image && <img src={product.image} alt={product.title} className="h-28 w-full rounded-2xl object-cover" />}
                                  <p className="mt-2 text-sm font-semibold">{product.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{product.category || 'Campus marketplace item'}</p>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-sm font-bold text-emerald-600">{product.price} ETB</span>
                                    <button
                                      type="button"
                                      onClick={() => handleViewProductFromChat(message.productId)}
                                      className="rounded-full bg-sky-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sky-700"
                                    >
                                      View Product
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {activeConversation?.product && (
                        <div className="order-first mb-5 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <img src={activeConversation.product.image} alt={activeConversation.product.title} className="h-16 w-16 rounded-2xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">{activeConversation.product.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{activeConversation.product.category || productDetails[activeConversation.product.id]?.category || 'Campus marketplace item'}</p>
                              <p className="mt-1 text-sm font-bold text-emerald-600">{Number(activeConversation.product.price).toLocaleString('en-US')} ETB</p>
                            </div>
                            <button type="button" onClick={() => handleViewProductFromChat(activeConversation.product.id)} className="shrink-0 rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">View Product</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-3 sm:p-4">
                      {isActiveConversationBlocked ? (
                        <div className="flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-200 px-4 py-4 text-sm font-semibold text-slate-500" role="status">
                          This conversation is blocked
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2 shadow-sm focus-within:border-sky-300 focus-within:bg-white sm:gap-3 sm:px-3">
                          <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-lg text-slate-600 shadow-sm hover:bg-slate-100" aria-label="Attach file">
                            📎
                            <input type="file" className="sr-only" />
                          </label>
                          <div className="relative shrink-0">
                            <button type="button" onClick={() => setShowEmojiPicker((visible) => !visible)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-600 shadow-sm hover:bg-slate-100" aria-label="Open emoji picker">😊</button>
                            {showEmojiPicker && (
                              <div className="absolute bottom-12 left-0 z-20 flex gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                                {['😀', '😂', '👍', '❤️', '🎉', '🙏'].map((emoji) => (
                                  <button key={emoji} type="button" onClick={() => { setTypingInput((value) => `${value}${emoji}`); setShowEmojiPicker(false); }} className="rounded-lg p-1.5 text-lg hover:bg-slate-100" aria-label={`Insert ${emoji}`}>{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            value={typingInput}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setTypingInput(nextValue);
                              const receiverId = activeConversation?.studentId || (String(activeConversation?.id || '').replace(/^conv-/, '') || null);
                              if (receiverId && socketRef.current?.readyState === WebSocket.OPEN) {
                                socketRef.current.send(JSON.stringify({ type: 'typing', receiver_id: receiverId, is_typing: Boolean(nextValue.trim()) }));
                              }
                            }}
                            onBlur={() => {
                              const receiverId = activeConversation?.studentId || (String(activeConversation?.id || '').replace(/^conv-/, '') || null);
                              if (receiverId && socketRef.current?.readyState === WebSocket.OPEN) {
                                socketRef.current.send(JSON.stringify({ type: 'typing', receiver_id: receiverId, is_typing: false }));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                sendChatMessage();
                              }
                            }}
                            placeholder="Type a message..."
                            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                          />
                          <button type="button" onClick={sendChatMessage} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white shadow-sm hover:bg-sky-700" aria-label="Send message">➤</button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {showProfileDetailsModal && activeConversation && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-details-title">
                <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={getStudentAvatar(activeConversation.studentId)} alt={activeConversation.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Verified student</p>
                        <h3 id="profile-details-title" className="mt-1 truncate text-xl font-bold text-slate-900">{activeConversation.name}</h3>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowProfileDetailsModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close profile details">✕</button>
                  </div>
                  <dl className="mt-5 space-y-3">
                    <div className="flex items-start justify-between gap-4"><dt className="text-sm text-slate-500">Full Name</dt><dd className="text-right text-sm font-semibold text-slate-900">{activeConversation.name || 'Not provided'}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt className="text-sm text-slate-500">College</dt><dd className="max-w-[65%] text-right text-sm font-semibold text-slate-900">{activeConversation.college || 'Not provided'}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt className="text-sm text-slate-500">Department</dt><dd className="max-w-[65%] text-right text-sm font-semibold text-slate-900">{activeConversation.department || 'Not provided'}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt className="text-sm text-slate-500">Student ID</dt><dd className="text-right text-sm font-semibold text-slate-900">{activeConversation.studentId || 'Not provided'}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt className="text-sm text-slate-500">Verification Status</dt><dd className="text-right text-sm font-semibold text-emerald-600">Verified campus student</dd></div>
                  </dl>
                  <button type="button" onClick={() => setShowProfileDetailsModal(false)} className="mt-6 w-full rounded-full bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700">Done</button>
                </div>
              </div>
            )}

            {showReportModal && activeConversation && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-user-title">
                <form onSubmit={handleReportSubmit} className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Safety report</p>
                      <h3 id="report-user-title" className="mt-1 text-xl font-bold text-slate-900">Submit Complaint</h3>
                      <p className="mt-1 text-sm text-slate-500">Report your concern about {activeConversation.name}.</p>
                    </div>
                    <button type="button" onClick={() => setShowReportModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close complaint form">✕</button>
                  </div>
                  <label htmlFor="chat-report-reason" className="mt-5 block text-sm font-semibold text-slate-700">Reason for reporting</label>
                  <textarea
                    id="chat-report-reason"
                    rows="5"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    placeholder="Explain what happened..."
                    className="mt-2 block w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
                    required
                  />
                  {reportStatus && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${reportStatus.startsWith('Your') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{reportStatus}</p>}
                  <div className="mt-5 flex gap-3">
                    <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={isSubmittingReport || !reportReason.trim()} className="flex-1 rounded-full bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmittingReport ? 'Submitting...' : 'Submit Complaint'}</button>
                  </div>
                </form>
              </div>
            )}

            {showAddChatModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Verified campus students">
                <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">New conversation</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">Verified campus students</h3>
                    </div>
                    <button type="button" onClick={() => setShowAddChatModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close student directory">✕</button>
                  </div>
                  <div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto">
                    {conversationsList.map((conversation) => {
                      const studentId = conversation.studentId || conversation.student_id || String(conversation.id || '').replace(/^conv-/, '');
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => {
                            setActiveConversationId(conversation.id);
                            setActiveChatMessages([]);
                            setShowAddChatModal(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-sky-200 hover:bg-sky-50"
                        >
                          <img src={getStudentAvatar(studentId)} alt={conversation.name} className="h-11 w-11 rounded-full object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-900">{conversation.name}</span>
                            <span className="mt-1 block text-xs text-emerald-600">✓ Verified campus student</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <NotificationCenter
                notifications={safeNotifications}
                unreadCount={unreadCount}
                isMarkingRead={isMarkingRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onNavigate={(tab) => setActiveTab(tab)}
                onBuyerOrders={() => {
                  setBuyerTab('orders');
                  setActiveTab('buyer');
                }}
              />
            )}

            {false && activeTab === 'notifications' && (
              <div className="mx-auto max-w-5xl px-4 py-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Notification Center</p>
                      <h3 className="mt-3 text-2xl font-bold text-slate-950">Campus Alerts</h3>
                      <p className="mt-2 max-w-2xl text-sm text-slate-500">
                        Stay on top of buyer messages, order updates, and admin announcements in one polished feed.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span>{safeNotifications.length} total</span>
                        <span className="text-slate-400">•</span>
                        <span>{unreadCount} unread</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        disabled={safeNotifications.length === 0 || isMarkingRead}
                        className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isMarkingRead ? 'Marking…' : 'Mark all as read'}
                      </button>
                    </div>
                  </div>

                  {safeNotifications.length === 0 ? (
                    <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-3xl">🔔</div>
                      <p className="mt-5 text-lg font-semibold text-slate-900">Nothing new here yet</p>
                      <p className="mt-2 text-sm text-slate-500">
                        When buyers message you or orders arrive, your notifications will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {Array.isArray(notifications) && notifications.map((notif) => {
                        const typeIcon = (() => {
                          switch (notif.type) {
                            case 'order':
                              return '🛒';
                            case 'message':
                              return '✉️';
                            case 'admin':
                              return '⚙️';
                            case 'system':
                              return 'ℹ️';
                            default:
                              return '🔔';
                          }
                        })();

                        return (
                          <article key={notif.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-center gap-4">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-100 text-2xl">
                                  {typeIcon}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{notif.title || 'Campus update'}</p>
                                  <p className="mt-1 text-sm text-slate-600">{notif.message}</p>
                                </div>
                              </div>

                              <div className="flex flex-col items-start gap-2 sm:items-end">
                                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${notif.read ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {notif.read ? 'Read' : 'New'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {new Date(notif.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="capitalize">{notif.type || 'update'}</span>
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-slate-300" />
                              <span>{notif.category || 'Campus feed'}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsCenter
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                profileForm={profileForm}
                handleProfileFieldChange={handleProfileFieldChange}
                handleProfileSubmit={handleProfileSubmit}
                profileMessage={profileMessage}
                profileSaving={profileSaving}
                user={user}
                avatarUrl={avatarUrl}
                avatarFile={avatarFile}
                setAvatarFile={setAvatarFile}
                handleAvatarUploadSubmit={handleAvatarUploadSubmit}
                avatarUploadMessage={avatarUploadMessage}
                avatarUploading={avatarUploading}
                universityStructure={universityStructure}
                currentWalletBalance={currentWalletBalance}
                transactionLedger={transactionLedger}
                onNavigate={setActiveTab}
                blockedUsers={blockedUsers}
                onUnblockUser={handleUnblockUser}
              />
            )}

          </section>
        </main>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">List a New Product</h2>
                <p className="mt-1 text-sm text-slate-500">Fill in the details below to add your item to the campus marketplace.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-5 px-6 py-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={productForm.title}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                    placeholder="Enter product title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Price (ETB)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value, subcategory: '' }))}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  >
                    <option value="">Select Category</option>
                    {dbCategories.map((category) => (
                      <option key={category.id || category.name} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Subcategory</label>
                  <select
                    value={productForm.subcategory}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, subcategory: e.target.value }))}
                    disabled={!productForm.category}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select Subcategory</option>
                    {dbCategories.find((cat) => cat.name === productForm.category)?.items?.map((subcategory) => (
                      <option key={subcategory.name} value={subcategory.name}>{subcategory.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Product Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProductForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
                    className="mt-2 block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  rows="4"
                  value={productForm.description}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  placeholder="Describe your product, condition, and any important details."
                />
              </div>

              {(productError || productSuccessMsg) && (
                <p className={`text-sm ${productError ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {productError || productSuccessMsg}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={productSubmitting}
                  className="inline-flex justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {productSubmitting ? 'Posting...' : 'Post Product'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;