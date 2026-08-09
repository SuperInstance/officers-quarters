// =============================================================================
// TILE EVOLUTION TRACKER
// =============================================================================
// Tracks how tiles form, grow, and compose over time.
// Implements the fish identification curve:
//   - Starts at surprise=1.0, coverage=0.0
//   - Over time, surprise decreases and coverage increases
//   - Each novel situation outside the deadband is a learning opportunity
// =============================================================================

import {
  Action,
  ActionLog,
  Tile,
  IntelligentTerminal,
  hashAction,
} from './intelligent-terminal.js';

// ---------------------------------------------------------------------------
// Evolution Event Types
// ---------------------------------------------------------------------------

export type EvolutionEventType =
  | 'tile_created'         // new tile formed
  | 'tile_invoked'         // tile used reflexively
  | 'tile_expanded'        // deadband widened
  | 'tile_split'           // tile divided into narrower tiles
  | 'tile_composed'        // tile chained into a sequence
  | 'surprise_spike'       // unexpected input outside all tiles
  | 'confidence_gained'    // tile proved reliable
  | 'coverage_milestone';  // reflex coverage crossed a threshold

export interface EvolutionEvent {
  type: EvolutionEventType;
  timestamp: string;
  tileId?: string;
  agentId: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface GrowthSnapshot {
  timestamp: string;
  tileCount: number;
  surprise: number;
  reflexCoverage: number;
  totalActions: number;
}

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

export interface PatternMatch {
  hash: string;
  actionType: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  hasTile: boolean;
}

/**
 * Find action patterns that could become tiles.
 * A pattern is any action hash that appears 3+ times.
 */
export function detectPatterns(actionLog: ActionLog[]): PatternMatch[] {
  const buckets = new Map<string, PatternMatch>();

  for (const entry of actionLog) {
    const existing = buckets.get(entry.hash);
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = entry.action.timestamp;
    } else {
      buckets.set(entry.hash, {
        hash: entry.hash,
        actionType: entry.action.type,
        occurrences: 1,
        firstSeen: entry.action.timestamp,
        lastSeen: entry.action.timestamp,
        hasTile: false,
      });
    }
  }

  // Mark patterns that already have tiles
  for (const entry of actionLog) {
    if (entry.tileMatched) {
      const pattern = buckets.get(entry.hash);
      if (pattern) pattern.hasTile = true;
    }
  }

  return Array.from(buckets.values())
    .filter(p => p.occurrences >= 3)
    .sort((a, b) => b.occurrences - a.occurrences);
}

// ---------------------------------------------------------------------------
// Tile Proposal
// ---------------------------------------------------------------------------

export interface TileProposal {
  actionType: string;
  label: string;
  occurrences: number;
  confidence: number;      // proposed initial confidence
  reason: string;
  estimatedDeadband: { min: number; max: number };
}

/**
 * Propose a new tile from a detected pattern.
 */
