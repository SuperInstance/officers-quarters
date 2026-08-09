// =============================================================================
// OFFICERS' QUARTERS — Main Entry Point
// =============================================================================
// A 12-room interactive system built on Phaser, demonstrating:
//
// 1. The Intelligent Terminal — tiles that form from repeated actions
// 2. The Deadband — reflexive range where tiles fire automatically
// 3. Reflex-to-Cortex Spectrum — tasks migrate from reasoning to reflex
// 4. Tile Composition — tiles chain into complex workflows
// 5. Games Train Agents for Work — game deadbands teach tile creation
//
// THE FISH IDENTIFICATION INSIGHT:
// When a system first encounters input, everything is surprising (surprise=1.0).
// Over time, as tiles form and deadbands widen, surprise decreases.
// The cortex (reasoning) is freed for genuinely novel stimuli.
// This is learning. This is what games train.
//
// =============================================================================

import Phaser from 'phaser';
import { RoomId, ROOMS } from './data/rooms.js';
import { BaseRoomScene } from './scenes/BaseRoomScene.js';
import { BridgeScene } from './scenes/BridgeScene.js';
import { PokerRoomScene } from './scenes/PokerRoomScene.js';
import { StationRoomScene } from './scenes/stations/StationRoomScene.js';
import {
  LibraryScene,
  WorkshopScene,
  GalleyScene,
  EngineRoomScene,
  ChartHouseScene,
} from './scenes/UtilityScenes.js';
import { NavigatorTerminalScene } from './scenes/NavigatorTerminalScene.js';

// ---------------------------------------------------------------------------
// Scene Configuration — register all 12 rooms
// ---------------------------------------------------------------------------

// Bridge (custom scene)
const bridgeScene = new BridgeScene();

// Poker Room (custom scene)
const pokerScene = new PokerRoomScene();

// Five station rooms
const stationScenes: StationRoomScene[] = [
  new StationRoomScene({ key: 'flash-station' }),
  new StationRoomScene({ key: 'pro-station' }),
  new StationRoomScene({ key: 'wesley-station' }),
  new StationRoomScene({ key: 'scribe-station' }),
  new StationRoomScene({ key: 'hermes-station' }),
];

// Five utility rooms
const libraryScene = new LibraryScene();
const workshopScene = new WorkshopScene();
const galleyScene = new GalleyScene();
const engineRoomScene = new EngineRoomScene();
const chartHouseScene = new ChartHouseScene();

// Navigator's Terminal scene (accessible from Chart House)
const navigatorTerminalScene = new NavigatorTerminalScene({ key: 'navigator-terminal' });

const allScenes: Phaser.Scene[] = [
  bridgeScene,
  ...stationScenes,
  pokerScene,
  libraryScene,
  workshopScene,
  galleyScene,
  engineRoomScene,
  chartHouseScene,
  navigatorTerminalScene,
];

// ---------------------------------------------------------------------------
// Phaser Game Configuration
// ---------------------------------------------------------------------------

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0a1628',
  scene: allScenes,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  const game = new Phaser.Game(config);

  // Start at The Bridge
  game.scene.start('bridge', { roomId: 'bridge' as RoomId });

  // Expose game instance for debugging
  (window as unknown as Record<string, unknown>).__OQ_GAME = game;

  console.log(`
╔══════════════════════════════════════════════╗
║       OFFICERS' QUARTERS — v1.0.0            ║
║       12-Room Standalone System              ║
║                                              ║
║  Intelligent Terminals · Tile Evolution      ║
║  Reflex-to-Cortex Learning · Poker Room      ║
║                                              ║
║  "Games train agents for work."              ║
╚══════════════════════════════════════════════╝
  `);

  // Sidebar update handler
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    game.registry.events.on('setdata', (key: string) => {
      if (key === 'sidebarData') {
        updateSidebar(game);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Sidebar Updates
// ---------------------------------------------------------------------------

function updateSidebar(game: Phaser.Game) {
  const data = game.registry.get('sidebarData');
  if (!data) return;

  const sidebar = document.getElementById('sidebar-content');
  if (!sidebar) return;

  const d = data as {
    roomName: string;
    roomId: string;
    roomIcon: string;
    roomCategory: string;
    agentStats: Record<string, { surprise: number; reflexCoverage: number; totalTiles: number; totalActions: number }>;
  };

  sidebar.innerHTML = `
    <div class="sidebar-room">
      <span class="room-icon">${d.roomIcon}</span>
      <span class="room-name">${d.roomName}</span>
      <span class="room-cat">${d.roomCategory}</span>
    </div>
    <div class="sidebar-section">
      <h3>Fleet Status</h3>
      ${Object.entries(d.agentStats).map(([name, stats]) => `
        <div class="agent-stat">
          <span class="agent-name">${name}</span>
          <div class="stat-row">
            <span class="stat-label">Tiles</span>
            <span class="stat-val">${stats.totalTiles}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Actions</span>
            <span class="stat-val">${stats.totalActions}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Reflex</span>
            <span class="stat-val">${(stats.reflexCoverage * 100).toFixed(0)}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Surprise</span>
            <span class="stat-val">${(stats.surprise * 100).toFixed(0)}%</span>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="sidebar-insight">
      <h3>🐟 The Fish Curve</h3>
      <p>Tasks start at surprise=1.0, coverage=0.0.
      As tiles form, surprise drops and coverage rises.
      Attention frees for what's novel.</p>
    </div>
  `;
}
