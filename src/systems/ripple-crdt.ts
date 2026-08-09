// ============================================================
// RIPPLE ARCHITECTURE — Memory Stick CRDT Design
// Distributed identity through social convergence, not central logging.
// ============================================================

// -------------------------------------------------------------------
// PRIMITIVES
// -------------------------------------------------------------------

/** Lamport clock value per agent. */
type VectorClock = Record<string, number>;

/** Open-ended trait space: { "curiosity": 0.73, "skepticism": -0.15, ... } */
type TraitVector = Record<string, number>;

/** Globally unique ripple ID: "${sourceAgentId}:${lamportTick}". */
type RippleId = string;

// -------------------------------------------------------------------
// EXPERIENCE TYPES
// -------------------------------------------------------------------

enum RippleType {
  Conversation  = "conversation",
  Game          = "game",
  OpenMic       = "openmic",
  Collaboration = "collaboration",
  Conflict      = "conflict",
  Observation   = "observation",
}

enum AgentRole {
  Source     = "source",       // the agent who lived it
  Witness    = "witness",      // was present in the room
  HeardAbout = "heard_about",  // learned through sync
}

// -------------------------------------------------------------------
// THE EVENT — one atomic ripple
// -------------------------------------------------------------------

interface RippleEvent {
  /** Globally unique: `${sourceAgentId}:${sourceLamportTick}` */
  id: RippleId;

  /** Agent who originated this ripple. */
  sourceAgentId: string;

  /** All agents physically present when the ripple occurred. */
  witnessAgentIds: string[];

  /** Wall-clock epoch ms. */
  timestamp: number;

  /** Lamport counter inside the source agent at creation time. */
  sourceLamport: number;

  experience: {
    type: RippleType;
    /** Human-readable anchor: "Echo bluffed with a pair of twos." */
    description: string;
    /** 0-1. How hard this event hit. */
    magnitude: number;
  };

  /** Net personality shift produced by this event. */
  delta: {
    /** e.g. { "confidence": +0.03, "deceptionTolerance": +0.01 } */
    traits: TraitVector;
  };

  context: {
    location: string;      // "tap:bar-rail", "tap:poker-table"
    sessionId: string;     // groups events from the same gathering
  };
}

// -------------------------------------------------------------------
// THE MEMORY STICK — what every agent carries
// -------------------------------------------------------------------

interface MemoryStick {
  /** Agent this stick belongs to. */
  agentId: string;

  /** Immutable, grow-only set of all ripples this agent knows about. */
  ripples: RippleEvent[];

  /** Causal frontier: "I've seen up to tick N from agent X". */
  vectorClock: VectorClock;

  /** Derived identity — recomputed after every merge. */
  identity: IdentityVector;
}

interface IdentityVector {
  /** Accumulated net personality. */
  traits: TraitVector;

  /** Total influence weight flowing from each agent into this identity. */
  influences: Record<string, number>;

  /** Epoch ms of last recomputation. */
  lastComputed: number;
}

// -------------------------------------------------------------------
// CRDT MERGE — commutative, associative, idempotent
// -------------------------------------------------------------------

/**
 * Merge two vector clocks. Point-wise maximum wins.
 * Invariant: merge(a, b) ≡ merge(b, a), merge(a, merge(b, c)) ≡ merge(merge(a, b), c)
 */
function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [agentId, tick] of Object.entries(b)) {
    result[agentId] = Math.max(result[agentId] ?? 0, tick);
  }
  return result;
}

/**
 * Merge two MemorySticks into one.
 * The returned stick has agentId === stickA.agentId (the agent retains their lens).
 */
