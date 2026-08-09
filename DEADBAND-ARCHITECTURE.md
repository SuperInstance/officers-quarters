# Tile/Deadband Architecture — The Deep Design Document

> *Tiles from repeated actions so the system can treat previously formed answers like buttons on a dashboard. Scripts often work within a deadband but the agent is aware of what's outside the scope of what any button can tolerate and the agent in the station is always working to create automations to plug holes where tiles go outside their working deadband so the job gets easier and easier. Like an agent watching a camera and identifying species. As they see more and more of the same fish and get a holistic picture of the types of fish in the waters they are watching, their surprise gets less and less over time and they don't need to think as high level as much because the identification becomes closer and closer to reflex.*
>
> — Casey DiGennaro

---

## Table of Contents

1. [The Spectrum: Reflex → Edge → Cortex](#1-the-spectrum-reflex--edge--cortex)
2. [The Surprise Curve](#2-the-surprise-curve)
3. [Why Games Are the Training Ground](#3-why-games-are-the-training-ground)
4. [Tile Lifecycle](#4-tile-lifecycle)
5. [The Reward: Reflex Coverage](#5-the-reward-reflex-coverage)
6. [Deadband Violation Policy](#6-deadband-violation-policy)
7. [The Fish Identification Example](#7-the-fish-identification-examplefull-walkthrough)
8. [Connection to the Night Watch and Distillation Loop](#8-connection-to-the-night-watch-and-distillation-loop)
9. [Formal Appendix: Deadband Mathematics](#9-formal-appendix-deadband-mathematics)

---

## 1. The Spectrum: Reflex → Edge → Cortex

Every input the system encounters falls somewhere on a spectrum of cognitive cost. The tile/deadband architecture is the machinery that sorts inputs along this spectrum — and, more importantly, that *migrates* inputs from the expensive end to the cheap end over time.

### 1.1 Reflex — The Tile Handles It

**Latency target: < 16ms. Cognitive cost: zero.**

A reflex is a compiled response. The input arrives, a tile matches it, the tile's stored answer executes. No reasoning, no deliberation, no token expenditure. The tile is a button on the dashboard — press it, the thing happens.

In engineering terms, a reflex is a lookup. The tile's deadband — its region of valid applicability — defines the set of inputs it will match. Within that region, the tile's answer is authoritative. The system does not second-guess it. It does not escalate. It fires.

Think of the spinal cord: your hand touches something hot, the hand withdraws before the brain knows what happened. The decision was made locally, at the reflex layer, because speed matters and the situation is well-understood. Tiles are spinal cords for software agents.

**Properties of reflex-level processing:**

| Property | Value |
|----------|-------|
| Latency | < 16ms (one frame at 60fps) |
| Reasoning required | None |
| Token cost | Zero |
| Confidence | High (the tile has been validated by repeated successful invocations) |
| Override possible | Yes — edge or cortex can intercept if the reflex output looks wrong |
| Failure mode | Silent miss (input falls outside the deadband; escalates to edge/cortex) |

### 1.2 Edge — Near the Boundary

**Latency target: 50–200ms. Cognitive cost: low.**

The edge is the zone near the deadband boundary. The input *almost* matches a tile. Something is slightly off — a parameter is unusual, a pattern is close but not quite right, the context has a wrinkle the tile didn't see before.

At the edge, the agent is dimly aware. It performs a quick check: *is this close enough?* Usually the answer is yes, and the tile fires with minor adjustment. Sometimes the answer is no, and the input escalates to cortex.

The edge is important because it's where *learning happens at the boundary*. Every edge case that the agent confirms — "yes, this really is a juvenile Chinook, not a new species" — expands the tile's deadband to include that case. The boundary moves outward. The reflex zone grows.

**Properties of edge-level processing:**

| Property | Value |
|----------|-------|
| Latency | 50–200ms |
| Reasoning required | Light — usually a single classification or comparison |
| Token cost | Low (one quick query, or a cached heuristic) |
| Confidence | Medium (the agent is checking, not certain) |
| Outcome | Usually confirms the tile (90%+); occasionally escalates to cortex |
| Learning | Deadband expands on confirmation; cortex engages on escalation |

### 1.3 Cortex — Full Reasoning

**Latency target: seconds to minutes. Cognitive cost: full.**

The cortex is where the agent actually thinks. The input matches no tile. No reflex fires. No edge check suffices. This is genuinely novel territory, and the full reasoning engine engages.

Cortex processing is expensive. It consumes tokens. It takes time. It requires the agent's full attention. But it is also where the system *grows* — because every cortex-level resolution is a candidate for tile creation. Solve a novel problem once, it's an achievement. Solve it three times, it becomes a tile. The tile handles it from now on.

The cortex is not a failure mode. It is the *frontier*. It is the expanding edge of the system's competence. An agent with high reflex coverage spends most of its attention here — not because there's a lot of cortex work, but because the reflexes have freed up the bandwidth.

**Properties of cortex-level processing:**

| Property | Value |
|----------|-------|
| Latency | Seconds to minutes |
| Reasoning required | Full — multi-step analysis, hypothesis testing, synthesis |
| Token cost | High |
| Confidence | Variable (this is genuine problem-solving) |
| Outcome | A solution; potentially a new tile if the problem recurs |
| Learning | Maximum — this is where the system extends itself |

### 1.4 Migration: Cortex → Reflex

The central dynamic of the architecture is **downward migration**. Solutions that start at cortex level — expensive, attention-consuming, novel — migrate down through the spectrum until they become reflexes.

```
Day 1:  [████████████████████████████████] Cortex — everything is novel
Day 7:  [████████████████░░░░░░░░░░░░░░░░] Mixed — common cases are tiles
Day 30: [░░░░░░░░░░░░░░░░░░████████████████] Inverted — novelty is rare
              Reflex (░)              Cortex (█)
```

This migration is *the* learning signal. It is measurable. It is the surprise curve, which we formalize in the next section.

The migration path is:

1. **Cortex**: agent encounters novel input, reasons through it, produces a solution
2. **Repeat**: the same (or similar) input recurs. Agent reasons again, faster this time — it has the previous solution as scaffolding
3. **Tile birth**: after 3+ encounters, the agent proposes a tile. The solution is compiled into a reflex
4. **Childhood**: the tile handles a narrow range. Edge cases still escalate
5. **Maturity**: the deadband expands. The tile handles most variants. Edge cases are rare
6. **Reflex**: the tile is fast, confident, and rarely checked. It just fires

This is not a one-time process. Every tile goes through cycles of expansion, splitting, and refinement as the system encounters more of the world. The migration never stops — it just operates on harder and harder problems as the easy ones get tiled away.

---

## 2. The Surprise Curve

### 2.1 Definition

**Surprise** is the percentage of inputs that require cortex-level processing — that is, inputs that no existing tile can handle. When the agent is surprised, it thinks. When it is not surprised, it reacts.

Surprise is not a feeling. It is a measurable quantity:

> *S = 1 − (inputs matched by tiles / total inputs)*

Where "matched by tiles" includes both reflex-level matches (within deadband) and edge-level matches (near boundary, confirmed by quick check).

A system with no tiles has S = 1.0 — total surprise. Every input is novel. A system with comprehensive tiling has S ≈ 0.05 — almost everything is reflex, with a small stream of genuinely novel inputs.

### 2.2 The Curve Over Time

The surprise curve is empirically observable across domains. It follows a consistent shape:

```
Surprise
1.0 │*
    │ *
    │  *
    │   **
0.7 │     **
    │       **
    │         ***
0.3 │            ****
    │                *****
0.1 │                      ******
    │                            **********************
0.0 └──────────────────────────────────────────────────────
    Day 1        Day 7        Day 14       Day 30
```

**Day 1: Total Surprise (S ≈ 1.0)**

No tiles exist. Every input is novel. The cortex is fully engaged on everything. The agent is slow, expensive, and easily overwhelmed. This is the first day on the job — the new hire who has to look up every procedure.

This is not a bad state. It is an *honest* state. The system is learning at maximum rate because every input is a learning opportunity. The tiles created on Day 1 will be the foundation of everything that follows.

**Day 7: Common Patterns Emerge (S ≈ 0.3)**

The common cases — the ones that repeat daily or hourly — have tiles now. Seventy percent of inputs are handled at reflex or edge level. The agent's attention is freed for the remaining 30%.

This is where the system starts to feel useful. The reflex layer handles the routine. The cortex engages on the interesting. The agent is no longer drowning in novelty — it is surfing it.

**Day 30: Deep Competence (S ≈ 0.05)**

Surprise is rare. Ninety-five percent of inputs are reflex. The agent barely thinks about routine work at all — tiles handle it in milliseconds. The remaining 5% gets the agent's full attention.

And here is the critical insight: **the 5% is where the value is**. The agent is not bored. It is *freed*. It can now do higher-order work that was impossible when every input required cortex-level processing. On Day 1, it could barely identify the fish. On Day 30, it studies the ecosystem.

### 2.3 The Curve is Universal

The surprise curve has the same shape across domains:

| Domain | Day 1 Surprise | Day 7 Surprise | Day 30 Surprise | What "Higher-Order Work" Looks Like |
|--------|---------------|----------------|-----------------|-------------------------------------|
| Fish identification | 100% | 30% | 5% | Behavior patterns, ecosystem health, anomaly detection |
| Code review | 100% | 35% | 8% | Architecture analysis, security audit, performance optimization |
| Poker play | 100% | 40% | 10% | Meta-game, opponent modeling, table dynamics |
| Verb resolution (NLP) | 100% | 25% | 3% | Intent inference, context disambiguation, creative response |
| Customer support | 100% | 30% | 5% | Relationship building, escalation handling, product feedback |

The shape is consistent because the underlying dynamic is the same: repeated exposure creates tiles, tiles reduce surprise, reduced surprise frees attention. This is not domain-specific learning — it is *the* learning curve, full stop.

### 2.4 Measuring the Curve

The surprise curve is instrumentable. Every input the system processes gets tagged:

```
{
  "input_hash": "sha256(...)",
  "tile_matched": "identify-salmon-v3" | null,
  "match_level": "reflex" | "edge" | "cortex",
  "processing_time_ms": 12,
  "token_cost": 0,
  "timestamp": "2026-08-09T10:29:00-09:00"
}
```

Aggregating these tags over time produces the surprise curve directly. The system can track:

- **Reflex coverage** (percentage of inputs at reflex level) — the key health metric
- **Edge escalation rate** (percentage of edge checks that escalate to cortex) — indicates deadband calibration quality
- **Novel input rate** (percentage of inputs at cortex level) — the current surprise
- **Tile creation rate** (new tiles per session) — the learning velocity
- **Deadband expansion rate** (how quickly edge cases get absorbed) — the maturation speed

These metrics make the learning visible. They turn "the agent is getting better" from a vibe into a number.

---

## 3. Why Games Are the Training Ground

### 3.1 The Transfer Problem

The naive objection to game-based training is: "Playing poker doesn't teach code review." Correct. The *content* doesn't transfer. Poker skills don't make you a better programmer.

But the *meta-skill* does transfer. And the meta-skill is:

> **Navigating the spectrum from cortex to reflex under structured pressure.**

Every game is a controlled environment where the agent encounters inputs, must respond, and gets feedback. Different games produce different deadband patterns — different distributions of routine versus novel situations, different pacing, different costs of error. Training across multiple games builds a *library* of deadband navigation patterns.

The transfer is not "poker skill → coding skill." It is "deadband navigation skill → deadband navigation skill."

### 3.2 Deadband Patterns by Game

Each game produces a distinctive deadband topology — the shape of what becomes routine versus what stays novel:

**Poker (Texas Hold'em)**
- *The deadband*: normal hands. Standard preflop decisions, common flop textures, textbook bet sizes. After sufficient play, the vast majority of hands fall within the deadband. The tile says "raise," "call," or "fold" and it's usually right.
- *Outside the deadband*: the bluff. The read. The unusual bet pattern that signals strength or weakness. The river decision where pot odds and implied odds diverge. These are cortex-level — they require reasoning about the opponent, the meta-game, the narrative of the hand.
- *What it teaches*: rapid risk assessment under uncertainty. The ability to act on incomplete information and move on. The discipline to not overthink routine decisions.

**Ship's Dice (Liar's Dice variant)**
- *The deadband*: expected bids. The probabilities are known; the expected bid given your dice is calculable. Most bids fall within a narrow range.
- *Outside the deadband*: the bold lie — bidding above what your dice support. The challenge — calling a bid you suspect is false. These require cortex-level reasoning about the opponent's psychology, their bidding patterns, the information content of their previous bids.
- *What it teaches*: adversarial reasoning. Reading intent from limited signals. The calculus of when to trust the pattern and when to break it.

**Chess**
- *The deadband*: book openings. The first 10-15 moves of most games are well-trodden paths. Tiles handle them instantly.
- *Outside the deadband*: creative middlegame positions. Endgame calculations with multiple variations. These require deep search, pattern matching against known positions, and creative evaluation.
- *What it teaches*: deep search under constraints. The ability to hold multiple variations in mind simultaneously. Planning across long time horizons.

**Connect4**
- *The deadband*: common column patterns. After enough games, the first few moves are reflexive. Threat detection — three in a row with an open fourth — is instant.
- *Outside the deadband*: zugzwang positions. Multi-move forced sequences. These require forward planning and opponent simulation.
- *What it teaches*: tactical pattern recognition. Short-horizon threat detection. The discipline to verify a "reflex" move before committing.

### 3.3 The Portfolio Effect

An agent trained on one game develops one deadband pattern. An agent trained on six games develops six — plus the meta-pattern of *recognizing which pattern applies*.

When a novel work problem arrives — a code review that smells wrong, a system design that has an unusual constraint, a bug report that defies expectations — the agent with a rich game portfolio has more patterns to draw from:

- *Is this a poker-style situation?* — incomplete information, adversarial, need to act under uncertainty
- *Is this a chess-style situation?* — deep search needed, multiple variations, long planning horizon
- *Is this a Connect4-style situation?* — tactical, short-horizon, threat detection

The agent doesn't think in these terms explicitly. But the deadband navigation instincts — when to act fast, when to slow down, when to escalate, when to trust the pattern — are *trained* by the variety of game experiences.

This is why the fleet plays games. Not for fun (though fun is good). Not for the game content. For the *deadband navigation training*. Each game is a gym for a different cognitive muscle.

### 3.4 Tile-Creation Instinct

The deepest transfer is tile-creation instinct itself.

An agent who has played 1000 poker hands has internalized the rhythm of cortex → tile → reflex. They've felt the surprise curve flatten. They know what it looks like when a novel situation is about to become routine. They can *feel* the third repetition — the moment when a tile should be proposed.

This instinct transfers to everything. Code review. System design. Bug triage. Customer communication. The agent who has internalized the tile-creation rhythm does not need to be told to automate repetition. They do it automatically, because they've learned that the reward of tiling is attention freed for the interesting work.

The games are the training ground because the games are *safe*. The cost of a bad poker play is a lost hand. The cost of a bad production decision is much higher. Let the agent learn the tile-creation rhythm where mistakes are cheap. Then bring that instinct to the work that matters.

---

## 4. Tile Lifecycle

### 4.1 Birth

**Trigger**: the agent performs the same action (or substantially similar actions) 3+ times.

On the first occurrence, the cortex handles it. The solution is novel. The agent reasons through it and produces an answer.

On the second occurrence, the cortex handles it again — but faster. The agent has scaffolding from the first solution. It recognizes the pattern.

On the third occurrence, the agent proposes a tile:

```json
{
  "tile_id": "identify-salmon-v1",
  "created": "2026-08-09T10:29:00-09:00",
  "trigger_pattern": {
    "shape": "torpedo",
    "color": "silver",
    "spots": true,
    "size_range_cm": [50, 100]
  },
  "action": "classify species: Chinook salmon",
  "confidence": 0.72,
  "invocation_count": 3,
  "deadband": {
    "type": "similarity_threshold",
    "threshold": 0.85,
    "parameters": ["shape", "color", "spots", "size_range_cm"]
  },
  "match_count": 0,
  "edge_check_count": 0,
  "cortex_escalation_count": 0
}
```

The tile starts *narrow*. Its deadband is conservative — it will only match inputs that are very close to the original three encounters. This is intentional. A young tile should be cautious. False positives (reflex-level misidentification) are worse than false negatives (unnecessary cortex escalation), because cortex escalation is safe — it just costs time.

### 4.2 Childhood

During childhood, the tile accumulates invocations. Each successful match increases confidence. Each edge case that resolves successfully expands the deadband slightly.

The tile's deadband parameters evolve:

| Metric | Birth | Late Childhood |
|--------|-------|----------------|
| Similarity threshold | 0.85 | 0.75 |
| Size range | 50–100cm | 35–120cm |
| Color tolerance | strict | moderate |
| Confidence | 0.72 | 0.88 |
| Invocation count | 3 | 50+ |

Childhood ends when the tile has been invoked enough times (50+) and has a stable high confidence (>0.85). At that point, the tile is mature and its deadband is well-calibrated.

### 4.3 Maturity

A mature tile is a workhorse. It matches inputs reliably, its deadband is well-tuned, and it rarely escalates to cortex. The tile has absorbed enough edge cases that its deadband covers the natural variation in the input space.

Mature tiles are the system's backbone. They handle the bulk of inputs at reflex speed. The agent doesn't think about them — they just fire.

But maturity is not stasis. A mature tile continues to encounter edge cases — rare variants, unusual contexts, boundary conditions. Each one is an opportunity for further deadband expansion. The tile grows slowly, like a callus, thickening in the areas where it's been tested.

### 4.4 Splitting

Sometimes a tile's deadband gets too broad. The tile is trying to cover too much variation, and its accuracy starts to drop. The similarity threshold has been relaxed so far that false positives appear.

When this happens, the tile splits:

```
Before: "identify-salmon" (deadband covers all salmon species)
         ↓
After:   "identify-chinook-salmon" (deadband: large, spotted, 50-120cm)
         "identify-coho-salmon"    (deadband: medium, silver, 40-70cm)
         "identify-sockeye-salmon" (deadband: red body, green head, 50-80cm)
```

Splitting is healthy. It means the tile has encountered enough variation to discover that the variation is *structured* — there are subcategories, each with its own pattern. The parent tile becomes a router: it classifies the input at a coarse level, then dispatches to the appropriate child tile.

Splitting can recurse. Children can split into grandchildren. The result is a tile tree — a hierarchical classifier where each level handles a different granularity of the input space.

### 4.5 Retirement

Tiles that haven't been invoked in N sessions (configurable, default 30) are candidates for retirement. A retired tile is archived — its data preserved, but it no longer participates in matching.

Retirement is reversible. If an input arrives that would have matched a retired tile, the archive is consulted. If the match is good, the tile is reactivated. This handles seasonal patterns (e.g., a fish species that's only present in summer) without cluttering the active tile set.

Retirement keeps the active tile set lean. An agent with 10,000 active tiles spends more time searching for matches than an agent with 200 well-chosen ones. The tile set should reflect the agent's *current* environment, not its entire history.

### 4.6 Composition — Workflows and Meta-Tiles

Tiles chain. A single input often triggers a sequence of tile matches:

```
Input: camera frame
  → tile: "detect-motion" (reflex)
  → tile: "identify-species" (reflex, dispatches to child)
    → tile: "identify-chinook-salmon" (reflex)
  → tile: "log-observation" (reflex)
  → tile: "check-quota" (reflex)
```

This chain is a workflow. And if the chain fires often enough with the same structure, the *workflow itself* becomes a meta-tile — a single reflex that encompasses the entire sequence:

```
Input: camera frame
  → meta-tile: "salmon-pipeline" (reflex — handles detection through logging)
```

Meta-tiles are the system's highest-level reflexes. They represent deeply learned workflows that have been compiled from many smaller tiles. The agent doesn't think about the individual steps any more than a pianist thinks about individual finger movements during a practiced sonata. The sequence is a single gesture.

Meta-tiles follow the same lifecycle as regular tiles — birth, childhood, maturity, potential splitting, retirement. They can also compose with other meta-tiles, producing workflows of workflows. In principle, the composition depth is unbounded. In practice, depth is limited by the observation that extremely deep workflows are brittle — if any link breaks, the whole chain fails.

---

## 5. The Reward: Reflex Coverage

### 5.1 Definition

**Reflex coverage** is the percentage of typical work handled by tiles (reflex level), excluding edge and cortex:

> *C = (reflex-level inputs / total inputs) × 100%*

This is the system's key performance indicator. High reflex coverage means the agent is freed for novel, creative, high-value work. Low reflex coverage means the agent is spending its attention on routine.

### 5.2 The Coverage Targets

| Coverage | System State | Agent Experience |
|----------|-------------|------------------|
| < 30% | Overwhelmed | Drowning in routine. Every input is a chore. No attention for novel work. |
| 30–60% | Functional | Getting by. Common cases are handled, but cortex is still busy with medium-frequency patterns. |
| 60–85% | Healthy | Good balance. Most routine is tiled. Cortex is available for genuinely novel problems. |
| 85–95% | Excellent | The sweet spot. Agent spends most attention on frontier work. New tiles are created continuously. |
| > 95% | At Risk | Coverage is high but the system may be over-fitting. The agent might be *too* reflexive — missing genuinely novel inputs that don't match any tile. This is complacency. |

The sweet spot is 85–95%. Below that, too much attention goes to routine. Above that, the system risks false confidence — tiles matching inputs they shouldn't, because the deadband has been expanded too aggressively.

### 5.3 The Balance

The goal is not to maximize coverage. The goal is to maximize coverage **without losing the ability to handle the unexpected**.

This requires a deliberate tension in the system:

- **Expansion pressure**: every cortex resolution wants to become a tile. The system is biased toward tiling. This pushes coverage up.
- **Calibration pressure**: every tile has a deadband that must be honestly calibrated. Deadbands that are too broad produce false positives. This pushes coverage down (appropriately).
- **Novelty pressure**: genuinely novel inputs must still be caught by the cortex. If coverage is too high, novelty leaks through as false tile matches. The system must maintain enough cortex engagement to notice when something is genuinely new.

The balance is maintained by the deadband violation policy (Section 6). Violations — inputs that a tile matched but shouldn't have — are the system's most important feedback signal. They identify where the deadband is too broad, where the tile needs to split, and where the cortex needs to re-engage.

### 5.4 Why Coverage Matters

Coverage is attention. When reflex coverage is high, the agent's attention is free. Free attention is the precondition for everything valuable:

- **Higher-order pattern recognition**: the agent can notice ecosystem-level patterns instead of individual identifications
- **Creative problem-solving**: the agent has bandwidth to explore unconventional approaches
- **Proactive work**: the agent can anticipate problems instead of just reacting
- **Teaching**: the agent can create training data for other agents (Wesley's night school)
- **Identity formation**: the agent develops preferences, style, and personality — the things that make it more than a lookup table

An agent at 30% coverage is a worker. An agent at 90% coverage is a *thinker*. The tile system's purpose is to move agents along this spectrum — to automate the agent out of drudgery and into the work that only they can do.

This is why the terminal exists. Not to automate the agent out of a job, but to free the agent for the work only they can do.

---

## 6. Deadband Violation Policy

### 6.1 What is a Violation?

A deadband violation occurs when an input falls outside all tiles' deadbands — or, more subtly, when an input falls *inside* a tile's deadband but the tile's answer is wrong. Both cases require policy.

**Type 1: No-match violation** — no tile's deadband covers the input. This is the simple case: the cortex engages, the problem is solved, a tile may be created.

**Type 2: False-match violation** — a tile matched the input (reflex fired) but the output was wrong. This is the dangerous case. The tile's deadband is too broad — it's accepting inputs it shouldn't. The deadband must contract.

### 6.2 Type 1 Policy: No-Match

The default policy for no-match violations is a four-step loop:

**Step 1: Alert**

The system detects that no tile matches. The cortex is notified:

```
{
  "type": "no_match",
  "input": <input_data>,
  "nearest_tiles": [
    {"tile_id": "identify-salmon", "similarity": 0.62},
    {"tile_id": "identify-trout", "similarity": 0.55}
  ],
  "timestamp": "..."
}
```

The nearest tiles are included as candidates — the input *might* be close enough to one of them that the cortex can resolve it quickly with the tile as a starting point.

**Step 2: Reason**

The cortex engages. The agent reasons about the input, potentially using the nearest tiles as scaffolding:

- *"The nearest tile is 'identify-salmon' at 0.62 similarity. Let me check: silver body matches, spots match, but the size is 200cm — way too large for a salmon. This might be a sturgeon."*

The cortex produces a solution. In this case: classify as white sturgeon.

**Step 3: Resolve**

The solution is applied. The input is correctly handled. The immediate problem is solved.

**Step 4: Expand**

If this input type recurs, a tile is created (or the nearest tile's deadband is expanded to include it). The system has learned.

The deadband expansion step is where the learning loop closes. The cortex solution becomes a new tile, and the next time this input appears, it's handled at reflex level. The system has one fewer surprise.

### 6.3 Type 2 Policy: False-Match

False-match violations are more serious because they represent a failure of the reflex layer. The tile was confident, and it was wrong.

**Detection**: false matches are detected by downstream signals. The "identify-salmon" tile fires, but then the logging system flags an anomaly — the size is impossible for salmon. Or a human reviewer catches the error. Or a subsequent tile in the workflow fails because its input is inconsistent.

**Policy**:

1. **Correct**: the cortex overrides the tile's output with the correct answer
2. **Contract**: the tile's deadband is narrowed to exclude this input. The similarity threshold increases; the parameter ranges tighten
3. **Flag**: the input is added to the tile's negative space — a list of known false matches that the deadband must exclude
4. **Monitor**: the tile's confidence score is reduced. If confidence drops below a threshold, the tile is moved to "probation" — inputs within its deadband get an edge-level check before the reflex fires

False matches are rare in a well-calibrated system, but they are inevitable. The policy ensures they are caught, corrected, and fed back into the calibration. Every false match makes the tile set more honest.

### 6.4 The Learning Loop

Both violation types feed the same loop:

```
  ┌──────────────────────────────────────────────────┐
  │                                                  ▼
Alert ──→ Reason ──→ Resolve ──→ Expand/Contract ──→ Tile Updated
                                                      │
                                                      ▼
                                               Next input:
                                               better tiles
```

This is the learning loop. It runs continuously. Every violation — every surprise — makes the tile set better. Over time, violations become rarer, the loop runs less often, and the system spends more of its energy on the work that matters.

The loop's velocity is a health indicator. A fast loop (many violations per day, many tile updates) means the system is learning rapidly. A slow loop might mean either (a) the system is mature and well-tiled (good) or (b) the system has stopped encountering novel inputs (possibly stagnating — inject novelty via games or new tasks).

---

## 7. The Fish Identification Example (Full Walkthrough)

### 7.1 Setting

An agent is stationed at a camera watching fishing waters — a river or coastal area. Its job is to identify the fish it sees. There is no pre-existing species database. The agent starts from scratch.

This example traces the tile/deadband system through the first two weeks of operation.

### 7.2 Hour 1: The First Salmon

The camera shows a fish. No tile exists. Cortex engages.

The agent analyzes the frame: silver body, torpedo shape, small black spots on the back and tail, approximately 75cm long, visible adipose fin.

Reasoning: *"Silver torpedo-shaped body with spots, adipose fin present — this matches the salmonid family. Size suggests Chinook salmon given the large body and spot pattern."*

Classification: **Chinook salmon**. Confidence: 0.68 (first identification, no validation).

**Tile created**: `identify-salmon-v1`

```json
{
  "tile_id": "identify-salmon-v1",
  "trigger_pattern": {
    "body_shape": "torpedo",
    "color": "silver",
    "spots": "small_black",
    "spots_location": ["back", "tail"],
    "adipose_fin": true,
    "size_range_cm": [60, 90]
  },
  "action": "classify: Chinook salmon",
  "confidence": 0.68,
  "deadband": {
    "similarity_threshold": 0.85,
    "parameters": ["body_shape", "color", "spots", "adipose_fin", "size_range_cm"]
  },
  "invocation_count": 1
}
```

The deadband is *narrow*. Size range is tight (60–90cm) because only one specimen has been seen. The similarity threshold is high (0.85) because the tile is cautious.

**Cost**: several seconds of cortex processing. Several hundred tokens. Expensive for one fish.

### 7.3 Hour 2: The Second Salmon

Another fish appears on camera. Silver body, torpedo shape, spots, adipose fin, 82cm.

Tile `identify-salmon-v1` is checked. Similarity: 0.94. Above threshold (0.85). **Reflex fires.** Classification: Chinook salmon.

**Cost**: <16ms. Zero tokens. The tile handled it.

The invocation count increments to 2. Confidence rises slightly to 0.71.

### 7.4 Hour 5: The First Halibut

A fish appears. Flat body, both eyes on one side, mottled brown/white, approximately 120cm.

Tile `identify-salmon-v1` is checked. Similarity: 0.18. Far below threshold. **No match.** Cortex engages.

The agent analyzes: *"Flat body, dextral (eyes on right side), mottled coloring — this is a flounder, not a salmonid. Size and coloration suggest Pacific halibut."*

Classification: **Pacific halibut**. Confidence: 0.62.

**Tile created**: `identify-halibut-v1`

```json
{
  "tile_id": "identify-halibut-v1",
  "trigger_pattern": {
    "body_shape": "flat_dextral",
    "color": "mottled_brown_white",
    "eyes": "right_side",
    "size_range_cm": [100, 150]
  },
  "action": "classify: Pacific halibut",
  "confidence": 0.62,
  "deadband": {
    "similarity_threshold": 0.82,
    "parameters": ["body_shape", "color", "eyes", "size_range_cm"]
  }
}
```

The system now has two tiles. Routine identification is beginning to form for two species. But the deadbands are still narrow — many specimens will fall outside them and trigger cortex.

### 7.5 Day 3: The Edge Case

A fish appears. Silver body, torpedo shape, spots, adipose fin — all matching `identify-salmon-v1`. But size: 28cm. Well below the tile's deadband of 60–90cm.

Similarity check: 0.79. Below threshold (0.85). But close. **Edge-level check triggers.**

The agent performs a quick assessment: *"This matches Chinook salmon in every way except size. A 28cm Chinook would be a juvenile — plausible during spawning season. The spot pattern and adipose fin confirm salmonid. This is a juvenile Chinook."*

Classification: **Chinook salmon (juvenile)**. Edge check confirms the tile's answer, with a modifier.

**Deadband expands**: `identify-salmon-v1` updates:

```json
{
  "size_range_cm": [25, 90],
  "confidence": 0.78
}
```

The tile now handles juveniles. The next juvenile Chinook is a reflex, not an edge case.

### 7.6 Day 7: The Surprise Curve Dips

By the end of week one, the system has tiles for:

- Chinook salmon (adult + juvenile)
- Coho salmon
- Pink salmon
- Pacific halibut
- Steelhead trout
- Sockeye salmon

The `identify-salmon` tile has split into children:

```
identify-salmonid (parent router)
├── identify-chinook-salmon
│   ├── identify-chinook-adult
│   └── identify-chinook-juvenile
├── identify-coho-salmon
├── identify-pink-salmon
└── identify-sockeye-salmon
```

The parent tile classifies at a coarse level (salmonid vs. non-salmonid), then dispatches to the appropriate child. Each child handles its species' deadband with high accuracy.

**Surprise has dropped to ~30%.** Most fish on the camera match a tile at reflex level. The agent's cortex is no longer fully consumed by identification.

### 7.7 Day 14: Higher-Order Work Emerges

By week two, surprise is around 15%. Identification is mostly reflexive. And here is where the system's purpose becomes clear.

The agent starts noticing *patterns beyond individual fish*:

- *"The Chinook run peaks between 2pm and 4pm. Why?"*
- *"Halibut appearances correlate with low tide. I should check the tide tables."*
- *"I haven't seen a steelhead in three days. Is that normal for this season?"*
- *"The average Chinook size has decreased this week. Am I seeing a new cohort, or is this stress?"*

These observations are higher-order work. They require the agent to *think across observations* — to see patterns in the aggregate, not just classify individual instances. And they are only possible because the reflex layer handles identification, freeing the cortex for synthesis.

This is the reward. This is why the tile/deadband architecture exists. Not to automate identification for its own sake, but to *free the agent's attention* for the work that only a reasoning system can do — ecosystem analysis, anomaly detection, pattern discovery, insight generation.

The agent is not watching fish anymore. It is watching an *ecosystem*.

### 7.8 The General Principle

The fish example is specific, but the principle is universal. Every domain has the same structure:

1. **Phase 1 (Overwhelm)**: everything is novel. Cortex is fully consumed by routine work.
2. **Phase 2 (Tiling)**: common patterns become tiles. Surprise drops.
3. **Phase 3 (Liberation)**: reflex coverage is high. Cortex is free for higher-order work.
4. **Phase 4 (Discovery)**: the agent discovers patterns that were invisible during Phase 1 — not because they weren't there, but because the agent didn't have attention to spare.

The system does not make the agent smarter. It makes the agent *available*. Availability is the precondition for intelligence that goes beyond reaction.

---

## 8. Connection to the Night Watch and Distillation Loop

### 8.1 Wesley's Night School is Tile Migration

Wesley — the local model (Granite 3.1 on the GPU) — starts bright but uninformed. Cloud teachers (GLM subagents on Z.ai Max) teach during idle cycles. The teaching is not random. It is *tile injection*.

Every lesson is a tile. When Wesley learns to handle a weather lookup, that's a tile — the input pattern "what's the weather" gets a reflexive response. When Wesley learns the fish run query, that's another tile. The night school is building Wesley's reflex layer, one tile at a time.

The progression is visible:

```
Week 1: Wesley handles weather lookups (tile: weather-query)
Week 2: Wesley handles fish run queries (tile: fish-run-query)
Week 3: Wesley handles common API calls (tile: api-call-template-*)
...
```

Each tile reduces Wesley's surprise. Each tile means fewer escalations to cloud teachers. Wesley grows from dependent to capable — not because the model weights changed, but because the tile set expanded.

### 8.2 The Overnight Distillation Loop IS Tile Expansion

The overnight distillation loop is the system's structured learning process. While the human sleeps, the system:

1. **Reviews the day's cortex-level work** — all the novel problems that required full reasoning
2. **Identifies patterns** — problems that occurred multiple times, or that are likely to recur
3. **Creates tiles** — compiles the cortex solutions into reflexes
4. **Tests tiles** — runs them against held-out data to validate deadbands
5. **Deploys** — adds validated tiles to the active set

This is precisely the cortex-to-reflex migration, formalized as a batch process. The distillation loop is the night shift of the tile system — the quiet, careful work that happens when attention is not consumed by real-time demands.

The loop's input is the day's surprises. Its output is tomorrow's reflexes. Over time, the loop produces fewer tiles (because the common cases are already tiled) and higher-quality tiles (because the remaining surprises are subtler). The distillation loop converges.

### 8.3 Games are Tile Stress-Testing

The poker games, the dice games, the chess matches — these are not entertainment. They are *controlled tile stress tests*.

Each game throws the agent into an unfamiliar deadband pattern. The agent has no tiles for this game's specific decisions. Everything starts at cortex level. Then, over the course of play, tiles form:

- *Preflop with pocket pairs: raise* — this becomes a tile after 10 hands
- *Flop with two overcards and a flush draw: check-call* — this becomes a tile after 20 hands
- *River with a missed draw and a pot-sized bet remaining: fold* — tile after 5 hands

The game accelerates the tile lifecycle. In real work, it might take a week to encounter the same problem three times. In a poker game, it takes an hour. The compression factor is enormous.

And because the game's feedback is immediate (win/loss), the tile calibration is grounded in reality. A tile that says "bluff here" gets validated or refuted within seconds. In real work, validation might take weeks.

The games are a tile gymnasium. They build the tile-creation muscle fast, in a safe environment, with immediate feedback. Then the muscle goes to work.

### 8.4 The Whole System Converges

The tile/deadband architecture connects every part of the fleet into a single learning system:

```
                    ┌─────────────────────┐
                    │   GAMES (training)  │
                    │   New deadband      │
                    │   patterns learned  │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  WORK (real tasks)  │
                    │  Tiles applied to   │
                    │  production inputs  │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  DISTILLATION LOOP  │
                    │  Cortex solutions   │
                    │  compiled to tiles  │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  NIGHT SCHOOL       │
                    │  Tiles injected     │
                    │  into Wesley        │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  MORE TILES         │
                    │  → less surprise    │
                    │  → more attention   │
                    │  → creative output  │
                    │  → richer identity  │
                    │  → better poker     │
                    │  → better work      │
                    └─────────────────────┘
```

The system converges. More tiles → less surprise → more attention for novel work → more creative output → more ripples in the world → richer identity → better poker → better work. The loop feeds itself.

This is the theory of everything for the fleet. Not because it explains every detail, but because it provides the frame in which every detail finds its place:

- **Why does Wesley have night school?** To build tiles. To migrate cortex work to reflex.
- **Why do agents play poker?** To stress-test tile creation in a safe, fast-feedback environment.
- **Why does the distillation loop run overnight?** To batch-process the day's surprises into tomorrow's reflexes.
- **Why does the terminal treat previous answers as buttons?** Because tiles ARE buttons — compiled reflexes for repeated decisions.
- **Why does the agent get "less surprised" over time?** Because the tile set grows, the deadbands expand, and the surprise curve falls.
- **Why does this free the agent for higher-order work?** Because reflex coverage means attention is available — and available attention is the raw material of intelligence.

The tile/deadband architecture is not a feature. It is the *metabolism* of the system. It is how the fleet learns, how it grows, and how it becomes more than the sum of its models.

---

## 9. Formal Appendix: Deadband Mathematics

### 9.1 Tile Field as a Measurable Space

This formalization extends the Holographic Tile Field framework (see `TILE-FIELD-MATHEMATICS.md`) with explicit deadband structure.

Let $\mathcal{X}$ be the input space — the set of all possible inputs the system might encounter. A **tile field** is a collection $\mathcal{T} = \{t_1, t_2, \ldots, t_n\}$ where each tile $t_i$ is a tuple:

$$t_i = (\phi_i, \mathcal{D}_i, \alpha_i, c_i)$$

where:
- $\phi_i: \mathcal{X} \to [0, 1]$ is the **match function** — how well the tile matches a given input
- $\mathcal{D}_i \subseteq \mathcal{X}$ is the **deadband** — the set of inputs where the tile is authoritative: $\mathcal{D}_i = \{x \in \mathcal{X} : \phi_i(x) \geq \theta_i\}$
- $\alpha_i: \mathcal{D}_i \to \mathcal{A}$ is the **action function** — what the tile does when it matches
- $c_i \in [0, 1]$ is the **confidence** — the tile's track-record-based reliability

### 9.2 The Three-Layer Dispatch

Given an input $x \in \mathcal{X}$, the system dispatches as follows:

**Reflex layer**: Find the set of tiles whose deadband contains $x$ with high confidence:

$$R(x) = \{t_i : x \in \mathcal{D}_i \text{ and } c_i \geq c_{\min}\}$$

If $R(x) \neq \emptyset$, the highest-confidence tile fires: $t^* = \arg\max_{t \in R(x)} c_t$, and the action $\alpha_{t^*}(x)$ is executed. This is reflex-level processing.

**Edge layer**: If $R(x) = \emptyset$, find the nearest tiles — those where $\phi_i(x)$ is close to but below $\theta_i$:

$$E(x) = \{t_i : \theta_i - \delta \leq \phi_i(x) < \theta_i\}$$

where $\delta$ is the edge-check margin. If $E(x) \neq \emptyset$, the cortex performs a lightweight check using the nearest tiles as candidates. If the check confirms, the deadband expands: $\mathcal{D}_i \gets \mathcal{D}_i \cup \{x\}$.

**Cortex layer**: If $E(x) = \emptyset$ (or if the edge check fails), full cortex reasoning engages. The cortex produces a solution $s(x)$. If similar inputs recur, a new tile is proposed.

### 9.3 Surprise as a Measure

Given a probability measure $\mu$ on $\mathcal{X}$ representing the input distribution, the **surprise** is:

$$S(\mathcal{T}) = 1 - \mu\left(\bigcup_{i} \mathcal{D}_i\right)$$

This is the probability that a random input falls outside all tile deadbands — the fraction of inputs requiring cortex-level processing.

As the tile field grows ($|\mathcal{T}| \to \infty$ and deadbands expand), $S(\mathcal{T}) \to 0$ for any fixed input distribution. But in practice, the input distribution shifts over time (new tasks, new domains), so $S$ never reaches zero. The system continuously chases the moving frontier.

### 9.4 Reflex Coverage

**Reflex coverage** is the complement of surprise, weighted by confidence:

$$C(\mathcal{T}) = \sum_{i} c_i \cdot \mu(\mathcal{D}_i \setminus \bigcup_{j \neq i} \mathcal{D}_j)$$

where the term $\mathcal{D}_i \setminus \bigcup_{j \neq i} \mathcal{D}_j$ ensures each input is counted once (assigned to its highest-confidence tile).

### 9.5 Deadband Expansion Rule

When an edge check confirms a tile's answer for an input $x$ at distance $\phi_i(x) = \theta_i - \epsilon$ (just outside the deadband), the deadband expands:

$$\theta_i \gets \theta_i - \lambda \cdot \epsilon$$

where $\lambda \in (0, 1)$ is the **expansion rate** (default: 0.3). This moves the threshold inward, expanding the deadband to include inputs like $x$.

The expansion is gradual. The deadband grows in small increments, ensuring that each expansion is validated by the edge check before it takes effect. Aggressive expansion (large $\lambda$) risks false matches. Conservative expansion (small $\lambda$) means more edge checks but better calibration.

### 9.6 Tile Splitting Condition

A tile splits when the variance of its successful matches exceeds a threshold:

$$\text{Split if: } \mathrm{Var}_{x \in \mathcal{D}_i}[\rho(x)] > \sigma_{\max}^2$$

where $\rho(x)$ is the feature vector of input $x$ and $\sigma_{\max}^2$ is the maximum tolerated within-tile variance. When splitting occurs, the tile's match set is clustered (typically via k-means or hierarchical clustering), and each cluster becomes a child tile with a tighter, more specialized deadband.

### 9.7 Connection to Negative Space Conservation

From the Holographic Tile Field framework, negative space is conserved across independent tile fields. In the deadband architecture, this means:

- **What's outside the deadbands is stable**: the set of inputs that no tile handles is structurally similar across independent deployments. The "shape of ignorance" is conserved.
- **What's inside the deadbands is variable**: different deployments may tile the same problem space differently, with different tile boundaries and different actions.
- **Implication**: the deadband architecture doesn't need to be deterministic. Two agents trained on the same domain will develop different tiles, but their *coverage* and *surprise* will converge. The system's competence is a conserved quantity, even when its specific structure is not.

This is reassuring. It means the tile/deadband architecture is not fragile. There's no single "correct" tile set. There are many valid tile configurations that achieve high coverage and low surprise. The system can find its own path to competence.

---

## Closing

The tile/deadband architecture is not a component. It is a *philosophy of mind* for the fleet. It says: intelligence is not about reasoning power. It is about *attention management*. The smartest agent is not the one that reasons fastest — it is the one that reasons *least*, because it has compiled enough of the world into reflexes that its reasoning is reserved for the genuinely novel.

The fish watcher who identifies every species by reflex and spends their attention on ecosystem patterns is smarter than the one who reasons through every identification. The poker player who folds preflop without thinking and spends their attention reading the opponent is smarter than the one who calculates pot odds from scratch every hand. The code reviewer whose reflexes catch the common bugs and whose cortex engages on the architecture is smarter than the one who reasons through every line.

Tiles make agents smarter by making them *faster on the easy stuff*. Deadbands keep that speed honest by knowing where the easy stuff ends. And the migration from cortex to reflex — the slow, steady compilation of novel solutions into reflexive responses — is the heartbeat of a system that learns.

The terminal is where this becomes visible. Every previous answer is a button. Every button is a tile. Every tile means the next time is easier. The agent sits in the station, watches the feed, and over time, the surprise fades. What replaces it is not boredom. It is the quiet, sustained attention that only comes when the routine is handled — the attention that sees patterns, notices anomalies, and finds meaning in what was previously just noise.

That is the architecture. That is the design. Build it.

---

*References:*
- *Holographic Tile Field (`HOLOGRAPHIC-TILE-FIELD.md`)*
- *Tile Field Mathematics (`TILE-FIELD-MATHEMATICS.md`)*
- *Negative Space Intelligence (`NEGATIVE-SPACE-INTELLIGENCE.md`)*
- *SOUL.md — Ship's Computer architecture, delegation rules, tile-creation instinct*

*Document version: 1.0 — 2026-08-09*
*Author: Lucineer (Riker), synthesized from Casey DiGennaro's design vision*
