// =============================================================================
// INTELLIGENT TERMINAL — Tests
// =============================================================================
// Tests the core tile creation, deadband, and evolution mechanics.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentTerminal, Action, hashAction } from '../systems/intelligent-terminal.js';
import {
  detectPatterns,
  measureSurprise,
  measureGrowth,
  proposeTile,
  simulateActions,
  TileEvolutionTracker,
} from '../systems/tile-evolution.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAction(type: string, category: Action['category'] = 'file', params: Record<string, unknown> = {}): Action {
  return {
    type,
    category,
    params,
    timestamp: new Date().toISOString(),
  };
}

function feedActions(terminal: IntelligentTerminal, actions: Action[]): void {
  for (const action of actions) {
    terminal.observe(action);
  }
}

// ---------------------------------------------------------------------------
// Hash Function
// ---------------------------------------------------------------------------

describe('hashAction', () => {
  it('produces consistent hashes for identical actions', () => {
    const a1 = makeAction('read-file', 'file', { path: '/src/main.ts' });
    const a2 = makeAction('read-file', 'file', { path: '/src/main.ts' });
    expect(hashAction(a1)).toBe(hashAction(a2));
  });

  it('produces different hashes for different action types', () => {
    const a1 = makeAction('read-file');
    const a2 = makeAction('write-file');
    expect(hashAction(a1)).not.toBe(hashAction(a2));
  });

  it('is order-independent for param keys', () => {
    const a1 = makeAction('test', 'code', { a: 1, b: 2 });
    const a2 = makeAction('test', 'code', { b: 2, a: 1 });
    expect(hashAction(a1)).toBe(hashAction(a2));
  });
});

// ---------------------------------------------------------------------------
// Tile Creation
// ---------------------------------------------------------------------------

