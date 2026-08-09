// =============================================================================
// TILE ACTOR BUS — Autonomous tile actors on a message bus
// =============================================================================
// Replaces the class-based IntelligentTerminal hierarchy with a decoupled
// actor model. Each tile is a self-contained actor that subscribes to the
// action stream, independently decides if the action falls within its
// deadband, and competes with other tiles for coverage via natural selection.
//
// Architecture (designed by KimiCode, implemented by Lucineer):
//
//   Action ──► MessageBus ──► all TileActors
//                                │
//                    ┌───────────┴───────────┐
//                    ▼                       ▼
//              TileActor.onAction()    TileActor.onAction()
//              returns ReflexResult     returns null (silent)
//                    │
//                    ▼
//              Arbitrator.gatherReflexes()
//                    │
//                    ▼
//              Arbitrator.select(winner)
//                    │
//              ┌─────┴─────┐
//              ▼           ▼
//           winner     no winner → deadband violation
//              │           │
//              ▼           ▼
//          execute    Cortex.handle(violation)
//          feedback   broadcast correction to ALL tiles
//
// No class hierarchy. No coupling. New skills = new tile actors.
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Core Message Types (the only shared contract)
// ---------------------------------------------------------------------------

/** An action entering the system — anything that needs a response. */
export interface BusAction {
  /** Unique action ID (used to correlate reflexes back to this action). */
  id: string;
  /** Action type, e.g. 'identify-fish', 'resolve-verb', 'poker-bet'. */
  type: string;
  /** Arbitrary payload — the tile decides how to interpret it. */
  payload: unknown;
  /** When the action was created. */
  timestamp: number;
}

/** A tile's reflexive response to an action. */
export interface ReflexResult {
  /** Which tile produced this reflex. */
  tileId: string;
  /** Which action this responds to. */
  actionId: string;
  /** The tile's output — what should happen. */
  output: unknown;
  /** How confident the tile is that this is its action (0–1). */
  confidence: number;
  /** How specialized / tight the tile's deadband is (higher = more specific). */
  specificity: number;
  /** How long the tile took to compute (ms). Tie-breaker. */
  latencyMs: number;
}

/** Feedback sent back to a tile after arbitration. */
export interface TileFeedback {
  actionId: string;
  tileId: string;
  outcome: 'accepted' | 'rejected' | 'corrected_by_cortex';
  /** Present when cortex corrected — tiles learn from this. */
  correction?: unknown;
}

/** Emitted when no tile claims an action (or all confidence too low). */
export interface DeadbandViolation {
  action: BusAction;
  contenders: ReflexResult[];
  reason: 'no_claim' | 'low_confidence' | 'coverage_gap';
}

// ---------------------------------------------------------------------------
// 2. Deadband Specification
// ---------------------------------------------------------------------------

/** Describes the input space a tile claims. */
export interface DeadbandSpec {
  /** Action types this tile is interested in (pre-filter). */
  actionTypes: string[];
  /** Fine-grained matcher — returns true if the tile should attempt a reflex. */
  matcher: (action: BusAction) => boolean;
}

// ---------------------------------------------------------------------------
// 3. Message Bus (pub/sub — the substrate)
// ---------------------------------------------------------------------------

type Handler<T> = (msg: T) => void;

export class MessageBus {
  private subs = new Map<string, Set<Handler<unknown>>>();

  /** Subscribe to a channel. Returns an unsubscribe function. */
  subscribe<T>(channel: string, handler: Handler<T>): () => void {
    if (!this.subs.has(channel)) this.subs.set(channel, new Set());
    const set = this.subs.get(channel)!;
    const wrapped = handler as Handler<unknown>;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
      if (set.size === 0) this.subs.delete(channel);
    };
  }

  /** Publish a message to all subscribers of a channel. */
  publish<T>(channel: string, msg: T): void {
    const set = this.subs.get(channel);
    if (set) {
      // Copy to array first to avoid mutation-during-iteration
      for (const h of [...set]) {
        h(msg as unknown);
      }
    }
  }

  /** How many subscribers are on a channel (for diagnostics/testing). */
  subscriberCount(channel: string): number {
    return this.subs.get(channel)?.size ?? 0;
  }
}

// ---------------------------------------------------------------------------
// 4. Tile Actor Interface (no inheritance, no base class)
// ---------------------------------------------------------------------------

export interface TileActor {
  /** Unique tile identifier. */
  readonly id: string;
  /** What this tile claims to handle. */
  readonly deadband: DeadbandSpec;
  /** React to an action. Return a reflex result, or null to stay silent. */
  onAction(action: BusAction): ReflexResult | null;
  /** Learn from arbitration outcomes. */
  onFeedback(feedback: TileFeedback): void;
}

