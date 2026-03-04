import React, { useMemo, useState } from 'react';
import { formatISO, startOfYear, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import { CountryDetailsQuery, CountryDetailsResponse, DateRange, Metric, SummaryMetric } from '../types/map';

const Plot = createPlotlyComponent(Plotly);

const rankMetricOptions: Array<{ value: Metric; label: string }> = [
  { value: 'cases', label: 'Cases (daily)' },
  { value: 'deaths', label: 'Deaths (daily)' },
  { value: 'recovered', label: 'Recovered (daily)' },
  { value: 'active', label: 'Active' },
  { value: 'incidence', label: 'Incidence' },
  { value: 'mortality', label: 'Mortality (%)' },
];

function toSummaryMetric(metric: Metric): SummaryMetric {
  if (metric === 'cases') return 'today_cases';
  if (metric === 'deaths') return 'today_deaths';
  if (metric === 'recovered') return 'today_recovered';
  return metric;
}

function quickRangeBounds(label: '7d' | '30d' | 'ytd'): DateRange {
  const now = new Date();
  const to = formatISO(now, { representation: 'date' });
  if (label === '7d') return { from: formatISO(subDays(now, 6), { representation: 'date' }), to };
  if (label === '30d') return { from: formatISO(subDays(now, 29), { representation: 'date' }), to };
  return { from: formatISO(startOfYear(now), { representation: 'date' }), to };
}

function formatValue(metric: SummaryMetric, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function buildCountryQuery(
  metric: SummaryMetric,
  dateMode: 'day' | 'range',
  date: string,
  range: DateRange
): CountryDetailsQuery {
  if (dateMode === 'day') {
    return { iso3: 'WORLD', metric, dateMode: 'day', date };
  }
  return { iso3: 'WORLD', metric, dateMode: 'range', range };
}

const WorldwideView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [dateMode, setDateMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [rankMetric, setRankMetric] = useState<Metric>('cases');

  const queryCases = buildCountryQuery('today_cases', dateMode, date, range);
  const queryDeaths = buildCountryQuery('today_deaths', dateMode, date, range);
  const queryRecovered = buildCountryQuery('today_recovered', dateMode, date, range);
  const queryActive = buildCountryQuery('active', dateMode, date, range);
  const queryMortality = buildCountryQuery('mortality', dateMode, date, range);

  const worldQueries = useQueries({
    queries: [queryCases, queryDeaths, queryRecovered, queryActive, queryMortality].map((query) => ({
      queryKey: ['world-country-metric', query],
      queryFn: () => fetchCountryDetails(query),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const casesData = worldQueries[0]?.data as CountryDetailsResponse | undefined;
  const deathsData = worldQueries[1]?.data as CountryDetailsResponse | undefined;
  const recoveredData = worldQueries[2]?.data as CountryDetailsResponse | undefined;
  const activeData = worldQueries[3]?.data as CountryDetailsResponse | undefined;
  const mortalityData = worldQueries[4]?.data as CountryDetailsResponse | undefined;
  const worldLoading = worldQueries.some((item) => item.isLoading);
  const worldError = worldQueries.find((item) => item.error)?.error as Error | undefined;

  const rankSummaryMetric = toSummaryMetric(rankMetric);
  const rankingQuery = useQuery({
    queryKey: ['world-ranking', rankSummaryMetric, dateMode, date, range.from, range.to],
    queryFn: async () => {
      const params =
        dateMode === 'day'
          ? { metric: rankSummaryMetric, date }
          : { metric: rankSummaryMetric, from: range.from, to: range.to };
      const response = await fetchSummary(params);
      return response.data
        .filter((item) => item.isoCode?.toUpperCase() !== 'WORLD')
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const ranking = useMemo(() => rankingQuery.data ?? [], [rankingQuery.data]);
  const periodLabel = dateMode === 'day' ? date : `${range.from} → ${range.to}`;
  const totals = casesData?.totals || casesData?.snapshot;

  const timelineChartData = useMemo(() => {
    const traces = [];
    if (casesData?.series?.length) {
      traces.push({
        x: casesData.series.map((p) => p.date),
        y: casesData.series.map((p) => p.value ?? null),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Cases (daily)',
        line: { color: '#4de0ff', width: 2.5 },
      });
    }
    if (deathsData?.series?.length) {
      traces.push({
        x: deathsData.series.map((p) => p.date),
        y: deathsData.series.map((p) => p.value ?? null),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Deaths (daily)',
        line: { color: '#ff8a47', width: 2.3 },
      });
    }
    if (recoveredData?.series?.length) {
      traces.push({
        x: recoveredData.series.map((p) => p.date),
        y: recoveredData.series.map((p) => p.value ?? null),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Recovered (daily)',
        line: { color: '#80ed99', width: 2.1 },
      });
    }
    return traces;
  }, [casesData?.series, deathsData?.series, recoveredData?.series]);

  const rankBarData = useMemo(
    () => ({
      labels: ranking.map((item) => item.name || item.isoCode),
      values: ranking.map((item) => item.value ?? 0),
    }),
    [ranking]
  );

  return (
    <div className="page world-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Global monitor</p>
          <h1 className="title">COVID Worldwide</h1>
          <p className="lede">
            Global view with KPI cards, trend charts and top-country rankings for the selected day or period.
          </p>
        </div>
      </header>

      <div className="filter-bar world-filter-bar">
        <div className="filter-group">
          <label className="filter-label">View mode</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`pill ${dateMode === 'day' ? 'pill-active' : ''}`}
              onClick={() => setDateMode('day')}
            >
              Single day
            </button>
            <button
              type="button"
              className={`pill ${dateMode === 'range' ? 'pill-active' : ''}`}
              onClick={() => setDateMode('range')}
            >
              Period
            </button>
          </div>
        </div>

        {dateMode === 'day' ? (
          <div className="filter-group">
            <label className="filter-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="date-input"
            />
          </div>
        ) : (
          <div className="filter-group range-group">
            <label className="filter-label">Date range</label>
            <div className="range-inputs">
              <input
                type="date"
                value={range.from}
                onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
                className="date-input"
              />
              <span className="dash">–</span>
              <input
                type="date"
                value={range.to}
                onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
                className="date-input"
              />
            </div>
            <div className="mode-toggle">
              <button type="button" className="pill pill-ghost" onClick={() => setRange(quickRangeBounds('7d'))}>
                7d
              </button>
              <button type="button" className="pill pill-ghost" onClick={() => setRange(quickRangeBounds('30d'))}>
                30d
              </button>
              <button type="button" className="pill pill-ghost" onClick={() => setRange(quickRangeBounds('ytd'))}>
                YTD
              </button>
            </div>
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">Ranking metric</label>
          <select
            value={rankMetric}
            onChange={(event) => setRankMetric(event.target.value as Metric)}
            className="filter-select"
          >
            {rankMetricOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {worldError ? <div className="banner banner-error">Unable to load worldwide data.</div> : null}

      <div className="world-kpi-grid">
        <div className="world-kpi-card">
          <p className="world-kpi-label">New cases</p>
          <p className="world-kpi-value">{formatValue('today_cases', casesData?.headline)}</p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
        <div className="world-kpi-card">
          <p className="world-kpi-label">New deaths</p>
          <p className="world-kpi-value">{formatValue('today_deaths', deathsData?.headline)}</p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
        <div className="world-kpi-card">
          <p className="world-kpi-label">Recovered (daily)</p>
          <p className="world-kpi-value">{formatValue('today_recovered', recoveredData?.headline)}</p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
        <div className="world-kpi-card">
          <p className="world-kpi-label">Active (total)</p>
          <p className="world-kpi-value">{formatValue('active', activeData?.headline)}</p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
        <div className="world-kpi-card">
          <p className="world-kpi-label">Mortality</p>
          <p className="world-kpi-value">{formatValue('mortality', mortalityData?.headline)}</p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
        <div className="world-kpi-card">
          <p className="world-kpi-label">Total cases</p>
          <p className="world-kpi-value">{formatValue('cases', totals?.cases)}</p>
          <p className="world-kpi-hint">{casesData?.coverage?.overallLatest || '—'}</p>
        </div>
      </div>

      <div className="world-chart-grid">
        <div className="world-chart-card">
          <div className="chart-header">
            <p className="panel-kicker">Worldwide daily trends</p>
            {worldLoading ? <span className="pill pill-ghost">Loading…</span> : null}
          </div>
          {timelineChartData.length ? (
            <div className="world-plot-frame">
              <Plot
                data={timelineChartData}
                layout={{
                  height: 340,
                  margin: { l: 44, r: 12, t: 12, b: 36 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  legend: { orientation: 'h', y: 1.1, x: 0 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '340px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">No timeline data for selected period.</div>
          )}
        </div>

        <div className="world-chart-card">
          <div className="chart-header">
            <p className="panel-kicker">Top countries • {rankMetricOptions.find((m) => m.value === rankMetric)?.label}</p>
            {rankingQuery.isLoading ? <span className="pill pill-ghost">Loading…</span> : null}
          </div>
          {rankBarData.labels.length ? (
            <div className="world-plot-frame">
              <Plot
                data={[
                  {
                    x: rankBarData.values,
                    y: rankBarData.labels,
                    type: 'bar',
                    orientation: 'h',
                    marker: {
                      color: '#4de0ff',
                    },
                  },
                ]}
                layout={{
                  height: 340,
                  margin: { l: 110, r: 18, t: 12, b: 26 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, automargin: true },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '340px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">No country ranking data for selected settings.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorldwideView;
