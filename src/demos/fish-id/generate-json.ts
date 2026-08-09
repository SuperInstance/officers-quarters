#!/usr/bin/env node
// Generate sightings.json — 200 sample sightings across 30 days

import { generateSightings } from './generate-sightings.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sightings = generateSightings(200, 30);

const outputPath = join(__dirname, 'sightings.json');
writeFileSync(outputPath, JSON.stringify(sightings, null, 2));

console.log(`Generated ${sightings.length} sightings over ${sightings[sightings.length - 1].day} days`);
console.log(`Written to: ${outputPath}`);

// Print distribution summary
const speciesCounts: Record<string, number> = {};
const juvenileCount = sightings.filter(s => s.isJuvenile).length;
const visibilityCounts: Record<string, number> = {};

for (const s of sightings) {
  speciesCounts[s.species] = (speciesCounts[s.species] || 0) + 1;
  visibilityCounts[s.visibility] = (visibilityCounts[s.visibility] || 0) + 1;
}

console.log('\nSpecies distribution:');
for (const [species, count] of Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${species.replace(/-/g, ' ').padEnd(25)} ${count} (${(count / 200 * 100).toFixed(0)}%)`);
}

console.log(`\nJuveniles: ${juvenileCount} (${(juvenileCount / 200 * 100).toFixed(0)}%)`);

console.log('\nVisibility conditions:');
for (const [vis, count] of Object.entries(visibilityCounts)) {
  console.log(`  ${vis.padEnd(20)} ${count} (${(count / 200 * 100).toFixed(0)}%)`);
}
