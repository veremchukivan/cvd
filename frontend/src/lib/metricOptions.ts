import { DateMode, Metric } from '../types/map';
import { LocaleCode, metricOptionLabel } from './i18n';

export type MetricOption = {
  label: string;
  value: Metric;
};

const DAY_METRICS: Metric[] = ['cases', 'deaths', 'recovered', 'mortality'];
const RANGE_EXTRA_METRICS: Metric[] = ['active', 'tests'];
const TOTAL_EXTRA_METRICS: Metric[] = ['vaccinations_total', ...RANGE_EXTRA_METRICS];

function buildMetricOptions(metrics: Metric[], locale?: LocaleCode): MetricOption[] {
  return metrics.map((value) => ({
    value,
    label: metricOptionLabel(value, locale),
  }));
}

export function metricOptionsForDateMode(dateMode: DateMode, locale?: LocaleCode): MetricOption[] {
  if (dateMode === 'day') {
    return buildMetricOptions(DAY_METRICS, locale);
  }
  if (dateMode === 'range') {
    return buildMetricOptions([...DAY_METRICS, ...RANGE_EXTRA_METRICS], locale);
  }
  return buildMetricOptions([...DAY_METRICS, ...TOTAL_EXTRA_METRICS], locale);
}

export function isMetricAllowedForDateMode(metric: Metric, dateMode: DateMode, locale?: LocaleCode): boolean {
  return metricOptionsForDateMode(dateMode, locale).some((item) => item.value === metric);
}
