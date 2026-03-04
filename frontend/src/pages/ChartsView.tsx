import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatISO, parseISO, startOfYear, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import DatePickerInput from '../components/filters/DatePickerInput';
import { CountryDetailsQuery, CountryDetailsResponse, DateRange, SummaryMetric } from '../types/map';

const Plot = createPlotlyComponent(Plotly);

type CountryOption = {
  iso3: string;
  name: string;
};

type MetricVisual = {
  color: string;
  fill: string;
  kind: 'line' | 'area' | 'bar';
  note: string;
};

const chartMetricCards: Array<{ metric: SummaryMetric; label: string }> = [
  { metric: 'today_cases', label: 'Cases (daily)' },
  { metric: 'today_deaths', label: 'Deaths (daily)' },
  { metric: 'today_recovered', label: 'Recovered (daily)' },
  { metric: 'active', label: 'Active (total)' },
  { metric: 'incidence', label: 'Incidence' },
  { metric: 'mortality', label: 'Mortality (%)' },
];

const metricVisuals: Partial<Record<SummaryMetric, MetricVisual>> = {
  today_cases: { color: '#4de0ff', fill: 'rgba(77,224,255,0.20)', kind: 'area', note: 'Flow intensity' },
  today_deaths: { color: '#ff8a47', fill: 'rgba(255,138,71,0.16)', kind: 'bar', note: 'Daily fatalities' },
  today_recovered: { color: '#80ed99', fill: 'rgba(128,237,153,0.16)', kind: 'line', note: 'Recovery pace' },
  active: { color: '#b8c0ff', fill: 'rgba(184,192,255,0.15)', kind: 'line', note: 'Total active load' },
  incidence: { color: '#ffd166', fill: 'rgba(255,209,102,0.18)', kind: 'bar', note: 'New inferred cases' },
  mortality: { color: '#f78fb3', fill: 'rgba(247,143,179,0.16)', kind: 'line', note: 'Deaths / cases ratio' },
};

const weekdayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function quickRangeBounds(label: '7d' | '30d' | 'ytd'): DateRange {
  const now = new Date();
  const to = formatISO(now, { representation: 'date' });
  if (label === '7d') return { from: formatISO(subDays(now, 6), { representation: 'date' }), to };
  if (label === '30d') return { from: formatISO(subDays(now, 29), { representation: 'date' }), to };
  return { from: formatISO(startOfYear(now), { representation: 'date' }), to };
}

function dateDaysAgo(days: number): string {
  return formatISO(subDays(new Date(), days), { representation: 'date' });
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

function getMetricVisual(metric: SummaryMetric): MetricVisual {
  return (
    metricVisuals[metric] || {
      color: '#4de0ff',
      fill: 'rgba(77,224,255,0.20)',
      kind: 'line',
      note: 'Trend',
    }
  );
}

function toNumeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Number(value);
}

