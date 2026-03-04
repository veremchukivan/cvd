import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Geographies: ({ children }: { children: any }) => <div>{children({ geographies: [] })}</div>,
  Geography: () => <div />,
}));

jest.mock('./hooks/useSummaryData', () => ({
  useSummaryData: () => ({ data: [], loading: false, error: null, maxValue: 0 }),
}));

jest.mock('./hooks/useCountryChart', () => ({
  useCountryChart: () => ({ chartUrl: null, loading: false, error: null }),
}));

describe('App shell', () => {
  it('renders map view with filters', () => {
    render(<App />);

    expect(screen.getByText(/COVID Atlas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/From date/i)).toBeInTheDocument();
    expect(screen.getByText(/Map mode/i)).toBeInTheDocument();
  });
});
