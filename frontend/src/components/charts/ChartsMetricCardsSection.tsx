import React from 'react';
import { CountryDetailsResponse, SummaryMetric } from '../../types/map';
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

const ChartsMetricCardsSection: React.FC<ChartsMetricCardsSectionProps> = ({ selectedCountryName, cards }) => (
  <div className="charts-section">
    <div className="charts-section-head">
      <p className="charts-section-kicker">Metric cards</p>
      <h2 className="charts-section-title">All tracked indicators</h2>
    </div>
    <div className="chart-block">
      <div className="chart-header">
        <p className="panel-kicker">Metrics overview • {selectedCountryName}</p>
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

export default ChartsMetricCardsSection;
