import React from 'react';
import CountrySearchSelect from '../analytics/CountrySearchSelect';
import DatePickerInput from '../filters/DatePickerInput';
import { dateDaysAgo, QuickRangeLabel } from '../../lib/analytics';
import { CountryOption } from '../../types/country';
import { DateMode, DateRange } from '../../types/map';

type ChartsFilterPanelProps = {
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onQuickRange: (label: QuickRangeLabel) => void;
  countryIso: string | null;
  countrySearch: string;
  onCountrySearchChange: (value: string) => void;
  countrySuggestions: CountryOption[];
  countryDropdownOpen: boolean;
  onCountryDropdownOpenChange: (open: boolean) => void;
  onCountrySelect: (iso3: string | null, name?: string) => void;
  countrySearchRef: React.RefObject<HTMLDivElement | null>;
};

const ChartsFilterPanel: React.FC<ChartsFilterPanelProps> = ({
  dateMode,
  onDateModeChange,
  date,
  onDateChange,
  range,
  onRangeChange,
  onQuickRange,
  countryIso,
  countrySearch,
  onCountrySearchChange,
  countrySuggestions,
  countryDropdownOpen,
  onCountryDropdownOpenChange,
  onCountrySelect,
  countrySearchRef,
}) => (
  <div className="charts-filter-shell">
    <div className="charts-filter-grid">
      <div className="charts-filter-card">
        <label className="filter-label">View mode</label>
        <div className="charts-toggle">
          <button
            type="button"
            className={`charts-toggle-btn ${dateMode === 'day' ? 'charts-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('day')}
          >
            Single day
          </button>
          <button
            type="button"
            className={`charts-toggle-btn ${dateMode === 'range' ? 'charts-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('range')}
          >
            Period
          </button>
          <button
            type="button"
            className={`charts-toggle-btn ${dateMode === 'total' ? 'charts-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('total')}
          >
            Total
          </button>
        </div>
      </div>

      <div className="charts-filter-card charts-filter-card-date">
        {dateMode === 'day' ? (
          <>
            <label className="filter-label">Date snapshot</label>
            <div className="charts-date-row">
              <DatePickerInput value={date} onChange={onDateChange} inputClassName="charts-date-input" />
              <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(0))}>
                Today
              </button>
            </div>
            <div className="charts-chip-row">
              <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(1))}>
                Yesterday
              </button>
              <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(7))}>
                7d ago
              </button>
              <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(30))}>
                30d ago
              </button>
            </div>
          </>
        ) : dateMode === 'range' ? (
          <>
            <label className="filter-label">Period window</label>
            <div className="charts-date-range-row">
              <DatePickerInput
                value={range.from}
                maxDate={range.to}
                onChange={(nextIso) => onRangeChange({ ...range, from: nextIso })}
                inputClassName="charts-date-input"
              />
              <span className="charts-range-sep">→</span>
              <DatePickerInput
                value={range.to}
                minDate={range.from}
                onChange={(nextIso) => onRangeChange({ ...range, to: nextIso })}
                inputClassName="charts-date-input"
              />
            </div>
            <div className="charts-chip-row">
              <button type="button" className="charts-chip" onClick={() => onQuickRange('7d')}>
                Last 7 days
              </button>
              <button type="button" className="charts-chip" onClick={() => onQuickRange('30d')}>
                Last 30 days
              </button>
              <button type="button" className="charts-chip" onClick={() => onQuickRange('ytd')}>
                YTD
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="filter-label">Period window</label>
            <div className="charts-chip-row">
              <span className="charts-chip">All-time aggregate (without dates)</span>
            </div>
          </>
        )}
      </div>

      <div className="charts-filter-card">
        <CountrySearchSelect
          label="Country"
          value={countrySearch}
          selectedIso3={countryIso}
          suggestions={countrySuggestions}
          open={countryDropdownOpen}
          onOpenChange={onCountryDropdownOpenChange}
          onValueChange={onCountrySearchChange}
          onSelect={onCountrySelect}
          placeholder="Search country or open list..."
          toggleAriaLabel="Toggle country list"
          containerRef={countrySearchRef}
        />
      </div>
    </div>
  </div>
);

export default ChartsFilterPanel;
