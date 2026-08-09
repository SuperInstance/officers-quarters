// =============================================================================
// CONCRETE TILE ACTORS — Example tiles demonstrating the architecture
// =============================================================================
// Each tile is a self-contained actor. They subscribe to the action stream
// via installTile() and respond to actions within their deadband.
// =============================================================================

import type {
  BusAction,
  ReflexResult,
  TileActor,
  TileFeedback,
} from '../systems/tile-actor-bus.js';

// ---------------------------------------------------------------------------
// 1. IdentifySalmonTile — reflexive fish identification
// ---------------------------------------------------------------------------
// From the fish-ID demo. After seeing enough salmon, the tile forms and
// identifies common species reflexively (<16ms). Rare variants or unknown
// fish fall through to cortex for full reasoning.
// ---------------------------------------------------------------------------

interface FishSighting {
  size: number;       // inches
  color: string;      // dominant color
  bodyShape: string;  // torpedo, robust, etc.
  distinctiveFeatures: string[];
}

interface FishIdentification {
  species: string;
  commonName: string;
  confidence: number;
}

/** Known salmon patterns — this IS the deadband (learned from experience). */
const SALMON_PATTERNS: Array<{
  species: string;
  commonName: string;
  sizeRange: [number, number];
  colors: string[];
  bodyShapes: string[];
  features: string[];
  baseConfidence: number;
}> = [
  {
    species: 'chinook',
    commonName: 'Chinook Salmon (King)',
    sizeRange: [24, 58],
    colors: ['blue-green', 'silver', 'olive'],
    bodyShapes: ['torpedo'],
    features: ['black gum line', 'spots on back and both lobes of tail'],
    baseConfidence: 0.95,
  },
  {
    species: 'coho',
    commonName: 'Coho Salmon (Silver)',
    sizeRange: [18, 38],
    colors: ['silver', 'silver-green'],
    bodyShapes: ['torpedo'],
    features: ['white gum line', 'spots only on upper lobe of tail'],
    baseConfidence: 0.93,
  },
  {
    species: 'sockeye',
    commonName: 'Sockeye Salmon (Red)',
    sizeRange: [20, 33],
    colors: ['red', 'silver-bright', 'green-red'],
    bodyShapes: ['torpedo'],
    features: ['no spots', 'green head in spawning'],
    baseConfidence: 0.92,
  },
  {
    species: 'pink',
    commonName: 'Pink Salmon (Humpy)',
    sizeRange: [14, 22],
    colors: ['pink-white', 'silver'],
    bodyShapes: ['robust'],
    features: ['large oval spots', 'humped back in males'],
    baseConfidence: 0.90,
  },
  {
    species: 'chum',
    commonName: 'Chum Salmon (Dog)',
    sizeRange: [18, 35],
    colors: ['silver', 'calico', 'green-purple'],
    bodyShapes: ['torpedo'],
    features: ['no spots', 'white tip on pelvic fin'],
    baseConfidence: 0.88,
  },
];

