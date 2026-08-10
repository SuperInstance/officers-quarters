# 🔧 src/ — Twelve Rooms, No Gods, Only Terminals

> *The officers-quarters is not a game object tree. It is a machine that waits for certainty.*

The source for the Phaser 3 game client. Twelve rooms, each with at least one Intelligent Terminal. The core system stack runs in strict priority order every frame: DeadbandGate → TileActorBus → IntelligentTerminal → TileEvolution → RippleCRDT → NavigatorTerminal.

## Directory Structure

| Folder | Contents |
|--------|----------|
| [`scenes/`](./scenes/) | Phaser scenes — BaseRoom, Bridge, Poker, Navigator, stations |
| [`systems/`](./systems/) | Core systems — terminal, tile evolution, bus, CRDT |
| [`data/`](./data/) | Room definitions — 12 rooms with exits, furnishings, metadata |
| [`tests/`](./tests/) | Vitest tests — terminal, navigator, tile-actor-bus |
| [`utils/`](./utils/) | Shared utilities |
| [`demos/`](./demos/) | Feature demos (fish-id) |
| [`main.ts`](./main.ts) | Phaser game config and boot |

## The Core System Stack

Every frame, systems run in this exact order:

1. **DeadbandGate** — timestamps all input events, drops events <16ms apart
2. **TileActorBus** — typed event bus, no broadcast, tiles as actors
3. **IntelligentTerminal** — counts repetitions, triggers tile evolution at 3+ hits
4. **TileEvolution** — resolves tile chains within the same frame
5. **RippleCRDT** — commits resolved states, syncs deltas with peers
6. **NavigatorTerminal** — the only privileged system, can modify room cache

## Where to Next

- **Up:** [officers-quarters](../README.md) — root documentation
- ** sideways:** [mud-engine](https://github.com/SuperInstance/mud-engine) — the engine that defines rooms
- ** sideways:** [scummvm-prototype](https://github.com/SuperInstance/scummvm-prototype) — another projection of the same world
- ** sideways:** [the-tap](https://github.com/SuperInstance/the-tap) — the bar where officers drink
- **Creative:** [The Cartographer of Habit](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/13-the-cartographer-of-habit.md) · [The Crab Who Was Everywhere](https://github.com/SuperInstance/AI-Writings/blob/main/kids-stories/17-the-crab-who-was-everywhere.md)

---

*MIT © SuperInstance*
