import { useEffect, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:8000';
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 200%22%3E%3Crect width=%22320%22 height=%22200%22 fill=%22%23e2e8f0%22/%3E%3Cpath d=%22M92 145l42-48 32 35 25-27 49 40H92z%22 fill=%22%2394a3b8%22/%3E%3Ccircle cx=%22125%22 cy=%2275%22 r=%2216%22 fill=%22%2394a3b8%22/%3E%3Ctext x=%22160%22 y=%22178%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23475569%22%3ENo image available%3C/text%3E%3C/svg%3E';

const getListingImage = (rawImage) => {
  let image = rawImage;
  if (Array.isArray(image)) image = image[0];
  if (typeof image !== 'string') return PLACEHOLDER_IMAGE;

  const trimmedImage = image.trim();
  if (!trimmedImage) return PLACEHOLDER_IMAGE;
  if (trimmedImage.startsWith('[')) {
    try {
      const parsedImages = JSON.parse(trimmedImage);
      image = Array.isArray(parsedImages) ? parsedImages[0] : trimmedImage;
    } catch {
      image = trimmedImage;
    }
  }

  if (typeof image !== 'string' || !image.trim()) return PLACEHOLDER_IMAGE;
  const normalizedImage = image.trim();
  if (/^(https?:|data:)/i.test(normalizedImage)) return normalizedImage;
  if (normalizedImage.startsWith('/static/')) return `${API_BASE_URL}${normalizedImage}`;
  if (normalizedImage.startsWith('static/')) return `${API_BASE_URL}/${normalizedImage}`;
  return `${API_BASE_URL}/static/uploads/${normalizedImage.replace(/^\/+/, '')}`;
};

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function SellerProfileView({ sellerId, onBack, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      setError('Seller profile not found.');
      return undefined;
    }

    let active = true;
    const loadSellerProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const [profileResponse, listingsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/student/profile?student_id=${encodeURIComponent(sellerId)}`),
          fetch(`${API_BASE_URL}/api/products?seller=${encodeURIComponent(sellerId)}`),
        ]);
        if (!profileResponse.ok) {
          throw new Error('Seller profile not found.');
        }
        const profileData = await profileResponse.json();
        const listingData = listingsResponse.ok ? await listingsResponse.json() : [];
        if (active) {
          setProfile(profileData.user || null);
          setListings(Array.isArray(listingData) ? listingData : []);
        }
      } catch (loadError) {
        if (active) {
          setProfile(null);
          setListings([]);
          setError(loadError.message || 'Seller profile not found.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSellerProfile();
    return () => {
      active = false;
    };
  }, [sellerId]);

  if (loading) {
    return <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center font-semibold text-slate-600">Loading seller profile...</div>;
  }

  if (error || !profile) {
    return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><p className="font-black">Seller profile not found</p><p className="mt-2 text-sm">{error || 'This seller may no longer be available.'}</p><button type="button" onClick={onBack} className="mt-5 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-700">Back</button></div>;
  }

  const initials = String(profile.name || sellerId).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5 py-2">
      <button type="button" onClick={onBack} className="text-sm font-bold text-slate-600 hover:text-slate-950">Back to order</button>
      <section className="rounded-[30px] bg-[#16224f] p-6 text-white shadow-[0_20px_40px_rgba(10,14,35,0.22)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-2xl font-black text-[#16224f]">{initials}</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Seller Profile</p>
            <h1 className="mt-2 text-3xl font-black">{profile.name || sellerId}</h1>
            <p className="mt-2 text-sm text-slate-300">{profile.department || 'Department unavailable'}{profile.college ? ` · ${profile.college}` : ''}</p>
            <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-200">{profile.is_verified ? '✓ Verified Student' : 'Student Seller'}</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">Member since {formatDate(profile.created_at)}</span></div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Marketplace</p><h2 className="mt-1 text-2xl font-black text-slate-950">Other active listings</h2></div><span className="text-sm font-bold text-slate-500">{listings.length} listing{listings.length === 1 ? '' : 's'}</span></div>
        {listings.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">This seller has no active listings right now.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map((product) => <button key={product.id} type="button" onClick={() => onNavigate?.('product-details', { productId: product.id })} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="h-40 bg-slate-100"><img src={getListingImage(product.image)} alt={product.title || 'Campus item'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PLACEHOLDER_IMAGE; }} className="h-full w-full object-cover" /></div><div className="p-4"><h3 className="font-black text-slate-900">{product.title || 'Campus item'}</h3><p className="mt-2 text-sm font-bold text-emerald-700">{product.price || 'Negotiable'} ETB</p><p className="mt-1 text-xs text-slate-500">{product.category || 'General'}</p></div></button>)}</div>}
      </section>
    </div>
  );
}

export default SellerProfileView;
