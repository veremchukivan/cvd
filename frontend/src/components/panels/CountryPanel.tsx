import React from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import { useCountryDetails } from '../../hooks/useCountryDetails';
import { useCountryProvinces } from '../../hooks/useCountryProvinces';
import { CountryDetailsQuery, DateMode, DateRange, Metric } from '../../types/map';

const Plot = createPlotlyComponent(Plotly);

const metricLabels: Record<Metric, string> = {
  cases: 'Cases',
  deaths: 'Deaths',
  recovered: 'Recovered',
  active: 'Active',
  tests: 'Tests',
  incidence: 'Incidence',
  mortality: 'Mortality',
};

function formatMetricValue(metric: Metric, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality') {
    return `${value.toFixed(2)}%`;
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatHeadline(metric: Metric, dateMode: DateMode, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality' && dateMode === 'range') {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)} pp`;
  }
  return formatMetricValue(metric, value);
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

  if (dateMode === 'day') {
    return { iso3: resolvedIso, metric, dateMode: 'day', date };
  }

  return { iso3: resolvedIso, metric, dateMode: 'range', range };
}

type TrendChartProps = {
  title: string;
  metric: Metric;
  series?: Array<{ date: string; value: number | null }>;
  isLoading: boolean;
};

const TrendChart: React.FC<TrendChartProps> = ({ title, metric, series, isLoading }) => {
  const hasSeries = Boolean(series?.length);

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">{title}</p>
        {isLoading && <span className="pill pill-ghost">Loading…</span>}
      </div>
      {hasSeries ? (
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
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="chart-placeholder">No {metricLabels[metric].toLowerCase()} data</div>
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
  const resolvedIso = iso3 ?? iso ?? null;
  const detailsQuery = buildQuery(resolvedIso, metric, dateMode, date, range);
  const deathsQuery = buildQuery(resolvedIso, 'deaths', dateMode, date, range);
  const recoveredQuery = buildQuery(resolvedIso, 'recovered', dateMode, date, range);
  const mortalityQuery = buildQuery(resolvedIso, 'mortality', dateMode, date, range);

  const details = useCountryDetails(detailsQuery);
  const deaths = useCountryDetails(deathsQuery);
  const recovered = useCountryDetails(recoveredQuery);
  const mortality = useCountryDetails(mortalityQuery);

  const seriesDateAnchor = dateMode === 'day' ? date : range.to;
  const provinces = useCountryProvinces({
    iso3: resolvedIso,
    countryName: details.data?.name || countryName,
    date: seriesDateAnchor,
  });

  if (!isOpen || !resolvedIso) {
    return (
      <aside className="country-panel country-panel-empty" aria-label="Country details">
        <p className="panel-kicker">Country details</p>
        <h3 className="panel-title">Choose a country on the map</h3>
        <p className="panel-subtitle">
          Click any country to jump here with mortality, recovery, trend charts, and provinces.
        </p>
      </aside>
    );
  }

  const snapshot = details.data?.snapshot;
  const provinceRows = (provinces.data || []).slice(0, 12);
  const chartError = deaths.error || recovered.error || mortality.error;

  return (
    <aside className="country-panel" aria-label="Country details">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Selected country</p>
          <h3 className="panel-title">{details.data?.name || countryName || resolvedIso}</h3>
          <p className="panel-subtitle">
            {metricLabels[metric]} • {dateMode === 'day' ? date : `${range.from} → ${range.to}`}
          </p>
        </div>
        <button className="pill pill-ghost" onClick={onClose} type="button">
          Clear selection
        </button>
      </div>

      <div className="panel-grid">
        <div className="stat-tile">
          <p className="stat-label">
            {dateMode === 'day'
              ? 'Value on date'
              : metric === 'incidence'
                ? 'New in period'
                : 'Change in period'}
          </p>
          <p className="stat-value">{formatHeadline(metric, dateMode, details.data?.headline)}</p>
          <p className="stat-hint">{dateMode === 'day' ? date : `${range.from} to ${range.to}`}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Average</p>
          <p className="stat-value">{formatMetricValue(metric, details.data?.average)}</p>
          <p className="stat-hint">mean within window</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Peak</p>
          <p className="stat-value">{formatMetricValue(metric, details.data?.max)}</p>
          <p className="stat-hint">max daily</p>
        </div>
      </div>

      {snapshot ? (
        <div className="chart-block">
          <div className="chart-header">
            <p className="panel-kicker">Health snapshot</p>
          </div>
          <div className="panel-grid">
            <div className="stat-tile">
              <p className="stat-label">Cases</p>
              <p className="stat-value">{formatMetricValue('cases', snapshot.cases)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Deaths</p>
              <p className="stat-value">{formatMetricValue('deaths', snapshot.deaths)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Recovered</p>
              <p className="stat-value">{formatMetricValue('recovered', snapshot.recovered)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Mortality</p>
              <p className="stat-value">{formatMetricValue('mortality', snapshot.mortality)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Incidence (latest)</p>
              <p className="stat-value">{formatMetricValue('incidence', snapshot.incidence)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Active</p>
              <p className="stat-value">{formatMetricValue('active', snapshot.active)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">Mortality and recovery trends</p>
          {details.isLoading && <span className="pill pill-ghost">Loading…</span>}
        </div>
        {details.error && <div className="panel-error">{(details.error as Error).message}</div>}
        {chartError && !details.error ? (
          <div className="panel-error">Unable to load one or more trend series.</div>
        ) : null}
        <div className="trend-chart-grid">
          <TrendChart
            title="Deaths"
            metric="deaths"
            series={deaths.data?.series}
            isLoading={deaths.isLoading}
          />
          <TrendChart
            title="Recovered"
            metric="recovered"
            series={recovered.data?.series}
            isLoading={recovered.isLoading}
          />
          <TrendChart
            title="Mortality (%)"
            metric="mortality"
            series={mortality.data?.series}
            isLoading={mortality.isLoading}
          />
        </div>
      </div>

      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">Provinces (cases)</p>
          {provinces.isLoading && <span className="pill pill-ghost">Loading…</span>}
        </div>
        {provinces.error ? (
          <div className="panel-error">Unable to load province-level data.</div>
        ) : provinceRows.length ? (
          <div className="recent-table">
            <div className="recent-header">
              <p className="panel-kicker">Top provinces</p>
            </div>
            <div className="recent-rows">
              {provinceRows.map((row) => (
                <div className="recent-row" key={row.code}>
                  <span>{row.name}</span>
                  <span>{formatMetricValue('cases', row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="chart-placeholder">No province-level data for this country.</div>
        )}
      </div>

      {details.data?.series?.length ? (
        <div className="recent-table">
          <div className="recent-header">
            <p className="panel-kicker">Recent timeline</p>
          </div>
          <div className="recent-rows">
            {details.data.series.slice(-7).map((row) => (
              <div className="recent-row" key={row.date}>
                <span>{row.date}</span>
                <span>{formatMetricValue(metric, row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default CountryPanel;
