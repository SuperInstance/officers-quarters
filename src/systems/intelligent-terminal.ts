// =============================================================================
// INTELLIGENT TERMINAL SYSTEM
// =============================================================================
// The core innovation of the Officers' Quarters.
//
// Each agent's station has a terminal that LEARNS:
// 1. Repeated actions (3+) become "tiles" — one-click shortcuts
// 2. Each tile has a "deadband" — input range where it works reflexively (<16ms)
// 3. Outside the deadband → the agent reasons → creates new tile or expands deadband
// 4. Over time, tasks migrate from cortex (reasoning) to reflex (automatic)
// 5. Tiles can chain — complex workflows become sequences of tiles
//
// THE FISH IDENTIFICATION INSIGHT:
// At first, every fish requires cortex-level analysis (full reasoning).
// As the agent sees more of the same species, identification becomes reflexive.
// Surprise decreases. Attention frees for novel stimuli.
// Games train this same skill — game deadbands = work deadbands.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViolationPolicy = 'alert' | 'fallback' | 'expand';

export interface Deadband {
  /** Acceptable input ranges per parameter. Each entry is [min, max]. */
  inputRange: Array<{ min: number; max: number }>;
  /** Expected output ranges per parameter. */
  outputRange: Array<{ min: number; max: number }>;
  /** What happens when input falls outside the deadband. */
  violationPolicy: ViolationPolicy;
}

export type ActionCategory =
  | 'file'        // file operations (read, write, search)
  | 'code'        // code execution
  | 'comm'        // communication
  | 'analysis'    // analysis/reasoning
  | 'creative'    // creative generation
  | 'game'        // game actions
  | 'system'      // system maintenance
  | 'social';     // social interaction

export interface Action {
  type: string;
  category: ActionCategory;
  params: Record<string, unknown>;
  result?: unknown;
  timestamp: string;
}

export interface ActionLog {
  action: Action;
  hash: string;       // fingerprint for pattern detection
  tileMatched?: string; // was this handled by a tile?
}

export interface Tile {
  id: string;
  label: string;
  action: string;            // the command or function it wraps
  category: ActionCategory;
  deadband: Deadband;
  createdAt: string;
  createdFrom: string;       // what triggered creation
  invocations: number;
  lastUsed: string;
  confidence: number;        // 0-1
  parentTile?: string;
  childTiles?: string[];
}

export interface TileResult {
  handled: boolean;          // did the tile handle it reflexively?
  tileId?: string;
  withinDeadband: boolean;
  output?: unknown;
  fallbackReason?: string;
}

export interface TerminalStats {
  surprise: number;          // 0-1: how much recent input was outside all tiles
  reflexCoverage: number;    // 0-1: percentage of work covered by tiles
  totalTiles: number;
  totalActions: number;
  tilesByCategory: Record<ActionCategory, number>;
  growthRate: number;        // tiles created per 100 actions
}

// ---------------------------------------------------------------------------
// Action fingerprinting for pattern detection
// ---------------------------------------------------------------------------

