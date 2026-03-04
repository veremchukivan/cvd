export function choroplethColor(value: number | undefined, maxValue: number): string {
  if (!value || maxValue <= 0) return '#E8EDF3';
  const ratio = Math.min(value / maxValue, 1);
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
