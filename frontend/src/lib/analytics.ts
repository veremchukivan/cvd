import { formatISO, startOfYear, subDays } from 'date-fns';
import { CountryDetailsQuery, DateRange, Metric, SummaryMetric } from '../types/map';

export type QuickRangeLabel = '7d' | '30d' | 'ytd';

const summaryMetricLabels: Record<SummaryMetric, string> = {
  today_cases: 'Cases (daily)',
  today_deaths: 'Deaths (daily)',
  today_recovered: 'Recovered (daily)',
  cases: 'Cases',
  deaths: 'Deaths',
  recovered: 'Recovered',
  active: 'Active',
  tests: 'Tests',
  incidence: 'Incidence',
  mortality: 'Mortality (%)',
};

export function metricToSummaryMetric(metric: Metric): SummaryMetric {
  if (metric === 'cases') return 'today_cases';
  if (metric === 'deaths') return 'today_deaths';
  if (metric === 'recovered') return 'today_recovered';
  return metric;
}

export function summaryMetricLabel(metric: SummaryMetric): string {
  return summaryMetricLabels[metric] || metric;
}

export function formatSummaryValue(metric: SummaryMetric, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (metric === 'mortality') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function quickRangeBounds(label: QuickRangeLabel): DateRange {
  const now = new Date();
  const to = formatISO(now, { representation: 'date' });
  if (label === '7d') return { from: formatISO(subDays(now, 6), { representation: 'date' }), to };
  if (label === '30d') return { from: formatISO(subDays(now, 29), { representation: 'date' }), to };
  return { from: formatISO(startOfYear(now), { representation: 'date' }), to };
}

export function dateDaysAgo(days: number): string {
  return formatISO(subDays(new Date(), days), { representation: 'date' });
}

export function maybeBuildCountryQuery(
  iso3: string | null,
  metric: SummaryMetric,
  dateMode: 'day' | 'range',
  date: string,
  range: DateRange
): CountryDetailsQuery | null {
  if (!iso3) return null;
  if (dateMode === 'day') {
    return { iso3, metric, dateMode: 'day', date };
  }
  return { iso3, metric, dateMode: 'range', range };
}

export function buildCountryQuery(
  iso3: string,
  metric: SummaryMetric,
  dateMode: 'day' | 'range',
  date: string,
  range: DateRange
): CountryDetailsQuery {
  if (dateMode === 'day') {
    return { iso3, metric, dateMode: 'day', date };
  }
  return { iso3, metric, dateMode: 'range', range };
}

export function countryMatches(name: string, iso3: string, rawNeedle: string): boolean {
  const needle = rawNeedle.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle) || iso3.toLowerCase().includes(needle);
}
