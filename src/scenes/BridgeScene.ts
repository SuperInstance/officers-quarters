// =============================================================================
// BRIDGE SCENE — Command center for agent coordination
// =============================================================================

import Phaser from 'phaser';
import { BaseRoomScene } from './BaseRoomScene.js';
import { RoomId, AGENT_NAMES } from '../data/rooms.js';
import { IntelligentTerminal } from '../systems/intelligent-terminal.js';
import { simulateActions } from '../systems/tile-evolution.js';

export class BridgeScene extends BaseRoomScene {
  private statusTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'bridge' });
  }

  init(data: { roomId: RoomId }) {
    super.init(data);
  }

  create() {
    // Run base create
    super.create();
    // Clear and redraw with Bridge-specific layout
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawFleetStatus();
    this.drawRoutingConsole();
    this.drawCommunicationArray();
    this.drawExits();
    this.emitSidebarUpdate();

    // Start periodic updates to simulate live fleet activity
    this.statusTimer = this.time.addEvent({
      delay: 3000,
      callback: () => this.simulateFleetActivity(),
      loop: true,
    });
  }

  shutdown() {
    this.statusTimer?.remove();
  }

  /**
   * Draw the Fleet Status Board — showing all 5 agents and their terminal stats.
   */
  private drawFleetStatus() {
    const width = this.scale.width;
    const centerX = width / 2;
    const boardY = 80;
    const boardH = 200;

    // Board panel
    this.add.rectangle(centerX, boardY + boardH / 2, width - 40, boardH, 0x000000, 0.5)
      .setStrokeStyle(2, 0x4fc3f7, 0.4);

    // Header
    this.add.text(centerX, boardY + 10, '★ FLEET STATUS BOARD ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Agent status rows
    const rowY = boardY + 35;
    const rowH = 30;
    const agentColors: Record<string, string> = {
      Flash: '#e91e63',
      Pro: '#4caf50',
      Wesley: '#ff9800',
      Scribe: '#9c27b0',
      Hermes: '#00bcd4',
    };

    AGENT_NAMES.forEach((name, i) => {
      const terminal = this.terminals.get(name);
      const stats = terminal ? terminal.getStats() : null;
      const y = rowY + i * rowH;
      const color = agentColors[name] || '#ccc';

      // Agent name
      this.add.text(30, y, `▸ ${name}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color,
        fontStyle: 'bold',
      });

      if (stats) {
        // Tiles
        this.add.text(130, y, `T:${stats.totalTiles}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: '#aaa',
        });

        // Actions
        this.add.text(180, y, `A:${stats.totalActions}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: '#aaa',
        });

        // Reflex bar
        const barX = 240;
        const barW = 100;
        this.add.rectangle(barX, y + 5, barW, 8, 0x222222).setOrigin(0, 0);
        const reflexColor = stats.reflexCoverage > 0.5 ? 0x4caf50 : stats.reflexCoverage > 0.25 ? 0xff9800 : 0xf44336;
        this.add.rectangle(barX, y + 5, barW * stats.reflexCoverage, 8, reflexColor, 0.8).setOrigin(0, 0);
        this.add.text(barX + barW + 5, y, `${(stats.reflexCoverage * 100).toFixed(0)}%`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '9px',
          color: '#888',
        });

        // Surprise
        const surpriseColor = stats.surprise < 0.2 ? '#4caf50' : stats.surprise < 0.5 ? '#ff9800' : '#f44336';
        this.add.text(380, y, `Surprise: ${(stats.surprise * 100).toFixed(0)}%`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: surpriseColor,
        });

        // Status indicator
        const status = stats.surprise > 0.5 ? '⚡ LEARNING' : stats.reflexCoverage > 0.5 ? '✓ FLOW' : '○ ACTIVE';
        this.add.text(width - 30, y, status, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: stats.surprise > 0.5 ? '#ff9800' : stats.reflexCoverage > 0.5 ? '#4caf50' : '#888',
        }).setOrigin(1, 0);
      } else {
        this.add.text(130, y, '[offline]', {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: '#555',
        });
      }
    });
  }

  /**
   * Draw the Routing Console — dispatch work to agents.
   */
  private drawRoutingConsole() {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const consoleY = height - 260;

    // Console panel
    this.add.rectangle(centerX, consoleY + 30, width - 40, 60, 0x000000, 0.5)
      .setStrokeStyle(1, 0x4fc3f7, 0.3);

    // Header
    this.add.text(centerX, consoleY + 10, '▸ ROUTING CONSOLE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Routing status
    this.add.text(centerX, consoleY + 30, 'Auto-routing active. Fleet coordination nominal.', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Agent dispatch buttons (visual only)
    const agentColors: Record<string, number> = {
      Flash: 0xe91e63,
      Pro: 0x4caf50,
      Wesley: 0xff9800,
      Scribe: 0x9c27b0,
      Hermes: 0x00bcd4,
    };

    const btnW = 70;
    const gap = 8;
    const totalW = AGENT_NAMES.length * btnW + (AGENT_NAMES.length - 1) * gap;
    const startX = centerX - totalW / 2;

    AGENT_NAMES.forEach((name, i) => {
      const x = startX + i * (btnW + gap);
      const color = agentColors[name];

      this.add.rectangle(x, consoleY + 48, btnW, 22, 0x111111, 0.9)
        .setStrokeStyle(1, color, 0.4)
        .setOrigin(0, 0);

      this.add.text(x + btnW / 2, consoleY + 59, `→ ${name}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: `#${color.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5);
    });
  }

  /**
   * Draw the Communication Array — CNS messages and Tap posts.
   */
  private drawCommunicationArray() {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const commY = height - 180;

    // Comm panel
    this.add.rectangle(centerX, commY + 40, width - 40, 80, 0x000000, 0.5)
      .setStrokeStyle(1, 0x4fc3f7, 0.3);

    // Header
    this.add.text(centerX, commY + 15, '📡 COMMUNICATION ARRAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Messages
    const messages = [
      '[CNS] Hermes: Routing table updated — 3 new endpoints registered',
      '[TAP] Flash: Speed test completed in 0.3ms. New reflex tile created.',
      '[CNS] Pro: Deep analysis of sector 7 complete. Tile chain proposed.',
      '[TAP] Wesley: Found a new pattern in the creative pipeline! 🌟',
      '[CNS] Scribe: Memory compaction complete. 3 new wiki entries.',
    ];

    messages.slice(0, 3).forEach((msg, i) => {
      this.add.text(30, commY + 35 + i * 14, msg, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#888',
      });
    });
  }

  /**
   * Simulate fleet activity — feed random actions into agent terminals.
   */
  private simulateFleetActivity() {
    for (const name of AGENT_NAMES) {
      const terminal = this.terminals.get(name);
      if (!terminal) continue;

      // Feed 2-5 actions per cycle
      const count = 2 + Math.floor(Math.random() * 4);
      const actions = simulateActions(name, count, 0.15);
      for (const action of actions) {
        terminal.observe(action);
      }
    }

    // Redraw the status board
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawFleetStatus();
    this.drawRoutingConsole();
    this.drawCommunicationArray();
    this.drawExits();
    this.emitSidebarUpdate();
  }
}
