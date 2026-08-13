import { useState, useEffect, useRef } from 'react';

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


function StudentDashboard({ user, onLogout, initialTab = 'home', onTabChange, onUserUpdate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // ምስል 2 ላይ የተጠየቀው የጎን ፓነል መክፈቻ/መዝጊያ ስቴት
  const [activeTab, setActiveTab] = useState(initialTab); // የጎን መቆጣጠሪያ ታብ
  const [buyerTab, setBuyerTab] = useState('search'); // የገዢዎች ንዑስ ታብ (Search, Wishlist, Cart, Orders, Payments)

  const [notifications, setNotifications] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
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
    title: '',
    category: '',
    subcategory: '',
    price: '',
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

  const cartTotal = cart.reduce((total, item) => total + normalizePrice(item.price) * (item.quantity || 1), 0);

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

  const fetchProducts = async ({ search, category, subcategory } = {}) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
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
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/student/listings?student_id=${encodeURIComponent(user.studentId)}`);
      if (!res.ok) throw new Error('Failed to load your listings');
      const listingData = await res.json();
      setMyListings(Array.isArray(listingData) ? listingData : []);
    } catch (err) {
      console.error('Error fetching student listings:', err);
      setMyListings([]);
    }
  };

  const fetchSellerDashboardData = async () => {
    if (!user?.studentId) {
      setSellerData({
        totalListings: 0,
        receivedOrders: 0,
        totalRevenue: 0,
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
        totalListings: Number(data.totalListings) || 0,
        receivedOrders: Number(data.receivedOrders) || 0,
        totalRevenue: Number(data.totalRevenue) || 0,
        pendingOrders: Number(data.pendingOrders) || 0,
        incomingOrders: Array.isArray(data.incomingOrders) ? data.incomingOrders : [],
        activeListings: Array.isArray(data.activeListings) ? data.activeListings : []
      });
    } catch (err) {
      console.error('Error fetching seller dashboard data:', err);
      setSellerData({
        totalListings: 0,
        receivedOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        incomingOrders: [],
        activeListings: []
      });
    }
  };

  const resetSearchFilters = () => {
    setSearchCategory('');
    setSearchSubcategory('');
    setSearchQuery('');
  };

  // 1. መተግበሪያው ሲነሳ ወይም በገጾች መካከል ሲቀያየሩ መረጃዎችን ከዳታቤዝ መጥሪያ (Fetch API Data)
  useEffect(() => {
    // ሀ. ምድቦችን ከብመቫእ መጥሪያ (Fetch Categories)
    const fetchModalDropdownData = async () => {
      try {
        const [catRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/categories'),
        ]);

        if (catRes && catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
          setDbCategories(catData);
        }
      } catch (err) {
        console.error("Error fetching dropdown data:", err);
      }
    };

    fetchModalDropdownData();

    const loadSearchDefaults = async () => {
      if (activeTab === 'buyer' && buyerTab === 'search') {
        await fetchProducts({ search: searchQuery, category: searchCategory, subcategory: searchSubcategory });
      }
    };

    if (!user?.studentId) {
      loadSearchDefaults();
      return;
    }

    if (user?.avatarUrl) {
      const sep = user.avatarUrl.includes('?') ? '&' : '?';
      setAvatarUrl(`${user.avatarUrl}${sep}t=${new Date().getTime()}`);
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // ሀ. ኖቲፊኬሽኖችን መጥሪያ (Fetch Notifications)
        const notifRes = await fetch(`http://127.0.0.1:8000/api/student/notifications?student_id=${user.studentId}`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(notifData);
        }

        // ለ. የዊሽሊስት እቃዎችን መጥሪያ (Fetch Wishlist)
        const wishRes = await fetch(`http://127.0.0.1:8000/api/student/wishlist?student_id=${user.studentId}`);
        if (wishRes.ok) {
          const wishData = await wishRes.json();
          setWishlist(wishData);
        }

        // ሐ. የካርት እቃዎችን መጥሪያ (Fetch Cart)
        const cartRes = await fetch(`http://127.0.0.1:8000/api/student/cart?student_id=${user.studentId}`);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCart(cartData.items || []);
        }

        // መ. የትዕዛዞችን ታሪክ መጥሪያ (Fetch Orders)
        const orderRes = await fetch(`http://127.0.0.1:8000/api/student/orders?student_id=${user.studentId}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrders(orderData);
        }

        // ሠ. የዋሌት ቀሪ ሂሳብ እና የክፍያ ታሪክ መጥሪያ (Fetch Payments)
        const payRes = await fetch(`http://127.0.0.1:8000/api/student/payments?student_id=${user.studentId}`);
        if (payRes.ok) {
          const payData = await payRes.json();
          setPaymentInfo(payData);
        }

        // ረ. አጠቃላይ የቤት ገጽ መረጃዎችን መጥሪያ (Fetch Highlights)
        const highlightRes = await fetch(`http://127.0.0.1:8000/api/student/highlights?student_id=${user.studentId}`);
        if (highlightRes.ok) {
          const highlightData = await highlightRes.json();
          setHighlights(highlightData);
        }

        const [recommendationRes, activityRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/student/recommendations?student_id=${encodeURIComponent(user.studentId)}`),
          fetch(`http://127.0.0.1:8000/api/student/recent-activity?student_id=${encodeURIComponent(user.studentId)}`),
        ]);

        if (recommendationRes.ok) {
          const recommendationData = await recommendationRes.json();
          setRecommendedProducts(Array.isArray(recommendationData) ? recommendationData : (recommendationData.recommendations || []));
        }

        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setRecentCampusActivity(Array.isArray(activityData) ? activityData : (activityData.items || []));
        }

        await fetchMyListings();
        await fetchSellerDashboardData();
        await loadSearchDefaults();
      } catch (err) {
        console.error("Error fetching database records for student:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, activeTab, buyerTab, searchCategory, searchQuery, searchSubcategory]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
        const res = await fetch(`http://127.0.0.1:8000/api/student/payments?student_id=${encodeURIComponent(user.studentId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const nextBalance = Number(data.balance ?? data.walletBalance ?? data.wallet_balance ?? 0);

        if (isMounted) {
          setWalletBalance(Number.isFinite(nextBalance) ? nextBalance : 0);
        }
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
      }
    };

    fetchUnreadCounts();
    fetchWalletBalance();

    return () => {
      isMounted = false;
    };
  }, [user?.studentId]);

  useEffect(() => {
    if (!notifications.length) {
      setUnreadMessageCount(0);
      return;
    }

    const messageCount = notifications.filter((notification) => {
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
    await fetchProducts({ search: searchQuery, category: searchCategory, subcategory: searchSubcategory });
    setBuyerTab('search');
  };

  const handleAddToWishlist = async (productId) => {
    setWishlistMessage('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.studentId, product_id: productId })
      });
      if (res.ok) {
        setWishlistMessage('Added to wishlist.');
        setBuyerTab('wishlist');
      } else {
        setWishlistMessage('Could not add item to wishlist.');
      }
    } catch (err) {
      console.error('Error adding to wishlist:', err);
      setWishlistMessage('Connection error. Please try again.');
    }
  };

  const handleAddToCartFromSearch = async (productId) => {
    setCartMessage('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.studentId, product_id: productId })
      });
      if (res.ok) {
        setCartMessage('Added to cart.');
        setBuyerTab('cart');
      } else {
        setCartMessage('Could not add item to cart.');
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

  const handleSubmitReview = async () => {
    if (!reviewOrderId || !reviewComment.trim()) {
      setReviewFeedback('Please choose an order and add a comment.');
      return;
    }
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.studentId,
          order_id: reviewOrderId,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      if (res.ok) {
        setReviewFeedback('Review submitted. Thank you!');
        setOrders((prev) => prev.map((order) => order.id === reviewOrderId ? { ...order, reviewed: true } : order));
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

  const handleMoveToCart = async (wishlistItemId, productId) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/student/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.studentId, product_id: productId })
      });
      if (res.ok) {
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

  // 5. አዲስ ምርት (እቃ) መለጠፊያ (Post Product Handler)
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setProductError('');
    setProductSuccessMsg('');

    if (!productForm.title || !productForm.category || !productForm.price || !productForm.image) {
      setProductError('Please fill in Title, Category, Price and add an image.');
      return;
    }

    setProductSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', productForm.title);
      formData.append('category', productForm.category);
      formData.append('subcategory', productForm.subcategory || '');
      formData.append('price', productForm.price);
      formData.append('description', productForm.description || '');
      formData.append('student_id', user?.studentId || '');
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

      setProductSuccessMsg('Product posted successfully. Refreshing dashboard...');
      setProductForm({
        title: '',
        category: '',
        subcategory: '',
        price: '',
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

    try {
      const res = await fetch('http://127.0.0.1:8000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setChatHistory((prev) => [...prev, { role: 'assistant', text: data.detail || 'Sorry, I could not answer that right now.' }]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setChatHistory((prev) => [...prev, { role: 'assistant', text: 'Connection error. Please try again in a moment.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
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

  const unreadCount = notifications.filter((notif) => !notif.read).length;

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.studentId || notifications.length === 0) return;

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
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 relative flex overflow-x-hidden">

      {/* 1. የግራ የጎን መቆጣጠሪያ ፓነል (Responsive Collapsible Student Sidebar) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#111c3a] border-r border-slate-900/40 p-6 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.35)] sidebar-transition
        lg:static lg:flex lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-72'}
      `}>
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold border-b-2 border-white/80 w-fit pb-1">STUDENT DASHBOARD</p>
            <h1 className="mt-3 text-2xl font-bold text-white">Campus Portal</h1>
            {user?.is_verified && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
                Verified Student
              </span>
            )}
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer lg:flex hidden"
            title="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => { setActiveTab('home'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'home' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>Home</span>
            <svg className={`h-4 w-4 ${activeTab === 'home' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('buyer'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'buyer' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>Buyer Hub</span>
            <svg className={`h-4 w-4 ${activeTab === 'buyer' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('seller'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'seller' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>Seller Hub</span>
            <svg className={`h-4 w-4 ${activeTab === 'seller' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('messages'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'messages' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span className="flex items-center gap-3">
              <span>Messages</span>
              {unreadMessageCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-[#111c3a]">
                  {unreadMessageCount}
                </span>
              )}
            </span>
            <svg className={`h-4 w-4 ${activeTab === 'messages' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('ai-advisor'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'ai-advisor' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>AI Advisor</span>
            <svg className={`h-4 w-4 ${activeTab === 'ai-advisor' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('notifications'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'notifications' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span className="flex items-center gap-3">
              <span>Notifications</span>
              {unreadNotificationCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950 ring-2 ring-[#111c3a]">
                  {unreadNotificationCount}
                </span>
              )}
            </span>
            <svg className={`h-4 w-4 ${activeTab === 'notifications' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('profile'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'profile' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>Profile</span>
            <svg className={`h-4 w-4 ${activeTab === 'profile' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setActiveTab('settings'); }}
            className={`group rounded-2xl px-5 py-3 w-full flex items-center justify-between text-left text-sm font-semibold transition-all duration-200 ease-out ${activeTab === 'settings' ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-900/20 scale-[1.01]' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`}
          >
            <span>Settings</span>
            <svg className={`h-4 w-4 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>

        <div className="mt-auto pt-5">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/20 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span>Wallet</span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">Live</span>
            </div>
            <div className="mt-3 text-lg font-bold text-white">Wallet: {Number(walletBalance || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</div>
          </div>
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
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">

        {/* የላይኛው የእንኳን ደህና መጣህ ባር */}
        <div className="mb-6 flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Welcome back,</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-950">{user?.name || 'Student'}, here are your campus highlights</h3>

                {/* Highlights Grid */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-6">
                    <p className="text-xs font-semibold text-sky-600 uppercase">AI Picks</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{highlights.aiPicks || 0}</p>
                  </div>
                  <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-6">
                    <p className="text-xs font-semibold text-sky-600 uppercase">Latest Listings</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{highlights.latestListings || 0} items</p>
                  </div>
                  <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-6">
                    <p className="text-xs font-semibold text-sky-600 uppercase">Cart Value</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatETB(highlights.cartValue)}</p>
                  </div>
                  <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-6">
                    <p className="text-xs font-semibold text-sky-600 uppercase">Pending Messages</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{highlights.pendingMessages || 0}</p>
                  </div>
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
                  {['search', 'wishlist', 'cart', 'orders', 'payments'].map((tabName) => (
                    <button
                      key={tabName}
                      onClick={() => setBuyerTab(tabName)}
                      className={`rounded-full px-5 py-2.5 text-xs font-semibold transition border border-slate-200 cursor-pointer ${buyerTab === tabName ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                      {tabName === 'search' ? 'Search / Browse' : tabName.charAt(0).toUpperCase() + tabName.slice(1)}
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
                      <p className="text-sm text-slate-500">Move items into your cart or remove them when you're done browsing.</p>
                    </div>
                    {wishlistMessage && <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{wishlistMessage}</p>}
                  </div>
                  {wishlist.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">Your wishlist is empty.</p>
                  ) : (
                    <div className="space-y-3">
                      {wishlist.map((item) => (
                        <div key={item.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <p className="text-sm text-slate-500">{item.price}</p>
                            {item.category && <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.category}{item.subcategory ? ` • ${item.subcategory}` : ''}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button onClick={() => handleMoveToCart(item.id, item.product_id)} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">Move to Cart</button>
                            <button onClick={() => handleRemoveFromWishlist(item.id)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Remove</button>
                          </div>
                        </div>
                      ))}
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
                    <p className="text-sm text-slate-400 text-center py-6">Your cart is empty.</p>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <div key={item.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <p className="text-sm text-slate-500">Qty: {item.quantity || 1}</p>
                            <p className="text-sm text-slate-500">Seller: {item.seller || 'Campus Seller'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center justify-end">
                            <span className="text-lg font-bold text-slate-900">${normalizePrice(item.price) * (item.quantity || 1)}</span>
                            <button onClick={() => handleRemoveFromCart(item.id)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Remove</button>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                        <div className="flex items-center justify-between text-lg font-bold text-slate-900">
                          <span>Cart total</span>
                          <span>${cartTotal.toFixed(2)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">This total reflects your current cart items before checkout.</p>
                      </div>
                      <button onClick={handleCheckout} className="w-full rounded-full bg-emerald-500 py-3.5 font-bold text-white hover:bg-emerald-600 transition cursor-pointer">Checkout</button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: My Orders */}
              {buyerTab === 'orders' && (
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Your Orders</h3>
                      <p className="text-sm text-slate-500">Track delivery status and leave reviews for completed purchases.</p>
                    </div>
                    {reviewFeedback && <p className="rounded-full bg-sky-50 px-4 py-2 text-sm text-sky-700">{reviewFeedback}</p>}
                  </div>

                  {orders.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No orders found.</p>
                  ) : (
                    <div className="space-y-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm text-slate-700">
                          <thead className="border-b border-slate-200 text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Item</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Total</th>
                              <th className="px-4 py-3">Review</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((order) => (
                              <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-4 font-semibold text-slate-900">{order.title}</td>
                                <td className="px-4 py-4 text-slate-600">{order.status}</td>
                                <td className="px-4 py-4 font-bold text-slate-900">${normalizePrice(order.price)}</td>
                                <td className="px-4 py-4">
                                  {order.reviewed ? (
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Reviewed</span>
                                  ) : (
                                    <button onClick={() => setReviewOrderId(order.id)} className="rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">Write Review</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {reviewOrderId && (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                          <h4 className="text-lg font-semibold text-slate-900">Leave a review</h4>
                          <p className="text-sm text-slate-500 mt-1">Order: {orders.find((order) => order.id === reviewOrderId)?.title}</p>
                          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                            <textarea
                              rows="3"
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Share your experience with the seller or product"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition"
                            />
                            <div className="space-y-3">
                              <label className="block text-sm font-semibold text-slate-700">Rating</label>
                              <select
                                value={reviewRating}
                                onChange={(e) => setReviewRating(Number(e.target.value))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition"
                              >
                                {[5, 4, 3, 2, 1].map((rating) => (
                                  <option key={rating} value={rating}>{rating} Stars</option>
                                ))}
                              </select>
                              <button onClick={handleSubmitReview} className="w-full rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition">Submit Review</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Payments */}
              {buyerTab === 'payments' && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Payment History</h3>
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-sky-50/40 border border-sky-100 p-4">
                          <p className="text-xs text-sky-600 font-semibold uppercase">Wallet Balance</p>
                          <p className="text-2xl font-bold text-slate-900">${paymentInfo.balance}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4 border">
                          <p className="text-xs text-slate-500 font-semibold uppercase">Recent Transaction</p>
                          <p className="text-md font-semibold text-slate-800 mt-2">{paymentInfo.recentTx}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Deposit Funds via Chapa</h3>
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
                        <p className="text-xs text-slate-500">You will be redirected to Chapa to complete the secure payment.</p>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. ገጽ 3፦ የሻጭ ሰሌዳ - አዲስ ምርት መለጠፊያ (Seller Hub) */}
          {activeTab === 'seller' && (
            <div className="space-y-8">
              <div className="grid gap-6 xl:grid-cols-4">
                <div className="group bg-sky-50/50 border border-sky-100 p-6 rounded-[24px] transition hover:shadow-lg hover:shadow-sky-200/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">My Listings</p>
                      <p className="mt-4 text-3xl font-bold text-slate-950">{myListings.length}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-4V3H10v2H6a2 2 0 00-2 2v6m16 0l-8 5-8-5m16 0V7m0 6l-8 5-8-5" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="group bg-sky-50/50 border border-sky-100 p-6 rounded-[24px] transition hover:shadow-lg hover:shadow-sky-200/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Received Orders</p>
                      <p className="mt-4 text-3xl font-bold text-slate-950">{sellerData?.receivedOrders || 0}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 11h14l1 9H4l1-9z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="group bg-sky-50/50 border border-sky-100 p-6 rounded-[24px] transition hover:shadow-lg hover:shadow-sky-200/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Total Revenue</p>
                      <p className="mt-4 text-3xl font-bold text-slate-950">${sellerData?.totalRevenue?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.1 0-2 .9-2 2v2a2 2 0 002 2m0 0c1.1 0 2 .9 2 2v2m-2-8h4m-4 4h4m-4 4h4" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="group bg-sky-50/50 border border-sky-100 p-6 rounded-[24px] transition hover:shadow-lg hover:shadow-sky-200/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Pending Orders</p>
                      <p className="mt-4 text-3xl font-bold text-slate-950">{sellerData?.pendingOrders || 0}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">Incoming Customer Orders</h3>
                      <p className="text-sm text-slate-500">Track orders for items you’ve listed.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Live feed</span>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3 text-left">
                      <thead>
                        <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          <th className="pb-3 pr-6">CUSTOMER ID</th>
                          <th className="pb-3 pr-6">ITEM NAME</th>
                          <th className="pb-3 pr-6">STATUS</th>
                          <th className="pb-3 pr-6">PRICE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sellerData?.orders || []).map((order) => (
                          <tr key={order.id} className="bg-slate-50 rounded-3xl border border-slate-200">
                            <td className="py-4 pr-6 text-sm font-semibold text-slate-800">{order.customerId}</td>
                            <td className="py-4 pr-6 text-sm text-slate-600">{order.productTitle}</td>
                            <td className="py-4 pr-6">
                              <span className={`${order.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : order.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'} font-bold rounded-full px-3 py-1 text-xs`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-4 pr-6 text-sm font-semibold text-slate-900">${order.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">Active Listings</h3>
                      <p className="text-sm text-slate-500">Manage your active catalog at a glance.</p>
                    </div>
                    <button
                      onClick={() => setShowProductModal(true)}
                      className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition"
                    >
                      + Add Product
                    </button>
                  </div>

                  <div className="mt-6 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 h-[540px]">
                    {(myListings.length ? myListings : []).map((item) => (
                      <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-16 w-16 overflow-hidden rounded-3xl bg-slate-100">
                            <img
                              src={(item.image && item.image.trim()) ? item.image : 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}
                              alt={item.title}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
                              }}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.category} / {item.subcategory || 'General'}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">${item.price}</p>
                          <span className={`${item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'} rounded-full px-3 py-1 text-xs font-semibold`}>
                            {item.status || 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-advisor' && (
            <div className="space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">Campus AI Assistant</h3>
                      <p className="text-sm text-slate-500 mt-1">Ask anything about campus listings, pricing, or student trading tips.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        Active
                      </span>
                      <button
                        type="button"
                        aria-label="Clear chat"
                        onClick={handleClearChat}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleAiSend(prompt)}
                        className="rounded-full border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100 px-4 py-2.5 text-xs font-semibold text-sky-700 shadow-sm hover:shadow-md hover:border-sky-300 transition-all active:scale-95"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-sky-50 p-5 h-[540px] flex flex-col">
                    <div ref={aiScrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
                      {chatHistory.map((message, index) => {
                        const productMatches = message.role === 'assistant' ? parseInlineProductCards(message.text) : [];
                        const renderedText = productMatches.length ? message.text.replace(/\[PRODUCT:[^\]]+\]/g, '') : message.text;

                        return (
                          <div key={index} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-6 shadow-md ${message.role === 'assistant' ? 'bg-gradient-to-br from-white to-slate-50 text-slate-900 border border-slate-200' : 'bg-emerald-500 text-white'}`}>
                              {renderedText && <div className="whitespace-pre-wrap font-medium">{renderedText}</div>}

                              {productMatches.length > 0 && (
                                <div className="mt-4 space-y-3">
                                  {productMatches.map((product) => (
                                    <div key={`${product.id}-${index}`} className="rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-slate-900 shadow-md hover:shadow-lg transition-shadow">
                                      <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0">
                                          <div className="h-14 w-14 rounded-[12px] bg-gradient-to-br from-sky-100 to-sky-50 border border-sky-200 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 rounded-full px-2 py-0.5">AI Recommended</p>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 whitespace-nowrap">{product.price}</span>
                                          </div>
                                          <h4 className="text-sm font-bold text-slate-900 leading-snug">{product.title}</h4>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddToCartFromSearch(product.id)}
                                        className="mt-3 w-full inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add to Cart
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="rounded-3xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 px-5 py-4 text-sm text-slate-600 shadow-md">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
                              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500 [animation-delay:150ms]" />
                              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500 [animation-delay:300ms]" />
                              <span className="ml-2 text-slate-500 font-medium">AI is thinking…</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3 rounded-full border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-4 shadow-md focus-within:shadow-lg focus-within:border-emerald-300 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ask me about textbooks, phones, pricing, or campus tips…"
                        className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAiSend();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAiSend()}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isTyping}
                      >
                        {isTyping ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent mr-1.5" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16027068 C3.50612381,-0.1 2.40999899,0.0570974055 1.77946707,0.4870386 C0.994623095,1.11 0.8376543,2.20 1.15159189,3.1 L3.03521743,9.5 C3.03521743,9.68012422 3.34915502,9.83721169 3.50612381,9.83721169 L16.6915026,10.6227347 C16.6915026,10.6227347 17.1624089,10.6227347 17.1624089,11.0526759 C17.1624089,11.4860699 16.6915026,11.4860699 16.6915026,12.4744748 Z" />
                            </svg>
                            Send
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ገጽ 4፦ የኖቲፊኬሽኖች ዝርዝር (Notifications Tab) */}
          {activeTab === 'profile' && (
            <div className="mx-auto max-w-5xl px-4 py-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-900">Profile</h3>
                  <p className="mt-2 text-sm text-slate-500">Edit your student profile details and save your changes.</p>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
                  <div className="space-y-6 rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <img
                        src={user?.studentId ? `http://127.0.0.1:8000/static/uploads/avatars/${user.studentId}.jpg` : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=280&q=80'}
                        alt="Profile avatar"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=280&q=80';
                        }}
                        className="h-32 w-32 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Profile Avatar</p>
                        <p className="text-xs text-slate-500">Upload a new photo from your computer.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-700">Choose Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={handleAvatarUploadSubmit}
                        disabled={!avatarFile || avatarUploading}
                        className="w-full rounded-full bg-sky-600 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {avatarUploading ? 'Uploading...' : 'Upload Avatar'}
                      </button>
                      {avatarUploadMessage && (
                        <p className={`text-sm ${avatarUploadMessage.includes('failed') ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {avatarUploadMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => handleProfileFieldChange('name', e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Student ID</label>
                        <input
                          type="text"
                          value={profileForm.studentId}
                          disabled
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 focus:border-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Campus Email</label>
                        <input
                          type="email"
                          value={profileForm.email}
                          disabled
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 focus:border-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Phone Number</label>
                        <input
                          type="tel"
                          placeholder="0962714305"
                          value={profileForm.phone}
                          onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Select College</label>
                        <select
                          value={profileForm.college}
                          onChange={(e) => handleProfileFieldChange('college', e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                        >
                          <option value="">Select College</option>
                          {Object.keys(universityStructure).map((college) => (
                            <option key={college} value={college}>{college}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Select Department</label>
                        <select
                          value={profileForm.department}
                          onChange={(e) => handleProfileFieldChange('department', e.target.value)}
                          disabled={!profileForm.college}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Select Department</option>
                          {profileForm.college && universityStructure[profileForm.college]?.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">New Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={profileForm.password}
                          onChange={(e) => handleProfileFieldChange('password', e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Confirm New Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={profileForm.confirmPassword}
                          onChange={(e) => handleProfileFieldChange('confirmPassword', e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>

                      {profileMessage && (
                        <p className={`text-sm ${profileMessage.includes('successfully') ? 'text-emerald-600' : 'text-red-600'}`}>
                          {profileMessage}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="w-full rounded-full bg-emerald-500 py-3.5 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
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
                      <span>{notifications.length} total</span>
                      <span className="text-slate-400">•</span>
                      <span>{unreadCount} unread</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      disabled={notifications.length === 0 || isMarkingRead}
                      className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isMarkingRead ? 'Marking…' : 'Mark all as read'}
                    </button>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-3xl">🔔</div>
                    <p className="mt-5 text-lg font-semibold text-slate-900">Nothing new here yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      When buyers message you or orders arrive, your notifications will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {notifications.map((notif) => {
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

        </section>
      </main>

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