/**
 * Canonical exercise-name sweep across program JSON files.
 */
const fs = require('fs');

const CANONICAL = {
  'leg swings': 'Leg Swings (Front-to-Back)',
  'leg swings front-back': 'Leg Swings (Front-to-Back)',
  'leg swings (front-back)': 'Leg Swings (Front-to-Back)',
  'leg swings front to back': 'Leg Swings (Front-to-Back)',
  'leg swings (front to back)': 'Leg Swings (Front-to-Back)',
  'leg swings side-side': 'Leg Swings (Side-to-Side)',
  'leg swings (side-side)': 'Leg Swings (Side-to-Side)',
  'leg swings side to side': 'Leg Swings (Side-to-Side)',
  'leg swings (side to side)': 'Leg Swings (Side-to-Side)',
  'band pulls': 'Band Pull-Aparts',
  'band pull aparts': 'Band Pull-Aparts',
  'wall slides': 'Scapular Wall Slides',
  'thoracic rotations': 'Thoracic Rotations (Quadruped)',
  "world's greatest stretch": "World's Greatest Stretch",
  'worlds greatest stretch': "World's Greatest Stretch",
};

function normKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function canon(name) {
  const k = normKey(name);
  return CANONICAL[k] || name;
}

function walkExercise(ex, stats) {
  if (!ex || typeof ex !== 'object') return ex;
  const next = { ...ex };
  if (typeof next.name === 'string') {
    const c = canon(next.name);
    if (c !== next.name) {
      stats.renamed.push(`${next.name} -> ${c}`);
      next.name = c;
    }
  }
  // Remove reps from distance-mode exercises
  if (next.trackingMode === 'distance' && next.reps !== undefined) {
    delete next.reps;
    stats.distanceRepsFixed++;
  }
  // Multi-set timed: ensure per set
  if (next.sets > 1 && next.duration && !/per set|each/i.test(next.duration)) {
    next.duration = `${next.duration} per set`;
    stats.durationFixed++;
  }
  for (const gk of ['warmUpGroup', 'exercisesGroup', 'coolDownGroup']) {
    if (next[gk]?.exercises) {
      next[gk] = {
        ...next[gk],
        exercises: next[gk].exercises.map((fe) => {
          const name = canon(fe.name);
          if (name !== fe.name) stats.renamed.push(`${fe.name} -> ${name}`);
          return { ...fe, name };
        }),
      };
    }
  }
  if (next.flowSteps) {
    next.flowSteps = next.flowSteps.map((s) => {
      const name = canon(s.name);
      if (name !== s.name) stats.renamed.push(`${s.name} -> ${name}`);
      return { ...s, name };
    });
  }
  return next;
}

function dedupeBlockExercises(block, stats) {
  const seen = new Set();
  const out = [];
  for (const ex of block.exercises || []) {
    const walked = walkExercise(ex, stats);
    const k = normKey(walked.name);
    if (seen.has(k)) {
      stats.dupesRemoved.push(`${block.name}: ${walked.name}`);
      continue;
    }
    seen.add(k);
    out.push(walked);
  }
  return { ...block, exercises: out };
}

function processProgram(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stats = { renamed: [], dupesRemoved: [], distanceRepsFixed: 0, durationFixed: 0 };
  for (const m of data.macrocycle?.mesocycles || []) {
    for (const day of m.microcycle || []) {
      day.blocks = (day.blocks || []).map((b) => dedupeBlockExercises(b, stats));
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return stats;
}

function processRecovery(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stats = { renamed: [], dupesRemoved: [], distanceRepsFixed: 0, durationFixed: 0 };
  for (const w of data.recoveryWorkouts || []) {
    w.blocks = (w.blocks || []).map((b) => dedupeBlockExercises(b, stats));
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return stats;
}

function print(label, stats) {
  console.log(`\n${label}`);
  console.log(`  renamed: ${stats.renamed.length}`);
  console.log(`  dupes removed: ${stats.dupesRemoved.length}`);
  console.log(`  distance reps fixed: ${stats.distanceRepsFixed}`);
  console.log(`  duration fixed: ${stats.durationFixed}`);
  if (stats.renamed.length) console.log('  sample renames:', [...new Set(stats.renamed)].slice(0, 10));
  if (stats.dupesRemoved.length) console.log('  sample dupes:', stats.dupesRemoved.slice(0, 10));
}

print('Fitness', processProgram('src/data/FitnessProgram.json'));
print('Rugby', processProgram('src/data/rugbyProgram.json'));
print('Hypertrophy', processProgram('src/data/HypertrophyMonth.json'));
print('Simple', processProgram('src/data/simpleweightProgram.json'));
print('Recovery', processRecovery('src/data/recoveryWorkouts.json'));
