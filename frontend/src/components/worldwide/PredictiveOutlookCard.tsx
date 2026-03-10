import React from 'react';

type SeriesPoint = {
  date: string;
  value: number | null;
};

type Forecast = {
  nextDay: number;
  inSevenDays: number;
  trend: 'up' | 'down' | 'flat';
};

type PredictiveOutlookCardProps = {
  periodLabel: string;
  casesSeries?: SeriesPoint[];
  deathsSeries?: SeriesPoint[];
};

function computeForecast(series?: SeriesPoint[]): Forecast | null {
  if (!series?.length) {
    return null;
  }

  const values = series
    .map((point) => point.value)
    .filter((value): value is number => value !== null && value !== undefined);
  const window = values.slice(-14);
  if (window.length < 3) {
    return null;
  }

  const n = window.length;
  const xMean = (n - 1) / 2;
  const yMean = window.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = index - xMean;
    numerator += dx * (window[index] - yMean);
    denominator += dx * dx;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  const nextDay = Math.max(intercept + slope * n, 0);
  const inSevenDays = Math.max(intercept + slope * (n + 6), 0);
  const absSlope = Math.abs(slope);
  const trend = absSlope < 0.01 ? 'flat' : slope > 0 ? 'up' : 'down';

  return {
    nextDay: Number(nextDay.toFixed(2)),
    inSevenDays: Number(inSevenDays.toFixed(2)),
    trend,
  };
}

function formatValue(value?: number): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function trendLabel(trend: Forecast['trend']): string {
  if (trend === 'up') {
    return 'Uptrend';
  }
  if (trend === 'down') {
    return 'Downtrend';
  }
  return 'Stable';
}

const PredictiveOutlookCard: React.FC<PredictiveOutlookCardProps> = ({
  periodLabel,
  casesSeries,
  deathsSeries,
}) => {
  const casesForecast = computeForecast(casesSeries);
  const deathsForecast = computeForecast(deathsSeries);

  return (
    <section className="world-predict-card">
      <div className="chart-header">
        <p className="panel-kicker">Predictive outlook (beta)</p>
      </div>
      <p className="world-export-hint">Based on linear trend from recent daily values • {periodLabel}</p>
      <div className="world-predict-grid">
        <div className="world-predict-item">
          <p className="world-quality-label">Cases next day</p>
          <p className="world-quality-value">{formatValue(casesForecast?.nextDay)}</p>
          <p className="world-kpi-hint">7d: {formatValue(casesForecast?.inSevenDays)} • {trendLabel(casesForecast?.trend || 'flat')}</p>
        </div>
        <div className="world-predict-item">
          <p className="world-quality-label">Deaths next day</p>
          <p className="world-quality-value">{formatValue(deathsForecast?.nextDay)}</p>
          <p className="world-kpi-hint">7d: {formatValue(deathsForecast?.inSevenDays)} • {trendLabel(deathsForecast?.trend || 'flat')}</p>
        </div>
      </div>
    </section>
  );
};

export default PredictiveOutlookCard;
