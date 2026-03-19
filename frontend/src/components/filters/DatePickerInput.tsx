import React from 'react';

type DatePickerInputProps = {
  value: string;
  onChange: (nextIsoDate: string) => void;
  minDate?: string;
  maxDate?: string;
  inputClassName?: string;
  wrapperClassName?: string;
};

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  inputClassName = 'date-input',
  wrapperClassName = 'app-datepicker-wrapper',
}) => {
  return (
    <div className={wrapperClassName}>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        min={minDate}
        max={maxDate}
      />
    </div>
  );
};

export default DatePickerInput;
