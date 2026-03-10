import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from 'react-simple-maps';
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

type HoverBadgeState = {
  iso: string;
  name: string;
  hoverValue: number | null;
  x: number;
  y: number;
};

type GlobeMapProps = {
  valuesByIso3: ValuesByIso3;
  hoverValuesByIso3?: ValuesByIso3;
  hoverMetricLabel?: string;
  maxValue: number;
  selectedCountryIso3?: string | null;
  loading?: boolean;
  onSelect: (iso: string, name?: string) => void;
};

type Rotation = [number, number, number];

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startRotation: Rotation;
};

type AshParticle = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
};

type AshParticleStyle = React.CSSProperties & {
  '--ash-duration': string;
  '--ash-delay': string;
  '--ash-opacity': string;
  '--ash-size': string;
  '--ash-drift': string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeLongitude(value: number): number {
  let normalized = value;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

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

function createAshParticles(count: number): AshParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = index + 1;
    const left = (seed * 53) % 100;
    const size = 2.2 + ((seed * 17) % 10) * 0.36;
    const duration = 14 + ((seed * 37) % 14);
    const delay = (seed * 1.9) % duration;
    const opacity = 0.28 + ((seed * 29) % 32) / 100;
    const drift = -32 + ((seed * 41) % 64);
    return { id: seed, left, size, duration, delay, opacity, drift };
  });
}

