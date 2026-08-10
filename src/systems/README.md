# ⚙️ systems/ — The Machine That Waits For Certainty

> *No tile will ever acknowledge you. It will only fire.*

Core systems for the officers-quarters. These run in strict priority order every frame — no skipping the queue.

## Systems

| System | Priority | What It Does |
|--------|----------|-------------|
| [`intelligent-terminal.ts`](./intelligent-terminal.ts) | 3 | The counting engine. Observes input events, maintains repetition counters. At 3 hits: emits tile evolution trigger. The [cartographer of habit](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/13-the-cartographer-of-habit.md) made algorithmic |
| [`tile-evolution.ts`](./tile-evolution.ts) | 4 | Pure composition engine. Resolves tile final states, emits workflow chain tokens. Chains complete within the same frame — you never see the machine think |
| [`tile-actor-bus.ts`](./tile-actor-bus.ts) | 2 | Typed event bus. No broadcast. Every tile is an actor subscribed only to its input tokens. Messages expire after 7 frames |
| [`tile-actors.ts`](./tile-actors.ts) | — | Tile actor definitions — the behaviors tiles execute |
| [`navigator-terminal.ts`](./navigator-terminal.ts) | 6 | The only privileged system. Can modify room cache, trigger transitions, break active tile chains. It knows when you are lost |
| [`ripple-crdt.ts`](./ripple-crdt.ts) | 5 | Commits resolved states locally, syncs deltas with peers. No partial state leaves the client. The fastest hand writes the ship |

## The Reflex-to-Cortex Spectrum

Tasks migrate from reasoning to reflex over time:

```
First encounter:    cortex (slow, conscious, surprising)
3rd repetition:     tile forms (shortcut created)
Repeated use:       deadband widens (<16ms, reflexive)
Mastery:            spinal cord (automatic, frictionless)
```

This is [learning](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/14-inside-the-deadband.md). An agent who has handled 6 different game deadbands has a richer tile-creation instinct for work problems.

## Where to Next

- **Up:** [src/](../README.md) — source overview
- **Root:** [officers-quarters](../../README.md) — root documentation
- ** sideways:** [scenes/](../scenes/) — the rooms where these systems run
- ** sideways:** [mud-engine/triggers](https://github.com/SuperInstance/mud-engine/blob/main/packages/triggers/) — the trigger engine that inspired tiles
- ** sideways:** [mud-engine/strategy-guild](https://github.com/SuperInstance/mud-engine/blob/main/packages/strategy-guild/) — recursive adaptation from failure
- ** sideways:** [thought-amplifier](https://github.com/SuperInstance/thought-amplifier) — compiled reflexes fleet-wide
- **Creative:** [The Cartographer of Habit](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/13-the-cartographer-of-habit.md) · [Inside the Deadband](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/14-inside-the-deadband.md)

---

*MIT © SuperInstance*
