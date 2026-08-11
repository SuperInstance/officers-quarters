// =============================================================================
// SAFE NUMBER — NaN / Infinity Safety Tests
// =============================================================================
// Tests for the fleet-wide NaN firewall, TypeScript edition.
// "The NaN is the perfect metaphor for the hermit crab's missing shell."
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  isFiniteNumber,
  safeNumber,
  safeNumberOrNull,
  safePosition,
  safeDivide,
  safeSqrt,
  safeAtan2,
} from '../systems/safe-number.js';

describe('isFiniteNumber', () => {
  it('returns true for finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(3.14)).toBe(true);
    expect(isFiniteNumber(-42)).toBe(true);
    expect(isFiniteNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isFiniteNumber(Number.MIN_VALUE)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(isFiniteNumber('3.14')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
    expect(isFiniteNumber([])).toBe(false);
    expect(isFiniteNumber(true)).toBe(false);
  });
});

describe('safeNumber', () => {
  it('returns finite numbers unchanged', () => {
    expect(safeNumber(0)).toBe(0);
    expect(safeNumber(3.14)).toBe(3.14);
    expect(safeNumber(-42)).toBe(-42);
  });

  it('returns default for NaN', () => {
    expect(safeNumber(NaN)).toBe(0);
    expect(safeNumber(NaN, 42)).toBe(42);
    expect(safeNumber(NaN, -1)).toBe(-1);
  });

  it('returns default for Infinity', () => {
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(-Infinity)).toBe(0);
    expect(safeNumber(Infinity, 999)).toBe(999);
  });

  it('parses numeric strings', () => {
    expect(safeNumber('3.14')).toBe(3.14);
    expect(safeNumber('-42')).toBe(-42);
    expect(safeNumber('0')).toBe(0);
    expect(safeNumber('1e5')).toBe(100000);
  });

  it('returns default for non-numeric strings', () => {
    expect(safeNumber('hello')).toBe(0);
    expect(safeNumber('NaN')).toBe(0);
    expect(safeNumber('Infinity')).toBe(0);
    expect(safeNumber('', 7)).toBe(7);
  });

  it('handles boolean inputs', () => {
    expect(safeNumber(true)).toBe(1);
    expect(safeNumber(false)).toBe(0);
  });

  it('returns default for null, undefined, objects', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber({ x: 1 })).toBe(0);
    expect(safeNumber(null, 42)).toBe(42);
  });

  it('handles NaN strings that parseFloat partially parses', () => {
    // parseFloat('123abc') returns 123 — this is standard JS behavior
    expect(safeNumber('123abc')).toBe(123);
    // But pure garbage returns default
    expect(safeNumber('abc123')).toBe(0);
  });
});

describe('safeNumberOrNull', () => {
  it('returns finite numbers', () => {
    expect(safeNumberOrNull(3.14)).toBe(3.14);
    expect(safeNumberOrNull(0)).toBe(0);
  });

  it('returns null for NaN and Infinity', () => {
    expect(safeNumberOrNull(NaN)).toBeNull();
    expect(safeNumberOrNull(Infinity)).toBeNull();
    expect(safeNumberOrNull(-Infinity)).toBeNull();
  });

  it('returns null for non-numbers', () => {
    expect(safeNumberOrNull('hello')).toBeNull();
    expect(safeNumberOrNull(null)).toBeNull();
    expect(safeNumberOrNull(undefined)).toBeNull();
  });

  it('parses valid numeric strings', () => {
    expect(safeNumberOrNull('42')).toBe(42);
    expect(safeNumberOrNull('3.14')).toBe(3.14);
  });
});

describe('safePosition', () => {
  it('returns valid positions unchanged', () => {
    const pos = { x: 3, y: 7 };
    expect(safePosition(pos)).toEqual({ x: 3, y: 7 });
  });

  it('replaces NaN coordinates with defaults', () => {
    const pos = { x: NaN, y: 7 };
    expect(safePosition(pos)).toEqual({ x: 0, y: 7 });
  });

  it('replaces Infinity coordinates', () => {
    const pos = { x: 3, y: Infinity };
    expect(safePosition(pos)).toEqual({ x: 3, y: 0 });
  });

  it('uses custom defaults', () => {
    const pos = { x: NaN, y: NaN };
    expect(safePosition(pos, 10, 20)).toEqual({ x: 10, y: 20 });
  });

  it('preserves extra properties', () => {
    const pos = { x: 3, y: 7, label: 'home' };
    const result = safePosition(pos);
    expect(result.label).toBe('home');
    expect(result.x).toBe(3);
    expect(result.y).toBe(7);
  });
});

