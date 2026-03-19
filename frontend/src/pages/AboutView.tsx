import React from 'react';
import { usePreferences } from '../state/preferences';

const AboutView: React.FC = () => {
  const { copy } = usePreferences();

  return (
    <div className="page info-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.about.eyebrow}</p>
          <h1 className="title">{copy.about.title}</h1>
          <p className="lede">{copy.about.lede}</p>
        </div>
      </header>

      <section className="info-grid" aria-label={copy.about.highlightsLabel}>
        {copy.about.highlights.map((item) => (
          <article className="info-card" key={item.title}>
            <p className="panel-kicker">{item.kicker}</p>
            <h2 className="card-title">{item.title}</h2>
            <p className="panel-subtitle">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="info-grid info-grid-dual">
        {copy.about.secondary.map((item) => (
          <article className="info-card" key={item.title}>
            <p className="panel-kicker">{item.kicker}</p>
            <h2 className="card-title">{item.title}</h2>
            <p className="panel-subtitle">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="info-card">
        <p className="panel-kicker">{copy.about.sourcesKicker}</p>
        <h2 className="card-title">{copy.about.sourcesTitle}</h2>
        <ul className="info-source-list">
          <li>
            <a href="https://ourworldindata.org/covid-cases" target="_blank" rel="noreferrer">
              Our World in Data: Coronavirus (COVID-19) Cases
            </a>
          </li>
          <li>
            <a
              href="https://data.who.int/dashboards/covid19/cases"
              target="_blank"
              rel="noreferrer"
            >
              WHO COVID-19 Dashboard: Cases
            </a>
          </li>
          <li>
            <a
              href="https://www.worldometers.info/coronavirus/"
              target="_blank"
              rel="noreferrer"
            >
              Worldometer: Coronavirus statistics
            </a>
          </li>
          <li>
            <a
              href="https://www.worldometers.info/coronavirus/about/"
              target="_blank"
              rel="noreferrer"
            >
              Worldometer: About COVID-19 data
            </a>
          </li>
        </ul>
      </section>

      <section className="info-card">
        <p className="panel-kicker">{copy.about.disclaimerKicker}</p>
        <h2 className="card-title">{copy.about.disclaimerTitle}</h2>
        <p className="panel-subtitle">{copy.about.disclaimerBody}</p>
      </section>
    </div>
  );
};

export default AboutView;
