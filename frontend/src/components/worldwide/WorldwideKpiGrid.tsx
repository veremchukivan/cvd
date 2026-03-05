import React from 'react';
import { formatSummaryValue } from '../../lib/analytics';

type WorldwideKpiGridProps = {
  periodLabel: string;
  casesHeadline?: number | null;
  deathsHeadline?: number | null;
  vaccinationsHeadline?: number | null;
  activeHeadline?: number | null;
  mortalityHeadline?: number | null;
  totalCases?: number | null;
  totalCasesAsOf?: string | null;
};

const WorldwideKpiGrid: React.FC<WorldwideKpiGridProps> = ({
  periodLabel,
  casesHeadline,
  deathsHeadline,
  vaccinationsHeadline,
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
    <div className="world-kpi-card">
      <p className="world-kpi-label">Vaccinations (daily)</p>
      <p className="world-kpi-value">{formatSummaryValue('today_vaccinations', vaccinationsHeadline)}</p>
      <p className="world-kpi-hint">{periodLabel}</p>
    </div>
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
