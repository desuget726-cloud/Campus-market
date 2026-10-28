import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SellerOrderDetails from './SellerOrderDetails';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key) => ({
      'sellerOrders.timeline': 'Timeline',
      'sellerOrders.orderCreated': 'Order created',
      'sellerOrders.paymentCompleted': 'Payment completed',
      'sellerOrders.orderCompleted': 'Order completed',
      'sellerOrders.unavailable': 'Not available',
    })[key] || key,
  }),
}));

afterEach(() => cleanup());

const renderOrderDetails = (timeline) => render(
  <SellerOrderDetails
    order={{
      id: 30,
      status: 'Completed',
      product: { name: 'Campus Textbook', images: [] },
      payment: {
        item_price: 100,
        fees: 0,
        total_received: 100,
        payment_status: 'Successful',
        paid_at: '2026-10-28T11:00:00+00:00',
      },
      buyer: { name: 'Buyer' },
      timeline,
    }}
    loading={false}
    error=""
    onRetry={vi.fn()}
    onBack={vi.fn()}
  />,
);

const getTimelineItems = () => {
  const section = screen.getByRole('heading', { name: 'Timeline' }).closest('section');
  return within(section).getAllByRole('listitem');
};

describe('SellerOrderDetails timeline', () => {
  it('renders three steps with consistent timestamps for a new order', () => {
    const timestamp = '2026-10-28T11:00:00+00:00';
    renderOrderDetails({
      order_created_at: timestamp,
      payment_completed_at: timestamp,
      order_completed_at: timestamp,
    });

    const steps = getTimelineItems();
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Order created'),
      expect.stringContaining('Payment completed'),
      expect.stringContaining('Order completed'),
    ]);
    expect(steps.map((step) => step.textContent.match(/2026/gu)?.length || 0)).toEqual([1, 1, 1]);
  });

  it('renders legacy orders with handover data without showing a handover step', () => {
    renderOrderDetails({
      order_created_at: '2024-01-02T03:00:00+00:00',
      handover_at: '2024-01-02T04:00:00+00:00',
      payment_completed_at: '2024-01-02T05:00:00+00:00',
      order_completed_at: '2024-01-02T05:00:00+00:00',
    });

    const steps = getTimelineItems();
    expect(steps).toHaveLength(3);
    expect(screen.queryByText(/handover|meeting/iu)).toBeNull();
  });
});
