export type Metric =
  | 'cases'
  | 'deaths'
  | 'recovered'
  | 'active'
  | 'tests'
  | 'incidence'
  | 'mortality';

export type MapMode = 'choropleth' | 'markers' | 'heatmap';

export type DateMode = 'day' | 'range';

export type DateRange = {
  from: string; // ISO date (YYYY-MM-DD)
  to: string;   // ISO date (YYYY-MM-DD)
};

export type MapQuery =
  | {
      metric: Metric;
      dateMode: 'day';
      date: string;
    }
  | {
      metric: Metric;
      dateMode: 'range';
      range: DateRange;
    };

export type CountryDetailsQuery =
  | {
      iso3: string;
      metric: Metric;
      dateMode: 'day';
      date: string;
    }
  | {
      iso3: string;
      metric: Metric;
      dateMode: 'range';
      range: DateRange;
    };

export type ValuesByIso3 = Record<string, number>;

export interface CountryDetailsResponse {
  iso3: string;
  name?: string | null;
  metric: Metric;
  headline: number | null;
  series: Array<{ date: string; value: number | null }>;
  average?: number | null;
  max?: number | null;
  from?: string | null;
  to?: string | null;
  date?: string | null;
  snapshot?: {
    cases?: number | null;
    deaths?: number | null;
    recovered?: number | null;
    active?: number | null;
    tests?: number | null;
    incidence?: number | null;
    mortality?: number | null;
  };
}

export interface SummaryDatum {
  isoCode: string;
  name?: string;
  value: number;
  delta?: number;
  average?: number;
  max?: number;
}

export interface SummaryResponse {
  data: SummaryDatum[];
  metric: Metric;
  from: string;
  to: string;
}

export interface ProvinceSummaryDatum {
  code: string;
  name: string;
  country: string;
  countryIso?: string | null;
  date: string;
  metric: string;
  value: number | null;
}

export interface ProvincesSummaryResponse {
  metric: string;
  date?: string | null;
  country?: string | null;
  countryIso?: string | null;
  source: string;
  data: ProvinceSummaryDatum[];
}

export interface TimeseriesPoint {
  date: string;
  metric: string;
  value: number;
  source: string;
  location: {
    iso_code: string;
    name: string;
  };
}

export interface MapViewState {
  metric: Metric;
  dateRange: DateRange;
  mapMode: MapMode;
  selectedCountry?: string;
  panelOpen: boolean;
}
