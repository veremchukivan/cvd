import React, { useMemo, useState } from 'react';
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
type CompareVariable = 'selected' | 'vaccinations' | 'mortality';
type CompareView = 'overlay' | 'gap' | 'ratio' | 'normalized' | 'share';
type CompareStyle = 'line' | 'area' | 'bar';

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

function computeRatioValues(points: AlignedPoint[], asCumulative: boolean): Array<number | null> {
  let runningPrimary = 0;
  let runningSecondary = 0;
  return points.map((item) => {
    if (item.primary === null || item.secondary === null) return null;
    if (asCumulative) {
      runningPrimary += Math.max(item.primary, 0);
      runningSecondary += Math.max(item.secondary, 0);
      return runningSecondary > 0 ? runningPrimary / runningSecondary : null;
    }
    return item.secondary !== 0 ? item.primary / item.secondary : null;
  });
}

function buildSeriesTrace({
  dates,
  values,
  style,
  name,
  color,
  fillColor,
  dash,
}: {
  dates: string[];
  values: Array<number | null>;
  style: CompareStyle;
  name: string;
  color: string;
  fillColor: string;
  dash?: string;
}) {
  if (style === 'bar') {
    return {
      x: dates,
      y: values,
      type: 'bar',
      name,
      marker: { color },
      opacity: 0.78,
    };
  }
  return {
    x: dates,
    y: values,
    type: 'scatter',
    mode: 'lines',
    name,
    line: { color, width: 2.3, dash },
    fill: style === 'area' ? 'tozeroy' : undefined,
    fillcolor: style === 'area' ? fillColor : undefined,
  };
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

  const [customVariable, setCustomVariable] = useState<CompareVariable>('selected');
  const [customView, setCustomView] = useState<CompareView>('overlay');
  const [customStyle, setCustomStyle] = useState<CompareStyle>('line');
  const [showPrimarySeries, setShowPrimarySeries] = useState(true);
  const [showSecondarySeries, setShowSecondarySeries] = useState(true);

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
  const ratioValues = computeRatioValues(aligned, isFlowMetric);
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

  const customMeta = useMemo(() => {
    if (customVariable === 'vaccinations') {
      return {
        label: 'Vaccinations (daily)',
        isFlow: true,
        primary: primaryVaccinationsSeries,
        secondary: secondaryVaccinationsSeries,
        primaryColor: '#80ed99',
        secondaryColor: '#2ec4b6',
        primaryFill: 'rgba(128,237,153,0.16)',
        secondaryFill: 'rgba(46,196,182,0.16)',
      };
    }
    if (customVariable === 'mortality') {
      return {
        label: 'Mortality (%)',
        isFlow: false,
        primary: primaryMortalitySeries,
        secondary: secondaryMortalitySeries,
        primaryColor: '#f78fb3',
        secondaryColor: '#f9a8d4',
        primaryFill: 'rgba(247,143,179,0.16)',
        secondaryFill: 'rgba(249,168,212,0.16)',
      };
    }
    return {
      label: summaryMetricLabel(metric),
      isFlow: isFlowMetric,
      primary: primarySeries,
      secondary: secondarySeries,
      primaryColor: '#4de0ff',
      secondaryColor: '#ff8a47',
      primaryFill: 'rgba(77,224,255,0.16)',
      secondaryFill: 'rgba(255,138,71,0.16)',
    };
  }, [
    customVariable,
    isFlowMetric,
    metric,
    primaryMortalitySeries,
    primarySeries,
    primaryVaccinationsSeries,
    secondaryMortalitySeries,
    secondarySeries,
    secondaryVaccinationsSeries,
  ]);

  const customAligned = useMemo(
    () => alignTwoSeries(customMeta.primary, customMeta.secondary),
    [customMeta.primary, customMeta.secondary]
  );
  const customDates = customAligned.map((item) => item.date);
  const customPrimaryValues = customAligned.map((item) => item.primary);
  const customSecondaryValues = customAligned.map((item) => item.secondary);
  const customHasOverlap = customAligned.some((item) => item.primary !== null && item.secondary !== null);

  const customDifferenceValues = customAligned.map((item) =>
    item.primary !== null && item.secondary !== null
      ? Number((item.primary - item.secondary).toFixed(2))
      : null
  );
  const customRatioValues = useMemo(
    () => computeRatioValues(customAligned, customMeta.isFlow),
    [customAligned, customMeta.isFlow]
  );
  const customShareValues = customAligned.map((item) => {
    if (item.primary === null || item.secondary === null) return null;
    const total = item.primary + item.secondary;
    if (total <= 0) return null;
    return Number(((item.primary / total) * 100).toFixed(2));
  });
  const customNormalizedPrimary = normalizeToBase100(customPrimaryValues);
  const customNormalizedSecondary = normalizeToBase100(customSecondaryValues);

  const includePrimary = customView === 'overlay' || customView === 'normalized' ? showPrimarySeries : true;
  const includeSecondary = customView === 'overlay' || customView === 'normalized' ? showSecondarySeries : true;

  const customTraces = useMemo(() => {
    const primaryLabel = primaryName || primary?.name || 'Primary';
    const secondaryLabel = secondaryName || secondary?.name || 'Compare';

    if (customView === 'overlay') {
      const traces: Array<Record<string, unknown>> = [];
      if (includePrimary) {
        traces.push(
          buildSeriesTrace({
            dates: customDates,
            values: customPrimaryValues,
            style: customStyle,
            name: primaryLabel,
            color: customMeta.primaryColor,
            fillColor: customMeta.primaryFill,
          })
        );
      }
      if (includeSecondary) {
        traces.push(
          buildSeriesTrace({
            dates: customDates,
            values: customSecondaryValues,
            style: customStyle,
            name: secondaryLabel,
            color: customMeta.secondaryColor,
            fillColor: customMeta.secondaryFill,
            dash: customStyle === 'bar' ? undefined : 'dot',
          })
        );
      }
      return traces;
    }

    if (customView === 'gap') {
      if (!customHasOverlap) return [];
      if (customStyle === 'bar') {
        return [
          {
            x: customDates,
            y: customDifferenceValues,
            type: 'bar',
            name: 'Gap',
            marker: {
              color: customDifferenceValues.map((value) =>
                value === null ? '#334155' : value >= 0 ? '#4de0ff' : '#ff8a47'
              ),
            },
            hovertemplate: '%{x}<br>Gap: %{y}<extra></extra>',
          },
        ];
      }
      return [
        buildSeriesTrace({
          dates: customDates,
          values: customDifferenceValues,
          style: customStyle,
          name: 'Gap',
          color: '#38bdf8',
          fillColor: 'rgba(56,189,248,0.16)',
        }),
        {
          x: customDates,
          y: customDates.map(() => 0),
          type: 'scatter',
          mode: 'lines',
          name: 'Zero',
          line: { color: '#64748b', width: 1.3, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ];
    }

    if (customView === 'ratio') {
      if (!customHasOverlap) return [];
      if (customStyle === 'bar') {
        return [
          {
            x: customDates,
            y: customRatioValues,
            type: 'bar',
            name: 'Ratio',
            marker: { color: '#a78bfa' },
          },
          {
            x: customDates,
            y: customDates.map(() => 1),
            type: 'scatter',
            mode: 'lines',
            name: 'Parity',
            line: { color: '#64748b', width: 1.2, dash: 'dash' },
            hoverinfo: 'skip',
          },
        ];
      }
      return [
        buildSeriesTrace({
          dates: customDates,
          values: customRatioValues,
          style: customStyle,
          name: 'Ratio',
          color: '#a78bfa',
          fillColor: 'rgba(167,139,250,0.16)',
        }),
        {
          x: customDates,
          y: customDates.map(() => 1),
          type: 'scatter',
          mode: 'lines',
          name: 'Parity',
          line: { color: '#64748b', width: 1.2, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ];
    }

    if (customView === 'normalized') {
      const traces: Array<Record<string, unknown>> = [];
      if (includePrimary) {
        traces.push(
          buildSeriesTrace({
            dates: customDates,
            values: customNormalizedPrimary,
            style: customStyle,
            name: primaryLabel,
            color: customMeta.primaryColor,
            fillColor: customMeta.primaryFill,
          })
        );
      }
      if (includeSecondary) {
        traces.push(
          buildSeriesTrace({
            dates: customDates,
            values: customNormalizedSecondary,
            style: customStyle,
            name: secondaryLabel,
            color: customMeta.secondaryColor,
            fillColor: customMeta.secondaryFill,
            dash: customStyle === 'bar' ? undefined : 'dot',
          })
        );
      }
      return traces;
    }

    if (!customHasOverlap) return [];
    if (customStyle === 'bar') {
      return [
        {
          x: customDates,
          y: customShareValues,
          type: 'bar',
          name: 'Primary share',
          marker: { color: '#22c55e' },
          opacity: 0.82,
        },
        {
          x: customDates,
          y: customDates.map(() => 50),
          type: 'scatter',
          mode: 'lines',
          name: 'Parity',
          line: { color: '#64748b', width: 1.2, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ];
    }
    return [
      buildSeriesTrace({
        dates: customDates,
        values: customShareValues,
        style: customStyle,
        name: 'Primary share',
        color: '#22c55e',
        fillColor: 'rgba(34,197,94,0.16)',
      }),
      {
        x: customDates,
        y: customDates.map(() => 50),
        type: 'scatter',
        mode: 'lines',
        name: 'Parity',
        line: { color: '#64748b', width: 1.2, dash: 'dash' },
        hoverinfo: 'skip',
      },
    ];
  }, [
    customDates,
    customDifferenceValues,
    customHasOverlap,
    customMeta.primaryColor,
    customMeta.primaryFill,
    customMeta.secondaryColor,
    customMeta.secondaryFill,
    customNormalizedPrimary,
    customNormalizedSecondary,
    customPrimaryValues,
    customRatioValues,
    customSecondaryValues,
    customShareValues,
    customStyle,
    customView,
    includePrimary,
    includeSecondary,
    primary?.name,
    primaryName,
    secondary?.name,
    secondaryName,
  ]);

  const customPlotTitle = useMemo(() => {
    if (customView === 'overlay') return `${customMeta.label} • Overlay`;
    if (customView === 'gap') return `${customMeta.label} • Gap (Primary - Compare)`;
    if (customView === 'ratio')
      return `${customMeta.label} • ${customMeta.isFlow ? 'Cumulative ratio' : 'Ratio'} (Primary / Compare)`;
    if (customView === 'normalized') return `${customMeta.label} • Normalized index`;
    return `${customMeta.label} • Primary share (%)`;
  }, [customMeta.isFlow, customMeta.label, customView]);

  const customEmptyMessage = useMemo(() => {
    if ((customView === 'gap' || customView === 'ratio' || customView === 'share') && !customHasOverlap) {
      return 'Selected variable has no overlapping points for both countries.';
    }
    if ((customView === 'overlay' || customView === 'normalized') && !includePrimary && !includeSecondary) {
      return 'Select at least one series (Primary or Compare).';
    }
    return 'No data for selected countries and chart options.';
  }, [customHasOverlap, customView, includePrimary, includeSecondary]);

  const primaryCrossPoints = buildCrossMetricScatterPoints(primaryVaccinationsSeries, primaryMortalitySeries);
  const secondaryCrossPoints = buildCrossMetricScatterPoints(secondaryVaccinationsSeries, secondaryMortalitySeries);
  const hasCrossMetricPoints = primaryCrossPoints.length > 0 || secondaryCrossPoints.length > 0;

  return (
    <div className="compare-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Custom comparison chart</p>
        <div className="compare-header-pills">
          {headlineRatioLabel ? <span className="pill pill-ghost">Headline ratio: {headlineRatioLabel}</span> : null}
          {loading ? <span className="pill pill-ghost">Loading…</span> : null}
        </div>
      </div>

      <div className="compare-custom-controls">
        <div className="compare-custom-grid">
          <div className="compare-custom-field">
            <label className="filter-label">Variable</label>
            <select
              value={customVariable}
              onChange={(event) => setCustomVariable(event.target.value as CompareVariable)}
              className="charts-select compare-custom-select"
            >
              <option value="selected">Selected metric ({summaryMetricLabel(metric)})</option>
              <option value="vaccinations">Vaccinations (daily)</option>
              <option value="mortality">Mortality (%)</option>
            </select>
          </div>

          <div className="compare-custom-field">
            <label className="filter-label">View mode</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${customView === 'overlay' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomView('overlay')}
              >
                Overlay
              </button>
              <button
                type="button"
                className={`pill ${customView === 'gap' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomView('gap')}
              >
                Gap
              </button>
              <button
                type="button"
                className={`pill ${customView === 'ratio' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomView('ratio')}
              >
                Ratio
              </button>
              <button
                type="button"
                className={`pill ${customView === 'normalized' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomView('normalized')}
              >
                Index
              </button>
              <button
                type="button"
                className={`pill ${customView === 'share' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomView('share')}
              >
                Share
              </button>
            </div>
          </div>

          <div className="compare-custom-field">
            <label className="filter-label">Chart style</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${customStyle === 'line' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomStyle('line')}
              >
                Line
              </button>
              <button
                type="button"
                className={`pill ${customStyle === 'area' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomStyle('area')}
              >
                Area
              </button>
              <button
                type="button"
                className={`pill ${customStyle === 'bar' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setCustomStyle('bar')}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="compare-custom-field">
            <label className="filter-label">Series</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${showPrimarySeries ? 'pill-active' : 'pill-ghost'}`}
                onClick={() =>
                  setShowPrimarySeries((current) => (current && !showSecondarySeries ? true : !current))
                }
              >
                Primary
              </button>
              <button
                type="button"
                className={`pill ${showSecondarySeries ? 'pill-active' : 'pill-ghost'}`}
                onClick={() =>
                  setShowSecondarySeries((current) => (current && !showPrimarySeries ? true : !current))
                }
              >
                Compare
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-header compare-custom-title-row">
        <p className="panel-kicker">{customPlotTitle}</p>
      </div>

      {customTraces.length ? (
        <div className="compare-plot-frame">
          <Plot
            data={customTraces}
            layout={{
              height: 330,
              margin: { l: 46, r: 12, t: 14, b: 36 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: {
                gridcolor: '#1f2937',
                tickfont: { color: '#8ea0b7' },
                range: customView === 'share' ? [0, 100] : undefined,
              },
              legend: { orientation: 'h', y: 1.11, x: 0 },
              barmode:
                (customView === 'overlay' || customView === 'normalized') && customStyle === 'bar'
                  ? 'group'
                  : undefined,
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '330px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">{customEmptyMessage}</div>
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
          {primaryVaccinationsSeries.length || secondaryVaccinationsSeries.length ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  ...(primaryVaccinationsSeries.length
                    ? [
                        {
                          x: primaryVaccinationsSeries.map((point: SeriesPoint) => point.date),
                          y: primaryVaccinationsSeries.map((point: SeriesPoint) => point.value ?? null),
                          type: 'scatter',
                          mode: 'lines',
                          name: primaryName || primary?.name || 'Primary',
                          line: { color: '#80ed99', width: 2.2 },
                          fill: 'tozeroy',
                          fillcolor: 'rgba(128,237,153,0.14)',
                        },
                      ]
                    : []),
                  ...(secondaryVaccinationsSeries.length
                    ? [
                        {
                          x: secondaryVaccinationsSeries.map((point: SeriesPoint) => point.date),
                          y: secondaryVaccinationsSeries.map((point: SeriesPoint) => point.value ?? null),
                          type: 'scatter',
                          mode: 'lines',
                          name: secondaryName || secondary?.name || 'Compare',
                          line: { color: '#2ec4b6', width: 2.2 },
                        },
                      ]
                    : []),
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
            <div className="chart-placeholder">No vaccination series for selected countries.</div>
          )}
        </div>

        <div className="compare-chart-card compare-chart-card-compact">
          <div className="chart-header">
            <p className="panel-kicker">Mortality comparison</p>
          </div>
          {primaryMortalitySeries.length || secondaryMortalitySeries.length ? (
            <div className="compare-plot-frame compare-plot-frame-compact">
              <Plot
                data={[
                  ...(primaryMortalitySeries.length
                    ? [
                        {
                          x: primaryMortalitySeries.map((point: SeriesPoint) => point.date),
                          y: primaryMortalitySeries.map((point: SeriesPoint) => point.value ?? null),
                          type: 'bar',
                          name: primaryName || primary?.name || 'Primary',
                          marker: { color: 'rgba(255,138,71,0.7)' },
                          opacity: 0.75,
                        },
                      ]
                    : []),
                  ...(secondaryMortalitySeries.length
                    ? [
                        {
                          x: secondaryMortalitySeries.map((point: SeriesPoint) => point.date),
                          y: secondaryMortalitySeries.map((point: SeriesPoint) => point.value ?? null),
                          type: 'scatter',
                          mode: 'lines',
                          name: secondaryName || secondary?.name || 'Compare',
                          line: { color: '#f78fb3', width: 2.3 },
                        },
                      ]
                    : []),
                ]}
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
