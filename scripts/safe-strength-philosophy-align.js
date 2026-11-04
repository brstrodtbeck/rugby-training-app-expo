/**
 * Safe strength philosophy alignment:
 * - Cap main-lift volume to Prilepin ranges
 * - Add targetRPE from intensity zone (autoregulation guidance)
 * - Add safe cluster notes on power/olympic heavy singles-triples
 * - Light DUP cues via sessionIntent on multi-stimulus days
 * - Preserve mesocycle LP structure
 */
const fs = require('fs');

const PRILEPIN = [
  { min: 50, max: 65, setMax: 6, totMax: 30, totOpt: 24, targetRPE: 6 },
  { min: 66, max: 75, setMax: 6, totMax: 24, totOpt: 18, targetRPE: 7 },
  { min: 76, max: 85, setMax: 4, totMax: 20, totOpt: 15, targetRPE: 8 },
  { min: 86, max: 95, setMax: 3, totMax: 10, totOpt: 7, targetRPE: 9 },
];

const MAIN_LIFTS =
  /^(back squat|front squat|pause squat|box squat|deadlift|trap bar deadlift|hex bar deadlift|romanian deadlift|stiff.?leg deadlift|bench press|incline (bb |barbell )?press|overhead press|military press|push press|power clean|hang clean|clean|snatch|power snatch|bent-?over row|barbell row|hip thrust|barbell hip thrust)/i;

function parsePct(intensity) {
  if (!intensity || typeof intensity !== 'string') return null;
  if (/hrmax|zone|rpe|easy|heavy|light|moderate/i.test(intensity) && !/%/.test(intensity)) return null;
  const m = intensity.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—)?\s*(\d+(?:\.\d+)?)?\s*%/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = m[2] ? parseFloat(m[2]) : a;
  return (a + b) / 2;
}

function zoneFor(pct) {
  return PRILEPIN.find((z) => pct >= z.min && pct <= z.max) || null;
}

function rpeFromPct(pct) {
  const z = zoneFor(pct);
  return z ? z.targetRPE : null;
}

function prilepinSafeScheme(pct, sets, reps) {
  const z = zoneFor(pct);
  if (!z) return null;
  const total = sets * reps;
  const needsFix = reps > z.setMax || total > z.totMax;
  if (!needsFix) return null;

  if (pct >= 76 && pct <= 85) {
    if (reps >= 5) {
      return { sets: Math.min(sets, 5), reps: 3, reason: 'Prilepin heavy zone: reduce to triples' };
    }
    if (total > z.totMax) {
      const newSets = Math.max(3, Math.floor(z.totOpt / Math.max(reps, 1)));
      return { sets: newSets, reps, reason: 'Prilepin: total reps capped' };
    }
  }

  if (pct >= 86) {
    return { sets: Math.min(sets, 4), reps: Math.min(reps, 2), reason: 'Prilepin >85%: doubles/singles only' };
  }

  if (pct >= 66 && pct <= 75 && total > z.totMax) {
    if (reps === 5 && sets === 5) return { sets: 4, reps: 5, reason: 'Prilepin: 5x5 -> 4x5 at 70-75%' };
    return { sets: Math.min(sets, 4), reps: Math.min(reps, 5), reason: 'Prilepin volume cap' };
  }

  if (total > z.totMax) {
    return { sets: Math.min(sets, 5), reps: Math.min(reps, 6), reason: 'Prilepin volume cap' };
  }

  if (reps > z.setMax) {
    return { sets, reps: z.setMax, reason: 'Prilepin reps/set cap' };
  }

  return null;
}

function numericReps(reps) {
  if (typeof reps === 'number') return reps;
  if (typeof reps === 'string' && /^\d+$/.test(reps.trim())) return parseInt(reps, 10);
  return null;
}

function applyToExercise(ex, context, report) {
  if (!MAIN_LIFTS.test(ex.name || '')) return false;

  const pct = parsePct(ex.intensity);
  const sets = ex.sets || 0;
  const reps = numericReps(ex.reps);

  if (pct != null) {
    const rpe = rpeFromPct(pct);
    if (rpe != null && ex.targetRPE == null) {
      ex.targetRPE = rpe;
      report.rpeAdded++;
    }

    if (sets && reps) {
      const fix = prilepinSafeScheme(pct, sets, reps);
      if (fix) {
        report.prilepinFixes.push(
          context + ' ' + ex.name + ': ' + sets + 'x' + reps + ' @ ' + ex.intensity + ' -> ' + fix.sets + 'x' + fix.reps
        );
        ex.sets = fix.sets;
        ex.reps = fix.reps;
        const note = 'Safe loading (Prilepin): stop short of grinders; target ~RPE ' + (ex.targetRPE || rpe) + '.';
        if (!ex.notes || !/Prilepin/i.test(ex.notes)) {
          ex.notes = ex.notes ? ex.notes + ' ' + note : note;
        }
      }
    }

    if (
      pct >= 80 &&
      reps != null &&
      reps <= 3 &&
      /clean|snatch|jerk|push press/i.test(ex.name || '')
    ) {
      if (!ex.notes || !/cluster/i.test(ex.notes)) {
        ex.notes = (ex.notes ? ex.notes + ' ' : '') +
          'Safe cluster option: split as singles/doubles with 15-20s intra-set rest to keep bar speed high.';
        report.clustersTagged++;
      }
    }
  }

  if (/rpe\s*(\d+)/i.test(ex.intensity || '')) {
    const m = ex.intensity.match(/rpe\s*(\d+)/i);
    if (m && ex.targetRPE == null) {
      ex.targetRPE = parseInt(m[1], 10);
      report.rpeAdded++;
    }
  }

  return true;
}

