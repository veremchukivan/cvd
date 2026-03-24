import React from 'react';
import { usePreferences } from '../../state/preferences';
import { GroupBy, SummaryDataQuality } from '../../types/map';

type DataQualityBadgeProps = {
  quality?: SummaryDataQuality;
  rankGroupBy: GroupBy;
};

const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({ quality, rankGroupBy }) => {
  const { copy } = usePreferences();
  const source = quality?.primarySource || quality?.sources?.[0]?.source || copy.worldwide.unknown;
  const latest = quality?.overallLatest || '—';
  const metrics = quality?.metrics?.join(', ') || '—';
  const scope = rankGroupBy === 'continent' ? copy.worldwide.exportContinents : copy.worldwide.exportCountries;

  return (
    <section className="world-quality-card">
      <div className="chart-header">
        <p className="panel-kicker">{copy.worldwide.dataQuality}</p>
      </div>
      <div className="world-quality-grid">
        <div>
          <p className="world-quality-label">{copy.worldwide.scope}</p>
          <p className="world-quality-value">{scope}</p>
        </div>
        <div>
          <p className="world-quality-label">{copy.worldwide.primarySource}</p>
          <p className="world-quality-value">{source}</p>
        </div>
        <div>
          <p className="world-quality-label">{copy.worldwide.latestUpdate}</p>
          <p className="world-quality-value">{latest}</p>
        </div>
        <div>
          <p className="world-quality-label">{copy.worldwide.metricsUsed}</p>
          <p className="world-quality-value world-quality-metrics">{metrics}</p>
        </div>
      </div>
    </section>
  );
};

export default DataQualityBadge;
