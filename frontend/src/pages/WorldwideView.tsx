import React, { useEffect, useMemo, useState } from 'react';
import { formatISO, parseISO, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchCountryDetails, fetchSummary, MapSummaryParams } from '../api/map';
import WorldwideChartsGrid from '../components/worldwide/WorldwideChartsGrid';
import DataQualityBadge from '../components/worldwide/DataQualityBadge';
import ExportPanel from '../components/worldwide/ExportPanel';
import PredictiveOutlookCard from '../components/worldwide/PredictiveOutlookCard';
import WorldwideFilters from '../components/worldwide/EnhancedFilters';
import WorldwideKpiGrid from '../components/worldwide/WorldwideKpiGrid';
import {
  buildCountryQuery,
  formatSummaryValue,
  metricToSummaryMetric,
  quickRangeBounds,
} from '../lib/analytics';
import { isMetricAllowedForDateMode, metricOptionsForDateMode } from '../lib/metricOptions';
import { CountryDetailsResponse, DateMode, DateRange, GroupBy, Metric, SummaryMetric } from '../types/map';

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
      .filter((item): item is number => item !== null && Number.isFinite(item));
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

const WorldwideView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [dateMode, setDateMode] = useState<DateMode>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [rankMetric, setRankMetric] = useState<Metric>('cases');
  const [rankGroupBy, setRankGroupBy] = useState<GroupBy>('country');
  const rankMetricOptions = useMemo(() => metricOptionsForDateMode(dateMode), [dateMode]);

  useEffect(() => {
    if (isMetricAllowedForDateMode(rankMetric, dateMode)) {
      return;
    }
    const fallback = rankMetricOptions[0]?.value;
    if (fallback) {
      setRankMetric(fallback);
    }
  }, [dateMode, rankMetric, rankMetricOptions]);
  const vaccinationsEnabled = dateMode === 'total';

  const queryCases = buildCountryQuery('WORLD', 'today_cases', dateMode, date, range);
  const queryDeaths = buildCountryQuery('WORLD', 'today_deaths', dateMode, date, range);
  const queryVaccinations = vaccinationsEnabled
    ? buildCountryQuery('WORLD', 'vaccinations_total', dateMode, date, range)
    : null;
  const queryActive = buildCountryQuery('WORLD', 'active', dateMode, date, range);
  const queryMortality = buildCountryQuery('WORLD', 'mortality', dateMode, date, range);

  const worldQueries = useQueries({
    queries: [queryCases, queryDeaths, queryVaccinations, queryActive, queryMortality].map((query) => ({
        queryKey: ['world-country-metric', query],
        queryFn: () => {
          if (!query) throw new Error('Missing world metric query');
          return fetchCountryDetails(query);
        },
        enabled: Boolean(query),
        staleTime: 5 * 60 * 1000,
      })),
  });

  const casesData = worldQueries[0]?.data as CountryDetailsResponse | undefined;
  const deathsData = worldQueries[1]?.data as CountryDetailsResponse | undefined;
  const vaccinationsData = worldQueries[2]?.data as CountryDetailsResponse | undefined;
  const activeData = worldQueries[3]?.data as CountryDetailsResponse | undefined;
  const mortalityData = worldQueries[4]?.data as CountryDetailsResponse | undefined;
  const worldLoading = worldQueries.some((item) => item.isLoading);
  const worldError = worldQueries.find((item) => item.error)?.error as Error | undefined;

  const rankSummaryMetric = metricToSummaryMetric(rankMetric, dateMode);
  const rankingParams = useMemo<MapSummaryParams>(
    () =>
      dateMode === 'day'
        ? { metric: rankSummaryMetric, date, groupBy: rankGroupBy }
        : dateMode === 'range'
          ? { metric: rankSummaryMetric, from: range.from, to: range.to, groupBy: rankGroupBy }
          : { metric: rankSummaryMetric, groupBy: rankGroupBy },
    [dateMode, date, rankGroupBy, rankSummaryMetric, range.from, range.to]
  );
  const rankingQuery = useQuery({
    queryKey: ['world-ranking', rankSummaryMetric, rankGroupBy, dateMode, date, range.from, range.to],
    queryFn: async () => fetchSummary(rankingParams),
    staleTime: 5 * 60 * 1000,
  });

  const ranking = useMemo(
    () =>
      (rankingQuery.data?.data ?? [])
        .filter((item) => (rankGroupBy === 'country' ? item.isoCode?.toUpperCase() !== 'WORLD' : true))
        .slice(0, 10),
    [rankGroupBy, rankingQuery.data?.data]
  );
  const rankingQuality = rankingQuery.data?.quality;
  const rankingAnomalies = rankingQuery.data?.anomalies;
  const periodLabel =
    dateMode === 'day' ? date : dateMode === 'range' ? `${range.from} → ${range.to}` : 'All time';
  const totals = casesData?.totals || casesData?.snapshot;
  const casesSeries = useMemo(() => casesData?.series ?? [], [casesData?.series]);
  const deathsSeries = useMemo(() => deathsData?.series ?? [], [deathsData?.series]);
  const vaccinationsSeries = useMemo(
    () => (vaccinationsEnabled ? vaccinationsData?.series ?? [] : []),
    [vaccinationsData?.series, vaccinationsEnabled]
  );

  const timelineChartData = useMemo((): Array<Record<string, unknown>> => {
    const traces: Array<Record<string, unknown>> = [];
    if (casesSeries.length) {
      traces.push({
        x: casesSeries.map((p) => p.date),
        y: casesSeries.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Cases (daily)',
        line: { color: '#4de0ff', width: 2.6 },
        fill: 'tozeroy',
        fillcolor: 'rgba(77,224,255,0.12)',
      });
    }
    if (deathsSeries.length) {
      traces.push({
        x: deathsSeries.map((p) => p.date),
        y: deathsSeries.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Deaths (daily)',
        line: { color: '#ff8a47', width: 2.3 },
      });
    }
    if (vaccinationsSeries.length) {
      traces.push({
        x: vaccinationsSeries.map((p) => p.date),
        y: vaccinationsSeries.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Vaccinations (total)',
        line: { color: '#80ed99', width: 2.1, dash: 'dot' },
      });
    }
    return traces;
  }, [casesSeries, deathsSeries, vaccinationsSeries]);

  const momentumSeries = useMemo(() => casesSeries.slice(-84), [casesSeries]);
  const momentumDates = useMemo(() => momentumSeries.map((point) => point.date), [momentumSeries]);
  const momentumValues = useMemo(
    () => momentumSeries.map((point) => toNumeric(point.value)),
    [momentumSeries]
  );
  const momentumMoving = useMemo(() => movingAverage(momentumValues, 7), [momentumValues]);

  const weekdayValues = useMemo(() => {
    const buckets = weekdayOrder.reduce<Record<string, number[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    for (const point of casesSeries) {
      const value = toNumeric(point.value);
      if (value === null) continue;
      buckets[weekdayFromIsoDate(point.date)].push(value);
    }
    return weekdayOrder.map((day) => {
      const values = buckets[day];
      const avg = values.length ? values.reduce((acc, item) => acc + item, 0) / values.length : 0;
      return Number(avg.toFixed(2));
    });
  }, [casesSeries]);

  const outcomeItems = useMemo(
    () => {
      const values = [
        { label: 'Cases', value: toNumeric(casesData?.headline) || 0, color: '#4de0ff' },
        { label: 'Deaths', value: toNumeric(deathsData?.headline) || 0, color: '#ff8a47' },
      ];
      if (vaccinationsEnabled) {
        values.push({
          label: 'Vaccinations',
          value: toNumeric(vaccinationsData?.headline) || 0,
          color: '#80ed99',
        });
      }
      return values.filter((item) => item.value > 0);
    },
    [casesData?.headline, deathsData?.headline, vaccinationsData?.headline, vaccinationsEnabled]
  );

  const customSeriesByMetric = useMemo(
    () =>
      ({
        today_cases: casesData?.series ?? [],
        today_deaths: deathsData?.series ?? [],
        today_vaccinations: [],
        vaccinations_total: vaccinationsSeries,
        active: activeData?.series ?? [],
        mortality: mortalityData?.series ?? [],
      }) satisfies Partial<Record<SummaryMetric, Array<{ date: string; value: number | null }>>>,
    [
      activeData?.series,
      casesData?.series,
      deathsData?.series,
      mortalityData?.series,
      vaccinationsSeries,
    ]
  );

  const rankLabels = useMemo(() => ranking.map((item) => item.name || item.isoCode), [ranking]);
  const rankValues = useMemo(() => ranking.map((item) => item.value ?? 0), [ranking]);
  const rankMetricLabel = rankMetricOptions.find((m) => m.value === rankMetric)?.label;
  const rankEntityLabel = rankGroupBy === 'continent' ? 'continents' : 'countries';
  const topRank = ranking[0];
  const topRankName = topRank?.name || topRank?.isoCode || `No ${rankEntityLabel} yet`;
  const topRankValue = topRank ? formatSummaryValue(rankSummaryMetric, topRank.value) : '—';
  const modeLabel = dateMode === 'day' ? 'Day snapshot' : dateMode === 'range' ? 'Range window' : 'All-time';

  return (
    <div className="page world-page">
      <header className="page-header world-header-shell">
        <div className="world-header-main">
          <p className="eyebrow">Global monitor</p>
          <h1 className="title">COVID Worldwide</h1>
          <p className="lede">
            Global dashboard with redesigned visuals, expanded analytics and interactive chart controls for the
            selected period. Vaccination comparisons are available in total mode.
          </p>
          <div className="world-header-pills">
            <span className="pill pill-ghost">Mode: {modeLabel}</span>
            <span className="pill pill-ghost">Window: {periodLabel}</span>
            <span className="pill pill-ghost">Ranking: {rankEntityLabel}</span>
          </div>
        </div>
        <aside className="world-header-spotlight">
          <p className="panel-kicker">Top {rankEntityLabel}</p>
          <p className="world-spotlight-name">{topRankName}</p>
          <p className="world-spotlight-value">{topRankValue}</p>
          <p className="world-spotlight-meta">{rankMetricLabel || 'Metric'} • Live ranking</p>
        </aside>
      </header>

      <div className="world-section-stack">
        <WorldwideFilters
          dateMode={dateMode}
          onDateModeChange={setDateMode}
          date={date}
          onDateChange={setDate}
          range={range}
          onRangeChange={setRange}
          onQuickRange={(label) => setRange(quickRangeBounds(label))}
          rankMetric={rankMetric}
          rankMetricOptions={rankMetricOptions}
          onRankMetricChange={setRankMetric}
          rankGroupBy={rankGroupBy}
          onRankGroupByChange={setRankGroupBy}
        />

        {worldError ? <div className="banner banner-error">Unable to load worldwide data.</div> : null}

        <div className="world-utility-grid">
          <ExportPanel
            params={rankingParams}
            periodLabel={periodLabel}
            rankMetricLabel={rankMetricLabel}
            rankGroupBy={rankGroupBy}
          />
          <DataQualityBadge quality={rankingQuality} rankGroupBy={rankGroupBy} />
          <PredictiveOutlookCard
            periodLabel={periodLabel}
            casesSeries={casesData?.series}
            deathsSeries={deathsData?.series}
          />
        </div>

        <WorldwideKpiGrid
          periodLabel={periodLabel}
          casesHeadline={casesData?.headline}
          deathsHeadline={deathsData?.headline}
          vaccinationsTotalHeadline={vaccinationsData?.headline}
          showVaccinationsTotal={vaccinationsEnabled}
          activeHeadline={activeData?.headline}
          mortalityHeadline={mortalityData?.headline}
          totalCases={totals?.cases}
          totalCasesAsOf={casesData?.coverage?.overallLatest}
        />

        <WorldwideChartsGrid
          timelineChartData={timelineChartData}
          worldLoading={worldLoading}
          rankingLoading={rankingQuery.isLoading}
          rankMetricLabel={rankMetricLabel}
          rankEntityLabel={rankEntityLabel}
          rankLabels={rankLabels}
          rankValues={rankValues}
          anomalies={rankingAnomalies}
          momentumDates={momentumDates}
          momentumValues={momentumValues}
          momentumMoving={momentumMoving}
          weekdayLabels={[...weekdayOrder]}
          weekdayValues={weekdayValues}
          outcomeItems={outcomeItems}
          customSeriesByMetric={customSeriesByMetric}
          periodLabel={periodLabel}
        />
      </div>
    </div>
  );
};

export default WorldwideView;