function movingAverage(values: Array<number | null>, windowSize: number): Array<number | null> {
  const result: Array<number | null> = [];
  for (let index = 0; index < values.length; index += 1) {
    const slice = values
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (!slice.length) {
      result.push(null);
      continue;
    }
    const avg = slice.reduce((acc, item) => acc + item, 0) / slice.length;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
}

function weekdayFromIsoDate(isoDate: string): (typeof weekdayOrder)[number] {
  const day = parseISO(isoDate).getDay();
  return weekdayOrder[(day + 6) % 7];
}

function findPeak(series: Array<{ date: string; value: number | null }> | undefined): {
  date: string;
  value: number;
} | null {
  if (!series?.length) return null;
  let peakDate = '';
  let peakValue = -Infinity;
  for (const point of series) {
    const value = toNumeric(point.value);
    if (value === null) continue;
    if (value > peakValue) {
      peakValue = value;
      peakDate = point.date;
    }
  }
  if (!Number.isFinite(peakValue) || peakValue < 0) return null;
  return { date: peakDate, value: peakValue };
}

type MetricChartCardProps = {
  title: string;
  metric: SummaryMetric;
  response?: CountryDetailsResponse;
  loading: boolean;
};

const MetricChartCard: React.FC<MetricChartCardProps> = ({ title, metric, response, loading }) => {
  const series = response?.series;
  const visual = getMetricVisual(metric);
  const values = series?.map((point) => toNumeric(point.value)) || [];
  const chartTrace =
    visual.kind === 'bar'
      ? {
          x: series?.map((point) => point.date),
          y: values,
          type: 'bar',
          marker: { color: visual.color },
        }
      : {
          x: series?.map((point) => point.date),
          y: values,
          type: 'scatter',
          mode: 'lines',
          line: { color: visual.color, width: 2.2 },
          fill: visual.kind === 'area' ? 'tozeroy' : undefined,
          fillcolor: visual.kind === 'area' ? visual.fill : undefined,
        };

  return (
    <div className="compare-mini-card metric-mini-card" style={{ borderTopColor: visual.color }}>
      <div className="chart-header">
        <p className="panel-kicker">{title}</p>
        {loading ? <span className="pill pill-ghost">Loading…</span> : null}
      </div>
      <p className="compare-mini-headline">{formatValue(metric, response?.headline)}</p>
      <p className="metric-mini-note">{visual.note}</p>
      {series?.length ? (
        <div className="compare-mini-plot-frame">
          <Plot
            data={[chartTrace]}
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
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countrySearchRef = useRef<HTMLDivElement | null>(null);

  const countryOptionsQuery = useQuery({
    queryKey: ['charts-country-options'],
    queryFn: async (): Promise<CountryOption[]> => {
      // Build a stable country list independent from a single selected date.
      const response = await fetchSummary({ metric: 'cases' });
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
  const filteredCountryOptions = useMemo(() => {
    if (!countrySearch.trim()) {
      return countryOptions;
    }
    const needle = countrySearch.trim().toLowerCase();
    return countryOptions.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.iso3.toLowerCase().includes(needle)
    );
  }, [countryOptions, countrySearch]);
  const countrySuggestions = useMemo(
    () => (countrySearch.trim() ? filteredCountryOptions : countryOptions),
    [countrySearch, filteredCountryOptions, countryOptions]
  );

  useEffect(() => {
    if (countryIso || !countryOptions.length) return;
    const usa = countryOptions.find((item) => item.iso3 === 'USA');
    setCountryIso((usa || countryOptions[0]).iso3);
  }, [countryIso, countryOptions]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const node = countrySearchRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      setCountryDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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

  const metricData = chartMetricCards.reduce<Partial<Record<SummaryMetric, CountryDetailsResponse>>>(
    (acc, item, index) => {
      const data = metricQueries[index]?.data as CountryDetailsResponse | undefined;
      if (data) {
        acc[item.metric] = data;
      }
      return acc;
    },
    {}
  );

  const casesSeries = useMemo(
    () => metricData.today_cases?.series ?? [],
    [metricData.today_cases?.series]
  );
  const deathsSeries = useMemo(
    () => metricData.today_deaths?.series ?? [],
    [metricData.today_deaths?.series]
  );
  const recoveredSeries = useMemo(
    () => metricData.today_recovered?.series ?? [],
    [metricData.today_recovered?.series]
  );
  const mortalitySeries = useMemo(
    () => metricData.mortality?.series ?? [],
    [metricData.mortality?.series]
  );

  const flowTraces = useMemo(() => {
    const traces = [];
    if (casesSeries.length) {
      traces.push({
        x: casesSeries.map((point) => point.date),
        y: casesSeries.map((point) => toNumeric(point.value)),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Cases',
        line: { color: '#4de0ff', width: 2.5 },
        fill: 'tozeroy',
        fillcolor: 'rgba(77,224,255,0.15)',
      });
    }
    if (deathsSeries.length) {
      traces.push({
        x: deathsSeries.map((point) => point.date),
        y: deathsSeries.map((point) => toNumeric(point.value)),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Deaths',
        line: { color: '#ff8a47', width: 2.2 },
      });
    }
    if (recoveredSeries.length) {
      traces.push({
        x: recoveredSeries.map((point) => point.date),
        y: recoveredSeries.map((point) => toNumeric(point.value)),
        type: 'scatter' as const,
        mode: 'lines',
        name: 'Recovered',
        line: { color: '#80ed99', width: 2.2, dash: 'dot' },
      });
    }
    return traces;
  }, [casesSeries, deathsSeries, recoveredSeries]);

  const momentumSeries = useMemo(() => {
    const source = casesSeries.slice(-60);
    const values = source.map((point) => toNumeric(point.value));
    const moving = movingAverage(values, 7);
    return source.map((point, index) => ({
      date: point.date,
      value: values[index],
      moving: moving[index],
    }));
  }, [casesSeries]);

  const weekdayProfile = useMemo(() => {
    const buckets = weekdayOrder.reduce<Record<string, number[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    for (const point of casesSeries) {
      const value = toNumeric(point.value);
      if (value === null) continue;
      buckets[weekdayFromIsoDate(point.date)].push(value);
    }
    return weekdayOrder.map((label) => {
      const values = buckets[label];
      const average = values.length ? values.reduce((acc, item) => acc + item, 0) / values.length : 0;
      return { label, value: Number(average.toFixed(2)) };
    });
  }, [casesSeries]);

  const splitData = useMemo(() => {
    const values = [
      { label: 'Cases', metric: 'today_cases' as SummaryMetric, value: toNumeric(metricData.today_cases?.headline) || 0, color: '#4de0ff' },
      { label: 'Deaths', metric: 'today_deaths' as SummaryMetric, value: toNumeric(metricData.today_deaths?.headline) || 0, color: '#ff8a47' },
      { label: 'Recovered', metric: 'today_recovered' as SummaryMetric, value: toNumeric(metricData.today_recovered?.headline) || 0, color: '#80ed99' },
    ].filter((item) => item.value > 0);
    return values;
  }, [metricData.today_cases?.headline, metricData.today_deaths?.headline, metricData.today_recovered?.headline]);
  const splitTotal = useMemo(() => splitData.reduce((acc, item) => acc + item.value, 0), [splitData]);
  const splitShare = useMemo(
    () =>
      splitData.map((item) => ({
        ...item,
        percent: splitTotal > 0 ? Number(((item.value / splitTotal) * 100).toFixed(1)) : 0,
      })),
    [splitData, splitTotal]
  );
  const outcomePairKey = useMemo(() => {
    if (splitData.length !== 2) return null;
    return splitData
      .map((item) => item.label.toLowerCase())
      .sort((a, b) => a.localeCompare(b))
      .join('-');
  }, [splitData]);
  const pairComparisons = useMemo(() => {
    const metricValues = {
      cases: toNumeric(metricData.today_cases?.headline) || 0,
      deaths: toNumeric(metricData.today_deaths?.headline) || 0,
      recovered: toNumeric(metricData.today_recovered?.headline) || 0,
    };
    const pairs = [
      {
        key: 'cases-deaths',
        title: 'Cases vs Deaths',
        left: { label: 'Cases', metric: 'today_cases' as SummaryMetric, value: metricValues.cases, color: '#4de0ff' },
        right: { label: 'Deaths', metric: 'today_deaths' as SummaryMetric, value: metricValues.deaths, color: '#ff8a47' },
      },
      {
        key: 'cases-recovered',
        title: 'Cases vs Recovered',
        left: { label: 'Cases', metric: 'today_cases' as SummaryMetric, value: metricValues.cases, color: '#4de0ff' },
        right: { label: 'Recovered', metric: 'today_recovered' as SummaryMetric, value: metricValues.recovered, color: '#80ed99' },
      },
      {
        key: 'recovered-deaths',
        title: 'Recovered vs Deaths',
        left: { label: 'Recovered', metric: 'today_recovered' as SummaryMetric, value: metricValues.recovered, color: '#80ed99' },
        right: { label: 'Deaths', metric: 'today_deaths' as SummaryMetric, value: metricValues.deaths, color: '#ff8a47' },
      },
    ];
    return pairs
      .map((pair) => {
        const pairKey = [pair.left.label.toLowerCase(), pair.right.label.toLowerCase()]
          .sort((a, b) => a.localeCompare(b))
          .join('-');
        if (outcomePairKey && pairKey === outcomePairKey) return null;
        const total = pair.left.value + pair.right.value;
        if (total <= 0) return null;
        const leftPercent = Number(((pair.left.value / total) * 100).toFixed(1));
        const rightPercent = Number((100 - leftPercent).toFixed(1));
        return { ...pair, leftPercent, rightPercent };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [
    metricData.today_cases?.headline,
    metricData.today_deaths?.headline,
    metricData.today_recovered?.headline,
    outcomePairKey,
  ]);

  const casesPeak = findPeak(casesSeries);
  const deathsPeak = findPeak(deathsSeries);
  const mortalityPeak = findPeak(mortalitySeries);

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Country analytics</p>
          <h1 className="title">Country Graphs</h1>
          <p className="lede">
            Explore daily flow, weekly rhythm and outcome mix for one country in a selected day or period.
          </p>
        </div>
      </header>

      <div className="charts-filter-shell">
        <div className="charts-filter-grid">
          <div className="charts-filter-card">
            <label className="filter-label">View mode</label>
            <div className="charts-toggle">
              <button
                type="button"
                className={`charts-toggle-btn ${dateMode === 'day' ? 'charts-toggle-btn-active' : ''}`}
                onClick={() => setDateMode('day')}
              >
                Single day
              </button>
              <button
                type="button"
                className={`charts-toggle-btn ${dateMode === 'range' ? 'charts-toggle-btn-active' : ''}`}
                onClick={() => setDateMode('range')}
              >
                Period
              </button>
            </div>
          </div>

          <div className="charts-filter-card charts-filter-card-date">
            {dateMode === 'day' ? (
              <>
                <label className="filter-label">Date snapshot</label>
                <div className="charts-date-row">
                  <DatePickerInput
                    value={date}
                    onChange={setDate}
                    inputClassName="charts-date-input"
                  />
                  <button type="button" className="charts-chip" onClick={() => setDate(dateDaysAgo(0))}>
                    Today
                  </button>
                </div>
                <div className="charts-chip-row">
                  <button type="button" className="charts-chip" onClick={() => setDate(dateDaysAgo(1))}>
                    Yesterday
                  </button>
                  <button type="button" className="charts-chip" onClick={() => setDate(dateDaysAgo(7))}>
                    7d ago
                  </button>
                  <button type="button" className="charts-chip" onClick={() => setDate(dateDaysAgo(30))}>
                    30d ago
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="filter-label">Period window</label>
                <div className="charts-date-range-row">
                  <DatePickerInput
                    value={range.from}
                    maxDate={range.to}
                    onChange={(nextIso) => setRange((prev) => ({ ...prev, from: nextIso }))}
                    inputClassName="charts-date-input"
                  />
                  <span className="charts-range-sep">→</span>
                  <DatePickerInput
                    value={range.to}
                    minDate={range.from}
                    onChange={(nextIso) => setRange((prev) => ({ ...prev, to: nextIso }))}
                    inputClassName="charts-date-input"
                  />
                </div>
                <div className="charts-chip-row">
                  <button type="button" className="charts-chip" onClick={() => setRange(quickRangeBounds('7d'))}>
                    Last 7 days
                  </button>
                  <button type="button" className="charts-chip" onClick={() => setRange(quickRangeBounds('30d'))}>
                    Last 30 days
                  </button>
                  <button type="button" className="charts-chip" onClick={() => setRange(quickRangeBounds('ytd'))}>
                    YTD
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="charts-filter-card">
            <label className="filter-label">Country</label>
            <div className="charts-country-searchbox" ref={countrySearchRef}>
              <div className="charts-country-input-row">
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCountrySearch(next);
                    setCountryDropdownOpen(true);
                  }}
                  onFocus={() => setCountryDropdownOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    if (!countrySuggestions.length) return;
                    const first = countrySuggestions[0];
                    setCountryIso(first.iso3);
                    setCountrySearch(first.name);
                    setCountryDropdownOpen(false);
                  }}
                  className="charts-select"
                  placeholder="Search country or open list..."
                />
                <button
                  type="button"
                  className="charts-country-toggle"
                  onClick={() => setCountryDropdownOpen((current) => !current)}
                  aria-label="Toggle country list"
                >
                  ▾
                </button>
              </div>
              {countryDropdownOpen ? (
                <div className="charts-country-suggest-list" role="listbox">
                  {countrySuggestions.length ? (
                    countrySuggestions.map((item) => (
                      <button
                        key={item.iso3}
                        type="button"
                        className={`charts-country-suggest-item ${countryIso === item.iso3 ? 'charts-country-suggest-item-active' : ''}`}
                        onClick={() => {
                          setCountryIso(item.iso3);
                          setCountrySearch(item.name);
                          setCountryDropdownOpen(false);
                        }}
                      >
                        <span>{item.name}</span>
                        <span className="charts-country-suggest-iso">{item.iso3}</span>
                      </button>
                    ))
                  ) : (
                    <p className="charts-country-suggest-empty">No countries found</p>
                  )}
                </div>
              ) : null}
            </div>
           
          </div>
        </div>
      </div>

      {hasError ? <div className="banner banner-error">Unable to load one or more country metrics.</div> : null}

      <div className="charts-section">
        <div className="charts-section-head">
          <p className="charts-section-kicker">Snapshot</p>
          <h2 className="charts-section-title">Country overview</h2>
        </div>
        <div className="compare-summary-grid compare-summary-grid-single">
          <div className="stat-tile">
            <p className="stat-label">{selectedCountryName}</p>
            <p className="stat-value">{countryIso || '—'}</p>
            <p className="stat-hint">{periodLabel}</p>
          </div>
        </div>

        <div className="country-insight-grid">
          <div className="country-insight-card">
            <p className="stat-label">Peak daily cases</p>
            <p className="country-insight-value">{formatValue('today_cases', casesPeak?.value)}</p>
            <p className="stat-hint">{casesPeak?.date || 'No peak data'}</p>
          </div>
          <div className="country-insight-card">
            <p className="stat-label">Peak daily deaths</p>
            <p className="country-insight-value">{formatValue('today_deaths', deathsPeak?.value)}</p>
            <p className="stat-hint">{deathsPeak?.date || 'No peak data'}</p>
          </div>
          <div className="country-insight-card">
            <p className="stat-label">Peak mortality</p>
            <p className="country-insight-value">{formatValue('mortality', mortalityPeak?.value)}</p>
            <p className="stat-hint">{mortalityPeak?.date || 'No peak data'}</p>
          </div>
        </div>
      </div>

      <div className="charts-section">
        <div className="charts-section-head">
          <p className="charts-section-kicker">Metric cards</p>
          <h2 className="charts-section-title">All tracked indicators</h2>
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

      <div className="charts-section">
        <div className="charts-section-head">
          <p className="charts-section-kicker">Dynamics</p>
          <h2 className="charts-section-title">Flow, momentum and rhythm</h2>
        </div>
        <div className="country-chart-grid">
          <div className="country-chart-card country-chart-card-wide">
            <div className="chart-header">
              <p className="panel-kicker">Combined daily flow</p>
            </div>
            {flowTraces.length ? (
              <div className="country-plot-frame">
                <Plot
                  data={flowTraces}
                  layout={{
                    height: 320,
                    margin: { l: 44, r: 12, t: 12, b: 36 },
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
              <div className="chart-placeholder">No combined flow data.</div>
            )}
          </div>

          <div className="country-chart-card">
            <div className="chart-header">
              <p className="panel-kicker">Cases momentum (daily vs 7-day avg)</p>
            </div>
            {momentumSeries.length ? (
              <div className="country-plot-frame">
                <Plot
                  data={[
                    {
                      x: momentumSeries.map((point) => point.date),
                      y: momentumSeries.map((point) => point.value),
                      type: 'bar',
                      name: 'Daily',
                      marker: { color: '#1f7a99' },
                      opacity: 0.74,
                    },
                    {
                      x: momentumSeries.map((point) => point.date),
                      y: momentumSeries.map((point) => point.moving),
                      type: 'scatter',
                      mode: 'lines',
                      name: '7-day avg',
                      line: { color: '#4de0ff', width: 2.4 },
                    },
                  ]}
                  layout={{
                    height: 300,
                    margin: { l: 44, r: 12, t: 12, b: 36 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#e2e8f0' },
                    xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                    yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                    legend: { orientation: 'h', y: 1.1, x: 0 },
                    barmode: 'overlay',
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
            ) : (
              <div className="chart-placeholder">No momentum data.</div>
            )}
          </div>

          <div className="country-chart-card">
            <div className="chart-header">
              <p className="panel-kicker">Weekday pattern (avg daily cases)</p>
            </div>
            {weekdayProfile.some((item) => item.value > 0) ? (
              <div className="country-plot-frame">
                <Plot
                  data={[
                    {
                      x: weekdayProfile.map((item) => item.label),
                      y: weekdayProfile.map((item) => item.value),
                      type: 'bar',
                      marker: { color: '#4de0ff' },
                    },
                  ]}
                  layout={{
                    height: 300,
                    margin: { l: 42, r: 12, t: 12, b: 34 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#e2e8f0' },
                    xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                    yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
            ) : (
              <div className="chart-placeholder">No weekday pattern data.</div>
            )}
          </div>
        </div>
      </div>

      {splitData.length || pairComparisons.length ? (
        <div className="charts-section">
          <div className="charts-section-head">
            <p className="charts-section-kicker">Comparisons</p>
            <h2 className="charts-section-title">Pair metric split</h2>
          </div>
          <div className="metric-rings-grid">
            {splitData.length ? (
              <div className="metric-ring-card">
                <p className="panel-kicker">Outcome split</p>
                <div className="outcome-split-layout">
                  <div className="country-plot-frame outcome-split-plot">
                    <Plot
                      data={[
                        {
                          labels: splitData.map((item) => item.label),
                          values: splitData.map((item) => item.value),
                          type: 'pie',
                          hole: 0.56,
                          marker: { colors: splitData.map((item) => item.color) },
                          textinfo: 'none',
                        },
                      ]}
                      layout={{
                        height: 260,
                        margin: { l: 10, r: 10, t: 10, b: 10 },
                        paper_bgcolor: 'transparent',
                        font: { color: '#e2e8f0' },
                        showlegend: false,
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      useResizeHandler
                      style={{ width: '100%', height: '260px' }}
                    />
                  </div>
                  <div className="outcome-split-legend">
                    {splitShare.map((item) => (
                      <div className="outcome-split-row" key={item.label}>
                        <span className="outcome-split-dot" style={{ background: item.color }} />
                        <span className="outcome-split-name">{item.label}</span>
                        <span className="outcome-split-value">{item.percent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {pairComparisons.map((pair) => (
              <div className="metric-ring-card" key={pair.key}>
                <p className="panel-kicker">{pair.title}</p>
                <div className="metric-ring-plot-wrap">
                  <Plot
                    data={[
                      {
                        labels: [pair.left.label, pair.right.label],
                        values: [pair.left.value, pair.right.value],
                        type: 'pie',
                        hole: 0.74,
                        marker: { colors: [pair.left.color, pair.right.color] },
                        textinfo: 'none',
                        sort: false,
                        direction: 'clockwise',
                        showlegend: false,
                      },
                    ]}
                    layout={{
                      height: 160,
                      margin: { l: 0, r: 0, t: 0, b: 0 },
                      paper_bgcolor: 'transparent',
                      font: { color: '#e2e8f0' },
                      showlegend: false,
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    useResizeHandler
                    style={{ width: '100%', height: '160px' }}
                  />
                  <div className="metric-ring-center">
                    <span className="metric-ring-percent">{pair.leftPercent.toFixed(1)}%</span>
                    <span className="metric-ring-label">{pair.left.label}</span>
                  </div>
                </div>
                <div className="metric-pair-legend">
                  <div className="metric-pair-row">
                    <span className="metric-pair-dot" style={{ background: pair.left.color }} />
                    <span className="metric-pair-name">{pair.left.label}</span>
                    <span className="metric-pair-value">
                      {formatValue(pair.left.metric, pair.left.value)} • {pair.leftPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="metric-pair-row">
                    <span className="metric-pair-dot" style={{ background: pair.right.color }} />
                    <span className="metric-pair-name">{pair.right.label}</span>
                    <span className="metric-pair-value">
                      {formatValue(pair.right.metric, pair.right.value)} • {pair.rightPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChartsView;
