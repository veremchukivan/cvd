import React from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';

const BasePlot = createPlotlyComponent(Plotly);

type PlotProps = React.ComponentProps<typeof BasePlot>;

function readThemeVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function themeAxis(value: unknown, muted: string, grid: string, zero: string): unknown {
  const axis = asObject(value);
  if (!axis) {
    return value;
  }

  const tickfont = asObject(axis.tickfont);
  const title = asObject(axis.title);
  const titleFont = title ? asObject(title.font) : null;

  return {
    ...axis,
    gridcolor: grid,
    zerolinecolor: zero,
    tickfont: {
      ...(tickfont ?? {}),
      color: muted,
    },
    title: title
      ? {
          ...title,
          font: {
            ...(titleFont ?? {}),
            color: muted,
          },
        }
      : title,
  };
}

const Plot: React.FC<PlotProps> = ({ layout, ...props }) => {
  const plotText = readThemeVar('--plot-text', '#eef2f6');
  const plotMuted = readThemeVar('--plot-muted', '#98a7b8');
  const plotGrid = readThemeVar('--plot-grid', 'rgba(111, 129, 149, 0.28)');
  const plotZero = readThemeVar('--plot-zero', 'rgba(141, 155, 171, 0.36)');

  const themedLayout = React.useMemo(() => {
    const rawLayout = { ...(layout ?? {}) } as Record<string, unknown>;

    Object.entries(rawLayout).forEach(([key, value]) => {
      if (/^[xy]axis\d*$/.test(key)) {
        rawLayout[key] = themeAxis(value, plotMuted, plotGrid, plotZero);
      }
    });

    const font = asObject(rawLayout.font);
    const legend = asObject(rawLayout.legend);
    const legendFont = legend ? asObject(legend.font) : null;

    return {
      ...(rawLayout as PlotProps['layout']),
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: {
        ...(font ?? {}),
        color: plotText,
      },
      legend: legend
        ? {
            ...legend,
            font: {
              ...(legendFont ?? {}),
              color: plotMuted,
            },
          }
        : rawLayout.legend,
    } as PlotProps['layout'];
  }, [layout, plotGrid, plotMuted, plotText, plotZero]);

  return <BasePlot {...props} layout={themedLayout} />;
};

export default Plot;
