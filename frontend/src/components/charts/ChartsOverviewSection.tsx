import React from 'react';
import { formatSummaryValue } from '../../lib/analytics';
import { usePreferences } from '../../state/preferences';

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
}) => {
  const { copy, locale } = usePreferences();

  return (
    <div className="charts-section">
      <div className="charts-section-head">
        <p className="charts-section-kicker">{copy.charts.snapshot}</p>
        <h2 className="charts-section-title">{copy.charts.countryOverview}</h2>
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
          <p className="stat-label">{copy.charts.peakDailyCases}</p>
          <p className="country-insight-value">{formatSummaryValue('today_cases', casesPeak?.value, locale)}</p>
          <p className="stat-hint">{casesPeak?.date || copy.charts.noPeakData}</p>
        </div>
        <div className="country-insight-card">
          <p className="stat-label">{copy.charts.peakDailyDeaths}</p>
          <p className="country-insight-value">{formatSummaryValue('today_deaths', deathsPeak?.value, locale)}</p>
          <p className="stat-hint">{deathsPeak?.date || copy.charts.noPeakData}</p>
        </div>
        <div className="country-insight-card">
          <p className="stat-label">{copy.charts.peakMortality}</p>
          <p className="country-insight-value">{formatSummaryValue('mortality', mortalityPeak?.value, locale)}</p>
          <p className="stat-hint">{mortalityPeak?.date || copy.charts.noPeakData}</p>
        </div>
      </div>
    </div>
  );
};

export default ChartsOverviewSection;