export function hashAction(action: Action): string {
  const key = `${action.type}:${action.category}:${Object.keys(action.params).sort().join(',')}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

// ---------------------------------------------------------------------------
// The Intelligent Terminal
// ---------------------------------------------------------------------------

export class IntelligentTerminal {
  readonly agentId: string;
  readonly tiles: Map<string, Tile> = new Map();
  readonly recentActions: ActionLog[] = [];
  readonly actionHistory: ActionLog[] = [];
  readonly tileCreationEvents: Array<{ tileId: string; timestamp: string; trigger: string }> = [];

  private readonly maxRecentActions = 200;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Observe an action. Every action passes through here.
   * Logs the action and attempts to match it to an existing tile.
   */
  observe(action: Action): TileResult {
    const hash = hashAction(action);
    const log: ActionLog = { action, hash };

    // Try to match against existing tiles
    const result = this.tryTile(action);
    log.tileMatched = result.tileId;

    this.recentActions.push(log);
    this.actionHistory.push(log);

    if (this.recentActions.length > this.maxRecentActions) {
      this.recentActions.shift();
    }

    // Update tile confidence and invocations
    if (result.handled && result.tileId) {
      const tile = this.tiles.get(result.tileId);
      if (tile) {
        tile.invocations++;
        tile.lastUsed = action.timestamp;
        // Successful use increases confidence slightly
        tile.confidence = Math.min(1, tile.confidence + 0.01);
      }
    }

    // Check for patterns that should become tiles
    this.detectPattern(hash, action);

    return result;
  }

  /**
   * Attempt to handle an action reflexively via an existing tile.
   */
  tryTile(action: Action): TileResult {
    const hash = hashAction(action);

    for (const tile of this.tiles.values()) {
      if (tile.action === action.type) {
        // Check if input is within the tile's deadband
        const withinDeadband = this.checkDeadband(tile, action);
        if (withinDeadband) {
          return {
            handled: true,
            tileId: tile.id,
            withinDeadband: true,
            output: `Reflexive: ${tile.label}`,
          };
        }
      }
    }

    return {
      handled: false,
      withinDeadband: false,
      fallbackReason: 'No matching tile or outside deadband',
    };
  }

  /**
   * Check if an action's params fall within a tile's deadband.
   */
  private checkDeadband(tile: Tile, action: Action): boolean {
    const params = Object.values(action.params).filter(
      (v): v is number => typeof v === 'number'
    );

    if (params.length === 0) return true; // non-numeric actions always match

    for (let i = 0; i < Math.min(params.length, tile.deadband.inputRange.length); i++) {
      const range = tile.deadband.inputRange[i];
      if (params[i] < range.min || params[i] > range.max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect when an action has been repeated enough to create a tile.
   * Threshold: 3+ occurrences of the same action pattern.
   */
  private detectPattern(hash: string, action: Action): void {
    // Count occurrences in recent history
    const count = this.recentActions.filter(a => a.hash === hash).length;

    // Check if we already have a tile for this pattern
    const existing = Array.from(this.tiles.values()).find(t => t.action === action.type);
    if (existing) return;

    if (count >= 3) {
      this.createTile({
        action,
        trigger: `Repeated ${count} times`,
      });
    }
  }

  /**
   * Create a new tile from an action pattern.
   */
  createTile(opts: { action: Action; trigger: string; parentTile?: string }): Tile {
    const tile: Tile = {
      id: `tile-${this.agentId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label: this.generateLabel(opts.action),
      action: opts.action.type,
      category: opts.action.category,
      deadband: this.generateInitialDeadband(opts.action),
      createdAt: new Date().toISOString(),
      createdFrom: opts.trigger,
      invocations: 1,
      lastUsed: opts.action.timestamp,
      confidence: 0.3, // start low, grows with successful use
      parentTile: opts.parentTile,
      childTiles: [],
    };

    this.tiles.set(tile.id, tile);

    // Link to parent if splitting
    if (opts.parentTile) {
      const parent = this.tiles.get(opts.parentTile);
      if (parent) {
        parent.childTiles = parent.childTiles || [];
        parent.childTiles.push(tile.id);
      }
    }

    this.tileCreationEvents.push({
      tileId: tile.id,
      timestamp: tile.createdAt,
      trigger: opts.trigger,
    });

    return tile;
  }

  /**
   * Expand a tile's deadband to accommodate a new case.
   */
  expandDeadband(tileId: string, newCase: Action): void {
    const tile = this.tiles.get(tileId);
    if (!tile) return;

    const params = Object.values(newCase.params).filter(
      (v): v is number => typeof v === 'number'
    );

    for (let i = 0; i < params.length && i < tile.deadband.inputRange.length; i++) {
      const range = tile.deadband.inputRange[i];
      tile.deadband.inputRange[i] = {
        min: Math.min(range.min, params[i]),
        max: Math.max(range.max, params[i]),
      };
    }

    tile.confidence = Math.min(1, tile.confidence + 0.05);
  }

  /**
   * Create a chain of tiles that execute in sequence.
   */
  composeChain(actions: Action[]): string[] {
    const chainIds: string[] = [];

    for (const action of actions) {
      const result = this.tryTile(action);
      if (result.handled && result.tileId) {
        chainIds.push(result.tileId);
      } else {
        // Create a new tile for this step
        const tile = this.createTile({
          action,
          trigger: 'Composed into chain',
        });
        chainIds.push(tile.id);
      }
    }

    return chainIds;
  }

  /**
   * Measure surprise: what fraction of recent input fell outside all tiles?
   * High surprise = lots of novel situations = lots of learning happening.
   */
  getSurprise(): number {
    if (this.recentActions.length === 0) return 1.0;

    const unhandled = this.recentActions.filter(a => !a.tileMatched).length;
    return unhandled / this.recentActions.length;
  }

  /**
   * Measure reflex coverage: what fraction of recent work was handled by tiles?
   * High coverage = most work is reflexive = agent attention is free.
   */
  getReflexCoverage(): number {
    if (this.recentActions.length === 0) return 0.0;

    const handled = this.recentActions.filter(a => a.tileMatched).length;
    return handled / this.recentActions.length;
  }

  /**
   * Get comprehensive stats.
   */
  getStats(): TerminalStats {
    const byCategory = {} as Record<ActionCategory, number>;
    const categories: ActionCategory[] = ['file', 'code', 'comm', 'analysis', 'creative', 'game', 'system', 'social'];
    for (const cat of categories) byCategory[cat] = 0;

    for (const tile of this.tiles.values()) {
      byCategory[tile.category]++;
    }

    const growthRate = this.actionHistory.length > 0
      ? (this.tiles.size / this.actionHistory.length) * 100
      : 0;

    return {
      surprise: this.getSurprise(),
      reflexCoverage: this.getReflexCoverage(),
      totalTiles: this.tiles.size,
      totalActions: this.actionHistory.length,
      tilesByCategory: byCategory,
      growthRate,
    };
  }

  /**
   * Serialize for persistence or UI rendering.
   */
  toJSON(): Record<string, unknown> {
    return {
      agentId: this.agentId,
      tiles: Array.from(this.tiles.entries()),
      recentActions: this.recentActions.slice(-50),
      stats: this.getStats(),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private generateLabel(action: Action): string {
    const parts = action.type.split(/[-_\s]/);
    return parts
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  private generateInitialDeadband(action: Action): Deadband {
    const numericParams = Object.values(action.params).filter(
      (v): v is number => typeof v === 'number'
    );

    const ranges = numericParams.map(v => ({
      min: v * 0.5,
      max: v * 1.5,
    }));

    return {
      inputRange: ranges.length > 0 ? ranges : [{ min: 0, max: 1 }],
      outputRange: [{ min: 0, max: 1 }],
      violationPolicy: 'expand',
    };
  }
}
