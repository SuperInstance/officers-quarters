// =============================================================================
// NAVIGATOR TERMINAL SCENE — The visual field for agents
// =============================================================================
// Renders three views simultaneously in the Chart House:
//
//   ┌─────────────────────────────┐
//   │       THE CHART             │  Top-down spatial view
//   │  (trackline, predictor,     │  - agent dots with movement vectors
//   │   heat zones, agents)       │  - 5-min predictor + extrapolation
//   │                             │  - task density as heat zones
//   ├──────────────┬──────────────┤
//   │  THE SOUNDER │  THE RADAR   │  Vertical scope + Pulse sweep
//   │  (marks on   │  (contacts   │  - incoming tasks as fish marks
//   │   vertical   │   updated    │  - periodic sweep, not constant
//   │   scope)     │   on pulse)  │  - direction/speed from 2-3 sweeps
//   └──────────────┴──────────────┘
//
// All three views share the same coordinate space.
// =============================================================================

import Phaser from 'phaser';
import { BaseRoomScene } from '../BaseRoomScene.js';
import {
  NavigatorTerminal,
  Position,
  Heading,
  HeatZone,
  RadarContact,
  AgentTrack,
  createAgentTrack,
  STANDARD_PACE,
  DEFAULT_PULSE_INTERVAL_MS,
  distance,
  bearing,
  knotsToBoatLengthsPerMinute,
  BOAT_LENGTHS_PER_MIN,
} from '../systems/navigator-terminal.js';
import { AGENT_NAMES } from '../../data/rooms.js';

// ---------------------------------------------------------------------------
// Demo agent definitions
// ---------------------------------------------------------------------------

const DEMO_AGENTS: Array<{
  name: string;
  color: number;
  startPos: Position;
  pace: number;
  heading: Heading;
  behavior: 'orbit' | 'drift' | 'patrol' | 'stationary' | 'spiral';
}> = [
  { name: 'Flash',   color: 0xe91e63, startPos: { x: 0, y: 0 },    pace: 2.5, heading: 45,  behavior: 'orbit' },
  { name: 'Pro',     color: 0x4caf50, startPos: { x: 15, y: 10 },  pace: 1.0, heading: 90,  behavior: 'patrol' },
  { name: 'Wesley',  color: 0xff9800, startPos: { x: -10, y: 15 }, pace: 2.0, heading: 180, behavior: 'spiral' },
  { name: 'Scribe',  color: 0x9c27b0, startPos: { x: -20, y: -10 },pace: 0.8, heading: 270, behavior: 'drift' },
  { name: 'Hermes',  color: 0x00bcd4, startPos: { x: 20, y: -15 }, pace: 1.8, heading: 0,   behavior: 'patrol' },
];

