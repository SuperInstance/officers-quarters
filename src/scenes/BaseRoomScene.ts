// =============================================================================
// BASE ROOM SCENE — Shared functionality for all 12 rooms
// =============================================================================

import Phaser from 'phaser';
import { Room, getRoom, RoomId, ROOMS } from '../data/rooms.js';
import { IntelligentTerminal } from '../systems/intelligent-terminal.js';
import { AGENT_NAMES, AGENT_STATIONS } from '../data/rooms.js';

export class BaseRoomScene extends Phaser.Scene {
  room!: Room;
  roomId!: RoomId;
  sidebarUpdate: ((data: SidebarData) => void) | null = null;

  // Shared terminal registry (persisted across scenes via registry)
  terminals: Map<string, IntelligentTerminal> = new Map();

  constructor(config: Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  init(data: { roomId: RoomId }) {
    this.roomId = data.roomId;
    this.room = getRoom(data.roomId);
  }

  create() {
    // Set background color from room data
    this.cameras.main.setBackgroundColor(this.room.ambientColor);

    // Load or create terminals
    this.loadTerminals();

    // Draw the room
    this.drawRoom();

    // Draw room title
    this.drawTitle();

    // Draw exits
    this.drawExits();

    // Draw room-specific content
    this.drawContent();

    // Update sidebar
    this.emitSidebarUpdate();
  }

  /**
   * Draw the room frame — floor, walls, ambient effects.
   */
  protected drawRoom() {
    const width = this.scale.width;
    const height = this.scale.height;
    const g = this.add.graphics();

    // Floor
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.room.ambientColor).color, 1);
    g.fillRect(0, 0, width, height);

    // Subtle floor pattern
    g.fillStyle(0xffffff, 0.03);
    for (let x = 0; x < width; x += 40) {
      for (let y = 0; y < height; y += 40) {
        g.fillRect(x, y, 38, 38);
      }
    }

    // Walls (top and bottom bars)
    const wallColor = Phaser.Display.Color.HexStringToColor(this.room.accentColor);
    g.fillStyle(wallColor.color, 0.15);
    g.fillRect(0, 0, width, 60);
    g.fillRect(0, height - 40, width, 40);

    // Accent line
    g.fillStyle(wallColor.color, 0.4);
    g.fillRect(0, 60, width, 2);
    g.fillRect(0, height - 42, width, 2);
  }

  /**
   * Draw the room title at top.
   */
  protected drawTitle() {
    const width = this.scale.width;
    const accent = this.room.accentColor;

    // Room icon + name
    this.add.text(width / 2, 30, `${this.room.icon}  ${this.room.name}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 52, this.room.subtitle, {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#888888',
    }).setOrigin(0.5);
  }

  /**
   * Draw exit buttons at the bottom of the screen.
   */
  protected drawExits() {
    const width = this.scale.width;
    const height = this.scale.height;
    const exits = this.room.exits;
    const exitRoomData = exits.map(id => getRoom(id as RoomId));

    if (exitRoomData.length === 0) return;

    // For rooms with many exits (like the Bridge), use a grid
    const maxPerRow = 4;
    const rows = Math.ceil(exitRoomData.length / maxPerRow);
    const btnWidth = Math.min(140, (width - 40) / Math.min(exitRoomData.length, maxPerRow));
    const btnHeight = 28;
    const spacing = 8;
    const startY = height - 40 - (rows * (btnHeight + spacing)) - 10;

    exitRoomData.forEach((room, i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const itemsInRow = Math.min(maxPerRow, exitRoomData.length - row * maxPerRow);
      const rowWidth = itemsInRow * btnWidth + (itemsInRow - 1) * spacing;
      const startX = (width - rowWidth) / 2;

      const x = startX + col * (btnWidth + spacing);
      const y = startY + row * (btnHeight + spacing);

      const bg = this.add.rectangle(x, y, btnWidth, btnHeight, 0x222222, 0.9)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(room.accentColor).color, 0.5)
        .setOrigin(0, 0);

      const label = this.add.text(x + btnWidth / 2, y + btnHeight / 2, `${room.icon} ${room.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: room.accentColor,
      }).setOrigin(0.5);

      const zone = this.add.zone(x + btnWidth / 2, y + btnHeight / 2, btnWidth, btnHeight);
      zone.setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        bg.setFillStyle(0x333333, 0.95);
        bg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(room.accentColor).color, 0.8);
      });

      zone.on('pointerout', () => {
        bg.setFillStyle(0x222222, 0.9);
        bg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(room.accentColor).color, 0.5);
      });

      zone.on('pointerdown', () => {
        this.scene.start(room.id, { roomId: room.id });
      });
    });
  }

  /**
   * Draw room-specific content — overridden by subclasses.
   */
  protected drawContent() {
    // Default: show room description
    const width = this.scale.width;
    const height = this.scale.height;

    const descY = 100;

    // Description panel
    const panel = this.add.rectangle(width / 2, descY + 60, width - 80, 120, 0x000000, 0.4)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(this.room.accentColor).color, 0.3);

    // Wrap text
    const descText = this.add.text(width / 2, descY + 40, this.room.longDescription, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: width - 120 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Furnishings
    const furnY = descY + 160;
    this.add.text(width / 2, furnY, ' Furnishings:', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: this.room.accentColor,
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this.add.text(width / 2, furnY + 20, this.room.furnishings.join('  •  '), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#999999',
      align: 'center',
      wordWrap: { width: width - 100 },
    }).setOrigin(0.5);
  }

  /**
   * Load terminals from the global registry.
   */
  protected loadTerminals() {
    const reg = this.game.registry;
    let stored = reg.get('terminals') as Map<string, IntelligentTerminal>;
    if (!stored) {
      stored = new Map();
      // Create a terminal for each agent
      for (const name of AGENT_NAMES) {
        stored.set(name, new IntelligentTerminal(name));
      }
      reg.set('terminals', stored);
    }
    this.terminals = stored;
  }

  /**
   * Emit sidebar data update.
   */
  protected emitSidebarUpdate() {
    const stats: Record<string, unknown> = {};
    for (const [name, terminal] of this.terminals) {
      stats[name] = terminal.getStats();
    }

    const data: SidebarData = {
      roomName: this.room.name,
      roomId: this.room.id,
      roomIcon: this.room.icon,
      roomCategory: this.room.category,
      agentStats: stats,
    };

    // Emit via game registry event
    this.game.registry.set('sidebarData', data);
    this.events.emit('sidebarUpdate', data);
  }
}

export interface SidebarData {
  roomName: string;
  roomId: string;
  roomIcon: string;
  roomCategory: string;
  agentStats: Record<string, unknown>;
}
