// Fish Species Catalog — Alaska Waters
// 15 species the agent must learn to identify

import type { FishSpecies } from './types.js';

export const ALASKA_SPECIES: FishSpecies[] = [
  // ─── Salmon (dominant, ~60% of sightings) ──────────────────────────────────
  {
    name: 'chinook',
    commonName: 'Chinook Salmon (King)',
    category: 'salmon',
    sizeRange: [24, 58],
    baseColor: 'blue-green',
    colorVariance: 0.3,
    bodyShape: 'torpedo',
    distinctiveFeatures: ['black gum line', 'spots on back and both lobes of tail'],
    rarity: 0.1,
    frequencyWeight: 15,
  },
  {
    name: 'coho',
    commonName: 'Coho Salmon (Silver)',
    category: 'salmon',
    sizeRange: [18, 38],
    baseColor: 'silver',
    colorVariance: 0.25,
    bodyShape: 'torpedo',
    distinctiveFeatures: ['white gum line', 'spots only on upper lobe of tail'],
    rarity: 0.1,
    frequencyWeight: 14,
  },
  {
    name: 'sockeye',
    commonName: 'Sockeye Salmon (Red)',
    category: 'salmon',
    sizeRange: [20, 33],
    baseColor: 'red',
    colorVariance: 0.2,
    bodyShape: 'torpedo',
    distinctiveFeatures: ['bright red body in spawning', 'green head', 'no spots'],
    rarity: 0.12,
    frequencyWeight: 13,
  },
  {
    name: 'pink',
    commonName: 'Pink Salmon (Humpy)',
    category: 'salmon',
    sizeRange: [14, 22],
    baseColor: 'pink-white',
    colorVariance: 0.3,
    bodyShape: 'robust',
    distinctiveFeatures: ['large oval spots', 'humped back in males'],
    rarity: 0.08,
    frequencyWeight: 10,
  },
  {
    name: 'chum',
    commonName: 'Chum Salmon (Dog)',
    category: 'salmon',
    sizeRange: [18, 35],
    baseColor: 'silver-calico',
    colorVariance: 0.35,
    bodyShape: 'torpedo',
    distinctiveFeatures: ['calico spawning colors', 'no spots', 'white tip on tail'],
    rarity: 0.15,
    frequencyWeight: 8,
  },

  // ─── Flatfish (~15% of sightings) ──────────────────────────────────────────
  {
    name: 'pacific-halibut',
    commonName: 'Pacific Halibut',
    category: 'flatfish',
    sizeRange: [24, 96],
    baseColor: 'mottled-brown',
    colorVariance: 0.25,
    bodyShape: 'flat',
    distinctiveFeatures: ['both eyes on right side', 'diamond body shape', 'white underside'],
    rarity: 0.1,
    frequencyWeight: 8,
  },
  {
    name: 'arrowtooth-flounder',
    commonName: 'Arrowtooth Flounder',
    category: 'flatfish',
    sizeRange: [14, 32],
    baseColor: 'mottled-gray-brown',
    colorVariance: 0.3,
    bodyShape: 'flat',
    distinctiveFeatures: ['arrow-shaped teeth', 'both eyes on left side', 'oval body'],
    rarity: 0.2,
    frequencyWeight: 4,
  },

  // ─── Cod & Groundfish (~10%) ───────────────────────────────────────────────
  {
    name: 'pacific-cod',
    commonName: 'Pacific Cod',
    category: 'cod',
    sizeRange: [16, 42],
    baseColor: 'brown-gray',
    colorVariance: 0.2,
    bodyShape: 'elongated',
    distinctiveFeatures: ['barbel on chin', 'three dorsal fins', 'spots on back'],
    rarity: 0.12,
    frequencyWeight: 6,
  },
  {
    name: 'walleye-pollock',
    commonName: 'Walleye Pollock',
    category: 'cod',
    sizeRange: [12, 36],
    baseColor: 'olive-brown',
    colorVariance: 0.25,
    bodyShape: 'elongated',
    distinctiveFeatures: ['split dorsal fin', 'white lateral line', 'large eyes'],
    rarity: 0.15,
    frequencyWeight: 5,
  },

  // ─── Reef & Rocky Bottom Fish (~7%) ────────────────────────────────────────
  {
    name: 'lingcod',
    commonName: 'Lingcod',
    category: 'rockfish',
    sizeRange: [20, 60],
    baseColor: 'dark-mottled',
    colorVariance: 0.4,
    bodyShape: 'elongated',
    distinctiveFeatures: ['large mouth with sharp teeth', 'single long dorsal fin', 'copper speckles'],
    rarity: 0.2,
    frequencyWeight: 4,
  },
  {
    name: 'sablefish',
    commonName: 'Sablefish (Black Cod)',
    category: 'rockfish',
    sizeRange: [18, 40],
    baseColor: 'dark-gray-black',
    colorVariance: 0.15,
    bodyShape: 'elongated',
    distinctiveFeatures: ['smooth black skin', 'white lateral line', 'two dorsal fins'],
    rarity: 0.25,
    frequencyWeight: 3,
  },
  {
    name: 'pacific-ocean-perch',
    commonName: 'Pacific Ocean Perch',
    category: 'rockfish',
    sizeRange: [10, 22],
    baseColor: 'bright-red',
    colorVariance: 0.2,
    bodyShape: 'robust',
    distinctiveFeatures: ['red body', 'spiny dorsal fin', 'convex head profile'],
    rarity: 0.25,
    frequencyWeight: 3,
  },
  {
    name: 'yelloweye-rockfish',
    commonName: 'Yelloweye Rockfish',
    category: 'rockfish',
    sizeRange: [16, 36],
    baseColor: 'orange-red',
    colorVariance: 0.15,
    bodyShape: 'robust',
    distinctiveFeatures: ['bright orange body', 'yellow eye', 'rasp-like head spines'],
    rarity: 0.3,
    frequencyWeight: 2,
  },
  {
    name: 'quillback-rockfish',
    commonName: 'Quillback Rockfish',
    category: 'rockfish',
    sizeRange: [10, 26],
    baseColor: 'brown-mottled',
    colorVariance: 0.3,
    bodyShape: 'robust',
    distinctiveFeatures: ['long dorsal spines', 'mottled brown body', 'dark blotches on back'],
    rarity: 0.3,
    frequencyWeight: 2,
  },

  // ─── Forage Fish (~3%) ─────────────────────────────────────────────────────
  {
    name: 'pacific-herring',
    commonName: 'Pacific Herring',
    category: 'forage',
    sizeRange: [6, 15],
    baseColor: 'silver-blue',
    colorVariance: 0.15,
    bodyShape: 'slender',
    distinctiveFeatures: ['small size', 'silver belly', 'no spots', 'schooling behavior'],
    rarity: 0.35,
    frequencyWeight: 3,
  },
];

// Helper: get species by name
export function getSpecies(name: string): FishSpecies | undefined {
  return ALASKA_SPECIES.find(s => s.name === name);
}

// Helper: weighted random species selection
export function weightedRandomSpecies(): FishSpecies {
  const totalWeight = ALASKA_SPECIES.reduce((sum, s) => sum + s.frequencyWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const species of ALASKA_SPECIES) {
    roll -= species.frequencyWeight;
    if (roll <= 0) return species;
  }
  return ALASKA_SPECIES[0];
}