export const IdentifySalmonTile: TileActor = {
  id: 'tile:identify-salmon',
  deadband: {
    actionTypes: ['identify-fish'],
    matcher: (action) => {
      const sighting = action.payload as FishSighting;
      if (!sighting || typeof sighting.size !== 'number') return false;
      // Pre-filter: only claims fish that look vaguely salmonid
      return (
        sighting.bodyShape === 'torpedo' ||
        sighting.bodyShape === 'robust' ||
        sighting.size >= 14
      );
    },
  },

  onAction(action: BusAction): ReflexResult | null {
    const sighting = action.payload as FishSighting;
    if (!sighting) return null;

    let bestMatch: (typeof SALMON_PATTERNS)[0] | null = null;
    let bestScore = 0;

    for (const pattern of SALMON_PATTERNS) {
      let score = 0;

      // Size check (within deadband range)
      const [minSize, maxSize] = pattern.sizeRange;
      if (sighting.size >= minSize && sighting.size <= maxSize) {
        score += 0.3;
      } else if (sighting.size >= minSize - 4 && sighting.size <= maxSize + 4) {
        // Edge of deadband — partial credit
        score += 0.15;
      }

      // Color check
      if (pattern.colors.includes(sighting.color)) {
        score += 0.25;
      }

      // Body shape check
      if (pattern.bodyShapes.includes(sighting.bodyShape)) {
        score += 0.2;
      }

      // Distinctive features check
      const featureOverlap = sighting.distinctiveFeatures?.filter((f) =>
        pattern.features.some((pf) => f.toLowerCase().includes(pf.toLowerCase()) ||
          pf.toLowerCase().includes(f.toLowerCase())),
      ) ?? [];
      score += (featureOverlap.length / Math.max(pattern.features.length, 1)) * 0.25;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (!bestMatch || bestScore < 0.4) {
      // Outside deadband — stay silent, let cortex handle it
      return null;
    }

    const result: FishIdentification = {
      species: bestMatch.species,
      commonName: bestMatch.commonName,
      confidence: Math.min(bestMatch.baseConfidence, bestScore),
    };

    return {
      tileId: 'tile:identify-salmon',
      actionId: action.id,
      output: result,
      confidence: Math.min(bestScore + bestMatch.baseConfidence * 0.3, 0.99),
      specificity: 0.85, // salmon identification is fairly specialized
      latencyMs: 1,
    };
  },

  onFeedback(feedback: TileFeedback): void {
    if (feedback.outcome === 'corrected_by_cortex' && feedback.correction) {
      // In a real system, this tile would adjust its deadband or propose
      // a new child tile for the variant the cortex identified.
      // For now, we log it — the learning signal is captured.
    }
  },
};

// ---------------------------------------------------------------------------
// 2. VerbResolverTile — reflexive verb resolution for interactive fiction
// ---------------------------------------------------------------------------
// From Plato's Shell. Handles common LOOK AT / PICK UP / GO commands on
// known objects reflexively. Unknown objects or unusual verbs escalate to cortex.
// ---------------------------------------------------------------------------

interface VerbCommand {
  verb: string;       // LOOK, TAKE, GO, OPEN, etc.
  target: string;     // the object name
}

interface VerbResolution {
  verb: string;
  target: string;
  resolvedAction: string;   // the system command to execute
  targetFound: boolean;
}

/** Known verb-object resolutions (the learned deadband). */
const VERB_MAP: Record<string, string> = {
  'look': 'describe',
  'examine': 'describe',
  'inspect': 'describe',
  'read': 'read_object',
  'take': 'pickup',
  'pick': 'pickup',
  'grab': 'pickup',
  'get': 'pickup',
  'drop': 'drop',
  'go': 'move',
  'walk': 'move',
  'run': 'move',
  'open': 'open',
  'close': 'shut',
  'push': 'push',
  'pull': 'pull',
  'use': 'use',
  'eat': 'consume',
  'drink': 'consume',
};

/** Known objects in the current room (simplified — a real system reads from state). */
const KNOWN_OBJECTS = new Set([
  'door', 'window', 'table', 'chair', 'desk', 'book', 'note', 'sign',
  'key', 'lamp', 'chest', 'drawer', 'painting', 'mirror', 'phone',
  'floor', 'ceiling', 'wall', 'carpet', 'rug', 'curtain', 'bed',
  'shelf', 'cabinet', 'bottle', 'cup', 'plate', 'knife', 'fork',
  'poker', 'hearth', 'fireplace', 'stairs', 'elevator', 'terminal',
]);

export const VerbResolverTile: TileActor = {
  id: 'tile:verb-resolver',
  deadband: {
    actionTypes: ['resolve-verb'],
    matcher: (action) => {
      const cmd = action.payload as VerbCommand;
      if (!cmd || !cmd.verb || !cmd.target) return false;
      // Only claim if the verb is known AND the target is recognized
      const normalizedVerb = cmd.verb.toLowerCase().trim();
      return normalizedVerb in VERB_MAP;
    },
  },

  onAction(action: BusAction): ReflexResult | null {
    const cmd = action.payload as VerbCommand;
    if (!cmd) return null;

    const normalizedVerb = cmd.verb.toLowerCase().trim();
    const normalizedTarget = cmd.target.toLowerCase().trim();

    const mappedAction = VERB_MAP[normalizedVerb];
    if (!mappedAction) return null; // unknown verb → silent

    const targetFound = KNOWN_OBJECTS.has(normalizedTarget);

    const resolution: VerbResolution = {
      verb: normalizedVerb,
      target: normalizedTarget,
      resolvedAction: mappedAction,
      targetFound,
    };

    // Confidence is high when both verb and target are known
    const confidence = targetFound ? 0.95 : 0.7;
    // Specificity is moderate — this tile handles many verbs but only known objects
    const specificity = targetFound ? 0.8 : 0.5;

    // If the target isn't known, confidence drops — we're at the edge of the deadband
    if (!targetFound && confidence < 0.6) {
      return null; // let cortex handle it
    }

    return {
      tileId: 'tile:verb-resolver',
      actionId: action.id,
      output: resolution,
      confidence,
      specificity,
      latencyMs: 1,
    };
  },

  onFeedback(feedback: TileFeedback): void {
    if (feedback.outcome === 'accepted' && feedback.correction) {
      // A correction means we got the verb right but the resolution was adjusted.
      // Learn the adjusted mapping.
    }
    if (feedback.outcome === 'corrected_by_cortex') {
      // Cortex resolved something we couldn't — potential new verb or object to learn.
    }
  },
};

// ---------------------------------------------------------------------------
// 3. PokerBetTile — reflexive betting patterns for Texas Hold'em
// ---------------------------------------------------------------------------
// From the poker room. Handles common pre-flop and post-flop betting patterns
// reflexively. Unusual situations (all-in decisions, bluff detection) escalate.
// ---------------------------------------------------------------------------

interface PokerSituation {
  holeCards: [string, string];     // e.g. ['A♠', 'K♥']
  communityCards: string[];        // e.g. ['Q♦', 'J♣', '7♠']
  pot: number;
  currentBet: number;              // amount to call
  myChips: number;
  myBet: number;                   // how much we've already put in
  phase: 'preflop' | 'flop' | 'turn' | 'river';
  position: 'early' | 'middle' | 'late' | 'button' | 'blinds';
  opponentsActive: number;
}

interface PokerDecision {
  action: 'fold' | 'call' | 'raise' | 'check';
  amount?: number;
  reasoning: string;
}

/** Pre-flop hand strength tiers (simplified — learned from experience). */
function preflopStrength(cards: [string, string]): number {
  const rankOrder = '23456789TJQKA';
  const rank1 = rankOrder.indexOf(cards[0][0]);
  const rank2 = rankOrder.indexOf(cards[1][0]);
  const suited = cards[0][1] === cards[1][1];
  const high = Math.max(rank1, rank2);
  const low = Math.min(rank1, rank2);
  const gap = high - low;

  // Pocket pairs
  if (rank1 === rank2) {
    if (high >= 10) return 0.95;   // JJ+
    if (high >= 7) return 0.80;    // 77-TT
    return 0.65;                    // 22-66
  }

  // Suited connectors / high cards
  let strength = 0;
  if (suited) strength += 0.15;
  if (gap === 1) strength += 0.10;  // connectors
  if (gap === 0) strength += 0.05;  // same rank (not pair, shouldn't happen)

  // High card value
  strength += (high / 14) * 0.4;
  strength += (low / 14) * 0.2;

  return Math.min(strength, 0.9);
}

export const PokerBetTile: TileActor = {
  id: 'tile:poker-bet',
  deadband: {
    actionTypes: ['poker-bet'],
    matcher: (action) => {
      const situation = action.payload as PokerSituation;
      if (!situation || !situation.holeCards || !situation.phase) return false;
      // Only claim standard situations — not all-in decisions
      const callAmount = situation.currentBet - situation.myBet;
      const potOdds = situation.pot > 0 ? callAmount / (situation.pot + callAmount) : 0;
      // If pot odds are extreme (>50%), let cortex handle it
      if (potOdds > 0.5 && situation.myChips < situation.currentBet * 3) return false;
      return true;
    },
  },

  onAction(action: BusAction): ReflexResult | null {
    const situation = action.payload as PokerSituation;
    if (!situation) return null;

    const handStrength = preflopStrength(situation.holeCards);
    const callAmount = situation.currentBet - situation.myBet;
    const potOdds = situation.pot > 0 ? callAmount / (situation.pot + callAmount) : 0;

    let decision: PokerDecision;
    let confidence: number;
    const specificity = 0.75; // poker betting is moderately specialized

    if (situation.phase === 'preflop') {
      // Pre-flop reflex patterns
      if (callAmount === 0) {
        // No bet to call — check or raise
        if (handStrength > 0.8 && situation.position !== 'early') {
          const raiseAmount = Math.min(situation.pot * 0.75 + situation.currentBet, situation.myChips);
          decision = { action: 'raise', amount: Math.round(raiseAmount), reasoning: 'Strong hand, raising for value' };
          confidence = 0.92;
        } else {
          decision = { action: 'check', reasoning: 'No bet, seeing free cards' };
          confidence = 0.88;
        }
      } else if (handStrength > 0.85) {
        // Premium hand — raise
        const raiseAmount = Math.min(situation.currentBet * 2.5, situation.myChips);
        decision = { action: 'raise', amount: Math.round(raiseAmount), reasoning: 'Premium hand, 3-bet for value' };
        confidence = 0.94;
      } else if (handStrength > 0.6 || (handStrength > 0.4 && potOdds < 0.2)) {
        // Playable hand — call
        decision = { action: 'call', amount: callAmount, reasoning: 'Playable hand with good odds' };
        confidence = 0.87;
      } else {
        // Trash hand — fold
        decision = { action: 'fold', reasoning: 'Weak hand, not worth the call' };
        confidence = 0.90;
      }
    } else {
      // Post-flop: simplified reflex (real system would evaluate board texture)
      if (callAmount === 0) {
        if (handStrength > 0.75) {
          const raiseAmount = Math.min(Math.round(situation.pot * 0.66), situation.myChips);
          decision = { action: 'raise', amount: raiseAmount, reasoning: 'Strong hand post-flop, betting for value' };
          confidence = 0.85;
        } else {
          decision = { action: 'check', reasoning: 'Free card' };
          confidence = 0.82;
        }
      } else if (handStrength > 0.7 && potOdds < 0.3) {
        decision = { action: 'call', amount: callAmount, reasoning: 'Strong enough to continue' };
        confidence = 0.80;
      } else if (potOdds < 0.15) {
        decision = { action: 'call', amount: callAmount, reasoning: 'Cheap to see next card' };
        confidence = 0.75;
      } else {
        decision = { action: 'fold', reasoning: 'Not enough equity to call' };
        confidence = 0.83;
      }
    }

    return {
      tileId: 'tile:poker-bet',
      actionId: action.id,
      output: decision,
      confidence,
      specificity,
      latencyMs: 1,
    };
  },

  onFeedback(feedback: TileFeedback): void {
    if (feedback.outcome === 'corrected_by_cortex') {
      // Cortex overrode our reflex — adjust confidence thresholds.
      // In a real system, this would tighten or loosen the deadband.
    }
  },
};
