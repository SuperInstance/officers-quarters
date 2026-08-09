// Fish Identification Simulation
// A concrete demo of the Deadband Architecture
//
// An agent watches a camera over Alaska fishing waters. At first, every fish
// requires full cortex analysis (slow, error-prone). As it encounters the same
// species repeatedly, identification tiles form — reflex patterns that fire
// instantly when a sighting falls within the tile's deadband.
//
// Over 30 days, the agent shifts from "what is that?" to thinking about
// ecosystems, migration patterns, and bycatch prediction.
//
// Run: npx tsx src/demos/fish-id/run-report.ts
// View chart: open src/demos/fish-id/chart.html

export { FishIDSimulation } from './fish-id-sim.js';
export { IDAgent } from './id-agent.js';
export { ALASKA_SPECIES, getSpecies, weightedRandomSpecies } from './species.js';
export { generateSightings, SIGHTINGS } from './generate-sightings.js';
export type {
  FishSpecies,
  FishSighting,
  IDTile,
  AgentIdentification,
  DayLog,
  SimulationReport,
  IdentificationMode,
} from './types.js';