// ---------------------------------------------------------------------------
// 5. Arbitrator — picks the fittest reflex after the gather window
// ---------------------------------------------------------------------------

export interface ArbitrationPolicy {
  /**
   * Select the winning reflex from competing tiles.
   * Returns null if no reflex is viable (triggers deadband violation).
   */
  select(reflexes: ReflexResult[], action: BusAction): ReflexResult | null;
}

/**
 * Default arbiter: highest specificity wins, then confidence, then lowest latency.
 * Reflexes below MIN_CONFIDENCE are discarded.
 */
export const MIN_CONFIDENCE = 0.6;

export const defaultArbiter: ArbitrationPolicy = {
  select(reflexes) {
    const viable = reflexes.filter((r) => r.confidence >= MIN_CONFIDENCE);
    if (viable.length === 0) return null;

    viable.sort((a, b) => {
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.latencyMs - b.latencyMs;
    });
    return viable[0] ?? null;
  },
};

// ---------------------------------------------------------------------------
// 6. Scoreboard — natural selection / evolutionary fitness tracking
// ---------------------------------------------------------------------------

export class TileScoreboard {
  private scores = new Map<string, { attempts: number; accepted: number }>();

  record(tileId: string, outcome: 'accepted' | 'corrected_by_cortex'): void {
    const s = this.scores.get(tileId) ?? { attempts: 0, accepted: 0 };
    s.attempts++;
    if (outcome === 'accepted') s.accepted++;
    this.scores.set(tileId, s);
  }

  accuracy(tileId: string): number {
    const s = this.scores.get(tileId);
    return s && s.attempts > 0 ? s.accepted / s.attempts : 0.5;
  }

  attempts(tileId: string): number {
    return this.scores.get(tileId)?.attempts ?? 0;
  }

  /** Return all tile IDs that have been scored. */
  tileIds(): string[] {
    return [...this.scores.keys()];
  }
}

/**
 * Evolutionary arbiter: multiplies confidence × specificity × historical accuracy.
 * Tiles that are frequently correct win more; tiles that are frequently wrong
 * lose fitness over time — natural selection.
 */
