import React, { useEffect } from 'react';
import { DateMode, DateRange, Metric } from '../../types/map';
import DatePickerInput from './DatePickerInput';
import { isMetricAllowedForDateMode, metricOptionsForDateMode } from '../../lib/metricOptions';

type QuickLabel = '7d' | '30d' | 'ytd';

export interface FilterBarProps {
  metric: Metric;
  dateMode: DateMode;
  date: string;
  range: DateRange;
  onMetricChange: (metric: Metric) => void;
  onDateModeChange: (mode: DateMode) => void;
  onDateChange: (date: string) => void;
  onRangeChange: (range: DateRange) => void;
  onQuickRange: (label: QuickLabel) => void;
  onReset: () => void;
}

const quickOptions: { label: string; value: QuickLabel }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: 'YTD', value: 'ytd' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  metric,
  dateMode,
  date,
  range,
  onMetricChange,
  onDateModeChange,
  onDateChange,
  onRangeChange,
  onQuickRange,
  onReset,
}) => {
  const metricOptions = metricOptionsForDateMode(dateMode);

  useEffect(() => {
    if (isMetricAllowedForDateMode(metric, dateMode)) {
      return;
    }
    const fallback = metricOptions[0]?.value;
    if (fallback) {
      onMetricChange(fallback);
    }
  }, [dateMode, metric, metricOptions, onMetricChange]);

  const handleRangeInput = (key: keyof DateRange) =>
    (nextValue: string) => {
      onRangeChange({ ...range, [key]: nextValue });
    };

  const setToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    onDateModeChange('day');
    onDateChange(today);
  };

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label className="filter-label">Metric</label>
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as Metric)}
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
        <div className="mode-toggle" role="group" aria-label="Date mode">
          {(['day', 'range', 'total'] as DateMode[]).map((mode) => (
            <button
              key={mode}
              className={`pill ${dateMode === mode ? 'pill-active' : ''}`}
              onClick={() => onDateModeChange(mode)}
              type="button"
            >
              {mode === 'day' ? 'Single day' : mode === 'range' ? 'Period' : 'Total'}
            </button>
          ))}
        </div>
      </div>

      {dateMode === 'day' ? (
        <div className="filter-group">
          <label className="filter-label">Date</label>
          <DatePickerInput value={date} onChange={onDateChange} />
          <div className="mode-toggle" role="group" aria-label="Single day controls">
            <button type="button" className="pill pill-ghost" onClick={setToday}>
              Today
            </button>
          </div>
        </div>
      ) : dateMode === 'range' ? (
        <div className="filter-group range-group">
          <label className="filter-label">Date range</label>
          <div className="range-inputs">
            <DatePickerInput
              value={range.from}
              maxDate={range.to}
              onChange={handleRangeInput('from')}
            />
            <span className="dash">–</span>
            <DatePickerInput
              value={range.to}
              minDate={range.from}
              onChange={handleRangeInput('to')}
            />
          </div>
          <div className="mode-toggle" role="group" aria-label="Quick ranges">
            {quickOptions.map((btn) => (
              <button
                key={btn.value}
                className="pill pill-ghost"
                onClick={() => onQuickRange(btn.value)}
                type="button"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="filter-group">
          <label className="filter-label">Date range</label>
          <div className="mode-toggle" role="note" aria-label="Total mode">
            <span className="pill pill-ghost">All-time aggregate (without dates)</span>
          </div>
        </div>
      )}

      <div className="filter-group">
        <label className="filter-label">Reset</label>
        <button type="button" className="pill pill-ghost" onClick={onReset}>
          Clear filters
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
