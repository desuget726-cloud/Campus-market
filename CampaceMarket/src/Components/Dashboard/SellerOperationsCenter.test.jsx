import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SellerOperationsCenter from './SellerOperationsCenter';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => ({
      'sellerHub.productManagement': 'Product Management',
      'sellerHub.backToOverview': 'Back to Overview',
      'sellerHub.inventoryTotal': 'total',
      'sellerHub.inventoryActive': 'Active',
      'sellerHub.inventorySold': 'Sold',
      'sellerHub.inventoryPending': 'Pending',
      'sellerHub.productsLoading': 'Loading products',
      'sellerHub.productsLoadError': "We couldn't load your products. Please try again.",
      'sellerHub.retryProducts': 'Retry',
      'sellerHub.productsPagination': 'Product pages',
      'sellerHub.productsPreviousPage': 'Previous page',
      'sellerHub.productsNextPage': 'Next page',
      'sellerHub.productsPage': 'Page {page}',
      'sellerHub.productsShowing': 'Showing {start}-{end} of {total}',
      'sellerHub.salesAnalytics': 'Sales Analytics',
      'sellerHub.salesPerformance': 'Sales Performance',
      'sellerHub.salesRange7d': '7 Days',
      'sellerHub.salesRange30d': '30 Days',
      'sellerHub.salesRange3m': '3 Months',
      'sellerHub.salesRangeTotals': 'Revenue: {revenue} · Orders: {orders}',
      'sellerHub.salesRevenueTrend': 'Sales revenue trend',
      'sellerHub.salesLoading': 'Loading sales...',
      'sellerHub.salesNoSales': 'No sales in this period',
      'sellerHub.salesLoadError': "We couldn't load sales analytics. Please try again.",
      'sellerHub.salesRetry': 'Retry',
      'sellerOrders.previous': 'Previous',
      'sellerOrders.next': 'Next',
    })[key] || key,
  }),
}));

vi.mock('../../hooks/useSellerOrders', () => ({
  useSellerOrders: () => ({
    filters: {},
    updateFilters: vi.fn(),
    pageData: { items: [], total: 0, page: 1, page_size: 10 },
    loading: false,
    error: '',
    retry: vi.fn(),
  }),
}));

vi.mock('../../utils/notify', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const createPageResponse = (page, total, itemCount) => {
  const pageSize = 10;
  const firstItem = (page - 1) * pageSize + 1;
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: firstItem + index,
      title: `Product ${firstItem + index}`,
      category: 'Books',
      price: '10',
      stock: 1,
      status: 'Approved',
      has_orders: false,
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
    summary: { total, active: total, sold: 0, pending: 0 },
  };
};

const createAnalyticsResponse = () => ({
  ok: true,
  json: async () => ({ points: [], stats: { total_orders: 0 }, comparisons: {} }),
});

const createRangeAnalyticsResponse = (range, label, revenue, orders = 1) => {
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 30 : 3;
  return {
    range,
    labels: Array.from({ length: bucketCount }, (_, index) => `${label}-${index + 1}`),
    values: Array.from({ length: bucketCount }, (_, index) => index === 0 ? revenue : 0),
    points: Array.from({ length: bucketCount }, (_, index) => ({
      date: `${range}-${index + 1}`,
      label: `${label}-${index + 1}`,
      total: index === 0 ? revenue : 0,
      orders: index === 0 ? orders : 0,
    })),
    stats: { total_revenue: revenue, total_orders: orders },
    totals: { revenue, orders },
    comparisons: {},
  };
};

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderProductManagement = (props = {}) => render(
  <SellerOperationsCenter
    user={{ studentId: 'seller-1', access_token: 'session-token' }}
    sellerData={{}}
    sellerDashboardData={{
      stats: {},
      alerts: {},
      performance: {},
      my_listings: [],
      received_orders: [],
    }}
    sellerOrdersLoading={false}
    sellerOrdersError=""
    onRefreshOrders={vi.fn()}
    myListings={[]}
    onAddProduct={vi.fn()}
    onNavigate={vi.fn()}
    onViewProduct={vi.fn()}
    onPaymentHistory={vi.fn()}
    onEditProduct={vi.fn()}
    onDeleteProduct={vi.fn().mockResolvedValue(undefined)}
    onTogglePause={vi.fn().mockResolvedValue(undefined)}
    onMarkAsSold={vi.fn().mockResolvedValue(undefined)}
    openOrderId={null}
    onOpenSellerOrder={vi.fn()}
    onBackToSellerOrders={vi.fn()}
    onOpenSellerChat={vi.fn()}
    {...props}
  />,
);

