/**
 * Implements 20-Week Program Audit fixes:
 * 1. Cool-Down Light Cardio: recovery definition and notes
 * 2. Replace "Exercise for strength and muscle development" with correct definitions + formCues
 */
const fs = require('fs');
const path = require('path');

const programPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));

const PLACEHOLDER = 'Exercise for strength and muscle development';

const DEFINITIONS = {
  'Zone 2 Cardio': 'Aerobic base work at conversational pace; builds endurance without high fatigue.',
  'Zone 2 Pace': 'Aerobic base work at conversational pace; builds endurance without high fatigue.',
  'Easy Cardio': 'Light cardiovascular activity to promote recovery or optional low-intensity work.',
  'Easy Walk/Hike/Bike': 'Light cardiovascular activity to promote blood flow and recovery.',
  'Full Rest Day': 'Scheduled rest; no training. Supports recovery and adaptation.',
  'Recovery Cardio': 'Very light movement to promote blood flow and recovery.',
  'Easy Bike': 'Light cycling to promote blood flow and recovery.',
  'Strides': 'Short accelerations to sharpen leg turnover; easy to fast over ~30s.',
  'Rugby-style Intervals': 'High-intensity intervals (e.g. 60s hard / 60s easy) to build work capacity and repeat effort.',
  'Dynamic Activation': 'Warm-up drills to activate muscles and increase range of motion before training.',
  'Core': 'Low-intensity core stability and control work.',
  'Sled/Prowler Pushes': 'Loaded pushing for leg drive and conditioning; push for prescribed distance.',
  'Alternating DB Curls': 'Bicep isolation; control the curl, avoid swinging.',
  'Overhead Triceps Extension': 'Tricep isolation; keep elbow stable, full range of motion.',
  'Hammer Curls': 'Bicep/brachialis; neutral grip, control the curl.',
  'Triceps Kickbacks': 'Tricep isolation; extend arm back with control.',
  'Hip Thrust': 'Glute strength and hip extension; drive through heels, squeeze at top.',
  'Farmer\'s Carry': 'Grip and core stability; tall posture, smooth walk.',
  'Kettlebell Swing': 'Hip hinge power; drive through hips, control the arc.',
  'Push-ups': 'Upper body push and core; full range, controlled tempo.',
  'Med Ball Slams': 'Power and conditioning; explosive slam, catch and repeat.',
  'Bent-over Row': 'Back and biceps; hinge at hips, pull to hip.',
  'Kettlebell Swing': 'Hip hinge power; drive through hips, control the arc.',
  'KB Swings': 'Hip hinge power; drive through hips, control the arc.',
  'Push-ups': 'Upper body push and core; full range, controlled tempo.',
  'Burpees': 'Full-body conditioning; chest to floor, jump or step back up.',
  'Med Ball Slams': 'Power and conditioning; explosive slam, catch and repeat.',
  'Battle Ropes': 'High-intensity conditioning; powerful waves or slams.',
  'Band Pulls': 'Upper back and shoulder warm-up; squeeze shoulder blades, control the pull.',
  'Arm Exercise 1': 'Bicep isolation; control the curl, avoid swinging.',
  'Arm Exercise 2': 'Tricep isolation; keep elbow stable, full range of motion.',
  'Arm Exercise 3': 'Additional arm exercise; focus on full range, controlled tempo.',
};

const FORM_CUES = {
  'Full Rest Day': ['No training today', 'Prioritize sleep and nutrition'],
  'Rugby-style Intervals': ['Hard effort for work interval', 'Easy recovery for rest interval', 'Use rower or bike'],
  'Easy Walk/Hike/Bike': ['Easy pace', 'Very light effort', 'Recovery focus'],
  'Zone 2 Cardio': ['Easy pace', 'Maintain conversational pace', 'Steady effort'],
  'Zone 2 Pace': ['Easy pace', 'Maintain conversational pace', 'Steady effort'],
  'Dynamic Activation': ['Controlled movement', 'Breathe deeply', 'Increase range gradually', 'Quality over quantity'],
  'Core': ['Maintain tension', 'Avoid arching or over-rotating', 'Breathe steadily'],
};

let cooldownLightCardioCount = 0;
let definitionCount = 0;
let formCuesCount = 0;

const macro = program.macrocycle;
if (!macro?.mesocycles) {
  console.log('No macrocycle.mesocycles found');
  process.exit(1);
}

for (const m of macro.mesocycles) {
  if (!m.microcycle) continue;
  for (const day of m.microcycle) {
    if (!day.blocks) continue;
    for (const block of day.blocks) {
      const blockName = block.name || '';
      for (const ex of block.exercises || []) {
        // 1. Cool-Down Light Cardio
        if (blockName === 'Cool-Down' && ex.name === 'Light Cardio') {
          if (ex.definition && ex.definition.includes('Raises core temperature')) {
            ex.definition = 'Gradually lowers heart rate and supports recovery after training';
            ex.notes = 'Easy walk or light bike to bring heart rate down. Should feel effortless.';
            cooldownLightCardioCount++;
          }
        }

        // 2. Placeholder definition
        if (ex.definition === PLACEHOLDER) {
          const def = DEFINITIONS[ex.name];
          if (def) {
            ex.definition = def;
            definitionCount++;
          }
          const cues = FORM_CUES[ex.name];
          if (cues && ex.formCues && ex.formCues.length === 8) {
            ex.formCues = cues;
            formCuesCount++;
          }
        }
      }
    }
  }
}

fs.writeFileSync(programPath, JSON.stringify(program, null, 2), 'utf8');
console.log(`Cool-Down Light Cardio fixed: ${cooldownLightCardioCount}`);
console.log(`Definitions replaced: ${definitionCount}`);
console.log(`FormCues replaced: ${formCuesCount}`);
