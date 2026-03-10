import React, { useMemo, useState } from 'react';
import { fetchSummaryExport, MapSummaryParams, SummaryExportFormat } from '../../api/map';
import { GroupBy } from '../../types/map';

type ExportPanelProps = {
  params: MapSummaryParams;
  periodLabel: string;
  rankMetricLabel?: string;
  rankGroupBy: GroupBy;
};

function buildFilename(params: MapSummaryParams, format: SummaryExportFormat): string {
  const group = params.groupBy || 'country';
  const metric = params.metric;
  const window =
    params.date || (params.from || params.to ? `${params.from || 'start'}_${params.to || 'end'}` : 'all_time');
  const safeWindow = window.replaceAll(':', '-').replaceAll('/', '-').replaceAll(' ', '');
  return `covid_${group}_${metric}_${safeWindow}.${format}`;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ params, periodLabel, rankMetricLabel, rankGroupBy }) => {
  const [exporting, setExporting] = useState<SummaryExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtitle = useMemo(() => {
    const level = rankGroupBy === 'continent' ? 'Continents' : 'Countries';
    return `${level} • ${rankMetricLabel || params.metric} • ${periodLabel}`;
  }, [params.metric, periodLabel, rankGroupBy, rankMetricLabel]);

  const handleExport = async (format: SummaryExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const blob = await fetchSummaryExport(params, format);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = buildFilename(params, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to export data.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <section className="world-export-card">
      <div className="chart-header">
        <p className="panel-kicker">Export current ranking</p>
      </div>
      <p className="world-export-hint">{subtitle}</p>
      <div className="world-export-actions">
        <button
          type="button"
          className="pill pill-ghost"
          disabled={Boolean(exporting)}
          onClick={() => handleExport('csv')}
        >
          {exporting === 'csv' ? 'Exporting CSV…' : 'Download CSV'}
        </button>
        <button
          type="button"
          className="pill pill-ghost"
          disabled={Boolean(exporting)}
          onClick={() => handleExport('json')}
        >
          {exporting === 'json' ? 'Exporting JSON…' : 'Download JSON'}
        </button>
      </div>
      {error ? <p className="world-export-error">{error}</p> : null}
    </section>
  );
};

export default ExportPanel;
