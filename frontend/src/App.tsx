import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapView from './pages/MapView';
import ChartsView from './pages/ChartsView';
import CompareView from './pages/CompareView';
import WorldwideView from './pages/WorldwideView';
import AboutView from './pages/AboutView';
import FaqView from './pages/FaqView';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [view, setView] = React.useState<
    'map' | 'charts' | 'compare' | 'worldwide' | 'about' | 'faq'
  >('map');

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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
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
