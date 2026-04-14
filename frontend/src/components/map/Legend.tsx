import React from 'react';
import { formatNumericValue } from '../../lib/i18n';
import { CHOROPLETH_TICKS, choroplethLegendColor, choroplethValueAtTick } from '../../lib/colors';
import { usePreferences } from '../../state/preferences';

interface LegendProps {
  maxValue: number;
  metricLabel: string;
}

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  if (value >= 1000) {
    return formatNumericValue(value, undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }

  if (value >= 100) {
    return formatNumericValue(Math.round(value));
  }

  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

export const Legend: React.FC<LegendProps> = ({ maxValue, metricLabel }) => {
  const { copy } = usePreferences();
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const ticks = CHOROPLETH_TICKS.map((tick) => ({
    tick,
    value: choroplethValueAtTick(tick, safeMax),
  }));

  return (
    <div className="legend">
      <div className="legend-head">
        <p className="legend-metric">{metricLabel}</p>
        <p className="legend-range">0 - {formatLegendValue(safeMax)}</p>
      </div>

      <div className="legend-scale" aria-hidden>
        {ticks.map(({ tick }) => (
          <span
            key={tick}
            className="legend-stop"
            style={{ background: choroplethLegendColor(tick, safeMax) }}
          />
        ))}
      </div>

      <div className="legend-labels legend-labels-numeric">
        {ticks.map(({ tick, value }) => (
          <span key={`${tick}-${value}`}>{formatLegendValue(value)}</span>
        ))}
      </div>

      <div className="legend-statuses">
        <div className="legend-status">
          <span className="legend-no-data-swatch" aria-hidden />
          <span>{copy.map.legendNoData}</span>
        </div>
        <div className="legend-status">
          <span className="legend-selected-swatch" aria-hidden />
          <span>{copy.map.legendSelectedCountry}</span>
        </div>
      </div>
    </div>
  );
};

export default Legend;
