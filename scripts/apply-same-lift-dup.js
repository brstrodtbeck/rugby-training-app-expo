/**
 * Same-lift weekly DUP rotation:
 * - Where a lift already appears 2x/week: Day A = strength, Day B = power/hypertrophy
 * - Where only 1x/week (rugby/simple): add a short DUP Secondary exposure mid-week
 */
const fs = require('fs');

function findExercise(day, name) {
  for (const b of day.blocks || []) {
    const ex = (b.exercises || []).find((e) => e.name === name);
    if (ex) return { block: b, ex };
  }
  return null;
}

function ensureCue(day, text) {
  if (!day.sessionIntent || !/DUP/i.test(day.sessionIntent)) {
    day.sessionIntent = text;
  } else if (!day.sessionIntent.includes(text.slice(0, 24))) {
    day.sessionIntent = day.sessionIntent + ' ' + text;
  }
}

function applyFitnessDup(data) {
  const report = [];
  for (const meso of data.macrocycle.mesocycles || []) {
    const d1 = (meso.microcycle || []).find((d) => d.day === 1);
    const d4 = (meso.microcycle || []).find((d) => d.day === 4);
    if (!d1 || !d4) continue;

    for (const lift of ['Back Squat', 'Romanian Deadlift', 'Bulgarian Split Squat']) {
      const a = findExercise(d1, lift);
      const b = findExercise(d4, lift);
      if (!a || !b) continue;

      // Day 1 strength (keep/ensure heavy-ish)
      if (lift === 'Back Squat') {
        // leave D1 as strength; ensure targetRPE
        a.ex.targetRPE = a.ex.targetRPE || 8;
        a.ex.notes = (a.ex.notes || '').includes('DUP strength')
          ? a.ex.notes
          : ((a.ex.notes ? a.ex.notes + ' ' : '') + 'DUP strength day: controlled heavy sets, leave ~1-2 RIR.');
      }

      // Day 4 power / velocity undulation (same lift)
      if (lift === 'Back Squat') {
        b.ex.sets = 3;
        b.ex.reps = 3;
        // Keep TM-based if present, else %1RM
        if (/%\s*TM/i.test(b.ex.intensity || '') || /%\s*TM/i.test(a.ex.intensity || '')) {
          b.ex.intensity = '60-65% TM';
        } else {
          b.ex.intensity = '60-65% 1RM';
        }
        b.ex.targetRPE = 6;
        b.ex.notes =
          'DUP power day: move the bar fast. Prefer velocity over load. Safe cluster: singles with 15-20s rest if speed drops.';
        b.ex.trackingMode = b.ex.trackingMode || '1RM';
      } else if (lift === 'Romanian Deadlift') {
        b.ex.sets = 3;
        b.ex.reps = 8;
        b.ex.intensity = b.ex.intensity && /RPE/i.test(b.ex.intensity) ? 'RPE 7' : '65% 1RM';
        b.ex.targetRPE = 7;
        b.ex.notes =
          'DUP hypertrophy/volume day for the hinge: smooth tempo, 2-3 RIR, no grinders.';
      } else if (lift === 'Bulgarian Split Squat') {
        b.ex.sets = 3;
        b.ex.reps = typeof b.ex.reps === 'string' ? b.ex.reps : 8;
        b.ex.targetRPE = 7;
        b.ex.notes = (b.ex.notes || '').includes('DUP')
          ? b.ex.notes
          : ((b.ex.notes ? b.ex.notes + ' ' : '') + 'DUP volume stimulus: quality reps, leave 2 RIR.');
      }

      report.push(meso.id + ': ' + lift + ' D1 strength / D4 undulation');
    }

    ensureCue(d1, 'DUP: strength stimulus for main lifts today.');
    ensureCue(d4, 'DUP: power/volume undulation for repeated lifts today.');

    if (!meso.loadingPhilosophy) meso.loadingPhilosophy = {};
    meso.loadingPhilosophy.dup = 'same_lift_weekly_rotation';
    meso.loadingPhilosophy.notes =
      (meso.loadingPhilosophy.notes || '') +
      ' Same-lift DUP: early-week strength exposure, mid/late-week power or hypertrophy undulation.';
  }
  return report;
}

