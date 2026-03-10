import React, { useEffect, useMemo, useState } from 'react';
import Plot from '../common/Plot';
import { summaryMetricLabel } from '../../lib/analytics';
import { SummaryMetric } from '../../types/map';

type SeriesPoint = {
  date: string;
  value: number | null;
};

type ChartStyle = 'line' | 'area' | 'bar';
type ValueScale = 'raw' | 'index';
type SmoothingMode = 'none' | 'ma7';
type WindowMode = '30d' | '90d' | 'all';

type MetricOption = {
  metric: SummaryMetric;
  color: string;
  fillColor: string;
};

type WorldwideCustomChartProps = {
  seriesByMetric: Partial<Record<SummaryMetric, SeriesPoint[]>>;
  periodLabel: string;
  loading: boolean;
};

const metricOptions: MetricOption[] = [
  { metric: 'today_cases', color: '#4de0ff', fillColor: 'rgba(77,224,255,0.16)' },
  { metric: 'today_deaths', color: '#ff8a47', fillColor: 'rgba(255,138,71,0.16)' },
  { metric: 'active', color: '#9fbbff', fillColor: 'rgba(159,187,255,0.16)' },
  { metric: 'vaccinations_total', color: '#2ec4b6', fillColor: 'rgba(46,196,182,0.16)' },
  { metric: 'mortality', color: '#f78fb3', fillColor: 'rgba(247,143,179,0.16)' },
];

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
      .filter((item): item is number => item !== null && Number.isFinite(item));
    if (!slice.length) {
      result.push(null);
      continue;
    }
    const avg = slice.reduce((acc, item) => acc + item, 0) / slice.length;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
}

function normalizeToBase100(values: Array<number | null>): Array<number | null> {
  const base = values.find((item) => item !== null && item > 0) ?? values.find((item) => item !== null) ?? null;
  if (base === null || base === 0) {
    return values.map(() => null);
  }
  return values.map((item) => (item === null ? null : Number(((item / base) * 100).toFixed(2))));
}

function sliceByWindow(series: SeriesPoint[], mode: WindowMode): SeriesPoint[] {
  if (mode === 'all') return series;
  const size = mode === '30d' ? 30 : 90;
  return series.slice(-size);
}

