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
  pointerType: string;
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

function getClickSuppressionDistance(pointerType: string): number {
  if (pointerType === 'mouse') {
    return 6;
  }
  if (pointerType === 'pen') {
    return 10;
  }
  return 14;
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
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [autoRotatePausedUntil, setAutoRotatePausedUntil] = useState(0);
  const [hoverBadge, setHoverBadge] = useState<HoverBadgeState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const movedDuringDragRef = useRef(false);
  const hoverFrameRef = useRef<number | null>(null);
  const hoverBadgeRef = useRef<HoverBadgeState | null>(null);
  const ashParticles = useMemo(() => createAshParticles(16), []);
  const ambientSceneEnabled = !reduceMotion && !isDragging;

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

    let frameId = 0;
    let lastFrameTime = window.performance.now();

    const tick = (frameTime: number) => {
      if (Date.now() < autoRotatePausedUntil) {
        lastFrameTime = frameTime;
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = frameTime - lastFrameTime;
      if (elapsed >= 34) {
        const step = (elapsed / 34) * 0.06;
        setRotation((current) => [normalizeLongitude(current[0] + step), current[1], current[2]]);
        lastFrameTime = frameTime;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [autoRotatePausedUntil, isDragging]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    []
  );

  const pauseAutoRotate = useCallback(
    (ms: number) => {
      setAutoRotatePausedUntil(Date.now() + ms);
    },
    []
  );

  const finishDragging = useCallback(
    (pointerId?: number, pauseMs = 900) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }
      if (pointerId !== undefined && dragState.pointerId !== pointerId) {
        return;
      }
      dragStateRef.current = null;
      setIsDragging(false);
      setIsPointerActive(false);
      pauseAutoRotate(pauseMs);
    },
    [pauseAutoRotate]
  );

  useEffect(() => {
    if (!isPointerActive || typeof window === 'undefined') {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const dragDistance = Math.hypot(dx, dy);
      if (dragDistance <= getClickSuppressionDistance(dragState.pointerType)) {
        return;
      }
      if (!movedDuringDragRef.current) {
        movedDuringDragRef.current = true;
        setIsDragging(true);
      }

      setRotation([
        normalizeLongitude(dragState.startRotation[0] + dx * 0.3),
        clamp(dragState.startRotation[1] - dy * 0.2, -55, 55),
        0,
      ]);
    };

    const stopDraggingByPointer = (event: PointerEvent) => finishDragging(event.pointerId);
    const stopDragging = () => finishDragging();
    const stopDraggingOnHidden = () => {
      if (document.hidden) {
        finishDragging();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', stopDraggingByPointer);
    window.addEventListener('pointercancel', stopDraggingByPointer);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchend', stopDragging);
    window.addEventListener('touchcancel', stopDragging);
    window.addEventListener('blur', stopDragging);
    document.addEventListener('visibilitychange', stopDraggingOnHidden);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDraggingByPointer);
      window.removeEventListener('pointercancel', stopDraggingByPointer);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchend', stopDragging);
      window.removeEventListener('touchcancel', stopDragging);
      window.removeEventListener('blur', stopDragging);
      document.removeEventListener('visibilitychange', stopDraggingOnHidden);
    };
  }, [isPointerActive, finishDragging]);

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
    hoverBadgeRef.current = {
      ...nextState,
      x: Math.min(Math.max(event.clientX - rect.left + 12, 8), maxLeft),
      y: Math.min(Math.max(event.clientY - rect.top + 12, 8), maxTop),
    };

    if (hoverFrameRef.current !== null) {
      return;
    }

    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      if (hoverBadgeRef.current) {
        setHoverBadge(hoverBadgeRef.current);
      }
    });
  };

  const clearHoverBadge = () => {
    hoverBadgeRef.current = null;
    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
    setHoverBadge(null);
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
      setIsPointerActive(false);
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      startRotation: rotation,
    };
    setIsPointerActive(true);
    clearHoverBadge();
  };

  const handleCountrySelect = (iso: string, name?: string) => {
    const didDrag = movedDuringDragRef.current;
    if (dragStateRef.current) {
      finishDragging(undefined, didDrag ? 1100 : 220);
    }
    if (!iso) {
      return;
    }
    if (didDrag) {
      movedDuringDragRef.current = false;
      return;
    }
    clearHoverBadge();
    pauseAutoRotate(220);
    onSelect(iso, name);
  };

  return (
    <div
      className={`map-card globe-card ${isDragging ? 'globe-card-dragging' : ''} ${ambientSceneEnabled ? '' : 'globe-card-lite'}`}
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => finishDragging(event.pointerId)}
      onPointerCancel={(event) => finishDragging(event.pointerId)}
      onMouseUp={() => finishDragging()}
      onTouchEnd={() => finishDragging()}
      onPointerLeave={clearHoverBadge}
    >
      <div className="globe-backdrop" aria-hidden="true" />
      {ambientSceneEnabled ? (
        <>
          <div className="globe-grid-field" aria-hidden="true" />
          <div className="globe-core-glow" aria-hidden="true" />
          <div className="globe-radar-sweep" aria-hidden="true" />
          <div className="globe-orbit-field" aria-hidden="true">
            <span className="globe-orbit globe-orbit-a" />
            <span className="globe-orbit globe-orbit-b" />
            <span className="globe-orbit globe-orbit-c" />
          </div>
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
        </>
      ) : null}
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
            <stop offset="0%" stopColor="var(--globe-ocean-core)" />
            <stop offset="55%" stopColor="var(--globe-ocean-mid)" />
            <stop offset="100%" stopColor="var(--globe-ocean-edge)" />
          </radialGradient>
          <radialGradient id="globe-ocean-shadow" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="var(--globe-shadow-start)" />
            <stop offset="100%" stopColor="var(--globe-shadow-end)" />
          </radialGradient>
          <pattern id="globe-no-data-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="var(--map-hatch-base)" />
            <path
              d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
              stroke="var(--map-hatch-stroke)"
              strokeWidth="1.3"
            />
          </pattern>
          <pattern id="globe-no-data-hatch-hover" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="var(--map-hatch-hover-base)" />
            <path
              d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
              stroke="var(--map-hatch-hover-stroke)"
              strokeWidth="1.3"
            />
          </pattern>
        </defs>
        <Sphere
          id="globe-sphere"
          fill="url(#globe-ocean)"
          stroke="var(--globe-sphere-stroke)"
          strokeWidth={0.9}
        />
        <Sphere id="globe-shadow-sphere" fill="url(#globe-ocean-shadow)" />
        <Graticule stroke="var(--globe-grid-stroke)" strokeWidth={0.4} />
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
                  ? 'var(--map-selected)'
                  : choroplethColor(value, maxValue)
                : 'url(#globe-no-data-hatch)';
              const hoverFill = hasData ? 'var(--map-hover)' : 'url(#globe-no-data-hatch-hover)';

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={isSelected ? 'var(--map-selected-stroke)' : 'var(--map-country-stroke)'}
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
                  onMouseUp={() => handleCountrySelect(iso, countryName)}
                  onTouchEnd={() => handleCountrySelect(iso, countryName)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && iso) {
                      event.preventDefault();
                      onSelect(iso, countryName);
                    }
                  }}
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
                  onMouseLeave={clearHoverBadge}
                  onBlur={clearHoverBadge}
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
