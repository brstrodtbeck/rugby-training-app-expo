/**
 * Replace generic formCues with context-specific cues for mobility, foam rolling,
 * stretching, light cardio, and recovery exercises.
 */
const fs = require('fs');
const path = require('path');

const programPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));

const GENERIC_CUES = [
  'Set up with proper positioning',
  'Brace core for stability',
  'Control the movement',
  'Feel target muscles working',
  'Maintain proper alignment',
  'Complete full range of motion',
  'Control the entire movement',
  'Focus on quality over speed'
];

function isGenericCues(cues) {
  if (!Array.isArray(cues) || cues.length !== 8) return false;
  return GENERIC_CUES.every((c, i) => cues[i] === c);
}

const CUE_MAP = {
  'Light Cardio': ['Easy pace', 'Maintain conversational pace', 'Gradually elevate heart rate'],
  'Easy Cardio': ['Easy pace', 'Gradually bring heart rate down', 'Walk or light bike'],
  'Zone 2 Cardio': ['Easy pace', 'Maintain conversational pace', 'Consistent steady effort'],
  'Zone 1 Cardio': ['Easy pace', 'Very light effort', 'Recovery focus'],
  'Cardio': ['Easy pace', 'Maintain conversational pace'],
  'Dynamic Mobility': ['Controlled movement', 'Breathe deeply', 'Increase range gradually', 'Quality over quantity'],
  'Activation': ['Controlled movement', 'Focus on muscle engagement', 'Quality over quantity'],
  'Mobility Flow': ['Breathe into each position', 'Controlled movement', 'Increase range gradually', 'Quality over intensity'],
  'Extended Mobility': ['Breathe into each position', 'Controlled movement', 'Hold 30-60 seconds', 'Quality over intensity'],
  'Easy Movement': ['Easy pace', 'Maintain conversational pace', 'Light effort'],
  'Breathing Reset': ['Relax completely', '4-count inhale, 6-count exhale', 'Let tension release'],
  'Lower Body Stretches': ['Breathe into each stretch', 'Avoid bouncing', 'Hold 30-60 seconds', 'Mild tension, not pain'],
  'Brief Stretching': ['Breathe into each stretch', 'Avoid bouncing', 'Hold 30-60 seconds', 'Mild tension, not pain'],
  'Foam Rolling': ['Roll slowly, don\'t rush', 'Pause 20-30 seconds on tender spots', 'Breathe deeply throughout', 'Avoid direct bone contact'],
  'Foam Rolling - Upper Body': ['Roll slowly, don\'t rush', 'Pause 20-30 seconds on tender spots', 'Breathe deeply throughout', 'Avoid direct bone contact'],
  'Deep Squat Hold': ['Heels down', 'Breathe into hips', 'Chest tall', 'Increase range gradually'],
  'Deep Squat Hold + Reach': ['Heels down', 'Breathe into hips', 'Reach to open thoracic', 'Increase range gradually'],
  '90/90 Hip Switches': ['Controlled movement', 'Breathe through transitions', 'Quality over speed'],
  '90/90 Hip Switches (8 each)': ['Controlled movement', 'Breathe through transitions', 'Quality over speed'],
  'Cat-Cow': ['Articulate through spine', 'Breathe with movement', 'Controlled tempo'],
  'Child\'s Pose with Side Reach': ['Reach both arms', 'Breathe into side body', 'Relax shoulders'],
  'Banded Shoulder Openers': ['Control band tension', 'Squeeze shoulder blades', 'Breathe through stretch'],
  'Hamstring Stretch': ['Hinge at hips', 'Keep back flat', 'Breathe into stretch', 'Avoid bouncing'],
  'Thoracic Rotations': ['Rotate through mid-back', 'Keep hips stable', 'Breathe through movement'],
  'Ankle Rocks': ['Rock forward and back', 'Keep heel down', 'Controlled movement'],
  'KB Arm Bar': ['Shoulder packed', 'Slow controlled roll', 'Breathe throughout'],
  'Piriformis/Glute Stretch': ['Breathe into stretch', 'Avoid bouncing', 'Hold 30-60 seconds', 'Ease off if nerve symptoms'],
  'Hip Flexor Stretch': ['Squeeze glute', 'Half-kneeling', 'Breathe into stretch', 'Avoid bouncing'],
  'Quad Stretch': ['Pull heel to glute', 'Stand tall', 'Breathe into stretch', 'Avoid bouncing'],
  'Chest/Shoulder Stretch': ['Arm at 90 degrees', 'Doorway or corner', 'Breathe into stretch', 'Avoid bouncing'],
  'Chest Stretch': ['Arm at 90 degrees', 'Breathe into stretch', 'Avoid bouncing'],
  'Upper Body Mobility Flow': ['Breathe into each position', 'Controlled movement', 'Focus on shoulders and thoracic'],
  'Light Cardio Warm-Up': ['Very easy pace', 'Conversational', 'Gradual warm-up'],
  'Cooldown': ['Gradually reduce intensity', 'Easy pace', 'Let heart rate come down'],
  'Mobility Work': ['Focus on tight areas', 'Breathe deeply', 'Controlled movement', 'Quality over intensity'],
  'Light Movement': ['Easy pace', 'Gradually lower heart rate', 'Effortless effort'],
  'Easy Movement': ['Easy pace', 'Maintain conversational pace', 'Light effort'],
  'Zone 2 Pace': ['Easy pace', 'Maintain conversational pace', 'Sustainable effort'],
  'Row or Bike': ['Maintain steady cadence', 'Posture tall', 'Drive through legs']
};

let count = 0;

function walk(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(item => walk(item));
    return;
  }
  if (obj.blocks) {
    obj.blocks.forEach(block => {
      if (block.exercises) block.exercises.forEach(ex => replaceCues(ex));
      walk(block);
    });
    return;
  }
  if (obj.exercisesGroup?.exercises) walk(obj.exercisesGroup.exercises);
}

function replaceCues(ex) {
  if (!ex?.formCues || !isGenericCues(ex.formCues)) return;
  const replacement = CUE_MAP[ex.name];
  if (replacement) {
    ex.formCues = replacement;
    count++;
  } else {
    // Fallback for mobility/stretch-like by instruction/definition
    const def = (ex.definition || '').toLowerCase();
    const inst = (ex.instruction || '').toLowerCase();
    const name = (ex.name || '').toLowerCase();
    if (def.includes('mobility') || def.includes('stretch') || inst.includes('stretch') ||
        def.includes('cardio') || def.includes('heart rate') || name.includes('mobility') ||
        name.includes('stretch') || name.includes('cardio') || name.includes('breathing')) {
      if (name.includes('cardio') || name.includes('easy')) {
        ex.formCues = ['Easy pace', 'Maintain conversational pace'];
      } else if (name.includes('breathing')) {
        ex.formCues = ['Relax completely', '4-count inhale, 6-count exhale', 'Let tension release'];
      } else if (name.includes('mobility') || name.includes('stretch')) {
        ex.formCues = ['Breathe into each position', 'Controlled movement', 'Quality over intensity'];
      }
      count++;
    }
  }
}

const macro = program.macrocycle;
if (macro?.mesocycles) {
  macro.mesocycles.forEach(m => {
    if (m.microcycle) {
      m.microcycle.forEach(day => {
        if (day.blocks) {
          day.blocks.forEach(block => {
            if (block.exercises) block.exercises.forEach(ex => replaceCues(ex));
            walk(block);
          });
        }
      });
    }
  });
}

fs.writeFileSync(programPath, JSON.stringify(program, null, 2), 'utf8');
console.log(`Replaced generic formCues in ${count} exercises.`);
