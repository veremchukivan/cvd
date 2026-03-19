import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DatePickerInput from './DatePickerInput';

describe('DatePickerInput', () => {
  it('renders native date input constraints and forwards ISO date changes', () => {
    const onChange = jest.fn();

    render(
      <DatePickerInput
        value="2026-03-18"
        minDate="2026-03-01"
        maxDate="2026-03-31"
        onChange={onChange}
      />
    );

    const input = screen.getByDisplayValue('2026-03-18');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-03-01');
    expect(input).toHaveAttribute('max', '2026-03-31');

    fireEvent.change(input, { target: { value: '2026-03-20' } });

    expect(onChange).toHaveBeenCalledWith('2026-03-20');
  });
});
