import React from 'react';
import Plot from '../common/Plot';
import AnomalyDetectionChart from './AnomalyDetectionChart';
import WorldwideCustomChart from './WorldwideCustomChart';
import { SummaryAnomalyPayload, SummaryMetric } from '../../types/map';

type SeriesPoint = {
  date: string;
  value: number | null;
};

type OutcomeItem = {
  label: string;
  value: number;
  color: string;
};

type WorldwideChartsGridProps = {
  timelineChartData: Array<Record<string, unknown>>;
  worldLoading: boolean;
  rankingLoading: boolean;
  rankMetricLabel?: string;
  rankEntityLabel: string;
  rankLabels: string[];
  rankValues: number[];
  anomalies?: SummaryAnomalyPayload;
  momentumDates: string[];
  momentumValues: Array<number | null>;
  momentumMoving: Array<number | null>;
  weekdayLabels: string[];
  weekdayValues: number[];
  outcomeItems: OutcomeItem[];
  customSeriesByMetric: Partial<Record<SummaryMetric, SeriesPoint[]>>;
  periodLabel: string;
};

const WorldwideChartsGrid: React.FC<WorldwideChartsGridProps> = ({
  timelineChartData,
  worldLoading,
  rankingLoading,
  rankMetricLabel,
  rankEntityLabel,
  rankLabels,
  rankValues,
  anomalies,
  momentumDates,
  momentumValues,
  momentumMoving,
  weekdayLabels,
  weekdayValues,
  outcomeItems,
  customSeriesByMetric,
  periodLabel,
}) => (
  <div className="world-chart-grid">
    <div className="world-chart-card world-chart-card-wide">
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
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, rangemode: 'tozero' },
              legend: { orientation: 'h', y: 1.14, x: 0 },
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

    <div className="world-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Cases momentum • daily vs 7-day average</p>
      </div>
      {momentumDates.length ? (
        <div className="world-plot-frame">
          <Plot
            data={[
              {
                x: momentumDates,
                y: momentumValues,
                type: 'bar',
                name: 'Daily',
                marker: { color: '#1f7a99' },
                opacity: 0.74,
              },
              {
                x: momentumDates,
                y: momentumMoving,
                type: 'scatter',
                mode: 'lines',
                name: '7-day avg',
                line: { color: '#4de0ff', width: 2.5 },
              },
            ]}
            layout={{
              height: 320,
              margin: { l: 44, r: 12, t: 12, b: 36 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, rangemode: 'tozero' },
              legend: { orientation: 'h', y: 1.1, x: 0 },
              barmode: 'overlay',
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '320px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">No momentum data for current period.</div>
      )}
    </div>

    <div className="world-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Weekday profile • average daily cases</p>
      </div>
      {weekdayValues.some((value) => value > 0) ? (
        <div className="world-plot-frame">
          <Plot
            data={[
              {
                x: weekdayLabels,
                y: weekdayValues,
                type: 'bar',
                marker: {
                  color: weekdayValues.map((_, index) =>
                    index >= 5 ? 'rgba(255,138,71,0.82)' : 'rgba(77,224,255,0.84)'
                  ),
                },
              },
            ]}
            layout={{
              height: 320,
              margin: { l: 44, r: 12, t: 12, b: 36 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, rangemode: 'tozero' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '320px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">No weekday profile available.</div>
      )}
    </div>

    <div className="world-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">Outcome composition</p>
      </div>
      {outcomeItems.length ? (
        <div className="world-plot-frame">
          <Plot
            data={[
              {
                type: 'pie',
                labels: outcomeItems.map((item) => item.label),
                values: outcomeItems.map((item) => item.value),
                hole: 0.56,
                textinfo: 'label+percent',
                textfont: { color: '#d6e3f2', size: 11 },
                marker: {
                  colors: outcomeItems.map((item) => item.color),
                  line: { color: 'rgba(8, 15, 32, 0.8)', width: 1 },
                },
              },
            ]}
            layout={{
              height: 320,
              margin: { l: 12, r: 12, t: 12, b: 12 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              showlegend: true,
              legend: { orientation: 'h', y: -0.12, x: 0 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '320px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">No outcome split data for selected settings.</div>
      )}
    </div>

    <AnomalyDetectionChart
      anomalies={anomalies}
      rankMetricLabel={rankMetricLabel}
      rankEntityLabel={rankEntityLabel}
    />

    <WorldwideCustomChart
      seriesByMetric={customSeriesByMetric}
      periodLabel={periodLabel}
      loading={worldLoading}
    />
  </div>
);

export default WorldwideChartsGrid;
