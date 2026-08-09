// =============================================================================
// THE NAVIGATOR'S TERMINAL
// =============================================================================
// From Casey's description of navigation on the F/V EILEEN.
//
// The terminal renders three views simultaneously:
//   1. THE CHART  — top-down spatial view (trackline + predictor + heat zones)
//   2. THE SOUNDER — vertical time-of-flight view (incoming work as marks)
//   3. THE RADAR   — periodic pulse view (other agents' positions on sweep)
//
// All three share the same coordinate space. Time and space are the same
// substrate — distance = time at constant pace. The unit is BOAT-LENGTHS.
//
// "The captain doesn't calculate — they see. The way a captain sees."
// =============================================================================

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

/**
 * A position in the navigable task space.
 * Coordinates are in boat-lengths from an arbitrary origin.
 */
export interface Position {
  x: number;  // boat-lengths east-west
  y: number;  // boat-lengths north-south
}

/**
 * A heading in degrees. 0 = north, 90 = east, 180 = south, 270 = west.
 */
export type Heading = number;

/**
 * Velocity through the task space.
 * pace is in knots, where 1 knot = 1 task-completion-equivalent per hour.
 * heading is the direction of travel.
 */
export interface Velocity {
  pace: number;    // knots (tasks/hour equivalent)
  heading: Heading;
}

/**
 * The spatial unit — boat-lengths as universal measure.
 * One boat-length = one task completion at standard pace.
 * At 1.5 knots (standard work pace): ~2 boat-lengths per minute.
 */
