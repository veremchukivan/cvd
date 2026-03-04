import { SummaryDatum, TimeseriesPoint } from '../types/map';

interface AggregateParams {
  from: string;
  to: string;
  mode?: 'day' | 'range';
}

export function aggregateTimeseries(
  points: TimeseriesPoint[],
  { from, to, mode = 'range' }: AggregateParams
): SummaryDatum[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const grouped = points.reduce<Record<string, TimeseriesPoint[]>>((acc, point) => {
    const currentDate = new Date(point.date);
    if (Number.isNaN(currentDate.getTime())) {
      return acc;
    }
    if (currentDate < fromDate || currentDate > toDate) {
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

  return Object.entries(grouped)
    .map(([isoCode, series]) => {
      const ordered = [...series].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const values = ordered.map((item) => item.value ?? 0);
      const firstValue = values[0] ?? 0;
      const lastValue = values[values.length - 1] ?? 0;
      const delta = Number((lastValue - firstValue).toFixed(2));
      const average = Number(
        (values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)).toFixed(2)
      );
      const max = Number(Math.max(...values).toFixed(2));

      return {
        isoCode,
        name: ordered[0]?.location.name,
        value: mode === 'day' ? lastValue : delta,
        delta,
        average,
        max,
      } satisfies SummaryDatum;
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}
