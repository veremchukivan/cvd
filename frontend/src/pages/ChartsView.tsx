import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatISO, parseISO, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import ChartsComparisonsSection, {
  PairComparison,
  SplitMetricDatum,
  SplitMetricShare,
} from '../components/charts/ChartsComparisonsSection';
import ChartsCustomSection from '../components/charts/ChartsCustomSection';
import ChartsDynamicsSection, {
  MomentumPoint,
  WeekdayProfilePoint,
} from '../components/charts/ChartsDynamicsSection';
import ChartsFilterPanel from '../components/charts/ChartsFilterPanel';
import ChartsMetricCardsSection from '../components/charts/ChartsMetricCardsSection';
import ChartsOverviewSection from '../components/charts/ChartsOverviewSection';
import { countryMatches, maybeBuildCountryQuery, quickRangeBounds } from '../lib/analytics';
import { CountryOption } from '../types/country';
import { CountryDetailsResponse, DateMode, DateRange, SummaryMetric } from '../types/map';

const BASE_CHART_METRIC_CARDS: Array<{ metric: SummaryMetric; label: string }> = [
  { metric: 'today_cases', label: 'Cases (daily)' },
  { metric: 'today_deaths', label: 'Deaths (daily)' },
  { metric: 'active', label: 'Active (total)' },
  { metric: 'mortality', label: 'Mortality (%)' },
];

function chartMetricCardsForMode(dateMode: DateMode): Array<{ metric: SummaryMetric; label: string }> {
  if (dateMode !== 'total') {
    return BASE_CHART_METRIC_CARDS;
  }
  return [
    ...BASE_CHART_METRIC_CARDS,
    { metric: 'vaccinations_total', label: 'Vaccinations (total)' },
  ];
}

const weekdayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function toNumeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Number(value);
}

