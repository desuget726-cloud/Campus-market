export const analyticsSalesPeriods = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'year', label: 'This Year' },
];

export const getAnalyticsPeriodButtonClass = (period, key) => (
  `rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
    period === key ? 'bg-[#111c3a] text-white' : 'text-slate-600'
  }`
);

export const changeAnalyticsPeriod = (key, setPeriod) => setPeriod(key);

export async function fetchAnalyticsSales(period, token, apiBaseUrl, fetchImpl = fetch, signal) {
  if (!token) {
    throw new Error('An admin session is required to load sales data.');
  }
  const response = await fetchImpl(
    `${apiBaseUrl}/api/admin/analytics/sales-trend?range=${period}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || 'Unable to load sales data.');
  }
  if (
    !Array.isArray(data?.labels)
    || !Array.isArray(data?.revenue)
    || data.labels.length !== data.revenue.length
  ) {
    throw new Error('The analytics sales response was invalid.');
  }
  return {
    labels: data.labels.map((label) => String(label)),
    revenue: data.revenue.map((value) => Number(value) || 0),
  };
}

export function buildAnalyticsRevenueChart(labels, values) {
  const revenue = values.map((value) => Number(value) || 0);
  const maxValue = Math.max(...revenue, 1);
  const pts = revenue.map((value, index) => ({
    x: revenue.length > 1 ? 40 + index * (520 / (revenue.length - 1)) : 300,
    y: 110 - (value / maxValue) * 90,
    label: String(labels[index] ?? ''),
  }));
  const path = pts
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const areaPath = pts.length
    ? `${path} L ${pts[pts.length - 1].x.toFixed(2)},110 L ${pts[0].x.toFixed(2)},110 Z`
    : '';

  return { pts, path, areaPath, maxValue };
}
