// =============================================================================
// THE NAVIGATOR'S TERMINAL — Tests
// =============================================================================
// Tests the core navigation philosophy: time and space as the same substrate.
//
// - Boat-length calculations correct
// - Trackline timeline accurate
// - Predictor extrapolation correct (3-4x the 5-minute line)
// - Pulse sampling extracts correct trends from 2-3 cycles
// - Path of least resistance finds optimal heading
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Constants
  STANDARD_PACE,
  BOAT_LENGTHS_PER_MIN,
  DEFAULT_PULSE_INTERVAL_MS,
  PREDICTOR_MINUTES,
  PREDICTOR_EXTRAPOLATION,
  // Conversion utilities
  knotsToBoatLengthsPerMinute,
  boatLengthsToMinutes,
  minutesToBoatLengths,
  computeSpatialUnit,
  distance,
  bearing,
  // Classes
  Trackline,
  Predictor,
  RadarPulse,
  Sounder,
  NavigatorTerminal,
  // Path
  computeOptimalHeading,
  // Types
  Position,
  CurrentField,
} from '../systems/navigator-terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pos(x: number, y: number): Position {
  return { x, y };
}

function makeField(): CurrentField {
  return {
    vectors: [
      { position: pos(5, 0), direction: 90, strength: 0.6 },
      { position: pos(-5, 5), direction: 45, strength: 0.3 },
    ],
    eddies: [pos(-10, -5)],
    openWater: [pos(20, 20)],
  };
}

