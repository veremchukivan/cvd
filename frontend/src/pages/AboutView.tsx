import React from 'react';

const AboutView: React.FC = () => {
  return (
    <div className="page info-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">About project</p>
          <h1 className="title">About COVID 3D Atlas (OWID / WHO / Worldometer)</h1>
          <p className="lede">
            This page summarizes public COVID-19 case-reporting context from Our World in Data,
            WHO Dashboard, and Worldometer, reviewed on March 10, 2026.
          </p>
        </div>
      </header>

      <section className="info-grid" aria-label="Project highlights">
        <article className="info-card">
          <p className="panel-kicker">OWID interpretation</p>
          <h2 className="card-title">Confirmed cases vs real infections</h2>
          <p className="panel-subtitle">
            OWID states that confirmed cases reflect tested-and-confirmed infections, while actual
            infections are typically higher because testing is incomplete and reporting is delayed.
          </p>
        </article>
        <article className="info-card">
          <p className="panel-kicker">WHO reporting format</p>
          <h2 className="card-title">Weekly dashboard logic</h2>
          <p className="panel-subtitle">
            WHO explains that countries now report at different frequencies. Since August 25, 2023,
            WHO requested stronger weekly reporting, and the dashboard emphasizes weekly indicators
            to reduce misinterpretation of sparse daily reporting.
          </p>
        </article>
        <article className="info-card">
          <p className="panel-kicker">Worldometer status</p>
          <h2 className="card-title">Historical access only</h2>
          <p className="panel-subtitle">
            Worldometer states that its coronavirus tracker stopped updating on April 13, 2024 due
            to limited feasibility of statistically valid global live totals, while historical data
            remains accessible.
          </p>
        </article>
      </section>

      <section className="info-grid info-grid-dual">
        <article className="info-card">
          <p className="panel-kicker">Data lineage</p>
          <h2 className="card-title">OWID and WHO linkage</h2>
          <p className="panel-subtitle">
            OWID documents that its confirmed case/death visualizations rely on WHO data, and OWID
            publishes downloadable files in CSV/XLSX/JSON plus GitHub access for reproducibility.
          </p>
        </article>
        <article className="info-card">
          <p className="panel-kicker">Comparability limits</p>
          <h2 className="card-title">Why sources can differ</h2>
          <p className="panel-subtitle">
            WHO and OWID both note differences across countries in definitions, test strategies,
            and reporting lags. WHO also notes retrospective corrections can create spikes or even
            negative weekly values in reported data.
          </p>
        </article>
      </section>

      <section className="info-card">
        <p className="panel-kicker">Sources</p>
        <h2 className="card-title">Pages used for this section</h2>
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
        <p className="panel-kicker">Disclaimer</p>
        <h2 className="card-title">Information purpose</h2>
        <p className="panel-subtitle">
          This dashboard is informational and summarizes reported case data. It is not a diagnostic
          or clinical decision tool.
        </p>
      </section>
    </div>
  );
};

export default AboutView;
