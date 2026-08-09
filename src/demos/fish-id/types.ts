// Fish Identification Simulation — Type Definitions
// Part of the Deadband Architecture demos

// ─── Species ──────────────────────────────────────────────────────────────────

export interface FishSpecies {
  name: string;
  commonName: string;
  category: 'salmon' | 'flatfish' | 'cod' | 'rockfish' | 'pelagic' | 'forage';
  // Visual characteristics the agent uses for identification
  sizeRange: [number, number]; // inches, [min, max] for deadband
  baseColor: string;
  colorVariance: number; // how much color can vary (0-1)
  bodyShape: 'torpedo' | 'flat' | 'elongated' | 'robust' | 'slender';
  distinctiveFeatures: string[];
  rarity: number; // 0-1, higher = rarer
  // Frequency weight for generation (higher = more common)
  frequencyWeight: number;
}

// ─── Sightings ────────────────────────────────────────────────────────────────

export interface FishSighting {
  id: string;
  day: number;
  species: string; // actual species name (ground truth)
  size: number; // inches
  color: string;
  bodyShape: FishSpecies['bodyShape'];
  behavior: 'cruising' | 'feeding' | 'schooling' | 'resting' | 'migrating';
  waterTemp: number; // °F
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
  visibility: 'clear' | 'slightly-murky' | 'murky' | 'partial-view';
  isJuvenile: boolean;
  // Conditions that make this sighting harder
  difficulty: number; // 0-1, higher = harder
}

// ─── Identification Tiles ─────────────────────────────────────────────────────
// A tile is a learned reflex pattern. When a sighting falls within a tile's
// deadband, identification is instantaneous (reflex). No cortex needed.

export interface IDTile {
  id: string;
  species: string;
  // Deadband boundaries — if a sighting falls within ALL of these, it's a reflex match
  sizeDeadband: [number, number];
  colorRange: string[]; // acceptable color variants
  bodyShapes: FishSpecies['bodyShape'][];
  // How many encounters built this tile
  encounterCount: number;
  // When this tile was formed
  formedOnDay: number;
  // How many times this tile has fired (reflex activations)
  activations: number;
  // Whether the tile has been refined (deadband expanded/contracted)
  refinements: number;
  // Edge cases this tile absorbed
  edgeCasesHandled: number;
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export type IdentificationMode = 'reflex' | 'edge' | 'cortex';

export interface AgentIdentification {
  sightingId: string;
  day: number;
  predictedSpecies: string;
  actualSpecies: string;
  correct: boolean;
  mode: IdentificationMode;
  surprise: number; // 0-1, how surprising this sighting was
  processingTime: number; // ms, simulated (cortex = slow, reflex = fast)
  tileId?: string; // which tile fired, if reflex
  notes?: string;
}

// ─── Daily Log ────────────────────────────────────────────────────────────────

export interface DayLog {
  day: number;
  totalSightings: number;
  reflexCount: number;
  edgeCount: number;
  cortexCount: number;
  tilesAtEndOfDay: number;
  avgSurprise: number;
  accuracy: number;
  events: string[]; // notable events
  higherOrderWork?: string[]; // what the agent did with freed attention
}

// ─── Simulation Report ────────────────────────────────────────────────────────

export interface SimulationReport {
  days: DayLog[];
  finalTileCount: number;
  finalAccuracy: number;
  finalSurprise: number;
  totalSightings: number;
  totalReflex: number;
  totalCortex: number;
  allIdentifications: AgentIdentification[];
  tileFormationLog: { day: number; species: string; trigger: string }[];
}
