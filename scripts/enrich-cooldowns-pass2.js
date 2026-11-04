/**
 * Second pass: enrich thin cool-downs, rename Mobility Flow blocks, dedupe CD exercises.
 */
const fs = require('fs');
const path = require('path');

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function save(p, d) {
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
}

const lowerCD = [
  { name: 'Piriformis Stretch (Figure Four)', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Ankle over knee; pull opposite thigh toward chest.', definition: 'Glute/piriformis release', substitutions: [] },
  { name: 'Hip Flexor Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Half-kneeling; tuck pelvis and gently lean forward.', definition: 'Hip flexor length after squatting/hinging', substitutions: [] },
  { name: 'Hamstring Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Hinge at hips with long spine; reach toward foot.', definition: 'Hamstring recovery', substitutions: [] },
  { name: 'Foam Roll – Quads', trackingMode: 'time', sets: 1, duration: '30 sec', instruction: 'Slow rolls hip to knee; pause on tender spots.', definition: 'Quad soft-tissue recovery', substitutions: [] },
];
const upperCD = [
  { name: 'Doorway Chest Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Forearm on doorway; rotate torso away.', definition: 'Chest and anterior shoulder release', substitutions: [] },
  { name: 'Triceps + Lat Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Arm overhead, elbow bent; gentle side lean.', definition: 'Lat and triceps length', substitutions: [] },
  { name: 'Upper Back Foam Roll', trackingMode: 'time', sets: 1, duration: '30 sec', instruction: 'Roll mid-back only; support head with hands.', definition: 'Thoracic soft-tissue recovery', substitutions: [] },
  { name: 'Lat Foam Roll', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Side-lying; roll armpit to mid-rib.', definition: 'Lat recovery after pulling', substitutions: [] },
];
const condCD = [
  { name: 'Easy Walk', trackingMode: 'time', sets: 1, duration: '2-3 min', instruction: 'Slow walk to bring heart rate down.', definition: 'Cardiovascular downshift', substitutions: [] },
  { name: 'Hip Flexor Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Gentle half-kneeling stretch.', definition: 'Hip recovery after conditioning', substitutions: [] },
  { name: 'Hamstring Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Easy hamstring stretch.', definition: 'Posterior chain recovery', substitutions: [] },
  { name: 'Child Pose Breathing', trackingMode: 'time', sets: 1, duration: '60 sec', instruction: 'Knees wide, arms reach; slow nasal breathing.', definition: 'Nervous-system downshift', substitutions: [] },
];
const fullCD = [
  { name: 'Hip Flexor Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Half-kneeling hip flexor stretch.', definition: 'Hip recovery', substitutions: [] },
  { name: 'Doorway Chest Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Open chest after pressing.', definition: 'Anterior shoulder recovery', substitutions: [] },
  { name: 'Hamstring Stretch', trackingMode: 'time', sets: 1, duration: '30 sec each side', instruction: 'Long-spine hinge stretch.', definition: 'Posterior chain recovery', substitutions: [] },
  { name: 'Upper Back Foam Roll', trackingMode: 'time', sets: 1, duration: '30 sec', instruction: 'Gentle thoracic roll.', definition: 'Upper-back recovery', substitutions: [] },
];

function classify(title) {
  const t = (title || '').toLowerCase();
  if (/upper|press|bench/.test(t)) return 'Upper';
  if (/lower|squat|deadlift|posterior/.test(t)) return 'Lower';
  if (/full body|total body/.test(t)) return 'Full';
  if (/condition|zone 2|vo2|cardio|interval|hiit|aerobic/.test(t)) return 'Conditioning';
  if (/olympic|power|plyo|contrast|jump/.test(t)) return 'Olympic';
  return 'Lower';
}
function bank(type) {
  if (type === 'Upper') return upperCD;
  if (type === 'Full') return fullCD;
  if (type === 'Conditioning') return condCD;
  return lowerCD;
}
function key(n) {
  return (n || '').toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function merge(existing, add) {
  const seen = new Set(existing.map((e) => key(e.name)));
  const out = [...existing];
  for (const e of add) {
    if (!seen.has(key(e.name))) {
      seen.add(key(e.name));
      out.push(e);
    }
  }
  return out;
}
function isCd(n) {
  return /cool|stretch|breathing|foam/i.test(n || '');
}
function isRest(title) {
  const t = (title || '').toLowerCase();
  return /full rest/.test(t) || /^\s*rest\s*$/i.test(title || '');
}

function enrichProgram(file) {
  const data = load(file);
  let n = 0;
  for (const m of data.macrocycle.mesocycles || []) {
    for (const d of m.microcycle || []) {
      if (isRest(d.title)) continue;
      for (const b of d.blocks || []) {
        if (/^mobility flow$/i.test(b.name || '')) {
          b.name = 'Mobility & Stretching';
          n++;
        }
      }
      const cdCount = (d.blocks || [])
        .filter((b) => isCd(b.name))
        .reduce((a, b) => a + (b.exercises || []).length, 0);
      if (cdCount < 4 && !/recover/i.test(d.title || '')) {
        const type = classify(d.title);
        const bnk = bank(type);
        const idx = (d.blocks || []).findIndex((b) => /cool/i.test(b.name || ''));
        if (idx >= 0) {
          d.blocks[idx].exercises = merge(d.blocks[idx].exercises || [], bnk);
        } else {
          d.blocks.push({ name: 'Cool-Down', exercises: [...bnk] });
        }
        n++;
      }
      // Dedupe cool-down exercises across Cool-Down + Stretching
      const names = new Set();
      for (const b of d.blocks || []) {
        if (!isCd(b.name)) continue;
        const kept = [];
        for (const ex of b.exercises || []) {
          const k = key(ex.name);
          if (names.has(k)) continue;
          names.add(k);
          kept.push(ex);
        }
        b.exercises = kept;
      }
      // Drop empty stretching shells after dedupe
      d.blocks = (d.blocks || []).filter((b) => (b.exercises || []).length > 0 || !isCd(b.name));
    }
  }
  save(file, data);
  return n;
}

console.log('fitness', enrichProgram('src/data/FitnessProgram.json'));
console.log('rugby', enrichProgram('src/data/rugbyProgram.json'));
console.log('hypertrophy', enrichProgram('src/data/HypertrophyMonth.json'));
console.log('simple', enrichProgram('src/data/simpleweightProgram.json'));

const fit = load('src/data/FitnessProgram.json');
const d1 = fit.macrocycle.mesocycles[0].microcycle[0];
const cd = d1.blocks.find((b) => /cool/i.test(b.name));
console.log('m1d1 cool-down:', cd.exercises.map((e) => e.name));