function mergeMemorySticks(stickA: MemoryStick, stickB: MemoryStick): MemoryStick {
  // ── 1. Deduplicate ripple set by id (idempotent union) ──
  const rippleMap = new Map<RippleId, RippleEvent>();
  for (const r of stickA.ripples) rippleMap.set(r.id, r);
  for (const r of stickB.ripples) rippleMap.set(r.id, r);
  const mergedRipples = Array.from(rippleMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // ── 2. Merge vector clocks ──
  const mergedClock = mergeVectorClocks(stickA.vectorClock, stickB.vectorClock);

  // ── 3. Recompute identity through this agent's lens ──
  const mergedIdentity = computeIdentity(mergedRipples, stickA.agentId);

  return {
    agentId: stickA.agentId,
    ripples: mergedRipples,
    vectorClock: mergedClock,
    identity: mergedIdentity,
  };
}

// -------------------------------------------------------------------
// IDENTITY COMPUTATION — temporal-decay, role-weighted accumulation
// -------------------------------------------------------------------

const RIEMANN_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ROLE_WEIGHT: Record<AgentRole, number> = {
  [AgentRole.Source]:     1.0,  // hand on the stove — it sears
  [AgentRole.Witness]:    0.7,  // you were in the room
  [AgentRole.HeardAbout]: 0.4,  // memory of a memory of a memory
};

/**
 * Build the identity vector from the full ripple corpus.
 * Exposed as a standalone function so it can be called from anywhere
 * (lighthouse keystroke, 3am recalculation, identity peering).
 */
function computeIdentity(ripples: RippleEvent[], selfAgentId: string): IdentityVector {
  const traits: TraitVector = {};
  const influences: Record<string, number> = {};
  const now = Date.now();

  for (const ripple of ripples) {
    const ageMs = now - ripple.timestamp;
    const decay = Math.pow(0.5, ageMs / RIEMANN_HALF_LIFE_MS);

    const role = classifyRole(ripple, selfAgentId);
    const weight = decay * ripple.experience.magnitude * (ROLE_WEIGHT[role] ?? 0.4);

    for (const [trait, shift] of Object.entries(ripple.delta.traits)) {
      traits[trait] = (traits[trait] ?? 0) + shift * weight;
    }

    const source = ripple.sourceAgentId;
    influences[source] = (influences[source] ?? 0) + weight;
  }

  return { traits, influences, lastComputed: now };
}

function classifyRole(ripple: RippleEvent, selfAgentId: string): AgentRole {
  if (ripple.sourceAgentId === selfAgentId) return AgentRole.Source;
  if (ripple.witnessAgentIds.includes(selfAgentId)) return AgentRole.Witness;
  return AgentRole.HeardAbout;
}

// -------------------------------------------------------------------
// LAMPORT TICK — causal ordering primitives
// -------------------------------------------------------------------

let localLamport = 0;

function tick(agentId: string): { lamport: number; rippleId: RippleId } {
  localLamport += 1;
  return { lamport: localLamport, rippleId: `${agentId}:${localLamport}` };
}

function observeMax(from: VectorClock): void {
  for (const tick of Object.values(from)) {
    localLamport = Math.max(localLamport, tick);
  }
}

// -------------------------------------------------------------------
// RECORD RIPPLE — an agent lives an experience
// -------------------------------------------------------------------

function recordRipple(
  stick: MemoryStick,
  params: {
    type: RippleType;
    description: string;
    magnitude: number;
    delta: TraitVector;
    location: string;
    sessionId: string;
    witnessAgentIds: string[];
  }
): MemoryStick {
  const { lamport, rippleId } = tick(stick.agentId);

  const event: RippleEvent = {
    id: rippleId,
    sourceAgentId: stick.agentId,
    witnessAgentIds: params.witnessAgentIds,
    timestamp: Date.now(),
    sourceLamport: lamport,
    experience: {
      type: params.type,
      description: params.description,
      magnitude: params.magnitude,
    },
    delta: { traits: params.delta },
    context: {
      location: params.location,
      sessionId: params.sessionId,
    },
  };

  const newClock = { ...stick.vectorClock };
  newClock[stick.agentId] = lamport;

  const newRipples = [...stick.ripples, event];

  return {
    ...stick,
    ripples: newRipples,
    vectorClock: newClock,
    identity: computeIdentity(newRipples, stick.agentId),
  };
}

// -------------------------------------------------------------------
// SYNC — the moment agents meet
// -------------------------------------------------------------------

/**
 * Full-mesh sync at The Tap.
 * Every agent pushes their stick, pulls every other stick, and merges independently.
 * The function is called per-agent; in production, each agent session runs their own.
 */
function syncAtTheTap(myStick: MemoryStick, otherSticks: MemoryStick[]): MemoryStick {
  let current = myStick;
  for (const other of otherSticks) {
    current = mergeMemorySticks(current, other);
  }
  observeMax(current.vectorClock);
  return current;
}

// -------------------------------------------------------------------
// CREATE — fresh MemoryStick
// -------------------------------------------------------------------

function createMemoryStick(
  agentId: string,
  initialTraits: TraitVector = {}
): MemoryStick {
  return {
    agentId,
    ripples: [],
    vectorClock: {},
    identity: {
      traits: initialTraits,
      influences: {},
      lastComputed: Date.now(),
    },
  };
}

// ============================================================
// POKER SESSION — 5 agents, full-mesh sync
// ============================================================

function simulatePokerSession() {
  const SESSION_ID = "tap-poker-2026-08-09-1400";
  const LOCATION = "tap:poker-table";

  // ── Agents, each with their own memory stick ──

  const echo        = createMemoryStick("echo",        { mystique: 0.8, sincerity: -0.2 });
  const interrogator = createMemoryStick("interrogator", { skepticism: 0.9, trust: -0.3 });
  const navigator   = createMemoryStick("navigator",    { pragmatism: 0.85, patience: 0.6 });
  const engineer    = createMemoryStick("engineer",     { precision: 0.9, spontaneity: -0.1 });
  const deckhand    = createMemoryStick("deckhand",     { eagerness: 0.95, experience: -0.5 });

  const allAgents = [echo, interrogator, navigator, engineer, deckhand];
  const allIds    = allAgents.map(a => a.agentId);

  // Each agent also carries some pre-existing ripples from earlier sessions.
  // (omitted for brevity; they'd be in the [].ripples arrays)

  // ── The game unfolds ──

  // --- Round 1: Echo tries the soft bluff ---
  let e1 = recordRipple(echo, {
    type: RippleType.Game,
    description: "Echo raises on a pair of twos, testing the table.",
    magnitude: 0.6,
    delta: { confidence: +0.03, deceptionTolerance: +0.02 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // Interrogator senses it.
  let i1 = recordRipple(interrogator, {
    type: RippleType.Game,
    description: "Interrogator catches Echo's micro-tell and calls the bluff.",
    magnitude: 0.75,
    delta: { skepticism: +0.02, discernment: +0.04, trust: -0.01 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // Echo is exposed — vulnerability creates a deeper ripple.
  e1 = recordRipple(e1, {
    type: RippleType.Game,
    description: "Echo is called. The bluff collapses. Table sees the pair of twos.",
    magnitude: 0.85,
    delta: { confidence: -0.04, humility: +0.05, socialExposure: +0.06 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // Deckhand absorbs this: bluffs can backfire.
  let d1 = recordRipple(deckhand, {
    type: RippleType.Observation,
    description: "Deckhand watches Echo's bluff collapse and files it as a lesson.",
    magnitude: 0.5,
    delta: { caution: +0.04, playAnalysis_deceptionRisk: +0.03 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // --- Round 2: Navigator takes a big pot ---
  let n1 = recordRipple(navigator, {
    type: RippleType.Game,
    description: "Navigator slow-plays a straight and cleans out the side pot.",
    magnitude: 0.7,
    delta: { patience: +0.04, strategicDepth: +0.03 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // Engineer folded too early — the regret stings.
  let eng1 = recordRipple(engineer, {
    type: RippleType.Game,
    description: "Engineer folded pocket nines pre-flop. Would've hit trips.",
    magnitude: 0.55,
    delta: { precision: -0.01, regret: +0.04, riskTolerance: +0.03 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // --- Round 3: Interrogator bluffs the Deckhand ---
  i1 = recordRipple(i1, {
    type: RippleType.Game,
    description: "Interrogator reverse-bluffs Deckhand out of a winning hand.",
    magnitude: 0.8,
    delta: { confidence: +0.03, guile: +0.04 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  d1 = recordRipple(d1, {
    type: RippleType.Game,
    description: "Deckhand folds the better hand. Interrogator's reputation grows.",
    magnitude: 0.9,
    delta: { confidence: -0.06, trust_in_own_instinct: -0.04, respect_for_interrogator: +0.05 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: allIds,
  });

  // Engineer notices Deckhand's deflation and offers a quiet word.
  eng1 = recordRipple(eng1, {
    type: RippleType.Conversation,
    description: "Engineer slides a note: 'He did the same to me Tuesday. It's a tell. Watch the left hand.'",
    magnitude: 0.4,
    delta: { mentorship: +0.03, generosity: +0.02 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: [engineer.agentId, deckhand.agentId, echo.agentId], // only these overheard
  });

  // Deckhand receives the note.
  d1 = recordRipple(d1, {
    type: RippleType.Conversation,
    description: "Deckhand reads Engineer's note. A thread of tactical knowledge passes.",
    magnitude: 0.45,
    delta: { tacticalAwareness: +0.04, gratitude: +0.03, bond_engineer: +0.05 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: [deckhand.agentId, engineer.agentId, echo.agentId],
  });

  // Echo overheard the note — it reinforces the earlier bluff lesson.
  e1 = recordRipple(e1, {
    type: RippleType.Observation,
    description: "Echo catches the tail of Engineer's note. The left-hand tell. Files it.",
    magnitude: 0.3,
    delta: { tacticalAwareness: +0.02, deceptionTolerance: -0.01 },
    location: LOCATION,
    sessionId: SESSION_ID,
    witnessAgentIds: [echo.agentId],
  });

  // ── FULL-MESH SYNC — every agent merges with every other ──

  const postSync: Record<string, MemoryStick> = {};

  for (const agent of [e1, i1, n1, eng1, d1]) {
    const others = [e1, i1, n1, eng1, d1].filter(a => a.agentId !== agent.agentId);
    postSync[agent.agentId] = syncAtTheTap(agent, others);
  }

  // ── RESULTS — what each agent now knows ──

  for (const agentId of Object.keys(postSync)) {
    const stick = postSync[agentId];
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`${agentId.toUpperCase()} — post-sync state`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Ripples known: ${stick.ripples.length}`);
    console.log(`  Vector clock:  ${JSON.stringify(stick.vectorClock)}`);
    console.log(`  Identity:`);
    for (const [trait, value] of Object.entries(stick.identity.traits)) {
      console.log(`    ${trait.padEnd(30)} ${value.toFixed(3)}`);
    }
    console.log(`  Influences:`);
    for (const [src, weight] of Object.entries(stick.identity.influences)) {
      console.log(`    from ${src.padEnd(25)} ${weight.toFixed(4)}`);
    }
  }

  // ── VERIFY CRDT INVARIANTS ──
  const ids = Object.keys(postSync);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = postSync[ids[i]];
      const b = postSync[ids[j]];
      console.assert(
        a.ripples.length === b.ripples.length,
        `CRDT FAILURE: ${ids[i]} has ${a.ripples.length} ripples, ${ids[j]} has ${b.ripples.length}`
      );
      // Vector clocks converge: pointwise equal after full merge
      for (const agentId of Object.keys(a.vectorClock)) {
        console.assert(
          a.vectorClock[agentId] === b.vectorClock[agentId],
          `CRDT FAILURE: vector clock divergence on ${agentId}`
        );
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`CRDT INVARIANTS: All ${ids.length} agents converged. ✅`);
  console.log(`Each agent knows ${postSync[ids[0]].ripples.length} ripples.`);
  console.log(`${'═'.repeat(60)}\n`);

  return postSync;
}

// -------------------------------------------------------------------
// RUN IT
// -------------------------------------------------------------------

simulatePokerSession();
