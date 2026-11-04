import { Exercise } from '../types/program';

/**
 * Mobility Flow System — authoring reference library
 *
 * These flows are NOT auto-attached at runtime. Warm-ups and cool-downs are
 * authored per day in program JSON. Keep these definitions as a selective
 * seed source when designing day-specific prep/recovery.
 */

export interface MobilityExercise {
  name: string;
  reps?: string | number;
  duration?: string;
  instructions: string;
  cues: string;
  targetMuscles: string[];
  trackingMode: 'time' | 'volume';
}

export interface MobilityFlow {
  id: string;
  name: string;
  type: 'warmup' | 'cooldown';
  duration: string;
  description: string;
  exercises: MobilityExercise[];
}

// ===========================================================
// 1. LOWER BODY WARM-UP FLOW (3–5 minutes)
// ===========================================================
export const lowerBodyWarmupFlow: MobilityFlow = {
  id: 'lower-body-warmup',
  name: 'Lower Body Warm-Up Flow',
  type: 'warmup',
  duration: '3-5 min',
  description: 'Dynamic warm-up to prepare lower body for training',
  exercises: [
    {
      name: 'Leg Swings (Front-to-Back)',
      reps: '10 each leg',
      instructions: 'Stand tall holding a wall for balance. Swing one leg forward and backward in a controlled arc.',
      cues: 'Keep torso stable, avoid overextending, increase range gradually.',
      targetMuscles: ['Hip flexors', 'Hamstrings', 'Glutes'],
      trackingMode: 'volume',
    },
    {
      name: 'Leg Swings (Side-to-Side)',
      reps: '10 each leg',
      instructions: 'Swing leg across the body and out to the side.',
      cues: 'Keep hips square, avoid twisting torso.',
      targetMuscles: ['Adductors', 'Abductors', 'Hip capsule'],
      trackingMode: 'volume',
    },
    {
      name: 'Hip Circles',
      reps: '10 each direction per leg',
      instructions: 'Lift knee to 90 degrees and draw a large circle outward, then inward.',
      cues: 'Slow and controlled, keep pelvis level.',
      targetMuscles: ['Hip capsule', 'Glute medius', 'TFL'],
      trackingMode: 'volume',
    },
    {
      name: "World's Greatest Stretch",
      reps: '5 each side',
      instructions: 'Step into a deep lunge, place hands on the ground, drop elbow toward instep, rotate chest upward.',
      cues: 'Keep back leg straight, breathe into rotation.',
      targetMuscles: ['Hip flexors', 'Groin', 'Thoracic spine'],
      trackingMode: 'volume',
    },
    {
      name: 'Bodyweight Squat + Reach',
      reps: 10,
      instructions: 'Squat down, keep heels grounded, raise arms overhead at the bottom.',
      cues: 'Drive knees out, lengthen spine.',
      targetMuscles: ['Ankles', 'Hips', 'Thoracic extension'],
      trackingMode: 'volume',
    },
  ],
};

// ===========================================================
// 2. UPPER BODY WARM-UP FLOW (3–5 minutes)
// ===========================================================
export const upperBodyWarmupFlow: MobilityFlow = {
  id: 'upper-body-warmup',
  name: 'Upper Body Warm-Up Flow',
  type: 'warmup',
  duration: '3-5 min',
  description: 'Dynamic warm-up to prepare upper body for training',
  exercises: [
    {
      name: 'Arm Circles',
      reps: '10 forward, 10 backward',
      instructions: 'Start small, gradually increase circle size.',
      cues: 'Keep shoulders relaxed.',
      targetMuscles: ['Deltoids', 'Rotator cuff'],
      trackingMode: 'volume',
    },
    {
      name: 'Shoulder Rolls',
      reps: '10 forward, 10 backward',
      instructions: 'Roll shoulders in smooth circular motion.',
      cues: 'Lift, roll back, then down.',
      targetMuscles: ['Traps', 'Upper back'],
      trackingMode: 'volume',
    },
    {
      name: 'Scapular Wall Slides',
      reps: 10,
      instructions: 'Stand with back against wall, elbows and wrists touching wall, slide arms up and down.',
      cues: 'Keep ribs down, avoid arching.',
      targetMuscles: ['Scapular mobility', 'Serratus anterior'],
      trackingMode: 'volume',
    },
    {
      name: 'Thoracic Rotations (Quadruped)',
      reps: '5 each side',
      instructions: 'On hands and knees, place one hand behind head, rotate elbow upward.',
      cues: 'Keep hips still, rotate through upper back.',
      targetMuscles: ['Thoracic spine', 'Obliques'],
      trackingMode: 'volume',
    },
    {
      name: 'Band Pull-Aparts',
      reps: 15,
      instructions: 'Hold band at chest height, pull apart until shoulder blades squeeze.',
      cues: 'Keep arms straight, control return.',
      targetMuscles: ['Rear delts', 'Rhomboids'],
      trackingMode: 'volume',
    },
  ],
};

