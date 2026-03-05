import { createContext, useContext, useMemo, useReducer } from 'react';
import { formatISO, startOfYear, subDays } from 'date-fns';
import { DateMode, DateRange, MapQuery, Metric } from '../types/map';

export interface DashboardState {
  metric: Metric;
  dateMode: DateMode;
  date: string;
  range: DateRange;
  selectedCountryIso3: string | null;
  selectedCountryName: string | null;
  drawerOpen: boolean;
}

type Action =
  | { type: 'setMetric'; metric: Metric }
  | { type: 'setDateMode'; dateMode: DateMode }
  | { type: 'setDate'; date: string }
  | { type: 'setRange'; range: DateRange }
  | { type: 'quickRange'; label: '7d' | '30d' | 'ytd' }
  | { type: 'selectCountry'; iso3: string | null; name?: string | null }
  | { type: 'closeDrawer' };

function todayIsoDate(): string {
  return formatISO(new Date(), { representation: 'date' });
}

function quickRangeBounds(label: '7d' | '30d' | 'ytd'): DateRange {
  const now = new Date();
  const to = formatISO(now, { representation: 'date' });
  if (label === '7d') {
    return { from: formatISO(subDays(now, 6), { representation: 'date' }), to };
  }
  if (label === '30d') {
    return { from: formatISO(subDays(now, 29), { representation: 'date' }), to };
  }
  return { from: formatISO(startOfYear(now), { representation: 'date' }), to };
}

const initialState: DashboardState = {
  metric: 'cases',
  dateMode: 'day',
  date: todayIsoDate(),
  range: { from: last14(), to: todayIsoDate() },
  selectedCountryIso3: null,
  selectedCountryName: null,
  drawerOpen: false,
};

function last14() {
  return formatISO(subDays(new Date(), 13), { representation: 'date' });
}

function normalizeRange(range: DateRange): DateRange {
  const fromDate = new Date(range.from);
  const toDate = new Date(range.to);
  if (fromDate > toDate) {
    return { from: range.to, to: range.from };
  }
  return range;
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'setMetric':
      return { ...state, metric: action.metric };
    case 'setDateMode':
      return {
        ...state,
        dateMode: action.dateMode,
        date: state.date || todayIsoDate(),
      };
    case 'setDate':
      return { ...state, date: action.date || todayIsoDate() };
    case 'setRange':
      return {
        ...state,
        range: normalizeRange({
          from: action.range.from || state.range.from,
          to: action.range.to || state.range.to,
        }),
      };
    case 'quickRange': {
      const range = quickRangeBounds(action.label);
      return { ...state, dateMode: 'range', range };
    }
    case 'selectCountry':
      return {
        ...state,
        selectedCountryIso3: action.iso3,
        selectedCountryName: action.name ?? null,
        drawerOpen: Boolean(action.iso3),
      };
    case 'closeDrawer':
      return {
        ...state,
        selectedCountryIso3: null,
        selectedCountryName: null,
        drawerOpen: false,
      };
    default:
      return state;
  }
}

interface DashboardContextValue {
  state: DashboardState;
  setMetric: (metric: Metric) => void;
  setDateMode: (mode: DateMode) => void;
  setDate: (date: string) => void;
  setRange: (range: DateRange) => void;
  quickRange: (label: '7d' | '30d' | 'ytd') => void;
  selectCountry: (iso3: string | null, name?: string | null) => void;
  closeDrawer: () => void;
  buildMapQuery: () => MapQuery;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<DashboardContextValue>(() => {
    const buildMapQuery = (): MapQuery => {
      if (state.dateMode === 'day') {
        return { metric: state.metric, dateMode: 'day', date: state.date };
      }
      if (state.dateMode === 'range') {
        return { metric: state.metric, dateMode: 'range', range: state.range };
      }
      return { metric: state.metric, dateMode: 'total' };
    };

    return {
      state,
      setMetric: (metric) => dispatch({ type: 'setMetric', metric }),
      setDateMode: (mode) => dispatch({ type: 'setDateMode', dateMode: mode }),
      setDate: (date) => dispatch({ type: 'setDate', date }),
      setRange: (range) => dispatch({ type: 'setRange', range }),
      quickRange: (label) => dispatch({ type: 'quickRange', label }),
      selectCountry: (iso3, name) => dispatch({ type: 'selectCountry', iso3, name }),
      closeDrawer: () => dispatch({ type: 'closeDrawer' }),
      buildMapQuery,
    };
  }, [state]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return ctx;
}
