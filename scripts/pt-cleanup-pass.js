/**
 * Post-PT cleanup: block order, sled distance, placeholders, breathing dedupe.
 */
const fs = require('fs');

function isPrep(n) {
  n = (n || '').toLowerCase();
  return (
    /warm|raise|activate|activation|mobilize|potentiate|mobility|glute|shoulder mobility|hips|dynamic glutes/.test(n) &&
    !/cool|stretch|foam|breath/.test(n)
  );
}
function isCd(n) {
  n = (n || '').toLowerCase();
  return /cool|stretch|breathing|foam|cooldown/.test(n);
}
function isRecoveryBlock(n) {
  return /active recovery|recovery cardio|optional mobility|^rest$/i.test(n || '');
}

function reorderFitnessBlocks(blocks) {
  const prep = [];
  const main = [];
  const cd = [];
  for (const b of blocks || []) {
    if (isPrep(b.name) || isRecoveryBlock(b.name)) prep.push(b);
    else if (isCd(b.name)) cd.push(b);
    else main.push(b);
  }
  const rank = (n) => {
    n = (n || '').toLowerCase();
    if (/warm/.test(n)) return 0;
    if (/^mobility$/.test(n.trim())) return 1;
    if (/glute|shoulder|hips|dynamic/.test(n)) return 1;
    if (/activation|activate/.test(n)) return 2;
    return 3;
  };
  prep.sort((a, b) => rank(a.name) - rank(b.name));
  return [...prep, ...main, ...cd];
}

function fixDay(day, style) {
  for (const b of day.blocks || []) {
    for (const e of b.exercises || []) {
      if (/light sled push/i.test(e.name || '')) {
        e.trackingMode = 'distance';
        e.distance = e.distance || '10m';
        delete e.reps;
        if (!e.instruction) e.instruction = 'Easy drive; short steps, forward lean.';
        if (!e.definition) e.definition = 'Specific potentiation for sled work';
      }
    }
    if (/warm/i.test(b.name || '')) {
      b.exercises = (b.exercises || []).filter((e) => !/^activation$/i.test((e.name || '').trim()));
    }
  }

  let breathKept = false;
  for (const b of day.blocks || []) {
    if (!isCd(b.name)) continue;
    const kept = [];
    for (const e of b.exercises || []) {
      const isBreath = /breath|child pose breathing|box breath/i.test(e.name || '');
      if (isBreath) {
        if (breathKept) continue;
        breathKept = true;
        if (/breathing reset/i.test(e.name || '')) {
          kept.push({
            name: 'Box Breathing',
            trackingMode: 'time',
            sets: 1,
            duration: '60 sec',
            instruction: 'Inhale 4, hold 4, exhale 4, hold 4.',
            definition: 'Nervous-system downshift',
            substitutions: [],
          });
          continue;
        }
      }
      kept.push(e);
    }
    b.exercises = kept;
  }

  if (style !== 'rugby') {
    day.blocks = reorderFitnessBlocks(day.blocks || []);
  }
  day.blocks = (day.blocks || []).filter(
    (b) => (b.exercises || []).length > 0 || /rest/i.test(b.name || '')
  );
}

function process(file, style) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const m of data.macrocycle.mesocycles || []) {
    for (const day of m.microcycle || []) fixDay(day, style);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

process('src/data/FitnessProgram.json', 'fitness');
process('src/data/simpleweightProgram.json', 'fitness');
process('src/data/HypertrophyMonth.json', 'hypertrophy');
process('src/data/rugbyProgram.json', 'rugby');

const rug = JSON.parse(fs.readFileSync('src/data/rugbyProgram.json', 'utf8'));
const m4d5 = rug.macrocycle.mesocycles.find((m) => m.id === 'm4').microcycle.find((d) => d.day === 5);
const sled = m4d5.blocks.find((b) => /potentiate/i.test(b.name)).exercises.find((e) => /sled/i.test(e.name));
console.log('sled', sled.name, sled.distance, sled.trackingMode);

const sim = JSON.parse(fs.readFileSync('src/data/simpleweightProgram.json', 'utf8'));
const p1d1 = sim.macrocycle.mesocycles[0].microcycle[0];
console.log('p1d1 order', p1d1.blocks.map((b) => b.name).join(' > '));

const hyp = JSON.parse(fs.readFileSync('src/data/HypertrophyMonth.json', 'utf8'));
const w1d1 = hyp.macrocycle.mesocycles[0].microcycle[0];
console.log('w1d1 warm', w1d1.blocks[0].exercises.map((e) => e.name));
console.log('w1d1 order', w1d1.blocks.map((b) => b.name).join(' > '));

const fit = JSON.parse(fs.readFileSync('src/data/FitnessProgram.json', 'utf8'));
const m1d3 = fit.macrocycle.mesocycles[0].microcycle.find((d) => d.day === 3);
console.log('m1d3 order', m1d3.blocks.map((b) => b.name).join(' > '));
console.log('m1d3 CD', m1d3.blocks.find((b) => /cool/i.test(b.name)).exercises.map((e) => e.name));