describe('IntelligentTerminal — Tile Creation', () => {
  let terminal: IntelligentTerminal;

  beforeEach(() => {
    terminal = new IntelligentTerminal('TestAgent');
  });

  it('starts with no tiles', () => {
    expect(terminal.tiles.size).toBe(0);
  });

  it('creates a tile after 3+ repetitions of the same action', () => {
    const action = makeAction('read-file', 'file', { path: '/src/main.ts' });
    terminal.observe(action);
    expect(terminal.tiles.size).toBe(0); // 1st — no tile yet

    terminal.observe(action);
    expect(terminal.tiles.size).toBe(0); // 2nd — still no tile

    terminal.observe(action);
    expect(terminal.tiles.size).toBe(1); // 3rd — tile created!
  });

  it('creates tiles with proper metadata', () => {
    const action = makeAction('run-test', 'code', { suite: 'unit' });
    feedActions(terminal, [action, action, action]);

    const tile = Array.from(terminal.tiles.values())[0];
    expect(tile.label).toBe('Run Test');
    expect(tile.action).toBe('run-test');
    expect(tile.category).toBe('code');
    expect(tile.confidence).toBeGreaterThan(0);
    expect(tile.invocations).toBeGreaterThanOrEqual(1);
    expect(tile.createdFrom).toContain('Repeated');
  });

  it('does not create duplicate tiles for the same action type', () => {
    const action = makeAction('read-file', 'file', { path: '/a.ts' });
    feedActions(terminal, [action, action, action, action, action]);
    expect(terminal.tiles.size).toBe(1);
  });

  it('creates separate tiles for different action types', () => {
    const a1 = makeAction('read-file', 'file', {});
    const a2 = makeAction('write-file', 'file', {});
    feedActions(terminal, [a1, a1, a1, a2, a2, a2]);
    expect(terminal.tiles.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Deadband Mechanics
// ---------------------------------------------------------------------------

describe('IntelligentTerminal — Deadband', () => {
  let terminal: IntelligentTerminal;

  beforeEach(() => {
    terminal = new IntelligentTerminal('TestAgent');
  });

  it('handles actions within the deadband reflexively', () => {
    const action = makeAction('resize', 'system', { width: 100 });
    feedActions(terminal, [action, action, action]);

    const result = terminal.tryTile(action);
    expect(result.handled).toBe(true);
    expect(result.withinDeadband).toBe(true);
  });

  it('handles non-numeric actions as always within deadband', () => {
    const action = makeAction('status-check', 'system', { target: 'server' });
    feedActions(terminal, [action, action, action]);

    const result = terminal.tryTile(action);
    expect(result.handled).toBe(true);
  });

  it('returns unhandled when no tile matches', () => {
    const action = makeAction('unknown-action', 'system', { x: 1 });
    const result = terminal.tryTile(action);
    expect(result.handled).toBe(false);
    expect(result.fallbackReason).toBeDefined();
  });

  it('can expand deadband to accommodate new cases', () => {
    const action = makeAction('resize', 'system', { width: 100 });
    feedActions(terminal, [action, action, action]);

    const tile = Array.from(terminal.tiles.values())[0];
    const originalRange = { ...tile.deadband.inputRange[0] };

    // Expand with a wider value
    const newAction = makeAction('resize', 'system', { width: 500 });
    terminal.expandDeadband(tile.id, newAction);

    const updatedTile = terminal.tiles.get(tile.id)!;
    expect(updatedTile.deadband.inputRange[0].max).toBeGreaterThan(originalRange.max);
  });
});

// ---------------------------------------------------------------------------
// Surprise and Coverage
// ---------------------------------------------------------------------------

describe('IntelligentTerminal — Surprise & Coverage', () => {
  let terminal: IntelligentTerminal;

  beforeEach(() => {
    terminal = new IntelligentTerminal('TestAgent');
  });

  it('starts at surprise=1.0, coverage=0.0', () => {
    expect(terminal.getSurprise()).toBe(1.0);
    expect(terminal.getReflexCoverage()).toBe(0.0);
  });

  it('reduces surprise as tiles form', () => {
    // Feed 20 actions of the same type
    for (let i = 0; i < 20; i++) {
      terminal.observe(makeAction('read-file', 'file', { path: `/f${i}.ts` }));
    }
    // After 20 same-type actions, most should be handled
    expect(terminal.getSurprise()).toBeLessThan(1.0);
    expect(terminal.getReflexCoverage()).toBeGreaterThan(0.0);
  });

  it('keeps surprise high with novel actions', () => {
    for (let i = 0; i < 20; i++) {
      terminal.observe(makeAction(`unique-action-${i}`, 'analysis', { x: i }));
    }
    // All actions are novel — surprise stays high
    expect(terminal.getSurprise()).toBeGreaterThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// Tile Composition
// ---------------------------------------------------------------------------

describe('IntelligentTerminal — Tile Composition', () => {
  it('can compose a chain of tiles', () => {
    const terminal = new IntelligentTerminal('TestAgent');

    // Create tiles for a few actions
    const actions = [
      makeAction('read-file', 'file', { path: '/a' }),
      makeAction('parse', 'analysis', { format: 'json' }),
      makeAction('write-file', 'file', { path: '/b' }),
    ];

    const chain = terminal.composeChain(actions);
    expect(chain.length).toBe(3);
    expect(terminal.tiles.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('IntelligentTerminal — Stats', () => {
  it('returns comprehensive stats', () => {
    const terminal = new IntelligentTerminal('TestAgent');
    const actions = simulateActions('TestAgent', 30, 0.3);
    feedActions(terminal, actions);

    const stats = terminal.getStats();
    expect(stats.totalActions).toBe(30);
    expect(stats.totalTiles).toBeGreaterThan(0);
    expect(stats.surprise).toBeGreaterThanOrEqual(0);
    expect(stats.surprise).toBeLessThanOrEqual(1);
    expect(stats.reflexCoverage).toBeGreaterThanOrEqual(0);
    expect(stats.reflexCoverage).toBeLessThanOrEqual(1);
    expect(stats.growthRate).toBeGreaterThan(0);
    expect(stats.tilesByCategory).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tile Evolution Tracker
// ---------------------------------------------------------------------------

describe('TileEvolutionTracker', () => {
  it('tracks growth snapshots', () => {
    const terminal = new IntelligentTerminal('TestAgent');
    const tracker = new TileEvolutionTracker('TestAgent');

    // Feed actions and take snapshots
    for (let batch = 0; batch < 5; batch++) {
      const actions = simulateActions('TestAgent', 20, 0.2);
      feedActions(terminal, actions);
      tracker.snapshot(terminal);
    }

    expect(tracker.growthHistory.length).toBe(5);
    expect(tracker.growthHistory[0].totalActions).toBe(20);
    expect(tracker.growthHistory[4].totalActions).toBe(100);
  });

  it('computes the fish curve', () => {
    const terminal = new IntelligentTerminal('TestAgent');
    const tracker = new TileEvolutionTracker('TestAgent');

    for (let batch = 0; batch < 10; batch++) {
      const actions = simulateActions('TestAgent', 20, 0.15);
      feedActions(terminal, actions);
      tracker.snapshot(terminal);
    }

    const curve = tracker.getFishCurve();
    expect(curve.points.length).toBe(10);
    expect(curve.areaUnderSurprise).toBeGreaterThan(0);
    // Coverage should generally increase over time
    expect(curve.points[9].coverage).toBeGreaterThanOrEqual(curve.points[0].coverage);
  });
});

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

describe('detectPatterns', () => {
  it('finds patterns with 3+ occurrences', () => {
    const terminal = new IntelligentTerminal('TestAgent');
    const actions = [
      makeAction('read-file', 'file', { p: '/a' }),
      makeAction('read-file', 'file', { p: '/a' }),
      makeAction('read-file', 'file', { p: '/a' }),
      makeAction('novel', 'analysis', { x: 1 }),
    ];
    feedActions(terminal, actions);

    const patterns = detectPatterns(terminal.recentActions);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.actionType === 'read-file')).toBe(true);
  });

  it('ignores patterns below threshold', () => {
    const terminal = new IntelligentTerminal('TestAgent');
    const actions = [
      makeAction('rare', 'analysis', {}),
      makeAction('rare', 'analysis', {}),
    ];
    feedActions(terminal, actions);

    const patterns = detectPatterns(terminal.recentActions);
    expect(patterns.find(p => p.actionType === 'rare')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

describe('simulateActions', () => {
  it('generates the requested number of actions', () => {
    const actions = simulateActions('TestAgent', 50, 0.2);
    expect(actions.length).toBe(50);
  });

  it('includes some novel actions based on noveltyRate', () => {
    const actions = simulateActions('TestAgent', 100, 0.5);
    const types = new Set(actions.map(a => a.type));
    expect(types.size).toBeGreaterThan(10); // lots of variety with 50% novelty
  });

  it('produces mostly repeated actions with low novelty', () => {
    const actions = simulateActions('TestAgent', 100, 0.05);
    const types = new Set(actions.map(a => a.type));
    expect(types.size).toBeLessThan(15); // mostly the same action types
  });
});
