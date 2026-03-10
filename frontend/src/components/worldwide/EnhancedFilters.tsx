import React from 'react';
import DatePickerInput from '../filters/DatePickerInput';
import { QuickRangeLabel } from '../../lib/analytics';
import { DateMode, DateRange, Metric } from '../../types/map';
import { metricOptionsForDateMode } from '../../lib/metricOptions';
import './EnhancedFilters.css';

type WorldwideFiltersProps = {
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onQuickRange: (label: QuickRangeLabel) => void;
  rankMetric: Metric;
  rankMetricOptions: Array<{ value: Metric; label: string }>;
  onRankMetricChange: (metric: Metric) => void;
};

const WorldwideFilters: React.FC<WorldwideFiltersProps> = ({
  dateMode,
  onDateModeChange,
  date,
  onDateChange,
  range,
  onRangeChange,
  onQuickRange,
  rankMetric,
  rankMetricOptions,
  onRankMetricChange,
}) => (
  <div className="worldwide-filter-shell">
    <div className="worldwide-filter-grid">
      {/* View Mode */}
      <div className="worldwide-filter-card">
        <label className="filter-label">View mode</label>
        <div className="worldwide-toggle">
          <button
            type="button"
            className={`worldwide-toggle-btn ${dateMode === 'day' ? 'worldwide-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('day')}
          >
            Day
          </button>
          <button
            type="button"
            className={`worldwide-toggle-btn ${dateMode === 'range' ? 'worldwide-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('range')}
          >
            Range
          </button>
          <button
            type="button"
            className={`worldwide-toggle-btn ${dateMode === 'total' ? 'worldwide-toggle-btn-active' : ''}`}
            onClick={() => onDateModeChange('total')}
          >
            Total
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="worldwide-filter-card">
        {dateMode === 'day' ? (
          <>
            <label className="filter-label">Date snapshot</label>
            <DatePickerInput value={date} onChange={onDateChange} />
          </>
        ) : dateMode === 'range' ? (
          <>
            <label className="filter-label">Period window</label>
            <div className="worldwide-date-range-row">
              <DatePickerInput
                value={range.from}
                maxDate={range.to}
                onChange={(nextIso) => onRangeChange({ ...range, from: nextIso })}
              />
              <span className="dash">–</span>
              <DatePickerInput
                value={range.to}
                minDate={range.from}
                onChange={(nextIso) => onRangeChange({ ...range, to: nextIso })}
              />
            </div>
            <div className="worldwide-chip-row">
              <button type="button" className="worldwide-chip" onClick={() => onQuickRange('7d')}>
                7d
              </button>
              <button type="button" className="worldwide-chip" onClick={() => onQuickRange('30d')}>
                30d
              </button>
              <button type="button" className="worldwide-chip" onClick={() => onQuickRange('ytd')}>
                YTD
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="filter-label">Date range</label>
            <span className="pill pill-ghost">All-time aggregate</span>
          </>
        )}
      </div>

      {/* Ranking Metric */}
      <div className="worldwide-filter-card">
        <label className="filter-label">Country ranking</label>
        <select
          value={rankMetric}
          onChange={(e) => onRankMetricChange(e.target.value as Metric)}
          className="filter-select"
        >
          {rankMetricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  </div>
);

export default WorldwideFilters;
