import { useEffect, useState } from 'react';
import { fetchCountryChart } from '../api/map';
import { Metric } from '../types/map';

interface UseCountryChartResult {
  chartUrl: string | null;
  loading: boolean;
  error: string | null;
}

export function useCountryChart(iso?: string, metric: Metric = 'cases'): UseCountryChartResult {
  const [chartUrl, setChartUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) {
      setChartUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);

    fetchCountryChart(iso, metric)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setChartUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Unable to load chart';
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [iso, metric]);

  return { chartUrl, loading, error };
}
