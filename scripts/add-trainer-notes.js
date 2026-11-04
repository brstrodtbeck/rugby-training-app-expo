/**
 * Add trainerNotes to Foam Rolling and stretch sequences in FitnessProgram.json
 */
const fs = require('fs');
const path = require('path');

const programPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));

const FOAM_ROLLING_NOTES = 'Roll before stretching for best results. Pause on tender spots 20–30 seconds.';
const LOWER_BODY_STRETCHES_NOTES = 'Breathe into each stretch. Hold 30–60 seconds; avoid bouncing.';
const BRIEF_STRETCHING_NOTES = 'Breathe into each stretch. Hold 30–60 seconds; avoid bouncing.';

let count = 0;

function addNotes(ex) {
  if (!ex || !ex.name) return;
  if (ex.name === 'Foam Rolling' || ex.name === 'Foam Rolling - Upper Body') {
    if (!ex.trainerNotes) {
      ex.trainerNotes = FOAM_ROLLING_NOTES;
      count++;
    }
  } else if (ex.name === 'Lower Body Stretches') {
    if (!ex.trainerNotes) {
      ex.trainerNotes = LOWER_BODY_STRETCHES_NOTES;
      count++;
    }
  } else if (ex.name === 'Brief Stretching') {
    if (!ex.trainerNotes) {
      ex.trainerNotes = BRIEF_STRETCHING_NOTES;
      count++;
    }
  }
}

function walk(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(item => walk(item));
    return;
  }
  if (obj.blocks) {
    obj.blocks.forEach(block => {
      if (block.exercises) block.exercises.forEach(ex => { addNotes(ex); walk(ex); });
      walk(block);
    });
    return;
  }
  if (obj.exercisesGroup?.exercises) {
    obj.exercisesGroup.exercises.forEach(walk);
  }
}

const macro = program.macrocycle;
if (macro?.mesocycles) {
  macro.mesocycles.forEach(m => {
    if (m.microcycle) {
      m.microcycle.forEach(day => {
        if (day.blocks) {
          day.blocks.forEach(block => {
            if (block.exercises) {
              block.exercises.forEach(ex => { addNotes(ex); walk(ex); });
            }
            walk(block);
          });
        }
      });
    }
  });
}

fs.writeFileSync(programPath, JSON.stringify(program, null, 2), 'utf8');
console.log(`Added trainerNotes to ${count} blocks.`);
