import React from 'react';

interface LegendProps {
  maxValue: number;
  metricLabel: string;
}

const SCALE_COLORS = [
  'hsl(210,75%,60%)',
  'hsl(160,75%,55%)',
  'hsl(100,75%,50%)',
  'hsl(40,75%,45%)',
  'hsl(30,75%,40%)',
];

const TICK_RATIOS = [0, 0.25, 0.5, 0.75, 1];

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  if (value >= 1000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (value >= 100) {
    return Math.round(value).toLocaleString('en-US');
  }

  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

export const Legend: React.FC<LegendProps> = ({ maxValue, metricLabel }) => {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const ticks = TICK_RATIOS.map((ratio) => safeMax * ratio);

  return (
    <div className="legend">
      <div className="legend-head">
        <p className="legend-metric">{metricLabel}</p>
        <p className="legend-range">0 - {formatLegendValue(safeMax)}</p>
      </div>

      <div className="legend-scale" aria-hidden>
        {SCALE_COLORS.map((color) => (
          <span key={color} className="legend-stop" style={{ background: color }} />
        ))}
      </div>

      <div className="legend-labels legend-labels-numeric">
        {ticks.map((value, index) => (
          <span key={`${index}-${value}`}>{formatLegendValue(value)}</span>
        ))}
      </div>

      <div className="legend-statuses">
        <div className="legend-status">
          <span className="legend-no-data-swatch" aria-hidden />
          <span>No data</span>
        </div>
        <div className="legend-status">
          <span className="legend-selected-swatch" aria-hidden />
          <span>Selected country</span>
        </div>
      </div>
    </div>
  );
};

export default Legend;
