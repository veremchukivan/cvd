declare module 'react-plotly.js/factory' {
  import * as React from 'react';
  import type { ComponentType } from 'react';
  import type { Layout, Config, Data } from 'plotly.js';

  type PlotParams = {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    onInitialized?: (figure: { data: Data[]; layout: Partial<Layout> }) => void;
    onUpdate?: (figure: { data: Data[]; layout: Partial<Layout> }) => void;
  };

  export default function createPlotlyComponent(plotly: unknown): ComponentType<PlotParams>;
}

declare module 'plotly.js-basic-dist' {
  import type { Plotly } from 'plotly.js';
  const PlotlyBasic: Plotly;
  export default PlotlyBasic;
}
