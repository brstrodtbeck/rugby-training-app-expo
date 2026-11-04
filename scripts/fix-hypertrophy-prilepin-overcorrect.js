/**
 * Fix hypertrophy over-correction: keep hypertrophy rep ranges at lower % bands.
 * Also ensure targetRPE remains set.
 */
const fs = require('fs');

const fixes = {
  // name match helpers applied per day
};

function fixProgram() {
  const file = 'src/data/HypertrophyMonth.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = [];

  const restore = [
    // Prefer hypertrophy-safe: 8-10 reps @ 60-65% (Prilepin-friendly) rather than strength triples
    { week: 'week1', day: 1, name: 'Back Squat', sets: 3, reps: 10, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week1', day: 1, name: 'Barbell Hip Thrust', sets: 3, reps: 10, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week1', day: 2, name: 'Bench Press', sets: 3, reps: 10, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week1', day: 3, name: 'Barbell Hip Thrust', sets: 3, reps: 10, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week1', day: 3, name: 'Hang Clean', sets: 3, reps: 3, intensity: '65-70% 1RM', targetRPE: 7, notes: 'Power technique: low reps. Safe cluster option: singles with 15-20s rest.' },
    { week: 'week2', day: 2, name: 'Incline BB Press', sets: 3, reps: 10, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week3', day: 3, name: 'Deadlift to RDL', sets: 3, reps: 8, intensity: '65-70% 1RM', targetRPE: 7 },
    { week: 'week4', day: 2, name: 'Bench Press 1 + 1/2 Rep', sets: 3, reps: 8, intensity: '60-65% 1RM', targetRPE: 7 },
    { week: 'week4', day: 3, name: 'Hex Bar Deadlift', sets: 3, reps: 8, intensity: '65-70% 1RM', targetRPE: 7 },
  ];

  for (const meso of data.macrocycle.mesocycles || []) {
    for (const day of meso.microcycle || []) {
      for (const block of day.blocks || []) {
        for (const ex of block.exercises || []) {
          const match = restore.find(
            (r) => r.week === meso.id && r.day === day.day && r.name === ex.name
          );
          if (match) {
            ex.sets = match.sets;
            ex.reps = match.reps;
            ex.intensity = match.intensity;
            ex.targetRPE = match.targetRPE;
            if (match.notes) {
              ex.notes = match.notes;
            } else if (ex.notes && /Prilepin.*RPE/i.test(ex.notes)) {
              // replace strength-oriented prilepin note
              ex.notes = ex.notes.replace(/Safe loading \(Prilepin\):[^.]*\./g, '').trim();
              ex.notes = (ex.notes ? ex.notes + ' ' : '') +
                'Hypertrophy loading: 60-70% zone with controlled volume (Prilepin-safe). Target RPE ~7; leave 2-3 reps in reserve.';
            }
            report.push(meso.id + ' D' + day.day + ' ' + ex.name + ' -> ' + match.sets + 'x' + match.reps + ' @ ' + match.intensity);
          } else if (ex.targetRPE == null && /%/.test(ex.intensity || '')) {
            // soft default for remaining hypertrophy mains
            if (/squat|deadlift|press|row|thrust|clean/i.test(ex.name || '')) {
              ex.targetRPE = 7;
            }
          }
        }
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Hypertrophy restores:');
  report.forEach((l) => console.log(' ', l));
}

fixProgram();