describe('SellerOperationsCenter product pagination', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/seller?tab=seller&section=products&page=1');
  });

  it('hides pagination controls when the inventory has seven products', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      String(url).includes('/seller/products')
        ? { ok: true, json: async () => createPageResponse(1, 7, 7) }
        : createAnalyticsResponse()
    )));
    renderProductManagement();

    expect(await screen.findByText('Product 1')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Product pages' })).toBeNull();
    expect(screen.getByText('7 total')).toBeTruthy();
  });

  it('opens product details from the inventory row and View button', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      String(url).includes('/seller/products')
        ? { ok: true, json: async () => createPageResponse(1, 7, 7) }
        : createAnalyticsResponse()
    )));
    const onViewProduct = vi.fn();
    const user = userEvent.setup();
    renderProductManagement({ onViewProduct });

    const row = await screen.findByRole('row', { name: /Product 1/ });
    await user.click(row);
    await user.click(within(row).getByRole('button', { name: 'View' }));

    expect(onViewProduct).toHaveBeenNthCalledWith(1, 1);
    expect(onViewProduct).toHaveBeenNthCalledWith(2, 1);
  });

  it('loads page two and updates the URL when Next is activated', async () => {
    const fetchProducts = vi.fn(async (url) => {
      if (!String(url).includes('/seller/products')) return createAnalyticsResponse();
      const page = Number(new URL(url).searchParams.get('page'));
      return {
        ok: true,
        json: async () => createPageResponse(page, 25, 10),
      };
    });
    vi.stubGlobal('fetch', fetchProducts);
    const user = userEvent.setup();
    renderProductManagement();

    await screen.findByText('Product 1');
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Product 11')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toContain('page=2'));
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.stringContaining('page=2'), expect.any(Object));
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
  });

  it('moves to the previous page when deleting the final product page', async () => {
    window.history.replaceState({}, '', '/seller?tab=seller&section=products&page=3');
    let productFetchCount = 0;
    const fetchProducts = vi.fn(async (url) => {
      if (!String(url).includes('/seller/products')) return createAnalyticsResponse();
      productFetchCount += 1;
      const page = Number(new URL(url).searchParams.get('page'));
      return {
        ok: true,
        json: async () => page === 3 && productFetchCount === 1
          ? createPageResponse(3, 25, 5)
          : createPageResponse(2, 20, 10),
      };
    });
    vi.stubGlobal('fetch', fetchProducts);
    const onDeleteProduct = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);
    renderProductManagement({ onDeleteProduct });

    await screen.findByText('Product 25');
    const lastProductRow = screen.getByRole('row', { name: /Product 25/ });
    await user.click(within(lastProductRow).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Product 20')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toContain('page=2'));
    expect(onDeleteProduct).toHaveBeenCalledWith(25);
    expect(fetchProducts).toHaveBeenCalledWith(expect.stringContaining('page=3'), expect.any(Object));
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.stringContaining('page=3'), expect.any(Object));
  });

  it('requests 7d and updates the chart and totals when that range is clicked', async () => {
    window.history.replaceState({}, '', '/seller?tab=seller&section=orders');
    const fetchAnalytics = vi.fn(async (url) => {
      const range = new URL(url).searchParams.get('range');
      return {
        ok: true,
        json: async () => range === '7d'
          ? createRangeAnalyticsResponse('7d', 'Day', 75, 2)
          : createRangeAnalyticsResponse('3m', 'Month', 250, 4),
      };
    });
    vi.stubGlobal('fetch', fetchAnalytics);
    const user = userEvent.setup();
    renderProductManagement();

    const rangeButton = await screen.findByRole('button', { name: '7 Days' });
    await user.click(rangeButton);

    expect(rangeButton.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(fetchAnalytics).toHaveBeenLastCalledWith(
        expect.stringContaining('range=7d'),
        expect.any(Object),
      );
    });
    expect(await screen.findByText('Day-1')).toBeTruthy();
    expect(screen.getByText('Revenue: 75 ETB · Orders: 2')).toBeTruthy();
  });

  it('keeps the latest selected range when responses resolve out of order', async () => {
    window.history.replaceState({}, '', '/seller?tab=seller&section=orders');
    const requests = new Map();
    const fetchAnalytics = vi.fn((url) => {
      const range = new URL(url).searchParams.get('range');
      const request = deferred();
      requests.set(range, request);
      return request.promise;
    });
    vi.stubGlobal('fetch', fetchAnalytics);
    const user = userEvent.setup();
    renderProductManagement();

    await waitFor(() => expect(requests.has('3m')).toBe(true));
    await user.click(screen.getByRole('button', { name: '7 Days' }));
    await waitFor(() => expect(requests.has('7d')).toBe(true));
    await user.click(screen.getByRole('button', { name: '30 Days' }));
    await waitFor(() => expect(requests.has('30d')).toBe(true));

    requests.get('30d').resolve({
      ok: true,
      json: async () => createRangeAnalyticsResponse('30d', 'Latest-30d', 30, 3),
    });
    expect(await screen.findByText('Latest-30d-1')).toBeTruthy();
    expect(screen.getByText('Revenue: 30 ETB · Orders: 3')).toBeTruthy();

    requests.get('7d').resolve({
      ok: true,
      json: async () => createRangeAnalyticsResponse('7d', 'Stale-7d', 7, 1),
    });
    requests.get('3m').resolve({
      ok: true,
      json: async () => createRangeAnalyticsResponse('3m', 'Stale-3m', 3, 1),
    });

    await waitFor(() => expect(screen.getByRole('button', { name: '30 Days' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('Latest-30d-1')).toBeTruthy();
    expect(screen.queryByText('Stale-7d-1')).toBeNull();
    expect(screen.queryByText('Stale-3m-1')).toBeNull();
  });

  it('shows a retry action after an analytics request fails', async () => {
    window.history.replaceState({}, '', '/seller?tab=seller&section=orders');
    let attempt = 0;
    const fetchAnalytics = vi.fn(async () => {
      attempt += 1;
      return attempt === 1
        ? { ok: false, json: async () => ({ detail: 'Service unavailable' }) }
        : {
          ok: true,
          json: async () => createRangeAnalyticsResponse('3m', 'Recovered', 40, 1),
        };
    });
    vi.stubGlobal('fetch', fetchAnalytics);
    const user = userEvent.setup();
    renderProductManagement();

    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Recovered-1')).toBeTruthy();
    expect(fetchAnalytics).toHaveBeenCalledTimes(2);
  });
});

describe('SellerOperationsCenter overview metrics', () => {
  let scrollIntoView;

  beforeEach(() => {
    window.history.replaceState({}, '', '/seller?tab=seller');
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      String(url).includes('/seller/products')
        ? { ok: true, json: async () => createPageResponse(1, 0, 0) }
        : createAnalyticsResponse()
    )));
  });

  afterEach(() => {
    delete HTMLElement.prototype.scrollIntoView;
  });

  it('renders all four metric cards as titled interactive buttons', () => {
    renderProductManagement();

    expect(screen.getByTitle('View your listings').tagName).toBe('BUTTON');
    expect(screen.getByTitle('View received orders').tagName).toBe('BUTTON');
    expect(screen.getByTitle('View revenue and analytics').tagName).toBe('BUTTON');
    expect(screen.getByTitle('View legacy order records').tagName).toBe('BUTTON');
    for (const title of [
      'View your listings',
      'View received orders',
      'View revenue and analytics',
      'View legacy order records',
    ]) {
      expect(screen.getByTitle(title).className).toContain('hover:-translate-y-0.5');
      expect(screen.getByTitle(title).className).toContain('hover:border-blue-400');
      expect(screen.getByTitle(title).className).toContain('hover:shadow-lg');
      expect(screen.getByTitle(title).className).toContain('duration-200');
      expect(screen.getByTitle(title).className).toContain('select-none');
    }
  });

  it('ranks products by revenue by default and updates when another metric is selected', async () => {
    const user = userEvent.setup();
    renderProductManagement({
      sellerDashboardData: {
        stats: {},
        alerts: {},
        performance: {},
        my_listings: [
          { id: 1, title: 'Revenue leader', status: 'Approved', views: 10, order_count: 2, revenue: 500 },
          { id: 2, title: 'Views leader', status: 'Approved', views: 300, order_count: 1, revenue: 100 },
          { id: 3, title: 'Orders leader', status: 'Approved', views: 20, order_count: 8, revenue: 300 },
        ],
        received_orders: [],
      },
    });

    const leaderboard = screen.getByRole('heading', { name: 'Top Performing Products' }).closest('section');
    const getRankedTitles = () => within(leaderboard).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);
    expect(getRankedTitles()).toEqual(['Revenue leader', 'Orders leader', 'Views leader']);

    const sortControls = within(leaderboard).getByRole('group', { name: 'Sort top performing products' });
    const revenueButton = within(sortControls).getByRole('button', { name: 'Revenue' });
    expect(revenueButton.getAttribute('aria-pressed')).toBe('true');
    expect(revenueButton.className).toContain('bg-white');
    expect(within(leaderboard).getByText('#1')).toBeTruthy();
    expect(within(leaderboard).getByText('500 ETB', { exact: false })).toBeTruthy();
    expect(within(leaderboard).getByText('10 views · 2 orders')).toBeTruthy();

    await user.click(within(sortControls).getByRole('button', { name: 'Orders' }));
    expect(within(sortControls).getByRole('button', { name: 'Orders' }).getAttribute('aria-pressed')).toBe('true');
    expect(getRankedTitles()).toEqual(['Orders leader', 'Revenue leader', 'Views leader']);
  });

  it('opens inventory and smoothly scrolls to My Products', async () => {
    const user = userEvent.setup();
    renderProductManagement();

    await user.click(screen.getByTitle('View your listings'));
    expect(await screen.findByText('My Products')).toBeTruthy();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }));
    expect(scrollIntoView.mock.contexts[0].id).toBe('seller-products');
  });

  it('opens received orders and smoothly scrolls to the legacy order history', async () => {
    const user = userEvent.setup();
    renderProductManagement();

    await user.click(screen.getByTitle('View received orders'));
    expect(await screen.findByText('Historical Customer Orders')).toBeTruthy();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }));
    expect(scrollIntoView.mock.contexts[0].id).toBe('seller-orders');
  });

  it('opens analytics and smoothly scrolls to Sales Analytics', async () => {
    const user = userEvent.setup();
    renderProductManagement();

    await user.click(screen.getByTitle('View revenue and analytics'));
    expect(await screen.findByText('Sales Performance')).toBeTruthy();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }));
    expect(scrollIntoView.mock.contexts[0].id).toBe('seller-analytics');
  });

  it('opens historical records and smoothly scrolls to legacy orders', async () => {
    const user = userEvent.setup();
    renderProductManagement();

    await user.click(screen.getByTitle('View legacy order records'));
    expect(await screen.findByText('Historical Customer Orders')).toBeTruthy();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }));
    expect(scrollIntoView.mock.contexts[0].id).toBe('seller-orders');
  });
});