export function proposeTile(pattern: PatternMatch): TileProposal {
  return {
    actionType: pattern.actionType,
    label: pattern.actionType
      .split(/[-_\s]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    occurrences: pattern.occurrences,
    confidence: Math.min(0.5, 0.2 + pattern.occurrences * 0.05),
    reason: `Action "${pattern.actionType}" repeated ${pattern.occurrences} times since ${pattern.firstSeen}`,
    estimatedDeadband: { min: 0, max: 1 },
  };
}

// ---------------------------------------------------------------------------
// Surprise Measurement
// ---------------------------------------------------------------------------

/**
 * Measure the current surprise level of a terminal.
 * Returns a value from 0 (everything is familiar) to 1 (everything is novel).
 *
 * THE FISH IDENTIFICATION CURVE:
 * - Day 1: every fish is a surprise. surprise = 1.0
 * - Week 2: most common fish are recognized. surprise = 0.3
 * - Month 3: only rare fish trigger surprise. surprise = 0.05
 * - The area under the surprise curve = total learning effort
 */
export function measureSurprise(terminal: IntelligentTerminal): {
  current: number;
  trend: number[];       // last N surprise values
  novelActions: number;
  totalActions: number;
} {
  const current = terminal.getSurprise();
  const recentActions = terminal.recentActions;
  const novelActions = recentActions.filter(a => !a.tileMatched).length;

  // Calculate a rolling surprise trend
  const windowSize = 20;
  const trend: number[] = [];

  for (let i = 0; i < recentActions.length; i += windowSize) {
    const window = recentActions.slice(i, i + windowSize);
    const novel = window.filter(a => !a.tileMatched).length;
    trend.push(novel / window.length);
  }

  return {
    current,
    trend,
    novelActions,
    totalActions: recentActions.length,
  };
}

// ---------------------------------------------------------------------------
// Growth Measurement
// ---------------------------------------------------------------------------

/**
 * Measure the reflex coverage growth of a terminal over time.
 * Returns the curve from 0 → 1 as tiles accumulate.
 */
export function measureGrowth(terminal: IntelligentTerminal): {
  current: number;
  trend: number[];       // rolling coverage values
  tilesCreated: number;
  milestones: number[];  // thresholds crossed: 0.1, 0.25, 0.5, 0.75, 0.9
} {
  const current = terminal.getReflexCoverage();
  const recentActions = terminal.recentActions;
  const windowSize = 20;
  const trend: number[] = [];

  for (let i = 0; i < recentActions.length; i += windowSize) {
    const window = recentActions.slice(i, i + windowSize);
    const handled = window.filter(a => a.tileMatched).length;
    trend.push(handled / window.length);
  }

  const milestones = [0.1, 0.25, 0.5, 0.75, 0.9].filter(
    m => current >= m
  );

  return {
    current,
    trend,
    tilesCreated: terminal.tiles.size,
    milestones,
  };
}

// ---------------------------------------------------------------------------
// Tile Evolution Tracker
// ---------------------------------------------------------------------------

export class TileEvolutionTracker {
  readonly agentId: string;
  readonly events: EvolutionEvent[] = [];
  readonly growthHistory: GrowthSnapshot[] = [];
  private lastSnapshotTime = 0;
  private readonly snapshotInterval = 10000; // 10 seconds in ms

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Record an evolution event.
   */
  record(event: EvolutionEvent): void {
    this.events.push(event);
  }

  /**
   * Take a snapshot of terminal growth.
   */
  snapshot(terminal: IntelligentTerminal): GrowthSnapshot {
    const stats = terminal.getStats();
    const snapshot: GrowthSnapshot = {
      timestamp: new Date().toISOString(),
      tileCount: stats.totalTiles,
      surprise: stats.surprise,
      reflexCoverage: stats.reflexCoverage,
      totalActions: stats.totalActions,
    };

    this.growthHistory.push(snapshot);
    return snapshot;
  }

  /**
   * Periodically snapshot (called on each action).
   */
  maybeSnapshot(terminal: IntelligentTerminal): GrowthSnapshot | null {
    const now = Date.now();
    if (now - this.lastSnapshotTime < this.snapshotInterval) return null;

    this.lastSnapshotTime = now;
    return this.snapshot(terminal);
  }

  /**
   * Get the surprise/coverage curve — the fish identification curve.
   */
  getFishCurve(): {
    points: Array<{ t: number; surprise: number; coverage: number }>;
    areaUnderSurprise: number;    // total learning effort
    areaUnderCoverage: number;    // total automation achieved
  } {
    const points = this.growthHistory.map((s, i) => ({
      t: i,
      surprise: s.surprise,
      coverage: s.reflexCoverage,
    }));

    // Trapezoidal integration
    let areaUnderSurprise = 0;
    let areaUnderCoverage = 0;
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].t - points[i - 1].t;
      areaUnderSurprise += dt * (points[i].surprise + points[i - 1].surprise) / 2;
      areaUnderCoverage += dt * (points[i].coverage + points[i - 1].coverage) / 2;
    }

    return { points, areaUnderSurprise, areaUnderCoverage };
  }

  /**
   * Get evolution summary for display.
   */
  getSummary(): {
    totalEvents: number;
    tilesCreated: number;
    tilesExpanded: number;
    tilesComposed: number;
    surpriseSpikes: number;
    milestonesReached: number;
    eventsByType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      tilesCreated: byType['tile_created'] || 0,
      tilesExpanded: byType['tile_expanded'] || 0,
      tilesComposed: byType['tile_composed'] || 0,
      surpriseSpikes: byType['surprise_spike'] || 0,
      milestonesReached: byType['coverage_milestone'] || 0,
      eventsByType: byType,
    };
  }
}

// ---------------------------------------------------------------------------
// Simulation: Generate fake actions to demonstrate the curve
// ---------------------------------------------------------------------------

const ACTION_TEMPLATES = [
  { type: 'read-file', category: 'file' as const, params: { path: '/src/main.ts', line: 42 } },
  { type: 'write-file', category: 'file' as const, params: { path: '/src/output.ts', size: 1024 } },
  { type: 'run-test', category: 'code' as const, params: { suite: 'unit', count: 15 } },
  { type: 'deploy', category: 'system' as const, params: { target: 'production', version: 3 } },
  { type: 'search-docs', category: 'analysis' as const, params: { query: 'phaser', results: 5 } },
  { type: 'generate-image', category: 'creative' as const, params: { prompt: 'space station', width: 512 } },
  { type: 'send-message', category: 'comm' as const, params: { channel: 'general', length: 200 } },
  { type: 'poker-bet', category: 'game' as const, params: { amount: 50, hand: 2 } },
  { type: 'analyze-data', category: 'analysis' as const, params: { rows: 1000, columns: 12 } },
  { type: 'create-tile', category: 'system' as const, params: { action: 'read-file', threshold: 3 } },
];

/**
 * Simulate a sequence of actions for an agent, demonstrating the
   * reflex-to-cortex learning curve.
 */
export function simulateActions(
  agentId: string,
  count: number,
  noveltyRate = 0.15
): Action[] {
  const actions: Action[] = [];

  for (let i = 0; i < count; i++) {
    // With probability noveltyRate, generate a novel action type
    const isNovel = Math.random() < noveltyRate;
    const template = isNovel
      ? { type: `novel-action-${i}`, category: 'analysis' as const, params: { x: Math.random() * 100 } }
      : ACTION_TEMPLATES[Math.floor(Math.random() * ACTION_TEMPLATES.length)];

    actions.push({
      type: template.type,
      category: template.category,
      params: { ...template.params },
      timestamp: new Date(Date.now() - (count - i) * 1000).toISOString(),
    });
  }

  return actions;
}
