import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsSalesPeriods,
  buildAnalyticsRevenueChart,
  changeAnalyticsPeriod,
  fetchAnalyticsSales,
  getAnalyticsGrowthPresentation,
  getAnalyticsPeriodButtonClass,
} from './analyticsSalesTrend.js';

test('each period selection requests its matching range and normalizes numeric values', async () => {
  for (const { key } of analyticsSalesPeriods) {
    let selectedPeriod = '7d';
    changeAnalyticsPeriod(key, (period) => {
      selectedPeriod = period;
    });
    let requestedUrl = '';
    let requestOptions;
    const result = await fetchAnalyticsSales(
      selectedPeriod,
      'test-admin-token',
      'https://marketplace.example',
      async (url, options) => {
        requestedUrl = url;
        requestOptions = options;
        return {
          ok: true,
          json: async () => ({ labels: ['14 Oct'], revenue: ['17.5'] }),
        };
      },
    );

    assert.equal(
      requestedUrl,
      `https://marketplace.example/api/admin/analytics/sales-trend?range=${key}`,
    );
    assert.equal(requestOptions.headers.Authorization, 'Bearer test-admin-token');
    assert.deepEqual(result, { labels: ['14 Oct'], revenue: [17.5] });
  }
});

test('period button classes track the selected period', () => {
  const activeClass = getAnalyticsPeriodButtonClass('30d', '30d');
  const inactiveClass = getAnalyticsPeriodButtonClass('30d', 'year');

  assert.match(activeClass, /whitespace-nowrap/);
  assert.match(activeClass, /bg-slate-900 text-white shadow-xs/);
  assert.match(inactiveClass, /text-slate-600 hover:text-slate-900/);
  assert.doesNotMatch(inactiveClass, /bg-slate-900/);
});

test('growth presentation handles positive, negative, neutral, and missing baselines', () => {
  assert.deepEqual(getAnalyticsGrowthPresentation({ change_pct: 12.5 }), {
    percentage: '+12.5%',
    label: '↗ Up trending',
    tone: 'up',
  });
  assert.deepEqual(getAnalyticsGrowthPresentation({ change_pct: -7.25 }), {
    percentage: '-7.3%',
    label: '↘ Down trending',
    tone: 'down',
  });
  assert.deepEqual(getAnalyticsGrowthPresentation({ change_pct: 0 }), {
    percentage: '0%',
    label: '→ No change',
    tone: 'neutral',
  });
  assert.deepEqual(getAnalyticsGrowthPresentation({ change_pct: null, trend: 'new' }), {
    percentage: 'New',
    label: '↗ New',
    tone: 'blue',
  });
  assert.equal(getAnalyticsGrowthPresentation(null).percentage, 'N/A');
});

test('chart geometry uses one aligned point per label and revenue value', () => {
  const chart = buildAnalyticsRevenueChart(
    ['Oct 12', 'Oct 13', 'Oct 14'],
    [10, 0, 20],
  );

  assert.equal(chart.pts.length, 3);
  assert.deepEqual(chart.pts.map(({ label }) => label), ['Oct 12', 'Oct 13', 'Oct 14']);
  assert.deepEqual(chart.pts.map(({ x }) => x), [40, 300, 560]);
  assert.equal(chart.path, 'M 40.00,65.00 L 300.00,110.00 L 560.00,20.00');
  assert.equal(chart.areaPath, `${chart.path} L 560.00,110 L 40.00,110 Z`);
});

test('empty and all-zero charts have safe geometry', () => {
  const emptyChart = buildAnalyticsRevenueChart([], []);
  const zeroChart = buildAnalyticsRevenueChart(['Oct 14'], [0]);

  assert.deepEqual(emptyChart.pts, []);
  assert.equal(emptyChart.path, '');
  assert.equal(emptyChart.areaPath, '');
  assert.equal(zeroChart.maxValue, 1);
  assert.equal(zeroChart.pts[0].y, 110);
});
