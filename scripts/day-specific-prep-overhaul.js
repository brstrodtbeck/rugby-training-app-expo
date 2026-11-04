/**
 * Day-specific prep/recovery overhaul
 *
 * - Flattens Mobility Flow / isFlowGroup wrappers into concrete exercises
 * - Ensures every non-rest training day has day-matched Warm-up (or RAMP) + Cool-Down
 * - Canonicalizes common exercise name aliases
 * - Preserves main training blocks (structure/sets/reps)
 *
 * Usage: node scripts/day-specific-prep-overhaul.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const CANONICAL_NAMES = {
  'leg swings': 'Leg Swings (Front-to-Back)',
  'leg swings front-back': 'Leg Swings (Front-to-Back)',
  'leg swings (front-back)': 'Leg Swings (Front-to-Back)',
  'leg swings front to back': 'Leg Swings (Front-to-Back)',
  'leg swings (front to back)': 'Leg Swings (Front-to-Back)',
  'leg swings side-side': 'Leg Swings (Side-to-Side)',
  'leg swings (side-side)': 'Leg Swings (Side-to-Side)',
  'leg swings side to side': 'Leg Swings (Side-to-Side)',
  'leg swings (side to side)': 'Leg Swings (Side-to-Side)',
  'band pulls': 'Band Pull-Aparts',
  'band pull aparts': 'Band Pull-Aparts',
  'band pull-aparts': 'Band Pull-Aparts',
  'wall slides': 'Scapular Wall Slides',
  'scapular wall slides': 'Scapular Wall Slides',
  'thoracic rotations': 'Thoracic Rotations (Quadruped)',
  'thoracic rotations (quadruped)': 'Thoracic Rotations (Quadruped)',
  "world's greatest stretch": "World's Greatest Stretch",
  'worlds greatest stretch': "World's Greatest Stretch",
  'hip circles': 'Hip Circles',
  'arm circles': 'Arm Circles',
  'shoulder rolls': 'Shoulder Rolls',
  'foam roll – quads': 'Foam Roll – Quads',
  'foam roll - quads': 'Foam Roll – Quads',
  'foam roll quads': 'Foam Roll – Quads',
  'upper back foam roll': 'Upper Back Foam Roll',
  'lat foam roll': 'Lat Foam Roll',
};

function canon(name) {
  if (!name || typeof name !== 'string') return name;
  const key = name.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  return CANONICAL_NAMES[key] || name;
}

function vol(name, reps, sets, instruction, definition, notes) {
  return {
    name: canon(name),
    trackingMode: 'volume',
    sets: sets ?? 1,
    reps,
    instruction,
    definition,
    notes: notes || undefined,
    substitutions: [],
  };
}

function timed(name, duration, instruction, definition, notes, sets = 1) {
  const ex = {
    name: canon(name),
    trackingMode: 'time',
    sets,
    duration: sets > 1 && !/per set|each/i.test(duration) ? `${duration} per set` : duration,
    instruction,
    definition,
    notes: notes || undefined,
    substitutions: [],
  };
  return ex;
}

const BANK = {
  lowerWarmup: [
    vol('Leg Swings (Front-to-Back)', '10 each leg', 1, 'Stand tall holding a wall. Swing one leg forward and back in a controlled arc.', 'Dynamic hip flexor and hamstring preparation'),
    vol('Leg Swings (Side-to-Side)', '10 each leg', 1, 'Swing leg across the body and out to the side with hips square.', 'Adductor/abductor and hip capsule prep'),
    vol('Hip Circles', '10 each direction per leg', 1, 'Lift knee to 90° and draw large circles outward then inward.', 'Hip capsule mobility'),
    vol("World's Greatest Stretch", '5 each side', 1, 'Deep lunge, hand to floor, elbow toward instep, rotate chest up.', 'Hip flexor, groin, and thoracic prep'),
    vol('Bodyweight Squat + Reach', 10, 1, 'Squat with heels down; reach arms overhead at the bottom.', 'Ankle, hip, and thoracic extension prep'),
  ],
  lowerActivation: [
    vol('Glute Bridge', 12, 2, 'Lie on back, drive through heels, squeeze glutes at top.', 'Glute activation before lower-body loading'),
    vol('Bird Dog', '8 each side', 2, 'Opposite arm and leg reach; keep hips level and braced.', 'Core and posterior-chain activation'),
  ],
  upperWarmup: [
    vol('Arm Circles', '10 forward, 10 backward', 1, 'Start small and gradually increase circle size.', 'Deltoid and rotator cuff warm-up'),
    vol('Shoulder Rolls', '10 forward, 10 backward', 1, 'Roll shoulders in a smooth circular motion.', 'Trap and upper-back warm-up'),
    vol('Scapular Wall Slides', 10, 1, 'Back against wall; keep elbows/wrists on wall and slide up/down.', 'Scapular mobility and serratus activation'),
    vol('Thoracic Rotations (Quadruped)', '5 each side', 1, 'On hands and knees, hand behind head, rotate elbow up.', 'Thoracic mobility for pressing and pulling'),
    vol('Band Pull-Aparts', 15, 1, 'Band at chest height; pull apart until shoulder blades squeeze.', 'Rear delt and scapular activation'),
  ],
  upperActivation: [
    vol('Band Pull-Aparts', 12, 2, 'Controlled tempo; pause on squeeze.', 'Scapular stabilizer activation'),
    vol('Dead Bug', '6 each side', 2, 'Opposite arm/leg extend while keeping low back pressed down.', 'Core bracing for pressing'),
  ],
  fullWarmup: [
    vol('Leg Swings (Front-to-Back)', '8 each leg', 1, 'Controlled front-to-back swings.', 'Lower-body dynamic prep'),
    vol('Hip Circles', '8 each direction per leg', 1, 'Controlled hip circles.', 'Hip mobility'),
    vol('Arm Circles', '8 forward, 8 backward', 1, 'Progressively larger circles.', 'Upper-body dynamic prep'),
    vol('Scapular Wall Slides', 8, 1, 'Keep ribs down while sliding.', 'Scapular prep'),
    vol("World's Greatest Stretch", '4 each side', 1, 'Lunge, rotate, breathe.', 'Full-body mobility opener'),
  ],
  conditioningWarmup: [
    timed('Light Cardio', '3-4 min', 'Easy bike, row, or jog to raise temperature.', 'Cardiovascular raise for conditioning'),
    vol('Leg Swings (Front-to-Back)', '8 each leg', 1, 'Controlled swings.', 'Hip dynamic prep'),
    vol('Hip Circles', '8 each direction per leg', 1, 'Large controlled circles.', 'Hip capsule prep'),
    vol('Bodyweight Squat + Reach', 8, 1, 'Easy squat with overhead reach.', 'Full lower-chain prep'),
  ],
  olympicWarmup: [
    timed('Light Cardio', '3-5 min', 'Easy bike or row.', 'Raise core temperature before Olympic patterns'),
    vol("World's Greatest Stretch", '5 each side', 1, 'Lunge with thoracic rotation.', 'Hip and T-spine mobility'),
    vol('Hip Circles', '10 each direction per leg', 1, 'Controlled hip circles.', 'Hip capsule mobility'),
    vol('Bodyweight Squat + Reach', 10, 1, 'Heels down, reach overhead.', 'Squat pattern prep'),
    vol('Band Pull-Aparts', 15, 1, 'Squeeze scapulae.', 'Upper-back activation for bar path'),
  ],
  lowerCooldown: [
    timed('Piriformis Stretch (Figure Four)', '30 sec each side', 'Ankle over knee; pull opposite thigh toward chest.', 'Glute/piriformis release'),
    timed('Hip Flexor Stretch', '30 sec each side', 'Half-kneeling; tuck pelvis and gently lean forward.', 'Hip flexor length after squatting/hinging'),
    timed('Hamstring Stretch', '30 sec each side', 'Hinge at hips with long spine; reach toward foot.', 'Hamstring recovery'),
    timed('Foam Roll – Quads', '30 sec', 'Slow rolls hip to knee; pause on tender spots.', 'Quad soft-tissue recovery'),
  ],
  upperCooldown: [
    timed('Doorway Chest Stretch', '30 sec each side', 'Forearm on doorway; rotate torso away.', 'Chest and anterior shoulder release'),
    timed('Triceps + Lat Stretch', '30 sec each side', 'Arm overhead, elbow bent; gentle side lean.', 'Lat and triceps length'),
    timed('Upper Back Foam Roll', '30 sec', 'Roll mid-back only; support head with hands.', 'Thoracic soft-tissue recovery'),
    timed('Lat Foam Roll', '30 sec each side', 'Side-lying; roll armpit to mid-rib.', 'Lat recovery after pulling'),
  ],
  fullCooldown: [
    timed('Hip Flexor Stretch', '30 sec each side', 'Half-kneeling hip flexor stretch.', 'Hip recovery'),
    timed('Doorway Chest Stretch', '30 sec each side', 'Open chest after pressing.', 'Anterior shoulder recovery'),
    timed('Hamstring Stretch', '30 sec each side', 'Long-spine hinge stretch.', 'Posterior chain recovery'),
    timed('Upper Back Foam Roll', '30 sec', 'Gentle thoracic roll.', 'Upper-back recovery'),
  ],
  conditioningCooldown: [
    timed('Easy Walk', '2-3 min', 'Slow walk to bring heart rate down.', 'Cardiovascular downshift'),
    timed('Hip Flexor Stretch', '30 sec each side', 'Gentle half-kneeling stretch.', 'Hip recovery after conditioning'),
    timed('Hamstring Stretch', '30 sec each side', 'Easy hamstring stretch.', 'Posterior chain recovery'),
    timed('Child Pose Breathing', '60 sec', 'Knees wide, arms reach; slow nasal breathing.', 'Nervous-system downshift'),
  ],
  recoveryFlow: [
    vol('Hip Circles', '10 each direction per leg', 1, 'Stand tall; draw large knee circles.', 'Hip mobility'),
    vol('Leg Swings (Front-to-Back)', '10 each leg', 1, 'Hold support; controlled swings.', 'Dynamic hip mobility'),
    vol('Thoracic Rotations (Quadruped)', '8 each side', 1, 'Rotate through upper back; hips still.', 'T-spine mobility'),
    vol("World's Greatest Stretch", '5 each side', 1, 'Slow lunge with rotation and breath.', 'Full-body mobility'),
    timed('Hip Flexor Stretch', '45 sec each side', 'Half-kneeling; gentle lean.', 'Hip flexor restoration'),
    timed('Hamstring Stretch', '45 sec each side', 'Long spine hinge.', 'Hamstring restoration'),
    timed('Doorway Chest Stretch', '30 sec each side', 'Open chest gently.', 'Anterior shoulder restoration'),
    timed('Child Pose Breathing', '90 sec', 'Slow exhales longer than inhales.', 'Parasympathetic downshift'),
  ],
  rugbyActivateConditioning: [
    vol('Glute Bridge', 10, 2, 'Drive through heels; pause at top.', 'Glute activation before conditioning'),
    vol('Mini-Band Lateral Walk', '8 each way', 2, 'Band above knees; stay level hips.', 'Glute medius activation'),
  ],
  rugbyMobilizeConditioning: [
    vol('Leg Swings (Front-to-Back)', '10 each leg', 1, 'Controlled swings.', 'Dynamic hip prep'),
    vol("World's Greatest Stretch", '4 each side', 1, 'Lunge with rotation.', 'Hip and T-spine mobility'),
  ],
  rugbyPotentiateConditioning: [
    vol('High Knees', '20 sec', 2, 'Quick knees; upright posture.', 'CNS priming for circuits'),
    vol('A-Skips', '20m', 2, 'Light skip with quick ground contact.', 'Elastic priming before conditioning'),
  ],
};

function classifySession(title) {
  const t = (title || '').toLowerCase();
  if (/\bfull rest\b/.test(t) || (/^\s*rest\s*$/i.test(title || '') || /\brest\b/.test(t) && !/active|recovery/.test(t))) {
    if (/active recovery|mobility|optional/.test(t)) return 'Recovery';
    if (/^\s*rest\s*$/i.test((title || '').trim()) || /full rest/.test(t)) return 'Rest';
  }
  if (/olympic|clean|snatch|jerk/.test(t)) return 'Olympic';
  if (/upper|press|bench|push\/pull|push\/pull/.test(t)) return 'Upper';
  if (/lower|squat|deadlift|hinge|posterior/.test(t) && !/full body/.test(t)) return 'Lower';
  if (/full body|full-body|total body/.test(t)) return 'Full';
  if (/condition|zone 2|vo2|vo₂|cardio|interval|hiit|aerobic|circuit/.test(t)) return 'Conditioning';
  if (/recover|mobility|yoga|stretch|foam/.test(t)) return 'Recovery';
  if (/power|plyo|contrast|jump/.test(t)) return 'Olympic';
  return 'Other';
}

function isRestDay(day) {
  const type = classifySession(day.title);
  if (type === 'Rest') return true;
  const blocks = day.blocks || [];
  if (blocks.length === 0) return true;
  if (blocks.length === 1) {
    const only = (blocks[0].name || '').toLowerCase();
    const ex = blocks[0].exercises || [];
    if (only === 'rest' || (ex.length === 1 && /rest|off/i.test(ex[0].name || ''))) return true;
  }
  return false;
}

function normalizeKey(name) {
  return canon(name || '')
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flowItemToExercise(item, parent) {
  const ex = {
    name: canon(item.name),
    trackingMode: 'time',
    sets: item.sets ?? 1,
    substitutions: [],
  };
  if (item.duration) {
    ex.duration = item.duration;
    if (ex.sets > 1 && !/per set|each/i.test(ex.duration)) {
      ex.duration = `${ex.duration} per set`;
    }
  }
  if (item.reps) {
    ex.reps = item.reps;
    if (!item.duration) ex.trackingMode = 'volume';
  }
  if (item.cue) ex.notes = item.cue;
  if (item.description) ex.definition = item.description;
  if (item.detailedInstructions?.length) {
    ex.instruction = item.detailedInstructions.join('\n');
  } else if (item.description) {
    ex.instruction = item.description;
  } else if (parent?.instruction) {
    ex.instruction = parent.instruction;
  } else {
    ex.instruction = `Perform ${item.name} with controlled quality.`;
  }
  if (!ex.definition) {
    ex.definition = parent?.definition || `Prep/recovery movement: ${item.name}`;
  }
  return ex;
}

function expandFlowWrapper(exercise) {
  const hasGroups =
    (exercise.warmUpGroup?.exercises?.length ?? 0) > 0 ||
    (exercise.exercisesGroup?.exercises?.length ?? 0) > 0 ||
    (exercise.coolDownGroup?.exercises?.length ?? 0) > 0;
  const hasSteps = exercise.flowSteps?.length > 0;

  if (!hasGroups && !hasSteps && !exercise.isFlowGroup && !/mobility flow/i.test(exercise.name || '')) {
    return { warmup: [exercise], mobility: [], cooldown: [] };
  }

  // lockStructure / skipExpansion: keep as-is unless it's a named Mobility Flow we must flatten
  if ((exercise.lockStructure || exercise.skipExpansion) && !hasGroups && !hasSteps) {
    return { warmup: [exercise], mobility: [], cooldown: [] };
  }

  const warmup = [];
  const mobility = [];
  const cooldown = [];

  if (hasGroups) {
    for (const fe of exercise.warmUpGroup?.exercises || []) {
      warmup.push(flowItemToExercise(fe, exercise));
    }
    for (const fe of exercise.exercisesGroup?.exercises || []) {
      mobility.push(flowItemToExercise(fe, exercise));
    }
    for (const fe of exercise.coolDownGroup?.exercises || []) {
      cooldown.push(flowItemToExercise(fe, exercise));
    }
  } else if (hasSteps) {
    for (const step of exercise.flowSteps) {
      mobility.push(flowItemToExercise(step, exercise));
    }
  } else if (/mobility flow|full body mobility/i.test(exercise.name || '')) {
    // Placeholder with no nested content — leave empty so banks can fill
  } else {
    warmup.push(stripFlowMeta(exercise));
  }

  return { warmup, mobility, cooldown };
}

function stripFlowMeta(ex) {
  const copy = { ...ex, name: canon(ex.name) };
  delete copy.isFlowGroup;
  delete copy.flowGroupType;
  delete copy.warmUpGroup;
  delete copy.exercisesGroup;
  delete copy.coolDownGroup;
  delete copy.flowSteps;
  return copy;
}

function dedupeExercises(list) {
  const seen = new Set();
  const out = [];
  for (const ex of list) {
    const key = normalizeKey(ex.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ex, name: canon(ex.name) });
  }
  return out;
}

function mergeUnique(existing, additions) {
  const seen = new Set(existing.map((e) => normalizeKey(e.name)));
  const out = [...existing];
  for (const ex of additions) {
    const key = normalizeKey(ex.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ex, name: canon(ex.name) });
  }
  return out;
}

function prepBank(type) {
  switch (type) {
    case 'Upper':
      return { warmup: BANK.upperWarmup, activation: BANK.upperActivation };
    case 'Full':
      return { warmup: BANK.fullWarmup, activation: BANK.upperActivation.slice(0, 1) };
    case 'Conditioning':
      return { warmup: BANK.conditioningWarmup, activation: [] };
    case 'Olympic':
      return { warmup: BANK.olympicWarmup, activation: BANK.lowerActivation.slice(0, 1) };
    case 'Recovery':
      return { warmup: BANK.recoveryFlow.slice(0, 4), activation: [] };
    case 'Lower':
    case 'Other':
    default:
      return { warmup: BANK.lowerWarmup, activation: BANK.lowerActivation };
  }
}

function cooldownBank(type) {
  switch (type) {
    case 'Upper':
      return BANK.upperCooldown;
    case 'Full':
      return BANK.fullCooldown;
    case 'Conditioning':
      return BANK.conditioningCooldown;
    case 'Olympic':
      return BANK.lowerCooldown;
    case 'Recovery':
      return BANK.recoveryFlow.slice(4);
    case 'Lower':
    case 'Other':
    default:
      return BANK.lowerCooldown;
  }
}

function blockIsPrep(name) {
  const n = (name || '').toLowerCase();
  return /warm|raise|activate|activation|mobilize|potentiate|^mobility$|glute|shoulder mobility|hips? &? ?glutes|dynamic glutes/i.test(n);
}

function blockIsCooldown(name) {
  const n = (name || '').toLowerCase();
  return /cool|stretch|breathing|foam roll|cooldown|cooldow/i.test(n);
}

function blockIsMain(name) {
  return !blockIsPrep(name) && !blockIsCooldown(name);
}

function canonicalizeExerciseTree(ex) {
  const next = { ...ex, name: canon(ex.name) };
  if (next.trackingMode === 'distance' && next.reps !== undefined) {
    delete next.reps;
  }
  if (next.sets > 1 && next.duration && !/per set|each/i.test(next.duration)) {
    next.duration = `${next.duration} per set`;
  }
  if (!next.instruction) {
    next.instruction = `Perform ${next.name} with controlled quality and full range.`;
  }
  if (!next.definition) {
    next.definition = `Training movement: ${next.name}`;
  }
  // Recurse nested flow metadata names
  for (const groupKey of ['warmUpGroup', 'exercisesGroup', 'coolDownGroup']) {
    if (next[groupKey]?.exercises) {
      next[groupKey] = {
        ...next[groupKey],
        exercises: next[groupKey].exercises.map((fe) => ({ ...fe, name: canon(fe.name) })),
      };
    }
  }
  if (next.flowSteps) {
    next.flowSteps = next.flowSteps.map((s) => ({ ...s, name: canon(s.name) }));
  }
  return next;
}

function flattenBlocksFlowWrappers(blocks) {
  const extractedCooldown = [];
  const newBlocks = [];

  for (const block of blocks) {
    const isCd = blockIsCooldown(block.name);
    const flat = [];
    for (const ex of block.exercises || []) {
      const expanded = expandFlowWrapper(ex);
      if (isCd) {
        flat.push(...expanded.warmup, ...expanded.mobility, ...expanded.cooldown);
      } else if (blockIsPrep(block.name) || /mobility|recovery/i.test(block.name || '')) {
        flat.push(...expanded.warmup, ...expanded.mobility);
        extractedCooldown.push(...expanded.cooldown);
      } else {
        // Main block: keep non-flow as-is; if somehow a flow wrapper, flatten into place
        if (ex.isFlowGroup || ex.warmUpGroup || ex.coolDownGroup || ex.flowSteps || /mobility flow/i.test(ex.name || '')) {
          flat.push(...expanded.warmup, ...expanded.mobility);
          extractedCooldown.push(...expanded.cooldown);
        } else {
          flat.push(stripFlowMeta(ex));
        }
      }
    }
    newBlocks.push({
      ...block,
      exercises: dedupeExercises(flat.map(canonicalizeExerciseTree)),
    });
  }

  return { blocks: newBlocks, extractedCooldown: dedupeExercises(extractedCooldown.map(canonicalizeExerciseTree)) };
}

function ensureFitnessStyleDay(day) {
  if (isRestDay(day)) {
    day.blocks = (day.blocks || []).map((b) => ({
      ...b,
      exercises: (b.exercises || []).map(canonicalizeExerciseTree),
    }));
    return { changed: false, reason: 'rest' };
  }

  const type = classifySession(day.title);
  let { blocks, extractedCooldown } = flattenBlocksFlowWrappers(JSON.parse(JSON.stringify(day.blocks || [])));
  let changed = extractedCooldown.length > 0;

  // Collect prep exercises currently present
  let prepCount = 0;
  let cooldownCount = 0;
  let warmupIdx = -1;
  let mobilityIdx = -1;
  let activationIdx = -1;
  let cooldownIdx = -1;
  let stretchingIdx = -1;

  blocks.forEach((b, i) => {
    const n = (b.name || '').toLowerCase();
    if (/warm/.test(n) && warmupIdx === -1) warmupIdx = i;
    if (n === 'mobility' && mobilityIdx === -1) mobilityIdx = i;
    if (/activation|activate/.test(n) && activationIdx === -1) activationIdx = i;
    if (/cool/.test(n) && cooldownIdx === -1) cooldownIdx = i;
    if (/stretch/.test(n) && stretchingIdx === -1) stretchingIdx = i;
    if (blockIsPrep(b.name)) prepCount += (b.exercises || []).length;
    if (blockIsCooldown(b.name)) cooldownCount += (b.exercises || []).length;
  });

  const banks = prepBank(type);
  const cdBank = cooldownBank(type);

  // Ensure Warm-up exists and is sufficiently complete
  if (type !== 'Recovery') {
    if (warmupIdx === -1) {
      blocks.unshift({ name: 'Warm-up', exercises: dedupeExercises([...banks.warmup]) });
      warmupIdx = 0;
      // shift indices
      if (mobilityIdx >= 0) mobilityIdx++;
      if (activationIdx >= 0) activationIdx++;
      if (cooldownIdx >= 0) cooldownIdx++;
      if (stretchingIdx >= 0) stretchingIdx++;
      changed = true;
      prepCount += banks.warmup.length;
    } else {
      const current = blocks[warmupIdx].exercises || [];
      if (current.length < 3) {
        blocks[warmupIdx] = {
          ...blocks[warmupIdx],
          name: /warm/i.test(blocks[warmupIdx].name) ? blocks[warmupIdx].name : 'Warm-up',
          exercises: mergeUnique(current, banks.warmup),
        };
        changed = true;
      }
    }

    // Optional Activation if missing and bank has items (strength days)
    if (banks.activation.length && activationIdx === -1 && type !== 'Conditioning' && type !== 'Recovery') {
      const insertAt = (mobilityIdx >= 0 ? mobilityIdx : warmupIdx) + 1;
      blocks.splice(insertAt, 0, { name: 'Activation', exercises: dedupeExercises([...banks.activation]) });
      if (cooldownIdx >= insertAt) cooldownIdx++;
      if (stretchingIdx >= insertAt) stretchingIdx++;
      changed = true;
    }
  } else {
    // Recovery days: ensure restorative content
    const total = blocks.reduce((a, b) => a + (b.exercises || []).length, 0);
    if (total < 4) {
      // Prefer expanding existing Recovery/Mobility blocks
      let target = blocks.findIndex((b) => /recover|mobility|cool|stretch/i.test(b.name || ''));
      if (target === -1) {
        blocks.push({ name: 'Mobility & Stretching', exercises: dedupeExercises([...BANK.recoveryFlow]) });
      } else {
        blocks[target] = {
          ...blocks[target],
          exercises: mergeUnique(blocks[target].exercises || [], BANK.recoveryFlow),
        };
      }
      changed = true;
    }
  }

  // Merge extracted cooldown pieces
  if (extractedCooldown.length) {
    if (cooldownIdx >= 0) {
      blocks[cooldownIdx] = {
        ...blocks[cooldownIdx],
        exercises: mergeUnique(blocks[cooldownIdx].exercises || [], extractedCooldown),
      };
    } else {
      blocks.push({ name: 'Cool-Down', exercises: extractedCooldown });
      cooldownIdx = blocks.length - 1;
    }
    changed = true;
  }

  // Recount cooldown
  cooldownCount = blocks.reduce((a, b) => a + (blockIsCooldown(b.name) ? (b.exercises || []).length : 0), 0);

  if (type !== 'Rest' && cooldownCount < 2) {
    if (cooldownIdx >= 0) {
      blocks[cooldownIdx] = {
        ...blocks[cooldownIdx],
        exercises: mergeUnique(blocks[cooldownIdx].exercises || [], cdBank),
      };
    } else {
      blocks.push({ name: 'Cool-Down', exercises: dedupeExercises([...cdBank]) });
    }
    changed = true;
  }

  // Final canonicalize + remove empty non-main blocks (except intentional Rest)
  day.blocks = blocks
    .map((b) => ({
      ...b,
      exercises: dedupeExercises((b.exercises || []).map(canonicalizeExerciseTree)),
    }))
    .filter((b) => {
      if ((b.exercises || []).length > 0) return true;
      // drop empty prep/cooldown shells
      return blockIsMain(b.name) && !/warm|cool|raise|activate|mobilize|potentiate/i.test(b.name || '');
    });

  return { changed, reason: type };
}

function ensureRugbyDay(day) {
  if (isRestDay(day) && !/optional|mobility|recover/i.test(day.title || '')) {
    // Pure rest — leave optional mobility if present, but expand flows
    let { blocks } = flattenBlocksFlowWrappers(JSON.parse(JSON.stringify(day.blocks || [])));
    day.blocks = blocks.map((b) => ({
      ...b,
      exercises: (b.exercises || []).map(canonicalizeExerciseTree),
    }));
    return { changed: true, reason: 'rest-expand' };
  }

  const type = classifySession(day.title);
  let { blocks, extractedCooldown } = flattenBlocksFlowWrappers(JSON.parse(JSON.stringify(day.blocks || [])));
  let changed = extractedCooldown.length > 0;

  const idx = (pred) => blocks.findIndex((b) => pred((b.name || '').toLowerCase()));
  let raiseIdx = idx((n) => n === 'raise');
  let activateIdx = idx((n) => n === 'activate' || n === 'activation');
  let mobilizeIdx = idx((n) => n === 'mobilize');
  let potentiateIdx = idx((n) => n === 'potentiate' || n.startsWith('potentiate'));
  let cooldownIdx = idx((n) => n.includes('cool'));
  let stretchingIdx = idx((n) => n.includes('stretch'));

  // Fill empty RAMP blocks on conditioning/training days
  const hasRAMP = raiseIdx >= 0 || activateIdx >= 0 || mobilizeIdx >= 0 || potentiateIdx >= 0;
  if (hasRAMP && type !== 'Rest') {
    if (activateIdx >= 0 && (blocks[activateIdx].exercises || []).length === 0) {
      blocks[activateIdx].exercises = dedupeExercises([...BANK.rugbyActivateConditioning]);
      changed = true;
    }
    if (mobilizeIdx >= 0 && (blocks[mobilizeIdx].exercises || []).length === 0) {
      blocks[mobilizeIdx].exercises = dedupeExercises([...BANK.rugbyMobilizeConditioning]);
      changed = true;
    }
    if (potentiateIdx >= 0 && (blocks[potentiateIdx].exercises || []).length === 0) {
      blocks[potentiateIdx].exercises = dedupeExercises([...BANK.rugbyPotentiateConditioning]);
      changed = true;
    }
  }

  if (extractedCooldown.length) {
    if (cooldownIdx >= 0) {
      blocks[cooldownIdx].exercises = mergeUnique(blocks[cooldownIdx].exercises || [], extractedCooldown);
    } else {
      blocks.push({ name: 'Cool-Down', exercises: extractedCooldown });
      cooldownIdx = blocks.length - 1;
    }
    changed = true;
  }

  // Training days with RAMP or main work need cool-down
  const isTraining =
    type !== 'Rest' &&
    (hasRAMP || blocks.some((b) => blockIsMain(b.name) && (b.exercises || []).length > 0));

  if (isTraining && type !== 'Recovery') {
    const cdCount = blocks.reduce((a, b) => a + (blockIsCooldown(b.name) ? (b.exercises || []).length : 0), 0);
    if (cdCount < 2) {
      const bank = cooldownBank(type === 'Other' ? 'Lower' : type);
      if (cooldownIdx >= 0) {
        blocks[cooldownIdx].exercises = mergeUnique(blocks[cooldownIdx].exercises || [], bank);
      } else {
        blocks.push({ name: 'Cool-Down', exercises: dedupeExercises([...bank]) });
        cooldownIdx = blocks.length - 1;
      }
      if (stretchingIdx === -1) {
        blocks.push({
          name: 'Stretching',
          exercises: dedupeExercises([
            timed('Child Pose Breathing', '60 sec', 'Slow nasal breathing; long exhales.', 'Parasympathetic downshift'),
          ]),
        });
      }
      changed = true;
    }
  }

  // Recovery days: ensure mobility content is concrete
  if (type === 'Recovery') {
    const total = blocks.reduce((a, b) => a + (b.exercises || []).length, 0);
    if (total < 4) {
      const foamIdx = blocks.findIndex((b) => /foam|mobility|recover/i.test(b.name || ''));
      if (foamIdx >= 0) {
        blocks[foamIdx].exercises = mergeUnique(blocks[foamIdx].exercises || [], BANK.recoveryFlow);
      } else {
        blocks.push({ name: 'Mobility & Stretching', exercises: dedupeExercises([...BANK.recoveryFlow]) });
      }
      changed = true;
    }
  }

  day.blocks = blocks.map((b) => ({
    ...b,
    exercises: dedupeExercises((b.exercises || []).map(canonicalizeExerciseTree)),
  }));

  return { changed, reason: type };
}

function ensureHypertrophyDay(day) {
  // Treat activation-named blocks as prep; add Cool-Down if missing
  if (isRestDay(day)) return { changed: false, reason: 'rest' };

  const type = classifySession(day.title);
  let { blocks, extractedCooldown } = flattenBlocksFlowWrappers(JSON.parse(JSON.stringify(day.blocks || [])));
  let changed = extractedCooldown.length > 0;

  let cooldownIdx = blocks.findIndex((b) => blockIsCooldown(b.name));
  const prepCount = blocks.reduce((a, b) => a + (blockIsPrep(b.name) ? (b.exercises || []).length : 0), 0);

  if (prepCount < 2) {
    const bank = prepBank(type);
    blocks.unshift({ name: 'Warm-Up', exercises: dedupeExercises([...bank.warmup.slice(0, 4)]) });
    if (cooldownIdx >= 0) cooldownIdx++;
    changed = true;
  }

  if (extractedCooldown.length) {
    if (cooldownIdx >= 0) {
      blocks[cooldownIdx].exercises = mergeUnique(blocks[cooldownIdx].exercises || [], extractedCooldown);
    } else {
      blocks.push({ name: 'Cool-Down', exercises: extractedCooldown });
      cooldownIdx = blocks.length - 1;
    }
    changed = true;
  }

  const cdCount = blocks.reduce((a, b) => a + (blockIsCooldown(b.name) ? (b.exercises || []).length : 0), 0);
  if (cdCount < 2) {
    const bank = cooldownBank(type === 'Other' ? 'Lower' : type);
    if (cooldownIdx >= 0) {
      blocks[cooldownIdx].exercises = mergeUnique(blocks[cooldownIdx].exercises || [], bank);
    } else {
      blocks.push({ name: 'Cool-Down', exercises: dedupeExercises([...bank]) });
    }
    changed = true;
  }

  day.blocks = blocks.map((b) => ({
    ...b,
    exercises: dedupeExercises((b.exercises || []).map(canonicalizeExerciseTree)),
  }));
  return { changed, reason: type };
}

function processProgram(fileRel, style) {
  const file = path.join(ROOT, fileRel);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = [];
  const mesos = data.macrocycle?.mesocycles || [];

  for (const meso of mesos) {
    for (const day of meso.microcycle || []) {
      const before = JSON.stringify(day.blocks);
      let result;
      if (style === 'rugby') result = ensureRugbyDay(day);
      else if (style === 'hypertrophy') result = ensureHypertrophyDay(day);
      else result = ensureFitnessStyleDay(day);
      const after = JSON.stringify(day.blocks);
      if (before !== after) {
        report.push(`${meso.id} D${day.day} [${result.reason}] ${day.title}`);
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return report;
}

function processRecoveryWorkouts() {
  const file = path.join(ROOT, 'src/data/recoveryWorkouts.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = [];

  for (const w of data.recoveryWorkouts || []) {
    const before = JSON.stringify(w.blocks);
    let { blocks, extractedCooldown } = flattenBlocksFlowWrappers(JSON.parse(JSON.stringify(w.blocks || [])));

    // Ensure concrete mobility/stretch content
    const total = blocks.reduce((a, b) => a + (b.exercises || []).length, 0);
    if (total < 4) {
      const mobIdx = blocks.findIndex((b) => /mobility|stretch|recover|foam|yoga/i.test(b.name || ''));
      if (mobIdx >= 0) {
        blocks[mobIdx].exercises = mergeUnique(blocks[mobIdx].exercises || [], BANK.recoveryFlow);
      } else {
        blocks.push({ name: 'Mobility & Stretching', exercises: dedupeExercises([...BANK.recoveryFlow]) });
      }
    }

    if (extractedCooldown.length) {
      const cdIdx = blocks.findIndex((b) => blockIsCooldown(b.name));
      if (cdIdx >= 0) {
        blocks[cdIdx].exercises = mergeUnique(blocks[cdIdx].exercises || [], extractedCooldown);
      } else {
        blocks.push({ name: 'Cool-Down', exercises: extractedCooldown });
      }
    }

    // Breathwork sessions: keep breathing focus but ensure named exercises exist
    if (/breath/i.test(w.id) || /breath/i.test(w.title)) {
      // leave as-is if already has exercises
    }

    w.blocks = blocks.map((b) => ({
      ...b,
      exercises: dedupeExercises((b.exercises || []).map(canonicalizeExerciseTree)),
    }));

    if (JSON.stringify(w.blocks) !== before) {
      report.push(w.id);
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return report;
}

function main() {
  console.log('Running day-specific prep/recovery overhaul...\n');

  const fitness = processProgram('src/data/FitnessProgram.json', 'fitness');
  console.log(`Fitness: ${fitness.length} days updated`);
  fitness.forEach((l) => console.log('  ', l));

  const rugby = processProgram('src/data/rugbyProgram.json', 'rugby');
  console.log(`\nRugby: ${rugby.length} days updated`);
  rugby.forEach((l) => console.log('  ', l));

  const hypert = processProgram('src/data/HypertrophyMonth.json', 'hypertrophy');
  console.log(`\nHypertrophy: ${hypert.length} days updated`);
  hypert.forEach((l) => console.log('  ', l));

  const simple = processProgram('src/data/simpleweightProgram.json', 'fitness');
  console.log(`\nSimple: ${simple.length} days updated`);
  simple.forEach((l) => console.log('  ', l));

  const recovery = processRecoveryWorkouts();
  console.log(`\nRecovery workouts: ${recovery.length} updated`);
  recovery.forEach((l) => console.log('  ', l));

  console.log('\nDone.');
}

main();
