import React from 'react';
import Plot from '../common/Plot';
import { formatNumericValue, LocaleCode } from '../../lib/i18n';
import { usePreferences } from '../../state/preferences';
import { SummaryAnomalyPayload } from '../../types/map';

type AnomalyDetectionChartProps = {
  anomalies?: SummaryAnomalyPayload;
  rankMetricLabel?: string;
  rankEntityLabel: string;
};

function formatValue(value: number | null | undefined, locale?: LocaleCode): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return formatNumericValue(value, locale, { maximumFractionDigits: 2 });
}

const AnomalyDetectionChart: React.FC<AnomalyDetectionChartProps> = ({
  anomalies,
  rankMetricLabel,
  rankEntityLabel,
}) => {
  const { copy, locale } = usePreferences();
  const items = anomalies?.items || [];
  const anomalyCount = anomalies?.count || 0;
  const anomalyTitle = rankMetricLabel
    ? `${copy.worldwide.anomalyDetection} • ${rankMetricLabel}`
    : copy.worldwide.anomalyDetection;

  return (
    <div className="world-chart-card">
      <div className="chart-header">
        <p className="panel-kicker">{anomalyTitle}</p>
        <span className="pill pill-ghost">
          {anomalyCount} {copy.worldwide.detected}
        </span>
      </div>
      {items.length ? (
        <div className="world-plot-frame">
          <Plot
            data={[
              {
                x: items.map((item) => Math.abs(item.score || 0)),
                y: items.map((item) => item.name || item.isoCode),
                type: 'bar',
                orientation: 'h',
                marker: {
                  color: items.map((item) => (item.direction === 'low' ? '#fbbf24' : '#f87171')),
                },
                text: items.map((item) => formatValue(item.value, locale)),
                textposition: 'outside',
                hovertemplate: `${rankEntityLabel}: %{y}<br>${copy.worldwide.valueLabel}: %{text}<br>${copy.worldwide.zScoreAxis}: %{x:.2f}<extra></extra>`,
              },
            ]}
            layout={{
              height: 340,
              margin: { l: 140, r: 24, t: 12, b: 26 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#e2e8f0' },
              xaxis: {
                title: { text: copy.worldwide.zScoreAxis, font: { color: '#8ea0b7', size: 12 } },
                gridcolor: '#1f2937',
                tickfont: { color: '#8ea0b7' },
              },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' }, automargin: true },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '340px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">{copy.worldwide.noOutliersDetected}</div>
      )}
    </div>
  );
};

export default AnomalyDetectionChart;
