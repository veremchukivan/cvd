import React from 'react';
import { CountryDetailsResponse, SummaryMetric } from '../../types/map';
import { usePreferences } from '../../state/preferences';
import MetricChartCard from './MetricChartCard';

type ChartsMetricCardsSectionProps = {
  selectedCountryName: string;
  cards: Array<{
    metric: SummaryMetric;
    label: string;
    response?: CountryDetailsResponse;
    loading: boolean;
  }>;
};

const ChartsMetricCardsSection: React.FC<ChartsMetricCardsSectionProps> = ({ selectedCountryName, cards }) => {
  const { copy } = usePreferences();

  return (
    <div className="charts-section">
      <div className="charts-section-head">
        <p className="charts-section-kicker">{copy.charts.metricCards}</p>
        <h2 className="charts-section-title">{copy.charts.allTrackedIndicators}</h2>
      </div>
      <div className="chart-block">
        <div className="chart-header">
          <p className="panel-kicker">
            {copy.charts.metricsOverview} • {selectedCountryName}
          </p>
        </div>
        <div className="compare-mini-grid">
          {cards.map((item) => (
            <MetricChartCard
              key={item.metric}
              title={item.label}
              metric={item.metric}
              response={item.response}
              loading={item.loading}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChartsMetricCardsSection;
