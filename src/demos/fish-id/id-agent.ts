// Fish ID Agent — the learner that forms tiles over time
//
// The agent starts with zero knowledge. Every fish requires cortex analysis
// (slow, error-prone). As it encounters the same species repeatedly, it forms
// identification tiles — reflex patterns that fire instantly when a sighting
// falls within the tile's deadband.

import type {
  AgentIdentification,
  FishSighting,
  FishSpecies,
  IDTile,
  IdentificationMode,
} from './types.js';
import { ALASKA_SPECIES, getSpecies } from './species.js';

interface PendingEncounter {
  species: string;
  sightings: FishSighting[];
}

export class IDAgent {
  tiles: IDTile[] = [];
  private encounterBuffer: Map<string, PendingEncounter[]> = new Map();
  private tileIdCounter = 0;

  // Difficulty modifiers for cortex accuracy
  private static readonly CORTEX_BASE_ACCURACY = 0.4;
  private static readonly CORTEX_LEARNING_RATE = 0.02; // gets slightly better even without tiles
  private totalCortexAttempts = 0;

  /**
   * Process a single sighting. Returns the identification result.
   */
  identify(sighting: FishSighting, day: number): AgentIdentification {
    // Step 1: Check tiles for a reflex match
    const tileMatch = this.checkTiles(sighting);

    let mode: IdentificationMode;
    let predictedSpecies: string;
    let correct: boolean;
    let surprise: number;
    let processingTime: number;
    let tileId: string | undefined;
    let notes: string | undefined;

    if (tileMatch) {
      // Reflex — tile fired
      mode = sighting.difficulty > 0.5 ? 'edge' : 'reflex';
      predictedSpecies = tileMatch.species;
      tileMatch.activations++;
      tileId = tileMatch.id;

      // Accuracy: tiles are very accurate but edge cases can still misfire
      const edgePenalty = sighting.difficulty > 0.6 ? 0.1 : 0.02;
      const juvenilePenalty = sighting.isJuvenile ? 0.05 : 0;
      correct = Math.random() > (edgePenalty + juvenilePenalty);
      surprise = sighting.difficulty > 0.6 ? 0.15 : 0.02;
      processingTime = 15 + Math.random() * 10; // 15-25ms (instant)

      if (mode === 'edge') {
        notes = `Edge case: ${sighting.visibility}${sighting.isJuvenile ? ' juvenile' : ''}. Tile absorbed.`;
        tileMatch.edgeCasesHandled++;
        // Refine: expand deadband slightly to better cover this edge case
        if (tileMatch.refinements < 5) {
          tileMatch.refinements++;
        }
      }

      if (!correct) {
        notes = `Misidentification by tile ${tileMatch.id}. Species confused with similar.`;
      }
    } else {
      // Cortex — no tile matched, must analyze
      mode = 'cortex';
      this.totalCortexAttempts++;
      surprise = 1.0 - Math.min(0.3, this.totalCortexAttempts * 0.005);

      // Cortex accuracy: improves slowly with experience
      const baseAccuracy = IDAgent.CORTEX_BASE_ACCURACY +
        Math.min(0.25, this.totalCortexAttempts * IDAgent.CORTEX_LEARNING_RATE);

      // Difficulty penalty
      const effectiveAccuracy = Math.max(0.2, baseAccuracy - sighting.difficulty * 0.3);
      correct = Math.random() < effectiveAccuracy;

      // Cortex might guess wrong species — pick from similar-looking species
      if (correct) {
        predictedSpecies = sighting.species;
      } else {
        predictedSpecies = this.cortexWrongGuess(sighting);
      }

      processingTime = 800 + Math.random() * 1200; // 800-2000ms (slow)
      notes = 'Cortex analysis required. No matching tile.';

      // Track encounter for potential tile formation
      this.trackEncounter(sighting, day);
    }

    return {
      sightingId: sighting.id,
      day,
      predictedSpecies,
      actualSpecies: sighting.species,
      correct,
      mode,
      surprise: Math.round(surprise * 100) / 100,
      processingTime: Math.round(processingTime),
      tileId,
      notes,
    };
  }

  /**
   * Check all tiles for a deadband match.
   */
  private checkTiles(sighting: FishSighting): IDTile | null {
    const candidates: { tile: IDTile; score: number }[] = [];

    for (const tile of this.tiles) {
      const score = this.tileMatchScore(tile, sighting);
      if (score > 0.7) {
        candidates.push({ tile, score });
      }
    }

    if (candidates.length === 0) return null;

    // Return the best-matching tile
    candidates.sort((a, b) => b.score - a.score);

    // If multiple tiles match with similar scores, it's an edge case
    // (the agent has to disambiguate)
    return candidates[0].tile;
  }

