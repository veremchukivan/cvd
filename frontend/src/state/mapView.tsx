import { createContext, useContext, useMemo, useReducer } from 'react';
import { formatISO, subDays } from 'date-fns';
import { DateRange, MapMode, MapViewState, Metric } from '../types/map';

type Action =
  | { type: 'setMetric'; metric: Metric }
  | { type: 'setDateRange'; dateRange: DateRange }
  | { type: 'setMapMode'; mapMode: MapMode }
  | { type: 'selectCountry'; iso?: string }
  | { type: 'closePanel' };

const initialDateRange: DateRange = {
  from: formatISO(subDays(new Date(), 13), { representation: 'date' }),
  to: formatISO(new Date(), { representation: 'date' }),
};

const initialState: MapViewState = {
  metric: 'cases',
  dateRange: initialDateRange,
  mapMode: 'choropleth',
  selectedCountry: undefined,
  panelOpen: false,
};

function normalizeDateRange(dateRange: DateRange): DateRange {
  const fromDate = new Date(dateRange.from);
  const toDate = new Date(dateRange.to);

  if (fromDate > toDate) {
    return { from: dateRange.to, to: dateRange.from };
  }
  return dateRange;
}

function reducer(state: MapViewState, action: Action): MapViewState {
  switch (action.type) {
    case 'setMetric':
      return { ...state, metric: action.metric };
    case 'setDateRange': {
      const normalized = normalizeDateRange(action.dateRange);
      return { ...state, dateRange: normalized };
    }
    case 'setMapMode':
      return { ...state, mapMode: action.mapMode };
    case 'selectCountry':
      return {
        ...state,
        selectedCountry: action.iso,
        panelOpen: Boolean(action.iso),
      };
    case 'closePanel':
      return { ...state, panelOpen: false };
    default:
      return state;
  }
}

interface MapViewContextValue {
  state: MapViewState;
  setMetric: (metric: Metric) => void;
  setDateRange: (dateRange: DateRange) => void;
  setMapMode: (mapMode: MapMode) => void;
  selectCountry: (iso?: string) => void;
  closePanel: () => void;
}

const MapViewContext = createContext<MapViewContextValue | null>(null);

export const MapViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<MapViewContextValue>(
    () => ({
      state,
      setMetric: (metric) => dispatch({ type: 'setMetric', metric }),
      setDateRange: (dateRange) => dispatch({ type: 'setDateRange', dateRange }),
      setMapMode: (mapMode) => dispatch({ type: 'setMapMode', mapMode }),
      selectCountry: (iso) => dispatch({ type: 'selectCountry', iso }),
      closePanel: () => dispatch({ type: 'closePanel' }),
    }),
    [state]
  );

  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>;
};

export function useMapView(): MapViewContextValue {
  const ctx = useContext(MapViewContext);
  if (!ctx) {
    throw new Error('useMapView must be used within a MapViewProvider');
  }
  return ctx;
}