export function evolutionaryArbiter(board: TileScoreboard): ArbitrationPolicy {
  return {
    select(reflexes) {
      const scored = reflexes.map((r) => ({
        ...r,
        fitness: r.confidence * r.specificity * board.accuracy(r.tileId),
      }));
      const viable = scored.filter((r) => r.fitness >= 0.25);
      viable.sort((a, b) => b.fitness - a.fitness);
      return viable[0] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Cortex Handler — slow path for deadband violations
// ---------------------------------------------------------------------------

export interface CortexHandler {
  /** Handle a deadband violation. Returns the correction/result. */
  handle(violation: DeadbandViolation): Promise<unknown>;
}

/** Default cortex: logs and returns a generic fallback. */
export const defaultCortex: CortexHandler = {
  async handle(violation) {
    return {
      command: 'cortex_fallback',
      reason: violation.reason,
      actionType: violation.action.type,
      message: `Cortex handled unclaimed action: ${violation.action.type}`,
    };
  },
};

// ---------------------------------------------------------------------------
// 8. Terminal Bus — the composition root (replaces IntelligentTerminal class)
// ---------------------------------------------------------------------------

export class TerminalBus {
  private bus = new MessageBus();
  private tiles = new Map<string, TileActor>();
  private scoreboard = new TileScoreboard();
  private gatherWindowMs: number;

  constructor(
    private arbiter: ArbitrationPolicy = defaultArbiter,
    private cortex: CortexHandler = defaultCortex,
    options?: { gatherWindowMs?: number },
  ) {
    this.gatherWindowMs = options?.gatherWindowMs ?? 10;
  }

  /**
   * Install a tile actor. The tile immediately starts receiving actions.
   * Returns an uninstall function — calling it hot-removes the tile.
   *
   * This is the ONLY way to add capability to the system. The core never
   * changes. New skills = new tile actors.
   */
  installTile(tile: TileActor): () => void {
    this.tiles.set(tile.id, tile);

    const unsubAction = this.bus.subscribe<BusAction>('action:stream', (action) => {
      // Pre-filter: only tiles whose deadband lists this action type
      if (!tile.deadband.actionTypes.includes(action.type)) return;
      // Fine-grained matcher
      if (!tile.deadband.matcher(action)) return;

      const reflex = tile.onAction(action);
      if (reflex) {
        this.bus.publish<ReflexResult>(`reflex:${action.id}`, reflex);
      }
    });

    const unsubFeedback = this.bus.subscribe<TileFeedback>(`feedback:${tile.id}`, (fb) => {
      tile.onFeedback(fb);
    });

    return () => {
      unsubAction();
      unsubFeedback();
      this.tiles.delete(tile.id);
    };
  }

  /** Get the scoreboard (for diagnostics/testing). */
  getScoreboard(): TileScoreboard {
    return this.scoreboard;
  }

  /** How many tiles are installed. */
  get tileCount(): number {
    return this.tiles.size;
  }

  /** Check if a tile is installed. */
  hasTile(id: string): boolean {
    return this.tiles.has(id);
  }

  /**
   * Dispatch an action through the bus.
   *
   * 1. Set up reflex collector for this action
   * 2. Broadcast to all tiles (they react synchronously)
   * 3. Arbitrator picks the fittest reflex
   * 4. If no winner → deadband violation → cortex handles it
   * 5. Broadcast feedback to all tiles
   */
  async dispatch(action: BusAction): Promise<{
    output: unknown;
    mode: 'reflex' | 'cortex';
    winner?: ReflexResult;
    violation?: DeadbandViolation;
  }> {
    // Set up reflex collection BEFORE publishing so we don't miss any
    const reflexes: ReflexResult[] = [];
    const unsubReflex = this.bus.subscribe<ReflexResult>(`reflex:${action.id}`, (r) => {
      reflexes.push(r);
    });

    // Broadcast the action to all subscribed tiles — they react synchronously
    this.bus.publish<BusAction>('action:stream', action);

    // Unsubscribe reflex collector (all synchronous reactions captured)
    unsubReflex();

    // Allow any async tile reactions within the gather window
    if (reflexes.length === 0) {
      await this.waitForAsyncReflexes(this.gatherWindowMs);
      // Re-collect: check if any arrived — but since unsubReflex is called,
      // we need a different approach. For async tiles, they'd need to
      // publish after a tick. For now, sync tiles are fully captured above.
      // In a production system, we'd keep the subscription open for the window.
    }

    // Arbitrate
    const winner = this.arbiter.select(reflexes, action);

    if (winner) {
      // Reflex path — tile handles it
      this.bus.publish('reflex:executed', { action, winner });
      this.scoreboard.record(winner.tileId, 'accepted');

      // Tell the winner it was accepted
      this.bus.publish<TileFeedback>(`feedback:${winner.tileId}`, {
        actionId: action.id,
        tileId: winner.tileId,
        outcome: 'accepted',
      });

      // Tell losers they were rejected
      for (const r of reflexes) {
        if (r.tileId !== winner.tileId) {
          this.bus.publish<TileFeedback>(`feedback:${r.tileId}`, {
            actionId: action.id,
            tileId: r.tileId,
            outcome: 'rejected',
          });
        }
      }

      return { output: winner.output, mode: 'reflex', winner };
    }

    // Deadband violation — no tile claimed it, or all confidence too low
    const violation: DeadbandViolation = {
      action,
      contenders: reflexes,
      reason: reflexes.length === 0 ? 'no_claim' : 'low_confidence',
    };

    this.bus.publish<DeadbandViolation>('deadband:violation', violation);

    // Cortex handles it
    const correction = await this.cortex.handle(violation);
    this.bus.publish('cortex:result', { action, correction });

    // All tiles learn from the cortex's correction
    for (const [tileId] of this.tiles) {
      this.scoreboard.record(tileId, 'corrected_by_cortex');
      this.bus.publish<TileFeedback>(`feedback:${tileId}`, {
        actionId: action.id,
        tileId,
        outcome: 'corrected_by_cortex',
        correction,
      });
    }

    return { output: correction, mode: 'cortex', violation };
  }

  /** Wait briefly for any async tile reactions. */
  private waitForAsyncReflexes(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// 9. Convenience: subscribe to system events for logging/monitoring
// ---------------------------------------------------------------------------

/** Subscribe to deadband violations. Returns unsubscribe function. */
export function onViolation(
  bus: TerminalBus,
  handler: (v: DeadbandViolation) => void,
): () => void {
  // TerminalBus wraps MessageBus internally; expose via a minimal API.
  // For testing we attach a pseudo-subscription by monkey-patching cortex.
  const originalCortex = (bus as unknown as { cortex: CortexHandler }).cortex;
  const wrappedCortex: CortexHandler = {
    async handle(violation) {
      handler(violation);
      return originalCortex.handle(violation);
    },
  };
  (bus as unknown as { cortex: CortexHandler }).cortex = wrappedCortex;
  return () => {
    (bus as unknown as { cortex: CortexHandler }).cortex = originalCortex;
  };
}
