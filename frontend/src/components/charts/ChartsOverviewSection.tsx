import React from 'react';
import { formatSummaryValue } from '../../lib/analytics';

type PeakPoint = {
  date: string;
  value: number;
} | null;

type ChartsOverviewSectionProps = {
  selectedCountryName: string;
  countryIso: string | null;
  periodLabel: string;
  casesPeak: PeakPoint;
  deathsPeak: PeakPoint;
  mortalityPeak: PeakPoint;
};

const ChartsOverviewSection: React.FC<ChartsOverviewSectionProps> = ({
  selectedCountryName,
  countryIso,
  periodLabel,
  casesPeak,
  deathsPeak,
  mortalityPeak,
}) => (
  <div className="charts-section">
    <div className="charts-section-head">
      <p className="charts-section-kicker">Snapshot</p>
      <h2 className="charts-section-title">Country overview</h2>
    </div>
    <div className="compare-summary-grid compare-summary-grid-single">
      <div className="stat-tile">
        <p className="stat-label">{selectedCountryName}</p>
        <p className="stat-value">{countryIso || '—'}</p>
        <p className="stat-hint">{periodLabel}</p>
      </div>
    </div>

    <div className="country-insight-grid">
      <div className="country-insight-card">
        <p className="stat-label">Peak daily cases</p>
        <p className="country-insight-value">{formatSummaryValue('today_cases', casesPeak?.value)}</p>
        <p className="stat-hint">{casesPeak?.date || 'No peak data'}</p>
      </div>
      <div className="country-insight-card">
        <p className="stat-label">Peak daily deaths</p>
        <p className="country-insight-value">{formatSummaryValue('today_deaths', deathsPeak?.value)}</p>
        <p className="stat-hint">{deathsPeak?.date || 'No peak data'}</p>
      </div>
      <div className="country-insight-card">
        <p className="stat-label">Peak mortality</p>
        <p className="country-insight-value">{formatSummaryValue('mortality', mortalityPeak?.value)}</p>
        <p className="stat-hint">{mortalityPeak?.date || 'No peak data'}</p>
      </div>
    </div>
  </div>
);

export default ChartsOverviewSection;
