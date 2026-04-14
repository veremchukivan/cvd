import {
  CHOROPLETH_TICKS,
  choroplethColor,
  choroplethLegendColor,
  choroplethValueAtTick,
  normalizeChoroplethValue,
} from './colors';

describe('choropleth scale', () => {
  it('compresses legend thresholds toward lower values', () => {
    const maxValue = 400_000_000;

    expect(CHOROPLETH_TICKS).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(choroplethValueAtTick(0.25, maxValue)).toBe(25_000_000);
    expect(choroplethValueAtTick(0.5, maxValue)).toBe(100_000_000);
    expect(choroplethValueAtTick(0.75, maxValue)).toBe(225_000_000);
  });

  it('uses a non-linear ratio for lower values', () => {
    expect(normalizeChoroplethValue(25_000_000, 400_000_000)).toBeCloseTo(0.25);
    expect(normalizeChoroplethValue(100_000_000, 400_000_000)).toBeCloseTo(0.5);
    expect(normalizeChoroplethValue(225_000_000, 400_000_000)).toBeCloseTo(0.75);
  });

  it('keeps the first legend stop blue instead of no-data gray', () => {
    expect(choroplethColor(undefined, 100)).toBe('#E8EDF3');
    expect(choroplethLegendColor(0, 100)).toMatch(/^hsl\(/);
  });
});
