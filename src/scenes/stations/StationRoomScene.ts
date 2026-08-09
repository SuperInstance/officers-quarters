// =============================================================================
// STATION ROOM SCENE — A single agent's station with their Intelligent Terminal
// =============================================================================

import Phaser from 'phaser';
import { BaseRoomScene } from '../BaseRoomScene.js';
import { RoomId } from '../../data/rooms.js';
import { IntelligentTerminal, Tile, Action } from '../../systems/intelligent-terminal.js';
import { TileEvolutionTracker, simulateActions } from '../../systems/tile-evolution.js';
import { AGENT_NAMES, AGENT_STATIONS } from '../../data/rooms.js';

export class StationRoomScene extends BaseRoomScene {
  agentName: string | null = null;
  terminal: IntelligentTerminal | null = null;
  tracker: TileEvolutionTracker | null = null;
  private animationTimer: Phaser.Time.TimerEvent | null = null;

  constructor(config: Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  init(data: { roomId: RoomId }) {
    super.init(data);
    // Determine which agent this station belongs to
    for (const name of AGENT_NAMES) {
      if (AGENT_STATIONS[name] === this.roomId) {
        this.agentName = name;
        break;
      }
    }
  }

  create() {
    super.create();

    if (this.agentName) {
      this.terminal = this.terminals.get(this.agentName) || null;
      this.tracker = new TileEvolutionTracker(this.agentName);

      // Seed some initial data if the terminal is empty
      if (this.terminal && this.terminal.tiles.size === 0) {
        this.seedTerminalData();
      }
    }

    // Override the default content with the terminal display
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawTerminalDisplay();
    this.drawExits();
    this.emitSidebarUpdate();

    // Start an animation loop to simulate terminal activity
    this.startTerminalAnimation();
  }

  shutdown() {
    if (this.animationTimer) {
      this.animationTimer.remove();
    }
  }

  /**
   * Draw the Intelligent Terminal display — the core visual.
   */
  private drawTerminalDisplay() {
    const width = this.scale.width;
    const height = this.scale.height;
    const accent = Phaser.Display.Color.HexStringToColor(this.room.accentColor);

    if (!this.terminal) return;

    const stats = this.terminal.getStats();
    const centerX = width / 2;
    const centerY = height / 2 - 20;

    // Terminal frame
    const termWidth = Math.min(500, width - 60);
    const termHeight = Math.min(320, height - 200);
    const termX = centerX - termWidth / 2;
    const termY = centerY - termHeight / 2;

    // Terminal background
    this.add.rectangle(centerX, centerY, termWidth, termHeight, 0x000000, 0.7)
      .setStrokeStyle(2, accent.color, 0.6);

    // Agent name banner
    this.add.text(centerX, termY + 15, `◈ ${this.agentName}'s INTELLIGENT TERMINAL ◈`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: this.room.accentColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Stats row
    const statY = termY + 40;
    const statItems = [
      { label: 'TILES', value: stats.totalTiles.toString(), color: '#4fc3f7' },
      { label: 'ACTIONS', value: stats.totalActions.toString(), color: '#81c784' },
      { label: 'REFLEX', value: `${(stats.reflexCoverage * 100).toFixed(0)}%`, color: '#ffb74d' },
      { label: 'SURPRISE', value: `${(stats.surprise * 100).toFixed(0)}%`, color: '#e57373' },
    ];

    const statSpacing = termWidth / statItems.length;
    statItems.forEach((stat, i) => {
      const x = termX + i * statSpacing + statSpacing / 2;
      this.add.text(x, statY, stat.value, {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: stat.color,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(x, statY + 22, stat.label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#666666',
      }).setOrigin(0.5);
    });

    // Divider
    this.add.rectangle(centerX, statY + 42, termWidth - 40, 1, accent.color, 0.2);

    // Tiles display
    const tilesY = statY + 55;
    this.add.text(termX + 20, tilesY, '◆ ACTIVE TILES', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    });

    // Show tiles as buttons
    const tiles = Array.from(this.terminal.tiles.values()).slice(0, 12);
    const tileW = 110;
    const tileH = 50;
    const tilesPerRow = Math.floor((termWidth - 40) / (tileW + 6));
    const tilesStartX = termX + 20;
    const tilesStartY = tilesY + 20;

    tiles.forEach((tile, i) => {
      const row = Math.floor(i / tilesPerRow);
      const col = i % tilesPerRow;
      const tx = tilesStartX + col * (tileW + 6);
      const ty = tilesStartY + row * (tileH + 6);

      // Tile background — color reflects confidence
      const conf = tile.confidence;
      const tileColor = conf > 0.7 ? 0x1b5e20 : conf > 0.4 ? 0x33691e : 0x3e2723;
      const tileBorder = conf > 0.7 ? 0x4caf50 : conf > 0.4 ? 0x8bc34a : 0xff5722;

      this.add.rectangle(tx, ty, tileW, tileH, tileColor, 0.8)
        .setStrokeStyle(1, tileBorder, 0.5)
        .setOrigin(0, 0);

      // Tile label
      this.add.text(tx + tileW / 2, ty + 8, tile.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: '#ddd',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);

      // Tile stats
      this.add.text(tx + tileW / 2, ty + 26, `${tile.invocations}× • ${(conf * 100).toFixed(0)}%`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#888',
      }).setOrigin(0.5, 0);

      // Deadband indicator
      const dbW = tileW - 10;
      const dbH = 3;
      this.add.rectangle(tx + 5, ty + tileH - 8, dbW, dbH, 0x222222, 1).setOrigin(0, 0);
      this.add.rectangle(tx + 5, ty + tileH - 8, dbW * conf, dbH, tileBorder, 0.8).setOrigin(0, 0);
    });

    if (tiles.length === 0) {
      this.add.text(centerX, tilesStartY + 30, '[ Terminal initialized. Tiles form as actions repeat. ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#555555',
        fontStyle: 'italic',
      }).setOrigin(0.5);
    }

    // Fish curve indicator
    const curveY = termY + termHeight - 30;
    this.add.text(centerX, curveY, '🐟 Fish ID Curve →', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#666',
    }).setOrigin(0.5);

