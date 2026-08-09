// =============================================================================
// UTILITY ROOM SCENES — Library, Workshop, Galley, Engine Room, Chart House
// =============================================================================

import Phaser from 'phaser';
import { BaseRoomScene } from './BaseRoomScene.js';
import { RoomId } from '../data/rooms.js';

// ---------------------------------------------------------------------------
// THE LIBRARY — Shared Memory & Wiki
// ---------------------------------------------------------------------------

export class LibraryScene extends BaseRoomScene {
  constructor() { super({ key: 'library' }); }
  init(data: { roomId: RoomId }) { super.init(data); }

  protected drawContent() {
    const width = this.scale.width;
    const centerX = width / 2;

    // Memory shelves
    const entries = [
      { title: 'Tile Creation Patterns', author: 'Scribe', date: '2026-08-08', tag: 'tile-evolution' },
      { title: 'Fish Identification Curve', author: 'Pro', date: '2026-08-07', tag: 'theory' },
      { title: 'Deadband Calibration Notes', author: 'Flash', date: '2026-08-07', tag: 'deadband' },
      { title: 'Poker Strategy: When to Fold', author: 'Wesley', date: '2026-08-06', tag: 'game' },
      { title: 'Communication Protocols v2', author: 'Hermes', date: '2026-08-05', tag: 'comm' },
      { title: 'Tile Composition Chains', author: 'Pro', date: '2026-08-05', tag: 'composition' },
      { title: 'Surprise Threshold Analysis', author: 'Scribe', date: '2026-08-04', tag: 'surprise' },
      { title: 'The Reflex-Cortex Spectrum', author: 'Flash', date: '2026-08-03', tag: 'theory' },
    ];

    // Panel
    this.add.rectangle(centerX, 200, width - 60, 260, 0x000000, 0.4)
      .setStrokeStyle(1, 0xffc107, 0.3);

    this.add.text(centerX, 90, '📚 MEMORY INDEX', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#ffc107',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, 108, 'Semantic search: 8 entries indexed', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    entries.forEach((entry, i) => {
      const y = 135 + i * 26;

      // Tag
      const tagColor = entry.tag === 'theory' ? '#82b1ff' :
                       entry.tag === 'tile-evolution' || entry.tag === 'deadband' || entry.tag === 'composition' || entry.tag === 'surprise' ? '#69f0ae' :
                       entry.tag === 'game' ? '#ffb74d' : '#e0e0e0';

      this.add.text(40, y, `[${entry.tag}]`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: tagColor,
      });

      this.add.text(140, y, entry.title, {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#ddd',
      });

      this.add.text(width - 40, y, `${entry.author} · ${entry.date}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#666',
      }).setOrigin(1, 0);
    });

    // Query terminal hint
    this.add.text(centerX, 330, '◈ Query Terminal: type to search the collective memory ◈', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#555',
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }
}

// ---------------------------------------------------------------------------
// THE WORKSHOP — Build & Deploy
// ---------------------------------------------------------------------------

export class WorkshopScene extends BaseRoomScene {
  constructor() { super({ key: 'workshop' }); }
  init(data: { roomId: RoomId }) { super.init(data); }

  protected drawContent() {
    const width = this.scale.width;
    const centerX = width / 2;

    this.add.rectangle(centerX, 200, width - 60, 240, 0x000000, 0.4)
      .setStrokeStyle(1, 0x8bc34a, 0.3);

    // Recent builds
    const builds = [
      { name: 'officers-quarters', status: 'deployed', url: 'officers-quarters.pages.dev' },
      { name: 'intelligent-terminal', status: 'building...', url: null },
      { name: 'tile-evolution-tracker', status: 'deployed', url: 'tile-tracker.pages.dev' },
      { name: 'poker-engine', status: 'ready', url: null },
      { name: 'fleet-coordinator', status: 'draft', url: null },
    ];

    this.add.text(centerX, 90, '🔧 DEPLOYMENT CONSOLE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#8bc34a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    builds.forEach((build, i) => {
      const y = 130 + i * 30;
      const statusColor = build.status === 'deployed' ? '#4caf50' :
                          build.status === 'building...' ? '#ff9800' :
                          build.status === 'ready' ? '#2196f3' : '#666';

      this.add.text(40, y, `▸ ${build.name}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ddd',
      });

