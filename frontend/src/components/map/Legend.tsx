import React from 'react';

interface LegendProps {
  maxValue: number;
  metricLabel: string;
}

export const Legend: React.FC<LegendProps> = ({ maxValue, metricLabel }) => {
  return (
    <div className="legend">
      <div className="legend-scale" aria-hidden>
        <span className="legend-stop" style={{ background: 'hsl(210,75%,60%)' }} />
        <span className="legend-stop" style={{ background: 'hsl(160,75%,55%)' }} />
        <span className="legend-stop" style={{ background: 'hsl(100,75%,50%)' }} />
        <span className="legend-stop" style={{ background: 'hsl(40,75%,45%)' }} />
        <span className="legend-stop" style={{ background: 'hsl(30,75%,40%)' }} />
      </div>
      <div className="legend-labels">
        <span>Low</span>
        <span>{maxValue ? `High (≈ ${Math.round(maxValue)})` : 'High'}</span>
      </div>
      <div className="legend-no-data">
        <span className="legend-no-data-swatch" aria-hidden />
        <span>No data</span>
      </div>
      <p className="legend-metric">{metricLabel}</p>
    </div>
  );
};

export default Legend;
