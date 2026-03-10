import React, { useEffect, useMemo, useState } from 'react';
import { formatISO, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import WorldwideChartsGrid from '../components/worldwide/WorldwideChartsGrid';
import WorldwideFilters from '../components/worldwide/EnhancedFilters';
import WorldwideKpiGrid from '../components/worldwide/WorldwideKpiGrid';
import { buildCountryQuery, metricToSummaryMetric, quickRangeBounds } from '../lib/analytics';
import { isMetricAllowedForDateMode, metricOptionsForDateMode } from '../lib/metricOptions';
import { CountryDetailsResponse, DateMode, DateRange, GroupBy, Metric } from '../types/map';

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

  const queryCases = buildCountryQuery('WORLD', 'today_cases', dateMode, date, range);
  const queryDeaths = buildCountryQuery('WORLD', 'today_deaths', dateMode, date, range);
  const queryVaccinations = buildCountryQuery('WORLD', 'today_vaccinations', dateMode, date, range);
  const queryActive = buildCountryQuery('WORLD', 'active', dateMode, date, range);
  const queryMortality = buildCountryQuery('WORLD', 'mortality', dateMode, date, range);

  const worldQueries = useQueries({
    queries: [queryCases, queryDeaths, queryVaccinations, queryActive, queryMortality].map((query) => ({
      queryKey: ['world-country-metric', query],
      queryFn: () => fetchCountryDetails(query),
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

  const rankSummaryMetric = metricToSummaryMetric(rankMetric);
  const rankingQuery = useQuery({
    queryKey: ['world-ranking', rankSummaryMetric, rankGroupBy, dateMode, date, range.from, range.to],
    queryFn: async () => {
      const params =
        dateMode === 'day'
          ? { metric: rankSummaryMetric, date, groupBy: rankGroupBy }
          : dateMode === 'range'
            ? { metric: rankSummaryMetric, from: range.from, to: range.to, groupBy: rankGroupBy }
            : { metric: rankSummaryMetric, groupBy: rankGroupBy };
      const response = await fetchSummary(params);
      return response.data
        .filter((item) => (rankGroupBy === 'country' ? item.isoCode?.toUpperCase() !== 'WORLD' : true))
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const ranking = useMemo(() => rankingQuery.data ?? [], [rankingQuery.data]);
  const periodLabel =
    dateMode === 'day' ? date : dateMode === 'range' ? `${range.from} → ${range.to}` : 'All time';
  const totals = casesData?.totals || casesData?.snapshot;

  const timelineChartData = useMemo((): Array<Record<string, unknown>> => {
    const traces: Array<Record<string, unknown>> = [];
    if (casesData?.series?.length) {
      traces.push({
        x: casesData.series.map((p) => p.date),
        y: casesData.series.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Cases (daily)',
        line: { color: '#4de0ff', width: 2.5 },
      });
    }
    if (deathsData?.series?.length) {
      traces.push({
        x: deathsData.series.map((p) => p.date),
        y: deathsData.series.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Deaths (daily)',
        line: { color: '#ff8a47', width: 2.3 },
      });
    }
    if (vaccinationsData?.series?.length) {
      traces.push({
        x: vaccinationsData.series.map((p) => p.date),
        y: vaccinationsData.series.map((p) => p.value ?? null),
        type: 'scatter',
        mode: 'lines',
        name: 'Vaccinations (daily)',
        line: { color: '#80ed99', width: 2.1 },
      });
    }
    return traces;
  }, [casesData?.series, deathsData?.series, vaccinationsData?.series]);

  const rankLabels = useMemo(() => ranking.map((item) => item.name || item.isoCode), [ranking]);
  const rankValues = useMemo(() => ranking.map((item) => item.value ?? 0), [ranking]);
  const rankMetricLabel = rankMetricOptions.find((m) => m.value === rankMetric)?.label;
  const rankEntityLabel = rankGroupBy === 'continent' ? 'continents' : 'countries';

  return (
    <div className="page world-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Global monitor</p>
          <h1 className="title">COVID Worldwide</h1>
          <p className="lede">
            Global view with KPI cards, trend charts and top-country rankings for the selected day or period.
          </p>
        </div>
      </header>

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

      <WorldwideKpiGrid
        periodLabel={periodLabel}
        casesHeadline={casesData?.headline}
        deathsHeadline={deathsData?.headline}
        vaccinationsHeadline={vaccinationsData?.headline}
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
      />
    </div>
  );
};

export default WorldwideView;