const WorldwideCustomChart: React.FC<WorldwideCustomChartProps> = ({ seriesByMetric, periodLabel, loading }) => {
  const [selectedMetrics, setSelectedMetrics] = useState<SummaryMetric[]>(['today_cases', 'today_deaths']);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('line');
  const [valueScale, setValueScale] = useState<ValueScale>('raw');
  const [smoothing, setSmoothing] = useState<SmoothingMode>('none');
  const [windowMode, setWindowMode] = useState<WindowMode>('90d');

  const availableMetrics = useMemo(
    () =>
      metricOptions
        .map((item) => item.metric)
        .filter((metric) => (seriesByMetric[metric]?.length || 0) > 0),
    [seriesByMetric]
  );

  useEffect(() => {
    setSelectedMetrics((prev) => {
      const valid = prev.filter((metric) => availableMetrics.includes(metric));
      if (valid.length) return valid;
      return availableMetrics.slice(0, Math.min(2, availableMetrics.length));
    });
  }, [availableMetrics]);

  const toggleMetric = (metric: SummaryMetric) => {
    setSelectedMetrics((prev) => {
      const selected = prev.includes(metric);
      if (selected) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== metric);
      }
      if (prev.length >= 4) return prev;
      return [...prev, metric];
    });
  };

  const traces = useMemo(() => {
    return metricOptions
      .filter((option) => selectedMetrics.includes(option.metric))
      .map((option) => {
        const source = sliceByWindow(seriesByMetric[option.metric] || [], windowMode);
        const dates = source.map((point) => point.date);
        const rawValues = source.map((point) => toNumeric(point.value));
        const smoothValues = smoothing === 'ma7' ? movingAverage(rawValues, 7) : rawValues;
        const values = valueScale === 'index' ? normalizeToBase100(smoothValues) : smoothValues;

        if (chartStyle === 'bar') {
          return {
            x: dates,
            y: values,
            type: 'bar',
            name: summaryMetricLabel(option.metric),
            marker: { color: option.color },
            opacity: 0.82,
          };
        }

        return {
          x: dates,
          y: values,
          type: 'scatter',
          mode: 'lines',
          name: summaryMetricLabel(option.metric),
          line: { color: option.color, width: 2.3 },
          fill: chartStyle === 'area' ? 'tozeroy' : undefined,
          fillcolor: chartStyle === 'area' ? option.fillColor : undefined,
        };
      })
      .filter((item) => (item.x?.length || 0) > 0);
  }, [chartStyle, selectedMetrics, seriesByMetric, smoothing, valueScale, windowMode]);

  return (
    <section className="world-chart-card world-chart-card-wide world-custom-card">
      <div className="chart-header">
        <p className="panel-kicker">Custom chart builder • worldwide</p>
        <span className="pill pill-ghost">{periodLabel}</span>
      </div>

      <div className="world-custom-controls">
        <div className="custom-control-group">
          <label className="filter-label">Metrics (up to 4)</label>
          <div className="custom-chip-grid">
            {metricOptions.map((item) => {
              const selected = selectedMetrics.includes(item.metric);
              const unavailable = !availableMetrics.includes(item.metric);
              const disabled = unavailable || (!selected && selectedMetrics.length >= 4);
              return (
                <button
                  key={item.metric}
                  type="button"
                  className={`custom-chip ${selected ? 'custom-chip-active' : ''}`}
                  onClick={() => toggleMetric(item.metric)}
                  disabled={disabled}
                >
                  <span className="custom-chip-dot" style={{ background: item.color }} />
                  {summaryMetricLabel(item.metric)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="world-custom-grid">
          <div className="custom-control-group">
            <label className="filter-label">Style</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${chartStyle === 'line' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setChartStyle('line')}
              >
                Line
              </button>
              <button
                type="button"
                className={`pill ${chartStyle === 'area' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setChartStyle('area')}
              >
                Area
              </button>
              <button
                type="button"
                className={`pill ${chartStyle === 'bar' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setChartStyle('bar')}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="custom-control-group">
            <label className="filter-label">Scale</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${valueScale === 'raw' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setValueScale('raw')}
              >
                Raw
              </button>
              <button
                type="button"
                className={`pill ${valueScale === 'index' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setValueScale('index')}
              >
                Index 100
              </button>
            </div>
          </div>

          <div className="custom-control-group">
            <label className="filter-label">Smoothing</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${smoothing === 'none' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setSmoothing('none')}
              >
                None
              </button>
              <button
                type="button"
                className={`pill ${smoothing === 'ma7' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setSmoothing('ma7')}
              >
                7-day avg
              </button>
            </div>
          </div>

          <div className="custom-control-group">
            <label className="filter-label">Window</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`pill ${windowMode === '30d' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setWindowMode('30d')}
              >
                30d
              </button>
              <button
                type="button"
                className={`pill ${windowMode === '90d' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setWindowMode('90d')}
              >
                90d
              </button>
              <button
                type="button"
                className={`pill ${windowMode === 'all' ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => setWindowMode('all')}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {traces.length ? (
        <div className="world-plot-frame world-plot-frame-tall">
          <Plot
            data={traces}
            layout={{
              height: 380,
              margin: { l: 48, r: 12, t: 12, b: 36 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: {
                gridcolor: '#1f2937',
                tickfont: { color: '#8ea0b7' },
                title:
                  valueScale === 'index'
                    ? { text: 'Index (base 100)', font: { color: '#8ea0b7', size: 11 } }
                    : undefined,
              },
              legend: { orientation: 'h', y: 1.14, x: 0 },
              barmode: chartStyle === 'bar' ? 'group' : undefined,
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '380px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">
          {loading ? 'Loading data for custom chart…' : 'Select metrics with available data to build your chart.'}
        </div>
      )}
    </section>
  );
};

export default WorldwideCustomChart;