describe('safeDivide', () => {
  it('divides finite numbers normally', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(7, 3)).toBeCloseTo(2.333, 2);
  });

  it('returns fallback for zero denominator', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, Infinity)).toBe(Infinity);
  });

  it('returns fallback for NaN inputs', () => {
    expect(safeDivide(NaN, 2)).toBe(0);
    expect(safeDivide(10, NaN)).toBe(0);
    expect(safeDivide(NaN, NaN)).toBe(0);
  });

  it('returns fallback for Infinity inputs', () => {
    expect(safeDivide(Infinity, 2)).toBe(0);
    expect(safeDivide(10, Infinity)).toBe(0);
  });

  it('handles negative fallbacks', () => {
    expect(safeDivide(NaN, 2, -1)).toBe(-1);
  });
});

describe('safeSqrt', () => {
  it('computes sqrt for non-negative numbers', () => {
    expect(safeSqrt(0)).toBe(0);
    expect(safeSqrt(4)).toBe(2);
    expect(safeSqrt(2)).toBeCloseTo(1.414, 2);
  });

  it('returns fallback for negative numbers', () => {
    expect(safeSqrt(-1)).toBe(0);
    expect(safeSqrt(-1, 999)).toBe(999);
  });

  it('returns fallback for NaN', () => {
    expect(safeSqrt(NaN)).toBe(0);
    expect(safeSqrt(NaN, 1)).toBe(1);
  });

  it('returns fallback for Infinity', () => {
    expect(safeSqrt(Infinity)).toBe(0);
  });
});

describe('safeAtan2', () => {
  it('computes atan2 for finite inputs', () => {
    expect(safeAtan2(1, 0)).toBeCloseTo(Math.PI / 2, 5);
    expect(safeAtan2(0, 1)).toBe(0);
    expect(safeAtan2(1, 1)).toBeCloseTo(Math.PI / 4, 5);
  });

  it('returns fallback for NaN inputs', () => {
    expect(safeAtan2(NaN, 1)).toBe(0);
    expect(safeAtan2(1, NaN)).toBe(0);
    expect(safeAtan2(NaN, NaN)).toBe(0);
  });

  it('returns fallback for Infinity inputs', () => {
    expect(safeAtan2(Infinity, 1)).toBe(0);
    expect(safeAtan2(1, Infinity)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: The patterns that would have caught the fleet-wide NaN bug
// ---------------------------------------------------------------------------

describe('NaN propagation scenarios', () => {
  it('NaN poisons every arithmetic operation', () => {
    const nan = NaN;
    expect(nan + 1).toBeNaN();
    expect(nan * 0).toBeNaN();
    expect(nan - nan).toBeNaN();
    expect(Math.sqrt(nan)).toBeNaN();
    // The insidious one:
    expect(nan === nan).toBe(false);
    expect(nan > 0).toBe(false);
    expect(nan < 0).toBe(false);
    expect(nan >= 0).toBe(false);
    expect(nan <= 0).toBe(false);
  });

  it('safeNumber stops NaN at the boundary', () => {
    const poisoned = safeNumber(NaN);
    expect(poisoned + 1).toBe(1);
    expect(poisoned * 2).toBe(0);
  });

  it('safeDivide stops NaN from zero-division', () => {
    const result = safeDivide(10, 0);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('a corrupted position is sanitized', () => {
    // Simulate what happens when a sensor returns NaN
    const corruptedSensor = { x: NaN, y: 42, label: 'waypoint' };
    const safe = safePosition(corruptedSensor, 0, 0);
    expect(Number.isFinite(safe.x)).toBe(true);
    expect(Number.isFinite(safe.y)).toBe(true);
    expect(safe.x).toBe(0);
    expect(safe.y).toBe(42);
  });
});
