import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDetails from './ProductDetails';
import { clearPendingProductAction, getPendingProductAction } from '../../utils/productActionState';

const { mockSetCartItems } = vi.hoisted(() => ({ mockSetCartItems: vi.fn() }));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key) => key,
  }),
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({
    items: [],
    setItems: mockSetCartItems,
    loadedStudentId: 'buyer-1',
    loading: false,
    error: null,
  }),
}));

const product = {
  id: 42,
  title: 'Test phone',
  price: '1000',
  stock: 1,
  status: 'Approved',
};

const detail = {
  ...product,
  is_owner: false,
  seller_id: 'seller-1',
  seller_name: 'Seller',
  pickup_location: 'Student Center',
  pickup_hours: '08:00-17:00',
  views: 1,
};

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

describe('ProductDetails guest actions', () => {
  beforeEach(() => {
    clearPendingProductAction();
    mockSetCartItems.mockClear();
    vi.stubGlobal('fetch', vi.fn((input, options = {}) => {
      const url = String(input);
      if (url.includes('/api/products/42')) return Promise.resolve(jsonResponse(detail));
      if (url.includes('/api/settings/moderation')) return Promise.resolve(jsonResponse({ allowStudentReports: true }));
      if (url.includes('/api/settings/chat')) return Promise.resolve(jsonResponse({ enabled: true }));
      if (url.includes('/api/student/wishlist')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/api/student/cart') && options.method === 'POST') {
        return Promise.resolve(jsonResponse({
          item: { id: 8, product_id: 42, student_id: 'buyer-1', quantity: 1 },
        }));
      }
      return Promise.resolve(jsonResponse({}));
    }));
  });

  afterEach(() => {
    clearPendingProductAction();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects a guest Add to Cart click to Login and restores the same product after login', async () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <ProductDetails product={product} currentUser={null} onNavigate={onNavigate} />,
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Add to Cart' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to Cart' })[0]);

    expect(onNavigate).toHaveBeenCalledWith('login', {
      returnTo: '/?productId=42',
      message: 'productDetails.loginPrompt',
    });
    const pendingAction = getPendingProductAction();
    expect(pendingAction).toMatchObject({ returnTo: '42', action: 'addToCart', quantity: 1 });

    rerender(
      <ProductDetails
        product={product}
        currentUser={{ studentId: 'buyer-1' }}
        pendingAction={pendingAction}
        onPendingActionHandled={clearPendingProductAction}
        onNavigate={onNavigate}
      />,
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/student/cart'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(mockSetCartItems).toHaveBeenCalled();
  });
});
