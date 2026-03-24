import React from 'react';
import Plot from '../common/Plot';
import { useCountryDetails } from '../../hooks/useCountryDetails';
import { useCountryProvinces } from '../../hooks/useCountryProvinces';
import { formatNumericValue, LocaleCode, metricLabel, summaryMetricLabel } from '../../lib/i18n';
import { usePreferences } from '../../state/preferences';
import { CountryDetailsQuery, DateMode, DateRange, Metric, SummaryMetric } from '../../types/map';

const dailyPeakCards = [
  { key: 'cases', metric: 'cases' },
  { key: 'deaths', metric: 'deaths' },
  { key: 'vaccinations_total', metric: 'vaccinations_total' },
  { key: 'active', metric: 'active' },
] as const;

const coverageRows = [
  'cases',
  'deaths',
  'vaccinations_total',
  'people_vaccinated',
  'people_fully_vaccinated',
  'active',
  'today_cases',
  'today_deaths',
  'today_vaccinations',
] as const;

function formatMetricValue(metric: Metric, value: number | null | undefined, locale?: LocaleCode): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality') {
    return `${value.toFixed(2)}%`;
  }
  return formatNumericValue(value, locale, { maximumFractionDigits: 2 });
}

function formatHeadline(
  metric: Metric,
  dateMode: DateMode,
  value: number | null | undefined,
  locale?: LocaleCode
): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality' && dateMode !== 'day') {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)} pp`;
  }
  return formatMetricValue(metric, value, locale);
}

function formatCoverageLabel(
  key: (typeof coverageRows)[number],
  locale: LocaleCode,
  peopleVaccinatedLabel: string,
  fullyVaccinatedLabel: string
): string {
  if (key === 'people_vaccinated') return peopleVaccinatedLabel;
  if (key === 'people_fully_vaccinated') return fullyVaccinatedLabel;
  return summaryMetricLabel(key as SummaryMetric, locale);
}

function buildQuery(
  resolvedIso: string | null,
  metric: Metric,
  dateMode: DateMode,
  date: string,
  range: DateRange
): CountryDetailsQuery | null {
  if (!resolvedIso) {
    return null;
  }
  const metricForDetails = mapMetricToDetailsMetric(metric, dateMode);

  if (dateMode === 'day') {
    return { iso3: resolvedIso, metric: metricForDetails, dateMode: 'day', date };
  }
  if (dateMode === 'range') {
    return { iso3: resolvedIso, metric: metricForDetails, dateMode: 'range', range };
  }
  return { iso3: resolvedIso, metric: metricForDetails, dateMode: 'total' };
}

function mapMetricToDetailsMetric(metric: Metric, dateMode: DateMode): SummaryMetric {
  if (metric === 'cases') return 'today_cases';
  if (metric === 'deaths') return 'today_deaths';
  if (metric === 'recovered') return 'today_recovered';
  if (metric === 'vaccinations_total') {
    return dateMode === 'total' ? 'vaccinations_total' : 'today_vaccinations';
  }
  return metric;
}

type TrendChartProps = {
  title: string;
  metric: Metric;
  series?: Array<{ date: string; value: number | null }>;
  isLoading: boolean;
};

