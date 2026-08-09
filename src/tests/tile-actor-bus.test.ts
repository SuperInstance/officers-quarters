// =============================================================================
// TILE ACTOR BUS — Tests
// =============================================================================
// Verifies:
// 1. Tiles compete — multiple tiles respond to the same action
// 2. The fittest reflex wins (specificity > confidence > latency)
// 3. Deadband violations escalate to cortex
// 4. New tiles can be installed at runtime
// 5. Feedback flows correctly (accepted, rejected, corrected_by_cortex)
// 6. Evolutionary arbiter applies natural selection over time
// 7. Concrete tiles work correctly (salmon, verb, poker)
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageBus,
  TerminalBus,
  TileScoreboard,
  evolutionaryArbiter,
  defaultArbiter,
  defaultCortex,
  MIN_CONFIDENCE,
  type BusAction,
  type TileActor,
  type ReflexResult,
  type TileFeedback,
  type DeadbandViolation,
  type CortexHandler,
} from '../systems/tile-actor-bus.js';
import {
  IdentifySalmonTile,
  VerbResolverTile,
  PokerBetTile,
} from '../systems/tile-actors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let actionCounter = 0;
function makeAction(type: string, payload: unknown): BusAction {
  actionCounter++;
  return {
    id: `act-${actionCounter}`,
    type,
    payload,
    timestamp: Date.now(),
  };
}

