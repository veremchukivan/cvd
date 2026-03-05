import React, { useMemo } from 'react';
import Plot from '../common/Plot';
import { summaryMetricLabel } from '../../lib/analytics';
import { CountryDetailsResponse, SummaryMetric } from '../../types/map';

type CompareTrendChartProps = {
  metric: SummaryMetric;
  primary?: CountryDetailsResponse;
  secondary?: CountryDetailsResponse;
  primaryVaccinations?: CountryDetailsResponse;
  secondaryVaccinations?: CountryDetailsResponse;
  primaryMortality?: CountryDetailsResponse;
  secondaryMortality?: CountryDetailsResponse;
  primaryName?: string;
  secondaryName?: string;
  loading: boolean;
};

type SeriesPoint = { date: string; value: number | null };
type AlignedPoint = { date: string; primary: number | null; secondary: number | null };

function toNumeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Number(value);
}

function normalizeToBase100(values: Array<number | null>): Array<number | null> {
  const base = values.find((item) => item !== null && item > 0) ?? values.find((item) => item !== null) ?? null;
  if (base === null || base === 0) {
    return values.map(() => null);
  }
  return values.map((item) => (item === null ? null : Number(((item / base) * 100).toFixed(2))));
}

function formatRatioValue(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value === 0) return '0x';
  if (value < 0.0001) return `${value.toExponential(2)}x`;
  if (value < 1) return `${value.toFixed(6).replace(/\.?0+$/, '')}x`;
  return `${value.toFixed(3).replace(/\.?0+$/, '')}x`;
}

function alignTwoSeries(primarySeries: SeriesPoint[], secondarySeries: SeriesPoint[]): AlignedPoint[] {
  const primaryByDate = new Map<string, number | null>();
  const secondaryByDate = new Map<string, number | null>();
  const dateSet = new Set<string>();

  for (const point of primarySeries) {
    const value = toNumeric(point.value);
    primaryByDate.set(point.date, value);
    dateSet.add(point.date);
  }
  for (const point of secondarySeries) {
    const value = toNumeric(point.value);
    secondaryByDate.set(point.date, value);
    dateSet.add(point.date);
  }

  return Array.from(dateSet)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      primary: primaryByDate.get(date) ?? null,
      secondary: secondaryByDate.get(date) ?? null,
    }));
}

function buildCrossMetricScatterPoints(xSeries: SeriesPoint[], ySeries: SeriesPoint[]) {
  const xByDate = new Map<string, number | null>();
  const yByDate = new Map<string, number | null>();
  const dates = new Set<string>();

  for (const point of xSeries) {
    xByDate.set(point.date, toNumeric(point.value));
    dates.add(point.date);
  }
  for (const point of ySeries) {
    yByDate.set(point.date, toNumeric(point.value));
    dates.add(point.date);
  }

  return Array.from(dates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      x: xByDate.get(date) ?? null,
      y: yByDate.get(date) ?? null,
    }))
    .filter((item) => item.x !== null && item.y !== null);
}

