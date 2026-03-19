import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapView from './pages/MapView';
import ChartsView from './pages/ChartsView';
import CompareView from './pages/CompareView';
import WorldwideView from './pages/WorldwideView';
import AboutView from './pages/AboutView';
import FaqView from './pages/FaqView';
import './App.css';

type ThemeMode = 'obsidian' | 'ivory';

const THEME_STORAGE_KEY = 'cvd-theme-mode';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'obsidian';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'obsidian' || storedTheme === 'ivory') {
    return storedTheme;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'ivory' : 'obsidian';
  }

  return 'obsidian';
}

function App() {
  const [view, setView] = React.useState<
    'map' | 'charts' | 'compare' | 'worldwide' | 'about' | 'faq'
  >('map');
  const [theme, setTheme] = React.useState<ThemeMode>(resolveInitialTheme);

  const navItems: Array<{
    id: 'map' | 'charts' | 'compare' | 'worldwide' | 'about' | 'faq';
    label: string;
  }> = [
    { id: 'map', label: 'Map' },
    { id: 'worldwide', label: 'COVID Worldwide' },
    { id: 'charts', label: 'Graphs' },
    { id: 'compare', label: 'Compare countries' },
    { id: 'about', label: 'About' },
    { id: 'faq', label: 'FAQ' },
  ];

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App" data-theme={theme}>
        <div className="app-shell">
          <aside className="app-sidebar">
            <p className="eyebrow">Navigation</p>
            <h2 className="app-sidebar-title">Workspace</h2>
            <div className="app-nav">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pill ${view === item.id ? 'pill-active' : 'pill-ghost'}`}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="theme-panel">
              <p className="eyebrow">Theme</p>
              <div className="theme-toggle" role="group" aria-label="Theme mode">
                <button
                  type="button"
                  className={`pill ${theme === 'obsidian' ? 'pill-active' : 'pill-ghost'}`}
                  onClick={() => setTheme('obsidian')}
                  aria-pressed={theme === 'obsidian'}
                >
                  Black theme
                </button>
                <button
                  type="button"
                  className={`pill ${theme === 'ivory' ? 'pill-active' : 'pill-ghost'}`}
                  onClick={() => setTheme('ivory')}
                  aria-pressed={theme === 'ivory'}
                >
                  White theme
                </button>
              </div>
              <p className="theme-note">
                Monochrome shell with a cinematic map stage and animated ambient layers.
              </p>
            </div>
          </aside>
          <main className="app-main">
            {view === 'map' ? <MapView /> : null}
            {view === 'worldwide' ? <WorldwideView /> : null}
            {view === 'charts' ? <ChartsView /> : null}
            {view === 'compare' ? <CompareView /> : null}
            {view === 'about' ? <AboutView /> : null}
            {view === 'faq' ? <FaqView /> : null}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
