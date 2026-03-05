import React from 'react';
import { CountryOption } from '../../types/country';

type CountrySearchSelectProps = {
  label: string;
  value: string;
  selectedIso3: string | null;
  suggestions: CountryOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onSelect: (iso3: string | null, name?: string) => void;
  placeholder: string;
  toggleAriaLabel: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showNoneOption?: boolean;
  noneLabel?: string;
};

const CountrySearchSelect: React.FC<CountrySearchSelectProps> = ({
  label,
  value,
  selectedIso3,
  suggestions,
  open,
  onOpenChange,
  onValueChange,
  onSelect,
  placeholder,
  toggleAriaLabel,
  containerRef,
  showNoneOption = false,
  noneLabel = 'None',
}) => (
  <div className="filter-group">
    <label className="filter-label">{label}</label>
    <div className="charts-country-searchbox" ref={containerRef}>
      <div className="charts-country-input-row">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (!suggestions.length) return;
            const first = suggestions[0];
            onSelect(first.iso3, first.name);
            onOpenChange(false);
          }}
          className="charts-select"
          placeholder={placeholder}
        />
        <button
          type="button"
          className="charts-country-toggle"
          onClick={() => onOpenChange(!open)}
          aria-label={toggleAriaLabel}
        >
          ▾
        </button>
      </div>

      {open ? (
        <div className="charts-country-suggest-list" role="listbox">
          {showNoneOption ? (
            <button
              type="button"
              className={`charts-country-suggest-item ${selectedIso3 ? '' : 'charts-country-suggest-item-active'}`}
              onClick={() => {
                onSelect(null);
                onOpenChange(false);
              }}
            >
              <span>{noneLabel}</span>
              <span className="charts-country-suggest-iso">—</span>
            </button>
          ) : null}
          {suggestions.length ? (
            suggestions.map((item) => (
              <button
                key={item.iso3}
                type="button"
                className={`charts-country-suggest-item ${selectedIso3 === item.iso3 ? 'charts-country-suggest-item-active' : ''}`}
                onClick={() => {
                  onSelect(item.iso3, item.name);
                  onOpenChange(false);
                }}
              >
                <span>{item.name}</span>
                <span className="charts-country-suggest-iso">{item.iso3}</span>
              </button>
            ))
          ) : (
            <p className="charts-country-suggest-empty">No countries found</p>
          )}
        </div>
      ) : null}
    </div>
  </div>
);

export default CountrySearchSelect;