function processProgram(file, label) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = { prilepinFixes: [], rpeAdded: 0, clustersTagged: 0, dupNotes: 0, overlayFixes: 0 };

  for (const meso of data.macrocycle.mesocycles || []) {
    if (!meso.loadingPhilosophy) {
      meso.loadingPhilosophy = {
        primary: 'linear_block_periodization',
        volumeModel: 'prilepin_guided',
        autoregulation: 'readiness_plus_targetRPE',
        notes:
          'Intensity progresses linearly within the block. Use target RPE and session readiness to autoregulate. Main-lift volume follows Prilepin-safe ranges.',
      };
      report.dupNotes++;
    }

    for (const day of meso.microcycle || []) {
      const isPowerDay = /power|plyo|olympic|contrast|explosive/i.test(day.title || '');
      const isStrengthDay = /strength|squat|deadlift|bench|upper|lower|heavy/i.test(day.title || '');
      if ((isPowerDay || isStrengthDay) && !day.sessionIntent) {
        day.sessionIntent = isPowerDay
          ? 'DUP stimulus today: power/velocity focus — keep loads crisp, leave 1-2 reps in reserve.'
          : 'DUP stimulus today: strength focus — controlled heavy sets within target RPE; no junk volume.';
        report.dupNotes++;
      }

      for (const block of day.blocks || []) {
        if (/warm|cool|raise|activate|mobilize|potentiate|stretch|foam|mobility|recovery|cardio/i.test(block.name || '')) continue;
        for (const ex of block.exercises || []) {
          applyToExercise(ex, meso.id + ' D' + day.day + ' [' + day.title + ']', report);
          if (
            isPowerDay &&
            /clean|snatch|jerk/i.test(ex.name || '') &&
            numericReps(ex.reps) != null &&
            numericReps(ex.reps) <= 3 &&
            (!ex.notes || !/cluster/i.test(ex.notes))
          ) {
            ex.notes = (ex.notes ? ex.notes + ' ' : '') +
              'Safe cluster option: singles/doubles with 15-20s rest between reps.';
            report.clustersTagged++;
          }
        }
      }
    }

    const wa = meso.weeklyAdjustments || {};
    for (const [weekKey, weekVal] of Object.entries(wa)) {
      if (!weekVal || typeof weekVal !== 'object') continue;
      for (const [dayKey, dayVal] of Object.entries(weekVal)) {
        if (!dayKey.startsWith('day') || !dayVal || !dayVal.exercises) continue;
        for (const [exName, adj] of Object.entries(dayVal.exercises)) {
          if (!MAIN_LIFTS.test(exName)) continue;
          const dayNum = parseInt(dayKey.replace('day', ''), 10);
          const day = (meso.microcycle || []).find((d) => d.day === dayNum);
          let base = null;
          if (day) {
            for (const b of day.blocks || []) {
              base = (b.exercises || []).find((e) => e.name === exName);
              if (base) break;
            }
          }
          const intensity = adj.intensity != null ? adj.intensity : base && base.intensity;
          const sets = adj.sets != null ? adj.sets : base && base.sets;
          const reps = numericReps(adj.reps != null ? adj.reps : base && base.reps);
          const pct = parsePct(intensity);
          if (pct == null || !sets || !reps) {
            if (pct != null && adj.targetRPE == null) {
              adj.targetRPE = rpeFromPct(pct);
              report.rpeAdded++;
            }
            continue;
          }
          const fix = prilepinSafeScheme(pct, sets, reps);
          if (fix) {
            adj.sets = fix.sets;
            adj.reps = fix.reps;
            if (adj.targetRPE == null) adj.targetRPE = rpeFromPct(pct);
            report.overlayFixes++;
            report.prilepinFixes.push(
              meso.id + ' ' + weekKey + ' ' + dayKey + ' ' + exName + ': overlay -> ' + fix.sets + 'x' + fix.reps + ' @ ' + intensity
            );
          } else if (adj.targetRPE == null) {
            adj.targetRPE = rpeFromPct(pct);
            report.rpeAdded++;
          }
        }
      }
    }
  }

  if (!data.rpeGuardrails) {
    data.rpeGuardrails = {
      description: 'Autoregulation targets aligned to Prilepin intensity zones',
      zones: [
        { intensity: '50-65%', targetRPE: '5-6', note: 'Technique / hypertrophy volume' },
        { intensity: '66-75%', targetRPE: '6.5-7.5', note: 'Strength-endurance / accumulation' },
        { intensity: '76-85%', targetRPE: '7.5-8.5', note: 'Heavy strength — controlled volume' },
        { intensity: '86-95%', targetRPE: '8.5-9.5', note: 'High intensity — low volume only' },
      ],
      rule: 'If readiness is low or bar speed dies, reduce load 5-10% rather than grinding. Never exceed Prilepin max total reps for the intensity zone.',
    };
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('\n=== ' + label + ' ===');
  console.log('Prilepin fixes: ' + report.prilepinFixes.length);
  report.prilepinFixes.forEach((l) => console.log('  ' + l));
  console.log('targetRPE added: ' + report.rpeAdded);
  console.log('cluster tags: ' + report.clustersTagged);
  console.log('overlay fixes: ' + report.overlayFixes);
  console.log('session/philosophy notes: ' + report.dupNotes);
}

processProgram('src/data/rugbyProgram.json', 'Rugby');
processProgram('src/data/FitnessProgram.json', 'Fitness');
processProgram('src/data/HypertrophyMonth.json', 'Hypertrophy');
processProgram('src/data/simpleweightProgram.json', 'Simple');
console.log('\nDone.');