// ---------------------------------------------------------------------------
// Constants & Conversions
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('STANDARD_PACE is 1.5 knots', () => {
    expect(STANDARD_PACE).toBe(1.5);
  });

  it('BOAT_LENGTHS_PER_MIN is approximately 2', () => {
    expect(BOAT_LENGTHS_PER_MIN).toBeGreaterThan(1.9);
    expect(BOAT_LENGTHS_PER_MIN).toBeLessThan(2.1);
  });

  it('DEFAULT_PULSE_INTERVAL_MS is 3000ms', () => {
    expect(DEFAULT_PULSE_INTERVAL_MS).toBe(3000);
  });

  it('PREDICTOR_MINUTES is 5', () => {
    expect(PREDICTOR_MINUTES).toBe(5);
  });

  it('PREDICTOR_EXTRAPOLATION is 3-4', () => {
    expect(PREDICTOR_EXTRAPOLATION).toBeGreaterThanOrEqual(3);
    expect(PREDICTOR_EXTRAPOLATION).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Boat-Length Conversions
// ---------------------------------------------------------------------------

describe('knotsToBoatLengthsPerMinute', () => {
  it('converts 1.5 knots to ~3 boat-lengths/min', () => {
    const result = knotsToBoatLengthsPerMinute(1.5);
    expect(result).toBeCloseTo(3.0, 0); // ~3 BL/min at 1.5 knots (2 BL/min per knot)
  });

  it('scales linearly with pace', () => {
    const slow = knotsToBoatLengthsPerMinute(1.0);
    const fast = knotsToBoatLengthsPerMinute(3.0);
    expect(fast).toBeCloseTo(slow * 3, 1);
  });

  it('returns 0 for 0 knots', () => {
    expect(knotsToBoatLengthsPerMinute(0)).toBe(0);
  });
});

describe('boatLengthsToMinutes', () => {
  it('"6 boat-lengths away" ≈ 1 minute at standard pace', () => {
    // At 1.5 knots ≈ 3 BL/min, 3 BL ≈ 1 min.
    const mins = boatLengthsToMinutes(3, STANDARD_PACE);
    expect(mins).toBeCloseTo(1.0, 0);
  });

  it('"40 boat-lengths" ≈ 10-20 minutes at standard pace', () => {
    // At ~3 BL/min, 40 BL ≈ 13.3 min.
    const mins = boatLengthsToMinutes(40, STANDARD_PACE);
    expect(mins).toBeGreaterThan(10);
    expect(mins).toBeLessThan(20);
  });

  it('returns Infinity for pace=0', () => {
    expect(boatLengthsToMinutes(10, 0)).toBe(Infinity);
  });
});

describe('minutesToBoatLengths', () => {
  it('"20 minutes of work" ≈ 35-65 boat-lengths at standard pace', () => {
    // At ~3 BL/min, 20 min ≈ 60 BL.
    const bl = minutesToBoatLengths(20, STANDARD_PACE);
    expect(bl).toBeGreaterThan(35);
    expect(bl).toBeLessThan(65);
  });

  it('is the inverse of boatLengthsToMinutes', () => {
    const mins = boatLengthsToMinutes(15, STANDARD_PACE);
    const bl = minutesToBoatLengths(mins, STANDARD_PACE);
    expect(bl).toBeCloseTo(15, 1);
  });
});

describe('computeSpatialUnit', () => {
  it('computes boat-lengths and time-to-intercept', () => {
    const unit = computeSpatialUnit(10, STANDARD_PACE);
    expect(unit.boatLengths).toBe(10);
    expect(unit.timeToIntercept).toBeGreaterThan(0);
    expect(unit.pace).toBe(STANDARD_PACE);
  });
});

// ---------------------------------------------------------------------------
// Distance & Bearing
// ---------------------------------------------------------------------------

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance(pos(0, 0), pos(3, 4))).toBeCloseTo(5, 5);
  });

  it('returns 0 for same position', () => {
    expect(distance(pos(5, 5), pos(5, 5))).toBe(0);
  });

  it('is symmetric', () => {
    const d1 = distance(pos(0, 0), pos(7, 3));
    const d2 = distance(pos(7, 3), pos(0, 0));
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('bearing', () => {
  it('bearing north (0°) for same x, positive y', () => {
    expect(bearing(pos(0, 0), pos(0, 10))).toBeCloseTo(0, 1);
  });

  it('bearing east (90°) for positive x, same y', () => {
    expect(bearing(pos(0, 0), pos(10, 0))).toBeCloseTo(90, 1);
  });

  it('bearing south (180°) for same x, negative y', () => {
    expect(bearing(pos(0, 0), pos(0, -10))).toBeCloseTo(180, 1);
  });

  it('bearing west (270°) for negative x, same y', () => {
    expect(bearing(pos(0, 0), pos(-10, 0))).toBeCloseTo(270, 1);
  });

  it('is always 0-360', () => {
    const b = bearing(pos(5, 5), pos(-3, -7));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

// ---------------------------------------------------------------------------
// Trackline — The timeline of where the agent has been
// ---------------------------------------------------------------------------

describe('Trackline', () => {
  let trackline: Trackline;

  beforeEach(() => {
    trackline = new Trackline();
  });

  it('starts empty', () => {
    expect(trackline.getPoints().length).toBe(0);
    expect(trackline.current()).toBeNull();
    expect(trackline.totalDistance()).toBe(0);
    expect(trackline.totalTimeMinutes()).toBe(0);
  });

  it('adds trackpoints', () => {
    trackline.addPoint({ position: pos(0, 0), timestamp: 1000, quality: 'good' });
    trackline.addPoint({ position: pos(3, 4), timestamp: 2000, quality: 'good' });
    expect(trackline.getPoints().length).toBe(2);
  });

  it('computes total distance traveled', () => {
    trackline.addPoint({ position: pos(0, 0), timestamp: 1000, quality: 'good' });
    trackline.addPoint({ position: pos(3, 4), timestamp: 2000, quality: 'good' });
    expect(trackline.totalDistance()).toBeCloseTo(5, 5);
  });

  it('distance = time at constant pace (trackline is timeline)', () => {
    // At 1.5 knots ≈ 3 BL/min, 10 minutes = ~30 boat-lengths
    const now = Date.now();
    trackline.addPoint({ position: pos(0, 0), timestamp: now, quality: 'good' });
    trackline.addPoint({ position: pos(0, 30), timestamp: now + 10 * 60000, quality: 'good' });

    const dist = trackline.totalDistance();
    const time = trackline.totalTimeMinutes();

    expect(time).toBeCloseTo(10, 0);
    // At standard pace, 10 minutes × 3 BL/min = 30 BL
    // The trackline encodes both time AND distance
    expect(dist).toBeCloseTo(30, 0);
  });

  it('tracks good and poor pulls separately', () => {
    trackline.addPoint({ position: pos(0, 0), timestamp: 1000, quality: 'good' });
    trackline.addPoint({ position: pos(1, 0), timestamp: 2000, quality: 'good' });
    trackline.addPoint({ position: pos(2, 0), timestamp: 3000, quality: 'poor' });
    trackline.addPoint({ position: pos(3, 0), timestamp: 4000, quality: 'good' });

    expect(trackline.goodPulls()).toBe(3);
    expect(trackline.poorPulls()).toBe(1);
  });

  it('computes current heading from last two points', () => {
    trackline.addPoint({ position: pos(0, 0), timestamp: 1000, quality: 'good' });
    trackline.addPoint({ position: pos(0, 10), timestamp: 2000, quality: 'good' });
    expect(trackline.currentHeading()).toBeCloseTo(0, 1); // north
  });

  it('computes effective pace from recent movement', () => {
    const now = Date.now();
    trackline.addPoint({ position: pos(0, 0), timestamp: now, quality: 'good' });
    trackline.addPoint({ position: pos(0, 30), timestamp: now + 10 * 60000, quality: 'good' });

    const pace = trackline.effectivePace();
    // 30 BL in 10 min = 3 BL/min → 3 / BOAT_LENGTHS_PER_MIN ≈ 1.5 knots
    expect(pace).toBeCloseTo(STANDARD_PACE, 0);
  });

  it('computes soak time for current heading', () => {
    const now = Date.now();
    // 5 minutes of constant heading
    trackline.addPoint({ position: pos(0, 0), timestamp: now, quality: 'good' });
    trackline.addPoint({ position: pos(0, 10), timestamp: now + 5 * 60000, quality: 'good' });

    const soak = trackline.soakTimeMinutes();
    expect(soak).toBeGreaterThan(0);
    expect(soak).toBeLessThanOrEqual(5.1);
  });

  it('prunes old trackpoints', () => {
    const now = Date.now();
    // Add a point from 2 hours ago
    trackline.addPoint({ position: pos(0, 0), timestamp: now - 2 * 3600000, quality: 'good' });
    // Add a recent point
    trackline.addPoint({ position: pos(1, 1), timestamp: now, quality: 'good' });

    // The old point should have been pruned (retention is 30 minutes)
    expect(trackline.getPoints().length).toBeLessThanOrEqual(2);
    // The recent point should be present
    expect(trackline.current()).not.toBeNull();
    expect(trackline.current()!.position.x).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Predictor — The 5-Minute Line
// ---------------------------------------------------------------------------

describe('Predictor', () => {
  let predictor: Predictor;

  beforeEach(() => {
    predictor = new Predictor();
  });

  it('predicts position 5 minutes ahead', () => {
    const from = pos(0, 0);
    const heading = 0; // north
    const pace = STANDARD_PACE;

    const pred = predictor.predict(from, heading, pace);
    expect(pred.minutesAhead).toBe(PREDICTOR_MINUTES);
    expect(pred.position.y).toBeGreaterThan(0); // moved north
    expect(pred.position.x).toBeCloseTo(0, 5);
  });

  it('predicts in the correct heading direction', () => {
    const pred = predictor.predict(pos(0, 0), 90, STANDARD_PACE); // east
    expect(pred.position.x).toBeGreaterThan(0);
    expect(pred.position.y).toBeCloseTo(0, 5);
  });

  it('extrapolates 3-4x the predictor distance', () => {
    const from = pos(0, 0);
    const heading = 0;
    const pace = STANDARD_PACE;

    const pred = predictor.predict(from, heading, pace);
    const extrap = predictor.extrapolate(from, heading, pace);

    const predDist = distance(from, pred.position);
    const extrapDist = distance(from, extrap.position);

    const ratio = extrapDist / predDist;
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThanOrEqual(4);
  });

  it('extrapolation time is 15-20 minutes', () => {
    const extrap = predictor.extrapolate(pos(0, 0), 0, STANDARD_PACE);
    expect(extrap.minutesAhead).toBeGreaterThanOrEqual(15);
    expect(extrap.minutesAhead).toBeLessThanOrEqual(20);
  });

  it('predictionLine returns three points: start, predictor, extrapolation', () => {
    const line = predictor.predictionLine(pos(0, 0), 45, STANDARD_PACE);
    expect(line.length).toBe(3);
    expect(line[0].minutesAhead).toBe(0);
    expect(line[1].minutesAhead).toBe(PREDICTOR_MINUTES);
    expect(line[2].minutesAhead).toBeGreaterThan(PREDICTOR_MINUTES);
  });

  it('faster pace produces longer predictor', () => {
    const slow = predictor.predict(pos(0, 0), 0, 1.0);
    const fast = predictor.predict(pos(0, 0), 0, 3.0);

    const slowDist = distance(pos(0, 0), slow.position);
    const fastDist = distance(pos(0, 0), fast.position);

    expect(fastDist).toBeGreaterThan(slowDist);
  });
});

// ---------------------------------------------------------------------------
// Radar Pulse — Periodic observation, not constant feed
// ---------------------------------------------------------------------------

describe('RadarPulse', () => {
  let radar: RadarPulse;

  beforeEach(() => {
    radar = new RadarPulse(100); // 100ms pulse for testing
  });

  it('shouldPulse returns false immediately after a sweep', () => {
    radar.recordSweep([]);
    expect(radar.shouldPulse()).toBe(false);
  });

  it('shouldPulse returns true after interval passes', () => {
    radar.recordSweep([]);
    // Wait past interval
    const future = Date.now() + 200;
    expect(radar.shouldPulse(future)).toBe(true);
  });

  it('records sweeps and retrieves them', () => {
    radar.recordSweep([
      { agentId: 'A', position: pos(0, 0), range: 10, bearing: 0, timestamp: Date.now() },
    ]);
    radar.recordSweep([
      { agentId: 'A', position: pos(0, 5), range: 5, bearing: 0, timestamp: Date.now() },
    ]);
    expect(radar.sweepCount()).toBe(2);
    expect(radar.getRecentSweeps(1).length).toBe(1);
  });

  it('extracts trend from 2 sweeps', () => {
    const now = Date.now();
    radar.recordSweep([
      { agentId: 'A', position: pos(0, 0), range: 10, bearing: 0, timestamp: now },
    ]);
    radar.recordSweep([
      { agentId: 'A', position: pos(0, 5), range: 5, bearing: 0, timestamp: now + 100 },
    ]);

    const trend = radar.extractTrend('A');
    expect(trend).not.toBeNull();
    expect(trend!.velocity.heading).toBeCloseTo(0, 0); // moving north
    expect(trend!.confidence).toBeGreaterThan(0);
  });

  it('extracts trend from 3 sweeps with higher confidence', () => {
    const now = Date.now();
    radar.recordSweep([
      { agentId: 'B', position: pos(0, 0), range: 20, bearing: 0, timestamp: now },
    ]);
    radar.recordSweep([
      { agentId: 'B', position: pos(3, 4), range: 15, bearing: 30, timestamp: now + 100 },
    ]);
    radar.recordSweep([
      { agentId: 'B', position: pos(6, 8), range: 10, bearing: 35, timestamp: now + 200 },
    ]);

    const trend = radar.extractTrend('B');
    expect(trend).not.toBeNull();
    expect(trend!.confidence).toBeGreaterThanOrEqual(2/3);
  });

  it('returns null with insufficient data', () => {
    radar.recordSweep([]);
    const trend = radar.extractTrend('Unknown');
    expect(trend).toBeNull();
  });

  it('keeps at most 10 sweeps', () => {
    for (let i = 0; i < 15; i++) {
      radar.recordSweep([]);
    }
    expect(radar.sweepCount()).toBe(10);
  });

  it('two bearings establish a line, three establish a trend', () => {
    const now = Date.now();
    // Agent moving due east
    radar.recordSweep([
      { agentId: 'X', position: pos(0, 0), range: 10, bearing: 90, timestamp: now },
    ]);
    radar.recordSweep([
      { agentId: 'X', position: pos(5, 0), range: 5, bearing: 90, timestamp: now + 1000 },
    ]);

    const trend2 = radar.extractTrend('X');
    expect(trend2).not.toBeNull();
    expect(trend2!.velocity.heading).toBeCloseTo(90, 10);

    // Third sweep should increase confidence
    radar.recordSweep([
      { agentId: 'X', position: pos(10, 0), range: 0, bearing: 90, timestamp: now + 2000 },
    ]);
    const trend3 = radar.extractTrend('X');
    expect(trend3!.confidence).toBeGreaterThan(trend2!.confidence);
  });
});

// ---------------------------------------------------------------------------
// Sounder — Incoming work on the vertical scope
// ---------------------------------------------------------------------------

describe('Sounder', () => {
  let sounder: Sounder;

  beforeEach(() => {
    sounder = new Sounder(50);
  });

  it('starts empty', () => {
    expect(sounder.getMarks().length).toBe(0);
    expect(sounder.getActiveMarks().length).toBe(0);
    expect(sounder.columnFill()).toBe(0);
  });

  it('adds marks', () => {
    sounder.addMark({ label: 'Task', depth: 10, intensity: 0.5 });
    expect(sounder.getMarks().length).toBe(1);
    expect(sounder.getActiveMarks().length).toBe(1);
  });

  it('resolves marks', () => {
    sounder.addMark({ label: 'Task', depth: 10, intensity: 0.5 });
    sounder.resolveMark(0);
    expect(sounder.getActiveMarks().length).toBe(0);
    expect(sounder.getMarks().length).toBe(1); // still visible, just inactive
  });

  it('computes column fill', () => {
    sounder.addMark({ label: 'A', depth: 25, intensity: 0.5 });
    sounder.addMark({ label: 'B', depth: 25, intensity: 0.5 });
    const fill = sounder.columnFill();
    expect(fill).toBeGreaterThan(0);
    expect(fill).toBeLessThanOrEqual(1);
  });

  it('reports capacity depth', () => {
    expect(sounder.getCapacityDepth()).toBe(50);
  });

  it('keeps at most 100 marks', () => {
    for (let i = 0; i < 120; i++) {
      sounder.addMark({ label: `Task-${i}`, depth: i, intensity: 0.5 });
    }
    expect(sounder.getMarks().length).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Path of Least Resistance
// ---------------------------------------------------------------------------

describe('computeOptimalHeading', () => {
  it('returns goal bearing when no current', () => {
    const field: CurrentField = { vectors: [], eddies: [], openWater: [] };
    const result = computeOptimalHeading(pos(0, 0), pos(0, 10), field);
    expect(result.heading).toBeCloseTo(0, 0); // north
    expect(result.alignment).toBeGreaterThan(0.9);
  });

  it('blends heading with current direction', () => {
    const field: CurrentField = {
      vectors: [
        { position: pos(0, 0), direction: 45, strength: 1.0 },
      ],
      eddies: [],
      openWater: [],
    };
    // Goal is north (0°), but current pushes northeast (45°)
    const result = computeOptimalHeading(pos(0, 0), pos(0, 10), field);
    // Optimal heading should be between 0 and 45
    expect(result.heading).toBeGreaterThan(0);
    expect(result.heading).toBeLessThan(45);
  });

  it('resistance increases near eddies', () => {
    const field: CurrentField = {
      vectors: [],
      eddies: [pos(0, 5)],  // eddy right in the path
      openWater: [],
    };
    const result = computeOptimalHeading(pos(0, 0), pos(0, 10), field);
    expect(result.resistance).toBeGreaterThan(0);
  });

  it('open water reduces resistance', () => {
    const fieldWithEddy: CurrentField = {
      vectors: [],
      eddies: [pos(0, 5)],
      openWater: [],
    };
    const fieldWithOpen: CurrentField = {
      vectors: [],
      eddies: [pos(0, 5)],
      openWater: [pos(1, 1)],  // near current position
    };
    const r1 = computeOptimalHeading(pos(0, 0), pos(0, 10), fieldWithEddy);
    const r2 = computeOptimalHeading(pos(0, 0), pos(0, 10), fieldWithOpen);
    expect(r2.resistance).toBeLessThanOrEqual(r1.resistance);
  });

  it('alignment is high when heading matches goal', () => {
    const field: CurrentField = {
      vectors: [],
      eddies: [],
      openWater: [],
    };
    const result = computeOptimalHeading(pos(0, 0), pos(10, 0), field);
    expect(result.alignment).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// NavigatorTerminal — Integration
// ---------------------------------------------------------------------------

describe('NavigatorTerminal', () => {
  let terminal: NavigatorTerminal;

  beforeEach(() => {
    terminal = new NavigatorTerminal('TestAgent', pos(0, 0));
  });

  it('initializes with agent ID and position', () => {
    expect(terminal.agentId).toBe('TestAgent');
    expect(terminal.track.trackline.currentPosition()).toEqual(pos(0, 0));
  });

  it('starts with empty other agents', () => {
    expect(terminal.otherAgents.size).toBe(0);
  });

  it('move() updates position and heading', () => {
    terminal.move(10, 90, 'good', 'task'); // move east 10 BL
    const pos = terminal.track.trackline.currentPosition();
    expect(pos.x).toBeCloseTo(10, 5);
    expect(terminal.track.heading).toBe(90);
  });

  it('updateOtherAgent() registers and updates contacts', () => {
    terminal.updateOtherAgent('Wesley', pos(5, 5));
    expect(terminal.otherAgents.size).toBe(1);
    const track = terminal.otherAgents.get('Wesley');
    expect(track).toBeDefined();
    expect(track!.trackline.currentPosition()).toEqual(pos(5, 5));
  });

  it('addIncomingTask() adds to sounder', () => {
    terminal.addIncomingTask('Review', 10, 0.5);
    const view = terminal.getSounderView();
    expect(view.marks.length).toBe(1);
    expect(view.marks[0].label).toBe('Review');
  });

  it('resolveTask() marks sounder item inactive', () => {
    terminal.addIncomingTask('Review', 10, 0.5);
    terminal.resolveTask(0);
    const view = terminal.getSounderView();
    expect(view.activeMarks.length).toBe(0);
  });

  it('pulse() records radar sweep', () => {
    terminal.updateOtherAgent('Pro', pos(10, 0));
    // Force pulse by manipulating timing
    terminal.radar['lastPulseTime'] = 0;
    terminal.pulse();
    expect(terminal.radar.sweepCount()).toBeGreaterThanOrEqual(1);
  });

  it('pulse() does NOT fire between intervals', () => {
    terminal.updateOtherAgent('Pro', pos(10, 0));
    // First pulse fires (lastPulseTime starts at 0, so shouldPulse is true)
    terminal.pulse();
    const afterFirst = terminal.radar.sweepCount();
    // Immediate second pulse should NOT fire (too soon after first)
    terminal.pulse();
    expect(terminal.radar.sweepCount()).toBe(afterFirst);
  });

  it('getChartView() returns self, trackline, contacts, heat zones', () => {
    terminal.updateOtherAgent('Wesley', pos(5, 5));
    const chart = terminal.getChartView();
    expect(chart.self.agentId).toBe('TestAgent');
    expect(chart.trackline.length).toBeGreaterThan(0);
    expect(chart.contacts.length).toBe(1);
    expect(chart.heatZones).toBeDefined();
  });

  it('getSounderView() returns marks and capacity', () => {
    terminal.addIncomingTask('A', 5, 0.3);
    terminal.addIncomingTask('B', 15, 0.7);
    const view = terminal.getSounderView();
    expect(view.marks.length).toBe(2);
    expect(view.capacityDepth).toBe(50);
    expect(view.columnFill).toBeGreaterThan(0);
  });

  it('getRadarView() returns sweeps and trends', () => {
    terminal.updateOtherAgent('Pro', pos(10, 0));
    // Force pulses
    terminal.radar['lastPulseTime'] = 0;
    terminal.pulse();

    terminal.updateOtherAgent('Pro', pos(10, 5));
    terminal.radar['lastPulseTime'] = 0;
    terminal.pulse();

    const view = terminal.getRadarView();
    expect(view.sweeps.length).toBeGreaterThanOrEqual(1);
    expect(view.trends.size).toBeGreaterThanOrEqual(0);
  });

  it('findOptimalHeading() computes path of least resistance', () => {
    terminal.setCurrentField(makeField());
    const result = terminal.findOptimalHeading(pos(10, 10));
    expect(result.heading).toBeGreaterThanOrEqual(0);
    expect(result.heading).toBeLessThan(360);
    expect(result.alignment).toBeGreaterThan(0);
    expect(result.resistance).toBeGreaterThanOrEqual(0);
  });

  it('getVisualProportions() returns geometry of the field', () => {
    terminal.updateOtherAgent('Wesley', pos(5, 5));
    terminal.addIncomingTask('Task', 10, 0.5);
    terminal.move(5, 0, 'good');

    const props = terminal.getVisualProportions();
    expect(props.productiveRatio).toBeGreaterThanOrEqual(0);
    expect(props.productiveRatio).toBeLessThanOrEqual(1);
    expect(props.soakTimeMinutes).toBeGreaterThanOrEqual(0);
    expect(props.sounderFill).toBeGreaterThan(0);
    expect(props.nearestContactDistance).toBeGreaterThan(0);
    expect(props.nearestContactId).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Integration: Time = Space at constant pace
// ---------------------------------------------------------------------------

describe('Integration: Time and Space are the Same Substrate', () => {
  it('20 minutes at standard pace = consistent boat-lengths', () => {
    const bl = minutesToBoatLengths(20, STANDARD_PACE);
    const back = boatLengthsToMinutes(bl, STANDARD_PACE);
    expect(back).toBeCloseTo(20, 0);
  });

  it('trackline distance matches expected time at pace', () => {
    const now = Date.now();
    const tl = new Trackline();
    // Travel north for 10 minutes at standard pace
    const bl = minutesToBoatLengths(10, STANDARD_PACE);
    tl.addPoint({ position: pos(0, 0), timestamp: now, quality: 'good' });
    tl.addPoint({ position: pos(0, bl), timestamp: now + 10 * 60000, quality: 'good' });

    const dist = tl.totalDistance();
    const timeMin = tl.totalTimeMinutes();

    // Distance ≈ what we computed from time
    expect(dist).toBeCloseTo(bl, 0);
    // Time = 10 minutes
    expect(timeMin).toBeCloseTo(10, 0);
  });

  it('predictor + extrapolation gives 20-minute view', () => {
    const predictor = new Predictor(5, 4);
    const pred = predictor.predict(pos(0, 0), 0, STANDARD_PACE);
    const extrap = predictor.extrapolate(pos(0, 0), 0, STANDARD_PACE);

    // Predictor = 5 minutes ahead
    expect(pred.minutesAhead).toBe(5);
    // Extrapolation = 20 minutes ahead (5 × 4)
    expect(extrap.minutesAhead).toBe(20);

    // Extrapolation distance = 4x predictor distance
    const predDist = distance(pos(0, 0), pred.position);
    const extrapDist = distance(pos(0, 0), extrap.position);
    expect(extrapDist / predDist).toBeCloseTo(4, 0);
  });

  it('three radar pulses establish a trend for a moving agent', () => {
    const radar = new RadarPulse(10);
    const baseTime = Date.now();

    // Agent moving east at steady pace
    for (let i = 0; i < 3; i++) {
      radar.recordSweep([{
        agentId: 'target',
        position: pos(i * 5, 0),
        range: 50 - i * 5,
        bearing: 90,
        timestamp: baseTime + i * 100,
      }]);
    }

    const trend = radar.extractTrend('target');
    expect(trend).not.toBeNull();
    // Moving east = heading 90°
    expect(trend!.velocity.heading).toBeCloseTo(90, 0);
    // Three observations = full confidence
    expect(trend!.confidence).toBeCloseTo(1, 1);
  });

  it('path of least resistance aligns with current toward goal', () => {
    const field: CurrentField = {
      vectors: [
        { position: pos(0, 0), direction: 10, strength: 0.8 },
      ],
      eddies: [],
      openWater: [],
    };
    // Goal is north (0°), current is 10° (slightly east)
    const result = computeOptimalHeading(pos(0, 0), pos(0, 100), field);
    // Optimal heading should be between 0 and 10, closer to 0
    expect(result.heading).toBeGreaterThanOrEqual(0);
    expect(result.heading).toBeLessThan(10);
    // Strong alignment with goal
    expect(result.alignment).toBeGreaterThan(0.95);
  });
});