// Heat zone seeds — where the work concentrates
const HEAT_ZONES: Array<{ center: Position; radius: number; intensity: number; label: string }> = [
  { center: { x: 10, y: 5 },   radius: 12, intensity: 0.8, label: 'Build Zone' },
  { center: { x: -15, y: -8 }, radius: 8,  intensity: 0.5, label: 'Bug Triage' },
  { center: { x: 5, y: -20 },  radius: 10, intensity: 0.6, label: 'Creative' },
];

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class NavigatorTerminalScene extends BaseRoomScene {
  private navigatorTerminal: NavigatorTerminal | null = null;
  private demoTerminals: Map<string, NavigatorTerminal> = new Map();
  private pulseTimer: Phaser.Time.TimerEvent | null = null;
  private animationTimer: Phaser.Time.TimerEvent | null = null;
  private radarSweepAngle = 0;
  private simTime = 0;

  // Graphics objects for each view
  private chartGraphics!: Phaser.GameObjects.Graphics;
  private sounderGraphics!: Phaser.GameObjects.Graphics;
  private radarGraphics!: Phaser.GameObjects.Graphics;

  constructor(config: Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  create() {
    super.create();

    // Clear default content — we're drawing the terminal, not room description
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawNavigatorTerminal();
    this.drawExits();
    this.emitSidebarUpdate();

    // Start simulation
    this.startSimulation();
  }

  shutdown() {
    if (this.pulseTimer) this.pulseTimer.remove();
    if (this.animationTimer) this.animationTimer.remove();
  }

  // -------------------------------------------------------------------------
  // Layout — Three views in one screen
  // -------------------------------------------------------------------------

  private getLayout() {
    const w = this.scale.width;
    const h = this.scale.height;
    const padding = 10;
    const headerH = 70;
    const footerH = 50;
    const availableH = h - headerH - footerH;
    const halfH = (availableH - padding * 3) / 2;

    return {
      chart: {
        x: padding,
        y: headerH,
        w: w - padding * 2,
        h: halfH,
      },
      sounder: {
        x: padding,
        y: headerH + halfH + padding,
        w: (w - padding * 3) / 2,
        h: halfH,
      },
      radar: {
        x: padding * 2 + (w - padding * 3) / 2,
        y: headerH + halfH + padding,
        w: (w - padding * 3) / 2,
        h: halfH,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Draw the Navigator's Terminal
  // -------------------------------------------------------------------------

  private drawNavigatorTerminal() {
    const accent = Phaser.Display.Color.HexStringToColor(this.room.accentColor);
    const w = this.scale.width;

    // Section header
    this.add.text(w / 2, 62, '🧭 NAVIGATOR\'S TERMINAL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: this.room.accentColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Initialize demo terminals if not done
    if (this.demoTerminals.size === 0) {
      this.initializeDemoScene();
    }

    // Create graphics layers
    this.chartGraphics = this.add.graphics();
    this.sounderGraphics = this.add.graphics();
    this.radarGraphics = this.add.graphics();

    // Draw all three views
    this.drawChartView();
    this.drawSounderView();
    this.drawRadarView();

    // Labels
    const layout = this.getLayout();
    this.add.text(layout.chart.x + 10, layout.chart.y + 5, ' Chart — Top-Down Spatial View', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    });

    this.add.text(layout.sounder.x + 10, layout.sounder.y + 5, ' Sounder — Vertical Scope', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    });

    this.add.text(layout.radar.x + 10, layout.radar.y + 5, ' Radar — Pulse Sweep', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    });
  }

  // -------------------------------------------------------------------------
  // Initialize demo scene with 5 agents
  // -------------------------------------------------------------------------

  private initializeDemoScene() {
    // Create self as observer (Flash for this demo)
    const self = DEMO_AGENTS[0];
    this.navigatorTerminal = new NavigatorTerminal(self.name, self.startPos, {
      pace: self.pace,
      heading: self.heading,
      pulseIntervalMs: DEFAULT_PULSE_INTERVAL_MS,
    });

    // Set heat zones
    this.navigatorTerminal.heatZones = HEAT_ZONES.map(z => ({ ...z }));

    // Set a simple current field
    this.navigatorTerminal.setCurrentField({
      vectors: [
        { position: { x: 5, y: 0 }, direction: 90, strength: 0.6 },
        { position: { x: -10, y: 5 }, direction: 45, strength: 0.3 },
        { position: { x: 15, y: -10 }, direction: 180, strength: 0.4 },
      ],
      eddies: [
        { x: -15, y: -8 },  // stuck work near Bug Triage
      ],
      openWater: [
        { x: 25, y: 25 },  // open area to the northeast
        { x: -25, y: 20 }, // open area to the northwest
      ],
    });

    // Add other agents
    for (let i = 1; i < DEMO_AGENTS.length; i++) {
      const a = DEMO_AGENTS[i];
      this.navigatorTerminal.updateOtherAgent(a.name, a.startPos, a.pace, a.heading);
    }

    // Seed some sounder marks
    this.navigatorTerminal.addIncomingTask('Code Review', 8, 0.6);
    this.navigatorTerminal.addIncomingTask('Deploy Prep', 15, 0.8);
    this.navigatorTerminal.addIncomingTask('Bug Report', 5, 0.4);
    this.navigatorTerminal.addIncomingTask('Feature Spec', 25, 0.3);

    // Seed some trackline history for self
    const now = Date.now();
    for (let t = 20; t >= 1; t--) {
      const angle = (self.heading + t * 5) * Math.PI / 180;
      const r = t * 0.8;
      this.navigatorTerminal.track.trackline.addPoint({
        position: {
          x: self.startPos.x - Math.sin(angle) * r,
          y: self.startPos.y - Math.cos(angle) * r,
        },
        timestamp: now - t * 60000,
        quality: t % 5 === 0 ? 'poor' : 'good',
        taskLabel: t === 1 ? 'Current Task' : undefined,
      });
    }
  }

  // -------------------------------------------------------------------------
  // THE CHART — Top-down spatial view
  // -------------------------------------------------------------------------

  private drawChartView() {
    const g = this.chartGraphics;
    g.clear();
    const layout = this.getLayout().chart;
    const accent = Phaser.Display.Color.HexStringToColor(this.room.accentColor);

    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRect(layout.x, layout.y, layout.w, layout.h);
    g.lineStyle(1, accent.color, 0.3);
    g.strokeRect(layout.x, layout.y, layout.w, layout.h);

    if (!this.navigatorTerminal) return;

    const chart = this.navigatorTerminal.getChartView();

    // Map world coordinates (boat-lengths) to screen coordinates
    const centerX = layout.x + layout.w / 2;
    const centerY = layout.y + layout.h / 2;
    const scale = Math.min(layout.w, layout.h) / 80; // ~80 boat-lengths visible

    const toScreen = (pos: Position): { x: number; y: number } => ({
      x: centerX + pos.x * scale,
      y: centerY + pos.y * scale,
    });

    // --- Heat zones ---
    for (const zone of chart.heatZones) {
      const center = toScreen(zone.center);
      const radius = zone.radius * scale;

      // Radial gradient effect with concentric circles
      for (let r = radius; r > 0; r -= 4) {
        const alpha = zone.intensity * 0.08 * (r / radius);
        const hue = Math.floor(120 * (1 - zone.intensity)); // red-green mix
        const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.4).color;
        g.fillStyle(color, alpha);
        g.fillCircle(center.x, center.y, r);
      }

      // Zone label
      this.add.text(center.x, center.y - radius - 8, zone.label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#ff9966',
      }).setOrigin(0.5);
    }

    // --- Current vectors (flow arrows) ---
    for (const v of chart.currentField.vectors) {
      const from = toScreen(v.position);
      const len = 20 * v.strength;
      const rad = v.direction * Math.PI / 180;
      const to = { x: from.x + Math.sin(rad) * len, y: from.y + Math.cos(rad) * len };

      g.lineStyle(1, 0x4fc3f7, 0.3 * v.strength);
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(to.x, to.y);
      g.strokePath();

      // Arrowhead
      const ah = 4;
      g.beginPath();
      g.moveTo(to.x, to.y);
      g.lineTo(to.x - Math.sin(rad - 0.3) * ah, to.y - Math.cos(rad - 0.3) * ah);
      g.lineTo(to.x - Math.sin(rad + 0.3) * ah, to.y - Math.cos(rad + 0.3) * ah);
      g.closePathPath();
      g.fillStyle(0x4fc3f7, 0.3 * v.strength);
      g.fillPath();
    }

    // --- Eddies (stuck work) ---
    for (const eddy of chart.currentField.eddies) {
      const pos = toScreen(eddy);
      g.lineStyle(1, 0xf44336, 0.4);
      g.strokeCircle(pos.x, pos.y, 8);
      g.lineStyle(1, 0xf44336, 0.2);
      g.strokeCircle(pos.x, pos.y, 12);
    }

    // --- Open water markers ---
    for (const open of chart.currentField.openWater) {
      const pos = toScreen(open);
      g.lineStyle(1, 0x4caf50, 0.25);
      g.strokeCircle(pos.x, pos.y, 10);
    }

    // --- Self trackline ---
    const tl = chart.trackline;
    if (tl.length > 1) {
      for (let i = 1; i < tl.length; i++) {
        const from = toScreen(tl[i - 1].position);
        const to = toScreen(tl[i].position);
        const quality = tl[i].quality;
        const color = quality === 'good' ? 0x4caf50 : 0xf44336;
        const alpha = 0.3 + (i / tl.length) * 0.4;

        g.lineStyle(2, color, alpha);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
        g.strokePath();
      }
    }

    // --- Self predictor line ---
    if (chart.predictionLine.length >= 3) {
      const start = toScreen(chart.predictionLine[0].position);
      const pred = toScreen(chart.predictionLine[1].position);
      const extrap = toScreen(chart.predictionLine[2].position);

      // Solid line to 5-min predictor
      g.lineStyle(2, accent.color, 0.6);
      g.beginPath();
      g.moveTo(start.x, start.y);
      g.lineTo(pred.x, pred.y);
      g.strokePath();

      // Dashed line to extrapolation
      g.lineStyle(1, accent.color, 0.25);
      const steps = 8;
      for (let s = 0; s < steps; s += 2) {
        const t1 = s / steps;
        const t2 = (s + 1) / steps;
        g.beginPath();
        g.moveTo(pred.x + (extrap.x - pred.x) * t1, pred.y + (extrap.y - pred.y) * t1);
        g.lineTo(pred.x + (extrap.x - pred.x) * t2, pred.y + (extrap.y - pred.y) * t2);
        g.strokePath();
      }

      // Predictor dot
      g.fillStyle(accent.color, 0.7);
      g.fillCircle(pred.x, pred.y, 3);
      g.lineStyle(1, accent.color, 0.5);
      g.strokeCircle(pred.x, pred.y, 5);

      // Extrapolation dot (faint)
      g.fillStyle(accent.color, 0.2);
      g.fillCircle(extrap.x, extrap.y, 2);

      // Time labels
      this.add.text(pred.x + 6, pred.y, '5m', {
        fontFamily: 'Courier New, monospace',
        fontSize: '7px',
        color: this.room.accentColor,
      });
      this.add.text(extrap.x + 6, extrap.y, '~20m', {
        fontFamily: 'Courier New, monospace',
        fontSize: '7px',
        color: '#555555',
      });
    }

    // --- Other agents as dots ---
    for (const contact of chart.contacts) {
      const pos = toScreen(contact.position);
      const agentData = DEMO_AGENTS.find(a => a.name === contact.agentId);
      const color = agentData?.color ?? 0xffffff;

      // Movement vector
      const vlen = 12;
      const vrad = contact.heading * Math.PI / 180;
      g.lineStyle(1, color, 0.5);
      g.beginPath();
      g.moveTo(pos.x, pos.y);
      g.lineTo(pos.x + Math.sin(vrad) * vlen, pos.y + Math.cos(vrad) * vlen);
      g.strokePath();

      // Agent dot
      g.fillStyle(color, 0.8);
      g.fillCircle(pos.x, pos.y, 4);
      g.lineStyle(1, color, 0.4);
      g.strokeCircle(pos.x, pos.y, 6);

      // Name label
      this.add.text(pos.x + 8, pos.y - 4, contact.agentId, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      });
    }

    // --- Self dot (on top) ---
    const selfPos = toScreen(chart.self.position);
    const selfColor = DEMO_AGENTS[0].color;

    // Heading indicator
    const hrad = chart.self.heading * Math.PI / 180;
    g.lineStyle(2, selfColor, 0.8);
    g.beginPath();
    g.moveTo(selfPos.x, selfPos.y);
    g.lineTo(selfPos.x + Math.sin(hrad) * 15, selfPos.y + Math.cos(hrad) * 15);
    g.strokePath();

    // Self dot — larger with ring
    g.fillStyle(selfColor, 0.9);
    g.fillCircle(selfPos.x, selfPos.y, 5);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(selfPos.x, selfPos.y, 8);

    this.add.text(selfPos.x + 10, selfPos.y - 4, '◆ YOU', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#' + selfColor.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    });

    // --- Grid lines (faint) ---
    g.lineStyle(1, 0xffffff, 0.04);
    for (let bl = -40; bl <= 40; bl += 10) {
      const sx = centerX + bl * scale;
      const sy = centerY + bl * scale;
      if (sx >= layout.x && sx <= layout.x + layout.w) {
        g.beginPath();
        g.moveTo(sx, layout.y);
        g.lineTo(sx, layout.y + layout.h);
        g.strokePath();
      }
      if (sy >= layout.y && sy <= layout.y + layout.h) {
        g.beginPath();
        g.moveTo(layout.x, sy);
        g.lineTo(layout.x + layout.w, sy);
        g.strokePath();
      }
    }

    // Compass rose
    this.add.text(centerX, layout.y + 4, 'N', {
      fontFamily: 'Georgia, serif',
      fontSize: '8px',
      color: '#666',
    }).setOrigin(0.5);
  }

  // -------------------------------------------------------------------------
  // THE SOUNDER — Vertical time-of-flight scope
  // -------------------------------------------------------------------------

  private drawSounderView() {
    const g = this.sounderGraphics;
    g.clear();
    const layout = this.getLayout().sounder;

    // Background
    g.fillStyle(0x000000, 0.7);
    g.fillRect(layout.x, layout.y, layout.w, layout.h);
    g.lineStyle(1, 0x4fc3f7, 0.3);
    g.strokeRect(layout.x, layout.y, layout.w, layout.h);

    if (!this.navigatorTerminal) return;

    const sounder = this.navigatorTerminal.getSounderView();
    const innerX = layout.x + 8;
    const innerY = layout.y + 25;
    const innerW = layout.w - 16;
    const innerH = layout.h - 35;

    // Depth grid
    g.lineStyle(1, 0x4fc3f7, 0.06);
    for (let i = 1; i < 5; i++) {
      const y = innerY + (innerH / 5) * i;
      g.beginPath();
      g.moveTo(innerX, y);
      g.lineTo(innerX + innerW, y);
      g.strokePath();
    }

    // Water column gradient (top lighter → bottom darker)
    for (let y = 0; y < innerH; y += 2) {
      const depthRatio = y / innerH;
      const alpha = 0.02 + depthRatio * 0.03;
      g.fillStyle(0x0d47a1, alpha);
      g.fillRect(innerX, innerY + y, innerW, 2);
    }

    // The bottom — system capacity
    const bottomY = innerY + innerH;
    g.lineStyle(2, 0x8d6e63, 0.6);
    g.beginPath();
    g.moveTo(innerX, bottomY);
    g.lineTo(innerX + innerW, bottomY);
    g.strokePath();

    // Bottom texture (brownish)
    for (let x = 0; x < innerW; x += 4) {
      const h = 2 + Math.sin(x * 0.5 + this.simTime * 0.5) * 1.5;
      g.fillStyle(0x5d4037, 0.3);
      g.fillRect(innerX + x, bottomY, 4, h);
    }

    // Marks (fish = incoming work items)
    const marks = sounder.marks;
    const markAgeSpan = 60000; // 1 minute of marks visible

    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      const depthRatio = mark.depth / sounder.capacityDepth;
      const markY = innerY + depthRatio * innerH;

      // Horizontal position based on age (marks drift right as they age)
      const age = (Date.now() - mark.timestamp) / markAgeSpan;
      const markX = innerX + (i * 15 + 10) % (innerW - 20);

      // Mark as a fish-like shape
      const size = 3 + mark.intensity * 4;
      const alpha = mark.active ? 0.5 + mark.intensity * 0.4 : 0.15;

      // Body
      g.fillStyle(mark.active ? 0xffd54f : 0x666666, alpha);
      g.fillCircle(markX, markY, size);

      // Tail (horizontal line for sidescan look)
      if (mark.active) {
        g.lineStyle(1, 0xffd54f, alpha * 0.4);
        g.beginPath();
        g.moveTo(markX - size - 4, markY);
        g.lineTo(markX + size + 4, markY);
        g.strokePath();
      }

      // Label
      if (mark.active) {
        this.add.text(markX + size + 4, markY - 4, mark.label, {
          fontFamily: 'Courier New, monospace',
          fontSize: '7px',
          color: '#ffd54f',
        });
      }
    }

    // Column fill indicator (left side bar)
    const fillH = sounder.columnFill * innerH;
    g.fillStyle(0xff5722, 0.3);
    g.fillRect(innerX + innerW - 4, innerY + innerH - fillH, 3, fillH);

    // Depth labels
    this.add.text(innerX + 2, innerY + 4, '0 BL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#444',
    });
    const midDepth = Math.round(sounder.capacityDepth / 2);
    this.add.text(innerX + 2, innerY + innerH / 2, `${midDepth} BL`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#444',
    });
    this.add.text(innerX + 2, bottomY - 10, `${sounder.capacityDepth} BL (capacity)`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#8d6e63',
    });
  }

  // -------------------------------------------------------------------------
  // THE RADAR — Periodic pulse sweep
  // -------------------------------------------------------------------------

  private drawRadarView() {
    const g = this.radarGraphics;
    g.clear();
    const layout = this.getLayout().radar;

    // Background
    g.fillStyle(0x000000, 0.7);
    g.fillRect(layout.x, layout.y, layout.w, layout.h);
    g.lineStyle(1, 0x00bcd4, 0.3);
    g.strokeRect(layout.x, layout.y, layout.w, layout.h);

    if (!this.navigatorTerminal) return;

    const radar = this.navigatorTerminal.getRadarView();
    const centerX = layout.x + layout.w / 2;
    const centerY = layout.y + layout.h / 2 + 10;
    const maxRadius = Math.min(layout.w, layout.h) / 2 - 20;

    // Range rings
    g.lineStyle(1, 0x00bcd4, 0.1);
    for (let r = maxRadius / 3; r <= maxRadius; r += maxRadius / 3) {
      g.strokeCircle(centerX, centerY, r);
    }

    // Cross hairs
    g.lineStyle(1, 0x00bcd4, 0.08);
    g.beginPath();
    g.moveTo(centerX - maxRadius, centerY);
    g.lineTo(centerX + maxRadius, centerY);
    g.moveTo(centerX, centerY - maxRadius);
    g.lineTo(centerX, centerY + maxRadius);
    g.strokePath();

    // Sweep line (animated)
    const sweepRad = this.radarSweepAngle * Math.PI / 180;
    g.lineStyle(2, 0x00bcd4, 0.4);
    g.beginPath();
    g.moveTo(centerX, centerY);
    g.lineTo(centerX + Math.sin(sweepRad) * maxRadius, centerY + Math.cos(sweepRad) * maxRadius);
    g.strokePath();

    // Sweep trail (fading wedge behind the sweep line)
    const trailSteps = 20;
    const trailAngle = 40; // degrees of trail
    for (let s = 0; s < trailSteps; s++) {
      const frac = s / trailSteps;
      const angle = this.radarSweepAngle - trailAngle * frac;
      const arad = angle * Math.PI / 180;
      const alpha = 0.15 * (1 - frac);
      g.lineStyle(1, 0x00bcd4, alpha);
      g.beginPath();
      g.moveTo(centerX, centerY);
      g.lineTo(centerX + Math.sin(arad) * maxRadius, centerY + Math.cos(arad) * maxRadius);
      g.strokePath();
    }

    // Center dot (self)
    g.fillStyle(0x00bcd4, 0.8);
    g.fillCircle(centerX, centerY, 3);

    // Contacts from latest sweep
    const sweeps = radar.sweeps;
    if (sweeps.length > 0) {
      const latest = sweeps[sweeps.length - 1];
      for (const contact of latest) {
        const rangeRatio = Math.min(1, contact.range / 40); // 40 boat-lengths max
        const cr = rangeRatio * maxRadius;
        const cb = contact.bearing * Math.PI / 180;
        const cx = centerX + Math.sin(cb) * cr;
        const cy = centerY + Math.cos(cb) * cr;

        // Contact dot
        const agentData = DEMO_AGENTS.find(a => a.name === contact.agentId);
        const color = agentData?.color ?? 0xffffff;
        g.fillStyle(color, 0.7);
        g.fillCircle(cx, cy, 3);

        // Movement vector from trend
        const trend = radar.trends.get(contact.agentId);
        if (trend) {
          const vrad = trend.velocity.heading * Math.PI / 180;
          const vlen = 6 + trend.velocity.pace * 3;
          g.lineStyle(1, color, 0.5 * trend.confidence);
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.sin(vrad) * vlen, cy + Math.cos(vrad) * vlen);
          g.strokePath();
        }

        // Label
        this.add.text(cx + 5, cy - 4, contact.agentId, {
          fontFamily: 'Courier New, monospace',
          fontSize: '7px',
          color: '#' + color.toString(16).padStart(6, '0'),
        });
      }
    }

    // Pulse status
    const timeSincePulse = radar.timeSinceLastPulse;
    const pulseReady = timeSincePulse >= radar.pulseIntervalMs;
    const pulseText = pulseReady ? '⚡ PULSE READY' : `Next: ${((radar.pulseIntervalMs - timeSincePulse) / 1000).toFixed(1)}s`;

    this.add.text(layout.x + layout.w - 8, layout.y + layout.h - 14, pulseText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: pulseReady ? '#00ff00' : '#666666',
    }).setOrigin(1, 0);

    // Sweep counter
    this.add.text(layout.x + 8, layout.y + layout.h - 14, `Sweep #${radar.totalSweeps}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#444444',
    });

    // Range labels
    this.add.text(centerX + maxRadius / 3 - 8, centerY + 4, '15 BL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: '#333',
    });
    this.add.text(centerX + 2 * maxRadius / 3 - 8, centerY + 4, '30 BL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: '#333',
    });
    this.add.text(centerX + maxRadius - 8, centerY + 4, '40 BL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: '#333',
    });
  }

  // -------------------------------------------------------------------------
  // Simulation — Animate agents moving through task space
  // -------------------------------------------------------------------------

  private startSimulation() {
    if (!this.navigatorTerminal) return;

    // Animation loop — update agent positions and redraw
    this.animationTimer = this.time.addEvent({
      delay: 100, // 10 FPS for the visual update
      callback: () => this.updateSimulation(),
      loop: true,
    });

    // Radar pulse timer — every 3 seconds
    this.pulseTimer = this.time.addEvent({
      delay: DEFAULT_PULSE_INTERVAL_MS,
      callback: () => this.doRadarPulse(),
      loop: true,
    });
  }

  private updateSimulation() {
    if (!this.navigatorTerminal) return;

    this.simTime += 0.1;

    // Advance radar sweep angle
    this.radarSweepAngle = (this.radarSweepAngle + 3) % 360;

    // Move self (Flash — orbit behavior)
    const selfData = DEMO_AGENTS[0];
    const orbitAngle = this.simTime * 0.3;
    const orbitRadius = 8;
    const selfPos: Position = {
      x: Math.cos(orbitAngle) * orbitRadius,
      y: Math.sin(orbitAngle) * orbitRadius * 0.7,
    };
    const selfHeading: Heading = ((orbitAngle * 180 / Math.PI) + 90) % 360;
    this.navigatorTerminal.track.trackline.addPoint({
      position: selfPos,
      timestamp: Date.now(),
      quality: Math.random() < 0.15 ? 'poor' : 'good',
    });
    this.navigatorTerminal.track.heading = selfHeading;

    // Move other agents based on behavior
    for (let i = 1; i < DEMO_AGENTS.length; i++) {
      const a = DEMO_AGENTS[i];
      let pos: Position;
      let heading: Heading = a.heading;

      switch (a.behavior) {
        case 'orbit': {
          const ang = this.simTime * 0.2 + i;
          pos = {
            x: a.startPos.x + Math.cos(ang) * 6,
            y: a.startPos.y + Math.sin(ang) * 6,
          };
          heading = ((ang * 180 / Math.PI) + 90) % 360;
          break;
        }
        case 'patrol': {
          const t = (this.simTime * 0.15 + i * 2) % 4;
          const phase = Math.floor(t);
          const frac = t - phase;
          const waypoints = [
            { x: a.startPos.x, y: a.startPos.y },
            { x: a.startPos.x + 10, y: a.startPos.y },
            { x: a.startPos.x + 10, y: a.startPos.y + 10 },
            { x: a.startPos.x, y: a.startPos.y + 10 },
          ];
          const w1 = waypoints[phase];
          const w2 = waypoints[(phase + 1) % 4];
          pos = {
            x: w1.x + (w2.x - w1.x) * frac,
            y: w1.y + (w2.y - w1.y) * frac,
          };
          heading = bearing(w1, w2);
          break;
        }
        case 'drift': {
          pos = {
            x: a.startPos.x + Math.sin(this.simTime * 0.1 + i) * 8,
            y: a.startPos.y + Math.cos(this.simTime * 0.08 + i) * 5,
          };
          break;
        }
        case 'spiral': {
          const sr = 3 + this.simTime * 0.05;
          const sa = this.simTime * 0.4;
          pos = {
            x: a.startPos.x + Math.cos(sa) * sr,
            y: a.startPos.y + Math.sin(sa) * sr,
          };
          heading = ((sa * 180 / Math.PI) + 90) % 360;
          break;
        }
        case 'stationary':
        default:
          pos = { ...a.startPos };
          break;
      }

      this.navigatorTerminal.updateOtherAgent(a.name, pos, a.pace, heading);
    }

    // Occasionally add/remove sounder marks
    if (Math.random() < 0.03) {
      const labels = ['New Task', 'Alert', 'Request', 'Review', 'Deploy', 'Test Run'];
      const label = labels[Math.floor(Math.random() * labels.length)];
      this.navigatorTerminal.addIncomingTask(label, 3 + Math.random() * 30, 0.3 + Math.random() * 0.5);
    }

    // Resolve oldest active mark occasionally
    if (Math.random() < 0.02) {
      const active = this.navigatorTerminal.sounder.getActiveMarks();
      if (active.length > 3) {
        const idx = this.navigatorTerminal.sounder.getMarks().indexOf(active[0]);
        if (idx >= 0) this.navigatorTerminal.resolveTask(idx);
      }
    }

    // Redraw all views
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawNavigatorTerminal();
    this.drawExits();
    this.emitSidebarUpdate();
  }

  private doRadarPulse() {
    if (!this.navigatorTerminal) return;
    this.navigatorTerminal.pulse();
  }
}
