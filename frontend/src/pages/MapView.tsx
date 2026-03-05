import React, { useRef } from 'react';
import { formatISO, subDays } from 'date-fns';
import FilterBar from '../components/filters/FilterBar';
import ChoroplethMap from '../components/map/ChoroplethMap';
import Legend from '../components/map/Legend';
import CountryPanel from '../components/panels/CountryPanel';
import { useMapSummary } from '../hooks/useMapSummary';
import { DashboardProvider, useDashboard } from '../state/dashboard';

const metricLabels = {
  cases: 'Cases',
  deaths: 'Deaths',
  recovered: 'Recovered',
  vaccinations_total: 'Vaccinations',
  active: 'Active',
  tests: 'Tests',
  incidence: 'Incidence',
  mortality: 'Mortality',
} as const;

const MapDashboardInner: React.FC = () => {
  const {
    state,
    setMetric,
    setDateMode,
    setDate,
    setRange,
    quickRange,
    selectCountry,
    closeDrawer,
    buildMapQuery,
  } = useDashboard();

  const mapQuery = buildMapQuery();
  const { valuesByIso3, maxValue, isLoading, isError } = useMapSummary(mapQuery);
  const detailsRef = useRef<HTMLElement | null>(null);

  const handleCountrySelect = (iso: string, name?: string) => {
    selectCountry(iso, name);
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleReset = () => {
    const today = formatISO(new Date(), { representation: 'date' });
    const from = formatISO(subDays(new Date(), 13), { representation: 'date' });
    setMetric('cases');
    setDateMode('day');
    setDate(today);
    setRange({ from, to: today });
    selectCountry(null);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">COVID explorer</p>
          <h1 className="title">COVID Atlas</h1>
          <p className="lede">
            Explore daily and period-based COVID metrics with a single source of truth for state.
            Pick a date or range, hover to see the selected metric for that period, and click a country for deep details below.
          </p>
        </div>
        <div className="badge">API: {process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1'}</div>
      </header>

      <FilterBar
        metric={state.metric}
        dateMode={state.dateMode}
        date={state.date}
        range={state.range}
        onMetricChange={setMetric}
        onDateModeChange={setDateMode}
        onDateChange={setDate}
        onRangeChange={setRange}
        onQuickRange={quickRange}
        onReset={handleReset}
      />

      {isError && <div className="banner banner-error">Unable to load map data</div>}

      <div className="map-stage">
        <div className="map-wrapper map-wrapper-full">
          <div className="card-heading">
            <div>
              <p className="eyebrow">World view</p>
              <h2 className="card-title">
                {state.metric} •{' '}
                {state.dateMode === 'day'
                  ? state.date
                  : state.dateMode === 'range'
                    ? `${state.range.from} → ${state.range.to}`
                    : 'All time'}
              </h2>
            </div>
            <span className="pill pill-ghost">Hover for selected metric, click for full details</span>
          </div>
          <ChoroplethMap
            valuesByIso3={valuesByIso3}
            hoverValuesByIso3={valuesByIso3}
            hoverMetricLabel={metricLabels[state.metric]}
            maxValue={maxValue}
            selectedCountryIso3={state.selectedCountryIso3}
            loading={isLoading}
            onSelect={handleCountrySelect}
          />
          <Legend maxValue={maxValue} metricLabel={`${metricLabels[state.metric]} scale`} />
        </div>
      </div>
      <section id="country-details" className="details-section" ref={detailsRef}>
        <CountryPanel
          isOpen={state.drawerOpen && Boolean(state.selectedCountryIso3)}
          iso3={state.selectedCountryIso3}
          iso={state.selectedCountryIso3}
          countryName={state.selectedCountryName}
          metric={state.metric}
          dateMode={state.dateMode}
          date={state.date}
          range={state.range}
          onClose={closeDrawer}
        />
      </section>

      <div className="footer-hint">
        Data source: WHO + Johns Hopkins CSSE • Hover for selected metric • Click country to jump to the details panel
      </div>
    </div>
  );
};

const MapView: React.FC = () => (
  <DashboardProvider>
    <MapDashboardInner />
  </DashboardProvider>
);

export default MapView;