/** A test tile that always responds with a fixed reflex. */
function makeFakeTile(
  id: string,
  actionTypes: string[],
  opts: {
    confidence?: number;
    specificity?: number;
    latencyMs?: number;
    output?: unknown;
  } = {},
): TileActor {
  const { confidence = 0.8, specificity = 0.7, latencyMs = 1, output = { ok: true } } = opts;
  return {
    id,
    deadband: {
      actionTypes,
      matcher: (a) => actionTypes.includes(a.type),
    },
    onAction(action) {
      return {
        tileId: id,
        actionId: action.id,
        output,
        confidence,
        specificity,
        latencyMs,
      };
    },
    onFeedback: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// 1. MessageBus
// ---------------------------------------------------------------------------

describe('MessageBus', () => {
  it('delivers messages to subscribers', () => {
    const bus = new MessageBus();
    const received: string[] = [];
    bus.subscribe<string>('test', (msg) => received.push(msg));
    bus.publish('test', 'hello');
    expect(received).toEqual(['hello']);
  });

  it('supports multiple subscribers', () => {
    const bus = new MessageBus();
    let a = '';
    let b = '';
    bus.subscribe('ch', (msg: string) => (a = msg));
    bus.subscribe('ch', (msg: string) => (b = msg));
    bus.publish('ch', 'msg');
    expect(a).toBe('msg');
    expect(b).toBe('msg');
  });

  it('unsubscribe stops delivery', () => {
    const bus = new MessageBus();
    const received: string[] = [];
    const unsub = bus.subscribe<string>('ch', (msg) => received.push(msg));
    bus.publish('ch', 'before');
    unsub();
    bus.publish('ch', 'after');
    expect(received).toEqual(['before']);
  });

  it('reports subscriber count', () => {
    const bus = new MessageBus();
    expect(bus.subscriberCount('ch')).toBe(0);
    const u1 = bus.subscribe('ch', () => {});
    expect(bus.subscriberCount('ch')).toBe(1);
    const u2 = bus.subscribe('ch', () => {});
    expect(bus.subscriberCount('ch')).toBe(2);
    u1();
    expect(bus.subscriberCount('ch')).toBe(1);
    u2();
    expect(bus.subscriberCount('ch')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Tile Competition & Arbitration
// ---------------------------------------------------------------------------

describe('Tile Competition', () => {
  let terminal: TerminalBus;

  beforeEach(() => {
    actionCounter = 0;
    terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
  });

  it('single tile handles matching action', async () => {
    const tile = makeFakeTile('t1', ['greet'], { confidence: 0.9, output: { msg: 'hi' } });
    terminal.installTile(tile);

    const result = await terminal.dispatch(makeAction('greet', { name: 'world' }));

    expect(result.mode).toBe('reflex');
    expect(result.output).toEqual({ msg: 'hi' });
    expect(result.winner?.tileId).toBe('t1');
  });

  it('multiple tiles compete — most specific wins', async () => {
    const general = makeFakeTile('general', ['cmd'], { confidence: 0.9, specificity: 0.5 });
    const specific = makeFakeTile('specific', ['cmd'], { confidence: 0.9, specificity: 0.9 });
    terminal.installTile(general);
    terminal.installTile(specific);

    const result = await terminal.dispatch(makeAction('cmd', {}));

    expect(result.mode).toBe('reflex');
    expect(result.winner?.tileId).toBe('specific');
  });

  it('confidence breaks tie when specificity is equal', async () => {
    const t1 = makeFakeTile('t1', ['cmd'], { confidence: 0.7, specificity: 0.8 });
    const t2 = makeFakeTile('t2', ['cmd'], { confidence: 0.95, specificity: 0.8 });
    terminal.installTile(t1);
    terminal.installTile(t2);

    const result = await terminal.dispatch(makeAction('cmd', {}));

    expect(result.winner?.tileId).toBe('t2');
  });

  it('latency breaks tie when specificity and confidence are equal', async () => {
    const t1 = makeFakeTile('t1', ['cmd'], { confidence: 0.9, specificity: 0.8, latencyMs: 5 });
    const t2 = makeFakeTile('t2', ['cmd'], { confidence: 0.9, specificity: 0.8, latencyMs: 1 });
    terminal.installTile(t1);
    terminal.installTile(t2);

    const result = await terminal.dispatch(makeAction('cmd', {}));

    expect(result.winner?.tileId).toBe('t2');
  });

  it('tiles that do not match action type stay silent', async () => {
    const fishTile = makeFakeTile('fish', ['identify-fish']);
    const verbTile = makeFakeTile('verb', ['resolve-verb']);
    terminal.installTile(fishTile);
    terminal.installTile(verbTile);

    const result = await terminal.dispatch(makeAction('identify-fish', { size: 30 }));

    expect(result.mode).toBe('reflex');
    expect(result.winner?.tileId).toBe('fish');
  });
});

// ---------------------------------------------------------------------------
// 3. Deadband Violations
// ---------------------------------------------------------------------------

describe('Deadband Violations', () => {
  let terminal: TerminalBus;

  beforeEach(() => {
    actionCounter = 0;
    terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
  });

  it('no tile claims action → cortex handles it', async () => {
    const tile = makeFakeTile('t1', ['known-type']);
    terminal.installTile(tile);

    const result = await terminal.dispatch(makeAction('unknown-type', {}));

    expect(result.mode).toBe('cortex');
    expect(result.violation?.reason).toBe('no_claim');
    expect(result.output).toHaveProperty('command', 'cortex_fallback');
  });

  it('all tiles below MIN_CONFIDENCE → low_confidence violation', async () => {
    const weakTile = makeFakeTile('weak', ['cmd'], { confidence: 0.3 });
    terminal.installTile(weakTile);

    const result = await terminal.dispatch(makeAction('cmd', {}));

    expect(result.mode).toBe('cortex');
    expect(result.violation?.reason).toBe('low_confidence');
  });

  it('cortex correction is broadcast to all tiles as feedback', async () => {
    const tile1 = makeFakeTile('t1', ['cmd'], { confidence: 0.2 });
    const tile2 = makeFakeTile('t2', ['cmd'], { confidence: 0.1 });
    terminal.installTile(tile1);
    terminal.installTile(tile2);

    await terminal.dispatch(makeAction('cmd', {}));

    expect(tile1.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'corrected_by_cortex' }),
    );
    expect(tile2.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'corrected_by_cortex' }),
    );
  });

  it('custom cortex handler receives the violation', async () => {
    const handledViolations: DeadbandViolation[] = [];
    const customCortex: CortexHandler = {
      async handle(violation) {
        handledViolations.push(violation);
        return { custom: true };
      },
    };
    terminal = new TerminalBus(defaultArbiter, customCortex, { gatherWindowMs: 1 });

    await terminal.dispatch(makeAction('unknown', {}));

    expect(handledViolations).toHaveLength(1);
    expect(handledViolations[0].reason).toBe('no_claim');
  });
});

// ---------------------------------------------------------------------------
// 4. Feedback Flow
// ---------------------------------------------------------------------------

describe('Feedback Flow', () => {
  let terminal: TerminalBus;

  beforeEach(() => {
    actionCounter = 0;
    terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
  });

  it('winner gets accepted feedback', async () => {
    const winner = makeFakeTile('winner', ['cmd'], { confidence: 0.9, specificity: 0.9 });
    terminal.installTile(winner);

    await terminal.dispatch(makeAction('cmd', {}));

    expect(winner.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'accepted' }),
    );
  });

  it('losing tiles get rejected feedback', async () => {
    const winner = makeFakeTile('winner', ['cmd'], { confidence: 0.95, specificity: 0.95 });
    const loser = makeFakeTile('loser', ['cmd'], { confidence: 0.7, specificity: 0.6 });
    terminal.installTile(winner);
    terminal.installTile(loser);

    await terminal.dispatch(makeAction('cmd', {}));

    expect(loser.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected' }),
    );
    expect(winner.onFeedback).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected' }),
    );
  });

  it('feedback includes correction data from cortex', async () => {
    const tile = makeFakeTile('t1', ['cmd'], { confidence: 0.2 });
    terminal.installTile(tile);

    await terminal.dispatch(makeAction('cmd', {}));

    expect(tile.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'corrected_by_cortex',
        correction: expect.anything(),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Runtime Tile Installation / Removal
// ---------------------------------------------------------------------------

describe('Runtime Installation', () => {
  let terminal: TerminalBus;

  beforeEach(() => {
    actionCounter = 0;
    terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
  });

  it('installTile returns an uninstall function', () => {
    const tile = makeFakeTile('t1', ['cmd']);
    const uninstall = terminal.installTile(tile);
    expect(typeof uninstall).toBe('function');
    expect(terminal.tileCount).toBe(1);
    expect(terminal.hasTile('t1')).toBe(true);
  });

  it('uninstall removes the tile', async () => {
    const tile = makeFakeTile('t1', ['cmd'], { confidence: 0.9 });
    const uninstall = terminal.installTile(tile);
    expect(terminal.tileCount).toBe(1);

    uninstall();
    expect(terminal.tileCount).toBe(0);
    expect(terminal.hasTile('t1')).toBe(false);

    // Now the action should go to cortex
    const result = await terminal.dispatch(makeAction('cmd', {}));
    expect(result.mode).toBe('cortex');
  });

  it('can install multiple tiles', () => {
    terminal.installTile(makeFakeTile('t1', ['cmd1']));
    terminal.installTile(makeFakeTile('t2', ['cmd2']));
    terminal.installTile(makeFakeTile('t3', ['cmd3']));
    expect(terminal.tileCount).toBe(3);
  });

  it('newly installed tile immediately handles actions', async () => {
    // First dispatch — no tiles, goes to cortex
    const result1 = await terminal.dispatch(makeAction('cmd', {}));
    expect(result1.mode).toBe('cortex');

    // Install a tile
    const tile = makeFakeTile('t1', ['cmd'], { confidence: 0.9 });
    terminal.installTile(tile);

    // Same action type now gets a reflex
    const result2 = await terminal.dispatch(makeAction('cmd', {}));
    expect(result2.mode).toBe('reflex');
    expect(result2.winner?.tileId).toBe('t1');
  });
});

// ---------------------------------------------------------------------------
// 6. Scoreboard & Evolutionary Arbitration
// ---------------------------------------------------------------------------

describe('Scoreboard & Evolution', () => {
  it('scoreboard tracks accuracy per tile', () => {
    const board = new TileScoreboard();
    board.record('a', 'accepted');
    board.record('a', 'accepted');
    board.record('a', 'corrected_by_cortex');
    expect(board.accuracy('a')).toBeCloseTo(0.667, 2);
    expect(board.attempts('a')).toBe(3);
  });

  it('scoreboard defaults to 0.5 accuracy for unknown tiles', () => {
    const board = new TileScoreboard();
    expect(board.accuracy('unknown')).toBe(0.5);
  });

  it('evolutionary arbiter favors historically accurate tiles', async () => {
    actionCounter = 0;
    const board = new TileScoreboard();

    // Tile A has a bad history
    board.record('A', 'corrected_by_cortex');
    board.record('A', 'corrected_by_cortex');
    board.record('A', 'corrected_by_cortex');

    // Tile B has a good history
    board.record('B', 'accepted');
    board.record('B', 'accepted');
    board.record('B', 'accepted');

    const terminal = new TerminalBus(evolutionaryArbiter(board), defaultCortex, {
      gatherWindowMs: 1,
    });

    // Both tiles have identical reflex params — but B should win due to history
    const tileA = makeFakeTile('A', ['cmd'], { confidence: 0.85, specificity: 0.85 });
    const tileB = makeFakeTile('B', ['cmd'], { confidence: 0.85, specificity: 0.85 });
    terminal.installTile(tileA);
    terminal.installTile(tileB);

    const result = await terminal.dispatch(makeAction('cmd', {}));
    expect(result.winner?.tileId).toBe('B');
  });

  it('scoreboard records accepted outcomes during dispatch', async () => {
    actionCounter = 0;
    const terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
    const tile = makeFakeTile('t1', ['cmd'], { confidence: 0.9 });
    terminal.installTile(tile);

    await terminal.dispatch(makeAction('cmd', {}));
    await terminal.dispatch(makeAction('cmd', {}));
    await terminal.dispatch(makeAction('cmd', {}));

    expect(terminal.getScoreboard().attempts('t1')).toBe(3);
    expect(terminal.getScoreboard().accuracy('t1')).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 7. Concrete Tile: IdentifySalmonTile
// ---------------------------------------------------------------------------

describe('IdentifySalmonTile', () => {
  it('identifies a Chinook salmon within deadband', () => {
    const action: BusAction = {
      id: 'test-1',
      type: 'identify-fish',
      payload: {
        size: 36,
        color: 'blue-green',
        bodyShape: 'torpedo',
        distinctiveFeatures: ['black gum line', 'spots on back and both lobes of tail'],
      },
      timestamp: Date.now(),
    };

    const reflex = IdentifySalmonTile.onAction(action);
    expect(reflex).not.toBeNull();
    expect(reflex!.tileId).toBe('tile:identify-salmon');
    const output = reflex!.output as { species: string; commonName: string };
    expect(output.species).toBe('chinook');
  });

  it('identifies a Sockeye salmon', () => {
    const action: BusAction = {
      id: 'test-2',
      type: 'identify-fish',
      payload: {
        size: 26,
        color: 'red',
        bodyShape: 'torpedo',
        distinctiveFeatures: ['no spots', 'green head in spawning'],
      },
      timestamp: Date.now(),
    };

    const reflex = IdentifySalmonTile.onAction(action);
    expect(reflex).not.toBeNull();
    expect((reflex!.output as { species: string }).species).toBe('sockeye');
  });

  it('stays silent for non-salmon fish', () => {
    const action: BusAction = {
      id: 'test-3',
      type: 'identify-fish',
      payload: {
        size: 8,
        color: 'transparent',
        bodyShape: 'slender',
        distinctiveFeatures: ['nothing recognizable'],
      },
      timestamp: Date.now(),
    };

    const reflex = IdentifySalmonTile.onAction(action);
    expect(reflex).toBeNull();
  });

  it('stays silent for wrong action type', () => {
    const action: BusAction = {
      id: 'test-4',
      type: 'resolve-verb',
      payload: { verb: 'look', target: 'fish' },
      timestamp: Date.now(),
    };

    expect(IdentifySalmonTile.deadband.matcher(action)).toBe(false);
  });

  it('works end-to-end through TerminalBus', async () => {
    actionCounter = 0;
    const terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
    terminal.installTile(IdentifySalmonTile);

    const result = await terminal.dispatch(
      makeAction('identify-fish', {
        size: 30,
        color: 'silver',
        bodyShape: 'torpedo',
        distinctiveFeatures: ['white gum line', 'spots only on upper lobe of tail'],
      }),
    );

    expect(result.mode).toBe('reflex');
    expect((result.output as { species: string }).species).toBe('coho');
  });
});

// ---------------------------------------------------------------------------
// 8. Concrete Tile: VerbResolverTile
// ---------------------------------------------------------------------------

describe('VerbResolverTile', () => {
  it('resolves LOOK AT door', () => {
    const action: BusAction = {
      id: 'v1',
      type: 'resolve-verb',
      payload: { verb: 'look', target: 'door' },
      timestamp: Date.now(),
    };

    const reflex = VerbResolverTile.onAction(action);
    expect(reflex).not.toBeNull();
    const output = reflex!.output as { resolvedAction: string; targetFound: boolean };
    expect(output.resolvedAction).toBe('describe');
    expect(output.targetFound).toBe(true);
  });

  it('resolves TAKE key', () => {
    const action: BusAction = {
      id: 'v2',
      type: 'resolve-verb',
      payload: { verb: 'take', target: 'key' },
      timestamp: Date.now(),
    };

    const reflex = VerbResolverTile.onAction(action);
    expect(reflex).not.toBeNull();
    expect((reflex!.output as { resolvedAction: string }).resolvedAction).toBe('pickup');
  });

  it('stays silent for unknown verbs', () => {
    const action: BusAction = {
      id: 'v3',
      type: 'resolve-verb',
      payload: { verb: 'teleport', target: 'door' },
      timestamp: Date.now(),
    };

    // matcher should reject unknown verb
    expect(VerbResolverTile.deadband.matcher(action)).toBe(false);
  });

  it('lower confidence for unknown targets', () => {
    const action: BusAction = {
      id: 'v4',
      type: 'resolve-verb',
      payload: { verb: 'look', target: 'quantum-flux-capacitor' },
      timestamp: Date.now(),
    };

    const reflex = VerbResolverTile.onAction(action);
    // The tile still responds but with lower confidence
    if (reflex) {
      expect(reflex.confidence).toBeLessThan(0.95);
    }
  });

  it('works end-to-end through TerminalBus', async () => {
    actionCounter = 0;
    const terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
    terminal.installTile(VerbResolverTile);

    const result = await terminal.dispatch(
      makeAction('resolve-verb', { verb: 'open', target: 'chest' }),
    );

    expect(result.mode).toBe('reflex');
    expect((result.output as { resolvedAction: string }).resolvedAction).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// 9. Concrete Tile: PokerBetTile
// ---------------------------------------------------------------------------

describe('PokerBetTile', () => {
  it('folds with a weak hand', () => {
    const action: BusAction = {
      id: 'p1',
      type: 'poker-bet',
      payload: {
        holeCards: ['2♣', '7♥'],
        communityCards: [],
        pot: 100,
        currentBet: 50,
        myChips: 500,
        myBet: 0,
        phase: 'preflop',
        position: 'early',
        opponentsActive: 5,
      },
      timestamp: Date.now(),
    };

    const reflex = PokerBetTile.onAction(action);
    expect(reflex).not.toBeNull();
    expect((reflex!.output as { action: string }).action).toBe('fold');
  });

  it('raises with pocket aces', () => {
    const action: BusAction = {
      id: 'p2',
      type: 'poker-bet',
      payload: {
        holeCards: ['A♠', 'A♥'],
        communityCards: [],
        pot: 60,
        currentBet: 20,
        myChips: 500,
        myBet: 0,
        phase: 'preflop',
        position: 'late',
        opponentsActive: 4,
      },
      timestamp: Date.now(),
    };

    const reflex = PokerBetTile.onAction(action);
    expect(reflex).not.toBeNull();
    const output = reflex!.output as { action: string; amount?: number };
    expect(output.action).toBe('raise');
    expect(output.amount).toBeGreaterThan(0);
  });

  it('calls with decent hand and good odds', () => {
    const action: BusAction = {
      id: 'p3',
      type: 'poker-bet',
      payload: {
        holeCards: ['K♠', 'Q♥'],
        communityCards: [],
        pot: 100,
        currentBet: 10,
        myChips: 500,
        myBet: 0,
        phase: 'preflop',
        position: 'middle',
        opponentsActive: 3,
      },
      timestamp: Date.now(),
    };

    const reflex = PokerBetTile.onAction(action);
    expect(reflex).not.toBeNull();
    const output = reflex!.output as { action: string };
    // KQ suited or not is a calling hand in most positions
    expect(['call', 'raise']).toContain(output.action);
  });

  it('does not claim all-in extreme pot odds situations', () => {
    // callAmount = 1800, potOdds = 1800 / (200 + 1800) = 0.9 (> 0.5)
    // myChips (500) < currentBet * 3 (6000) — both conditions met, matcher rejects
    const action: BusAction = {
      id: 'p4',
      type: 'poker-bet',
      payload: {
        holeCards: ['9♣', 'T♥'],
        communityCards: [],
        pot: 200,
        currentBet: 2000,
        myChips: 500,
        myBet: 200,
        phase: 'preflop',
        position: 'blinds',
        opponentsActive: 2,
      },
      timestamp: Date.now(),
    };

    // Matcher should reject — extreme pot odds with low chips
    expect(PokerBetTile.deadband.matcher(action)).toBe(false);
  });

  it('works end-to-end through TerminalBus', async () => {
    actionCounter = 0;
    const terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
    terminal.installTile(PokerBetTile);

    const result = await terminal.dispatch(
      makeAction('poker-bet', {
        holeCards: ['A♠', 'K♠'],
        communityCards: [],
        pot: 50,
        currentBet: 10,
        myChips: 500,
        myBet: 0,
        phase: 'preflop',
        position: 'button',
        opponentsActive: 3,
      }),
    );

    expect(result.mode).toBe('reflex');
    const output = result.output as { action: string };
    expect(['call', 'raise']).toContain(output.action);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration: Multi-tile system
// ---------------------------------------------------------------------------

describe('Multi-Tile Integration', () => {
  it('all three concrete tiles coexist on the same bus', async () => {
    actionCounter = 0;
    const terminal = new TerminalBus(defaultArbiter, defaultCortex, { gatherWindowMs: 1 });
    terminal.installTile(IdentifySalmonTile);
    terminal.installTile(VerbResolverTile);
    terminal.installTile(PokerBetTile);

    expect(terminal.tileCount).toBe(3);

    // Fish ID
    const fishResult = await terminal.dispatch(
      makeAction('identify-fish', {
        size: 40,
        color: 'blue-green',
        bodyShape: 'torpedo',
        distinctiveFeatures: ['black gum line', 'spots on back and both lobes of tail'],
      }),
    );
    expect(fishResult.mode).toBe('reflex');
    expect((fishResult.output as { species: string }).species).toBe('chinook');

    // Verb resolution
    const verbResult = await terminal.dispatch(
      makeAction('resolve-verb', { verb: 'take', target: 'key' }),
    );
    expect(verbResult.mode).toBe('reflex');
    expect((verbResult.output as { resolvedAction: string }).resolvedAction).toBe('pickup');

    // Poker
    const pokerResult = await terminal.dispatch(
      makeAction('poker-bet', {
        holeCards: ['A♠', 'A♥'],
        communityCards: [],
        pot: 60,
        currentBet: 20,
        myChips: 500,
        myBet: 0,
        phase: 'preflop',
        position: 'late',
        opponentsActive: 4,
      }),
    );
    expect(pokerResult.mode).toBe('reflex');

    // Unknown action → cortex
    const unknownResult = await terminal.dispatch(
      makeAction('some-other-action', { foo: 'bar' }),
    );
    expect(unknownResult.mode).toBe('cortex');
  });
});
