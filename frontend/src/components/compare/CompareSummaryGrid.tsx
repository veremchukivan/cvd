import React from 'react';
import { formatSummaryValue, summaryMetricLabel } from '../../lib/analytics';
import { usePreferences } from '../../state/preferences';
import { SummaryMetric } from '../../types/map';

type CompareSummaryGridProps = {
  summaryMetric: SummaryMetric;
  primaryName: string;
  primaryHeadline?: number | null;
  compareName?: string;
  compareIso: string | null;
  compareHeadline?: number | null;
  periodLabel: string;
};

const CompareSummaryGrid: React.FC<CompareSummaryGridProps> = ({
  summaryMetric,
  primaryName,
  primaryHeadline,
  compareName,
  compareIso,
  compareHeadline,
  periodLabel,
}) => {
  const { copy } = usePreferences();

  return (
    <div className="compare-summary-grid">
      <div className="stat-tile">
        <p className="stat-label">{primaryName}</p>
        <p className="stat-value">{formatSummaryValue(summaryMetric, primaryHeadline)}</p>
        <p className="stat-hint">{summaryMetricLabel(summaryMetric)} • {periodLabel}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{compareName || copy.compare.compareCountry}</p>
        <p className="stat-value">{formatSummaryValue(summaryMetric, compareHeadline)}</p>
        <p className="stat-hint">
          {compareIso
            ? `${summaryMetricLabel(summaryMetric)} • ${periodLabel}`
            : copy.compare.selectSecondCountry}
        </p>
      </div>
    </div>
  );
};

export default CompareSummaryGrid;
