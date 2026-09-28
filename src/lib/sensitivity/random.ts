/**
 * Seeded Pseudo-Random Number Generator and Statistical Sampling Utilities.
 * Strictly adheres to AGENTS.md:
 * - Deterministic, reproducible results across test runs and browsers.
 * - Uniform and Triangular sampling over published/estimated registry ranges.
 */

import type { PercentileStats } from "./types";

/**
 * Mulberry32 32-bit seeded pseudo-random number generator.
 * Produces uniform floating-point numbers in [0, 1) with excellent statistical dispersion.
 */
export function createSeededRandom(seed: number = 42): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples a continuous random variable from a Uniform distribution U(min, max).
 */
export function sampleUniform(
  rng: () => number,
  min: number,
  max: number
): number {
  if (min === max) return min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + (hi - lo) * rng();
}

/**
 * Samples a continuous random variable from a Triangular distribution Tri(a, c, b).
 * Where:
 * - a = min bound
 * - c = typical / mode
 * - b = max bound
 *
 * Triangular distribution is the standard method for three-point engineering estimates
 * where the lower bound, modal value, and upper bound are known.
 */
export function sampleTriangular(
  rng: () => number,
  min: number,
  typical: number,
  max: number
): number {
  if (min === max) return min;

  const a = Math.min(min, typical, max);
  const b = Math.max(min, typical, max);
  const c = Math.max(a, Math.min(b, typical));

  if (a === b) return a;

  const fc = (c - a) / (b - a);
  const u = rng();

  if (u < fc) {
    return a + Math.sqrt(u * (b - a) * (c - a));
  } else {
    return b - Math.sqrt((1 - u) * (b - a) * (b - c));
  }
}

/**
 * Computes the p-th percentile from an array of numbers using linear interpolation.
 * Assumes the input array is already sorted in ascending order.
 */
export function computePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Computes comprehensive statistical distribution summary (p5, p50, p95, mean, min, max, stdDev).
 */
export function computeDistributionStats(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { p5: 0, p50: 0, p95: 0, mean: 0, min: 0, max: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i];
  }
  const mean = sum / n;

  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / n);

  return {
    p5: computePercentile(sorted, 5),
    p50: computePercentile(sorted, 50),
    p95: computePercentile(sorted, 95),
    mean,
    min: sorted[0],
    max: sorted[n - 1],
    stdDev,
  };
}
