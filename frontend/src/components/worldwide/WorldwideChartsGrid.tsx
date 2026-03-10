import React from 'react';
import Plot from '../common/Plot';

type WorldwideChartsGridProps = {
  timelineChartData: Array<Record<string, unknown>>;
  worldLoading: boolean;
  rankingLoading: boolean;
  rankMetricLabel?: string;
  rankEntityLabel: string;
  rankLabels: string[];
  rankValues: number[];
};

const WorldwideChartsGrid: React.FC<WorldwideChartsGridProps> = ({
  timelineChartData,
  worldLoading,
  rankingLoading,
  rankMetricLabel,
  rankEntityLabel,
  rankLabels,
  rankValues,
}) => (
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
        <p className="panel-kicker">Top {rankEntityLabel} • {rankMetricLabel}</p>
        {rankingLoading ? <span className="pill pill-ghost">Loading…</span> : null}
      </div>
      {rankLabels.length ? (
        <div className="world-plot-frame">
          <Plot
            data={[
              {
                x: rankValues,
                y: rankLabels,
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
        <div className="chart-placeholder">No ranking data for selected settings.</div>
      )}
    </div>
  </div>
);

export default WorldwideChartsGrid;
