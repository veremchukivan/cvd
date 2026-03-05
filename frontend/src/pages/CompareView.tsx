import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatISO, subDays } from 'date-fns';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchCountryDetails, fetchSummary } from '../api/map';
import CountrySearchSelect from '../components/analytics/CountrySearchSelect';
import CompareFilters from '../components/compare/CompareFilters';
import CompareSummaryGrid from '../components/compare/CompareSummaryGrid';
import CompareTrendChart from '../components/compare/CompareTrendChart';
import {
  countryMatches,
  maybeBuildCountryQuery,
  metricToSummaryMetric,
  quickRangeBounds,
} from '../lib/analytics';
import { CountryOption } from '../types/country';
import { CountryDetailsResponse, DateRange, Metric } from '../types/map';

const metricOptions: Array<{ value: Metric; label: string }> = [
  { value: 'cases', label: 'Cases (daily)' },
  { value: 'deaths', label: 'Deaths (daily)' },
  { value: 'recovered', label: 'Recovered (daily)' },
  { value: 'active', label: 'Active' },
  { value: 'incidence', label: 'Incidence' },
  { value: 'mortality', label: 'Mortality (%)' },
];

const CompareView: React.FC = () => {
  const today = formatISO(new Date(), { representation: 'date' });
  const [metric, setMetric] = useState<Metric>('cases');
  const [dateMode, setDateMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<DateRange>({
    from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
    to: today,
  });
  const [primaryIso, setPrimaryIso] = useState<string | null>(null);
  const [compareIso, setCompareIso] = useState<string | null>(null);
  const [primarySearch, setPrimarySearch] = useState('');
  const [compareSearch, setCompareSearch] = useState('');
  const [primaryDropdownOpen, setPrimaryDropdownOpen] = useState(false);
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);
  const primarySearchRef = useRef<HTMLDivElement | null>(null);
  const compareSearchRef = useRef<HTMLDivElement | null>(null);

  const countryOptionsQuery = useQuery({
    queryKey: ['compare-country-options'],
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

  const primarySuggestions = useMemo(
    () => countryOptions.filter((item) => countryMatches(item.name, item.iso3, primarySearch)),
    [countryOptions, primarySearch]
  );

  const compareSuggestions = useMemo(() => {
    const comparePool = countryOptions.filter((item) => item.iso3 !== primaryIso);
    return comparePool.filter((item) => countryMatches(item.name, item.iso3, compareSearch));
  }, [countryOptions, primaryIso, compareSearch]);

  useEffect(() => {
    if (primaryIso || !countryOptions.length) return;
    const usa = countryOptions.find((item) => item.iso3 === 'USA');
    setPrimaryIso((usa || countryOptions[0]).iso3);
  }, [primaryIso, countryOptions]);

  useEffect(() => {
    if (compareIso && compareIso === primaryIso) {
      setCompareIso(null);
    }
  }, [compareIso, primaryIso]);

  useEffect(() => {
    if (!primaryIso) {
      setPrimarySearch('');
      return;
    }
    const selected = countryOptions.find((item) => item.iso3 === primaryIso);
    if (selected) setPrimarySearch(selected.name);
  }, [countryOptions, primaryIso]);

  useEffect(() => {
    if (!compareIso) {
      setCompareSearch('');
      return;
    }
    const selected = countryOptions.find((item) => item.iso3 === compareIso);
    if (selected) setCompareSearch(selected.name);
  }, [countryOptions, compareIso]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (primarySearchRef.current && !primarySearchRef.current.contains(target)) {
        setPrimaryDropdownOpen(false);
      }
      if (compareSearchRef.current && !compareSearchRef.current.contains(target)) {
        setCompareDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const summaryMetric = metricToSummaryMetric(metric);
  const primaryQuery = maybeBuildCountryQuery(primaryIso, summaryMetric, dateMode, date, range);
  const compareQuery = maybeBuildCountryQuery(compareIso, summaryMetric, dateMode, date, range);

  const mainComparison = useQueries({
    queries: [primaryQuery, compareQuery].map((query) => ({
      queryKey: ['compare-main', query],
      queryFn: () => {
        if (!query) throw new Error('Missing comparison query');
        return fetchCountryDetails(query);
      },
      enabled: Boolean(query),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const primaryDetails = mainComparison[0]?.data as CountryDetailsResponse | undefined;
  const compareDetails = mainComparison[1]?.data as CountryDetailsResponse | undefined;
  const mainLoading = mainComparison.some((item) => item.isLoading);
  const mainError = mainComparison.find((item) => item.error)?.error as Error | undefined;

  const primaryName = useMemo(
    () => countryOptions.find((item) => item.iso3 === primaryIso)?.name || primaryIso || 'Primary country',
    [countryOptions, primaryIso]
  );
  const compareName = useMemo(
    () => countryOptions.find((item) => item.iso3 === compareIso)?.name || compareIso || undefined,
    [countryOptions, compareIso]
  );

  const periodLabel = dateMode === 'day' ? date : `${range.from} → ${range.to}`;

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Country comparison</p>
          <h1 className="title">Compare Countries</h1>
          <p className="lede">
            Compare two countries for a selected day or period with one shared trend chart.
          </p>
        </div>
      </header>

      <CompareFilters
        metric={metric}
        metricOptions={metricOptions}
        onMetricChange={setMetric}
        dateMode={dateMode}
        onDateModeChange={setDateMode}
        date={date}
        onDateChange={setDate}
        range={range}
        onRangeChange={setRange}
        onQuickRange={(label) => setRange(quickRangeBounds(label))}
      >
        <CountrySearchSelect
          label="Primary country"
          value={primarySearch}
          selectedIso3={primaryIso}
          suggestions={primarySuggestions}
          open={primaryDropdownOpen}
          onOpenChange={(open) => {
            setPrimaryDropdownOpen(open);
            if (open) setCompareDropdownOpen(false);
          }}
          onValueChange={setPrimarySearch}
          onSelect={(iso3, name) => {
            setPrimaryIso(iso3);
            setPrimarySearch(name || '');
          }}
          placeholder="Search primary country..."
          toggleAriaLabel="Toggle primary country list"
          containerRef={primarySearchRef}
        />

        <CountrySearchSelect
          label="Compare with"
          value={compareSearch}
          selectedIso3={compareIso}
          suggestions={compareSuggestions}
          open={compareDropdownOpen}
          onOpenChange={(open) => {
            setCompareDropdownOpen(open);
            if (open) setPrimaryDropdownOpen(false);
          }}
          onValueChange={setCompareSearch}
          onSelect={(iso3, name) => {
            setCompareIso(iso3);
            setCompareSearch(name || '');
          }}
          placeholder="Search second country..."
          toggleAriaLabel="Toggle compare country list"
          containerRef={compareSearchRef}
          showNoneOption
        />
      </CompareFilters>

      {mainError ? <div className="banner banner-error">Unable to load comparison data.</div> : null}

      <CompareSummaryGrid
        summaryMetric={summaryMetric}
        primaryName={primaryName}
        primaryHeadline={primaryDetails?.headline}
        compareName={compareName}
        compareIso={compareIso}
        compareHeadline={compareDetails?.headline}
        periodLabel={periodLabel}
      />

      <CompareTrendChart
        metric={summaryMetric}
        primary={primaryDetails}
        secondary={compareDetails}
        primaryName={primaryName}
        secondaryName={compareName}
        loading={mainLoading}
      />
    </div>
  );
};

export default CompareView;
