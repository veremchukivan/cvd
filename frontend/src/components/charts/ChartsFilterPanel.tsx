import React from 'react';
import CountrySearchSelect from '../analytics/CountrySearchSelect';
import DatePickerInput from '../filters/DatePickerInput';
import { dateDaysAgo, QuickRangeLabel } from '../../lib/analytics';
import { CountryOption } from '../../types/country';
import { DateMode, DateRange } from '../../types/map';
import { usePreferences } from '../../state/preferences';

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
}) => {
  const { copy } = usePreferences();

  return (
    <div className="charts-filter-shell">
      <div className="charts-filter-grid">
        <div className="charts-filter-card">
          <label className="filter-label">{copy.filters.viewMode}</label>
          <div className="charts-toggle">
            <button
              type="button"
              className={`charts-toggle-btn ${dateMode === 'day' ? 'charts-toggle-btn-active' : ''}`}
              onClick={() => onDateModeChange('day')}
            >
              {copy.filters.singleDay}
            </button>
            <button
              type="button"
              className={`charts-toggle-btn ${dateMode === 'range' ? 'charts-toggle-btn-active' : ''}`}
              onClick={() => onDateModeChange('range')}
            >
              {copy.filters.period}
            </button>
            <button
              type="button"
              className={`charts-toggle-btn ${dateMode === 'total' ? 'charts-toggle-btn-active' : ''}`}
              onClick={() => onDateModeChange('total')}
            >
              {copy.filters.total}
            </button>
          </div>
        </div>

        <div className="charts-filter-card charts-filter-card-date">
          {dateMode === 'day' ? (
            <>
              <label className="filter-label">{copy.filters.dateSnapshot}</label>
              <div className="charts-date-row">
                <DatePickerInput value={date} onChange={onDateChange} inputClassName="charts-date-input" />
                <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(0))}>
                  {copy.filters.today}
                </button>
              </div>
              <div className="charts-chip-row">
                <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(1))}>
                  {copy.filters.yesterday}
                </button>
                <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(7))}>
                  {copy.filters.daysAgo7}
                </button>
                <button type="button" className="charts-chip" onClick={() => onDateChange(dateDaysAgo(30))}>
                  {copy.filters.daysAgo30}
                </button>
              </div>
            </>
          ) : dateMode === 'range' ? (
            <>
              <label className="filter-label">{copy.filters.periodWindow}</label>
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
                  {copy.filters.last7Days}
                </button>
                <button type="button" className="charts-chip" onClick={() => onQuickRange('30d')}>
                  {copy.filters.last30Days}
                </button>
                <button type="button" className="charts-chip" onClick={() => onQuickRange('ytd')}>
                  {copy.filters.ytd}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="filter-label">{copy.filters.periodWindow}</label>
              <div className="charts-chip-row">
                <span className="charts-chip">{copy.filters.allTimeAggregate}</span>
              </div>
            </>
          )}
        </div>

        <div className="charts-filter-card">
          <CountrySearchSelect
            label={copy.filters.country}
            value={countrySearch}
            selectedIso3={countryIso}
            suggestions={countrySuggestions}
            open={countryDropdownOpen}
            onOpenChange={onCountryDropdownOpenChange}
            onValueChange={onCountrySearchChange}
            onSelect={onCountrySelect}
            placeholder={copy.filters.searchCountryPlaceholder}
            toggleAriaLabel={copy.filters.toggleCountryList}
            containerRef={countrySearchRef}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartsFilterPanel;
