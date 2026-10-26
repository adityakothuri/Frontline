import { describe, expect, it } from 'vitest';
import { distanceMiles, formatDistance } from './geo';

describe('distanceMiles', () => {
  it('is zero for the same point', () => {
    expect(
      distanceMiles({ latitude: 32.78, longitude: -96.8 }, { latitude: 32.78, longitude: -96.8 }),
    ).toBe(0);
  });

  it('is ~69 miles for one degree of longitude at the equator', () => {
    expect(distanceMiles({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(
      69.09,
      1,
    );
  });

  it('is symmetric', () => {
    const a = { latitude: 40.71, longitude: -74.0 };
    const b = { latitude: 34.05, longitude: -118.24 };
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 6);
  });
});

describe('formatDistance', () => {
  it('shows one decimal under 10 miles', () => {
    expect(formatDistance(0.4)).toBe('0.4 mi');
    expect(formatDistance(2.34)).toBe('2.3 mi');
    expect(formatDistance(9.9)).toBe('9.9 mi');
  });

  it('rounds to whole miles at 10 and above', () => {
    expect(formatDistance(10)).toBe('10 mi');
    expect(formatDistance(12.4)).toBe('12 mi');
    expect(formatDistance(12.6)).toBe('13 mi');
  });
});
