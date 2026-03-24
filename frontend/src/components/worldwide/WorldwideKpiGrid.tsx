import React from 'react';
import { formatSummaryValue, summaryMetricLabel } from '../../lib/analytics';
import { usePreferences } from '../../state/preferences';

type WorldwideKpiGridProps = {
  periodLabel: string;
  casesHeadline?: number | null;
  deathsHeadline?: number | null;
  vaccinationsTotalHeadline?: number | null;
  showVaccinationsTotal: boolean;
  activeHeadline?: number | null;
  mortalityHeadline?: number | null;
  totalCases?: number | null;
  totalCasesAsOf?: string | null;
};

const WorldwideKpiGrid: React.FC<WorldwideKpiGridProps> = ({
  periodLabel,
  casesHeadline,
  deathsHeadline,
  vaccinationsTotalHeadline,
  showVaccinationsTotal,
  activeHeadline,
  mortalityHeadline,
  totalCases,
  totalCasesAsOf,
}) => {
  const { copy, locale } = usePreferences();

  return (
    <div className="world-kpi-grid">
      <div className="world-kpi-card">
        <p className="world-kpi-label">{copy.worldwide.newCases}</p>
        <p className="world-kpi-value">{formatSummaryValue('today_cases', casesHeadline, locale)}</p>
        <p className="world-kpi-hint">{periodLabel}</p>
      </div>
      <div className="world-kpi-card">
        <p className="world-kpi-label">{copy.worldwide.newDeaths}</p>
        <p className="world-kpi-value">{formatSummaryValue('today_deaths', deathsHeadline, locale)}</p>
        <p className="world-kpi-hint">{periodLabel}</p>
      </div>
      {showVaccinationsTotal ? (
        <div className="world-kpi-card">
          <p className="world-kpi-label">{summaryMetricLabel('vaccinations_total', locale)}</p>
          <p className="world-kpi-value">
            {formatSummaryValue('vaccinations_total', vaccinationsTotalHeadline, locale)}
          </p>
          <p className="world-kpi-hint">{periodLabel}</p>
        </div>
      ) : null}
      <div className="world-kpi-card">
        <p className="world-kpi-label">{copy.worldwide.activeTotal}</p>
        <p className="world-kpi-value">{formatSummaryValue('active', activeHeadline, locale)}</p>
        <p className="world-kpi-hint">{periodLabel}</p>
      </div>
      <div className="world-kpi-card">
        <p className="world-kpi-label">{summaryMetricLabel('mortality', locale)}</p>
        <p className="world-kpi-value">{formatSummaryValue('mortality', mortalityHeadline, locale)}</p>
        <p className="world-kpi-hint">{periodLabel}</p>
      </div>
      <div className="world-kpi-card">
        <p className="world-kpi-label">{copy.worldwide.totalCases}</p>
        <p className="world-kpi-value">{formatSummaryValue('cases', totalCases, locale)}</p>
        <p className="world-kpi-hint">{totalCasesAsOf || '—'}</p>
      </div>
    </div>
  );
};

export default WorldwideKpiGrid;
