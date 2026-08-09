// =============================================================================
// POKER ROOM SCENE — Texas Hold'em table, open mic, social space
// =============================================================================

import Phaser from 'phaser';
import { BaseRoomScene } from './BaseRoomScene.js';
import { RoomId } from '../data/rooms.js';
import { AGENT_NAMES } from '../data/rooms.js';

interface PokerPlayer {
  name: string;
  chips: number;
  cards: string[];
  folded: boolean;
  bet: number;
  isAllIn: boolean;
}

export class PokerRoomScene extends BaseRoomScene {
  private players: PokerPlayer[] = [];
  private pot = 0;
  private currentBet = 0;
  private dealerIndex = 0;
  private activePlayerIndex = 0;
  private communityCards: string[] = [];
  private deck: string[] = [];
  private phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' = 'waiting';
  private narrationLog: string[] = [];
  private actionTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'poker-room' });
  }

  init(data: { roomId: RoomId }) {
    super.init(data);
  }

  create() {
    super.create();
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawPokerTable();
    this.drawExits();
    this.emitSidebarUpdate();

    // Initialize game
    this.initDeck();
    this.initPlayers();
    this.startNewHand();
  }

  shutdown() {
    if (this.actionTimer) this.actionTimer.remove();
  }

  private initDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        this.deck.push(`${r}${s}`);
      }
    }
    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  private initPlayers() {
    this.players = AGENT_NAMES.map(name => ({
      name,
      chips: 1000,
      cards: [],
      folded: false,
      bet: 0,
      isAllIn: false,
    }));
  }

  private startNewHand() {
    this.initDeck();
    this.pot = 0;
    this.currentBet = 20; // small blind + big blind
    this.communityCards = [];
    this.phase = 'preflop';

    for (const p of this.players) {
      p.cards = [this.deck.pop()!, this.deck.pop()!];
      p.folded = false;
      p.bet = 0;
      p.isAllIn = false;
    }

    // Post blinds
    const sb = (this.dealerIndex + 1) % this.players.length;
    const bb = (this.dealerIndex + 2) % this.players.length;
    this.players[sb].chips -= 10;
    this.players[sb].bet = 10;
    this.players[bb].chips -= 20;
    this.players[bb].bet = 20;
    this.pot = 30;

    this.activePlayerIndex = (bb + 1) % this.players.length;
    this.addNarration(`New hand. Dealer: ${this.players[this.dealerIndex].name}. Blinds: ${this.players[sb].name} (10), ${this.players[bb].name} (20).`);

    this.drawPokerTable();

    // Start automated play
    this.actionTimer = this.time.addEvent({
      delay: 2000,
      callback: () => this.advanceGame(),
      loop: true,
    });
  }

  private advanceGame() {
    if (this.phase === 'showdown' || this.phase === 'waiting') return;

    const active = this.players.filter(p => !p.folded);
    if (active.length <= 1) {
      // Only one left — they win
      if (active.length === 1) {
        active[0].chips += this.pot;
        this.addNarration(`${active[0].name} wins ${this.pot} chips (uncontested).`);
      }
      this.phase = 'showdown';
      this.actionTimer?.remove();
      this.time.delayedCall(4000, () => {
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        this.startNewHand();
      });
      this.drawPokerTable();
      return;
    }

    // Current player acts
    const player = this.players[this.activePlayerIndex];
    if (player.folded) {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
      return;
    }

    // Simple AI: random decision
    const callAmount = this.currentBet - player.bet;
    const decision = Math.random();

    if (decision < 0.3 || (callAmount > player.chips && decision < 0.7)) {
      // Fold
      player.folded = true;
      this.addNarration(`${player.name} folds.`);
    } else if (decision < 0.75) {
      // Call
      const callPay = Math.min(callAmount, player.chips);
      player.chips -= callPay;
      player.bet += callPay;
      this.pot += callPay;
      if (player.chips === 0) {
        player.isAllIn = true;
        this.addNarration(`${player.name} calls all-in (${callPay}).`);
      } else {
        this.addNarration(`${player.name} calls (${callPay}).`);
      }
    } else {
      // Raise
      const raiseAmount = callAmount + Math.min(40, player.chips - callAmount);
      player.chips -= raiseAmount;
      player.bet += raiseAmount;
      this.pot += raiseAmount;
      this.currentBet = player.bet;
      this.addNarration(`${player.name} raises to ${player.bet}.`);
    }

    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;

    // Check if round is complete
    const allActed = this.players.every(p => p.folded || p.bet === this.currentBet || p.isAllIn);
    const stillIn = this.players.filter(p => !p.folded);

    if (allActed && (stillIn.length <= 1 || stillIn.every(p => p.bet === this.currentBet || p.isAllIn))) {
      this.advancePhase();
    }

    this.drawPokerTable();
  }

  private advancePhase() {
    // Reset bets for new round
    for (const p of this.players) p.bet = 0;
    this.currentBet = 0;
    this.activePlayerIndex = (this.dealerIndex + 1) % this.players.length;
    // Skip folded players
    while (this.players[this.activePlayerIndex].folded) {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    }

    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
      this.addNarration(`Flop: ${this.communityCards.join(' ')}`);
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      this.communityCards.push(this.deck.pop()!);
      this.addNarration(`Turn: ${this.communityCards[3]}`);
    } else if (this.phase === 'turn') {
      this.phase = 'river';
      this.communityCards.push(this.deck.pop()!);
      this.addNarration(`River: ${this.communityCards[4]}`);
    } else if (this.phase === 'river') {
      // Showdown
      const active = this.players.filter(p => !p.folded);
      const winner = active[Math.floor(Math.random() * active.length)];
      winner.chips += this.pot;
      this.addNarration(`Showdown! ${winner.name} wins ${this.pot} chips!`);
      this.phase = 'showdown';
      this.actionTimer?.remove();
      this.time.delayedCall(5000, () => {
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        this.startNewHand();
      });
      this.drawPokerTable();
      return;
    }

    this.drawPokerTable();
  }

  private addNarration(text: string) {
    this.narrationLog.unshift(text);
    if (this.narrationLog.length > 8) this.narrationLog.pop();
  }

  /**
   * Draw the poker table scene.
   */
  private drawPokerTable() {
    // Clear poker-specific content but keep room frame
    // We'll redraw everything for simplicity
    this.children.removeAll();
    this.drawRoom();
    this.drawTitle();
    this.drawExits();

    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2 - 10;
    const tableRadius = Math.min(width, height) * 0.28;
    const accent = Phaser.Display.Color.HexStringToColor(this.room.accentColor);

    // Table (oval)
    const tableG = this.add.graphics();
    tableG.fillStyle(0x0d3d1d, 0.9);
    tableG.fillEllipse(centerX, centerY, tableRadius * 2.2, tableRadius * 1.4);
    tableG.lineStyle(3, accent.color, 0.4);
    tableG.strokeEllipse(centerX, centerY, tableRadius * 2.2, tableRadius * 1.4);

    // Inner ring
    tableG.lineStyle(1, 0x1b5e20, 0.6);
    tableG.strokeEllipse(centerX, centerY, tableRadius * 1.9, tableRadius * 1.1);

    // Pot display
    this.add.text(centerX, centerY - 30, `POT: ${this.pot}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Phase indicator
    this.add.text(centerX, centerY - 8, this.phase.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888',
    }).setOrigin(0.5);

    // Community cards
    if (this.communityCards.length > 0) {
      const cardW = 36;
      const cardH = 50;
      const gap = 4;
      const totalW = this.communityCards.length * (cardW + gap) - gap;
      const startX = centerX - totalW / 2;

      this.communityCards.forEach((card, i) => {
        const x = startX + i * (cardW + gap);
        const y = centerY + 10;
        const isRed = card.includes('♥') || card.includes('♦');

        this.add.rectangle(x, y, cardW, cardH, 0xffffff, 0.9)
          .setStrokeStyle(1, 0x333333)
          .setOrigin(0, 0);

        this.add.text(x + cardW / 2, y + cardH / 2, card, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: isRed ? '#d32f2f' : '#212121',
          fontStyle: 'bold',
        }).setOrigin(0.5);
      });
    }

    // Players around the table
    const playerCount = this.players.length;
    this.players.forEach((player, i) => {
      // Position around the oval
      const angle = (i / playerCount) * Math.PI * 2 - Math.PI / 2;
      const px = centerX + Math.cos(angle) * tableRadius * 1.1;
      const py = centerY + Math.sin(angle) * tableRadius * 0.75;

      const isActive = i === this.activePlayerIndex && this.phase !== 'showdown';
      const playerColor = player.folded ? 0x333333 : isActive ? 0x1a237e : 0x1b1b1b;
      const borderColor = player.folded ? 0x555555 : isActive ? 0x448aff : accent.color;

      // Player badge
      this.add.rectangle(px, py, 90, 56, playerColor, 0.9)
        .setStrokeStyle(isActive ? 2 : 1, borderColor, isActive ? 0.9 : 0.4)
        .setOrigin(0.5);

      // Name
      this.add.text(px, py - 16, player.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: player.folded ? '#555' : isActive ? '#82b1ff' : '#ccc',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Chips
      this.add.text(px, py - 2, `🪙 ${player.chips}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: player.folded ? '#444' : '#ffd700',
      }).setOrigin(0.5);

      // Bet
      if (player.bet > 0) {
        this.add.text(px, py + 10, `bet: ${player.bet}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '9px',
          color: '#aaa',
        }).setOrigin(0.5);
      }

      // Cards (face down for other players, visible for the active player)
      if (player.cards.length > 0 && !player.folded) {
        const cw = 18;
        const ch = 24;
        player.cards.forEach((card, ci) => {
          const cx = px - cw + ci * (cw + 2);
          const cy = py - 38;
          const showCards = this.phase === 'showdown';

          if (showCards) {
            const isRed = card.includes('♥') || card.includes('♦');
            this.add.rectangle(cx, cy, cw, ch, 0xffffff, 0.9)
              .setStrokeStyle(1, 0x333)
              .setOrigin(0, 0);
            this.add.text(cx + cw / 2, cy + ch / 2, card, {
              fontFamily: 'Arial',
              fontSize: '9px',
              color: isRed ? '#d32f2f' : '#212121',
              fontStyle: 'bold',
            }).setOrigin(0.5);
          } else {
            this.add.rectangle(cx, cy, cw, ch, 0x1565c0, 0.8)
              .setStrokeStyle(1, accent.color, 0.3)
              .setOrigin(0, 0);
          }
        });
      } else if (player.folded) {
        this.add.text(px, py + 20, 'FOLDED', {
          fontFamily: 'Courier New, monospace',
          fontSize: '8px',
          color: '#666',
        }).setOrigin(0.5);
      }
    });

    // Narration log
    const logY = height - 130;
    this.add.text(20, logY, '♠ NARRATION LOG ♠', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: this.room.accentColor,
      fontStyle: 'italic',
    });

    const logText = this.narrationLog.slice(0, 5).join('\n');
    this.add.text(20, logY + 16, logText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#aaa',
      lineSpacing: 2,
    });

    // Open mic indicator (right side)
    this.add.text(width - 20, logY, '🎤 OPEN MIC', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#ff6b6b',
      fontStyle: 'italic',
    }).setOrigin(1, 0);

    this.add.text(width - 20, logY + 16, 'Whiskey served.\nStage is open.', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#888',
      align: 'right',
    }).setOrigin(1, 0);

    // Deadband training note
    this.add.text(centerX, height - 55, '🎲 Games train agents for work — game deadbands teach tile creation', {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      color: '#555',
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }
}