// ===========================================================
// 3. LOWER BODY COOL-DOWN FLOW (5–8 minutes)
// ===========================================================
export const lowerBodyCooldownFlow: MobilityFlow = {
  id: 'lower-body-cooldown',
  name: 'Lower Body Cool-Down Flow',
  type: 'cooldown',
  duration: '5-8 min',
  description: 'Recovery and flexibility work for lower body',
  exercises: [
    {
      name: 'Piriformis Stretch (Figure Four)',
      duration: '30 sec each side',
      instructions: 'Lie on back, cross ankle over knee, pull opposite leg toward chest.',
      cues: 'Keep back flat, relax glutes.',
      targetMuscles: ['Piriformis', 'Glutes'],
      trackingMode: 'time',
    },
    {
      name: 'Hip Flexor Stretch',
      duration: '30 sec each side',
      instructions: 'Kneel, step one foot forward, tuck pelvis, lean forward.',
      cues: 'Squeeze glute of back leg.',
      targetMuscles: ['Hip flexors', 'Quads'],
      trackingMode: 'time',
    },
    {
      name: 'Hamstring Stretch',
      duration: '30 sec each side',
      instructions: 'Seated or standing, hinge at hips, reach toward foot.',
      cues: 'Keep spine long, avoid rounding.',
      targetMuscles: ['Hamstrings'],
      trackingMode: 'time',
    },
    {
      name: 'Foam Roll – Quads',
      duration: '30 sec',
      instructions: 'Roll from hip to knee slowly.',
      cues: 'Pause on tender spots.',
      targetMuscles: ['Quads'],
      trackingMode: 'time',
    },
    {
      name: 'Foam Roll – Glutes & Hamstrings',
      duration: '30 sec each',
      instructions: 'Sit on roller, cross leg to expose glute, roll slowly.',
      cues: 'Small controlled movements.',
      targetMuscles: ['Glutes', 'Hamstrings'],
      trackingMode: 'time',
    },
  ],
};

