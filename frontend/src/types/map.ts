export type Metric =
  | 'cases'
  | 'deaths'
  | 'recovered'
  | 'active'
  | 'tests'
  | 'incidence'
  | 'mortality';

export type TodayMetric = 'today_cases' | 'today_deaths' | 'today_recovered';
export type SummaryMetric = Metric | TodayMetric;

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
      metric: SummaryMetric;
      dateMode: 'day';
      date: string;
    }
  | {
      iso3: string;
      metric: SummaryMetric;
      dateMode: 'range';
      range: DateRange;
    };

export type ValuesByIso3 = Record<string, number>;

export interface CountryTotalsSnapshot {
  cases?: number | null;
  deaths?: number | null;
  recovered?: number | null;
  active?: number | null;
  tests?: number | null;
  incidence?: number | null;
  mortality?: number | null;
  today_cases?: number | null;
  today_deaths?: number | null;
  today_recovered?: number | null;
}

export interface DailyPeakDatum {
  value?: number | null;
  date?: string | null;
}

export interface CountryDailyPeaks {
  cases?: DailyPeakDatum;
  deaths?: DailyPeakDatum;
  recovered?: DailyPeakDatum;
  active?: DailyPeakDatum;
  tests?: DailyPeakDatum;
}

export interface CountryDataCoverage {
  overallLatest?: string | null;
  latestByMetric?: Record<string, string | null>;
}

export interface CountryDetailsResponse {
  iso3: string;
  name?: string | null;
  metric: SummaryMetric;
  headline: number | null;
  series: Array<{ date: string; value: number | null }>;
  average?: number | null;
  max?: number | null;
  from?: string | null;
  to?: string | null;
  date?: string | null;
  totals?: CountryTotalsSnapshot;
  dailyPeaks?: CountryDailyPeaks;
  coverage?: CountryDataCoverage;
  snapshot?: CountryTotalsSnapshot;
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
  metric: SummaryMetric;
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
