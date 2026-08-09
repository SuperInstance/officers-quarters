// Sighting Generator — creates realistic fish sightings over 30 days
// Generates 200 sightings with realistic distributions

import type { FishSighting, FishSpecies } from './types.js';
import { ALASKA_SPECIES, weightedRandomSpecies } from './species.js';

// Seeded RNG for reproducibility
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 0x100000000;
    return this.state / 0x100000000;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  bool(probability: number): boolean {
    return this.next() < probability;
  }
}

const rng = new SeededRandom(42); // deterministic for reproducible demos

const BEHAVIORS = ['cruising', 'feeding', 'schooling', 'resting', 'migrating'] as const;
const TIMES_OF_DAY = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'] as const;
const VISIBILITIES = ['clear', 'slightly-murky', 'murky', 'partial-view'] as const;

function generateSighting(day: number, idCounter: number): FishSighting {
  const species = weightedRandomSpecies();
  const isJuvenile = rng.bool(0.15); // 15% of sightings are juveniles

  // Size: within species range, juveniles are smaller
  let size: number;
  if (isJuvenile) {
    const juvenileMax = species.sizeRange[0] + (species.sizeRange[1] - species.sizeRange[0]) * 0.3;
    size = rng.range(species.sizeRange[0] * 0.4, juvenileMax);
  } else {
    size = rng.range(species.sizeRange[0], species.sizeRange[1]);
  }

  // Color: base color with variance
  const color = species.baseColor; // simplified for the sim

  // Water temp varies by day (seasonal drift)
  const baseTemp = 42 + Math.sin((day / 30) * Math.PI) * 6; // 36-48°F range
  const waterTemp = Math.round(baseTemp + rng.range(-3, 3));

  // Visibility: mostly clear, sometimes degraded
  let visibility: FishSighting['visibility'];
  const visRoll = rng.next();
  if (visRoll < 0.6) visibility = 'clear';
  else if (visRoll < 0.8) visibility = 'slightly-murky';
  else if (visRoll < 0.92) visibility = 'murky';
  else visibility = 'partial-view';

  // Difficulty calculation
  let difficulty = 0.2; // base
  if (isJuvenile) difficulty += 0.25; // juveniles are harder
  if (visibility === 'slightly-murky') difficulty += 0.1;
  if (visibility === 'murky') difficulty += 0.25;
  if (visibility === 'partial-view') difficulty += 0.35;
  if (species.rarity > 0.25) difficulty += 0.2; // rare species are harder
  difficulty = Math.min(1, difficulty);

  // Behavior
  let behavior: FishSighting['behavior'];
  if (species.category === 'forage') {
    behavior = rng.bool(0.7) ? 'schooling' : rng.pick(BEHAVIORS as readonly string[]) as FishSighting['behavior'];
  } else {
    behavior = rng.pick(BEHAVIORS as readonly string[]) as FishSighting['behavior'];
  }

  return {
    id: `sight-${String(idCounter).padStart(3, '0')}`,
    day,
    species: species.name,
    size: Math.round(size * 10) / 10,
    color,
    bodyShape: species.bodyShape,
    behavior,
    waterTemp,
    timeOfDay: rng.pick(TIMES_OF_DAY as readonly string[]) as FishSighting['timeOfDay'],
    visibility,
    isJuvenile,
    difficulty,
  };
}

export function generateSightings(totalCount = 200, days = 30): FishSighting[] {
  const sightings: FishSighting[] = [];

  // Distribute sightings across days with some natural variation
  const perDay: number[] = [];
  let assigned = 0;
  for (let d = 1; d <= days; d++) {
    // More sightings in middle period (peak season)
    const weight = 1 + 0.3 * Math.sin(((d - 1) / (days - 1)) * Math.PI);
    perDay.push(weight);
  }
  const totalWeight = perDay.reduce((a, b) => a + b, 0);

  for (let d = 0; d < days; d++) {
    const count = Math.max(3, Math.round((perDay[d] / totalWeight) * totalCount));
    for (let i = 0; i < count && assigned < totalCount; i++) {
      sightings.push(generateSighting(d + 1, assigned));
      assigned++;
    }
  }

  // If we're short (rounding), top up
  while (assigned < totalCount) {
    const day = Math.floor(rng.next() * days) + 1;
    sightings.push(generateSighting(day, assigned));
    assigned++;
  }

  // Sort by day, then by time of day
  const timeOrder = { dawn: 0, morning: 1, midday: 2, afternoon: 3, dusk: 4, night: 5 };
  sightings.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return timeOrder[a.timeOfDay] - timeOrder[b.timeOfDay];
  });

  return sightings;
}

// Export a pre-generated dataset
export const SIGHTINGS = generateSightings(200, 30);