const TrendChart: React.FC<TrendChartProps> = ({ title, metric, series, isLoading }) => {
  const { copy } = usePreferences();
  const hasSeries = Boolean(series?.length);

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">{title}</p>
        {isLoading && <span className="pill pill-ghost">{copy.common.loading}</span>}
      </div>
      {hasSeries ? (
        <div className="trend-plot-frame">
          <Plot
            data={[
              {
                x: series?.map((point) => point.date),
                y: series?.map((point) => point.value ?? null),
                type: 'scatter',
                mode: 'lines',
                line: { color: '#4de0ff', width: 2 },
              },
            ]}
            layout={{
              height: 220,
              margin: { l: 38, r: 8, t: 8, b: 32 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '220px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">{copy.common.noData}</div>
      )}
    </div>
  );
};

export interface CountryPanelProps {
  isOpen: boolean;
  iso3?: string | null;
  iso?: string | null; // backward-compat alias
  countryName?: string | null;
  metric: Metric;
  dateMode: DateMode;
  date: string;
  range: DateRange;
  onClose: () => void;
}

export const CountryPanel: React.FC<CountryPanelProps> = ({
  isOpen,
  iso3,
  iso,
  countryName,
  metric,
  dateMode,
  date,
  range,
  onClose,
}) => {
  const { copy, locale } = usePreferences();
  const panelCopy = copy.map.countryPanel;
  const resolvedIso = iso3 ?? iso ?? null;
  const detailsQuery = buildQuery(resolvedIso, metric, dateMode, date, range);
  const casesQuery = buildQuery(resolvedIso, 'cases', dateMode, date, range);
  const deathsQuery = buildQuery(resolvedIso, 'deaths', dateMode, date, range);
  const mortalityQuery = buildQuery(resolvedIso, 'mortality', dateMode, date, range);

  const details = useCountryDetails(detailsQuery);
  const cases = useCountryDetails(casesQuery);
  const deaths = useCountryDetails(deathsQuery);
  const mortality = useCountryDetails(mortalityQuery);

  const seriesDateAnchor = dateMode === 'day' ? date : dateMode === 'range' ? range.to : undefined;
  const periodLabel =
    dateMode === 'day' ? date : dateMode === 'range' ? `${range.from} → ${range.to}` : copy.map.allTime;
  const periodHint = dateMode === 'day' ? date : dateMode === 'range' ? `${range.from} → ${range.to}` : copy.map.allTime;
  const provinces = useCountryProvinces({
    iso3: resolvedIso,
    countryName: details.data?.name || countryName,
    date: seriesDateAnchor,
  });

  if (!isOpen || !resolvedIso) {
    return (
      <aside className="country-panel country-panel-empty" aria-label={panelCopy.ariaLabel}>
        <p className="panel-kicker">{panelCopy.emptyKicker}</p>
        <h3 className="panel-title">{panelCopy.emptyTitle}</h3>
        <p className="panel-subtitle">{panelCopy.emptySubtitle}</p>
      </aside>
    );
  }

  const totals = details.data?.totals || details.data?.snapshot;
  const dailyPeaks = details.data?.dailyPeaks;
  const coverage = details.data?.coverage;
  const provinceRows = (provinces.data || []).slice(0, 12);
  const chartError = cases.error || deaths.error || mortality.error;
  const showsDailyFlowInHeadline =
    metric === 'cases' ||
    metric === 'deaths' ||
    metric === 'incidence';

  return (
    <aside className="country-panel" aria-label={panelCopy.ariaLabel}>
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{panelCopy.selectedCountry}</p>
          <h3 className="panel-title">{details.data?.name || countryName || resolvedIso}</h3>
          <p className="panel-subtitle">
            {metricLabel(metric, locale)} • {periodLabel}
          </p>
        </div>
        <button className="pill pill-ghost" onClick={onClose} type="button">
          {panelCopy.clearSelection}
        </button>
      </div>

      <div className="panel-grid">
        <div className="stat-tile">
          <p className="stat-label">
            {dateMode === 'day'
              ? panelCopy.valueOnDate
              : showsDailyFlowInHeadline
                ? panelCopy.newInPeriod
                : panelCopy.changeInPeriod}
          </p>
          <p className="stat-value">{formatHeadline(metric, dateMode, details.data?.headline, locale)}</p>
          <p className="stat-hint">{periodHint}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{panelCopy.average}</p>
          <p className="stat-value">{formatMetricValue(metric, details.data?.average, locale)}</p>
          <p className="stat-hint">{panelCopy.averageHint}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{panelCopy.peak}</p>
          <p className="stat-value">{formatMetricValue(metric, details.data?.max, locale)}</p>
          <p className="stat-hint">{panelCopy.peakHint}</p>
        </div>
      </div>

      {totals ? (
        <div className="chart-block">
          <div className="chart-header">
            <p className="panel-kicker">{panelCopy.totals}</p>
            {coverage?.overallLatest ? (
              <span className="pill pill-ghost">
                {panelCopy.latestReport}: {coverage.overallLatest}
              </span>
            ) : null}
          </div>
          <div className="panel-grid">
            <div className="stat-tile">
              <p className="stat-label">{summaryMetricLabel('cases', locale)}</p>
              <p className="stat-value">{formatMetricValue('cases', totals.cases, locale)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{summaryMetricLabel('deaths', locale)}</p>
              <p className="stat-value">{formatMetricValue('deaths', totals.deaths, locale)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{summaryMetricLabel('vaccinations_total', locale)}</p>
              <p className="stat-value">
                {formatMetricValue('vaccinations_total', totals.vaccinations_total, locale)}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{panelCopy.fullyVaccinated}</p>
              <p className="stat-value">
                {formatMetricValue('vaccinations_total', totals.people_fully_vaccinated, locale)}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{summaryMetricLabel('mortality', locale)}</p>
              <p className="stat-value">{formatMetricValue('mortality', totals.mortality, locale)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{panelCopy.incidenceLatest}</p>
              <p className="stat-value">{formatMetricValue('incidence', totals.incidence, locale)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{summaryMetricLabel('active', locale)}</p>
              <p className="stat-value">{formatMetricValue('active', totals.active, locale)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {dailyPeaks ? (
        <div className="chart-block">
          <div className="chart-header">
            <p className="panel-kicker">{panelCopy.peakInOneDay}</p>
          </div>
          <div className="panel-grid">
            {dailyPeakCards.map((card) => {
              const peak = dailyPeaks[card.key];
              return (
                <div className="stat-tile" key={card.key}>
                  <p className="stat-label">{summaryMetricLabel(card.metric, locale)}</p>
                  <p className="stat-value">{formatMetricValue(card.metric, peak?.value, locale)}</p>
                  <p className="stat-hint">{peak?.date || panelCopy.noDailyPeak}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {coverage?.latestByMetric ? (
        <div className="recent-table">
          <div className="recent-header">
            <p className="panel-kicker">{panelCopy.dataCoverage}</p>
          </div>
          <div className="recent-rows">
            {coverageRows.map((row) => (
              <div className="recent-row" key={row}>
                <span>{formatCoverageLabel(row, locale, panelCopy.peopleVaccinated, panelCopy.fullyVaccinated)}</span>
                <span>{coverage.latestByMetric?.[row] || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">{panelCopy.trends}</p>
          {details.isLoading && <span className="pill pill-ghost">{copy.common.loading}</span>}
        </div>
        {details.error && <div className="panel-error">{(details.error as Error).message}</div>}
        {chartError && !details.error ? <div className="panel-error">{panelCopy.trendsError}</div> : null}
        <div className="trend-chart-grid">
          <TrendChart
            title={summaryMetricLabel('today_cases', locale)}
            metric="cases"
            series={cases.data?.series}
            isLoading={cases.isLoading}
          />
          <TrendChart
            title={summaryMetricLabel('today_deaths', locale)}
            metric="deaths"
            series={deaths.data?.series}
            isLoading={deaths.isLoading}
          />
          <TrendChart
            title={summaryMetricLabel('mortality', locale)}
            metric="mortality"
            series={mortality.data?.series}
            isLoading={mortality.isLoading}
          />
        </div>
      </div>

      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">{panelCopy.provinces}</p>
          {provinces.isLoading && <span className="pill pill-ghost">{copy.common.loading}</span>}
        </div>
        {provinces.error ? (
          <div className="panel-error">{panelCopy.provincesError}</div>
        ) : provinceRows.length ? (
          <div className="recent-table">
            <div className="recent-header">
              <p className="panel-kicker">{panelCopy.topProvinces}</p>
            </div>
            <div className="recent-rows">
              {provinceRows.map((row) => (
                <div className="recent-row" key={row.code}>
                  <span>{row.name}</span>
                  <span>{formatMetricValue('cases', row.value, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="chart-placeholder">{panelCopy.noProvinceData}</div>
        )}
      </div>

      {details.data?.series?.length ? (
        <div className="recent-table">
          <div className="recent-header">
            <p className="panel-kicker">{panelCopy.recentTimeline}</p>
          </div>
          <div className="recent-rows">
            {details.data.series.slice(-7).map((row) => (
              <div className="recent-row" key={row.date}>
                <span>{row.date}</span>
                <span>{formatMetricValue(metric, row.value, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default CountryPanel;
