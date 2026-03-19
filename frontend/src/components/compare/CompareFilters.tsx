import React from 'react';
import DatePickerInput from '../filters/DatePickerInput';
import { QuickRangeLabel } from '../../lib/analytics';
import { DateMode, DateRange, Metric } from '../../types/map';
import { usePreferences } from '../../state/preferences';

type CompareFiltersProps = {
  metric: Metric;
  metricOptions: Array<{ value: Metric; label: string }>;
  onMetricChange: (metric: Metric) => void;
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
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
}) => {
  const { copy } = usePreferences();

  return (
    <div className="filter-bar compare-filter-bar">
      <div className="filter-group">
        <label className="filter-label">{copy.filters.metric}</label>
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
        <label className="filter-label">{copy.filters.viewMode}</label>
        <div className="mode-toggle">
          <button
            type="button"
            className={`pill ${dateMode === 'day' ? 'pill-active' : ''}`}
            onClick={() => onDateModeChange('day')}
          >
            {copy.filters.singleDay}
          </button>
          <button
            type="button"
            className={`pill ${dateMode === 'range' ? 'pill-active' : ''}`}
            onClick={() => onDateModeChange('range')}
          >
            {copy.filters.period}
          </button>
          <button
            type="button"
            className={`pill ${dateMode === 'total' ? 'pill-active' : ''}`}
            onClick={() => onDateModeChange('total')}
          >
            {copy.filters.total}
          </button>
        </div>
      </div>

      {dateMode === 'day' ? (
        <div className="filter-group">
          <label className="filter-label">{copy.filters.date}</label>
          <DatePickerInput value={date} onChange={onDateChange} />
        </div>
      ) : dateMode === 'range' ? (
        <div className="filter-group range-group">
          <label className="filter-label">{copy.filters.dateRange}</label>
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
              {copy.filters.ytd}
            </button>
          </div>
        </div>
      ) : (
        <div className="filter-group">
          <label className="filter-label">{copy.filters.dateRange}</label>
          <div className="mode-toggle">
            <span className="pill pill-ghost">{copy.filters.allTimeAggregate}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
};

export default CompareFilters;
