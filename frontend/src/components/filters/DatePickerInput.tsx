import React from 'react';
import { formatISO, parseISO } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type DatePickerInputProps = {
  value: string;
  onChange: (nextIsoDate: string) => void;
  minDate?: string;
  maxDate?: string;
  inputClassName?: string;
  wrapperClassName?: string;
  calendarClassName?: string;
  popperClassName?: string;
};

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  inputClassName = 'date-input',
  wrapperClassName = 'app-datepicker-wrapper',
  calendarClassName = 'app-datepicker-calendar',
  popperClassName = 'app-datepicker-popper',
}) => (
  <DatePicker
    selected={toDate(value)}
    onChange={(next: Date | null) => {
      if (!next) return;
      onChange(formatISO(next, { representation: 'date' }));
    }}
    dateFormat="yyyy-MM-dd"
    className={inputClassName}
    wrapperClassName={wrapperClassName}
    calendarClassName={calendarClassName}
    popperClassName={popperClassName}
    minDate={toDate(minDate) || undefined}
    maxDate={toDate(maxDate) || undefined}
    showPopperArrow={false}
  />
);

export default DatePickerInput;
