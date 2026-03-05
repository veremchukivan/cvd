import React from 'react';
import Plot from '../common/Plot';
import { formatSummaryValue } from '../../lib/analytics';
import { SummaryMetric } from '../../types/map';

export type SplitMetricDatum = {
  label: string;
  metric: SummaryMetric;
  value: number;
  color: string;
};

export type SplitMetricShare = SplitMetricDatum & {
  percent: number;
};

export type PairComparison = {
  key: string;
  title: string;
  left: SplitMetricDatum;
  right: SplitMetricDatum;
  leftPercent: number;
  rightPercent: number;
};

type ChartsComparisonsSectionProps = {
  splitData: SplitMetricDatum[];
  splitShare: SplitMetricShare[];
  pairComparisons: PairComparison[];
};

const ChartsComparisonsSection: React.FC<ChartsComparisonsSectionProps> = ({
  splitData,
  splitShare,
  pairComparisons,
}) => {
  if (!splitData.length && !pairComparisons.length) {
    return null;
  }

  return (
    <div className="charts-section">
      <div className="charts-section-head">
        <p className="charts-section-kicker">Comparisons</p>
        <h2 className="charts-section-title">Pair metric split</h2>
      </div>
      <div className="metric-rings-grid">
        {splitData.length ? (
          <div className="metric-ring-card">
            <p className="panel-kicker">Outcome split</p>
            <div className="outcome-split-layout">
              <div className="country-plot-frame outcome-split-plot">
                <Plot
                  data={[
                    {
                      labels: splitData.map((item) => item.label),
                      values: splitData.map((item) => item.value),
                      type: 'pie',
                      hole: 0.56,
                      marker: { colors: splitData.map((item) => item.color) },
                      textinfo: 'none',
                    },
                  ]}
                  layout={{
                    height: 260,
                    margin: { l: 10, r: 10, t: 10, b: 10 },
                    paper_bgcolor: 'transparent',
                    font: { color: '#e2e8f0' },
                    showlegend: false,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler
                  style={{ width: '100%', height: '260px' }}
                />
              </div>
              <div className="outcome-split-legend">
                {splitShare.map((item) => (
                  <div className="outcome-split-row" key={item.label}>
                    <span className="outcome-split-dot" style={{ background: item.color }} />
                    <span className="outcome-split-name">{item.label}</span>
                    <span className="outcome-split-value">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {pairComparisons.map((pair) => (
          <div className="metric-ring-card" key={pair.key}>
            <p className="panel-kicker">{pair.title}</p>
            <div className="metric-ring-plot-wrap">
              <Plot
                data={[
                  {
                    labels: [pair.left.label, pair.right.label],
                    values: [pair.left.value, pair.right.value],
                    type: 'pie',
                    hole: 0.74,
                    marker: { colors: [pair.left.color, pair.right.color] },
                    textinfo: 'none',
                    sort: false,
                    direction: 'clockwise',
                    showlegend: false,
                  },
                ]}
                layout={{
                  height: 160,
                  margin: { l: 0, r: 0, t: 0, b: 0 },
                  paper_bgcolor: 'transparent',
                  font: { color: '#e2e8f0' },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '160px' }}
              />
              <div className="metric-ring-center">
                <span className="metric-ring-percent">{pair.leftPercent.toFixed(1)}%</span>
                <span className="metric-ring-label">{pair.left.label}</span>
              </div>
            </div>
            <div className="metric-pair-legend">
              <div className="metric-pair-row">
                <span className="metric-pair-dot" style={{ background: pair.left.color }} />
                <span className="metric-pair-name">{pair.left.label}</span>
                <span className="metric-pair-value">
                  {formatSummaryValue(pair.left.metric, pair.left.value)} • {pair.leftPercent.toFixed(1)}%
                </span>
              </div>
              <div className="metric-pair-row">
                <span className="metric-pair-dot" style={{ background: pair.right.color }} />
                <span className="metric-pair-name">{pair.right.label}</span>
                <span className="metric-pair-value">
                  {formatSummaryValue(pair.right.metric, pair.right.value)} • {pair.rightPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartsComparisonsSection;
