import React from 'react';
import Plot from '../common/Plot';
import { formatSummaryValue } from '../../lib/analytics';
import { LocaleCode } from '../../lib/i18n';
import { usePreferences } from '../../state/preferences';
import { CountryDetailsResponse, SummaryMetric } from '../../types/map';

type MetricNoteKey =
  | 'flowIntensity'
  | 'dailyFatalities'
  | 'recoveryPace'
  | 'dailyVaccinationFlow'
  | 'totalAdministeredDoses'
  | 'totalActiveLoad'
  | 'newInferredCases'
  | 'deathsCasesRatio'
  | 'trend';

type MetricVisual = {
  color: string;
  fill: string;
  kind: 'line' | 'area' | 'bar';
  noteKey: MetricNoteKey;
};

const metricVisuals: Partial<Record<SummaryMetric, MetricVisual>> = {
  today_cases: {
    color: '#4de0ff',
    fill: 'rgba(77,224,255,0.20)',
    kind: 'area',
    noteKey: 'flowIntensity',
  },
  today_deaths: {
    color: '#ff8a47',
    fill: 'rgba(255,138,71,0.16)',
    kind: 'bar',
    noteKey: 'dailyFatalities',
  },
  today_recovered: {
    color: '#80ed99',
    fill: 'rgba(128,237,153,0.16)',
    kind: 'line',
    noteKey: 'recoveryPace',
  },
  today_vaccinations: {
    color: '#80ed99',
    fill: 'rgba(128,237,153,0.16)',
    kind: 'line',
    noteKey: 'dailyVaccinationFlow',
  },
  vaccinations_total: {
    color: '#2ec4b6',
    fill: 'rgba(46,196,182,0.20)',
    kind: 'area',
    noteKey: 'totalAdministeredDoses',
  },
  active: {
    color: '#b8c0ff',
    fill: 'rgba(184,192,255,0.15)',
    kind: 'line',
    noteKey: 'totalActiveLoad',
  },
  incidence: {
    color: '#ffd166',
    fill: 'rgba(255,209,102,0.18)',
    kind: 'bar',
    noteKey: 'newInferredCases',
  },
  mortality: {
    color: '#f78fb3',
    fill: 'rgba(247,143,179,0.16)',
    kind: 'line',
    noteKey: 'deathsCasesRatio',
  },
};

const metricNotes: Record<LocaleCode, Record<MetricNoteKey, string>> = {
  en: {
    flowIntensity: 'Flow intensity',
    dailyFatalities: 'Daily fatalities',
    recoveryPace: 'Recovery pace',
    dailyVaccinationFlow: 'Daily vaccination flow',
    totalAdministeredDoses: 'Total administered doses',
    totalActiveLoad: 'Total active load',
    newInferredCases: 'New inferred cases',
    deathsCasesRatio: 'Deaths / cases ratio',
    trend: 'Trend',
  },
  uk: {
    flowIntensity: 'Інтенсивність потоку',
    dailyFatalities: 'Денні летальні випадки',
    recoveryPace: 'Темп одужання',
    dailyVaccinationFlow: 'Денний темп вакцинації',
    totalAdministeredDoses: 'Загальна кількість введених доз',
    totalActiveLoad: 'Загальне активне навантаження',
    newInferredCases: 'Нові оцінені випадки',
    deathsCasesRatio: 'Співвідношення смертей до випадків',
    trend: 'Тренд',
  },
  ru: {
    flowIntensity: 'Интенсивность потока',
    dailyFatalities: 'Дневные летальные случаи',
    recoveryPace: 'Темп выздоровления',
    dailyVaccinationFlow: 'Дневной темп вакцинации',
    totalAdministeredDoses: 'Общее число введённых доз',
    totalActiveLoad: 'Общая активная нагрузка',
    newInferredCases: 'Новые оценённые случаи',
    deathsCasesRatio: 'Соотношение смертей к случаям',
    trend: 'Тренд',
  },
  sk: {
    flowIntensity: 'Intenzita toku',
    dailyFatalities: 'Denné úmrtia',
    recoveryPace: 'Tempo uzdravovania',
    dailyVaccinationFlow: 'Denný tok očkovania',
    totalAdministeredDoses: 'Celkový počet podaných dávok',
    totalActiveLoad: 'Celková aktívna záťaž',
    newInferredCases: 'Nové odvodené prípady',
    deathsCasesRatio: 'Pomer úmrtí k prípadom',
    trend: 'Trend',
  },
};

function getMetricVisual(metric: SummaryMetric): MetricVisual {
  return (
    metricVisuals[metric] || {
      color: '#4de0ff',
      fill: 'rgba(77,224,255,0.20)',
      kind: 'line',
      noteKey: 'trend',
    }
  );
}

function toNumeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Number(value);
}

type MetricChartCardProps = {
  title: string;
  metric: SummaryMetric;
  response?: CountryDetailsResponse;
  loading: boolean;
};

const MetricChartCard: React.FC<MetricChartCardProps> = ({ title, metric, response, loading }) => {
  const { copy, locale } = usePreferences();
  const series = response?.series;
  const visual = getMetricVisual(metric);
  const note = metricNotes[locale][visual.noteKey] || metricNotes.en[visual.noteKey];
  const values = series?.map((point) => toNumeric(point.value)) || [];
  const chartTrace =
    visual.kind === 'bar'
      ? {
          x: series?.map((point) => point.date),
          y: values,
          type: 'bar',
          marker: { color: visual.color },
        }
      : {
          x: series?.map((point) => point.date),
          y: values,
          type: 'scatter',
          mode: 'lines',
          line: { color: visual.color, width: 2.2 },
          fill: visual.kind === 'area' ? 'tozeroy' : undefined,
          fillcolor: visual.kind === 'area' ? visual.fill : undefined,
        };

  return (
    <div className="compare-mini-card metric-mini-card" style={{ borderTopColor: visual.color }}>
      <div className="chart-header">
        <p className="panel-kicker">{title}</p>
        {loading ? <span className="pill pill-ghost">{copy.common.loading}</span> : null}
      </div>
      <p className="compare-mini-headline">{formatSummaryValue(metric, response?.headline, locale)}</p>
      <p className="metric-mini-note">{note}</p>
      {series?.length ? (
        <div className="compare-mini-plot-frame">
          <Plot
            data={[chartTrace]}
            layout={{
              height: 180,
              margin: { l: 34, r: 8, t: 8, b: 30 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#dbe4ee' },
              xaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
              yaxis: { gridcolor: '#1f2937', tickfont: { color: '#8ea0b7' } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '180px' }}
          />
        </div>
      ) : (
        <div className="chart-placeholder">{copy.common.noData}</div>
      )}
    </div>
  );
};

export default MetricChartCard;
