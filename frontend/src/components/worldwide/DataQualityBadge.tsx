import React from 'react';
import { GroupBy, SummaryDataQuality } from '../../types/map';

type DataQualityBadgeProps = {
  quality?: SummaryDataQuality;
  rankGroupBy: GroupBy;
};

const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({ quality, rankGroupBy }) => {
  const source = quality?.primarySource || quality?.sources?.[0]?.source || 'Unknown';
  const latest = quality?.overallLatest || '—';
  const metrics = quality?.metrics?.join(', ') || '—';
  const scope = rankGroupBy === 'continent' ? 'Continents' : 'Countries';

  return (
    <section className="world-quality-card">
      <div className="chart-header">
        <p className="panel-kicker">Data quality</p>
      </div>
      <div className="world-quality-grid">
        <div>
          <p className="world-quality-label">Scope</p>
          <p className="world-quality-value">{scope}</p>
        </div>
        <div>
          <p className="world-quality-label">Primary source</p>
          <p className="world-quality-value">{source}</p>
        </div>
        <div>
          <p className="world-quality-label">Latest update</p>
          <p className="world-quality-value">{latest}</p>
        </div>
        <div>
          <p className="world-quality-label">Metrics used</p>
          <p className="world-quality-value world-quality-metrics">{metrics}</p>
        </div>
      </div>
    </section>
  );
};

export default DataQualityBadge;