function applyHypertrophyDup(data) {
  const report = [];
  for (const meso of data.macrocycle.mesocycles || []) {
    const days = meso.microcycle || [];
    const occurrences = {};
    for (const day of days) {
      for (const b of day.blocks || []) {
        for (const e of b.exercises || []) {
          if (e.name === 'Barbell Hip Thrust') {
            occurrences[day.day] = e;
          }
        }
      }
    }
    const dayNums = Object.keys(occurrences).map(Number).sort((a, b) => a - b);
    if (dayNums.length < 2) continue;
    const first = occurrences[dayNums[0]];
    const second = occurrences[dayNums[1]];
    first.sets = 3;
    first.reps = 6;
    first.intensity = '70-75% 1RM';
    first.targetRPE = 8;
    first.notes = 'DUP strength emphasis: heavier hip thrust, controlled reps.';
    second.sets = 3;
    second.reps = 10;
    second.intensity = '60-65% 1RM';
    second.targetRPE = 7;
    second.notes = 'DUP hypertrophy emphasis: higher reps, smooth tempo, 2-3 RIR.';
    report.push(meso.id + ': Barbell Hip Thrust D' + dayNums[0] + ' strength / D' + dayNums[1] + ' hypertrophy');
    ensureCue(days.find((d) => d.day === dayNums[0]), 'DUP: strength stimulus for Hip Thrust.');
    ensureCue(days.find((d) => d.day === dayNums[1]), 'DUP: hypertrophy stimulus for Hip Thrust.');
  }
  return report;
}

function addRugbyDupSecondary(data) {
  const report = [];
  for (const meso of data.macrocycle.mesocycles || []) {
    const d1 = (meso.microcycle || []).find((d) => d.day === 1);
    // Prefer day 4 (often olympic/tempo); else day 2
    let target = (meso.microcycle || []).find((d) => d.day === 4);
    if (!target || /rest|recover/i.test(target.title || '')) {
      target = (meso.microcycle || []).find((d) => d.day === 2);
    }
    if (!d1 || !target || /rest|recover/i.test(target.title || '')) continue;

    // Collect day1 main compounds
    const mains = [];
    for (const b of d1.blocks || []) {
      if (/warm|cool|raise|activate|mobilize|potentiate|stretch|foam|accessory|condition|running/i.test(b.name || '')) continue;
      if (!/main|strength|deadlift/i.test(b.name || '')) continue;
      for (const e of b.exercises || []) {
        if (/^(Back Squat|Bench Press|Deadlift)$/i.test(e.name || '')) mains.push(e.name);
      }
    }
    if (!mains.length) continue;

    // Remove prior DUP Secondary if re-running
    target.blocks = (target.blocks || []).filter((b) => !/^DUP Secondary/i.test(b.name || ''));

    const dupExercises = mains.map((name) => ({
      name,
      trackingMode: '1RM',
      sets: 3,
      reps: 3,
      intensity: '60% 1RM',
      targetRPE: 6,
      rest: 90,
      instruction: 'DUP secondary exposure: move explosively with crisp technique.',
      definition: 'Same-lift weekly undulation (power/speed) to vary tendon stress without junk volume.',
      notes:
        'DUP power/speed: bar speed first. Stop if grind appears. Optional clusters: 1+1+1 with 15-20s rest.',
      substitutions: [],
    }));

    // Insert before cool-down / stretching if present
    let insertAt = target.blocks.length;
    for (let i = 0; i < target.blocks.length; i++) {
      if (/cool|stretch|foam/i.test(target.blocks[i].name || '')) {
        insertAt = i;
        break;
      }
    }
    target.blocks.splice(insertAt, 0, {
      name: 'DUP Secondary (Power)',
      exercises: dupExercises,
    });

    ensureCue(d1, 'DUP: primary strength exposure for main lifts.');
    ensureCue(target, 'DUP: secondary power/speed exposure for the same main lifts.');

    // Weekly overlays for secondary: week2 hypertrophy, week3 strength-speed, week4 deload light
    meso.weeklyAdjustments = meso.weeklyAdjustments || {};
    const dayKey = 'day' + target.day;
    const ensureWeek = (wk) => {
      meso.weeklyAdjustments[wk] = meso.weeklyAdjustments[wk] || {};
      meso.weeklyAdjustments[wk][dayKey] = meso.weeklyAdjustments[wk][dayKey] || { exercises: {} };
      meso.weeklyAdjustments[wk][dayKey].exercises = meso.weeklyAdjustments[wk][dayKey].exercises || {};
      return meso.weeklyAdjustments[wk][dayKey].exercises;
    };

    for (const name of mains) {
      ensureWeek('week2')[name] = { sets: 3, reps: 8, intensity: '65% 1RM', targetRPE: 7, notes: 'DUP secondary hypertrophy undulation this week.' };
      ensureWeek('week3')[name] = { sets: 3, reps: 5, intensity: '70% 1RM', targetRPE: 7, notes: 'DUP secondary strength-speed undulation this week.' };
      ensureWeek('week4')[name] = { sets: 2, reps: 3, intensity: '55% 1RM', targetRPE: 5, notes: 'DUP secondary deload / technique only.' };
    }

    if (!meso.loadingPhilosophy) meso.loadingPhilosophy = {};
    meso.loadingPhilosophy.dup = 'same_lift_weekly_rotation';
    meso.loadingPhilosophy.notes =
      (meso.loadingPhilosophy.notes || '') +
      ' Same-lift DUP via Day1 strength + mid-week DUP Secondary (power/hypertrophy/strength-speed by week).';

    report.push(meso.id + ': added DUP Secondary on D' + target.day + ' for ' + mains.join(', '));
  }
  return report;
}

