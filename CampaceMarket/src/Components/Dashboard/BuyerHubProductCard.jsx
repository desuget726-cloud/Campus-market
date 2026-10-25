import { IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import ProductPurchaseActions from '../ProductPurchaseActions';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';

function getProductImage(image) {
  if (Array.isArray(image)) return image.find(Boolean) || '';
  if (typeof image !== 'string' || !image.trim()) return '';

  const value = image.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const images = JSON.parse(value);
      return Array.isArray(images) ? images.find(Boolean) || '' : '';
    } catch {
      return '';
    }
  }
  return value;
}

export default function BuyerHubProductCard({
  item,
  priceLabel,
  isOwnProduct,
  isOutOfStock,
  isInCart,
  isInWishlist,
  cartReady,
  cartError,
  isAddingToCart,
  onViewProduct,
  onAddToCart,
  onPay,
  onAddToWishlist,
  onEdit,
  onDelete,
  onKeyDown,
}) {
  const image = getProductImage(item.image);
  const imageUrl = image ? resolveImageUrl(image) : FALLBACK_IMAGE;
  const wishlistAction = isInWishlist ? (
    <button
      type="button"
      onClick={(event) => event.stopPropagation()}
      disabled
      className="w-full cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400 transition"
    >
      ♥ In Wishlist
    </button>
  ) : (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onAddToWishlist();
      }}
      className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      ♡ Add to Wishlist
    </button>
  );

  return (
    <div
      onClick={onViewProduct}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      className="flex w-full min-w-0 cursor-pointer flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <img
          src={imageUrl}
          alt={item.title}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = imageUrl === FALLBACK_IMAGE ? IMAGE_PLACEHOLDER : FALLBACK_IMAGE;
          }}
          className="aspect-square h-auto w-full max-w-full rounded-2xl object-cover"
        />
        <div className="min-w-0">
          <p className="max-w-full truncate text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
            {item.category} / {item.subcategory || 'General'}
          </p>
          <h4 className="mt-2 line-clamp-2 break-words text-sm font-semibold text-slate-900 dark:text-white">
            {item.title}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-300">
            {item.description || item.summary || 'No description available.'}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{priceLabel}</p>
        </div>
      </div>

      <div className="mt-auto flex min-w-0 flex-col gap-2">
        <ProductPurchaseActions
          isOwner={isOwnProduct}
          isSoldOut={isOutOfStock}
          isInCart={isInCart}
          cartReady={cartReady}
          cartError={cartError}
          isAddingToCart={isAddingToCart}
          onAddToCart={(event) => {
            event.stopPropagation();
            onAddToCart();
          }}
          onPay={(event) => {
            event.stopPropagation();
            onPay();
          }}
          wishlistAction={wishlistAction}
        />
        {isOwnProduct && (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewProduct();
              }}
              className="btn-primary w-full rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition"
            >
              View
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="w-full rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
