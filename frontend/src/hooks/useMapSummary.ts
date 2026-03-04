import { useQuery } from '@tanstack/react-query';
import { fetchSummary } from '../api/map';
import { MapQuery, Metric, ValuesByIso3 } from '../types/map';

type UseMapSummaryInput = MapQuery;

type UseMapSummaryResult = {
  valuesByIso3: ValuesByIso3;
  maxValue: number;
  isLoading: boolean;
  isError: boolean;
};

export function useMapSummary(input: UseMapSummaryInput): UseMapSummaryResult {
  const apiMetric = mapMetricToTodayMetric(input.metric);
  const params: Parameters<typeof fetchSummary>[0] =
    input.dateMode === 'day'
      ? { metric: apiMetric, date: input.date }
      : { metric: apiMetric, from: input.range.from, to: input.range.to };

  const query = useQuery({
    queryKey: ['map-summary', params],
    queryFn: async () => {
      const response = await fetchSummary(params);
      const values = response.data.reduce<ValuesByIso3>((acc, item) => {
        if (item.isoCode) {
          acc[item.isoCode.toUpperCase()] = item.value ?? 0;
        }
        return acc;
      }, {});
      const maxValue = response.data.reduce(
        (max, item) => Math.max(max, item.value ?? 0),
        0
      );
      return { valuesByIso3: values, maxValue };
    },
  });

  return {
    valuesByIso3: query.data?.valuesByIso3 || {},
    maxValue: query.data?.maxValue || 0,
    isLoading: query.isPending,
    isError: Boolean(query.error),
  };
}

function mapMetricToTodayMetric(metric: Metric): Parameters<typeof fetchSummary>[0]['metric'] {
  if (metric === 'cases') return 'today_cases';
  if (metric === 'deaths') return 'today_deaths';
  if (metric === 'recovered') return 'today_recovered';
  return metric;
}