    this.add.text(centerX, curveY + 14,
      `Surprise: ${(stats.surprise * 100).toFixed(0)}% (was 100%)  |  Coverage: ${(stats.reflexCoverage * 100).toFixed(0)}% (was 0%)`,
      {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#555',
      }).setOrigin(0.5);
  }

  /**
   * Start an animation that simulates terminal activity — tiles lighting up.
   */
  private startTerminalAnimation() {
    if (!this.terminal) return;

    this.animationTimer = this.time.addEvent({
      delay: 1500 + Math.random() * 2000,
      callback: () => {
        if (!this.terminal) return;

        // Generate a simulated action
        const actions = simulateActions(this.agentName!, 1, 0.2);
        if (actions.length > 0) {
          this.terminal.observe(actions[0]);
        }

        // Re-render the terminal display
        this.children.removeAll();
        this.drawRoom();
        this.drawTitle();
        this.drawTerminalDisplay();
        this.drawExits();
        this.emitSidebarUpdate();
      },
      loop: true,
    });
  }

  /**
   * Seed initial tile data so the terminal looks alive.
   */
  private seedTerminalData() {
    if (!this.terminal) return;

    const seedActions: Action[] = [];
    const actionTypes = ['read-file', 'write-file', 'run-test', 'search-docs', 'send-message'];

    for (let i = 0; i < 40; i++) {
      const type = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      seedActions.push({
        type,
        category: type.includes('file') ? 'file' : type.includes('test') ? 'code' : type.includes('message') ? 'comm' : 'analysis',
        params: { path: `/src/file${i}.ts`, line: Math.floor(Math.random() * 100) },
        timestamp: new Date(Date.now() - (40 - i) * 5000).toISOString(),
      });
    }

    for (const action of seedActions) {
      this.terminal.observe(action);
    }
  }
}
