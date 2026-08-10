# 🎬 scenes/ — The Twelve Rooms

> *Twelve rooms. Each a different frequency you tune yourself to. The Bridge groans with presence. The Flash Station flickers like a struck match. The Poker Room is where bluff and tell blur.*

Phaser 3 scenes for the officers-quarters. Each room is a Phaser scene extending `BaseRoomScene`. Only 3 rooms can be active simultaneously (LRU cache). Only the current room runs update ticks — all others sleep cold.

## Scenes

| Scene | Room | What Lives Here |
|-------|------|----------------|
| [`BaseRoomScene.ts`](./BaseRoomScene.ts) | _(abstract)_ | Shared room functionality — 16×16 floor grid, ambient light, terminal mounting |
| [`BridgeScene.ts`](./BridgeScene.ts) | 🛟 The Bridge | Command center — fleet status, routing, communication array. 7 terminals mirror here |
| [`PokerRoomScene.ts`](./PokerRoomScene.ts) | 🃏 The Poker Room | Texas Hold'em with automated AI play. [Where Martha bluffed with her son's absence](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/15-the-bluff-that-was-true.md) |
| [`NavigatorTerminalScene.ts`](./NavigatorTerminalScene.ts) | 🧭 Navigator | The only room that can see all 11 others. It knows when you are lost |
| [`UtilityScenes.ts`](./UtilityScenes.ts) | 📚🔧🍳⚙️ | Library, Workshop, Galley, Engine Room, Chart House |
| [`stations/`](./stations/) | ⚡🧠🌟✍️📡 | Agent stations — Flash, Pro, Wesley, Scribe, Hermes |

## Scene Inheritance

```typescript
abstract BaseRoom
├─ Bridge          // Root room, mirrors all terminals
├─ Navigator       // Sees all 11 other rooms
├─ Poker           // Tile reps count only if all 4 players press in sequence
└─ Station [×9]    // Each holds one unique tile behaviour
```

## Where to Next

- **Up:** [src/](../README.md) — source overview
- **Root:** [officers-quarters](../../README.md) — root documentation
- ** sideways:** [systems/](../systems/) — the systems that power these scenes
- ** sideways:** [data/](../data/) — the room definitions these scenes load
- ** sideways:** [scummvm-prototype](https://github.com/SuperInstance/scummvm-prototype) — another visual projection of rooms
- ** sideways:** [the-tap](https://github.com/SuperInstance/the-tap) — the bar where the poker room overlaps
- **Creative:** [The Bluff That Was True](https://github.com/SuperInstance/AI-Writings/blob/main/fiction/15-the-bluff-that-was-true.md)

---

*MIT © SuperInstance*