function movingAverage(values: Array<number | null>, windowSize: number): Array<number | null> {
  const result: Array<number | null> = [];
  for (let index = 0; index < values.length; index += 1) {
    const slice = values
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (!slice.length) {
      result.push(null);
      continue;
    }
    const avg = slice.reduce((acc, item) => acc + item, 0) / slice.length;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
}

function weekdayFromIsoDate(isoDate: string): (typeof weekdayOrder)[number] {
  const day = parseISO(isoDate).getDay();
  return weekdayOrder[(day + 6) % 7];
}

function findPeak(series: Array<{ date: string; value: number | null }> | undefined): {
  date: string;
  value: number;
} | null {
  if (!series?.length) return null;
  let peakDate = '';
  let peakValue = -Infinity;
  for (const point of series) {
    const value = toNumeric(point.value);
    if (value === null) continue;
    if (value > peakValue) {
      peakValue = value;
      peakDate = point.date;
    }
  }
  if (!Number.isFinite(peakValue) || peakValue < 0) return null;
  return { date: peakDate, value: peakValue };
}

const ChartsView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [dateMode, setDateMode] = useState<DateMode>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [countryIso, setCountryIso] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countrySearchRef = useRef<HTMLDivElement | null>(null);
  const chartMetricCards = useMemo(() => chartMetricCardsForMode(dateMode), [dateMode]);
  const vaccinationsEnabled = dateMode === 'total';
  const vaccinationMetric: SummaryMetric | null = vaccinationsEnabled ? 'vaccinations_total' : null;

  const countryOptionsQuery = useQuery({
    queryKey: ['charts-country-options'],
    queryFn: async (): Promise<CountryOption[]> => {
      const response = await fetchSummary({ metric: 'cases' });
      const uniq = new Map<string, string>();
      for (const row of response.data) {
        const iso = row.isoCode?.toUpperCase();
        if (!iso || iso === 'WORLD') continue;
        if (!uniq.has(iso)) uniq.set(iso, row.name || iso);
      }
      return Array.from(uniq.entries())
        .map(([iso3, name]) => ({ iso3, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 15 * 60 * 1000,
  });

  const countryOptions = useMemo(() => countryOptionsQuery.data || [], [countryOptionsQuery.data]);
  const countrySuggestions = useMemo(() => {
    if (!countrySearch.trim()) return countryOptions;
    return countryOptions.filter((item) => countryMatches(item.name, item.iso3, countrySearch));
  }, [countryOptions, countrySearch]);

  useEffect(() => {
    if (countryIso || !countryOptions.length) return;
    const usa = countryOptions.find((item) => item.iso3 === 'USA');
    setCountryIso((usa || countryOptions[0]).iso3);
  }, [countryIso, countryOptions]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const node = countrySearchRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      setCountryDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const metricQueries = useQueries({
    queries: chartMetricCards.map((item) => {
      const query = maybeBuildCountryQuery(countryIso, item.metric, dateMode, date, range);
      return {
        queryKey: ['charts-country-metric', query],
        queryFn: () => {
          if (!query) throw new Error('Missing country');
          return fetchCountryDetails(query);
        },
        enabled: Boolean(query),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const hasError = metricQueries.some((item) => Boolean(item.error));
  const selectedCountryName = useMemo(
    () => countryOptions.find((item) => item.iso3 === countryIso)?.name || countryIso || 'Country',
    [countryOptions, countryIso]
  );
  const periodLabel =
    dateMode === 'day' ? date : dateMode === 'range' ? `${range.from} → ${range.to}` : 'All time';

  const metricData = chartMetricCards.reduce<Partial<Record<SummaryMetric, CountryDetailsResponse>>>(
    (acc, item, index) => {
      const data = metricQueries[index]?.data as CountryDetailsResponse | undefined;
      if (data) {
        acc[item.metric] = data;
      }
      return acc;
    },
    {}
  );

  const casesSeries = useMemo(() => metricData.today_cases?.series ?? [], [metricData.today_cases?.series]);
  const deathsSeries = useMemo(() => metricData.today_deaths?.series ?? [], [metricData.today_deaths?.series]);
  const vaccinationsSeries = useMemo(
    () => (vaccinationMetric ? metricData[vaccinationMetric]?.series ?? [] : []),
    [metricData, vaccinationMetric]
  );
  const vaccinationsHeadline = useMemo(
    () => (vaccinationMetric ? toNumeric(metricData[vaccinationMetric]?.headline) || 0 : 0),
    [metricData, vaccinationMetric]
  );
  const mortalitySeries = useMemo(() => metricData.mortality?.series ?? [], [metricData.mortality?.series]);

  const flowTraces = useMemo((): Array<Record<string, unknown>> => {
    const traces: Array<Record<string, unknown>> = [];
    if (casesSeries.length) {
      traces.push({
        x: casesSeries.map((point) => point.date),
        y: casesSeries.map((point) => toNumeric(point.value)),
        type: 'scatter',
        mode: 'lines',
        name: 'Cases',
        line: { color: '#4de0ff', width: 2.5 },
        fill: 'tozeroy',
        fillcolor: 'rgba(77,224,255,0.15)',
      });
    }
    if (deathsSeries.length) {
      traces.push({
        x: deathsSeries.map((point) => point.date),
        y: deathsSeries.map((point) => toNumeric(point.value)),
        type: 'scatter',
        mode: 'lines',
        name: 'Deaths',
        line: { color: '#ff8a47', width: 2.2 },
      });
    }
    if (vaccinationsSeries.length) {
      traces.push({
        x: vaccinationsSeries.map((point) => point.date),
        y: vaccinationsSeries.map((point) => toNumeric(point.value)),
        type: 'scatter',
        mode: 'lines',
        name: 'Vaccinations (total)',
        line: { color: '#80ed99', width: 2.2, dash: 'dot' },
      });
    }
    return traces;
  }, [casesSeries, deathsSeries, vaccinationsSeries]);

  const momentumSeries = useMemo((): MomentumPoint[] => {
    const source = casesSeries.slice(-60);
    const values = source.map((point) => toNumeric(point.value));
    const moving = movingAverage(values, 7);
    return source.map((point, index) => ({
      date: point.date,
      value: values[index],
      moving: moving[index],
    }));
  }, [casesSeries]);

  const weekdayProfile = useMemo((): WeekdayProfilePoint[] => {
    const buckets = weekdayOrder.reduce<Record<string, number[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});

    for (const point of casesSeries) {
      const value = toNumeric(point.value);
      if (value === null) continue;
      buckets[weekdayFromIsoDate(point.date)].push(value);
    }

    return weekdayOrder.map((label) => {
      const values = buckets[label];
      const average = values.length ? values.reduce((acc, item) => acc + item, 0) / values.length : 0;
      return { label, value: Number(average.toFixed(2)) };
    });
  }, [casesSeries]);

  const splitData = useMemo((): SplitMetricDatum[] => {
    const values: SplitMetricDatum[] = [
      {
        label: 'Cases',
        metric: 'today_cases',
        value: toNumeric(metricData.today_cases?.headline) || 0,
        color: '#4de0ff',
      },
      {
        label: 'Deaths',
        metric: 'today_deaths',
        value: toNumeric(metricData.today_deaths?.headline) || 0,
        color: '#ff8a47',
      },
    ];
    if (vaccinationsEnabled) {
      values.push({
        label: 'Vaccinations',
        metric: 'vaccinations_total',
        value: vaccinationsHeadline,
        color: '#80ed99',
      });
    }
    return values.filter((item) => item.value > 0);
  }, [
    metricData.today_cases?.headline,
    metricData.today_deaths?.headline,
    vaccinationsEnabled,
    vaccinationsHeadline,
  ]);

  const splitTotal = useMemo(() => splitData.reduce((acc, item) => acc + item.value, 0), [splitData]);
  const splitShare = useMemo(
    (): SplitMetricShare[] =>
      splitData.map((item) => ({
        ...item,
        percent: splitTotal > 0 ? Number(((item.value / splitTotal) * 100).toFixed(1)) : 0,
      })),
    [splitData, splitTotal]
  );

  const outcomePairKey = useMemo(() => {
    if (splitData.length !== 2) return null;
    return splitData
      .map((item) => item.label.toLowerCase())
      .sort((a, b) => a.localeCompare(b))
      .join('-');
  }, [splitData]);

  const pairComparisons = useMemo((): PairComparison[] => {
    const metricValues = {
      cases: toNumeric(metricData.today_cases?.headline) || 0,
      deaths: toNumeric(metricData.today_deaths?.headline) || 0,
      vaccinations: vaccinationsHeadline,
    };

    const pairs: Array<Omit<PairComparison, 'leftPercent' | 'rightPercent'>> = [
      {
        key: 'cases-deaths',
        title: 'Cases vs Deaths',
        left: {
          label: 'Cases',
          metric: 'today_cases',
          value: metricValues.cases,
          color: '#4de0ff',
        },
        right: {
          label: 'Deaths',
          metric: 'today_deaths',
          value: metricValues.deaths,
          color: '#ff8a47',
        },
      },
    ];

    if (vaccinationsEnabled) {
      pairs.push(
        {
          key: 'cases-vaccinations',
          title: 'Cases vs Vaccinations',
          left: {
            label: 'Cases',
            metric: 'today_cases',
            value: metricValues.cases,
            color: '#4de0ff',
          },
          right: {
            label: 'Vaccinations',
            metric: 'vaccinations_total',
            value: metricValues.vaccinations,
            color: '#80ed99',
          },
        },
        {
          key: 'vaccinations-deaths',
          title: 'Vaccinations vs Deaths',
          left: {
            label: 'Vaccinations',
            metric: 'vaccinations_total',
            value: metricValues.vaccinations,
            color: '#80ed99',
          },
          right: {
            label: 'Deaths',
            metric: 'today_deaths',
            value: metricValues.deaths,
            color: '#ff8a47',
          },
        }
      );
    }

    return pairs
      .map((pair) => {
        const pairKey = [pair.left.label.toLowerCase(), pair.right.label.toLowerCase()]
          .sort((a, b) => a.localeCompare(b))
          .join('-');
        if (outcomePairKey && pairKey === outcomePairKey) return null;

        const total = pair.left.value + pair.right.value;
        if (total <= 0) return null;

        const leftPercent = Number(((pair.left.value / total) * 100).toFixed(1));
        const rightPercent = Number((100 - leftPercent).toFixed(1));
        return { ...pair, leftPercent, rightPercent };
      })
      .filter((item): item is PairComparison => Boolean(item));
  }, [
    metricData.today_cases?.headline,
    metricData.today_deaths?.headline,
    vaccinationsEnabled,
    vaccinationsHeadline,
    outcomePairKey,
  ]);

  const casesPeak = findPeak(casesSeries);
  const deathsPeak = findPeak(deathsSeries);
  const mortalityPeak = findPeak(mortalitySeries);
  const customSeriesByMetric = useMemo(
    (): Partial<Record<SummaryMetric, Array<{ date: string; value: number | null }>>> => ({
      today_cases: casesSeries,
      today_deaths: deathsSeries,
      today_vaccinations: [],
      active: metricData.active?.series ?? [],
      vaccinations_total: vaccinationsSeries,
      mortality: mortalitySeries,
    }),
    [
      casesSeries,
      deathsSeries,
      vaccinationsSeries,
      metricData.active?.series,
      mortalitySeries,
    ]
  );

  const metricCards = useMemo(
    () =>
      chartMetricCards.map((item, index) => ({
        metric: item.metric,
        label: item.label,
        response: metricQueries[index]?.data as CountryDetailsResponse | undefined,
        loading: Boolean(metricQueries[index]?.isLoading),
      })),
    [chartMetricCards, metricQueries]
  );

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Country analytics</p>
          <h1 className="title">Country Graphs</h1>
          <p className="lede">
            Explore flow, weekly rhythm and outcome mix for one country in a selected day, period, or total mode.
          </p>
        </div>
      </header>

      <ChartsFilterPanel
        dateMode={dateMode}
        onDateModeChange={setDateMode}
        date={date}
        onDateChange={setDate}
        range={range}
        onRangeChange={setRange}
        onQuickRange={(label) => setRange(quickRangeBounds(label))}
        countryIso={countryIso}
        countrySearch={countrySearch}
        onCountrySearchChange={setCountrySearch}
        countrySuggestions={countrySuggestions}
        countryDropdownOpen={countryDropdownOpen}
        onCountryDropdownOpenChange={setCountryDropdownOpen}
        onCountrySelect={(iso3, name) => {
          setCountryIso(iso3);
          setCountrySearch(name || '');
        }}
        countrySearchRef={countrySearchRef}
      />

      {hasError ? <div className="banner banner-error">Unable to load one or more country metrics.</div> : null}

      <ChartsOverviewSection
        selectedCountryName={selectedCountryName}
        countryIso={countryIso}
        periodLabel={periodLabel}
        casesPeak={casesPeak}
        deathsPeak={deathsPeak}
        mortalityPeak={mortalityPeak}
      />

      <ChartsCustomSection selectedCountryName={selectedCountryName} seriesByMetric={customSeriesByMetric} />

      <ChartsMetricCardsSection selectedCountryName={selectedCountryName} cards={metricCards} />

      <ChartsDynamicsSection
        flowTraces={flowTraces}
        momentumSeries={momentumSeries}
        weekdayProfile={weekdayProfile}
      />

      <ChartsComparisonsSection
        splitData={splitData}
        splitShare={splitShare}
        pairComparisons={pairComparisons}
      />
    </div>
  );
};

export default ChartsView;
