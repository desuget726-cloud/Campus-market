import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SimilarProductsSection from './SimilarProductsSection';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key) => ({
      'productDetails.buyer.similarProducts': 'Similar Products',
      'productDetails.buyer.similarProductsError': 'We could not load similar products.',
      'productDetails.buyer.similarProductsRetry': 'Retry',
      'productDetails.buyer.soldOut': 'Sold out',
      'productDetails.buyer.category': 'Category',
    })[key] || key,
  }),
}));

const product = {
  id: 12,
  title: 'Campus laptop',
  category: 'Electronics',
  price: '12000',
  image: '/uploads/laptop.jpg',
  status: 'Approved',
  stock: 1,
};

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

describe('SimilarProductsSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([product])));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders product details and navigates when a card is clicked', async () => {
    const onNavigate = vi.fn();
    render(<SimilarProductsSection productId={42} onNavigate={onNavigate} />);

    expect(await screen.findByRole('heading', { name: 'Similar Products' })).toBeTruthy();
    const card = await screen.findByRole('button', { name: /Campus laptop/ });
    expect(card.tabIndex).toBe(0);
    expect(card.getAttribute('aria-label')).toContain('Electronics');
    expect(screen.getByText('12,000 ETB')).toBeTruthy();
    expect(screen.getByText('Category: Electronics')).toBeTruthy();
    expect(globalThis.fetch.mock.calls[0]).toHaveLength(1);

    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith('product-details', { productId: 12 });

    onNavigate.mockClear();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('product-details', { productId: 12 });

    onNavigate.mockClear();
    fireEvent.keyDown(card, { key: ' ' });
    expect(onNavigate).toHaveBeenCalledWith('product-details', { productId: 12 });
  });

  it('shows a sold-out badge when the listing has no stock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([
      { ...product, stock: 0, status: 'Sold' },
    ])));
    render(<SimilarProductsSection productId={42} />);

    expect(await screen.findByText('Sold out')).toBeTruthy();
  });

  it('hides the section when the marketplace has no other active products', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
    render(<SimilarProductsSection productId={42} />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Similar Products' })).toBeNull());
  });

  it('shows an error and retries the request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'temporary failure' }, 500))
      .mockResolvedValueOnce(jsonResponse([product]));
    vi.stubGlobal('fetch', fetchMock);
    render(<SimilarProductsSection productId={42} />);

    expect(await screen.findByText('temporary failure')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Campus laptop/ })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
