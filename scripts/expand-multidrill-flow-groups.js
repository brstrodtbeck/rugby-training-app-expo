/**
 * Converts multi-drill exercises (Dynamic Mobility, Activation, Foam Rolling, etc.)
 * to flow groups so they expand into individual drill sequences.
 * Run: node scripts/expand-multidrill-flow-groups.js
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Maps instruction substring -> exercisesGroup config { name, exercises: FlowExercise[] }
const CONVERSIONS = {
  // Dynamic Mobility variants
  'Leg swings (10 each), arm circles (10 each direction), hip circles (10 each)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Dynamic Mobility Drills',
      exercises: [
        { name: 'Leg Swings', reps: '10 each direction', duration: '1 min' },
        { name: 'Arm Circles', reps: '10 each direction', duration: '1 min' },
        { name: 'Hip Circles', reps: '10 each', duration: '1 min' }
      ]
    }
  },
  'Arm circles (10 each direction), shoulder rolls (10 each), thoracic rotations (10 each side)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Upper Body Mobility',
      exercises: [
        { name: 'Arm Circles', reps: '10 each direction', duration: '1 min' },
        { name: 'Shoulder Rolls', reps: '10 each', duration: '1 min' },
        { name: 'Thoracic Rotations', reps: '10 each side', duration: '1 min' }
      ]
    }
  },
  'Hip circles (10 each direction), leg swings front-back and side-side (10 each), deep squat hold (30-60s), 90/90 hip switches (8 each), thoracic rotations (10 each), ankle rocks (10 each)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Lower Body Mobility',
      exercises: [
        { name: 'Hip Circles', reps: '10 each direction', duration: '45s' },
        { name: 'Leg Swings Front-Back', reps: '10 each', duration: '45s' },
        { name: 'Leg Swings Side-Side', reps: '10 each', duration: '45s' },
        { name: 'Deep Squat Hold', duration: '30-60s' },
        { name: '90/90 Hip Switches', reps: '8 each side', duration: '45s' },
        { name: 'Thoracic Rotations', reps: '10 each side', duration: '45s' },
        { name: 'Ankle Rocks', reps: '10 each', duration: '45s' }
      ]
    }
  },
  'High knees (30s), butt kicks (30s), leg swings (10 each), arm circles (10 each direction)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Circuit Warm-Up Drills',
      exercises: [
        { name: 'High Knees', duration: '30s' },
        { name: 'Butt Kicks', duration: '30s' },
        { name: 'Leg Swings', reps: '10 each', duration: '45s' },
        { name: 'Arm Circles', reps: '10 each direction', duration: '45s' }
      ]
    }
  },
  // Activation variants
  'Glute bridges (10), bodyweight squats (10)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Activation Drills',
      exercises: [
        { name: 'Glute Bridges', reps: '10', duration: '1 min' },
        { name: 'Bodyweight Squats', reps: '10', duration: '1 min' }
      ]
    }
  },
  'Bodyweight squats (10), push-up hold (20s), glute bridges (10)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Circuit Activation',
      exercises: [
        { name: 'Bodyweight Squats', reps: '10', duration: '1 min' },
        { name: 'Push-up Hold', duration: '20s' },
        { name: 'Glute Bridges', reps: '10', duration: '1 min' }
      ]
    }
  },
  // Foam Rolling variants
  'Roll quads (1 min each), glutes (1 min), lats (1 min each), thoracic spine (1 min). Pause on tender spots. Do before stretching.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Foam Rolling',
      exercises: [
        { name: 'Quads', duration: '1 min each' },
        { name: 'Glutes', duration: '1 min' },
        { name: 'Lats', duration: '1 min each' },
        { name: 'Thoracic Spine', duration: '1 min' }
      ]
    }
  },
  'Roll quads (1 min each), IT band (1 min each), glutes (1 min), lats (1 min each), thoracic spine (1 min). Pause on tender spots.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Foam Rolling',
      exercises: [
        { name: 'Quads', duration: '1 min each' },
        { name: 'IT Band', duration: '1 min each' },
        { name: 'Glutes', duration: '1 min' },
        { name: 'Lats', duration: '1 min each' },
        { name: 'Thoracic Spine', duration: '1 min' }
      ]
    }
  },
  'Roll quads (1 min each), IT band (1 min each), glutes (1 min), lats (1 min each), thoracic spine (1 min). Pause on tender spots. Do before stretching.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Foam Rolling',
      exercises: [
        { name: 'Quads', duration: '1 min each' },
        { name: 'IT Band', duration: '1 min each' },
        { name: 'Glutes', duration: '1 min' },
        { name: 'Lats', duration: '1 min each' },
        { name: 'Thoracic Spine', duration: '1 min' }
      ]
    }
  },
  'Roll lats (1 min each side), thoracic spine (1 min), chest/pec minor (1 min). Pause on tender spots. Do before stretching.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Upper Body Foam Rolling',
      exercises: [
        { name: 'Lats', duration: '1 min each side' },
        { name: 'Thoracic Spine', duration: '1 min' },
        { name: 'Chest/Pec Minor', duration: '1 min' }
      ]
    }
  },
  // Lower Body Stretches
  'Hamstring stretch (1 min each side), quad stretch (1 min each), hip flexor stretch (1 min each). Hold each 30-60 seconds.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Lower Body Stretches',
      exercises: [
        { name: 'Hamstring Stretch', duration: '1 min each side' },
        { name: 'Quad Stretch', duration: '1 min each' },
        { name: 'Hip Flexor Stretch', duration: '1 min each' }
      ]
    }
  },
  // Brief Stretching
  'Hamstring, hip flexor, chest stretches - hold 30-60 sec each. Focus on areas worked.': {
    flowGroupType: 'recovery',
    exercisesGroup: {
      name: 'Brief Stretching',
      exercises: [
        { name: 'Hamstring Stretch', duration: '30-60 sec each' },
        { name: 'Hip Flexor Stretch', duration: '30-60 sec each' },
        { name: 'Chest Stretch', duration: '30-60 sec each' }
      ]
    }
  },
  // Dynamic Activation variants
  'Bodyweight squats (10), arm circles (10 each direction), leg swings (10 each)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Dynamic Activation',
      exercises: [
        { name: 'Bodyweight Squats', reps: '10', duration: '1 min' },
        { name: 'Arm Circles', reps: '10 each direction', duration: '1 min' },
        { name: 'Leg Swings', reps: '10 each', duration: '1 min' }
      ]
    }
  },
  'Bodyweight squats (10), leg swings (10 each), arm circles (10 each direction)': {
    flowGroupType: 'mobility',
    exercisesGroup: {
      name: 'Dynamic Activation',
      exercises: [
        { name: 'Bodyweight Squats', reps: '10', duration: '1 min' },
        { name: 'Leg Swings', reps: '10 each', duration: '1 min' },
        { name: 'Arm Circles', reps: '10 each direction', duration: '1 min' }
      ]
    }
  }
};

function convertExercise(ex) {
  if (!ex || typeof ex !== 'object') return false;
  if (ex.isFlowGroup && (ex.exercisesGroup || ex.flowSteps)) return false; // Already a flow
  const inst = (ex.instruction || '').trim();
  if (!inst) return false;

  const entries = Object.entries(CONVERSIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, config] of entries) {
    if (inst === key || inst.includes(key)) {
      ex.isFlowGroup = true;
      ex.flowGroupType = config.flowGroupType;
      ex.exercisesGroup = {
        ...config.exercisesGroup,
        duration: ex.duration || config.exercisesGroup.duration
      };
      if (!ex.sets && ex.trackingMode === 'time') ex.sets = 1;
      return true;
    }
  }
  return false;
}

function processBlock(block) {
  if (!block?.exercises) return 0;
  let n = 0;
  for (const ex of block.exercises) {
    if (convertExercise(ex)) {
      n++;
      console.log('Converted:', ex.name);
    }
  }
  return n;
}

let total = 0;
const macro = data.macrocycle;
if (macro?.mesocycles) {
  for (const mc of macro.mesocycles) {
    const micro = mc.microcycle;
    if (!Array.isArray(micro)) continue;
    for (const day of micro) {
      const blocks = day.blocks;
      if (Array.isArray(blocks)) {
        for (const block of blocks) total += processBlock(block);
      } else if (blocks && typeof blocks === 'object') {
        for (const key of Object.keys(blocks)) {
          const b = blocks[key];
          if (b && typeof b === 'object' && Array.isArray(b.exercises)) total += processBlock(b);
        }
      }
    }
  }
}

console.log('\nTotal converted:', total);
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Saved', jsonPath);
