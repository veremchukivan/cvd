import React, { useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import countries from 'i18n-iso-countries';
import { choroplethColor } from '../../lib/colors';
import { ValuesByIso3 } from '../../types/map';

const geoUrl = '/world-atlas-countries-110m.json';

type GeographyFeature = {
  rsmKey: string;
  id?: string | number;
  properties: {
    ISO_A3?: string;
    iso_a3?: string;
    ADM0_A3?: string;
    adm0_a3?: string;
    NAME?: string;
    name?: string;
    [key: string]: unknown;
  };
};

type ChoroplethMapProps = {
  valuesByIso3: ValuesByIso3;
  hoverValuesByIso3?: ValuesByIso3;
  hoverMetricLabel?: string;
  maxValue: number;
  selectedCountryIso3?: string | null;
  loading?: boolean;
  onSelect: (iso: string, name?: string) => void;
};

type HoverBadgeState = {
  iso: string;
  name: string;
  hoverValue: number | null;
  x: number;
  y: number;
};

function formatHoverValue(value: number | null): string {
  if (value === null || value === undefined) {
    return 'No data';
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function resolveIso3(geo: GeographyFeature): string {
  const directIso =
    geo.properties.ISO_A3 ??
    geo.properties.iso_a3 ??
    geo.properties.ADM0_A3 ??
    geo.properties.adm0_a3;

  if (typeof directIso === 'string' && directIso.trim()) {
    return directIso.toUpperCase();
  }

  if (geo.id === undefined || geo.id === null) {
    return '';
  }

  const rawNumeric = String(geo.id).trim();
  if (!/^\d+$/.test(rawNumeric)) {
    return '';
  }

  return countries.numericToAlpha3(rawNumeric.padStart(3, '0')) ?? '';
}

function resolveCountryName(geo: GeographyFeature, fallbackIso: string): string {
  const name = geo.properties.NAME ?? geo.properties.name;
  if (typeof name === 'string' && name.trim()) {
    return name;
  }
  return fallbackIso;
}

function hasOwnValue(source: ValuesByIso3, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export const ChoroplethMap: React.FC<ChoroplethMapProps> = ({
  valuesByIso3,
  hoverValuesByIso3 = {},
  hoverMetricLabel = 'Cases',
  maxValue,
  selectedCountryIso3,
  loading = false,
  onSelect,
}) => {
  const [viewport, setViewport] = useState<{ center: [number, number]; zoom: number }>({
    center: [0, 20],
    zoom: 1.2,
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [hoverBadge, setHoverBadge] = useState<HoverBadgeState | null>(null);

  const updateHoverBadge = (
    event: React.MouseEvent<SVGPathElement>,
    nextState: Omit<HoverBadgeState, 'x' | 'y'>
  ) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const maxLeft = Math.max(8, rect.width - 220);
    const maxTop = Math.max(8, rect.height - 88);
    setHoverBadge({
      ...nextState,
      x: Math.min(Math.max(event.clientX - rect.left + 12, 8), maxLeft),
      y: Math.min(Math.max(event.clientY - rect.top + 12, 8), maxTop),
    });
  };

  return (
    <div className="map-card" ref={cardRef}>
      <ComposableMap projectionConfig={{ scale: 170 }} className="map-canvas">
        <defs>
          <pattern id="map-no-data-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#131f34" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#4b5f79" strokeWidth="1.4" />
          </pattern>
          <pattern id="map-no-data-hatch-hover" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1d2b46" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#86a0bf" strokeWidth="1.4" />
          </pattern>
        </defs>
        <ZoomableGroup
          center={viewport.center}
          zoom={viewport.zoom}
          minZoom={0.8}
          maxZoom={8}
          onMoveEnd={(position: { coordinates: [number, number]; zoom: number }) =>
            setViewport({
              center: position.coordinates as [number, number],
              zoom: position.zoom,
            })
          }
        >
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: GeographyFeature[] }) =>
              geographies.map((geo: GeographyFeature) => {
                const iso = resolveIso3(geo);
                const countryName = resolveCountryName(geo, iso);
                const isoKey = iso.toUpperCase();
                const hasData = hasOwnValue(valuesByIso3, isoKey);
                const rawValue = hasData ? valuesByIso3[isoKey] : undefined;
                const value = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
                const hoverValue = hasOwnValue(hoverValuesByIso3, isoKey)
                  ? hoverValuesByIso3[isoKey]
                  : null;
                const isSelected = selectedCountryIso3?.toUpperCase() === iso.toUpperCase();
                const fill = hasData
                  ? isSelected
                    ? '#ffb703'
                    : choroplethColor(value, maxValue)
                  : 'url(#map-no-data-hatch)';
                const hoverFill = hasData ? '#38bdf8' : 'url(#map-no-data-hatch-hover)';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isSelected ? '#ffb703' : '#0b1224'}
                    strokeWidth={isSelected ? 1.2 : hasData ? 0.6 : 0.8}
                    style={{
                      default: {
                        outline: 'none',
                        strokeDasharray: hasData ? 'none' : '2.2 1.6',
                      },
                      hover: {
                        fill: hoverFill,
                        outline: 'none',
                        cursor: 'pointer',
                        strokeDasharray: hasData ? 'none' : '2.2 1.6',
                      },
                      pressed: {
                        fill: hoverFill,
                        outline: 'none',
                        strokeDasharray: hasData ? 'none' : '2.2 1.6',
                      },
                    }}
                    onClick={() => iso && onSelect(iso, countryName)}
                    onMouseEnter={(event) =>
                      iso &&
                      updateHoverBadge(event, {
                        iso,
                        name: countryName || iso,
                        hoverValue,
                      })
                    }
                    onMouseMove={(event) =>
                      iso &&
                      updateHoverBadge(event, {
                        iso,
                        name: countryName || iso,
                        hoverValue,
                      })
                    }
                    onMouseLeave={() => setHoverBadge(null)}
                    onBlur={() => setHoverBadge(null)}
                    aria-label={countryName || iso}
                    tabIndex={0}
                    role="button"
                  >
                    <title>
                      {countryName || iso}: {hasData ? value.toLocaleString('en-US') : 'No data'}
                    </title>
                  </Geography>
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {hoverBadge && (
        <div className="map-hover-badge" style={{ left: hoverBadge.x, top: hoverBadge.y }}>
          <p className="map-hover-country">{hoverBadge.name}</p>
          <p className="map-hover-metric">
            {hoverMetricLabel}: {formatHoverValue(hoverBadge.hoverValue)}
          </p>
        </div>
      )}
      {loading && <div className="map-loading">Loading data…</div>}
    </div>
  );
};

export default ChoroplethMap;
