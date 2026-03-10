import React, { useRef } from 'react';
import { formatISO, subDays } from 'date-fns';
import FilterBar from '../components/filters/FilterBar';
import GlobeMap from '../components/map/GlobeMap';
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
          <h1 className="title">COVID 3D Atlas</h1>
          <p className="lede">
            Explore COVID data on an interactive 3D globe. Rotate the world, pick a metric, and
            filter by single day, period, or total mode from the control dock below the map.
          </p>
        </div>
      </header>

      {isError && <div className="banner banner-error">Unable to load map data</div>}

      <div className="map-stage globe-stage">
        <div className="map-wrapper map-wrapper-full globe-wrapper">
          <div className="card-heading">
            <div>
              <p className="eyebrow">3D world view</p>
              <h2 className="card-title">
                {state.metric} •{' '}
                {state.dateMode === 'day'
                  ? state.date
                  : state.dateMode === 'range'
                    ? `${state.range.from} → ${state.range.to}`
                    : 'All time'}
              </h2>
            </div>
            <span className="pill pill-ghost">Rotate, hover, and click for full details</span>
          </div>
          <GlobeMap
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
        <div className="globe-filter-dock">
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
        Data source: WHO + Johns Hopkins CSSE • Drag globe to rotate • Click country to jump to the details panel
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