export interface SpatialUnit {
  boatLengths: number;       // distance in boat-lengths
  timeToIntercept: number;   // minutes at current pace
  pace: number;              // knots (tasks per hour equivalent)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard work pace in knots. The F/V EILEEN's gear-pulling speed. */
export const STANDARD_PACE = 1.5;

/** Boat-lengths per minute at standard pace. */
export const BOAT_LENGTHS_PER_MINUTE_AT_STANDARD_PACE = 2.0;

/** Conversion: 1 knot in boat-lengths per minute (boat is 50.6 ft, 1 knot = 101.27 ft/min). */
export const KNOT_TO_BOAT_LENGTHS_PER_MIN = 101.27 / 50.6; // ≈ 2.001

/**
 * Boat-lengths per minute per knot of pace.
 * At 1 knot, you travel ~2 boat-lengths per minute.
 * At 1.5 knots (standard): ~3 boat-lengths per minute.
 */
export const BOAT_LENGTHS_PER_MIN = KNOT_TO_BOAT_LENGTHS_PER_MIN; // ≈ 2.0

/** Default radar pulse interval in seconds. */
export const DEFAULT_PULSE_INTERVAL_MS = 3000;

/** Predictor horizon in minutes. */
export const PREDICTOR_MINUTES = 5;

/** Extrapolation factor — how far past the predictor the eye naturally extends. */
export const PREDICTOR_EXTRAPOLATION = 4; // 3-4x the 5-minute line

/** Minutes of trackline to retain for display. */
export const TRACKLINE_RETENTION_MINUTES = 30;

// ---------------------------------------------------------------------------
// Conversion Utilities
// ---------------------------------------------------------------------------

/**
 * Convert pace (knots) to boat-lengths per minute.
 * At 1.5 knots → ~2 boat-lengths/min (≈3 boat-lengths per minute actually,
 * but we use the documented F/V EILEEN ratio of 2 per minute for simplicity).
 */
export function knotsToBoatLengthsPerMinute(knots: number): number {
  return knots * BOAT_LENGTHS_PER_MIN;
}

/**
 * Convert boat-lengths to time at a given pace.
 * "3 boat-lengths away" at standard pace = ~1.5 minutes.
 */
export function boatLengthsToMinutes(boatLengths: number, pace = STANDARD_PACE): number {
  const blPerMin = knotsToBoatLengthsPerMinute(pace);
  if (blPerMin <= 0) return Infinity;
  return boatLengths / blPerMin;
}

/**
 * Convert minutes to boat-lengths at a given pace.
 * "20 minutes of work" at standard pace = ~40 boat-lengths.
 */
export function minutesToBoatLengths(minutes: number, pace = STANDARD_PACE): number {
  return minutes * knotsToBoatLengthsPerMinute(pace);
}

/**
 * Compute a SpatialUnit from distance and pace.
 */
export function computeSpatialUnit(boatLengths: number, pace = STANDARD_PACE): SpatialUnit {
  return {
    boatLengths,
    timeToIntercept: boatLengthsToMinutes(boatLengths, pace),
    pace,
  };
}

/**
 * Euclidean distance between two positions, in boat-lengths.
 */
export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Bearing from one position to another, in degrees.
 */
export function bearing(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------------------
// Trackpoint & Trackline
// ---------------------------------------------------------------------------

export interface Trackpoint {
  position: Position;
  timestamp: number;  // epoch ms
  quality: 'good' | 'poor';  // was this a productive pull or a stuck session?
  taskLabel?: string;
}

/**
 * The trackline is the agent's history — where they've been.
 * At constant pace, distance = time. The trackline IS a timeline.
 *
 * "I've been working on this task for 20 minutes" =
 *   "I've traveled X boat-lengths on this heading"
 */
export class Trackline {
  private points: Trackpoint[] = [];
  private readonly maxAgeMs: number;

  constructor(retentionMinutes = TRACKLINE_RETENTION_MINUTES) {
    this.maxAgeMs = retentionMinutes * 60 * 1000;
  }

  /**
   * Add a trackpoint to the trackline.
   */
  addPoint(point: Trackpoint): void {
    this.points.push(point);
    this.prune();
  }

  /**
   * Get all visible trackpoints.
   */
  getPoints(): Trackpoint[] {
    return [...this.points];
  }

  /**
   * Get the most recent trackpoint.
   */
  current(): Trackpoint | null {
    return this.points.length > 0 ? this.points[this.points.length - 1] : null;
  }

  /**
   * Get the current position.
   */
  currentPosition(): Position {
    const cur = this.current();
    return cur ? cur.position : { x: 0, y: 0 };
  }

  /**
   * Total boat-lengths traveled along the trackline.
   * This IS time at constant pace.
   */
  totalDistance(): number {
    let dist = 0;
    for (let i = 1; i < this.points.length; i++) {
      dist += distance(this.points[i - 1].position, this.points[i].position);
    }
    return dist;
  }

  /**
   * Total time elapsed along the trackline, in minutes.
   */
  totalTimeMinutes(): number {
    if (this.points.length < 2) return 0;
    const first = this.points[0].timestamp;
    const last = this.points[this.points.length - 1].timestamp;
    return (last - first) / 60000;
  }

  /**
   * Current heading derived from the last two trackpoints.
   */
  currentHeading(): Heading {
    if (this.points.length < 2) return 0;
    const prev = this.points[this.points.length - 2].position;
    const curr = this.points[this.points.length - 1].position;
    return bearing(prev, curr);
  }

  /**
   * Effective pace derived from recent trackline movement.
   */
  effectivePace(): number {
    if (this.points.length < 2) return STANDARD_PACE;
    const recent = this.points.slice(-5);
    let dist = 0;
    for (let i = 1; i < recent.length; i++) {
      dist += distance(recent[i - 1].position, recent[i].position);
    }
    const timeMin = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000;
    if (timeMin <= 0) return STANDARD_PACE;
    const blPerMin = dist / timeMin;
    return blPerMin / BOAT_LENGTHS_PER_MIN; // back to knots
  }

  /**
   * Count of "good pulls" (productive sessions) on the trackline.
   */
  goodPulls(): number {
    return this.points.filter(p => p.quality === 'good').length;
  }

  /**
   * Count of "poor pulls" (stuck/debugging sessions) on the trackline.
   */
  poorPulls(): number {
    return this.points.filter(p => p.quality === 'poor').length;
  }

  /**
   * Soak time for the current task — how long the current heading has been held.
   */
  soakTimeMinutes(): number {
    if (this.points.length < 2) return 0;
    const cur = this.current()!;
    // Walk backwards while heading is approximately constant
    let startIdx = this.points.length - 1;
    const tolerance = 30; // degrees
    for (let i = this.points.length - 2; i >= 0; i--) {
      const h1 = bearing(this.points[i].position, this.points[i + 1].position);
      const h2 = cur.position === this.points[startIdx].position
        ? this.currentHeading()
        : bearing(this.points[i].position, cur.position);
      const diff = Math.abs(((h1 - h2 + 540) % 360) - 180);
      if (diff > tolerance) break;
      startIdx = i;
    }
    const startTime = this.points[startIdx].timestamp;
    return (cur.timestamp - startTime) / 60000;
  }

  /**
   * Remove trackpoints older than the retention window.
   * @private
   */
  private prune(): void {
    if (this.points.length === 0) return;
    const cutoff = Date.now() - this.maxAgeMs;
    const idx = this.points.findIndex(p => p.timestamp >= cutoff);
    if (idx > 0) {
      this.points = this.points.slice(idx);
    }
  }
}

// ---------------------------------------------------------------------------
// Predictor — The 5-Minute Line
// ---------------------------------------------------------------------------

export interface PredictorPoint {
  position: Position;
  minutesAhead: number;
}

/**
 * The predictor shows where the agent will be if they hold course.
 * The eye extrapolates 3-4x the predictor distance naturally.
 *
 * "The predictor isn't a calculation. It's a visual habit."
 */
export class Predictor {
  /** Minutes ahead the predictor line extends. */
  horizonMinutes: number;
  /** How many multiples the eye naturally extends past the predictor. */
  extrapolationFactor: number;

  constructor(horizonMinutes = PREDICTOR_MINUTES, extrapolationFactor = PREDICTOR_EXTRAPOLATION) {
    this.horizonMinutes = horizonMinutes;
    this.extrapolationFactor = extrapolationFactor;
  }

  /**
   * Compute the predictor point from current position, heading, and pace.
   */
  predict(from: Position, heading: Heading, pace: number): PredictorPoint {
    const blPerMin = knotsToBoatLengthsPerMinute(pace);
    const totalBL = blPerMin * this.horizonMinutes;
    const rad = heading * Math.PI / 180;
    return {
      position: {
        x: from.x + Math.sin(rad) * totalBL,
        y: from.y + Math.cos(rad) * totalBL,
      },
      minutesAhead: this.horizonMinutes,
    };
  }

  /**
   * Compute the extrapolation point — where the eye naturally extends.
   * This is 3-4x the predictor distance, same heading.
   */
  extrapolate(from: Position, heading: Heading, pace: number): PredictorPoint {
    const blPerMin = knotsToBoatLengthsPerMinute(pace);
    const totalMin = this.horizonMinutes * this.extrapolationFactor;
    const totalBL = blPerMin * totalMin;
    const rad = heading * Math.PI / 180;
    return {
      position: {
        x: from.x + Math.sin(rad) * totalBL,
        y: from.y + Math.cos(rad) * totalBL,
      },
      minutesAhead: totalMin,
    };
  }

  /**
   * Full prediction line — predictor + extrapolation points.
   */
  predictionLine(from: Position, heading: Heading, pace: number): PredictorPoint[] {
    return [
      { position: { ...from }, minutesAhead: 0 },
      this.predict(from, heading, pace),
      this.extrapolate(from, heading, pace),
    ];
  }
}

// ---------------------------------------------------------------------------
// Agent Track — An agent's full navigational state
// ---------------------------------------------------------------------------

export interface AgentTrack {
  agentId: string;
  trackline: Trackline;
  /** Current or last-known pace in knots. */
  pace: number;
  /** Current heading in degrees. */
  heading: Heading;
  /** Task density around this agent (tasks per minute). */
  taskDensity: number;
  /** Whether the agent is currently active. */
  active: boolean;
}

/**
 * Create an AgentTrack from an initial position.
 */
export function createAgentTrack(
  agentId: string,
  initialPosition: Position,
  pace = STANDARD_PACE,
  heading: Heading = 0,
): AgentTrack {
  const trackline = new Trackline();
  trackline.addPoint({
    position: initialPosition,
    timestamp: Date.now(),
    quality: 'good',
  });
  return {
    agentId,
    trackline,
    pace,
    heading,
    taskDensity: 0,
    active: true,
  };
}

// ---------------------------------------------------------------------------
// Task Heat Zone — Where the work is concentrated
// ---------------------------------------------------------------------------

export interface HeatZone {
  center: Position;
  radius: number;       // boat-lengths
  intensity: number;    // 0-1, how concentrated the work is
  label: string;
}

// ---------------------------------------------------------------------------
// Radar Pulse — Periodic observation, not constant feed
// ---------------------------------------------------------------------------

/**
 * A single radar sweep observation of another agent.
 */
export interface RadarContact {
  agentId: string;
  position: Position;
  range: number;        // boat-lengths from observer
  bearing: number;      // degrees from observer
  timestamp: number;
}

/**
 * The radar does NOT stream. It pulses.
 * Each pulse captures a snapshot. 2-3 pulses establish direction and speed.
 *
 * "The pulse is a tool, not a limitation."
 */
export class RadarPulse {
  private contacts: RadarContact[][] = [];  // array of sweeps
  private lastPulseTime = 0;
  private readonly pulseIntervalMs: number;

  constructor(pulseIntervalMs = DEFAULT_PULSE_INTERVAL_MS) {
    this.pulseIntervalMs = pulseIntervalMs;
  }

  /**
   * Whether enough time has passed for the next pulse.
   */
  shouldPulse(now = Date.now()): boolean {
    return now - this.lastPulseTime >= this.pulseIntervalMs;
  }

  /**
   * Record a radar sweep — all contacts observed in one pulse.
   */
  recordSweep(contacts: RadarContact[]): void {
    this.contacts.push(contacts);
    this.lastPulseTime = Date.now();
    // Keep only last 10 sweeps
    if (this.contacts.length > 10) {
      this.contacts.shift();
    }
  }

  /**
   * Get the last N sweeps for trend analysis.
   */
  getRecentSweeps(count = 3): RadarContact[][] {
    return this.contacts.slice(-count);
  }

  /**
   * Extract velocity (direction + speed) for a specific agent
   * from 2-3 consecutive sweeps.
   *
   * Two bearings establish a line. Three establish a trend.
   */
  extractTrend(agentId: string): { velocity: Velocity; confidence: number } | null {
    const sweeps = this.getRecentSweeps(3);
    const positions: Array<{ pos: Position; time: number }> = [];

    for (const sweep of sweeps) {
      const contact = sweep.find(c => c.agentId === agentId);
      if (contact) {
        positions.push({ pos: contact.position, time: contact.timestamp });
      }
    }

    if (positions.length < 2) {
      return null;
    }

    // Compute heading from first to last observed position
    const head = bearing(positions[0].pos, positions[positions.length - 1].pos);

    // Compute pace from distance and time
    const dist = distance(positions[0].pos, positions[positions.length - 1].pos);
    const timeMin = (positions[positions.length - 1].time - positions[0].time) / 60000;
    let pace = STANDARD_PACE;
    if (timeMin > 0) {
      const blPerMin = dist / timeMin;
      pace = blPerMin / BOAT_LENGTHS_PER_MIN;
    }

    // Confidence scales with number of observations
    const confidence = Math.min(1, positions.length / 3);

    return {
      velocity: { pace, heading: head },
      confidence,
    };
  }

  /**
   * Total number of sweeps recorded.
   */
  sweepCount(): number {
    return this.contacts.length;
  }

  /**
   * Time since last pulse, in ms.
   */
  timeSinceLastPulse(now = Date.now()): number {
    return now - this.lastPulseTime;
  }
}

// ---------------------------------------------------------------------------
// Sounder Mark — Incoming work on the vertical scope
// ---------------------------------------------------------------------------

export interface SounderMark {
  /** Distance in boat-lengths (time-of-flight → vertical position). */
  depth: number;
  /** Intensity of the return (task priority/size). */
  intensity: number;
  /** Type label. */
  label: string;
  /** Timestamp when the mark first appeared. */
  timestamp: number;
  /** Whether this mark is still active (not yet handled). */
  active: boolean;
}

/**
 * The Sounder renders incoming tasks as marks on a vertical scope.
 * As the agent works, marks stack sideways into a picture of the "water column."
 *
 * Fish = incoming work items. Bottom = system capacity.
 * The waveform of time becomes an image of the task space.
 */
export class Sounder {
  private marks: SounderMark[] = [];
  private systemCapacityDepth: number;  // how deep the "bottom" is

  constructor(capacityDepth = 50) {
    this.systemCapacityDepth = capacityDepth;
  }

  /**
   * Add an incoming task as a mark on the sounder.
   */
  addMark(mark: Omit<SounderMark, 'timestamp' | 'active'>): SounderMark {
    const fullMark: SounderMark = {
      ...mark,
      timestamp: Date.now(),
      active: true,
    };
    this.marks.push(fullMark);
    // Keep only recent marks (last 100)
    if (this.marks.length > 100) {
      this.marks.shift();
    }
    return fullMark;
  }

  /**
   * Mark a task as handled (the mark fades from the scope).
   */
  resolveMark(index: number): void {
    if (index >= 0 && index < this.marks.length) {
      this.marks[index].active = false;
    }
  }

  /**
   * Get all visible marks (for rendering the water column).
   */
  getMarks(): SounderMark[] {
    return [...this.marks];
  }

  /**
   * Get active (unresolved) marks only.
   */
  getActiveMarks(): SounderMark[] {
    return this.marks.filter(m => m.active);
  }

  /**
   * The bottom of the sounder — system capacity.
   */
  getCapacityDepth(): number {
    return this.systemCapacityDepth;
  }

  /**
   * How full is the water column? (0 = empty, 1 = at capacity)
   */
  columnFill(): number {
    const active = this.getActiveMarks();
    if (active.length === 0) return 0;
    const totalDepth = active.reduce((sum, m) => sum + m.depth, 0);
    const maxDepth = active.length * this.systemCapacityDepth;
    return maxDepth > 0 ? totalDepth / maxDepth : 0;
  }
}

// ---------------------------------------------------------------------------
// Current Field — Where the work flows
// ---------------------------------------------------------------------------

export interface CurrentVector {
  position: Position;
  direction: number;   // degrees
  strength: number;    // 0-1
}

/**
 * The path of least resistance.
 *
 * The terminal doesn't plan routes. It shows positioning.
 * The agent positions themselves so the current of work carries them
 * where they want to go.
 *
 * "The work is in the positioning. The rest is letting the substrate do what it does."
 */
export interface CurrentField {
  vectors: CurrentVector[];
  /** Positions where work is stuck (eddies). */
  eddies: Position[];
  /** Positions with high potential (open water). */
  openWater: Position[];
}

/**
 * Compute the path of least resistance — the heading that best aligns
 * with the current field while moving toward the goal.
 *
 * The right action is the one that aligns with the current.
 */
export function computeOptimalHeading(
  currentPos: Position,
  goalPos: Position,
  field: CurrentField,
): { heading: Heading; alignment: number; resistance: number } {
  const goalBearing = bearing(currentPos, goalPos);
  const goalRad = goalBearing * Math.PI / 180;

  // Find nearby current vectors
  let totalCurrentX = 0;
  let totalCurrentY = 0;
  let influenceCount = 0;

  for (const v of field.vectors) {
    const dist = distance(currentPos, v.position);
    if (dist < 30) {  // within influence range
      const weight = v.strength * (1 - dist / 30);
      const rad = v.direction * Math.PI / 180;
      totalCurrentX += Math.sin(rad) * weight;
      totalCurrentY += Math.cos(rad) * weight;
      influenceCount++;
    }
  }

  // Average current direction
  let currentBearing = goalBearing;
  if (influenceCount > 0) {
    currentBearing = (Math.atan2(totalCurrentX, totalCurrentY) * 180 / Math.PI + 360) % 360;
  }

  // Check if any eddies block the goal path
  let resistance = 0;
  for (const eddy of field.eddies) {
    const eddyDist = distance(currentPos, eddy);
    if (eddyDist < 15) {
      // Eddy adds resistance proportional to closeness
      resistance += (1 - eddyDist / 15) * 0.5;
    }
  }

  // Check open water bonus
  for (const open of field.openWater) {
    const openDist = distance(currentPos, open);
    if (openDist < 15) {
      // Open water reduces resistance
      resistance *= 0.5;
    }
  }

  // Optimal heading: blend goal bearing with current bearing
  // When current is strong, lean into it more (lower resistance)
  const currentWeight = influenceCount > 0 ? Math.min(0.4, influenceCount * 0.1) : 0;
  const goalWeight = 1 - currentWeight;

  let blendedHeading = goalBearing * goalWeight + currentBearing * currentWeight;
  blendedHeading = ((blendedHeading % 360) + 360) % 360;

  // Alignment: how well does the optimal heading match the goal?
  const alignmentDiff = Math.abs(((blendedHeading - goalBearing + 540) % 360) - 180);
  const alignment = 1 - (alignmentDiff / 180);

  return {
    heading: blendedHeading,
    alignment,
    resistance: Math.min(1, resistance),
  };
}

// ---------------------------------------------------------------------------
// The Navigator's Terminal — Three Views, One Field
// ---------------------------------------------------------------------------

/**
 * The complete navigational display for an agent in the task space.
 *
 * THE CHART:     top-down view with trackline, predictor, heat zones, other agents.
 * THE SOUNDER:   vertical scope showing incoming work as marks.
 * THE RADAR:     periodic pulse showing other agents' positions.
 *
 * "What you see on the chart matches what you see on the radar.
 *  What you see on the sounder maps to task density on the chart."
 */
export class NavigatorTerminal {
  readonly agentId: string;

  /** The agent's own track through the task space. */
  track: AgentTrack;

  /** Other agents visible in the field. */
  otherAgents: Map<string, AgentTrack> = new Map();

  /** The radar — periodic pulse observation. */
  radar: RadarPulse;

  /** The sounder — incoming work items. */
  sounder: Sounder;

  /** The predictor — 5-minute line. */
  predictor: Predictor;

  /** Task density heat zones on the chart. */
  heatZones: HeatZone[] = [];

  /** The current field — where work flows, where it's stuck. */
  currentField: CurrentField;

  /** View configuration. */
  viewConfig: ViewConfig;

  constructor(
    agentId: string,
    initialPosition: Position = { x: 0, y: 0 },
    opts?: {
      pace?: number;
      heading?: Heading;
      pulseIntervalMs?: number;
      sounderCapacity?: number;
    },
  ) {
    this.agentId = agentId;
    this.track = createAgentTrack(agentId, initialPosition, opts?.pace, opts?.heading);
    this.radar = new RadarPulse(opts?.pulseIntervalMs ?? DEFAULT_PULSE_INTERVAL_MS);
    this.sounder = new Sounder(opts?.sounderCapacity ?? 50);
    this.predictor = new Predictor();
    this.currentField = { vectors: [], eddies: [], openWater: [] };
    this.viewConfig = {
      chartZoom: 1.0,
      sounderRange: 50,
      radarRange: 40,
      showHeatZones: true,
      showPredictors: true,
    };
  }

  // -------------------------------------------------------------------------
  // THE CHART — Top-down spatial view
  // -------------------------------------------------------------------------

  /**
   * Get the chart data — all elements to render in the top-down view.
   */
  getChartView(): ChartView {
    const myPosition = this.track.trackline.currentPosition();
    const myHeading = this.track.heading;
    const myPace = this.track.pace;

    // My trackline
    const trackline = this.track.trackline.getPoints();

    // My predictor
    const predictionLine = this.predictor.predictionLine(myPosition, myHeading, myPace);

    // Other agents as dots
    const contacts = Array.from(this.otherAgents.values()).map(track => ({
      agentId: track.agentId,
      position: track.trackline.currentPosition(),
      pace: track.pace,
      heading: track.heading,
      active: track.active,
    }));

    return {
      self: {
        agentId: this.agentId,
        position: myPosition,
        heading: myHeading,
        pace: myPace,
      },
      trackline,
      predictionLine,
      contacts,
      heatZones: this.heatZones,
      currentField: this.currentField,
    };
  }

  // -------------------------------------------------------------------------
  // THE SOUNDER — Vertical time-of-flight view
  // -------------------------------------------------------------------------

  /**
   * Get the sounder data — marks on the vertical scope.
   */
  getSounderView(): SounderView {
    return {
      marks: this.sounder.getMarks(),
      activeMarks: this.sounder.getActiveMarks(),
      capacityDepth: this.sounder.getCapacityDepth(),
      columnFill: this.sounder.columnFill(),
    };
  }

  // -------------------------------------------------------------------------
  // THE RADAR — Periodic pulse view
  // -------------------------------------------------------------------------

  /**
   * Get the radar data — contacts from recent sweeps.
   */
  getRadarView(): RadarView {
    const sweeps = this.radar.getRecentSweeps(3);
    const trends = new Map<string, { velocity: Velocity; confidence: number }>();

    // Extract trends for all observed agents
    const observedIds = new Set<string>();
    for (const sweep of sweeps) {
      for (const contact of sweep) {
        observedIds.add(contact.agentId);
      }
    }

    for (const id of observedIds) {
      const trend = this.radar.extractTrend(id);
      if (trend) trends.set(id, trend);
    }

    return {
      sweeps,
      trends,
      pulseIntervalMs: this.radar['pulseIntervalMs'],
      timeSinceLastPulse: this.radar.timeSinceLastPulse(),
      totalSweeps: this.radar.sweepCount(),
    };
  }

  // -------------------------------------------------------------------------
  // UPDATE — Called on each pulse cycle
  // -------------------------------------------------------------------------

  /**
   * Update the terminal. Called on the pulse cycle — NOT constantly.
   *
   * Each pulse: observe the field, update positions, extract trends.
   * 2-3 pulses: direction and speed established for all visible agents.
   */
  pulse(now = Date.now()): void {
    if (!this.radar.shouldPulse(now)) return;

    const myPos = this.track.trackline.currentPosition();

    // Sweep: record all visible agents
    const contacts: RadarContact[] = [];
    for (const [id, track] of this.otherAgents) {
      const theirPos = track.trackline.currentPosition();
      contacts.push({
        agentId: id,
        position: { ...theirPos },
        range: distance(myPos, theirPos),
        bearing: bearing(myPos, theirPos),
        timestamp: now,
      });
    }
    this.radar.recordSweep(contacts);

    // Update heat zones based on task density
    this.updateHeatZones();
  }

  /**
   * Move the agent's own track through the task space.
   */
  move(deltaBoatLengths: number, heading: Heading, quality: 'good' | 'poor' = 'good', taskLabel?: string): void {
    const current = this.track.trackline.currentPosition();
    const rad = heading * Math.PI / 180;
    const newPos: Position = {
      x: current.x + Math.sin(rad) * deltaBoatLengths,
      y: current.y + Math.cos(rad) * deltaBoatLengths,
    };
    this.track.heading = heading;
    this.track.trackline.addPoint({
      position: newPos,
      timestamp: Date.now(),
      quality,
      taskLabel,
    });
  }

  /**
   * Update another agent's known position (from radar, comms, etc).
   */
  updateOtherAgent(agentId: string, position: Position, pace?: number, heading?: Heading): void {
    let track = this.otherAgents.get(agentId);
    if (!track) {
      track = createAgentTrack(agentId, position, pace, heading);
      this.otherAgents.set(agentId, track);
    } else {
      if (pace !== undefined) track.pace = pace;
      if (heading !== undefined) track.heading = heading;
      track.trackline.addPoint({
        position,
        timestamp: Date.now(),
        quality: 'good',
      });
    }
  }

  /**
   * Add an incoming task to the sounder.
   */
  addIncomingTask(label: string, depth: number, intensity: number): void {
    this.sounder.addMark({ label, depth, intensity });
  }

  /**
   * Resolve a task on the sounder.
   */
  resolveTask(index: number): void {
    this.sounder.resolveMark(index);
  }

  /**
   * Set the current field (where work flows).
   */
  setCurrentField(field: CurrentField): void {
    this.currentField = field;
  }

  /**
   * Find the path of least resistance for a given goal.
   */
  findOptimalHeading(goal: Position): { heading: Heading; alignment: number; resistance: number } {
    return computeOptimalHeading(
      this.track.trackline.currentPosition(),
      goal,
      this.currentField,
    );
  }

  /**
   * Get the visual proportions that make the right action obvious.
   * These are NOT numbers to display — they're relationships the eye sees.
   */
  getVisualProportions(): VisualProportions {
    const myPos = this.track.trackline.currentPosition();

    // Proportion of trackline that was productive
    const total = this.track.trackline.getPoints().length;
    const good = this.track.trackline.goodPulls();
    const poor = this.track.trackline.poorPulls();
    const goodRatio = total > 0 ? good / total : 0;

    // Soak time proportion — how long current heading held vs retention window
    const soak = this.track.trackline.soakTimeMinutes();
    const soakRatio = Math.min(1, soak / TRACKLINE_RETENTION_MINUTES);

    // Predictor alignment with nearest heat zone (is work ahead?)
    const predictorPoint = this.predictor.predict(myPos, this.track.heading, this.track.pace);
    let nearestZoneDist = Infinity;
    let alignedZone: HeatZone | null = null;
    for (const zone of this.heatZones) {
      const d = distance(predictorPoint.position, zone.center);
      if (d < nearestZoneDist) {
        nearestZoneDist = d;
        alignedZone = zone;
      }
    }

    // Sounder fill — how much work is incoming
    const sounderFill = this.sounder.columnFill();

    // Other agents — nearest contact distance
    let nearestContactDist = Infinity;
    let nearestContactId: string | null = null;
    for (const [id, track] of this.otherAgents) {
      const d = distance(myPos, track.trackline.currentPosition());
      if (d < nearestContactDist) {
        nearestContactDist = d;
        nearestContactId = id;
      }
    }

    // Current alignment — how well positioned is the agent?
    let currentAlignment = 0;
    if (alignedZone) {
      const optimal = this.findOptimalHeading(alignedZone.center);
      currentAlignment = optimal.alignment;
    }

    return {
      productiveRatio: goodRatio,
      goodPulls: good,
      poorPulls: poor,
      soakTimeMinutes: soak,
      soakRatio,
      predictorZoneDistance: nearestZoneDist,
      predictorZoneAligned: alignedZone,
      sounderFill,
      nearestContactDistance: nearestContactDist,
      nearestContactId,
      currentAlignment,
    };
  }

  /**
   * Update heat zones based on agent positions and task density.
   * @private
   */
  private updateHeatZones(): void {
    // Generate heat zones around agents with high task density
    const zones: HeatZone[] = [];

    for (const track of [this.track, ...this.otherAgents.values()]) {
      if (track.taskDensity > 0.3) {
        zones.push({
          center: track.trackline.currentPosition(),
          radius: 5 + track.taskDensity * 15,
          intensity: track.taskDensity,
          label: track.agentId,
        });
      }
    }

    // Merge overlapping zones (simple: keep highest intensity)
    this.heatZones = zones;
  }
}

// ---------------------------------------------------------------------------
// View Types (for rendering)
// ---------------------------------------------------------------------------

export interface ViewConfig {
  chartZoom: number;
  sounderRange: number;
  radarRange: number;
  showHeatZones: boolean;
  showPredictors: boolean;
}

export interface ChartView {
  self: {
    agentId: string;
    position: Position;
    heading: Heading;
    pace: number;
  };
  trackline: Trackpoint[];
  predictionLine: PredictorPoint[];
  contacts: Array<{
    agentId: string;
    position: Position;
    pace: number;
    heading: Heading;
    active: boolean;
  }>;
  heatZones: HeatZone[];
  currentField: CurrentField;
}

export interface SounderView {
  marks: SounderMark[];
  activeMarks: SounderMark[];
  capacityDepth: number;
  columnFill: number;
}

export interface RadarView {
  sweeps: RadarContact[][];
  trends: Map<string, { velocity: Velocity; confidence: number }>;
  pulseIntervalMs: number;
  timeSinceLastPulse: number;
  totalSweeps: number;
}

/**
 * Visual proportions — relationships the eye sees, not numbers to display.
 * "The right action is obvious from the geometry."
 */
export interface VisualProportions {
  productiveRatio: number;       // good pulls / total
  goodPulls: number;
  poorPulls: number;
  soakTimeMinutes: number;
  soakRatio: number;             // soak / retention window
  predictorZoneDistance: number; // how far ahead is the nearest work?
  predictorZoneAligned: HeatZone | null;
  sounderFill: number;           // 0-1 how full is the incoming work scope?
  nearestContactDistance: number;
  nearestContactId: string | null;
  currentAlignment: number;      // 0-1 how well positioned?
}