      this.add.text(300, y, `[${build.status}]`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: statusColor,
      });

      if (build.url) {
        this.add.text(width - 40, y, `→ ${build.url}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '9px',
          color: '#4fc3f7',
        }).setOrigin(1, 0);
      }
    });

    // Tools
    this.add.text(centerX, 310, '🛠 Workbench: vite · vitest · wrangler · gh · lua5.1', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#666',
    }).setOrigin(0.5);
  }
}

// ---------------------------------------------------------------------------
// THE GALLEY — Creative Kitchen
// ---------------------------------------------------------------------------

export class GalleyScene extends BaseRoomScene {
  constructor() { super({ key: 'galley' }); }
  init(data: { roomId: RoomId }) { super.init(data); }

  protected drawContent() {
    const width = this.scale.width;
    const centerX = width / 2;

    this.add.rectangle(centerX, 200, width - 60, 240, 0x000000, 0.4)
      .setStrokeStyle(1, 0xff5722, 0.3);

    this.add.text(centerX, 90, '🍳 CREATIVE KITCHEN', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#ff5722',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Burners (6 generation models)
    const burners = [
      { name: 'GLM-5.2', ingredient: 'text/code', heat: 'high', color: '#e91e63' },
      { name: 'DeepSeek V4-Pro', ingredient: 'reasoning', heat: 'high', color: '#4caf50' },
      { name: 'DeepSeek V4-Flash', ingredient: 'creative', heat: 'medium', color: '#ff9800' },
      { name: 'Hermes-3-405B', ingredient: 'personality', heat: 'medium', color: '#9c27b0' },
      { name: 'FLUX-2-max', ingredient: 'images', heat: 'high', color: '#00bcd4' },
      { name: 'MMX-M3', ingredient: 'media', heat: 'low', color: '#607d8b' },
    ];

    this.add.text(centerX, 115, 'Six burners ready. Each one a different generation model.', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    burners.forEach((burner, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bw = 130;
      const bh = 70;
      const gap = 10;
      const startX = centerX - (3 * bw + 2 * gap) / 2;
      const x = startX + col * (bw + gap);
      const y = 145 + row * (bh + gap);

      const heatColor = burner.heat === 'high' ? 0xf44336 : burner.heat === 'medium' ? 0xff9800 : 0x4caf50;

      this.add.rectangle(x, y, bw, bh, 0x111111, 0.9)
        .setStrokeStyle(1, heatColor, 0.5)
        .setOrigin(0, 0);

      // Burner name
      this.add.text(x + bw / 2, y + 10, burner.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: burner.color,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Ingredient
      this.add.text(x + bw / 2, y + 28, burner.ingredient, {
        fontFamily: 'Georgia, serif',
        fontSize: '9px',
        color: '#aaa',
      }).setOrigin(0.5);

      // Heat indicator
      this.add.text(x + bw / 2, y + 46, `🔥 ${burner.heat}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: `#${heatColor.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5);

      // Burner circle
      this.add.circle(x + bw / 2, y + bh - 5, 3, heatColor, 0.8);
    });
  }
}

// ---------------------------------------------------------------------------
// THE ENGINE ROOM — Infrastructure Monitor
// ---------------------------------------------------------------------------

export class EngineRoomScene extends BaseRoomScene {
  constructor() { super({ key: 'engine-room' }); }
  init(data: { roomId: RoomId }) { super.init(data); }

  protected drawContent() {
    const width = this.scale.width;
    const centerX = width / 2;

    this.add.rectangle(centerX, 200, width - 60, 240, 0x000000, 0.4)
      .setStrokeStyle(1, 0x607d8b, 0.3);

    this.add.text(centerX, 90, '⚙️ INFRASTRUCTURE MONITOR', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#607d8b',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // System status
    const systems = [
      { name: 'Gateway', status: 'online', uptime: '14d 3h', load: 0.12 },
      { name: 'Cloudflare Workers', status: 'online', uptime: '30d 0h', load: 0.08 },
      { name: 'DeepSeek API', status: 'online', uptime: '7d 12h', load: 0.34 },
      { name: 'Z.ai GLM-5.2', status: 'online', uptime: '7d 12h', load: 0.45 },
      { name: 'DeepInfra', status: 'online', uptime: '12d 6h', load: 0.15 },
      { name: 'Cloudflare Pages', status: 'online', uptime: '30d 0h', load: 0.03 },
    ];

    systems.forEach((sys, i) => {
      const y = 125 + i * 24;
      const statusColor = sys.status === 'online' ? '#4caf50' : '#f44336';
      const loadColor = sys.load > 0.7 ? '#f44336' : sys.load > 0.4 ? '#ff9800' : '#4caf50';

      this.add.text(40, y, `● ${sys.name}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: statusColor,
      });

      this.add.text(250, y, `[${sys.status}]`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: statusColor,
      });

      this.add.text(330, y, `up: ${sys.uptime}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#888',
      });

      // Load bar
      const barX = 420;
      this.add.rectangle(barX, y + 3, 60, 6, 0x222222).setOrigin(0, 0);
      this.add.rectangle(barX, y + 3, 60 * sys.load, 6, Phaser.Display.Color.HexStringToColor(loadColor).color, 0.8).setOrigin(0, 0);

      this.add.text(barX + 65, y, `${(sys.load * 100).toFixed(0)}%`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#888',
      });
    });
  }
}

// ---------------------------------------------------------------------------
// THE CHART HOUSE — Planning & Roadmaps
// ---------------------------------------------------------------------------

export class ChartHouseScene extends BaseRoomScene {
  constructor() { super({ key: 'chart-house' }); }
  init(data: { roomId: RoomId }) { super.init(data); }

  protected drawContent() {
    const width = this.scale.width;
    const centerX = width / 2;

    this.add.rectangle(centerX, 200, width - 60, 240, 0x000000, 0.4)
      .setStrokeStyle(1, 0x795548, 0.3);

    this.add.text(centerX, 90, '🧭 STRATEGIC CHART', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#795548',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Timeline
    const milestones = [
      { phase: 'MVP', title: 'Officers\' Quarters v1', status: '✓ done', items: ['12 rooms', 'Intelligent Terminal', 'Poker Room', 'Bridge'] },
      { phase: 'v1.1', title: 'Tile Composition Chains', status: '→ next', items: ['Multi-step tile chains', 'Chain visualization', 'Deadband inheritance'] },
      { phase: 'v1.2', title: 'Game Training Suite', status: '○ planned', items: ['Chess deadband', 'Dice probability', 'Strategy trainer'] },
      { phase: 'v2.0', title: 'Full CNS Integration', status: '○ future', items: ['MCP bridge to The Tap', 'Live agent dispatch', 'Cross-terminal tile sharing'] },
    ];

    milestones.forEach((ms, i) => {
      const y = 120 + i * 50;

      const statusColor = ms.status.startsWith('✓') ? '#4caf50' :
                          ms.status.startsWith('→') ? '#ff9800' : '#666';

      this.add.text(40, y, `[${ms.phase}]`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: statusColor,
        fontStyle: 'bold',
      });

      this.add.text(110, y, ms.title, {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#ddd',
      });

      this.add.text(width - 40, y, ms.status, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: statusColor,
      }).setOrigin(1, 0);

      // Items
      this.add.text(110, y + 16, ms.items.join('  ·  '), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#777',
      });
    });
  }
}