const CompareTrendChart: React.FC<CompareTrendChartProps> = ({
  metric,
  primary,
  secondary,
  primaryVaccinations,
  secondaryVaccinations,
  primaryMortality,
  secondaryMortality,
  primaryName,
  secondaryName,
  loading,
}) => {
  const primarySeries = useMemo(() => primary?.series ?? [], [primary?.series]);
  const secondarySeries = useMemo(() => secondary?.series ?? [], [secondary?.series]);
  const primaryVaccinationsSeries = useMemo(
    () => primaryVaccinations?.series ?? [],
    [primaryVaccinations?.series]
  );
  const secondaryVaccinationsSeries = useMemo(
    () => secondaryVaccinations?.series ?? [],
    [secondaryVaccinations?.series]
  );
  const primaryMortalitySeries = useMemo(() => primaryMortality?.series ?? [], [primaryMortality?.series]);
  const secondaryMortalitySeries = useMemo(
    () => secondaryMortality?.series ?? [],
    [secondaryMortality?.series]
  );

  const aligned = useMemo(() => alignTwoSeries(primarySeries, secondarySeries), [primarySeries, secondarySeries]);

  const hasOverlappingSeries = aligned.some((item) => item.primary !== null && item.secondary !== null);
  const alignedDates = aligned.map((item) => item.date);
  const isFlowMetric =
    metric === 'today_cases' ||
    metric === 'today_deaths' ||
    metric === 'today_recovered' ||
    metric === 'today_vaccinations';

  const differenceValues = aligned.map((item) =>
    item.primary !== null && item.secondary !== null
      ? Number((item.primary - item.secondary).toFixed(2))
      : null
  );
  let runningPrimary = 0;
  let runningSecondary = 0;
  const ratioValues = aligned.map((item) => {
    if (isFlowMetric) {
      runningPrimary += Math.max(item.primary ?? 0, 0);
      runningSecondary += Math.max(item.secondary ?? 0, 0);
      return runningSecondary > 0 ? runningPrimary / runningSecondary : null;
    }
    return item.primary !== null && item.secondary !== null && item.secondary !== 0
      ? item.primary / item.secondary
      : null;
  });
  const shareValues = aligned.map((item) => {
    if (item.primary === null || item.secondary === null) return null;
    const total = item.primary + item.secondary;
    if (total <= 0) return null;
    return Number(((item.primary / total) * 100).toFixed(2));
  });

  const normalizedPrimary = normalizeToBase100(aligned.map((item) => item.primary));
  const normalizedSecondary = normalizeToBase100(aligned.map((item) => item.secondary));
  const headlineRatio = useMemo(() => {
    const primaryHeadline = toNumeric(primary?.headline);
    const secondaryHeadline = toNumeric(secondary?.headline);
    if (primaryHeadline === null || secondaryHeadline === null || secondaryHeadline === 0) {
      return null;
    }
    return primaryHeadline / secondaryHeadline;
  }, [primary?.headline, secondary?.headline]);
  const headlineRatioLabel = formatRatioValue(headlineRatio);

  const traces = [
    primarySeries.length
      ? {
          x: primarySeries.map((point: SeriesPoint) => point.date),
          y: primarySeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: primaryName || primary?.name || 'Primary',
          line: { color: '#4de0ff', width: 2.4 },
        }
      : null,
    secondarySeries.length
      ? {
          x: secondarySeries.map((point: SeriesPoint) => point.date),
          y: secondarySeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: secondaryName || secondary?.name || 'Compare',
          line: { color: '#ff8a47', width: 2.4 },
        }
      : null,
  ].filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const vaccinationTraces = [
    primaryVaccinationsSeries.length
      ? {
          x: primaryVaccinationsSeries.map((point: SeriesPoint) => point.date),
          y: primaryVaccinationsSeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: primaryName || primary?.name || 'Primary',
          line: { color: '#80ed99', width: 2.2 },
          fill: 'tozeroy',
          fillcolor: 'rgba(128,237,153,0.14)',
        }
      : null,
    secondaryVaccinationsSeries.length
      ? {
          x: secondaryVaccinationsSeries.map((point: SeriesPoint) => point.date),
          y: secondaryVaccinationsSeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: secondaryName || secondary?.name || 'Compare',
          line: { color: '#2ec4b6', width: 2.2 },
        }
      : null,
  ].filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const mortalityTraces = [
    primaryMortalitySeries.length
      ? {
          x: primaryMortalitySeries.map((point: SeriesPoint) => point.date),
          y: primaryMortalitySeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'bar' as const,
          name: primaryName || primary?.name || 'Primary',
          marker: { color: 'rgba(255,138,71,0.7)' },
          opacity: 0.75,
        }
      : null,
    secondaryMortalitySeries.length
      ? {
          x: secondaryMortalitySeries.map((point: SeriesPoint) => point.date),
          y: secondaryMortalitySeries.map((point: SeriesPoint) => point.value ?? null),
          type: 'scatter' as const,
          mode: 'lines',
          name: secondaryName || secondary?.name || 'Compare',
          line: { color: '#f78fb3', width: 2.3 },
        }
      : null,
  ].filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const primaryCrossPoints = buildCrossMetricScatterPoints(primaryVaccinationsSeries, primaryMortalitySeries);
  const secondaryCrossPoints = buildCrossMetricScatterPoints(secondaryVaccinationsSeries, secondaryMortalitySeries);
  const hasCrossMetricPoints = primaryCrossPoints.length > 0 || secondaryCrossPoints.length > 0;

  return (
    <div className="compare-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Comparison trend • {summaryMetricLabel(metric)}</p>
        {headlineRatioLabel ? <span className="pill pill-ghost">Headline ratio: {headlineRatioLabel}</span> : null}
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

      <div className="compare-extra-grid">
        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Gap (Primary - Compare)</p>
          </div>
          {hasOverlappingSeries ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  {
                    x: alignedDates,
                    y: differenceValues,
                    type: 'bar',
                    marker: {
                      color: differenceValues.map((value) =>
                        value === null ? '#334155' : value >= 0 ? '#4de0ff' : '#ff8a47'
                      ),
                    },
                    hovertemplate: '%{x}<br>Gap: %{y}<extra></extra>',
                  },
                ]}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, zerolinecolor: '#63738a' },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">Select two countries with overlapping data.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">
              {isFlowMetric ? 'Cumulative Ratio (Primary / Compare)' : 'Ratio (Primary / Compare)'}
            </p>
          </div>
          {hasOverlappingSeries ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  {
                    x: alignedDates,
                    y: ratioValues,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Ratio',
                    line: { color: '#9b8cff', width: 2.2 },
                    hovertemplate: '%{x}<br>Ratio: %{y:.6f}x<extra></extra>',
                  },
                  {
                    x: alignedDates,
                    y: alignedDates.map(() => 1),
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Parity',
                    line: { color: '#64748b', width: 1.4, dash: 'dash' },
                    hoverinfo: 'skip',
                  },
                ]}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  legend: { orientation: 'h', y: 1.11, x: 0 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">Select two countries with overlapping data.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Normalized Index (Base = 100)</p>
          </div>
          {hasOverlappingSeries ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  {
                    x: alignedDates,
                    y: normalizedPrimary,
                    type: 'scatter',
                    mode: 'lines',
                    name: primaryName || primary?.name || 'Primary',
                    line: { color: '#4de0ff', width: 2.2 },
                  },
                  {
                    x: alignedDates,
                    y: normalizedSecondary,
                    type: 'scatter',
                    mode: 'lines',
                    name: secondaryName || secondary?.name || 'Compare',
                    line: { color: '#ff8a47', width: 2.2 },
                  },
                ]}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  legend: { orientation: 'h', y: 1.11, x: 0 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">Select two countries with overlapping data.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Primary Share (%)</p>
          </div>
          {hasOverlappingSeries ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  {
                    x: alignedDates,
                    y: shareValues,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#22c55e', width: 2.2 },
                    fill: 'tozeroy',
                    fillcolor: 'rgba(34,197,94,0.14)',
                    hovertemplate: '%{x}<br>Primary share: %{y}%<extra></extra>',
                  },
                  {
                    x: alignedDates,
                    y: alignedDates.map(() => 50),
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#64748b', width: 1.3, dash: 'dash' },
                    hoverinfo: 'skip',
                  },
                ]}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, range: [0, 100] },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">Select two countries with overlapping data.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Vaccinations (daily) trend</p>
          </div>
          {vaccinationTraces.length ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={vaccinationTraces}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  legend: { orientation: 'h', y: 1.11, x: 0 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">No vaccination series for selected countries.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Mortality comparison</p>
          </div>
          {mortalityTraces.length ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={mortalityTraces}
                layout={{
                  height: 250,
                  margin: { l: 42, r: 10, t: 10, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
                  yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, tickformat: '.2f' },
                  legend: { orientation: 'h', y: 1.11, x: 0 },
                  barmode: 'overlay',
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">No mortality series for selected countries.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Vaccinations vs Mortality (scatter)</p>
          </div>
          {hasCrossMetricPoints ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  ...(primaryCrossPoints.length
                    ? [
                        {
                          x: primaryCrossPoints.map((point) => point.x),
                          y: primaryCrossPoints.map((point) => point.y),
                          text: primaryCrossPoints.map((point) => point.date),
                          type: 'scatter',
                          mode: 'markers',
                          name: primaryName || primary?.name || 'Primary',
                          marker: { color: '#4de0ff', size: 7, opacity: 0.72 },
                          hovertemplate: '%{text}<br>Vaccinations: %{x}<br>Mortality: %{y:.2f}%<extra></extra>',
                        },
                      ]
                    : []),
                  ...(secondaryCrossPoints.length
                    ? [
                        {
                          x: secondaryCrossPoints.map((point) => point.x),
                          y: secondaryCrossPoints.map((point) => point.y),
                          text: secondaryCrossPoints.map((point) => point.date),
                          type: 'scatter',
                          mode: 'markers',
                          name: secondaryName || secondary?.name || 'Compare',
                          marker: { color: '#ff8a47', size: 7, opacity: 0.72, symbol: 'diamond' },
                          hovertemplate: '%{text}<br>Vaccinations: %{x}<br>Mortality: %{y:.2f}%<extra></extra>',
                        },
                      ]
                    : []),
                ]}
                layout={{
                  height: 250,
                  margin: { l: 50, r: 10, t: 10, b: 34 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  xaxis: {
                    gridcolor: '#1f2937',
                    tickfont: { color: '#8ea0b7' },
                    title: { text: 'Vaccinations (daily)', font: { color: '#8ea0b7', size: 11 } },
                  },
                  yaxis: {
                    gridcolor: '#1f2937',
                    tickfont: { color: '#8ea0b7' },
                    title: { text: 'Mortality (%)', font: { color: '#8ea0b7', size: 11 } },
                  },
                  legend: { orientation: 'h', y: 1.11, x: 0 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '250px' }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">No overlapping vaccination + mortality points.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompareTrendChart;
