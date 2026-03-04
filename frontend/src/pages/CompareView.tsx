import React, { useEffect, useMemo, useState } from 'react';
import { formatISO, startOfYear, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import {
  CountryDetailsQuery,
  CountryDetailsResponse,
  DateRange,
  Metric,
  SummaryMetric,
} from '../types/map';

const Plot = createPlotlyComponent(Plotly);

type CountryOption = {
  iso3: string;
  name: string;
};

const metricOptions: Array<{ value: Metric; label: string }> = [
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

function metricLabel(metric: SummaryMetric): string {
  switch (metric) {
    case 'today_cases':
      return 'Cases (daily)';
    case 'today_deaths':
      return 'Deaths (daily)';
    case 'today_recovered':
      return 'Recovered (daily)';
    case 'cases':
      return 'Cases';
    case 'deaths':
      return 'Deaths';
    case 'recovered':
      return 'Recovered';
    case 'active':
      return 'Active';
    case 'tests':
      return 'Tests';
    case 'incidence':
      return 'Incidence';
    case 'mortality':
      return 'Mortality (%)';
    default:
      return metric;
  }
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
  if (dateMode === 'day') {
    return { iso3, metric, dateMode: 'day', date };
  }
  return { iso3, metric, dateMode: 'range', range };
}

function quickRangeBounds(label: '7d' | '30d' | 'ytd'): DateRange {
  const now = new Date();
  const to = formatISO(now, { representation: 'date' });
  if (label === '7d') return { from: formatISO(subDays(now, 6), { representation: 'date' }), to };
  if (label === '30d') return { from: formatISO(subDays(now, 29), { representation: 'date' }), to };
  return { from: formatISO(startOfYear(now), { representation: 'date' }), to };
}

type CompareTrendChartProps = {
  metric: SummaryMetric;
  primary?: CountryDetailsResponse;
  secondary?: CountryDetailsResponse;
  primaryName?: string;
  secondaryName?: string;
  loading: boolean;
};

const CompareTrendChart: React.FC<CompareTrendChartProps> = ({
  metric,
  primary,
  secondary,
  primaryName,
  secondaryName,
  loading,
}) => {
  const traces = [
    primary?.series?.length
      ? {
          x: primary.series.map((point) => point.date),
          y: primary.series.map((point) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: primaryName || primary.name || 'Primary',
          line: { color: '#4de0ff', width: 2.4 },
        }
      : null,
    secondary?.series?.length
      ? {
          x: secondary.series.map((point) => point.date),
          y: secondary.series.map((point) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: secondaryName || secondary.name || 'Compare',
          line: { color: '#ff8a47', width: 2.4 },
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="compare-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Comparison trend • {metricLabel(metric)}</p>
        {loading ? <span className="pill pill-ghost">Loading…</span> : null}
      </div>
      {traces.length ? (
        <div className="compare-plot-frame">
          <Plot
            data={traces}
            layout={{
              height: 320,
              margin: { l: 42, r: 12, t: 14, b: 34 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              legend: { orientation: 'h', y: 1.12, x: 0 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '320px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">No data for selected countries and period.</div>
      )}
    </div>
  );
};

const CompareView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [metric, setMetric] = useState<Metric>('cases');
  const [dateMode, setDateMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [primaryIso, setPrimaryIso] = useState<string | null>(null);
  const [compareIso, setCompareIso] = useState<string | null>(null);

  const countryOptionsQuery = useQuery({
    queryKey: ['compare-country-options'],
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
    if (primaryIso || !countryOptions.length) return;
    const usa = countryOptions.find((item) => item.iso3 === 'USA');
    setPrimaryIso((usa || countryOptions[0]).iso3);
  }, [primaryIso, countryOptions]);

  useEffect(() => {
    if (compareIso && compareIso === primaryIso) {
      setCompareIso(null);
    }
  }, [compareIso, primaryIso]);

  const summaryMetric = toSummaryMetric(metric);
  const primaryQuery = buildCountryQuery(primaryIso, summaryMetric, dateMode, date, range);
  const compareQuery = buildCountryQuery(compareIso, summaryMetric, dateMode, date, range);

  const mainComparison = useQueries({
    queries: [primaryQuery, compareQuery].map((query) => ({
      queryKey: ['compare-main', query],
      queryFn: () => {
        if (!query) throw new Error('Missing comparison query');
        return fetchCountryDetails(query);
      },
      enabled: Boolean(query),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const primaryDetails = mainComparison[0]?.data as CountryDetailsResponse | undefined;
  const compareDetails = mainComparison[1]?.data as CountryDetailsResponse | undefined;
  const mainLoading = mainComparison.some((item) => item.isLoading);
  const mainError = mainComparison.find((item) => item.error)?.error as Error | undefined;

  const primaryName = useMemo(
    () => countryOptions.find((item) => item.iso3 === primaryIso)?.name || primaryIso || 'Primary country',
    [countryOptions, primaryIso]
  );
  const compareName = useMemo(
    () => countryOptions.find((item) => item.iso3 === compareIso)?.name || compareIso || undefined,
    [countryOptions, compareIso]
  );

  const periodLabel = dateMode === 'day' ? date : `${range.from} → ${range.to}`;

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Country comparison</p>
          <h1 className="title">Compare Countries</h1>
          <p className="lede">
            Compare two countries for a selected day or period with one shared trend chart.
          </p>
        </div>
      </header>

      <div className="filter-bar compare-filter-bar">
        <div className="filter-group">
          <label className="filter-label">Metric</label>
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="filter-select"
          >
            {metricOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
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
          <label className="filter-label">Primary country</label>
          <select
            value={primaryIso || ''}
            onChange={(event) => setPrimaryIso(event.target.value || null)}
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
        <div className="filter-group">
          <label className="filter-label">Compare with</label>
          <select
            value={compareIso || ''}
            onChange={(event) => setCompareIso(event.target.value || null)}
            className="filter-select"
          >
            <option value="">None</option>
            {countryOptions
              .filter((item) => item.iso3 !== primaryIso)
              .map((item) => (
                <option key={item.iso3} value={item.iso3}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {mainError ? <div className="banner banner-error">Unable to load comparison data.</div> : null}

      <div className="compare-summary-grid">
        <div className="stat-tile">
          <p className="stat-label">{primaryName}</p>
          <p className="stat-value">{formatValue(summaryMetric, primaryDetails?.headline)}</p>
          <p className="stat-hint">{metricLabel(summaryMetric)} • {periodLabel}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{compareName || 'Compare country'}</p>
          <p className="stat-value">{formatValue(summaryMetric, compareDetails?.headline)}</p>
          <p className="stat-hint">
            {compareIso ? `${metricLabel(summaryMetric)} • ${periodLabel}` : 'Select second country'}
          </p>
        </div>
      </div>

      <CompareTrendChart
        metric={summaryMetric}
        primary={primaryDetails}
        secondary={compareDetails}
        primaryName={primaryName}
        secondaryName={compareName}
        loading={mainLoading}
      />
    </div>
  );
};

export default CompareView;