// ===========================================================
// 4. OLYMPIC LIFT WARM-UP FLOW (13–17 minutes)
// ===========================================================
export const olympicLiftWarmupFlow: MobilityFlow = {
  id: 'olympic-lift-warmup',
  name: 'Olympic Lift Warm-Up Flow',
  type: 'warmup',
  duration: '13-17 min',
  description: 'Comprehensive warm-up to increase body temperature, improve mobility, activate key muscles, and prime barbell patterns for Olympic lifts',
  exercises: [
    {
      name: 'Light Cardio Warm-Up',
      duration: '3-5 min',
      instructions: 'Choose rower, bike, jump rope, or light jog. Move at an easy pace to elevate core temperature.',
      cues: 'Keep movement easy and rhythmic. Focus on breathing. Stay relaxed.',
      targetMuscles: ['Full body (general warm-up)'],
      trackingMode: 'time',
    },
    {
      name: 'Ankle Rocks',
      reps: '10 each side',
      instructions: 'Stand facing a wall. Drive knee forward while keeping heel planted. Return to start with control.',
      cues: 'Keep heel down. Drive knee forward over toes. Smooth, controlled motion.',
      targetMuscles: ['Ankles', 'Calves'],
      trackingMode: 'volume',
    },
    {
      name: 'Deep Squat Pry',
      duration: '30-45 sec',
      instructions: 'Sit into a deep squat. Use elbows to gently push knees outward. Hold and breathe into the stretch.',
      cues: 'Keep chest tall. Sit into natural squat depth. Gently pry knees outward.',
      targetMuscles: ['Hips', 'Adductors', 'Ankles'],
      trackingMode: 'time',
    },
    {
      name: 'T-Spine Rotations',
      reps: '10 each side',
      instructions: 'Start on all fours. Place one hand behind head. Rotate elbow up toward ceiling, then down toward opposite arm.',
      cues: 'Keep hips stable. Rotate through upper back. Reach long with the arm.',
      targetMuscles: ['Thoracic spine', 'Obliques'],
      trackingMode: 'volume',
    },
    {
      name: 'Banded Shoulder Dislocates',
      reps: '10-15',
      instructions: 'Hold band wide with straight arms. Bring band overhead and behind body. Return to front with control. (Equipment: Resistance band)',
      cues: 'Keep arms straight. Move slowly. Avoid shrugging.',
      targetMuscles: ['Shoulders', 'Lats', 'Pecs'],
      trackingMode: 'volume',
    },
    {
      name: 'Glute Bridge',
      reps: '12-15',
      instructions: 'Lie on back with knees bent. Drive hips up until glutes fully contract. Lower with control.',
      cues: 'Drive through heels. Squeeze glutes at top. Keep ribs down.',
      targetMuscles: ['Glutes', 'Hamstrings'],
      trackingMode: 'volume',
    },
    {
      name: 'Banded Lateral Walks',
      reps: '10 steps each direction',
      instructions: 'Place band above knees or at ankles. Take controlled steps sideways. Keep hips level. (Equipment: Resistance band)',
      cues: 'Keep toes forward. Maintain tension on band. Step wide, not fast.',
      targetMuscles: ['Glute medius', 'Hips'],
      trackingMode: 'volume',
    },
    {
      name: 'Tall-to-Short Jumps',
      reps: 5,
      instructions: 'Stand tall on toes. Drop quickly into an athletic stance. Absorb softly and stabilize. Rest 30 seconds after completion.',
      cues: 'Stay tall. Drop fast. Stick the landing.',
      targetMuscles: ['Ankles', 'Quads', 'Glutes', 'CNS activation'],
      trackingMode: 'volume',
    },
    {
      name: 'Empty Barbell Warm-Up Sequence',
      reps: '1 round',
      instructions: 'Perform with empty barbell: 1) Snatch-grip RDL – 5 reps, 2) Snatch high pull – 5 reps, 3) Muscle snatch – 5 reps, 4) Overhead squat – 5 reps, 5) Snatch balance – 3-5 reps, 6) Hang power snatch – 3-5 reps. Rest 60-90 seconds before starting main lifts. (Equipment: Empty barbell)',
      cues: 'Keep bar close. Move with precision. Focus on timing.',
      targetMuscles: ['Full Olympic lifting chain'],
      trackingMode: 'volume',
    },
  ],
};

// ===========================================================
// 5. UPPER BODY COOL-DOWN FLOW (5–8 minutes)
// ===========================================================
export const upperBodyCooldownFlow: MobilityFlow = {
  id: 'upper-body-cooldown',
  name: 'Upper Body Cool-Down Flow',
  type: 'cooldown',
  duration: '5-8 min',
  description: 'Recovery and flexibility work for upper body',
  exercises: [
    {
      name: 'Doorway Chest Stretch',
      duration: '30 sec each side',
      instructions: 'Place forearm on doorway, rotate torso away.',
      cues: 'Keep shoulder down, avoid shrugging.',
      targetMuscles: ['Chest', 'Anterior shoulder'],
      trackingMode: 'time',
    },
    {
      name: 'Triceps + Lat Stretch',
      duration: '30 sec each side',
      instructions: 'Raise arm overhead, bend elbow, pull gently.',
      cues: 'Lean slightly to opposite side.',
      targetMuscles: ['Triceps', 'Lats'],
      trackingMode: 'time',
    },
    {
      name: 'Neck Rolls',
      duration: '10 sec each direction',
      instructions: 'Slow circular motion.',
      cues: 'Stay relaxed, avoid forcing range.',
      targetMuscles: ['Neck', 'Traps'],
      trackingMode: 'time',
    },
    {
      name: 'Upper Back Foam Roll',
      duration: '30 sec',
      instructions: 'Roll mid-back area, avoid lower back.',
      cues: 'Support head with hands.',
      targetMuscles: ['Thoracic spine'],
      trackingMode: 'time',
    },
    {
      name: 'Lat Foam Roll',
      duration: '30 sec each side',
      instructions: 'Lie on side, roll from armpit to mid-rib.',
      cues: 'Small movements, breathe deeply.',
      targetMuscles: ['Lats'],
      trackingMode: 'time',
    },
  ],
};

