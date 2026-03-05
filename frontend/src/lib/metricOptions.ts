import { DateMode, Metric } from '../types/map';

export type MetricOption = {
  label: string;
  value: Metric;
};

const DAY_METRIC_OPTIONS: MetricOption[] = [
  { label: 'Cases (daily)', value: 'cases' },
  { label: 'Deaths (daily)', value: 'deaths' },
  { label: 'Recovered (daily)', value: 'recovered' },
  { label: 'Mortality (%)', value: 'mortality' },
];

const RANGE_TOTAL_EXTRA_OPTIONS: MetricOption[] = [
  { label: 'Vaccinations (daily)', value: 'vaccinations_total' },
  { label: 'Active', value: 'active' },
  { label: 'Tests', value: 'tests' },
];

const RANGE_METRIC_OPTIONS: MetricOption[] = [
  ...DAY_METRIC_OPTIONS,
  ...RANGE_TOTAL_EXTRA_OPTIONS,
];

const TOTAL_METRIC_OPTIONS: MetricOption[] = RANGE_METRIC_OPTIONS;

export function metricOptionsForDateMode(dateMode: DateMode): MetricOption[] {
  if (dateMode === 'day') {
    return DAY_METRIC_OPTIONS;
  }
  if (dateMode === 'range') {
    return RANGE_METRIC_OPTIONS;
  }
  return TOTAL_METRIC_OPTIONS;
}

export function isMetricAllowedForDateMode(metric: Metric, dateMode: DateMode): boolean {
  return metricOptionsForDateMode(dateMode).some((item) => item.value === metric);
}
