import api from './client';
import { aggregateTimeseries } from '../lib/aggregate';
import {
  CountryDetailsQuery,
  CountryDetailsResponse,
  GroupBy,
  Metric,
  ProvincesSummaryResponse,
  SummaryMetric,
  TodayMetric,
  SummaryDatum,
  SummaryResponse,
  TimeseriesPoint,
} from '../types/map';

export type MapSummaryParams = {
  metric: SummaryMetric;
  date?: string;
  from?: string;
  to?: string;
  groupBy?: GroupBy;
};

export type ProvincesSummaryParams = {
  metric?: Metric;
  date?: string;
  country?: string;
  countryIso?: string;
};

export async function fetchSummary(params: MapSummaryParams): Promise<SummaryResponse> {
  const path = '/map/';
  try {
    const { data } = await api.get<SummaryResponse>(path, { params });
    if (!data?.data) {
      throw new Error('Summary payload missing data');
    }
    return data;
  } catch (error) {
    // Fallback for local dev: aggregate frontend timeseries when API not ready
    const from = 'from' in params ? params.from : params.date;
    const to = 'to' in params ? params.to : params.date;
    const mode = 'date' in params ? 'day' : 'range';
    if (!from || !to) {
      throw error;
    }

    if (params.metric === 'mortality') {
      const [casesSeries, deathsSeries] = await Promise.all([
        fetchTimeseries('cases'),
        fetchTimeseries('deaths'),
      ]);
      const cases = aggregateTimeseries(casesSeries, { from, to, mode });
      const deaths = aggregateTimeseries(deathsSeries, { from, to, mode });
      const deathsByIso = deaths.reduce<Record<string, SummaryDatum>>((acc, item) => {
        acc[item.isoCode] = item;
        return acc;
      }, {});
      const mortality = cases
        .map((item) => {
          const deathsValue = deathsByIso[item.isoCode]?.value ?? 0;
          const casesValue = item.value ?? 0;
          const rate = casesValue > 0 ? Number(((deathsValue / casesValue) * 100).toFixed(2)) : 0;
          return {
            isoCode: item.isoCode,
            name: item.name,
            value: rate,
            delta: undefined,
            average: rate,
            max: rate,
          } satisfies SummaryDatum;
        })
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      return {
        data: mortality,
        metric: params.metric,
        groupBy: params.groupBy,
        from,
        to,
      } satisfies SummaryResponse;
    }

    if (isTodayMetric(params.metric)) {
      const timeseries = await fetchTimeseries(params.metric);
      const aggregated = aggregateTodayTimeseries(timeseries, { from, to, mode });
      return {
        data: aggregated,
        metric: params.metric,
        groupBy: params.groupBy,
        from,
        to,
      } satisfies SummaryResponse;
    }

    const sourceMetric: Metric = params.metric === 'incidence' ? 'cases' : params.metric;
    const timeseries = await fetchTimeseries(sourceMetric);
    const aggregated = aggregateTimeseries(timeseries, { from, to, mode });
    return {
      data: aggregated,
      metric: params.metric,
      groupBy: params.groupBy,
      from,
      to,
    } satisfies SummaryResponse;
  }
}

export async function fetchTimeseries(
  metric: SummaryMetric,
  locationName?: string
): Promise<TimeseriesPoint[]> {
  const requestMetric = metric === 'incidence' ? 'cases' : metric;
  const { data } = await api.get<TimeseriesPoint[]>('/timeseries/', {
    params: { metric: requestMetric, location: locationName },
  });
  return data;
}

function isTodayMetric(metric: SummaryMetric): metric is TodayMetric {
  return (
    metric === 'today_cases' ||
    metric === 'today_deaths' ||
    metric === 'today_recovered' ||
    metric === 'today_vaccinations'
  );
}

function aggregateTodayTimeseries(
  points: TimeseriesPoint[],
  params: { from: string; to: string; mode: 'day' | 'range' }
): SummaryDatum[] {
  const fromDate = new Date(params.from);
  const toDate = new Date(params.to);
  const grouped = points.reduce<Record<string, TimeseriesPoint[]>>((acc, point) => {
    const currentDate = new Date(point.date);
    if (Number.isNaN(currentDate.getTime())) {
      return acc;
    }

    if (params.mode === 'day') {
      if (currentDate > toDate) {
        return acc;
      }
    } else if (currentDate < fromDate || currentDate > toDate) {
      return acc;
    }

    const iso = point.location.iso_code?.toUpperCase();
    if (!iso) {
      return acc;
    }
    if (!acc[iso]) {
      acc[iso] = [];
    }
    acc[iso].push(point);
    return acc;
  }, {});

  const rows = Object.entries(grouped)
    .map<SummaryDatum | null>(([isoCode, series]) => {
      const ordered = [...series].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const values = ordered.map((item) => item.value ?? 0);
      if (!values.length) {
        return null;
      }

      const sum = values.reduce((acc, value) => acc + value, 0);
      const value = params.mode === 'day' ? values[values.length - 1] : sum;
      const average = Number((sum / values.length).toFixed(2));
      const max = Number(Math.max(...values).toFixed(2));

      return {
        isoCode,
        name: ordered[0]?.location.name,
        value: Number(value.toFixed(2)),
        delta: params.mode === 'range' ? Number(value.toFixed(2)) : undefined,
        average,
        max,
      } satisfies SummaryDatum;
    })
    .filter((item): item is SummaryDatum => item !== null);

  return rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

export async function fetchCountryChart(iso: string, metric: Metric): Promise<Blob> {
  const response = await api.get('/charts/country/', {
    params: { iso, metric },
    responseType: 'blob',
  });
  return response.data as Blob;
}

export function buildCountryChartUrl(iso: string, metric: Metric): string {
  const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';
  const url = new URL('/charts/country/', base);
  url.searchParams.set('iso', iso);
  url.searchParams.set('metric', metric);
  return url.toString();
}

export async function fetchCountryDetails(
  query: CountryDetailsQuery
): Promise<CountryDetailsResponse> {
  const { iso3, metric } = query;
  const params =
    query.dateMode === 'day'
      ? { metric, date: query.date }
      : query.dateMode === 'range'
        ? { metric, from: query.range.from, to: query.range.to }
        : { metric };

  const { data } = await api.get<CountryDetailsResponse>(`/country/${iso3}/`, { params });
  return data;
}

export async function fetchProvincesSummary(
  params: ProvincesSummaryParams
): Promise<ProvincesSummaryResponse> {
  const { data } = await api.get<ProvincesSummaryResponse>('/provinces/summary/', {
    params: {
      metric: params.metric ?? 'cases',
      date: params.date,
      country: params.country,
      countryIso: params.countryIso,
    },
  });
  return data;
}