/**
 * Categorizes a mobility exercise into Warm-up, Mobility, or Activation
 */
function categorizeExercise(mobEx: MobilityExercise): 'warmup' | 'mobility' | 'activation' {
  const nameLower = mobEx.name.toLowerCase();
  
  // Warm-up: Light Cardio only (time-based cardio exercises)
  if (nameLower.includes('light cardio') || nameLower.includes('cardio warm-up') || 
      (mobEx.trackingMode === 'time' && nameLower.includes('cardio'))) {
    return 'warmup';
  }
  
  // Activation: Exercises that activate specific muscle groups
  const activationKeywords = [
    'band pull-apart', 'band pull apart', 'glute bridge', 'bodyweight squat',
    'banded lateral walk', 'tall-to-short jump', 'empty barbell'
  ];
  if (activationKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'activation';
  }
  
  // Default: Mobility exercises (dynamic movements, stretches, etc.)
  return 'mobility';
}

/**
 * Categorizes a cool-down exercise into Mobility, Stretching, or Breathing
 */
function categorizeCooldownExercise(mobEx: MobilityExercise): 'mobility' | 'stretching' | 'breathing' {
  const nameLower = mobEx.name.toLowerCase();
  
  // Breathing: Breathing and relaxation exercises
  if (nameLower.includes('breathing') || nameLower.includes('breath') || 
      nameLower.includes('relaxation') || nameLower.includes('meditation')) {
    return 'breathing';
  }
  
  // Exclude foam rolling exercises from stretching (they should be in separate block)
  if (nameLower.includes('foam roll') || nameLower.includes('foam rolling')) {
    return 'mobility';
  }
  
  // Stretching: Static stretches
  const stretchingKeywords = [
    'stretch', 'stretching', 'piriformis',
    'hip flexor', 'hamstring', 'chest stretch', 'lat stretch', 'triceps'
  ];
  if (stretchingKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'stretching';
  }
  
  // Default: Mobility exercises (gentle mobility work)
  return 'mobility';
}

/**
 * Converts a MobilityFlow to Exercise[] format for integration with existing system
 * Also categorizes exercises for proper block organization
 */
export function convertMobilityFlowToExercises(flow: MobilityFlow): Exercise[] {
  return flow.exercises.map((mobEx): Exercise => {
    const exercise: Exercise = {
      name: mobEx.name,
      trackingMode: mobEx.trackingMode,
      instruction: mobEx.instructions,
      definition: `Targets: ${mobEx.targetMuscles.join(', ')}`,
      notes: `Cues: ${mobEx.cues}`,
    };

    if (mobEx.trackingMode === 'time') {
      exercise.duration = mobEx.duration;
      exercise.sets = 1;
    } else {
      exercise.reps = mobEx.reps;
      // Update: Volume-based exercises get 3 sets instead of 1
      exercise.sets = 3;
    }

    return exercise;
  });
}

/**
 * Converts a MobilityFlow to categorized Exercise groups
 * Returns exercises separated by category: warmup, mobility, activation
 */
export function convertMobilityFlowToCategorizedExercises(flow: MobilityFlow): {
  warmup: Exercise[];
  mobility: Exercise[];
  activation: Exercise[];
} {
  const categorized = {
    warmup: [] as Exercise[],
    mobility: [] as Exercise[],
    activation: [] as Exercise[],
  };

  flow.exercises.forEach((mobEx) => {
    const exercise: Exercise = {
      name: mobEx.name,
      trackingMode: mobEx.trackingMode,
      instruction: mobEx.instructions,
      definition: `Targets: ${mobEx.targetMuscles.join(', ')}`,
      notes: `Cues: ${mobEx.cues}`,
    };

    if (mobEx.trackingMode === 'time') {
      exercise.duration = mobEx.duration;
      exercise.sets = 1;
    } else {
      exercise.reps = mobEx.reps;
      // Update: Volume-based exercises get 3 sets instead of 1
      exercise.sets = 3;
    }

    const category = categorizeExercise(mobEx);
    categorized[category].push(exercise);
  });

  return categorized;
}

