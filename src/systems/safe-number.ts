// =============================================================================
// SAFE NUMBER — NaN / Infinity Firewall for TypeScript
// =============================================================================
//
// The fleet-wide NaN safety crusade, TypeScript edition.
//
// NaN is the value that says "I am not a value" and yet persists in every
// calculation, spreading through arithmetic like a rumor. You can't catch it
// with normal comparisons: `x === NaN` is always false, even when x IS NaN.
//
// This module provides the same `_safe_float()` / `sanitize` pattern that
// hardened cns-bridge, cns-echo, and engine-ensign — adapted for TypeScript's
// number type (which is always f64 under the hood, so NaN and Infinity are
// the only invalid states).
//
// "You can only catch NaN by looking directly at it."
// ============================================================================

/**
 * Check if a value is a finite, usable number.
 * Returns false for NaN, Infinity, -Infinity, and non-numbers.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Sanitize a numeric value. Returns the value if finite, otherwise the default.
 *
 * @example
 * safeNumber(3.14)           // → 3.14
 * safeNumber(NaN)            // → 0
 * safeNumber(NaN, null)      // → null
 * safeNumber(Infinity)       // → 0
 * safeNumber("3.14")         // → 3.14
 * safeNumber("not a number") // → 0
 * safeNumber(undefined)      // → 0
 */
export function safeNumber(
  value: unknown,
  defaultValue: number = 0,
): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return defaultValue;
}

/**
 * Sanitize a number, returning null for invalid values instead of a default.
 * Use this when you need to distinguish "invalid" from "zero".
 *
 * @example
 * safeNumberOrNull(3.14)  // → 3.14
 * safeNumberOrNull(NaN)   // → null
 */
export function safeNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Sanitize a position's x and y coordinates.
 * Returns a new position with finite values.
 */
export function safePosition<T extends { x: number; y: number }>(
  pos: T,
  defaultX: number = 0,
  defaultY: number = 0,
): T {
  return {
    ...pos,
    x: Number.isFinite(pos.x) ? pos.x : defaultX,
    y: Number.isFinite(pos.y) ? pos.y : defaultY,
  };
}

/**
 * Guard a division operation against NaN/Infinity from zero denominators.
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  fallback: number = 0,
): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return fallback;
  }
  if (denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

/**
 * Guard Math.sqrt against NaN from negative inputs.
 */
export function safeSqrt(value: number, fallback: number = 0): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.sqrt(value);
}

/**
 * Guard Math.atan2 against NaN inputs.
 */
export function safeAtan2(y: number, x: number, fallback: number = 0): number {
  if (!Number.isFinite(y) || !Number.isFinite(x)) return fallback;
  return Math.atan2(y, x);
}
