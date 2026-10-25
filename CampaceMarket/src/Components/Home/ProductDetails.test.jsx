import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  seller_typical_response_bucket: null,
  seller_id: 'seller-1',
  seller_name: 'Seller',
  pickup_location: 'Student Center',
  pickup_hours: '08:00-17:00',
  views: 1,
};

const similarProduct = {
  id: 99,
  title: 'Similar book',
  category: 'Books',
  price: 500,
  image: '/uploads/book.jpg',
  status: 'Approved',
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
      if (url.includes('/api/products/42/similar')) return Promise.resolve(jsonResponse([similarProduct]));
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
    cleanup();
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

  it('hides the seller response-time stat when the backend returns null', async () => {
    render(<ProductDetails product={product} currentUser={{ studentId: 'buyer-1' }} />);

    await waitFor(() => expect(screen.getByText('Seller')).toBeTruthy());
    expect(screen.queryByText('productDetails.buyer.responseTime')).toBeNull();
  });

  it.each([
    ['anonymous', null],
    ['signed-in', { studentId: 'buyer-1' }],
  ])('renders similar products below the description and reviews for %s visitors', async (_audience, currentUser) => {
    const detailedProduct = {
      ...detail,
      review_count: 1,
      reviews: [{
        id: 7,
        reviewer_name: 'Buyer',
        rating: 5,
        comment: 'Great item',
      }],
    };
    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);
      if (url.includes('/api/products/42/similar')) return Promise.resolve(jsonResponse([similarProduct]));
      if (url.includes('/api/products/42')) return Promise.resolve(jsonResponse(detailedProduct));
      if (url.includes('/api/settings/moderation')) return Promise.resolve(jsonResponse({ allowStudentReports: true }));
      if (url.includes('/api/settings/chat')) return Promise.resolve(jsonResponse({ enabled: true }));
      if (url.includes('/api/student/wishlist')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const onNavigate = vi.fn();
    render(
      <ProductDetails
        product={product}
        currentUser={currentUser}
        onNavigate={onNavigate}
      />,
    );

    const similarHeading = await screen.findByRole('heading', {
      name: 'productDetails.buyer.similarProducts',
    });
    const descriptionHeading = screen.getByRole('heading', { name: 'Detailed Description' });
    const reviewsHeading = screen.getByRole('heading', { name: 'Buyer ratings' });
    expect(descriptionHeading.compareDocumentPosition(reviewsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reviewsHeading.compareDocumentPosition(similarHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const card = await screen.findByRole('button', { name: /Similar book/ });
    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith('product-details', { productId: 99 });

    const similarRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/similar'));
    expect(similarRequest).toHaveLength(1);
  });
});
