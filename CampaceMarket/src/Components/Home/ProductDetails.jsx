import { useEffect, useState } from 'react';

const isVerifiedStudent = (student) => [true, 1, '1', 'true'].includes(student?.is_verified);

const parseProductImages = (image) => {
  if (Array.isArray(image)) return image;
  if (typeof image !== 'string' || !image.trim()) return [];

  try {
    const parsedImage = JSON.parse(image);
    return Array.isArray(parsedImage) ? parsedImage : [image];
  } catch {
    return [image];
  }
};

function ProductDetails({ product, currentUser, onUserUpdate, onNavigate, onNavigateToMessages, onBack, onStartChat }) {
  const [showPhone, setShowPhone] = useState(false);
  const [detailedProduct, setDetailedProduct] = useState(null);
  const [chatStatus, setChatStatus] = useState('');
  const [cartStatus, setCartStatus] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [allowStudentReports, setAllowStudentReports] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportEvidenceFile, setReportEvidenceFile] = useState(null);
  const [reportStatus, setReportStatus] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);
  const [wishlistStatus, setWishlistStatus] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [reportReason, setReportReason] = useState('');
  const verifiedCurrentUser = isVerifiedStudent(currentUser);

  useEffect(() => {
    if (!product?.id) return;

    const fetchProductDetails = async () => {
      try {
        const viewerId = currentUser?.studentId || currentUser?.student_id;
        const query = viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : '';
        const response = await fetch(`http://127.0.0.1:8000/api/products/${product.id}${query}`);
        if (!response.ok) {
          throw new Error('Failed to fetch product details');
        }
        const data = await response.json();
        setDetailedProduct(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchProductDetails();
  }, [product?.id, currentUser?.studentId, currentUser?.student_id]);

  useEffect(() => {
    const studentId = currentUser?.studentId || currentUser?.student_id;
    if (!studentId || !product?.id) {
      setIsWishlisted(false);
      setWishlistItemId(null);
      return undefined;
    }

    let active = true;
    fetch(`http://127.0.0.1:8000/api/student/wishlist?student_id=${encodeURIComponent(studentId)}`)
      .then((response) => response.ok ? response.json() : [])
      .then((items) => {
        const match = (Array.isArray(items) ? items : []).find((wishlistItem) => String(wishlistItem.product_id) === String(product.id));
        if (active) {
          setIsWishlisted(Boolean(match));
          setWishlistItemId(match?.id || null);
        }
      })
      .catch(() => {
        if (active) setIsWishlisted(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.studentId, currentUser?.student_id, product?.id]);

  useEffect(() => {
    setSelectedQuantity(1);
  }, [product?.id]);

  useEffect(() => {
    let active = true;

    const fetchModerationSettings = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/settings/moderation');
        if (!response.ok) throw new Error('Failed to fetch moderation settings');
        const data = await response.json();
        if (active) setAllowStudentReports(data.allowStudentReports === true);
      } catch (error) {
        if (active) setAllowStudentReports(false);
        console.error(error);
      }
    };

    fetchModerationSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchChatSettings = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/settings/chat');
        if (!response.ok) throw new Error('Failed to fetch chat settings');
        const data = await response.json();
        if (active && typeof data.enabled === 'boolean') {
          setIsChatEnabled(data.enabled);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchChatSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const productTitle = String(detailedProduct?.title || product?.title || '').trim();
    if (!productTitle) return;

    setMessageText((previousMessage) => previousMessage || `Hi, I am interested in buying your ${productTitle}. Is it still available?`);
  }, [product?.id, product?.title, detailedProduct?.title]);

  const handleGoogleLogin = () => {
    const mockUser = {
      studentId: 'MAU1600002',
      name: 'Campus Student',
      email: 'student@campace.edu.et',
      role: 'student',
      department: 'Department of Software Engineering',
    };
    const session = {
      user: mockUser,
      currentView: 'home',
      studentTab: 'home',
      userRole: 'student',
    };

    window.localStorage.setItem('campaceSession', JSON.stringify(session));
    if (typeof onUserUpdate === 'function') {
      onUserUpdate(mockUser);
    }
    setChatStatus('Google login successful. You can now message the seller.');
  };

  const handleStartChat = async () => {
    if (!isChatEnabled) {
      setChatStatus('Chat is currently disabled by the administrator.');
      return;
    }

    if (!verifiedCurrentUser) {
      setChatStatus('Verification is required to start a chat with other students.');
      return;
    }

    const buyerId = currentUser?.studentId;
    const sellerId = item?.seller_id || item?.seller;

    if (!buyerId || !product?.id || !messageText.trim() || !sellerId) {
      setChatStatus('Enter a message before starting the chat.');
      return;
    }

    setChatLoading(true);
    setChatStatus('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/student/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: buyerId,
          receiver_id: sellerId,
          product_id: product.id,
          message_text: messageText.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Unable to send chat request.');
      }

      setMessageText('');
      setChatStatus(data.message || 'Message sent successfully.');
      if (typeof onStartChat === 'function') {
        onStartChat();
      }
      if (typeof onNavigateToMessages === 'function') {
        onNavigateToMessages();
      } else if (typeof onNavigate === 'function') {
        onNavigate('student-dashboard');
      }
    } catch (error) {
      setChatStatus(error.message || 'Unable to send chat request.');
      console.error(error);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddToCartFromSearch = async (productId, quantity = 1) => {
    const session = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
    const response = await fetch('http://127.0.0.1:8000/api/student/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token || session.user?.access_token || ''}`,
      },
      body: JSON.stringify({
        student_id: currentUser.studentId,
        product_id: Number(productId),
        quantity: Number(quantity),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || 'Unable to add this product to your cart.');
    }
  };

  const handleAddToCart = async () => {
    const studentId = String(currentUser?.studentId || '').trim();
    if (!studentId) {
      window.alert('እባክዎ መጀመሪያ ይግቡ! (Please log in first to add items to your cart.)');
      return;
    }
    if (isOwnProduct) {
      setCartStatus('This is your material. You cannot purchase your own material.');
      return;
    }

    setCartStatus('');
    try {
      await handleAddToCartFromSearch(item?.id || product?.id, selectedQuantity);
      setCartStatus('Product added to cart successfully.');
    } catch (error) {
      setCartStatus(error.message || 'Unable to add this product to your cart.');
      console.error(error);
    }
  };

  const handleToggleWishlist = async () => {
    const studentId = currentUser?.studentId || currentUser?.student_id;
    if (!studentId) {
      setWishlistStatus('Please log in first to save this item.');
      return;
    }

    try {
      const response = isWishlisted
        ? await fetch(`http://127.0.0.1:8000/api/student/wishlist/${wishlistItemId}`, { method: 'DELETE' })
        : await fetch('http://127.0.0.1:8000/api/student/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, product_id: Number(product.id) }),
        });
      if (!response.ok) throw new Error('Unable to update wishlist.');
      const data = isWishlisted ? {} : await response.json().catch(() => ({}));
      setIsWishlisted((previous) => !previous);
      setWishlistItemId(data.id || null);
      setWishlistStatus(isWishlisted ? 'Removed from wishlist.' : 'Added to wishlist.');
    } catch (error) {
      setWishlistStatus(error.message || 'Unable to update wishlist.');
    }
  };

  const handleMakeOffer = () => {
    const amount = offerAmount.trim() || '[amount]';
    setMessageText(`Hi, I'd like to offer ${amount} ETB for this item. Is that acceptable?`);
    setChatStatus('Offer message ready. Edit it before sending.');
  };

  const handleShare = async (destination) => {
    const shareUrl = window.location.href;
    const shareText = `${displayTitle} on Campace Market`;
    if (destination === 'copy') {
      await navigator.clipboard?.writeText(shareUrl);
      setChatStatus('Product link copied.');
    } else {
      const target = destination === 'telegram'
        ? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
        : `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    setShowShareMenu(false);
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    if (!allowStudentReports || !currentUser || !product?.id || !reportReason || !reportText.trim()) return;

    setReportLoading(true);
    setReportStatus('');
    try {
      const formData = new FormData();
      formData.append('product_id', String(product.id));
      formData.append('student_id', currentUser.studentId || '');
      formData.append('student_name', currentUser.name || currentUser.studentId || 'Student');
      formData.append('email', currentUser.email || '');
      formData.append('category', 'Product Report');
      formData.append('issue', `${reportReason}: ${reportText.trim()}`);
      if (reportEvidenceFile) formData.append('evidence_image', reportEvidenceFile);

      const response = await fetch('http://127.0.0.1:8000/api/student/report', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((error) => error.msg || 'Invalid report data.').join(', ')
          : data.detail;
        throw new Error(detail || 'Unable to report this product.');
      }

      setReportText('');
      setReportEvidenceFile(null);
      setShowReportForm(false);
      setReportStatus(data.message || 'Product report submitted successfully.');
    } catch (error) {
      setReportStatus(error.message || 'Unable to report this product.');
      console.error(error);
    } finally {
      setReportLoading(false);
    }
  };

  const item = detailedProduct || product;
  const sellerPayoutBlocked = String(item?.seller_payout_status || '').trim().toLowerCase() !== 'active';
  const currentStudentId = String(currentUser?.studentId || currentUser?.student_id || '').trim().toLowerCase();
  const productSellerId = String(item?.seller_id || item?.seller || '').trim().toLowerCase();
  const isOwnProduct = Boolean(currentStudentId && productSellerId && currentStudentId === productSellerId);
  const availableStock = Math.max(0, Number(item?.stock ?? 1));
  const purchaseBlocked = sellerPayoutBlocked || isOwnProduct || availableStock === 0 || selectedQuantity > availableStock;

  const productTitle = String(item?.title || '').trim();
  const displayTitle = productTitle.length >= 3
    ? productTitle.charAt(0).toUpperCase() + productTitle.slice(1)
    : 'Campus Marketplace Item';
  const priceValue = Number.parseFloat(String(item?.price || '').replace(/[^0-9.]/g, ''));
  const itemTotal = Number.isFinite(priceValue) ? priceValue * selectedQuantity : null;
  const formattedPrice = Number.isFinite(priceValue)
    ? `${priceValue.toLocaleString('en-ET', { maximumFractionDigits: 2 })} ETB`
    : 'Negotiable';
  const campusLocation = (() => {
    const location = String(item?.location || '').toLowerCase();
    if (location.includes('addis')) return 'Mekdela Amba University — Dorm Room 12';
    if (location.includes('cci') || location.includes('comput')) return 'CCI Main Block';
    if (location.includes('library')) return 'Main Library Pickup Point';
    return item?.location || 'Student Center Pickup Point';
  })();
  const galleryImages = [
    ...parseProductImages(item?.image),
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.image_urls) ? item.image_urls : []),
  ].filter(Boolean).filter((image, index, images) => images.indexOf(image) === index);
  const fallbackImage = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80';
  const visibleImages = galleryImages.length ? galleryImages : [fallbackImage];
  const activeImage = visibleImages[selectedImageIndex % visibleImages.length];
  const reviews = Array.isArray(item?.reviews) ? item.reviews : [];
  const similarProducts = Array.isArray(item?.similar_products) ? item.similar_products : [];
  const responseTimeHours = Number(item?.seller_response_time_hours);
  const isNegotiable = item?.negotiable !== false;
  const pickupHours = {
    'Student Center Pickup Point': 'Available today until 5:00 PM',
    'CCI Main Block': 'Available today until 4:30 PM',
    'Main Library Pickup Point': 'Available today until 6:00 PM',
    'Mekdela Amba University — Dorm Room 12': 'Available today until 7:00 PM',
  }[campusLocation];

  if (!product) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. የመንገዱ አቅጣጫ (Breadcrumbs) እና መመለሻ ቁልፍ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          <button onClick={onBack} className="font-semibold text-slate-700 hover:text-emerald-600 transition cursor-pointer">Home</button>
          <span className="mx-2">&gt;</span>
          <span>{item.category || 'Category'}</span>
          <span className="mx-2">&gt;</span>
          <span className="font-semibold text-slate-900 truncate max-w-[150px] inline-block align-middle">{item.title}</span>
        </div>
        <button
          onClick={onBack}
          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          ← Back to Listings
        </button>
      </div>

      {/* 2. ባለ ሁለት አምድ የ Jiji አቀማመጥ (Jiji-style Two-column Layout) */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">

        {/* የግራው አምድ (ዋናው መግለጫ እና ፎቶ) */}
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Product Listing</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{displayTitle}</h1><div className="relative"><button type="button" onClick={() => setShowShareMenu((previous) => !previous)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">↗ Share</button>{showShareMenu && <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl"><button type="button" onClick={() => handleShare('copy')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Copy Link</button><button type="button" onClick={() => handleShare('telegram')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Share to Telegram</button><button type="button" onClick={() => handleShare('whatsapp')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Share to WhatsApp</button></div>}</div></div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Posted {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'recently'}</p>
          </div>

          {/* የምርቱ ትልቅ ፎቶ */}
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative"><button type="button" onClick={handleToggleWishlist} aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'} className={`absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md ${isWishlisted ? 'text-rose-500' : 'text-slate-500'} hover:text-rose-500`}>{isWishlisted ? '♥' : '♡'}</button><button type="button" onClick={() => setIsZoomed(true)} className="block w-full cursor-zoom-in" aria-label="Zoom product image"><img src={activeImage} alt={displayTitle} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} className="h-[420px] w-full rounded-[20px] object-cover" /></button></div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={() => setSelectedImageIndex((index) => (index - 1 + visibleImages.length) % visibleImages.length)} aria-label="Previous product image" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 hover:bg-slate-100">←</button>
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
                {visibleImages.map((image, index) => (
                  <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImageIndex(index)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${selectedImageIndex === index ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-400'}`} aria-label={`Show product image ${index + 1}`}>
                    <img src={image} alt={`${displayTitle} thumbnail ${index + 1}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSelectedImageIndex((index) => (index + 1) % visibleImages.length)} aria-label="Next product image" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white hover:bg-emerald-600">→</button>
            </div>
          </div>

          {/* የቁልፍ መረጃዎች ሰንጠረዥ (Attributes Grid) */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">Key Specifications</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-sm text-slate-500 font-semibold">Condition</span>
                <span className="text-base font-bold text-slate-900">{item.condition || 'Used'}</span>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-sm text-slate-500 font-semibold">Location</span>
                <span className="text-base font-bold text-slate-900">{campusLocation}</span>
                {pickupHours && <span className="text-xs font-semibold text-emerald-700">{pickupHours}</span>}
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-sm text-slate-500 font-semibold">Category</span>
                <span className="text-base font-bold text-slate-900">{item.category || 'General'}</span>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-sm text-slate-500 font-semibold">Subcategory</span>
                <span className="text-base font-bold text-slate-900">{item.subcategory || 'General'}</span>
              </div>
            </div>
          </div>

          {/* ዝርዝር መግለጫ (Description) */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-bold text-slate-900 border-b pb-2 mb-3">Detailed Description</h4>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {item.description || 'No additional description provided by the seller.'}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Reviews</p><h4 className="mt-1 text-xl font-black text-slate-900">Buyer ratings</h4></div><div className="text-right"><p className="text-2xl font-black text-amber-500">{Number(item.average_rating || 0).toFixed(1)} ★</p><p className="text-xs font-semibold text-slate-500">{Number(item.review_count || reviews.length)} review{Number(item.review_count || reviews.length) === 1 ? '' : 's'}</p></div></div>
            {reviews.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">No reviews yet — be the first to review after purchase.</p> : <div className="mt-5 space-y-4">{reviews.map((review) => <article key={review.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{review.reviewer_name || 'Buyer'}</p><p className="text-xs font-semibold text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Recent'}</p></div><p className="mt-1 text-sm font-black text-amber-500">{'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}<span className="ml-2 text-slate-400">{Number(review.rating) || 0}/5</span></p><p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p></article>)}</div>}
          </div>

          {similarProducts.length > 0 && <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">More to explore</p><h4 className="mt-1 text-xl font-black text-slate-900">Similar items</h4></div><span className="text-xs font-semibold text-slate-500">Same category</span></div><div className="mt-5 flex gap-4 overflow-x-auto pb-2">{similarProducts.map((similar) => <button key={similar.id} type="button" onClick={() => onNavigate?.('product-details', { productId: similar.id })} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm hover:shadow-md"><img src={similar.image || fallbackImage} alt={similar.title || 'Similar item'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} className="h-28 w-full object-cover" /><div className="p-3"><p className="truncate font-black text-slate-900">{similar.title || 'Campus item'}</p><p className="mt-1 text-sm font-bold text-emerald-700">{similar.price || 'Negotiable'} ETB</p></div></button>)}</div></section>}
        </div>

        {/* የቀኝ የጎን ፓነል (Sidebar) */}
        <div className="space-y-6">

          {/* የዋጋ ካርድ */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm text-center">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Price</span>
            <p className="mt-3 text-4xl font-extrabold text-slate-900">{formattedPrice}</p>
            {Number(item.views || 0) > 5 && <p className="mt-2 text-xs font-bold text-slate-500">{item.views} people viewed this listing</p>}
            <div className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-100">
              Negotiable / ድርድር አለው
            </div>
            <div className="mt-5 flex items-center justify-center gap-4">
              <button type="button" onClick={() => setSelectedQuantity((value) => Math.max(1, value - 1))} disabled={selectedQuantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Decrease quantity">-</button>
              <span className="min-w-8 text-center text-lg font-black text-slate-900">{selectedQuantity}</span>
              <button type="button" onClick={() => setSelectedQuantity((value) => Math.min(availableStock, value + 1))} disabled={selectedQuantity >= availableStock} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity">+</button>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">{availableStock > 0 ? `${availableStock} available` : 'Not enough stock'}</p>
            {itemTotal !== null && <p className="mt-3 text-base font-black text-slate-900">Item Total: {itemTotal.toLocaleString('en-ET', { maximumFractionDigits: 2 })} ETB</p>}
            {availableStock === 0 && <p className="mt-2 text-sm font-bold text-rose-600">Not enough stock available.</p>}
          </div>

          {/* የሻጩ ካርድ (ከስልክ ቁጥር መደበቂያ ጋር) */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl font-bold text-sky-700">
              {item.seller_name ? item.seller_name.slice(0, 2).toUpperCase() : 'ST'}
            </div>
            <h4 className="mt-4 text-xl font-bold text-slate-900">{item.seller_name || item.seller || 'Verified Seller'}</h4>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <p className="text-sm text-slate-500">Department: {item.seller_dept || item.department || item.seller_department || 'Software Engineering'}</p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">✓ Verified Student</span>
            </div>
            {Number.isFinite(responseTimeHours) && responseTimeHours > 0 && <p className="mt-2 text-xs font-semibold text-slate-500">Usually responds within {responseTimeHours < 1 ? 'an hour' : `${Math.round(responseTimeHours)} hours`}</p>}

            <div className="mt-6 space-y-3">
              {/* ስልክ ቁጥር ማሳያ ቁልፍ (Show Contact Button) */}
              <button
                onClick={() => setShowPhone((prev) => !prev)}
                className="w-full rounded-full bg-white border border-slate-800 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📞</span>
                <span>{showPhone ? (item.seller_phone || 'Phone unavailable') : 'Show Contact'}</span>
              </button>

              {!currentUser ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full rounded-full bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  ⚡ One-Click Google Login
                </button>
              ) : (
                <>
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder={isChatEnabled ? 'Write a message to the seller...' : 'Chat is currently disabled by the administrator'}
                    rows={4}
                    disabled={!isChatEnabled || !verifiedCurrentUser || chatLoading}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white"
                  />
                  {!verifiedCurrentUser && (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      Verification is required to start a chat with other students.
                    </p>
                  )}
                  {/* አረንጓዴ የቻት መክፈቻ ቁልፍ (Start Chat Button) */}
                  <button
                    onClick={handleStartChat}
                    disabled={!isChatEnabled || !verifiedCurrentUser || chatLoading || !messageText.trim()}
                    className="w-full rounded-full bg-emerald-500 py-3.5 text-sm font-semibold text-white hover:bg-emerald-600 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <span>💬</span>
                    <span>{chatLoading ? 'Sending...' : 'Send Message & Start Chat'}</span>
                  </button>
                  {isNegotiable && <div className="flex items-center gap-2"><input type="number" min="1" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Offer amount" className="min-w-0 flex-1 rounded-full border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-400" /><button type="button" onClick={handleMakeOffer} className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100">Make an Offer</button></div>}
                </>
              )}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={purchaseBlocked}
                className="w-full rounded-full bg-blue-600 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add to Cart
              </button>
              {isOwnProduct && (
                <span className="block rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[10px] font-bold text-amber-800">
                  This is your material. You cannot purchase your own material.
                </span>
              )}
              {sellerPayoutBlocked && !isOwnProduct && (
                <span className="block rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[10px] font-bold text-amber-800">
                  Seller Payout Setup Required - Purchase Disabled
                </span>
              )}
              {chatStatus && (
                <p className="text-sm text-emerald-700">{chatStatus}</p>
              )}
              {cartStatus && (
                <p className="text-sm text-blue-700">{cartStatus}</p>
              )}
              {allowStudentReports && currentUser && (
                <div className="border-t border-slate-100 pt-4">
                  {!showReportForm ? (
                    <button
                      type="button"
                      onClick={() => setShowReportForm(true)}
                      className="w-full rounded-full border border-rose-200 bg-rose-50 py-3.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      🚩 Report/Flag Product
                    </button>
                  ) : (
                    <form onSubmit={handleSubmitReport} className="space-y-3">
                      <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} required disabled={reportLoading} className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-rose-400 focus:bg-white"><option value="">Select a reason</option><option>Counterfeit/Fake item</option><option>Scam attempt</option><option>Wrong category</option><option>Prohibited item</option><option>Other</option></select>
                      <textarea
                        value={reportText}
                        onChange={(event) => setReportText(event.target.value)}
                        placeholder="Tell us why this product should be reviewed..."
                        rows={4}
                        required
                        disabled={reportLoading}
                        className="w-full resize-none rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:bg-white"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setReportEvidenceFile(event.target.files?.[0] || null)}
                        disabled={reportLoading}
                        className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-rose-700"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={reportLoading || !reportText.trim()}
                          className="flex-1 rounded-full bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                        >
                          {reportLoading ? 'Submitting...' : 'Submit Report'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReportForm(false);
                            setReportEvidenceFile(null);
                            setReportReason('');
                          }}
                          className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              {reportStatus && (
                <p className="text-sm text-rose-700">{reportStatus}</p>
              )}
            </div>
          </div>

          {/* የደህንነት ምክሮች ካርድ (Jiji Safety Tips) */}
          <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <span>🛡️</span> Safety Tips / የጥንቃቄ ምክሮች
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-amber-800 list-disc pl-5 leading-7">
              <li>
                Do not pay in advance. <span className="font-semibold">ማንኛውንም ዓይነት ቅድመ ክፍያ አይክፈሉ።</span>
              </li>
              <li>
                Meet in busy public areas only. <span className="font-semibold">ሁልጊዜም በሚለበው ሕዝብ ቦታ ተገናኙ።</span>
              </li>
              <li>
                Check the item carefully before paying. <span className="font-semibold">እቃውን በጥንቃቄ አስመልከቱ።</span>
              </li>
            </ul>
          </div>

        </div>

      </div>
      {isZoomed && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setIsZoomed(false)}><div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setIsZoomed(false)} className="absolute right-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-lg font-black text-slate-700 shadow" aria-label="Close image preview">×</button><img src={activeImage} alt={displayTitle} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} className="max-h-[88vh] max-w-full rounded-2xl object-contain" /></div></div>}
    </div>
  );
}

export default ProductDetails;