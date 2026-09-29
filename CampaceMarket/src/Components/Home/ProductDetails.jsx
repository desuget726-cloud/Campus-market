import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';

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

function ProductDetails({ product, currentUser, onNavigate, onNavigateToMessages, onBack, onStartChat }) {
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
  const [reportReasons, setReportReasons] = useState([]);
  const verifiedCurrentUser = isVerifiedStudent(currentUser);

  useEffect(() => {
    if (!product?.id) return;

    const fetchProductDetails = async () => {
      try {
        const viewerId = currentUser?.studentId || currentUser?.student_id;
        const query = viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : '';
        const response = await fetch(`${API_BASE_URL}/api/products/${product.id}${query}`);
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
    fetch(`${API_BASE_URL}/api/student/wishlist?student_id=${encodeURIComponent(studentId)}`)
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
        const response = await fetch(`${API_BASE_URL}/api/settings/moderation`);
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
        const response = await fetch(`${API_BASE_URL}/api/settings/chat`);
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
      const response = await fetch(`${API_BASE_URL}/api/student/messages/send`, {
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
    const response = await fetch(`${API_BASE_URL}/api/student/cart`, {
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
      toast.error('Please log in first to save this item.');
      return;
    }

    try {
      const response = isWishlisted
        ? await fetch(`${API_BASE_URL}/api/student/wishlist/${wishlistItemId}`, { method: 'DELETE' })
        : await fetch(`${API_BASE_URL}/api/student/wishlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, product_id: Number(product.id) }),
        });
      if (!response.ok) throw new Error('Unable to update wishlist.');
      const data = isWishlisted ? {} : await response.json().catch(() => ({}));
      setIsWishlisted((previous) => !previous);
      setWishlistItemId(data.id || null);
      const statusMessage = isWishlisted ? 'Removed from wishlist.' : 'Added to wishlist.';
      setWishlistStatus(statusMessage);
      toast.success(statusMessage);
    } catch (error) {
      const errorMessage = error.message || 'Unable to update wishlist.';
      setWishlistStatus(errorMessage);
      toast.error(errorMessage);
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
    if (!allowStudentReports || !currentUser || !product?.id || !reportReasons.length || !reportText.trim()) return;

    setReportLoading(true);
    setReportStatus('');
    try {
      const formData = new FormData();
      formData.append('product_id', String(product.id));
      formData.append('student_id', currentUser.studentId || '');
      formData.append('student_name', currentUser.name || currentUser.studentId || 'Student');
      formData.append('email', currentUser.email || '');
      formData.append('category', 'Product Report');
      formData.append('issue', `${reportReasons.join(', ')}: ${reportText.trim()}`);
      if (reportEvidenceFile) formData.append('evidence_image', reportEvidenceFile);

      const response = await fetch(`${API_BASE_URL}/api/student/report`, {
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
      setReportReasons([]);
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
  const campusLocation = String(item?.pickup_location || '').trim() || 'Student Center';
  const galleryEntries = (Array.isArray(item?.images) ? item.images : []).map((image) => (
    typeof image === 'string' ? { url: image, note: null } : image
  ));
  const galleryImages = [
    ...galleryEntries,
    ...parseProductImages(item?.image).map((image) => ({ url: image, note: null })),
    ...(Array.isArray(item?.image_urls) ? item.image_urls.map((url) => ({ url, note: null })) : []),
  ].filter((image) => image?.url).filter((image, index, images) => images.findIndex((candidate) => candidate.url === image.url) === index);
  const fallbackImage = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80';
  const visibleImages = galleryImages.length ? galleryImages : [{ url: fallbackImage, note: null }];
  const activeEntry = galleryImages.length ? galleryImages[selectedImageIndex % galleryImages.length] : { url: fallbackImage, note: null };
  const activeImage = activeEntry.url;
  const reviews = Array.isArray(item?.reviews) ? item.reviews : [];
  const reviewCount = Number(item?.review_count || reviews.length);
  const similarProducts = Array.isArray(item?.similar_products) ? item.similar_products : [];
  const responseTimeHours = Number(item?.seller_response_time_hours);
  const isNegotiable = item?.negotiable === true;
  const pickupHours = item?.pickup_hours;
  const additionalSpecifications = [
    ['Brand', item?.brand],
    ['Model', item?.model],
    ['Screen Size', item?.screen_size],
    ['Resolution', item?.resolution],
    ['Ports', item?.ports],
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim());

  if (!product) return null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] animate-fade-in lg:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center text-sm text-slate-500">
          <button onClick={onBack} className="font-semibold text-slate-700 hover:text-emerald-600 transition cursor-pointer">Home</button>
          <span className="mx-2">&gt;</span>
          <span>{item.category || 'Category'}</span>
          <span className="mx-2">&gt;</span>
          <span className="max-w-[150px] truncate font-semibold text-slate-900 sm:max-w-xs">{displayTitle}</span>
        </div>
        <button
          onClick={onBack}
          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          ← Back to Listings
        </button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="contents lg:col-start-1 lg:block lg:space-y-6">
          <section className="order-1 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:order-none">
            <div className="relative overflow-hidden rounded-xl bg-slate-50">
              <button type="button" onClick={() => setIsZoomed(true)} className="block aspect-[4/3] w-full cursor-zoom-in bg-slate-50" aria-label="Zoom product image">
                <img src={resolveImageUrl(activeImage)} alt={displayTitle} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} className="h-full w-full object-contain" />
              </button>
              <button type="button" onClick={() => setSelectedImageIndex((index) => (index - 1 + visibleImages.length) % visibleImages.length)} aria-label="Previous product image" className="btn-primary absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold">←</button>
              <button type="button" onClick={() => setSelectedImageIndex((index) => (index + 1) % visibleImages.length)} aria-label="Next product image" className="btn-primary absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold">→</button>
              <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-bold text-white">{(selectedImageIndex % visibleImages.length) + 1}/{visibleImages.length}</span>
            </div>
            <div className="flex min-w-0 gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleImages.map((image, index) => (
                <button key={`${image.url}-${index}`} type="button" onClick={() => setSelectedImageIndex(index)} className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${selectedImageIndex === index ? 'border-emerald-500' : 'border-slate-200 hover:border-slate-400'}`} aria-label={`Show product image ${index + 1}`}>
                  <img src={resolveImageUrl(image.url)} alt={`${displayTitle} thumbnail ${index + 1}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} className="h-full w-full object-cover" />
                  {image.note && <span title={image.note} className="absolute bottom-1 right-1 rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-bold text-white">i</span>}
                </button>
              ))}
            </div>
          </section>

          <section className="order-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:order-none">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-2xl font-bold text-slate-950">{displayTitle}</h1>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={handleToggleWishlist} aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'} className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-2xl ${isWishlisted ? 'text-rose-500' : 'text-slate-500'} hover:text-rose-500`}>{isWishlisted ? '♥' : '♡'}</button>
                <div className="relative">
                  <button type="button" onClick={() => setShowShareMenu((previous) => !previous)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">↗ Share</button>
                  {showShareMenu && <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl"><button type="button" onClick={() => handleShare('copy')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Copy Link</button><button type="button" onClick={() => handleShare('telegram')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Share to Telegram</button><button type="button" onClick={() => handleShare('whatsapp')} className="block w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Share to WhatsApp</button></div>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-y border-slate-100 py-3 text-xs font-semibold text-slate-500 sm:text-sm">
              <span>{campusLocation}</span>
              {pickupHours && <span>{pickupHours}</span>}
              <span>Posted {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'recently'}</span>
              <span>{Number(item.views || 0)} people viewed this listing</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[item.condition || 'Used', item.category || 'General', item.subcategory || 'General'].map((chip) => (
                <span key={chip} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{chip}</span>
              ))}
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-bold text-slate-900">Detailed Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.description || 'No additional description provided by the seller.'}</p>
            </div>
            {additionalSpecifications.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <h2 className="text-base font-bold text-slate-900">Key Specifications</h2>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {additionalSpecifications.map(([label, value]) => (
                    <div key={label} className="min-w-0 border-b border-slate-100 py-2">
                      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                      <dd className="mt-0.5 break-words text-sm font-bold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {wishlistStatus && <p className="mt-3 text-sm text-slate-500">{wishlistStatus}</p>}
            {reviewCount > 0 && (
              <section className="mt-5 border-t border-slate-100 pt-4" aria-labelledby="buyer-ratings-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Reviews</p><h2 id="buyer-ratings-heading" className="mt-1 text-xl font-black text-slate-900">Buyer ratings</h2></div>
                  <div className="text-right"><p className="text-2xl font-black text-amber-500">{Number(item.average_rating || 0).toFixed(1)} ★</p><p className="text-xs font-semibold text-slate-500">{reviewCount} review{reviewCount === 1 ? '' : 's'}</p></div>
                </div>
                <div className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <article key={review.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{review.reviewer_name || 'Buyer'}</p><p className="text-xs font-semibold text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Recent'}</p></div>
                      <p className="mt-1 text-sm font-black text-amber-500">{'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}<span className="ml-2 text-slate-400">{Number(review.rating) || 0}/5</span></p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>

          {similarProducts.length > 0 && (
            <section className="order-7 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:order-none" aria-labelledby="similar-products-heading">
              <h2 id="similar-products-heading" className="text-xl font-black text-slate-900">Similar Products</h2>
              <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {similarProducts.map((similar) => (
                  <button key={similar.id} type="button" onClick={() => onNavigate?.('product-details', { productId: similar.id })} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md">
                    <img src={resolveImageUrl(similar.image || fallbackImage)} alt={similar.title || 'Similar product'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} className="h-28 w-full object-cover sm:h-36" />
                    <span className="flex min-w-0 flex-1 flex-col p-3">
                      <span className="text-sm font-bold text-emerald-700">{similar.price ? `${Number(similar.price).toLocaleString('en-ET', { maximumFractionDigits: 2 })} ETB` : 'Negotiable'}</span>
                      <span className="mt-1 line-clamp-2 break-words text-sm font-semibold text-slate-900">{similar.title || 'Campus item'}</span>
                      <span className="mt-2 line-clamp-1 text-xs text-slate-500">{similar.pickup_location || similar.location || 'Student Center'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="contents lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:flex lg:self-start lg:flex-col lg:gap-6">
          <section className="order-2 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm lg:order-none">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Price</span>
            <p className="mt-3 text-4xl font-extrabold text-slate-900">{formattedPrice}</p>
            {isNegotiable && <div className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-100">Negotiable / ድርድር አለው</div>}
            <div className="mt-5 flex items-center justify-center gap-4">
              <button type="button" onClick={() => setSelectedQuantity((value) => Math.max(1, value - 1))} disabled={selectedQuantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Decrease quantity">-</button>
              <span className="min-w-8 text-center text-lg font-black text-slate-900">{selectedQuantity}</span>
              <button type="button" onClick={() => setSelectedQuantity((value) => Math.min(availableStock, value + 1))} disabled={selectedQuantity >= availableStock} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity">+</button>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">{availableStock > 0 ? `${availableStock} available` : 'Not enough stock'}</p>
            {itemTotal !== null && <p className="mt-3 text-base font-black text-slate-900">Item Total: {itemTotal.toLocaleString('en-ET', { maximumFractionDigits: 2 })} ETB</p>}
            {availableStock === 0 && <p className="mt-2 text-sm font-bold text-rose-600">Not enough stock available.</p>}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={purchaseBlocked}
              className="btn-primary mt-5 w-full rounded-full py-3.5 text-sm font-semibold transition"
            >
              Add to Cart
            </button>
            {cartStatus && <p className="mt-3 text-sm text-blue-700">{cartStatus}</p>}
          </section>

          <section className="order-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm lg:order-none">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl font-bold text-sky-700">
              {item.seller_name ? item.seller_name.slice(0, 2).toUpperCase() : 'ST'}
            </div>
            <h4 className="mt-4 text-xl font-bold text-slate-900">{item.seller_name || item.seller || 'Verified Seller'}</h4>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <p className="text-sm text-slate-500">Department: {item.seller_dept || item.department || item.seller_department || 'Software Engineering'}</p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">✓ Verified Student</span>
            </div>
            {reviewCount === 0 && <p className="mt-3 text-xs font-semibold text-slate-500">No reviews yet</p>}
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

              {currentUser && (
                <>
                  <div className="flex items-center justify-between gap-3 text-left">
                    <label htmlFor="seller-message" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Message to seller</label>
                    <span className="text-xs font-semibold text-slate-400">Editable before sending</span>
                  </div>
                  <textarea
                    id="seller-message"
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
                    className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>💬</span>
                    <span>{chatLoading ? 'Sending...' : 'Send Message & Start Chat'}</span>
                  </button>
                  {isNegotiable && <div className="flex items-center gap-2"><input type="number" min="1" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Offer amount" className="min-w-0 flex-1 rounded-full border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-400" /><button type="button" onClick={handleMakeOffer} className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100">Make an Offer</button></div>}
                </>
              )}
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
            </div>
          </section>

          {allowStudentReports && currentUser && (
            <section className="order-5 min-w-0 lg:order-none">
              {!showReportForm ? (
                <button type="button" onClick={() => setShowReportForm(true)} className="text-sm font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800">🚩 Report/Flag Product</button>
              ) : (
                <form onSubmit={handleSubmitReport} className="space-y-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                  <fieldset className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3"><legend className="px-1 text-sm font-bold text-rose-800">Choose report reasons</legend>{['Fake/counterfeit item', 'Scam attempt', 'Wrong category', 'Inappropriate content', 'Other'].map((reason) => <label key={reason} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={reportReasons.includes(reason)} onChange={(event) => setReportReasons((previous) => event.target.checked ? [...previous, reason] : previous.filter((value) => value !== reason))} disabled={reportLoading} />{reason}</label>)}</fieldset>
                  <textarea value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="Tell us why this product should be reviewed..." rows={4} required disabled={reportLoading} className="w-full resize-none rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:bg-white" />
                  <input type="file" accept="image/*" onChange={(event) => setReportEvidenceFile(event.target.files?.[0] || null)} disabled={reportLoading} className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-rose-700" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={reportLoading || !reportReasons.length || !reportText.trim()} className="flex-1 rounded-full bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300">{reportLoading ? 'Submitting...' : 'Submit Report'}</button>
                    <button type="button" onClick={() => { setShowReportForm(false); setReportEvidenceFile(null); setReportReasons([]); }} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  </div>
                </form>
              )}
              {reportStatus && <p className="mt-2 text-sm text-rose-700">{reportStatus}</p>}
            </section>
          )}

          <section className="order-6 min-w-0 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm lg:order-none">
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
          </section>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Price</p>
            <p className="truncate text-lg font-extrabold text-slate-900">{formattedPrice}</p>
          </div>
          <button type="button" onClick={handleAddToCart} disabled={purchaseBlocked} className="btn-primary shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50">Add to Cart</button>
        </div>
        {cartStatus && <p className="mx-auto mt-1 w-full max-w-7xl px-1 text-xs text-blue-700">{cartStatus}</p>}
      </div>
      {isZoomed && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setIsZoomed(false)}><div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setIsZoomed(false)} className="absolute right-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-lg font-black text-slate-700 shadow" aria-label="Close image preview">×</button><img src={resolveImageUrl(activeImage)} alt={displayTitle} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} className="max-h-[88vh] max-w-full rounded-2xl object-contain" /></div></div>}
    </div>
  );
}

export default ProductDetails;