const GlobeMap: React.FC<GlobeMapProps> = ({
  valuesByIso3,
  hoverValuesByIso3 = {},
  hoverMetricLabel = 'Cases',
  maxValue,
  selectedCountryIso3,
  loading = false,
  onSelect,
}) => {
  const [rotation, setRotation] = useState<Rotation>([-15, -20, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotatePausedUntil, setAutoRotatePausedUntil] = useState(0);
  const [hoverBadge, setHoverBadge] = useState<HoverBadgeState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const movedDuringDragRef = useRef(false);
  const ashParticles = useMemo(() => createAshParticles(34), []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const prefersReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(prefersReduceMotion.matches);
    const onMotionChange = () => setReduceMotion(prefersReduceMotion.matches);
    prefersReduceMotion.addEventListener('change', onMotionChange);
    return () => prefersReduceMotion.removeEventListener('change', onMotionChange);
  }, []);

  useEffect(() => {
    if (isDragging) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    const interval = window.setInterval(() => {
      if (Date.now() < autoRotatePausedUntil) {
        return;
      }
      setRotation((current) => [normalizeLongitude(current[0] + 0.06), current[1], current[2]]);
    }, 34);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRotatePausedUntil, isDragging]);

  const pauseAutoRotate = useCallback(
    (ms: number) => {
      if (reduceMotion) {
        return;
      }
      setAutoRotatePausedUntil(Date.now() + ms);
    },
    [reduceMotion]
  );

  const finishDragging = useCallback(
    (pointerId?: number) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }
      if (pointerId !== undefined && dragState.pointerId !== pointerId) {
        return;
      }
      dragStateRef.current = null;
      setIsDragging(false);
      pauseAutoRotate(1800);
    },
    [pauseAutoRotate]
  );

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const dragDistance = Math.abs(dx) + Math.abs(dy);
      if (dragDistance > 4) {
        movedDuringDragRef.current = true;
      }

      setRotation([
        normalizeLongitude(dragState.startRotation[0] + dx * 0.3),
        clamp(dragState.startRotation[1] - dy * 0.2, -55, 55),
        0,
      ]);
    };

    const stopDragging = (event: PointerEvent) => finishDragging(event.pointerId);

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [finishDragging, isDragging]);

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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    pauseAutoRotate(event.pointerType === 'mouse' ? 1300 : 2500);

    movedDuringDragRef.current = false;
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setIsDragging(false);
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotation: rotation,
    };
    setIsDragging(true);
    setHoverBadge(null);
  };

  const handleCountrySelect = (iso: string, name?: string) => {
    if (!iso) {
      return;
    }
    if (movedDuringDragRef.current) {
      movedDuringDragRef.current = false;
      return;
    }
    onSelect(iso, name);
  };

  return (
    <div
      className={`map-card globe-card ${isDragging ? 'globe-card-dragging' : ''}`}
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => finishDragging(event.pointerId)}
      onPointerCancel={(event) => finishDragging(event.pointerId)}
      onPointerLeave={() => setHoverBadge(null)}
    >
      <div className="globe-backdrop" aria-hidden="true" />
      <div className="globe-ash-layer" aria-hidden="true">
        {ashParticles.map((particle) => (
          <span
            key={particle.id}
            className="globe-ash"
            style={
              {
                left: `${particle.left}%`,
                '--ash-size': `${particle.size}px`,
                '--ash-duration': `${particle.duration}s`,
                '--ash-delay': `-${particle.delay}s`,
                '--ash-opacity': `${particle.opacity}`,
                '--ash-drift': `${particle.drift}px`,
              } as AshParticleStyle
            }
          />
        ))}
      </div>
      <div className="globe-hint">Drag to rotate • Click country for details</div>
      <ComposableMap
        projection="geoOrthographic"
        projectionConfig={{
          scale: 250,
          rotate: rotation,
        }}
        className="map-canvas globe-canvas"
      >
        <defs>
          <radialGradient id="globe-ocean" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#1d3a66" />
            <stop offset="55%" stopColor="#0f2749" />
            <stop offset="100%" stopColor="#071429" />
          </radialGradient>
          <radialGradient id="globe-ocean-shadow" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="rgba(8, 20, 40, 0)" />
            <stop offset="100%" stopColor="rgba(2, 8, 20, 0.65)" />
          </radialGradient>
          <pattern id="globe-no-data-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#131f34" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#4b5f79" strokeWidth="1.3" />
          </pattern>
          <pattern id="globe-no-data-hatch-hover" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1d2b46" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#86a0bf" strokeWidth="1.3" />
          </pattern>
        </defs>
        <Sphere id="globe-sphere" fill="url(#globe-ocean)" stroke="#1f3f66" strokeWidth={0.9} />
        <Sphere id="globe-shadow-sphere" fill="url(#globe-ocean-shadow)" />
        <Graticule stroke="rgba(76, 125, 176, 0.35)" strokeWidth={0.4} />
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: GeographyFeature[] }) =>
            geographies.map((geo: GeographyFeature) => {
              const iso = resolveIso3(geo);
              const countryName = resolveCountryName(geo, iso);
              const isoKey = iso.toUpperCase();
              const hasData = hasOwnValue(valuesByIso3, isoKey);
              const rawValue = hasData ? valuesByIso3[isoKey] : undefined;
              const value =
                typeof rawValue === 'number' && Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 0;
              const hoverValue = hasOwnValue(hoverValuesByIso3, isoKey) ? hoverValuesByIso3[isoKey] : null;
              const isSelected = selectedCountryIso3?.toUpperCase() === iso.toUpperCase();
              const fill = hasData
                ? isSelected
                  ? '#f43f5e'
                  : choroplethColor(value, maxValue)
                : 'url(#globe-no-data-hatch)';
              const hoverFill = hasData ? '#67e8f9' : 'url(#globe-no-data-hatch-hover)';

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={isSelected ? '#be123c' : '#0a1324'}
                  strokeWidth={isSelected ? 1.2 : 0.55}
                  style={{
                    default: { outline: 'none' },
                    hover: {
                      fill: hoverFill,
                      outline: 'none',
                      cursor: isDragging ? 'grabbing' : 'pointer',
                    },
                    pressed: { fill: hoverFill, outline: 'none' },
                  }}
                  onClick={() => handleCountrySelect(iso, countryName)}
                  onMouseEnter={(event) =>
                    !isDragging &&
                    iso &&
                    updateHoverBadge(event, {
                      iso,
                      name: countryName || iso,
                      hoverValue,
                    })
                  }
                  onMouseMove={(event) =>
                    !isDragging &&
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

export default GlobeMap;
