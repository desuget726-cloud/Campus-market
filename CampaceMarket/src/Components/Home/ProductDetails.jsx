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
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [allowStudentReports, setAllowStudentReports] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportEvidenceFile, setReportEvidenceFile] = useState(null);
  const [reportStatus, setReportStatus] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const verifiedCurrentUser = isVerifiedStudent(currentUser);

  useEffect(() => {
    if (!product?.id) return;

    const fetchProductDetails = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/products/${product.id}`);
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

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    if (!allowStudentReports || !currentUser || !product?.id || !reportText.trim()) return;

    setReportLoading(true);
    setReportStatus('');
    try {
      const formData = new FormData();
      formData.append('product_id', String(product.id));
      formData.append('student_id', currentUser.studentId || '');
      formData.append('student_name', currentUser.name || currentUser.studentId || 'Student');
      formData.append('email', currentUser.email || '');
      formData.append('category', 'Product Report');
      formData.append('issue', reportText.trim());
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

  const productTitle = String(item?.title || '').trim();
  const displayTitle = productTitle.length >= 3
    ? productTitle.charAt(0).toUpperCase() + productTitle.slice(1)
    : 'Campus Marketplace Item';
  const priceValue = Number.parseFloat(String(item?.price || '').replace(/[^0-9.]/g, ''));
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
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{displayTitle}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">Posted 3 days ago</p>
          </div>

          {/* የምርቱ ትልቅ ፎቶ */}
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <img
              src={activeImage}
              alt={displayTitle}
              className="h-[420px] w-full rounded-[20px] object-cover"
            />
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={() => setSelectedImageIndex((index) => (index - 1 + visibleImages.length) % visibleImages.length)} aria-label="Previous product image" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 hover:bg-slate-100">←</button>
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
                {visibleImages.map((image, index) => (
                  <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImageIndex(index)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${selectedImageIndex === index ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-400'}`} aria-label={`Show product image ${index + 1}`}>
                    <img src={image} alt={`${displayTitle} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
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
        </div>

        {/* የቀኝ የጎን ፓነል (Sidebar) */}
        <div className="space-y-6">

          {/* የዋጋ ካርድ */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm text-center">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Price</span>
            <p className="mt-3 text-4xl font-extrabold text-slate-900">{formattedPrice}</p>
            <div className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-100">
              Negotiable / ድርድር አለው
            </div>
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
                </>
              )}
              {chatStatus && (
                <p className="text-sm text-emerald-700">{chatStatus}</p>
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
    </div>
  );
}

export default ProductDetails;