import React from 'react';
import DatePickerInput from '../filters/DatePickerInput';
import { QuickRangeLabel } from '../../lib/analytics';
import { DateRange, Metric } from '../../types/map';

type CompareFiltersProps = {
  metric: Metric;
  metricOptions: Array<{ value: Metric; label: string }>;
  onMetricChange: (metric: Metric) => void;
  dateMode: 'day' | 'range';
  onDateModeChange: (mode: 'day' | 'range') => void;
  date: string;
  onDateChange: (date: string) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onQuickRange: (label: QuickRangeLabel) => void;
  children: React.ReactNode;
};

const CompareFilters: React.FC<CompareFiltersProps> = ({
  metric,
  metricOptions,
  onMetricChange,
  dateMode,
  onDateModeChange,
  date,
  onDateChange,
  range,
  onRangeChange,
  onQuickRange,
  children,
}) => (
  <div className="filter-bar compare-filter-bar">
    <div className="filter-group">
      <label className="filter-label">Metric</label>
      <select
        value={metric}
        onChange={(event) => onMetricChange(event.target.value as Metric)}
        className="filter-select"
      >
        {metricOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>

    <div className="filter-group">
      <label className="filter-label">View mode</label>
      <div className="mode-toggle">
        <button
          type="button"
          className={`pill ${dateMode === 'day' ? 'pill-active' : ''}`}
          onClick={() => onDateModeChange('day')}
        >
          Single day
        </button>
        <button
          type="button"
          className={`pill ${dateMode === 'range' ? 'pill-active' : ''}`}
          onClick={() => onDateModeChange('range')}
        >
          Period
        </button>
      </div>
    </div>

    {dateMode === 'day' ? (
      <div className="filter-group">
        <label className="filter-label">Date</label>
        <DatePickerInput value={date} onChange={onDateChange} />
      </div>
    ) : (
      <div className="filter-group range-group">
        <label className="filter-label">Date range</label>
        <div className="range-inputs">
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
        <div className="mode-toggle">
          <button type="button" className="pill pill-ghost" onClick={() => onQuickRange('7d')}>
            7d
          </button>
          <button type="button" className="pill pill-ghost" onClick={() => onQuickRange('30d')}>
            30d
          </button>
          <button type="button" className="pill pill-ghost" onClick={() => onQuickRange('ytd')}>
            YTD
          </button>
        </div>
      </div>
    )}

    {children}
  </div>
);

export default CompareFilters;
