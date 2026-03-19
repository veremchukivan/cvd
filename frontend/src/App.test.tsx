import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./pages/MapView', () => () => (
  <section>
    <h1>COVID 3D Atlas</h1>
    <label htmlFor="from-date">From date</label>
    <input id="from-date" />
    <span>Map mode</span>
  </section>
));

jest.mock('./pages/ChartsView', () => () => <section>Charts view</section>);
jest.mock('./pages/CompareView', () => () => <section>Compare view</section>);
jest.mock('./pages/WorldwideView', () => () => <section>Worldwide view</section>);
jest.mock('./pages/AboutView', () => () => <section>About view</section>);
jest.mock('./pages/FaqView', () => () => <section>FAQ view</section>);

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('renders map view with filters', () => {
    render(<App />);

    expect(screen.getByText(/COVID 3D Atlas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/From date/i)).toBeInTheDocument();
    expect(screen.getByText(/Map mode/i)).toBeInTheDocument();
  });

  it('switches theme and persists it', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /White theme/i }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'ivory');
    expect(window.localStorage.getItem('cvd-theme-mode')).toBe('ivory');
  });
});
