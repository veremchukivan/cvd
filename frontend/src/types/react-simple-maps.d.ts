declare module 'react-simple-maps' {
  import * as React from 'react';

  export interface GeographyProps {
    geography: any;
    children?: React.ReactNode;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
    children?: React.ReactNode;
  }

  export const ComposableMap: React.FC<{ projectionConfig?: Record<string, unknown>; className?: string; children?: React.ReactNode }>;
  export const Geographies: React.FC<{ geography: string | object; children: (data: { geographies: any[] }) => React.ReactNode }>;
  export const Geography: React.FC<{
    geography: any;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: Record<string, Record<string, string | number>>;
    onClick?: () => void;
    onMouseEnter?: React.MouseEventHandler<SVGPathElement>;
    onMouseMove?: React.MouseEventHandler<SVGPathElement>;
    onMouseLeave?: React.MouseEventHandler<SVGPathElement>;
    onBlur?: React.FocusEventHandler<SVGPathElement>;
    'aria-label'?: string;
    tabIndex?: number;
    role?: string;
    children?: React.ReactNode;
  }>;
  export const ZoomableGroup: React.FC<ZoomableGroupProps>;
}