  /**
   * Score how well a sighting matches a tile's deadband.
   */
  private tileMatchScore(tile: IDTile, sighting: FishSighting): number {
    let score = 0;

    // Size check (within deadband)
    if (sighting.size >= tile.sizeDeadband[0] && sighting.size <= tile.sizeDeadband[1]) {
      score += 0.35;
    } else {
      // Partial credit if close to deadband edge
      const [min, max] = tile.sizeDeadband;
      const range = max - min;
      const distFromEdge = sighting.size < min
        ? (min - sighting.size) / range
        : (sighting.size - max) / range;
      if (distFromEdge < 0.2) score += 0.15; // close to edge
    }

    // Body shape check
    if (tile.bodyShapes.includes(sighting.bodyShape)) {
      score += 0.3;
    }

    // Color check (simplified — in real system would be perceptual distance)
    if (tile.colorRange.includes(sighting.color)) {
      score += 0.2;
    }

    // Behavior bonus (schooling fish likely that species)
    if (sighting.behavior === 'schooling' && tile.species.includes('herring')) {
      score += 0.15;
    }

    // Visibility penalty
    if (sighting.visibility === 'murky' || sighting.visibility === 'partial-view') {
      score -= 0.1;
    }

    // Juvenile penalty — they don't match adult tiles as well
    if (sighting.isJuvenile) {
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Track encounters for tile formation (3-encounter rule).
   */
  private trackEncounter(sighting: FishSighting, _day: number): void {
    const species = sighting.species;
    if (!this.encounterBuffer.has(species)) {
      this.encounterBuffer.set(species, []);
    }
    const buffer = this.encounterBuffer.get(species)!;
    buffer.push(sighting);
  }

  /**
   * Check if any new tiles should form. Called at end of each day.
   * Rule: 3 cortex encounters with the same species → form a tile.
   */
  checkTileFormation(day: number): { species: string; trigger: string }[] {
    const formed: { species: string; trigger: string }[] = [];

    for (const [speciesName, encounters] of this.encounterBuffer) {
      // Check if we already have a tile for this species
      const existingTile = this.tiles.find(t => t.species === speciesName);
      if (existingTile) {
        // Could refine existing tile with new data
        continue;
      }

      // 3-encounter rule
      if (encounters.length >= 3) {
        const species = getSpecies(speciesName);
        if (!species) continue;

        const newTile = this.createTile(species, encounters, day);
        this.tiles.push(newTile);
        this.encounterBuffer.set(speciesName, []); // clear buffer
        formed.push({
          species: speciesName,
          trigger: `3 cortex encounters resolved (days ${encounters.map(e => e.day).join(', ')})`,
        });
      }
    }

    return formed;
  }

  /**
   * Create a new identification tile from accumulated encounters.
   */
  private createTile(species: FishSpecies, encounters: FishSighting[], day: number): IDTile {
    // Compute deadband from encounter data + species baseline
    const sizes = encounters.map(e => e.size);
    const minSize = Math.min(...sizes, species.sizeRange[0]);
    const maxSize = Math.max(...sizes, species.sizeRange[1]);

    // Pad the deadband a bit to catch future variants
    const padding = (species.sizeRange[1] - species.sizeRange[0]) * 0.1;

    return {
      id: `tile-${String(++this.tileIdCounter).padStart(2, '0')}`,
      species: species.name,
      sizeDeadband: [
        Math.max(1, Math.round((minSize - padding) * 10) / 10),
        Math.round((maxSize + padding) * 10) / 10,
      ],
      colorRange: [species.baseColor],
      bodyShapes: [species.bodyShape],
      encounterCount: encounters.length,
      formedOnDay: day,
      activations: 0,
      refinements: 0,
      edgeCasesHandled: 0,
    };
  }

  /**
   * When cortex fails to identify correctly, what does it guess?
   */
  private cortexWrongGuess(sighting: FishSighting): string {
    const actual = getSpecies(sighting.species);
    if (!actual) return sighting.species;

    // Find similar species in the same category
    const similar = ALASKA_SPECIES.filter(s =>
      s.name !== actual.name &&
      s.category === actual.category
    );

    if (similar.length > 0) {
      // Pick the most similar (closest size range)
      similar.sort((a, b) => {
        const overlapA = this.sizeOverlap(actual, a);
        const overlapB = this.sizeOverlap(actual, b);
        return overlapB - overlapA;
      });
      return similar[0].name;
    }

    // Fall back to a random wrong species
    const others = ALASKA_SPECIES.filter(s => s.name !== actual.name);
    return others[Math.floor(Math.random() * others.length)].name;
  }

  private sizeOverlap(a: FishSpecies, b: FishSpecies): number {
    const overlap = Math.min(a.sizeRange[1], b.sizeRange[1]) - Math.max(a.sizeRange[0], b.sizeRange[0]);
    return Math.max(0, overlap);
  }
}
