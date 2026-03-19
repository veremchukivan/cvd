import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapView from './pages/MapView';
import ChartsView from './pages/ChartsView';
import CompareView from './pages/CompareView';
import WorldwideView from './pages/WorldwideView';
import AboutView from './pages/AboutView';
import FaqView from './pages/FaqView';
import SettingsView from './pages/SettingsView';
import { PreferencesProvider, usePreferences } from './state/preferences';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type ViewId = 'map' | 'charts' | 'compare' | 'worldwide' | 'about' | 'faq' | 'settings';

const AppShell: React.FC = () => {
  const [view, setView] = React.useState<ViewId>('map');
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const { theme, copy } = usePreferences();

  const navItems = React.useMemo<Array<{ id: ViewId; label: string }>>(
    () => [
      { id: 'map', label: copy.nav.items.map },
      { id: 'worldwide', label: copy.nav.items.worldwide },
      { id: 'charts', label: copy.nav.items.charts },
      { id: 'compare', label: copy.nav.items.compare },
      { id: 'about', label: copy.nav.items.about },
      { id: 'faq', label: copy.nav.items.faq },
      { id: 'settings', label: copy.nav.items.settings },
    ],
    [copy.nav.items]
  );
  const currentViewLabel = navItems.find((item) => item.id === view)?.label || copy.appName;

  React.useEffect(() => {
    document.title = `${currentViewLabel} | ${copy.appName}`;
  }, [copy.appName, currentViewLabel]);

  React.useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileNavOpen]);

  const handleViewChange = (nextView: ViewId) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="App" data-theme={theme}>
      <div className="app-mobile-topbar">
        <button
          type="button"
          className={`app-menu-toggle ${isMobileNavOpen ? 'app-menu-toggle-active' : ''}`}
          onClick={() => setIsMobileNavOpen((current) => !current)}
          aria-label={isMobileNavOpen ? copy.nav.closeMenu : copy.nav.openMenu}
          aria-controls="app-sidebar"
          aria-expanded={isMobileNavOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="app-mobile-topbar-copy">
          <p className="eyebrow">{copy.nav.eyebrow}</p>
          <p className="app-mobile-current-view">{currentViewLabel}</p>
        </div>
      </div>
      <div className="app-shell">
        <div
          className={`app-sidebar-backdrop ${isMobileNavOpen ? 'app-sidebar-backdrop-visible' : ''}`}
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
        <aside id="app-sidebar" className={`app-sidebar ${isMobileNavOpen ? 'app-sidebar-open' : ''}`}>
          <p className="eyebrow">{copy.nav.eyebrow}</p>
          <h2 className="app-sidebar-title">{copy.nav.title}</h2>
          <div className="app-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill ${view === item.id ? 'pill-active' : 'pill-ghost'}`}
                onClick={() => handleViewChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>
        <main className="app-main">
          {view === 'map' ? <MapView /> : null}
          {view === 'worldwide' ? <WorldwideView /> : null}
          {view === 'charts' ? <ChartsView /> : null}
          {view === 'compare' ? <CompareView /> : null}
          {view === 'about' ? <AboutView /> : null}
          {view === 'faq' ? <FaqView /> : null}
          {view === 'settings' ? <SettingsView /> : null}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AppShell />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

export default App;
