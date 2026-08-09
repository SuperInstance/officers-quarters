// Fish ID Simulation — main simulation engine
//
// Runs the agent through 30 days of fish sightings, tracking tile formation,
// surprise decay, accuracy improvement, and the shift from cortex to reflex.

import type {
  AgentIdentification,
  DayLog,
  FishSighting,
  SimulationReport,
} from './types.js';
import { IDAgent } from './id-agent.js';
import { generateSightings } from './generate-sightings.js';

// Seeded RNG for reproducible cortex guesses
// (We use a global seed in generate-sightings for the data; the agent
// has its own internal randomness for cortex accuracy rolls.)

export class FishIDSimulation {
  sightings: FishSighting[];
  agent: IDAgent;
  private identifications: AgentIdentification[] = [];
  private dayLogs: DayLog[] = [];
  private tileFormationLog: { day: number; species: string; trigger: string }[] = [];

  constructor(sightings?: FishSighting[]) {
    this.sightings = sightings ?? generateSightings(200, 30);
    this.agent = new IDAgent();
  }

  /**
   * Run the full 30-day simulation.
   */
  run(): SimulationReport {
    const maxDay = Math.max(...this.sightings.map(s => s.day));

    for (let day = 1; day <= maxDay; day++) {
      this.runDay(day);
    }

    const finalDay = this.dayLogs[this.dayLogs.length - 1];
    return {
      days: this.dayLogs,
      finalTileCount: this.agent.tiles.length,
      finalAccuracy: finalDay.accuracy,
      finalSurprise: finalDay.avgSurprise,
      totalSightings: this.identifications.length,
      totalReflex: this.identifications.filter(i => i.mode === 'reflex').length,
      totalCortex: this.identifications.filter(i => i.mode === 'cortex').length,
      allIdentifications: this.identifications,
      tileFormationLog: this.tileFormationLog,
    };
  }

  /**
   * Process all sightings for a single day.
   */
  private runDay(day: number): void {
    const daySightings = this.sightings.filter(s => s.day === day);
    const dayIdents: AgentIdentification[] = [];
    const events: string[] = [];

    for (const sighting of daySightings) {
      const result = this.agent.identify(sighting, day);
      dayIdents.push(result);
      this.identifications.push(result);

      // Log notable events
      if (result.mode === 'cortex' && result.correct) {
        const speciesSeen = this.identifications.filter(
          i => i.actualSpecies === sighting.species
        ).length;
        if (speciesSeen <= 3) {
          events.push(`First ${sighting.species.replace(/-/g, ' ')} analyzed. Tile candidate (${speciesSeen}/3).`);
        }
      }
      if (!result.correct && result.mode === 'cortex') {
        events.push(
          `Misidentification: predicted ${result.predictedSpecies.replace(/-/g, ' ')}, was ${result.actualSpecies.replace(/-/g, ' ')}.`
        );
      }
      if (result.mode === 'edge') {
        if (result.notes) events.push(result.notes);
      }
    }

    // Check for tile formation at end of day
    const newTiles = this.agent.checkTileFormation(day);
    for (const t of newTiles) {
      this.tileFormationLog.push({ day, species: t.species, trigger: t.trigger });
      events.push(`Tile formed: ${t.species.replace(/-/g, ' ')}. ${t.trigger}.`);
    }

    // Calculate daily stats
    const reflexCount = dayIdents.filter(i => i.mode === 'reflex').length;
    const edgeCount = dayIdents.filter(i => i.mode === 'edge').length;
    const cortexCount = dayIdents.filter(i => i.mode === 'cortex').length;
    const correctCount = dayIdents.filter(i => i.correct).length;
    const avgSurprise = dayIdents.reduce((sum, i) => sum + i.surprise, 0) / dayIdents.length;
    const accuracy = dayIdents.length > 0 ? correctCount / dayIdents.length : 0;

    // Determine higher-order work (what the agent does when identification is reflexive)
    const higherOrderWork = this.getHigherOrderWork(day, reflexCount, daySightings.length);

    // Add milestones (each only fires once)
    if (day === 1) {
      events.push('Agent bootstrapped. Every sighting requires full cortex analysis.');
    }
    if (this.agent.tiles.length >= 5 && !this.dayLogs.some(d => d.events.some(e => e.includes('Common species')))) {
      events.push('Common species covered. Majority of sightings now reflexive.');
    }
    if (this.agent.tiles.length >= 10 && !this.dayLogs.some(d => d.events.some(e => e.includes('Halfway to full')))) {
      events.push('Halfway to full coverage. Attention beginning to free up.');
    }
    if (day >= 7 && this.agent.tiles.length >= 11) {
      const alreadyFreed = this.dayLogs.some(d => d.higherOrderWork && d.higherOrderWork.length > 0);
      if (!alreadyFreed) {
        events.push("Agent's attention freed: began noticing higher-order patterns.");
      }
    }

    const log: DayLog = {
      day,
      totalSightings: daySightings.length,
      reflexCount,
      edgeCount,
      cortexCount,
      tilesAtEndOfDay: this.agent.tiles.length,
      avgSurprise: Math.round(avgSurprise * 100) / 100,
      accuracy: Math.round(accuracy * 1000) / 10, // percentage with 1 decimal
      events,
      higherOrderWork,
    };

    this.dayLogs.push(log);
  }

  /**
   * Determine what higher-order work the agent can do as identification becomes reflexive.
   */
  private getHigherOrderWork(day: number, reflexCount: number, totalCount: number): string[] {
    const reflexRatio = totalCount > 0 ? reflexCount / totalCount : 0;
    const work: string[] = [];

    // Only start higher-order work after day 5 AND when majority reflexive
    if (day < 6 || reflexRatio < 0.4) return work;

    // As reflex ratio increases, agent has more attention for higher-order work
    if (reflexRatio >= 0.5) {
      work.push('Monitoring water temperature trends');
    }
    if (reflexRatio >= 0.65) {
      work.push('Tracking migration timing patterns');
    }
    if (reflexRatio >= 0.75) {
      work.push('Predicting bycatch risk for protected species');
    }
    if (reflexRatio >= 0.85) {
      work.push('Correlating species presence with environmental factors');
    }
    if (reflexRatio >= 0.95) {
      work.push('Ecosystem health analysis');
      work.push('Fishery stock assessment modeling');
    }

    return work;
  }
}
