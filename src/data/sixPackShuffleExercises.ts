/**
 * Core Roulette - Exercise Database
 * Dynamic core workout generator that shuffles exercises across
 * abs, obliques, deep core, and posterior chain based on user level + equipment
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentOption = 'none' | 'dumbbells' | 'bands' | 'bench' | 'ball' | 'pullup' | 'cable';
export type Category = 'upperAbs' | 'lowerAbs' | 'obliques' | 'posterior' | 'stability' | 'finisher';
export type Type = 'reps' | 'time' | 'isometric';

export interface Exercise {
  name: string;
  category: Category;
  level: ExperienceLevel;
  equipment: EquipmentOption[];
  type: Type;
  instruction?: string;        // Step-by-step how-to perform
  formCues?: string[];         // Array of technique cues (5-8 typical)
}

export interface UserSelection {
  level: ExperienceLevel;
  equipment: EquipmentOption[];
}

export interface WorkoutConfig {
  sets: number;
  reps: number;
  time: number; // in seconds
  rest: number; // in seconds
}

/**
 * Full exercise pool for Core Roulette
 */
export const exercises: Exercise[] = [
  // -------------------------------
  // BODYWEIGHT — NO EQUIPMENT
  // -------------------------------
  // Upper Abs
  { 
    name: 'Crunch Reach-Ups', 
    category: 'upperAbs', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent and feet flat on the floor. Place your hands behind your head, elbows wide. Engage your core and lift your shoulders off the ground, reaching your hands up toward the ceiling as you crunch. Focus on lifting your upper body while reaching upward. Lower back down with control.',
    formCues: [
      'Reach your hands up toward the ceiling, not forward',
      'Keep your chin off your chest to avoid neck strain',
      'Focus on lifting with your abs, not pulling with your hands',
      'Exhale as you reach up, inhale as you lower',
      'Keep your lower back pressed to the floor',
      'Control the movement - slow and controlled is better than fast'
    ]
  },
  { 
    name: 'Slow Tempo Sit-ups', 
    category: 'upperAbs', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent at 90 degrees, feet flat on floor. Place hands behind your head or cross them over your chest. Engage your core and slowly sit all the way up, taking 3-4 seconds to reach the top. Pause at the top, then slowly lower back down with control, taking another 3-4 seconds.',
    formCues: [
      'Move slowly and deliberately - 3-4 seconds up, 3-4 seconds down',
      'Keep your feet anchored or have a partner hold them',
      'Don\'t pull on your neck - use your abs to lift',
      'Come all the way up to a seated position',
      'Control the descent completely - don\'t drop back',
      'Breathe out as you sit up, breathe in as you lower'
    ]
  },
  { 
    name: 'Hollow Rock Crunch', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie on your back with arms extended overhead and legs straight. Engage your core and lift your shoulders and legs off the ground, creating a hollow position. Rock back and forth in this position, maintaining the hollow shape. Keep your lower back pressed to the floor throughout the rocking motion.',
    formCues: [
      'Maintain the hollow position throughout the rock',
      'Keep your lower back pressed to the floor',
      'Rock smoothly, not jerky movements',
      'Keep your arms and legs straight',
      'Focus on core engagement, not speed',
      'Breathe steadily throughout the movement'
    ]
  },
  { 
    name: 'Toe Touch Pulses', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie flat on your back with legs extended straight up toward the ceiling, perpendicular to the floor. Keep your arms extended alongside your body. Engage your core and lift your shoulders off the ground, reaching your hands toward your toes in small pulsing motions. Lower slightly between pulses but keep your shoulders off the ground.',
    formCues: [
      'Keep your legs straight and perpendicular to the floor',
      'Pulse in small, controlled movements',
      'Keep your shoulders lifted throughout',
      'Reach with your fingertips, not by arching your back',
      'Keep your lower back pressed to the floor',
      'Focus on quality pulses over quantity'
    ]
  },
  { 
    name: 'Deadbug Crunch', 
    category: 'upperAbs', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with arms extended toward the ceiling and knees bent at 90 degrees over your hips. Press your lower back into the floor. Engage your core and lift your shoulders off the ground, reaching your hands toward your knees. Lower your shoulders back down while maintaining the dead bug position with your legs.',
    formCues: [
      'Keep your lower back pressed to the floor at all times',
      'Lift your shoulders, not your whole torso',
      'Keep your knees at 90 degrees throughout',
      'Reach your hands toward your knees, not past them',
      'Control the movement both up and down',
      'Focus on upper ab engagement'
    ]
  },

  // Lower Abs
  { 
    name: 'Reverse Crunch', 
    category: 'lowerAbs', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with arms at your sides, palms down. Bend your knees to 90 degrees, keeping your feet together. Engage your lower abs and lift your hips off the ground, bringing your knees toward your chest. Pause at the top, then slowly lower your feet back to the starting position without letting them touch the ground.',
    formCues: [
      'Keep your upper body still - only your hips should move',
      'Focus on lifting your hips, not just your legs',
      'Keep your knees at 90 degrees throughout',
      'Don\'t swing or use momentum',
      'Exhale as you lift, inhale as you lower',
      'Keep your lower back pressed to the floor'
    ]
  },
  { 
    name: 'Leg Lift Holds', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie flat on your back with arms at your sides, palms down. Engage your lower abs and lift your legs straight up until they\'re perpendicular to the floor. Hold this position, keeping your legs straight and together. Keep your lower back pressed to the floor throughout the hold.',
    formCues: [
      'Keep your legs straight and together',
      'Hold at 90 degrees, not higher',
      'Keep your lower back pressed to the floor',
      'Engage your lower abs to maintain the hold',
      'Breathe steadily throughout',
      'Focus on maintaining position, not duration'
    ]
  },
  { 
    name: 'Flutter Kick Ladder', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie on your back with arms at your sides, palms down. Lift your head and shoulders slightly off the ground. Raise your legs about 6 inches off the floor. Perform flutter kicks, gradually increasing the tempo like climbing a ladder - start slow, build to fast, then slow down again. Keep your core engaged throughout.',
    formCues: [
      'Keep your legs straight and toes pointed',
      'Start slow, build tempo, then slow down',
      'Maintain small, controlled kicks',
      'Keep your head and shoulders lifted',
      'Focus on keeping your lower back on the floor',
      'Breathe steadily throughout the ladder'
    ]
  },
  { 
    name: 'Slow Negative Leg Raises', 
    category: 'lowerAbs', 
    level: 'advanced', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie flat on your back with arms at your sides, palms down. Engage your lower abs and lift your legs straight up toward the ceiling quickly. Once at the top, slowly lower your legs back down, taking 4-5 seconds for the descent. Stop just before your feet touch the ground, then lift again.',
    formCues: [
      'Lift quickly, lower slowly (4-5 seconds)',
      'Keep your legs straight throughout',
      'Control the descent completely',
      'Stop just before your feet touch the ground',
      'Keep your lower back pressed to the floor',
      'Focus on the negative (lowering) phase'
    ]
  },
  { 
    name: 'Hip Lift Pops', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent, feet flat on floor, arms at your sides. Engage your lower abs and lift your hips off the ground in a quick "pop" motion, bringing your knees toward your chest. Lower back down quickly and repeat. Focus on the explosive hip lift movement.',
    formCues: [
      'Pop your hips up quickly and explosively',
      'Bring your knees toward your chest at the top',
      'Lower quickly to reset',
      'Keep your upper body on the floor',
      'Focus on lower ab power, not height',
      'Control the landing to avoid impact'
    ]
  },

  // Obliques
  { 
    name: 'Crossbody Mountain Climbers', 
    category: 'obliques', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a high plank position with hands directly under shoulders and body in a straight line. Engage your core and bring your right knee toward your left elbow, rotating your torso slightly. Return to plank, then bring your left knee toward your right elbow. Continue alternating, maintaining a strong plank position.',
    formCues: [
      'Keep your hips level - don\'t let them sag or pike',
      'Maintain a straight line from head to heels',
      'Focus on bringing your knee across your body',
      'Rotate your torso slightly with each movement',
      'Keep your core tight throughout',
      'Move at a controlled pace, not rushed'
    ]
  },
  { 
    name: 'Side Plank Hip Drops', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a side plank position with your right elbow under your shoulder, body in a straight line, and left arm extended upward. Lower your hips toward the ground in a controlled motion, then lift them back up to the starting position. Keep your body in a straight line throughout. Switch sides halfway through.',
    formCues: [
      'Keep your body in a straight line from head to feet',
      'Lower your hips slowly and with control',
      'Don\'t let your hips sag - keep them lifted',
      'Engage your obliques and core throughout',
      'Breathe steadily as you dip and lift',
      'Focus on the oblique engagement, not speed'
    ]
  },
  { 
    name: 'Rotational Crunch Sweep', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent, feet flat on floor. Place hands behind your head, elbows wide. Engage your core and lift your shoulders off the ground, rotating your torso to bring your right elbow toward your left knee. Lower back down, then repeat on the opposite side, sweeping across your body.',
    formCues: [
      'Rotate from your core, not just your arms',
      'Bring your elbow across your body toward the opposite knee',
      'Keep your shoulders lifted throughout',
      'Control the movement both up and down',
      'Alternate sides smoothly',
      'Focus on oblique engagement with each rotation'
    ]
  },
  { 
    name: 'Alternating Star Crunch', 
    category: 'obliques', 
    level: 'advanced', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with arms and legs extended in a star position. Engage your core and simultaneously lift your right arm and left leg, bringing your hand toward your foot in a crunching motion. Lower back down, then repeat with your left arm and right leg. Continue alternating in a star pattern.',
    formCues: [
      'Create a star shape with your body',
      'Lift opposite arm and leg together',
      'Bring your hand toward your foot',
      'Keep your core engaged throughout',
      'Control the movement both up and down',
      'Focus on coordination and oblique engagement'
    ]
  },
  { 
    name: 'Plank Rotations', 
    category: 'obliques', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a high plank position with hands directly under shoulders. Rotate your body to the right, lifting your right arm toward the ceiling and coming into a side plank position. Return to center, then rotate to the left, lifting your left arm. Continue alternating rotations while maintaining core engagement.',
    formCues: [
      'Keep your body in a straight line throughout',
      'Rotate from your core, not just your arms',
      'Lift your arm straight up toward the ceiling',
      'Keep your hips level during rotation',
      'Control the movement both ways',
      'Focus on oblique engagement with each rotation'
    ]
  },

  // Posterior Chain / Low Back
  { 
    name: 'Superman Holds', 
    category: 'posterior', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie face down on the floor with arms extended overhead and legs straight. Engage your posterior chain and lift your arms, chest, and legs off the ground simultaneously, creating a "flying" position. Hold this position, keeping your neck neutral. Keep your arms and legs straight throughout the hold.',
    formCues: [
      'Lift your arms, chest, and legs together',
      'Keep your arms and legs straight',
      'Keep your neck neutral - don\'t look up',
      'Engage your glutes and lower back',
      'Hold the position, don\'t pulse',
      'Breathe steadily throughout the hold'
    ]
  },
  { 
    name: 'Alternating Supermans', 
    category: 'posterior', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie face down on the floor with arms extended overhead and legs straight. Engage your posterior chain and lift your right arm and left leg off the ground simultaneously. Lower back down, then lift your left arm and right leg. Continue alternating, keeping your opposite arm and leg lifted together.',
    formCues: [
      'Lift opposite arm and leg together',
      'Keep your arms and legs straight',
      'Keep your neck neutral',
      'Engage your glutes and lower back',
      'Control the movement both up and down',
      'Focus on posterior chain engagement'
    ]
  },
  { 
    name: 'Prone Snow Angels', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie face down on the floor with arms extended overhead and legs straight. Engage your posterior chain and lift your arms and legs slightly off the ground. Move your arms in a sweeping arc motion (like making snow angels) while keeping them lifted. Keep your legs lifted and engaged throughout.',
    formCues: [
      'Keep your arms and legs lifted throughout',
      'Sweep your arms in a wide arc motion',
      'Keep your neck neutral',
      'Engage your glutes and lower back',
      'Control the sweeping motion',
      'Focus on posterior chain activation'
    ]
  },
  { 
    name: 'Reverse Hyper Floor Swings', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie face down on the floor with your arms extended in front of you for support. Engage your glutes and lower back, then lift your legs straight up behind you, swinging them up and down in a controlled motion. Keep your legs together and straight throughout the movement.',
    formCues: [
      'Keep your legs straight and together',
      'Swing from your glutes and lower back',
      'Control the movement both up and down',
      'Keep your upper body stable',
      'Focus on posterior chain engagement',
      'Don\'t arch your back excessively'
    ]
  },
  { 
    name: 'Back Extension Waves', 
    category: 'posterior', 
    level: 'advanced', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie face down on the floor with arms extended overhead. Engage your posterior chain and lift your upper body and legs off the ground, creating a wave-like motion. Pulse up and down in small, controlled waves while maintaining the lifted position. Keep your arms and legs straight throughout.',
    formCues: [
      'Create a wave motion with your body',
      'Keep your arms and legs straight',
      'Pulse in small, controlled movements',
      'Engage your glutes and lower back',
      'Keep your neck neutral',
      'Focus on posterior chain activation'
    ]
  },

  // Deep Core / Stability
  { 
    name: 'Bird Dog', 
    category: 'stability', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Start on hands and knees with hands directly under shoulders and knees under hips. Engage your core and extend your right arm forward while simultaneously extending your left leg back. Keep your hips level and maintain a neutral spine. Hold for a moment, then return to start. Alternate sides.',
    formCues: [
      'Keep your core engaged throughout',
      'Maintain a neutral spine - don\'t arch or round',
      'Keep your hips level - don\'t let them rotate',
      'Reach long through your extended arm and leg',
      'Move slowly and with control',
      'Focus on stability, not speed'
    ]
  },
  { 
    name: 'Dead Bug', 
    category: 'stability', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie on your back with arms extended toward the ceiling and knees bent at 90 degrees over your hips. Press your lower back into the floor. Slowly lower your right arm and left leg toward the ground simultaneously, keeping your core engaged and back pressed to the floor. Return to start and alternate sides.',
    formCues: [
      'Keep your lower back pressed to the floor at all times',
      'Move your opposite arm and leg together',
      'Lower slowly and with control',
      'Don\'t let your back arch off the floor',
      'Focus on core stability, not range of motion',
      'Return to start before alternating'
    ]
  },
  { 
    name: 'Plank Variations', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a high plank position with hands directly under shoulders, body in a straight line from head to heels. Hold this position, engaging your core, glutes, and legs. Keep your hips level and avoid sagging or piking. Breathe steadily. You can alternate between high plank (hands) and low plank (forearms) for variation.',
    formCues: [
      'Keep your body in a straight line',
      'Engage your core, glutes, and legs',
      'Don\'t let your hips sag or lift too high',
      'Keep your neck neutral - look at the floor',
      'Breathe steadily throughout the hold',
      'Focus on maintaining perfect form'
    ]
  },
  { 
    name: 'Plank Walkouts', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Start standing with feet hip-width apart. Hinge at your hips and place your hands on the floor. Walk your hands forward into a high plank position, one hand at a time. Hold the plank briefly, then walk your hands back to your feet and return to standing. Repeat the walkout sequence.',
    formCues: [
      'Keep your core engaged throughout',
      'Walk your hands forward one at a time',
      'Maintain a straight line in plank position',
      'Control the walkout and walkback',
      'Keep your legs as straight as possible',
      'Focus on core stability during the plank hold'
    ]
  },
  { 
    name: 'Bear Crawl Hold', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start on hands and knees with hands directly under shoulders and knees under hips. Lift your knees slightly off the ground, hovering about 2-3 inches. Hold this position, engaging your core and keeping your back flat. Keep your knees close to the ground but not touching. Breathe steadily throughout the hold.',
    formCues: [
      'Keep your knees hovering just off the ground',
      'Maintain a flat back - don\'t arch or round',
      'Engage your core throughout the hold',
      'Keep your hands directly under your shoulders',
      'Breathe steadily',
      'Focus on stability, not duration'
    ]
  },
  { 
    name: 'Anti-Rotation Plank', 
    category: 'stability', 
    level: 'advanced', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a side plank position with your right elbow under your shoulder and body in a straight line. Extend your left arm toward the ceiling. Hold this position, resisting rotation and maintaining perfect alignment. Your core should work to prevent your body from rotating or sagging. Switch sides halfway through.',
    formCues: [
      'Keep your body in a straight line',
      'Resist rotation - don\'t let your hips drop',
      'Engage your core and obliques',
      'Keep your extended arm straight',
      'Breathe steadily throughout the hold',
      'Focus on anti-rotation strength'
    ]
  },

  // Finishers
  { 
    name: 'Hollow Hold', 
    category: 'finisher', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'isometric',
    instruction: 'Lie on your back with arms extended overhead and legs straight. Engage your core and lift your shoulders and legs off the ground simultaneously, creating a "hollow" shape with your body. Keep your lower back pressed to the floor. Hold this position, breathing steadily. Your body should form a slight "banana" shape.',
    formCues: [
      'Keep your lower back pressed to the floor',
      'Lift your shoulders and legs together',
      'Keep your arms and legs straight',
      'Focus on core engagement, not height',
      'Breathe steadily throughout the hold',
      'Maintain the hollow position throughout'
    ]
  },
  { 
    name: 'V-Up Bursts', 
    category: 'finisher', 
    level: 'advanced', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Lie flat on your back with arms extended overhead and legs straight. Simultaneously lift your torso and legs off the ground in an explosive burst, reaching your hands toward your feet to form a V shape. Lower back down quickly and immediately burst up again. Focus on explosive power and speed.',
    formCues: [
      'Burst up explosively and quickly',
      'Reach your hands toward your feet at the top',
      'Keep your legs straight throughout',
      'Lower quickly to reset for next burst',
      'Focus on power and speed',
      'Maintain control despite the speed'
    ]
  },
  { 
    name: 'Plank Jack Sprints', 
    category: 'finisher', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Start in a high plank position with hands directly under shoulders and body in a straight line. Jump your feet apart and back together rapidly in a sprinting motion, like doing jumping jacks in plank position. Keep your core engaged and hips level throughout. Maintain a fast, steady rhythm.',
    formCues: [
      'Jump your feet wide and back together rapidly',
      'Keep your hips level - don\'t let them sag',
      'Maintain a strong plank position',
      'Keep your core tight and engaged',
      'Move at a fast, steady pace',
      'Focus on maintaining form at speed'
    ]
  },
  { 
    name: 'Core Burnout Pulses', 
    category: 'finisher', 
    level: 'beginner', 
    equipment: ['none'], 
    type: 'time',
    instruction: 'Lie on your back with knees bent, feet flat on floor. Place hands behind your head. Engage your core and lift your shoulders off the ground. Perform small, rapid pulsing crunches, lifting and lowering your shoulders in quick succession. Keep your lower back on the floor and maintain the pulse rhythm.',
    formCues: [
      'Pulse in small, rapid movements',
      'Keep your shoulders lifted throughout',
      'Maintain a steady pulse rhythm',
      'Keep your lower back on the floor',
      'Focus on core engagement, not height',
      'Breathe steadily despite the rapid pace'
    ]
  },
  { 
    name: 'Alternating Tuck-Ups', 
    category: 'finisher', 
    level: 'intermediate', 
    equipment: ['none'], 
    type: 'reps',
    instruction: 'Sit on the floor with knees bent and feet lifted. Lean back slightly, engaging your core. Alternately bring your right knee and left elbow together, then your left knee and right elbow together. Continue alternating in a tucking motion, maintaining balance and core engagement throughout.',
    formCues: [
      'Alternate sides smoothly',
      'Bring your knee and opposite elbow together',
      'Keep your core engaged throughout',
      'Maintain balance as you alternate',
      'Control the movement both ways',
      'Focus on coordination and core strength'
    ]
  },

  // -------------------------------
  // DUMBBELLS
  // -------------------------------
  { 
    name: 'Weighted Sit-ups', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent, feet flat on floor. Hold a dumbbell against your chest with both hands. Engage your core and sit all the way up, bringing your chest toward your knees. Lower back down with control, keeping the weight close to your chest throughout.',
    formCues: [
      'Hold the dumbbell securely against your chest',
      'Use your abs to lift, not momentum',
      'Come all the way up to seated position',
      'Control the descent - don\'t drop back',
      'Start with lighter weight and progress gradually',
      'Keep your core engaged throughout'
    ]
  },
  { 
    name: 'DB Crunch Reach', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Lie on your back with knees bent, feet flat on floor. Hold a dumbbell with both hands and extend your arms overhead. Engage your core and crunch up, reaching the dumbbell toward your knees. Lower back down with control, keeping your arms extended overhead.',
    formCues: [
      'Keep your arms extended overhead throughout',
      'Reach the weight toward your knees as you crunch',
      'Keep your lower back on the floor',
      'Control the movement both up and down',
      'Focus on lifting with your abs',
      'Don\'t use momentum to swing the weight'
    ]
  },
  { 
    name: 'DB Hollow Chest Press', 
    category: 'upperAbs', 
    level: 'advanced', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Lie on your back in a hollow hold position with shoulders and legs lifted. Hold a dumbbell in each hand at your chest. Press the dumbbells up toward the ceiling while maintaining the hollow position. Lower the weights back to your chest, keeping your core engaged and hollow position intact.',
    formCues: [
      'Maintain the hollow position throughout',
      'Press the weights straight up',
      'Keep your core engaged and lower back on floor',
      'Control the press and lower',
      'Focus on core stability while pressing',
      'Don\'t let your form break during the press'
    ]
  },
  { 
    name: 'DB Leg Raises', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Lie on your back with a dumbbell held between your feet. Place your arms at your sides, palms down. Engage your lower abs and lift your legs straight up toward the ceiling until perpendicular to the floor. Slowly lower back down, stopping just before the ground.',
    formCues: [
      'Hold the dumbbell securely between your feet',
      'Keep your legs straight throughout',
      'Lift with your lower abs, not momentum',
      'Control the descent completely',
      'Keep your lower back pressed to the floor',
      'Start with lighter weight to maintain form'
    ]
  },
  { 
    name: 'DB Russian Twists', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'time',
    instruction: 'Sit on the floor with knees bent and feet lifted slightly off the ground. Hold a dumbbell with both hands in front of your chest. Lean back slightly, engaging your core. Rotate your torso to the right, bringing the weight to your right side, then rotate to the left. Continue alternating sides while maintaining balance.',
    formCues: [
      'Keep your feet off the ground throughout',
      'Rotate from your torso, not just your arms',
      'Keep your chest up and core engaged',
      'Move the weight, not your whole body',
      'Maintain a steady, controlled rhythm',
      'Focus on oblique engagement with each rotation'
    ]
  },
  { 
    name: 'DB Side Bends', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Stand tall with feet hip-width apart. Hold a dumbbell in one hand, letting it hang at your side. Keep your core engaged and slowly bend to the side, lowering the weight toward the floor. Return to standing, then switch sides. Keep your torso straight - only bend to the side.',
    formCues: [
      'Keep your torso straight - don\'t lean forward or back',
      'Bend only to the side, not forward',
      'Control the movement both down and up',
      'Keep your core engaged throughout',
      'Focus on stretching and contracting your obliques',
      'Switch sides evenly'
    ]
  },
  { 
    name: 'DB Back Extensions', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Lie face down on the floor with a dumbbell held behind your head with both hands. Engage your posterior chain and lift your upper body off the ground, extending your back. Lower back down with control. Keep your legs on the floor and focus on lifting with your lower back and glutes.',
    formCues: [
      'Hold the weight securely behind your head',
      'Lift with your lower back and glutes',
      'Keep your legs on the floor',
      'Control the movement both up and down',
      'Don\'t hyperextend your neck',
      'Focus on posterior chain engagement'
    ]
  },
  { 
    name: 'DB Plank Drag-Through', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['dumbbells'], 
    type: 'reps',
    instruction: 'Start in a high plank position with a dumbbell on the floor to one side of your body. Reach across with your opposite hand, grab the dumbbell, and drag it under your body to the other side. Place it down, then drag it back. Continue alternating, maintaining a strong plank position throughout.',
    formCues: [
      'Maintain a strong plank position throughout',
      'Keep your hips level - don\'t let them rotate',
      'Reach across your body to grab the weight',
      'Drag the weight smoothly under your body',
      'Engage your core to resist rotation',
      'Control the drag-through movement'
    ]
  },

  // -------------------------------
  // RESISTANCE BANDS
  // -------------------------------
  { 
    name: 'Band Crunches', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['bands'], 
    type: 'reps',
    instruction: 'Anchor a resistance band behind you at chest height. Lie on your back with knees bent, holding the band handles at your chest. Engage your core and crunch up, pulling against the band resistance. Lower back down with control, maintaining tension on the band.',
    formCues: [
      'Keep constant tension on the band throughout',
      'Pull against the resistance, not just your body weight',
      'Keep your lower back on the floor',
      'Control both the crunch up and the release down',
      'Adjust band tension to match your strength level',
      'Focus on core engagement against resistance'
    ]
  },
  { 
    name: 'Band Leg Raises', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['bands'], 
    type: 'reps',
    instruction: 'Anchor a resistance band to a low point. Lie on your back and loop the band around your feet. Hold the band handles or anchor points. Engage your lower abs and lift your legs straight up against the band resistance. Lower back down with control, maintaining tension.',
    formCues: [
      'Keep constant tension on the band',
      'Lift against the resistance, not just gravity',
      'Keep your legs straight throughout',
      'Control the movement both up and down',
      'Keep your lower back pressed to the floor',
      'Adjust band tension for appropriate challenge'
    ]
  },
  { 
    name: 'Band Woodchoppers', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['bands'], 
    type: 'reps',
    instruction: 'Anchor a resistance band at a high point. Stand sideways to the anchor, holding the band handle with both hands at shoulder height. Rotate your torso and pull the band down and across your body in a chopping motion. Return to start with control. Switch sides halfway through.',
    formCues: [
      'Rotate from your core, not just your arms',
      'Keep your feet planted and core engaged',
      'Pull the band across your body diagonally',
      'Control the movement both down and up',
      'Focus on engaging your obliques throughout',
      'Switch sides evenly'
    ]
  },
  { 
    name: 'Pallof Press Hold', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['bands'], 
    type: 'time',
    instruction: 'Anchor a resistance band at chest height. Stand sideways to the anchor, holding the band handle with both hands at your chest. Press the band straight out in front of you, resisting the pull of the band. Hold this position, engaging your core to prevent rotation. Switch sides halfway through.',
    formCues: [
      'Press the band straight out from your chest',
      'Resist rotation - keep your body square',
      'Engage your core and obliques',
      'Hold the position, don\'t pulse',
      'Keep your arms straight',
      'Focus on anti-rotation strength'
    ]
  },
  { 
    name: 'Band Good Mornings', 
    category: 'posterior', 
    level: 'beginner', 
    equipment: ['bands'], 
    type: 'reps',
    instruction: 'Stand on a resistance band with feet hip-width apart. Hold the band handles behind your neck or at your shoulders. Hinge at your hips, pushing your hips back and lowering your torso while keeping your back straight. Return to standing by driving your hips forward. Keep your legs slightly bent.',
    formCues: [
      'Hinge at your hips, not your waist',
      'Push your hips back as you lower',
      'Keep your back straight throughout',
      'Keep your legs slightly bent',
      'Drive your hips forward to return to standing',
      'Focus on posterior chain engagement'
    ]
  },

  // -------------------------------
  // BENCH
  // -------------------------------
  { 
    name: 'Decline Sit-ups', 
    category: 'upperAbs', 
    level: 'advanced', 
    equipment: ['bench'], 
    type: 'reps',
    instruction: 'Secure your feet under the pads of a decline bench, positioned at a 30-45 degree angle. Lie back with hands behind your head or across your chest. Engage your core and sit all the way up, bringing your chest toward your knees. Lower back down with control, using the decline angle to increase difficulty.',
    formCues: [
      'Secure your feet properly under the pads',
      'Use the decline angle to increase resistance',
      'Control the descent - gravity will pull you down',
      'Come all the way up to seated position',
      'Keep your core engaged throughout the movement',
      'Start with a lower angle and progress'
    ]
  },
  { 
    name: 'Bench Leg Raises', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['bench'], 
    type: 'reps',
    instruction: 'Sit on the edge of a bench, gripping the sides for support. Lean back slightly and lift your legs, keeping them straight. Engage your lower abs and lift your legs up toward your chest, then lower them back down with control. Keep your core engaged and maintain balance.',
    formCues: [
      'Grip the bench securely for balance',
      'Keep your legs straight throughout',
      'Lift with your lower abs, not momentum',
      'Control the movement both up and down',
      'Keep your core engaged to maintain balance',
      'Focus on lower ab engagement'
    ]
  },
  { 
    name: 'Bench Reverse Hypers', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['bench'], 
    type: 'reps',
    instruction: 'Lie face down on a bench with your hips at the edge and legs hanging off. Grip the bench for support. Engage your glutes and lower back, then lift your legs straight up behind you. Lower back down with control. Keep your legs straight and together throughout.',
    formCues: [
      'Keep your hips at the edge of the bench',
      'Grip the bench securely for support',
      'Lift your legs straight up behind you',
      'Engage your glutes and lower back',
      'Control the movement both up and down',
      'Focus on posterior chain engagement'
    ]
  },
  { 
    name: 'Bench Plank Knee Tucks', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['bench'], 
    type: 'reps',
    instruction: 'Start in a high plank position with your hands on a bench and feet on the floor. Engage your core and bring your right knee toward your chest, tucking it in. Return to plank, then bring your left knee toward your chest. Continue alternating, maintaining a strong plank position.',
    formCues: [
      'Maintain a strong plank position throughout',
      'Keep your hips level - don\'t let them pike',
      'Bring your knee toward your chest',
      'Control the tuck and return',
      'Engage your core throughout',
      'Alternate sides smoothly'
    ]
  },

  // -------------------------------
  // STABILITY BALL
  // -------------------------------
  { 
    name: 'Ball Crunch', 
    category: 'upperAbs', 
    level: 'beginner', 
    equipment: ['ball'], 
    type: 'reps',
    instruction: 'Sit on a stability ball and walk your feet forward until your lower back is supported by the ball. Place your hands behind your head, elbows wide. Engage your core and crunch up, lifting your shoulders off the ball. Lower back down with control, using the ball\'s curve for support.',
    formCues: [
      'Position the ball to support your lower back',
      'Keep your feet planted and stable',
      'Crunch up, lifting your shoulders',
      'Keep your chin off your chest',
      'Control the movement both up and down',
      'Use the ball\'s curve for full range of motion'
    ]
  },
  { 
    name: 'Ball Pike', 
    category: 'lowerAbs', 
    level: 'advanced', 
    equipment: ['ball'], 
    type: 'reps',
    instruction: 'Start in a high plank position with your shins on a stability ball, hands directly under shoulders. Engage your core and lift your hips up, rolling the ball toward your hands as you pike your body. Lower back down to plank position. Keep your legs straight throughout.',
    formCues: [
      'Keep your legs straight throughout',
      'Lift your hips up and back',
      'Roll the ball toward your hands',
      'Engage your core to control the movement',
      'Control both the pike and the return',
      'Focus on lower ab and core strength'
    ]
  },
  { 
    name: 'Ball Stir-the-Pot', 
    category: 'obliques', 
    level: 'advanced', 
    equipment: ['ball'], 
    type: 'time',
    instruction: 'Start in a plank position with your forearms on a stability ball, body in a straight line. Engage your core and make small circular motions with your forearms, "stirring" the ball. Keep your body stable and hips level throughout. Change direction halfway through.',
    formCues: [
      'Keep your body completely stable',
      'Only your forearms should move',
      'Make small, controlled circles',
      'Keep your hips level - resist rotation',
      'Focus on core engagement and stability',
      'Change direction smoothly'
    ]
  },
  { 
    name: 'Ball Back Extensions', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['ball'], 
    type: 'reps',
    instruction: 'Lie face down on a stability ball with your hips at the center of the ball and hands behind your head. Engage your posterior chain and lift your upper body, extending your back. Lower back down with control. Keep your legs on the floor for stability.',
    formCues: [
      'Position the ball under your hips',
      'Keep your legs on the floor for stability',
      'Lift with your lower back and glutes',
      'Control the extension and lower',
      'Don\'t hyperextend your neck',
      'Focus on posterior chain engagement'
    ]
  },
  { 
    name: 'Ball Rollouts', 
    category: 'stability', 
    level: 'intermediate', 
    equipment: ['ball'], 
    type: 'time',
    instruction: 'Start in a high plank position with your shins on a stability ball, hands directly under shoulders. Engage your core and slowly roll the ball forward by extending your legs, bringing your knees toward your chest. Roll the ball back to the starting position. Keep your body in a straight line throughout.',
    formCues: [
      'Keep your body in a straight line',
      'Engage your core to control the ball',
      'Roll slowly and with control',
      'Don\'t let your hips sag or pike',
      'Focus on core stability, not speed',
      'Control the roll both forward and back'
    ]
  },

  // -------------------------------
  // PULL-UP BAR
  // -------------------------------
  { 
    name: 'Hanging Knee Raises', 
    category: 'lowerAbs', 
    level: 'intermediate', 
    equipment: ['pullup'], 
    type: 'reps',
    instruction: 'Hang from a pull-up bar with an overhand grip, arms fully extended. Engage your core and bring your knees up toward your chest, keeping them together. Lower back down with control. Keep your body stable and avoid swinging throughout the movement.',
    formCues: [
      'Keep your knees together',
      'Bring your knees toward your chest',
      'Control the movement both up and down',
      'Avoid swinging - engage your core',
      'Focus on lower ab engagement',
      'Keep your grip secure'
    ]
  },
  { 
    name: 'Hanging Leg Raises', 
    category: 'lowerAbs', 
    level: 'advanced', 
    equipment: ['pullup'], 
    type: 'reps',
    instruction: 'Hang from a pull-up bar with an overhand grip, arms fully extended. Engage your core and lift your legs straight up toward the bar, keeping them together. Lower back down with control, stopping before your legs swing. Keep your body stable and avoid swinging.',
    formCues: [
      'Keep your legs straight and together',
      'Lift with your lower abs, not momentum',
      'Control the descent completely',
      'Avoid swinging - keep your body stable',
      'Focus on quality over quantity',
      'Keep your grip secure throughout'
    ]
  },
  { 
    name: 'Hanging Windshield Wipers', 
    category: 'obliques', 
    level: 'advanced', 
    equipment: ['pullup'], 
    type: 'reps',
    instruction: 'Hang from a pull-up bar with an overhand grip, arms fully extended. Lift your legs straight up to 90 degrees. Rotate your legs side to side like windshield wipers, keeping them together and straight. Control the movement and engage your core to resist swinging.',
    formCues: [
      'Keep your legs straight and together',
      'Rotate from your core, not momentum',
      'Control the movement both left and right',
      'Avoid swinging - keep your body stable',
      'Focus on engaging your obliques',
      'Keep your grip secure'
    ]
  },
  { 
    name: 'Hanging Back Extensions', 
    category: 'posterior', 
    level: 'advanced', 
    equipment: ['pullup'], 
    type: 'reps',
    instruction: 'Hang from a pull-up bar with an overhand grip, arms fully extended. Engage your posterior chain and lift your legs straight up behind you, arching your back slightly. Lower back down with control. Keep your legs straight and focus on lifting with your lower back and glutes.',
    formCues: [
      'Lift your legs behind you, not in front',
      'Engage your glutes and lower back',
      'Keep your legs straight',
      'Control the movement both up and down',
      'Don\'t swing - use controlled movement',
      'Focus on posterior chain engagement'
    ]
  },

  // -------------------------------
  // CABLE MACHINE
  // -------------------------------
  { 
    name: 'Cable Crunches', 
    category: 'upperAbs', 
    level: 'intermediate', 
    equipment: ['cable'], 
    type: 'reps',
    instruction: 'Kneel facing away from a cable machine with a rope attachment at head height. Hold the rope handles behind your head. Engage your core and crunch down, bringing your elbows toward your knees. Squeeze your abs at the bottom, then return to start with control.',
    formCues: [
      'Keep constant tension on the cable',
      'Crunch down, don\'t just pull with your arms',
      'Focus on contracting your abs',
      'Control the movement both down and up',
      'Keep your hips stationary - only your torso moves',
      'Squeeze your abs at the bottom'
    ]
  },
  { 
    name: 'Standing Cable Twists', 
    category: 'obliques', 
    level: 'intermediate', 
    equipment: ['cable'], 
    type: 'reps',
    instruction: 'Stand sideways to a cable machine with the handle at chest height. Hold the handle with both hands, arms extended. Rotate your torso away from the machine, pulling the cable across your body. Return to start with control. Keep your feet planted and core engaged. Switch sides halfway through.',
    formCues: [
      'Rotate from your core, not just your arms',
      'Keep your feet planted throughout',
      'Pull the cable across your body',
      'Control the movement both ways',
      'Focus on engaging your obliques',
      'Switch sides evenly'
    ]
  },
  { 
    name: 'Cable Woodchoppers', 
    category: 'obliques', 
    level: 'advanced', 
    equipment: ['cable'], 
    type: 'reps',
    instruction: 'Stand sideways to a cable machine with the handle at a high position. Hold the handle with both hands. Rotate your torso and pull the cable down and across your body in a chopping motion, engaging your core. Return to start with control. Switch sides halfway through.',
    formCues: [
      'Start with the cable high, end low',
      'Rotate from your core in a diagonal motion',
      'Keep your feet planted and core engaged',
      'Control the movement both down and up',
      'Focus on power and control, not speed',
      'Switch sides evenly'
    ]
  },
  { 
    name: 'Cable Back Extensions', 
    category: 'posterior', 
    level: 'intermediate', 
    equipment: ['cable'], 
    type: 'reps',
    instruction: 'Stand facing away from a cable machine with the handle at a low position, between your legs. Hold the handle with both hands. Hinge at your hips and lean forward, then extend your back, pulling the cable as you return to standing. Keep your legs slightly bent and core engaged.',
    formCues: [
      'Hinge at your hips, not your waist',
      'Keep your back straight throughout',
      'Pull the cable as you extend your back',
      'Engage your glutes and lower back',
      'Control the movement both forward and back',
      'Focus on posterior chain engagement'
    ]
  },
];

/**
 * Workout parameters by experience level
 */
export const workoutConfig: Record<ExperienceLevel, WorkoutConfig> = {
  beginner: { sets: 2, reps: 12, time: 30, rest: 30 },
  intermediate: { sets: 3, reps: 15, time: 45, rest: 20 },
  advanced: { sets: 4, reps: 20, time: 60, rest: 15 },
};

/**
 * Get workout configuration for a given level
 */
export function getWorkoutConfig(level: ExperienceLevel): WorkoutConfig {
  return workoutConfig[level];
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    upperAbs: 'Upper Abs',
    lowerAbs: 'Lower Abs',
    obliques: 'Obliques',
    posterior: 'Posterior Chain',
    stability: 'Stability',
    finisher: 'Finisher',
  };
  return labels[category];
}

/**
 * Get equipment label for display
 */
export function getEquipmentLabel(equipment: EquipmentOption): string {
  const labels: Record<EquipmentOption, string> = {
    none: 'Bodyweight Only',
    dumbbells: 'Dumbbells',
    bands: 'Resistance Bands',
    bench: 'Bench',
    ball: 'Stability Ball',
    pullup: 'Pull-up Bar',
    cable: 'Cable Machine',
  };
  return labels[equipment];
}
