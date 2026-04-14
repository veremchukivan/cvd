const CHOROPLETH_SCALE_EXPONENT = 0.5;
const MIN_VISIBLE_TICK = 0.01;

export const CHOROPLETH_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function normalizeChoroplethValue(value: number | undefined, maxValue: number): number {
  if (!Number.isFinite(value) || !value || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }

  return Math.pow(clamp01(value / maxValue), CHOROPLETH_SCALE_EXPONENT);
}

export function choroplethValueAtTick(tick: number, maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }

  return maxValue * Math.pow(clamp01(tick), 1 / CHOROPLETH_SCALE_EXPONENT);
}

export function choroplethLegendColor(tick: number, maxValue: number): string {
  const sampleTick = Math.max(clamp01(tick), MIN_VISIBLE_TICK);
  return choroplethColor(choroplethValueAtTick(sampleTick, maxValue), maxValue);
}

export function choroplethColor(value: number | undefined, maxValue: number): string {
  const ratio = normalizeChoroplethValue(value, maxValue);
  if (ratio <= 0) return '#E8EDF3';
  const hue = 210 - ratio * 180; // blue -> orange
  const lightness = 60 - ratio * 20; // lighter to darker
  return `hsl(${hue}, 75%, ${lightness}%)`;
}

export const palette = {
  background: '#0b1224',
  card: '#0f172a',
  accent: '#4de0ff',
  accentMuted: '#89c2d9',
  border: '#1f2937',
  text: '#e2e8f0',
  subtext: '#8ea0b7',
  danger: '#f76c5e',
};
