import React, { useEffect, useMemo, useState } from 'react';
import { formatISO, startOfYear, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import { CountryDetailsQuery, CountryDetailsResponse, DateRange, SummaryMetric } from '../types/map';

const Plot = createPlotlyComponent(Plotly);

type CountryOption = {
  iso3: string;
  name: string;
};

const chartMetricCards: Array<{ metric: SummaryMetric; label: string }> = [
  { metric: 'today_cases', label: 'Cases (daily)' },
  { metric: 'today_deaths', label: 'Deaths (daily)' },
  { metric: 'today_recovered', label: 'Recovered (daily)' },
  { metric: 'active', label: 'Active (total)' },
  { metric: 'incidence', label: 'Incidence' },
  { metric: 'mortality', label: 'Mortality (%)' },
];

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
  iso3: string | null,
  metric: SummaryMetric,
  dateMode: 'day' | 'range',
  date: string,
  range: DateRange
): CountryDetailsQuery | null {
  if (!iso3) return null;
  if (dateMode === 'day') return { iso3, metric, dateMode: 'day', date };
  return { iso3, metric, dateMode: 'range', range };
}

type MetricChartCardProps = {
  title: string;
  metric: SummaryMetric;
  response?: CountryDetailsResponse;
  loading: boolean;
};

const MetricChartCard: React.FC<MetricChartCardProps> = ({ title, metric, response, loading }) => {
  const series = response?.series;
  return (
    <div className="compare-mini-card">
      <div className="chart-header">
        <p className="panel-kicker">{title}</p>
        {loading ? <span className="pill pill-ghost">Loading…</span> : null}
      </div>
      <p className="compare-mini-headline">{formatValue(metric, response?.headline)}</p>
      {series?.length ? (
        <div className="compare-mini-plot-frame">
          <Plot
            data={[
              {
                x: series.map((point) => point.date),
                y: series.map((point) => point.value ?? null),
                type: 'scatter',
                mode: 'lines',
                line: { color: '#4de0ff', width: 2.1 },
              },
            ]}
            layout={{
              height: 180,
              margin: { l: 34, r: 8, t: 8, b: 30 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#dbe4ee' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '180px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">No data</div>
      )}
    </div>
  );
};

const ChartsView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [dateMode, setDateMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [countryIso, setCountryIso] = useState<string | null>(null);

  const countryOptionsQuery = useQuery({
    queryKey: ['charts-country-options'],
    queryFn: async (): Promise<CountryOption[]> => {
      const response = await fetchSummary({ metric: 'today_cases', date: today });
      const uniq = new Map<string, string>();
      for (const row of response.data) {
        const iso = row.isoCode?.toUpperCase();
        if (!iso || iso === 'WORLD') continue;
        if (!uniq.has(iso)) uniq.set(iso, row.name || iso);
      }
      return Array.from(uniq.entries())
        .map(([iso3, name]) => ({ iso3, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 15 * 60 * 1000,
  });

  const countryOptions = useMemo(() => countryOptionsQuery.data || [], [countryOptionsQuery.data]);

  useEffect(() => {
    if (countryIso || !countryOptions.length) return;
    const usa = countryOptions.find((item) => item.iso3 === 'USA');
    setCountryIso((usa || countryOptions[0]).iso3);
  }, [countryIso, countryOptions]);

  const metricQueries = useQueries({
    queries: chartMetricCards.map((item) => {
      const query = buildCountryQuery(countryIso, item.metric, dateMode, date, range);
      return {
        queryKey: ['charts-country-metric', query],
        queryFn: () => {
          if (!query) throw new Error('Missing country');
          return fetchCountryDetails(query);
        },
        enabled: Boolean(query),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const hasError = metricQueries.some((item) => Boolean(item.error));
  const selectedCountryName = useMemo(
    () => countryOptions.find((item) => item.iso3 === countryIso)?.name || countryIso || 'Country',
    [countryOptions, countryIso]
  );
  const periodLabel = dateMode === 'day' ? date : `${range.from} → ${range.to}`;

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Country analytics</p>
          <h1 className="title">Country Graphs</h1>
          <p className="lede">
            Explore the main trends for one country in a selected day or period.
          </p>
        </div>
      </header>

      <div className="filter-bar compare-filter-bar">
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
          <label className="filter-label">Country</label>
          <select
            value={countryIso || ''}
            onChange={(event) => setCountryIso(event.target.value || null)}
            className="filter-select"
          >
            <option value="">Select country</option>
            {countryOptions.map((item) => (
              <option key={item.iso3} value={item.iso3}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasError ? <div className="banner banner-error">Unable to load one or more country metrics.</div> : null}

      <div className="compare-summary-grid compare-summary-grid-single">
        <div className="stat-tile">
          <p className="stat-label">{selectedCountryName}</p>
          <p className="stat-value">{countryIso || '—'}</p>
          <p className="stat-hint">{periodLabel}</p>
        </div>
      </div>

      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">Metrics overview • {selectedCountryName}</p>
        </div>
        <div className="compare-mini-grid">
          {chartMetricCards.map((item, index) => {
            const query = metricQueries[index];
            return (
              <MetricChartCard
                key={item.metric}
                title={item.label}
                metric={item.metric}
                response={query?.data as CountryDetailsResponse | undefined}
                loading={Boolean(query?.isLoading)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChartsView;
