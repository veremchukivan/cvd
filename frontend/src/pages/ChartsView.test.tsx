import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChartsView from './ChartsView';
import { PreferencesProvider } from '../state/preferences';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import { findCountryIso3ByCoordinates, guessCountryIso3FromBrowser } from '../lib/geoCountry';

jest.mock('../api/map', () => ({
  __esModule: true,
  fetchSummary: jest.fn(),
  fetchCountryDetails: jest.fn(),
}));

jest.mock('../lib/geoCountry', () => ({
  __esModule: true,
  findCountryIso3ByCoordinates: jest.fn(),
  guessCountryIso3FromBrowser: jest.fn(),
}));

jest.mock('../components/charts/ChartsFilterPanel', () => ({
  __esModule: true,
  default: (props: { countryIso: string | null; countrySearch: string }) => (
    <section>
      <div data-testid="selected-country">{props.countryIso || 'none'}</div>
      <div data-testid="country-search">{props.countrySearch || 'none'}</div>
    </section>
  ),
}));

jest.mock('../components/charts/ChartsOverviewSection', () => ({
  __esModule: true,
  default: () => <section>Overview</section>,
}));

jest.mock('../components/charts/ChartsCustomSection', () => ({
  __esModule: true,
  default: () => <section>Custom</section>,
}));

jest.mock('../components/charts/ChartsMetricCardsSection', () => ({
  __esModule: true,
  default: () => <section>Metric cards</section>,
}));

jest.mock('../components/charts/ChartsDynamicsSection', () => ({
  __esModule: true,
  default: () => <section>Dynamics</section>,
}));

jest.mock('../components/charts/ChartsComparisonsSection', () => ({
  __esModule: true,
  default: () => <section>Comparisons</section>,
}));

const mockedFetchSummary = fetchSummary as jest.MockedFunction<typeof fetchSummary>;
const mockedFetchCountryDetails = fetchCountryDetails as jest.MockedFunction<typeof fetchCountryDetails>;
const mockedFindCountryIso3ByCoordinates =
  findCountryIso3ByCoordinates as jest.MockedFunction<typeof findCountryIso3ByCoordinates>;
const mockedGuessCountryIso3FromBrowser =
  guessCountryIso3FromBrowser as jest.MockedFunction<typeof guessCountryIso3FromBrowser>;

function renderChartsView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <ChartsView />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

describe('ChartsView geolocation consent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';

    mockedFetchSummary.mockResolvedValue({
      data: [
        { isoCode: 'USA', name: 'United States', value: 1 },
        { isoCode: 'SVK', name: 'Slovakia', value: 1 },
      ],
      metric: 'cases',
      from: '2026-03-01',
      to: '2026-03-29',
    });
    mockedFetchCountryDetails.mockImplementation(async (query) => ({
      iso3: query.iso3,
      metric: query.metric,
      headline: 0,
      series: [],
    }));
    mockedFindCountryIso3ByCoordinates.mockReset();
    mockedGuessCountryIso3FromBrowser.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses browser fallback when site-level geolocation consent is declined', async () => {
    const getCurrentPosition = jest.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    mockedGuessCountryIso3FromBrowser.mockReturnValue('SVK');

    renderChartsView();

    expect(
      await screen.findByRole('dialog', { name: /share your location with this page/i })
    ).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /continue without geolocation/i }));

    await waitFor(() => expect(screen.getByTestId('selected-country')).toHaveTextContent('SVK'));
    expect(screen.getByTestId('country-search')).toHaveTextContent('Slovakia');
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(mockedGuessCountryIso3FromBrowser).toHaveBeenCalled();
    expect(mockedFindCountryIso3ByCoordinates).not.toHaveBeenCalled();
  });

  it('requests browser geolocation only after site-level consent is accepted', async () => {
    const getCurrentPosition = jest.fn((success: (position: GeolocationPosition) => void) => {
      const position = {
        coords: {
          latitude: 48.1486,
          longitude: 17.1077,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        } as GeolocationCoordinates,
        timestamp: Date.now(),
      } as GeolocationPosition;

      success(position);
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    mockedGuessCountryIso3FromBrowser.mockReturnValue('USA');
    mockedFindCountryIso3ByCoordinates.mockResolvedValue('SVK');

    renderChartsView();

    expect(
      await screen.findByRole('dialog', { name: /share your location with this page/i })
    ).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /allow geolocation/i }));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('selected-country')).toHaveTextContent('SVK'));
    expect(screen.getByTestId('country-search')).toHaveTextContent('Slovakia');
    expect(mockedFindCountryIso3ByCoordinates).toHaveBeenCalledWith(48.1486, 17.1077);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
