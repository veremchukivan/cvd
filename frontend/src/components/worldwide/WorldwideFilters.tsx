import React from 'react';
import DatePickerInput from '../filters/DatePickerInput';
import { QuickRangeLabel } from '../../lib/analytics';
import { DateMode, DateRange, Metric } from '../../types/map';

type WorldwideFiltersProps = {
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  rankMetric: Metric;
  rankMetricOptions: Array<{ value: Metric; label: string }>;
  onRankMetricChange: (metric: Metric) => void;
  onQuickRange: (label: QuickRangeLabel) => void;
};

const WorldwideFilters: React.FC<WorldwideFiltersProps> = ({
  dateMode,
  onDateModeChange,
  date,
  onDateChange,
  range,
  onRangeChange,
  rankMetric,
  rankMetricOptions,
  onRankMetricChange,
  onQuickRange,
}) => (
  <div className="filter-bar world-filter-bar">
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
        <button
          type="button"
          className={`pill ${dateMode === 'total' ? 'pill-active' : ''}`}
          onClick={() => onDateModeChange('total')}
        >
          Total
        </button>
      </div>
    </div>

    {dateMode === 'day' ? (
      <div className="filter-group">
        <label className="filter-label">Date</label>
        <DatePickerInput value={date} onChange={onDateChange} />
      </div>
    ) : dateMode === 'range' ? (
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
    ) : (
      <div className="filter-group">
        <label className="filter-label">Date range</label>
        <div className="mode-toggle">
          <span className="pill pill-ghost">All-time aggregate (without dates)</span>
        </div>
      </div>
    )}

    <div className="filter-group">
      <label className="filter-label">Ranking metric</label>
      <select
        value={rankMetric}
        onChange={(event) => onRankMetricChange(event.target.value as Metric)}
        className="filter-select"
      >
        {rankMetricOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default WorldwideFilters;