/**
 * Converts a cooldown MobilityFlow to categorized Exercise groups
 * Returns exercises separated by category: mobility, stretching, breathing
 */
export function convertCooldownFlowToCategorizedExercises(flow: MobilityFlow): {
  mobility: Exercise[];
  stretching: Exercise[];
  breathing: Exercise[];
} {
  const categorized = {
    mobility: [] as Exercise[],
    stretching: [] as Exercise[],
    breathing: [] as Exercise[],
  };

  flow.exercises.forEach((mobEx) => {
    const exercise: Exercise = {
      name: mobEx.name,
      trackingMode: mobEx.trackingMode,
      instruction: mobEx.instructions,
      definition: `Targets: ${mobEx.targetMuscles.join(', ')}`,
      notes: `Cues: ${mobEx.cues}`,
    };

    if (mobEx.trackingMode === 'time') {
      exercise.duration = mobEx.duration;
      exercise.sets = 1;
    } else {
      exercise.reps = mobEx.reps;
      exercise.sets = 1; // Cool-down exercises always use 1 set regardless of tracking mode
    }

    const category = categorizeCooldownExercise(mobEx);
    categorized[category].push(exercise);
  });

  return categorized;
}

/**
 * Creates a shortened version of a flow (for Full Body sessions)
 */
export function createShortenedFlow(flow: MobilityFlow, keepFirst: number = 3): MobilityFlow {
  return {
    ...flow,
    exercises: flow.exercises.slice(0, keepFirst),
    duration: flow.duration.replace(/\d+-\d+/, (match) => {
      const [min, max] = match.split('-').map(Number);
      return `${Math.floor(min * 0.6)}-${Math.floor(max * 0.6)}`;
    }),
  };
}

/**
 * Determines session type from title
 */
export function getSessionTypeFromTitle(title: string): 'Lower Body' | 'Upper Body' | 'Full Body' | 'Conditioning' | 'Olympic Lift' | 'Other' {
  const titleLower = title.toLowerCase();
  
  // Check for Olympic Lift first (before other categories)
  if (titleLower.includes('olympic') || titleLower.includes('power clean') || titleLower.includes('snatch') || 
      (titleLower.includes('explosive') && titleLower.includes('power'))) {
    return 'Olympic Lift';
  }
  
  if (titleLower.includes('lower') && !titleLower.includes('upper') && !titleLower.includes('full')) {
    return 'Lower Body';
  }
  if (titleLower.includes('upper') && !titleLower.includes('lower') && !titleLower.includes('full')) {
    return 'Upper Body';
  }
  if (titleLower.includes('full body') || (titleLower.includes('full') && titleLower.includes('body'))) {
    return 'Full Body';
  }
  if (titleLower.includes('conditioning') || titleLower.includes('hiit') || titleLower.includes('circuit')) {
    return 'Conditioning';
  }
  
  return 'Other';
}

/**
 * @deprecated Runtime type-based merge is disabled. Returns null flows.
 * Prefer authoring warm-ups/cool-downs per day in program JSON.
 */
export function getMobilityFlowsForSessionType(
  sessionType: 'Lower Body' | 'Upper Body' | 'Full Body' | 'Conditioning' | 'Olympic Lift' | 'Other'
): { warmup: MobilityFlow | null; cooldown: MobilityFlow | null } {
  return getMobilityFlowsForProgramAndSessionType(null, sessionType);
}

/**
 * Runtime type-based merge is disabled. All programs author warm-ups/cool-downs
 * per day in JSON. This always returns null so any leftover caller is safe.
 * Use the exported flow constants above as an authoring reference only.
 */
export function getMobilityFlowsForProgramAndSessionType(
  _programId: string | null,
  _sessionType: 'Lower Body' | 'Upper Body' | 'Full Body' | 'Conditioning' | 'Olympic Lift' | 'Other'
): { warmup: MobilityFlow | null; cooldown: MobilityFlow | null } {
  return {
    warmup: null,
    cooldown: null,
  };
}