function applySimpleDup(data) {
  const report = [];
  for (const meso of data.macrocycle.mesocycles || []) {
    const d1 = (meso.microcycle || []).find((d) => d.day === 1);
    const d5 = (meso.microcycle || []).find((d) => d.day === 5);
    if (!d1 || !d5) continue;

    // If D5 is Full Body, add light Bench / hinge DUP if those lifts exist on D1
    const d1Lifts = [];
    for (const b of d1.blocks || []) {
      for (const e of b.exercises || []) {
        if (/^Bench Press$/i.test(e.name)) d1Lifts.push('Bench Press');
        if (/Romanian Deadlift/i.test(e.name)) d1Lifts.push('Romanian Deadlift');
      }
    }
    if (!d1Lifts.length) continue;

    d5.blocks = (d5.blocks || []).filter((b) => !/^DUP Secondary/i.test(b.name || ''));
    const exercises = [];
    if (d1Lifts.includes('Bench Press')) {
      exercises.push({
        name: 'Bench Press',
        trackingMode: '1RM',
        sets: 3,
        reps: 3,
        intensity: '60% TM',
        targetRPE: 6,
        rest: 90,
        instruction: 'DUP secondary: explosive press, crisp lockout.',
        definition: 'Same-lift weekly power undulation.',
        notes: 'DUP power: speed over load. Leave 3+ RIR.',
        substitutions: [],
      });
    }
    if (d1Lifts.includes('Romanian Deadlift')) {
      exercises.push({
        name: 'Romanian Deadlift',
        trackingMode: '1RM',
        sets: 3,
        reps: 8,
        intensity: 'RPE 7',
        targetRPE: 7,
        rest: 90,
        instruction: 'DUP secondary hinge volume: controlled eccentric.',
        definition: 'Same-lift weekly hypertrophy undulation.',
        notes: 'DUP volume: smooth reps, 2-3 RIR.',
        substitutions: [],
      });
    }
    if (!exercises.length) continue;

    let insertAt = d5.blocks.length;
    for (let i = 0; i < d5.blocks.length; i++) {
      if (/cool|stretch/i.test(d5.blocks[i].name || '')) {
        insertAt = i;
        break;
      }
    }
    d5.blocks.splice(insertAt, 0, { name: 'DUP Secondary', exercises });
    ensureCue(d1, 'DUP: primary strength exposure.');
    ensureCue(d5, 'DUP: secondary power/volume exposure for repeated lifts.');
    report.push(meso.id + ': DUP Secondary on D5 for ' + exercises.map((e) => e.name).join(', '));
  }
  return report;
}

function run(file, fn, label) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = fn(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('\n' + label);
  report.forEach((l) => console.log(' ', l));
}

run('src/data/FitnessProgram.json', applyFitnessDup, 'Fitness DUP');
run('src/data/HypertrophyMonth.json', applyHypertrophyDup, 'Hypertrophy DUP');
run('src/data/rugbyProgram.json', addRugbyDupSecondary, 'Rugby DUP');
run('src/data/simpleweightProgram.json', applySimpleDup, 'Simple DUP');
console.log('\nDone');
