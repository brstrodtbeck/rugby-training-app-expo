/**
 * Removes redundant flowSteps from exercises that have exercisesGroup,
 * warmUpGroup, or coolDownGroup (Option A: groups take precedence).
 * Run: node scripts/remove-redundant-flowsteps.js
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let removed = 0;

function processExercise(ex) {
  if (!ex || typeof ex !== 'object') return;
  const hasFlowGroups = !!(ex.exercisesGroup || ex.warmUpGroup || ex.coolDownGroup);
  if (hasFlowGroups && ex.flowSteps && Array.isArray(ex.flowSteps)) {
    delete ex.flowSteps;
    removed++;
    console.log('Removed flowSteps from:', ex.name);
  }
}

function processBlock(block) {
  if (!block?.exercises) return;
  for (const ex of block.exercises) {
    processExercise(ex);
  }
}

// FitnessProgram.json uses macrocycle.mesocycles[].microcycle[].blocks
const macro = data.macrocycle;
if (macro?.mesocycles) {
  for (const mc of macro.mesocycles) {
    const micro = mc.microcycle;
    if (!Array.isArray(micro)) continue;
    for (const day of micro) {
      const blocks = day.blocks;
      if (Array.isArray(blocks)) {
        for (const block of blocks) processBlock(block);
      } else if (blocks && typeof blocks === 'object') {
        for (const key of Object.keys(blocks)) {
          const b = blocks[key];
          if (b && typeof b === 'object' && Array.isArray(b.exercises)) processBlock(b);
        }
      }
    }
  }
}

console.log('\nTotal removed:', removed);
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Saved', jsonPath);
