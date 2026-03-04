import { useEffect, useMemo, useState } from 'react';
import { fetchSummary } from '../api/map';
import { DateRange, Metric, SummaryDatum } from '../types/map';

interface UseSummaryDataResult {
  data: SummaryDatum[];
  loading: boolean;
  error: string | null;
  maxValue: number;
}

export function useSummaryData(metric: Metric, dateRange: DateRange): UseSummaryDataResult {
  const [data, setData] = useState<SummaryDatum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchSummary({ metric, ...dateRange })
      .then((res) => {
        if (!active) return;
        setData(res.data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Failed to load summary';
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [metric, dateRange.from, dateRange.to]);

  const maxValue = useMemo(() => {
    if (!data.length) return 0;
    return Math.max(...data.map((item) => item.value ?? 0));
  }, [data]);

  return { data, loading, error, maxValue };
}
