import countries from 'i18n-iso-countries';

type Position = [number, number];
type Ring = Position[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

type Geometry =
  | {
      type: 'Polygon';
      coordinates: PolygonCoordinates;
    }
  | {
      type: 'MultiPolygon';
      coordinates: MultiPolygonCoordinates;
    };

type WorldFeature = {
  id?: string | number;
  geometry: Geometry | null;
};

type TopologyShape = {
  type: 'Topology';
  objects: {
    countries: unknown;
  };
};

let worldFeaturesPromise: Promise<WorldFeature[]> | null = null;

function resolveIso3FromFeatureId(id?: string | number): string | null {
  if (id === undefined || id === null) {
    return null;
  }

  const raw = String(id).trim();
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  return countries.numericToAlpha3(raw.padStart(3, '0')) ?? null;
}

function isPointInRing(point: Position, ring: Ring): boolean {
  if (ring.length < 3) {
    return false;
  }

  let inside = false;
  const [x, y] = point;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInPolygon(point: Position, polygon: PolygonCoordinates): boolean {
  if (!polygon.length || !isPointInRing(point, polygon[0])) {
    return false;
  }

  for (let index = 1; index < polygon.length; index += 1) {
    if (isPointInRing(point, polygon[index])) {
      return false;
    }
  }

  return true;
}

function geometryContainsPoint(geometry: Geometry | null, point: Position): boolean {
  if (!geometry) {
    return false;
  }

  if (geometry.type === 'Polygon') {
    return isPointInPolygon(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}

async function loadWorldFeatures(): Promise<WorldFeature[]> {
  if (!worldFeaturesPromise) {
    worldFeaturesPromise = (async () => {
      const { feature } = require('topojson-client') as {
        feature: (topology: TopologyShape, object: unknown) => { features?: WorldFeature[] };
      };

      const response = await fetch('/world-atlas-countries-110m.json');
      if (!response.ok) {
        throw new Error('Unable to load world atlas');
      }

      const topology = (await response.json()) as TopologyShape;
      const geoJson = feature(topology, topology.objects.countries);
      return geoJson.features ?? [];
    })();
  }

  return worldFeaturesPromise;
}

export async function findCountryIso3ByCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const features = await loadWorldFeatures();
  const point: Position = [longitude, latitude];

  for (const item of features) {
    if (!geometryContainsPoint(item.geometry, point)) {
      continue;
    }

    const iso3 = resolveIso3FromFeatureId(item.id);
    if (iso3) {
      return iso3.toUpperCase();
    }
  }

  return null;
}

function alpha2ToAlpha3Safe(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const iso3 = countries.alpha2ToAlpha3(value.toUpperCase());
  return iso3 ? iso3.toUpperCase() : null;
}

function regionFromLocaleTag(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parts = value
    .split(/[-_]/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (/^[A-Za-z]{2}$/.test(part)) {
      return part.toUpperCase();
    }
  }

  return null;
}

const TIMEZONE_TO_ISO2: Record<string, string> = {
  'Europe/Bratislava': 'SK',
  'Europe/Prague': 'CZ',
  'Europe/Vienna': 'AT',
  'Europe/Warsaw': 'PL',
  'Europe/Budapest': 'HU',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Kiev': 'UA',
  'Europe/Kyiv': 'UA',
  'Europe/Moscow': 'RU',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
};

function guessCountryIso3FromTimeZone(): string | null {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso2 = TIMEZONE_TO_ISO2[timeZone];
    const iso3 = alpha2ToAlpha3Safe(iso2);
    if (iso3) {
      return iso3;
    }
  }

  return null;
}

function guessCountryIso3FromLocales(): string | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const locales = [...(navigator.languages || []), navigator.language];
  for (const locale of locales) {
    const region = regionFromLocaleTag(locale);
    const iso3 = alpha2ToAlpha3Safe(region || undefined);
    if (iso3) {
      return iso3;
    }
  }

  return null;
}

export function guessCountryIso3FromBrowser(): string | null {
  return guessCountryIso3FromTimeZone() || guessCountryIso3FromLocales();
}
