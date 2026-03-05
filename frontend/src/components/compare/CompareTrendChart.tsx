import React from 'react';
import Plot from '../common/Plot';
import { summaryMetricLabel } from '../../lib/analytics';
import { CountryDetailsResponse, SummaryMetric } from '../../types/map';

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
  ].filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  return (
    <div className="compare-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Comparison trend • {summaryMetricLabel(metric)}</p>
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

export default CompareTrendChart;
