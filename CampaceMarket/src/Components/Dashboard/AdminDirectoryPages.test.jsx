import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminProductReviewsPage } from './AdminDirectoryPages';

const { adminApiGet, adminApiPatch, adminApiDelete, notifySuccess } = vi.hoisted(() => ({
  adminApiGet: vi.fn(),
  adminApiPatch: vi.fn(),
  adminApiDelete: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('../../api/apiClient', () => ({
  adminApiGet,
  adminApiPatch,
  adminApiDelete,
}));

vi.mock('../../utils/notify', () => ({
  getErrorMessage: (error) => error.message,
  notifySuccess,
}));

const reviews = [
  { id: 1, product_id: 101, product: 'Five Star Product', reviewer: 'Buyer One', reviewer_id: 'buyer-1', order_id: 21, rating: 5, comment: 'Excellent', image: '/uploads/product.jpg', is_hidden: false },
  { id: 2, product_id: 102, product: 'Four Star Product', reviewer: 'Buyer Two', reviewer_id: 'buyer-2', order_id: 22, rating: 4, comment: 'Good', is_hidden: true },
  { id: 3, product_id: 103, product: 'Low Rated Product', reviewer: 'Buyer Three', reviewer_id: 'buyer-3', order_id: 23, rating: 2, comment: 'Needs work', is_hidden: false },
];

beforeEach(() => {
  adminApiGet.mockResolvedValue(reviews);
  adminApiPatch.mockResolvedValue({});
  adminApiDelete.mockResolvedValue({});
  notifySuccess.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AdminProductReviewsPage', () => {
  it('renders verified purchase cards with stars, thumbnails, and rating/visibility filters', async () => {
    const { container } = render(<AdminProductReviewsPage />);

    expect(await screen.findByText('Five Star Product')).toBeTruthy();
    expect(screen.getAllByText('Verified Purchase')).toHaveLength(3);
    expect(container.querySelector('img').getAttribute('src')).toContain('/uploads/product.jpg');
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /5 Stars/ }));
    expect(screen.getByText('Five Star Product')).toBeTruthy();
    expect(screen.queryByText('Four Star Product')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /All Ratings/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Hidden (1)' }));
    expect(screen.getByText('Four Star Product')).toBeTruthy();
    expect(screen.queryByText('Five Star Product')).toBeNull();
  });

  it('hides and unhides reviews using the admin endpoint', async () => {
    render(<AdminProductReviewsPage />);
    const card = await screen.findByText('Five Star Product').then((element) => element.closest('article'));

    fireEvent.click(within(card).getByRole('button', { name: 'Hide' }));

    await waitFor(() => expect(adminApiPatch).toHaveBeenCalledWith(
      '/api/admin/reviews/1/visibility',
      { is_hidden: true },
    ));
    expect(await within(card).findByRole('button', { name: 'Unhide' })).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Unhide' }));
    await waitFor(() => expect(adminApiPatch).toHaveBeenLastCalledWith(
      '/api/admin/reviews/1/visibility',
      { is_hidden: false },
    ));
  });

  it('requires delete confirmation, removes confirmed reviews, and opens the product detail flow', async () => {
    const onNavigate = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminProductReviewsPage onNavigate={onNavigate} />);
    const card = await screen.findByText('Five Star Product').then((element) => element.closest('article'));

    fireEvent.click(within(card).getByRole('button', { name: 'Delete Review' }));
    expect(confirm).toHaveBeenCalled();
    expect(adminApiDelete).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete Review' }));
    await waitFor(() => expect(adminApiDelete).toHaveBeenCalledWith('/api/admin/reviews/1'));
    await waitFor(() => expect(screen.queryByText('Five Star Product')).toBeNull());

    const otherCard = screen.getByText('Four Star Product').closest('article');
    fireEvent.click(within(otherCard).getByRole('button', { name: 'View Product' }));
    expect(onNavigate).toHaveBeenCalledWith('product-details', { productId: 102 });
  });
});
