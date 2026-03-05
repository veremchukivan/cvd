import React from 'react';
import Plot from '../common/Plot';

export type MomentumPoint = {
  date: string;
  value: number | null;
  moving: number | null;
};

export type WeekdayProfilePoint = {
  label: string;
  value: number;
};

type ChartsDynamicsSectionProps = {
  flowTraces: Array<Record<string, unknown>>;
  momentumSeries: MomentumPoint[];
  weekdayProfile: WeekdayProfilePoint[];
};

const ChartsDynamicsSection: React.FC<ChartsDynamicsSectionProps> = ({
  flowTraces,
  momentumSeries,
  weekdayProfile,
}) => (
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
);

export default ChartsDynamicsSection;
