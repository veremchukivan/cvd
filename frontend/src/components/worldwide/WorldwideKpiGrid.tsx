import React from 'react';
import { formatSummaryValue } from '../../lib/analytics';

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
}) => (
  <div className="world-kpi-grid">
    <div className="world-kpi-card">
      <p className="world-kpi-label">New cases</p>
      <p className="world-kpi-value">{formatSummaryValue('today_cases', casesHeadline)}</p>
      <p className="world-kpi-hint">{periodLabel}</p>
    </div>
    <div className="world-kpi-card">
      <p className="world-kpi-label">New deaths</p>
      <p className="world-kpi-value">{formatSummaryValue('today_deaths', deathsHeadline)}</p>
      <p className="world-kpi-hint">{periodLabel}</p>
    </div>
    {showVaccinationsTotal ? (
      <div className="world-kpi-card">
        <p className="world-kpi-label">Vaccinations (total)</p>
        <p className="world-kpi-value">{formatSummaryValue('vaccinations_total', vaccinationsTotalHeadline)}</p>
        <p className="world-kpi-hint">{periodLabel}</p>
      </div>
    ) : null}
    <div className="world-kpi-card">
      <p className="world-kpi-label">Active (total)</p>
      <p className="world-kpi-value">{formatSummaryValue('active', activeHeadline)}</p>
      <p className="world-kpi-hint">{periodLabel}</p>
    </div>
    <div className="world-kpi-card">
      <p className="world-kpi-label">Mortality</p>
      <p className="world-kpi-value">{formatSummaryValue('mortality', mortalityHeadline)}</p>
      <p className="world-kpi-hint">{periodLabel}</p>
    </div>
    <div className="world-kpi-card">
      <p className="world-kpi-label">Total cases</p>
      <p className="world-kpi-value">{formatSummaryValue('cases', totalCases)}</p>
      <p className="world-kpi-hint">{totalCasesAsOf || '—'}</p>
    </div>
  </div>
);

export default WorldwideKpiGrid;
