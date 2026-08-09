# Officers' Quarters

**A 12-room standalone system with Intelligent Terminals, tile evolution, and reflex-to-cortex learning.**

## The Core Insight: The Fish Identification Curve

When a system first encounters input, everything is surprising (surprise = 1.0, coverage = 0.0).
As tiles form and deadbands widen, surprise decreases and coverage increases.
The cortex (reasoning) is freed for genuinely novel stimuli.

**This is learning. This is what games train.**

An agent who has handled 6 different game deadbands has a richer tile-creation instinct for work problems.

## The 12 Rooms

| Room | Purpose |
|------|---------|
| 🛟 **The Bridge** | Command center — fleet status, routing, communication array |
| ⚡ **Flash Station** | Speed & reflex agent's terminal |
| 🧠 **Pro Station** | Deep reasoning agent's terminal |
| 🌟 **Wesley Station** | Creative spirit agent's terminal |
| ✍️ **Scribe Station** | Memory & records agent's terminal |
| 📡 **Hermes Station** | Communication & routing agent's terminal |
| 🃏 **The Poker Room** | After-hours social space — Texas Hold'em, open mic |
| 📚 **The Library** | Shared memory & wiki |
| 🔧 **The Workshop** | Build & deploy |
| 🍳 **The Galley** | Creative kitchen (generation models) |
| ⚙️ **The Engine Room** | Infrastructure monitor |
| 🧭 **The Chart House** | Planning & roadmaps |

## The Intelligent Terminal

Each agent station has a terminal that LEARNS:

1. **Tiles from Repeated Actions** — 3+ repetitions create a tile (one-click shortcut)
2. **The Deadband** — input range where tiles fire reflexively (<16ms, no reasoning)
3. **Outside the Deadband** — reasoning happens → new tile created or deadband expanded
4. **Tile Composition** — tiles chain into complex workflows
5. **Reflex-to-Cortex Spectrum** — tasks migrate from reasoning to reflex over time

## Tech Stack

- **Phaser 3** — 2D game framework for room rendering
- **TypeScript** — type-safe tile/terminal/deadband system
- **Vite** — dev server and build
- **Vitest** — testing
- **Cloudflare Pages** — deployment

## Getting Started

```bash
npm install
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run test     # Run tests
npm run preview  # Preview production build
```

## Architecture

```
src/
├── data/
│   └── rooms.ts              # 12 rooms with exits, furnishings, metadata
├── systems/
│   ├── intelligent-terminal.ts   # The core learning system
│   └── tile-evolution.ts         # Pattern detection, surprise/growth measurement
├── scenes/
│   ├── BaseRoomScene.ts          # Shared room functionality
│   ├── BridgeScene.ts            # Fleet status, routing console, comm array
│   ├── PokerRoomScene.ts         # Texas Hold'em with automated AI play
│   ├── stations/
│   │   └── StationRoomScene.ts   # Agent station with live terminal display
│   └── UtilityScenes.ts          # Library, Workshop, Galley, Engine Room, Chart House
├── tests/
│   └── intelligent-terminal.test.ts  # Tile creation, deadband, surprise, composition
└── main.ts                       # Phaser game config and boot
```

## Deployment

Deployed to Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name=officers-quarters
```

## Why Games Train Agents for Work

In a game (poker, dice, chess), the agent writes scripts/strategies.
These scripts work within a deadband of game states.
When the game state goes outside the script's deadband, the agent must reason.
Finding the solution and creating a new script = exactly the same skill as creating a new tile in the station terminal.

Different game mechanics = different deadband patterns = broader pattern recognition.

---

© 2026 Casey DiGennaro · MIT License
