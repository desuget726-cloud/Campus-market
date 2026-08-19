import { useEffect, useState } from 'react';

function ProductDetails({ product, onBack, onStartChat }) {
  const [showPhone, setShowPhone] = useState(false);
  const [detailedProduct, setDetailedProduct] = useState(null);
  const [chatStatus, setChatStatus] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  const handleStartChat = async () => {
    const savedSession = typeof window !== 'undefined' ? window.localStorage.getItem('campaceSession') : null;
    const session = savedSession ? JSON.parse(savedSession) : null;
    const buyerId = session?.user?.studentId;

    if (!buyerId || !product?.id) {
      setChatStatus('Please sign in to start a chat.');
      return;
    }

    setChatLoading(true);
    setChatStatus('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/student/chat/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_id: buyerId, product_id: product.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Unable to send chat request.');
      }

      setChatStatus(data.message || 'Chat request sent successfully.');
      if (typeof onStartChat === 'function') {
        onStartChat();
      }
    } catch (error) {
      setChatStatus(error.message || 'Unable to send chat request.');
      console.error(error);
    } finally {
      setChatLoading(false);
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
    item?.image,
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
              <p className="text-sm text-slate-500">Department: {item.department || item.seller_department || 'Software Engineering'}</p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">✓ Verified Student</span>
            </div>

            <div className="mt-6 space-y-3">
              {/* ስልክ ቁጥር ማሳያ ቁልፍ (Show Contact Button) */}
              <button
                onClick={() => setShowPhone((prev) => !prev)}
                className="w-full rounded-full bg-white border border-slate-800 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📞</span>
                <span>{showPhone ? item.seller_phone : 'Show Contact'}</span>
              </button>

              {/* አረንጓዴ የቻት መክፈቻ ቁልፍ (Start Chat Button) */}
              <button
                onClick={handleStartChat}
                disabled={chatLoading}
                className="w-full rounded-full bg-emerald-500 py-3.5 text-sm font-semibold text-white hover:bg-emerald-600 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                <span>💬</span>
                <span>{chatLoading ? 'Sending...' : 'Start Chat'}</span>
              </button>
              {chatStatus && (
                <p className="text-sm text-emerald-700">{chatStatus}</p>
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