/**
 * Professional trainer/PT day-by-day alignment pass.
 * Aligns prep & cool-down to each day's main work, removes duplicates,
 * fixes bare foam-roll names, and moves misplaced stretches out of main blocks.
 */
const fs = require('fs');

function ex(name, opts = {}) {
  const e = {
    name,
    trackingMode: opts.trackingMode || (opts.duration ? 'time' : 'volume'),
    sets: opts.sets ?? 1,
    instruction: opts.instruction || `Perform ${name} with controlled quality.`,
    definition: opts.definition || `Prep/recovery: ${name}`,
    substitutions: opts.substitutions || [],
  };
  if (opts.reps !== undefined) e.reps = opts.reps;
  if (opts.duration) e.duration = opts.duration;
  if (opts.notes) e.notes = opts.notes;
  if (opts.rest !== undefined) e.rest = opts.rest;
  return e;
}

const KEY = (n) =>
  (n || '')
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const k = KEY(e.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function mergeUnique(base, add) {
  const seen = new Set(base.map((e) => KEY(e.name)));
  const out = [...base];
  for (const e of add) {
    const k = KEY(e.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function allNames(day) {
  const names = new Set();
  for (const b of day.blocks || []) {
    for (const e of b.exercises || []) names.add(KEY(e.name));
  }
  return names;
}

function mainNames(day) {
  const names = new Set();
  for (const b of day.blocks || []) {
    const n = (b.name || '').toLowerCase();
    if (/warm|raise|activate|mobilize|potentiate|mobility|activation|cool|stretch|foam|breath|optional mobility|active recovery|recovery cardio|glute|shoulder mobility|hips/.test(n)) {
      continue;
    }
    for (const e of b.exercises || []) names.add(KEY(e.name));
  }
  return names;
}

function detectDemand(day) {
  const title = (day.title || '').toLowerCase();
  const mains = [...mainNames(day)].join(' ');
  const blob = `${title} ${mains}`;
  return {
    squat: /squat|front squat|goblet/.test(blob),
    hinge: /deadlift|rdl|romanian|hip thrust|good morning|trap bar|hinge/.test(blob),
    jump: /jump|plyo|broad|depth|bound|contrast/.test(blob),
    press: /bench|press|push.?up|overhead|shoulder press/.test(blob),
    pull: /row|pull.?up|lat|face pull/.test(blob),
    olympic: /clean|snatch|jerk|olympic/.test(blob),
    sprint: /sprint|speed|agility|shuttle|hill|stride|vo2|vo₂|mas/.test(blob),
    conditioning: /condition|circuit|sled|farmer|battle|burpee|interval|hiit|zone 2|cardio/.test(blob),
    upper: /upper|bench|press|row|pull|arm|shoulder/.test(title) && !/lower|full body|total/.test(title),
    lower: /lower|squat|deadlift|posterior|hinge/.test(title),
    full: /full body|total body|mixed/.test(title),
    recovery: /recover|mobility \+|yoga|foam|breath|pool|rest/.test(title) || /full rest/.test(title),
    rest: /full rest/.test(title) || /^\s*rest\s*$/i.test(day.title || ''),
  };
}

const BARE_FOAM = {
  quads: 'Foam Roll – Quads',
  'it band': 'Foam Roll – IT Band',
  glutes: 'Foam Roll – Glutes',
  lats: 'Foam Roll – Lats',
  'thoracic spine': 'Foam Roll – Thoracic Spine',
  'chest/pec minor': 'Foam Roll – Chest/Pec Minor',
  hamstrings: 'Foam Roll – Hamstrings',
  'glutes & hamstrings': 'Foam Roll – Glutes & Hamstrings',
};

function fixBareNames(exercise) {
  const k = KEY(exercise.name);
  if (BARE_FOAM[k]) {
    return {
      ...exercise,
      name: BARE_FOAM[k],
      trackingMode: 'time',
      duration: exercise.duration || '30 sec',
      instruction: exercise.instruction || `Slowly foam roll ${exercise.name}; pause on tender spots.`,
      definition: exercise.definition || `Soft-tissue recovery for ${exercise.name}`,
    };
  }
  return exercise;
}

function isStretchLike(name) {
  const n = KEY(name);
  return /stretch|pigeon|couch stretch|open book|doorway|breathing reset|child.?s? pose|savasana|corpse|happy baby|thread the needle|figure.?4|piriformis|forward fold/.test(n);
}

function isPrepBlock(name) {
  const n = (name || '').toLowerCase();
  return /warm|raise|activate|activation|mobilize|potentiate|mobility|glute|shoulder mobility|hips|dynamic glutes|warm up/.test(n) &&
    !/cool|stretch|foam|breath/.test(n);
}

function isCdBlock(name) {
  const n = (name || '').toLowerCase();
  return /cool|stretch|breathing|foam|cooldown|cooldow/.test(n);
}

function removeFromBlock(block, predicate) {
  return {
    ...block,
    exercises: (block.exercises || []).filter((e) => !predicate(e)),
  };
}

function replaceActivation(day, demand, mains) {
  // Build activation that does NOT duplicate warm-up or main
  let activation = [];
  if (demand.upper || (demand.press && !demand.lower)) {
    activation = [
      ex('Scap Push-Ups', { reps: 10, sets: 2, instruction: 'Hands under shoulders; protract then retract scapulae without bending elbows.', definition: 'Scapular stabilizer activation before pressing/pulling' }),
      ex('Band External Rotations', { reps: '10 each arm', sets: 2, instruction: 'Elbow at side; rotate forearm outward against light band.', definition: 'Rotator cuff activation for pressing health' }),
    ];
    if (!mains.has(KEY('Dead Bug')) && !mains.has(KEY('Dead Bug Hold'))) {
      activation.push(ex('Dead Bug', { reps: '6 each side', sets: 2, instruction: 'Opposite arm/leg extend; keep low back pressed down.', definition: 'Anterior core bracing for pressing' }));
    } else {
      activation.push(ex('Hollow Body Hold', { duration: '20 sec per set', sets: 2, instruction: 'Press low back down; hold hollow shape.', definition: 'Core bracing without duplicating Dead Bug in main' }));
    }
  } else if (demand.hinge && !demand.squat) {
    activation = [
      ex('Glute Bridge', { reps: 12, sets: 2, instruction: 'Drive through heels; pause and squeeze at top.', definition: 'Glute activation before hinging' }),
      ex('Bird Dog', { reps: '8 each side', sets: 2, instruction: 'Opposite arm/leg reach; keep hips level.', definition: 'Posterior chain and anti-rotation prep' }),
    ];
    if (demand.jump) {
      activation.push(ex('Tall-to-Short Drops', { reps: 5, sets: 1, instruction: 'From tall stance drop into athletic position and stick.', definition: 'Landing mechanics before broad jumps' }));
    }
  } else if (demand.squat || demand.lower) {
    activation = [
      ex('Glute Bridge', { reps: 12, sets: 2, instruction: 'Drive through heels; pause at top.', definition: 'Glute activation before squatting' }),
      ex('Bird Dog', { reps: '8 each side', sets: 2, instruction: 'Opposite arm/leg reach; keep hips level.', definition: 'Core and hip stability for loaded lower body' }),
    ];
    if (demand.jump) {
      activation.push(ex('Pogo Hops', { reps: 10, sets: 1, instruction: 'Stiff ankles, quick elastic contacts.', definition: 'Elastic priming before jump contrast' }));
    }
  } else if (demand.conditioning || demand.sprint) {
    activation = [
      ex('Glute Bridge', { reps: 10, sets: 2, instruction: 'Drive through heels; squeeze at top.', definition: 'Glute activation before conditioning' }),
      ex('Mini-Band Lateral Walk', { reps: '8 each way', sets: 2, instruction: 'Band above knees; stay level hips.', definition: 'Glute medius activation for change of direction' }),
    ];
  } else if (demand.full) {
    activation = [
      ex('Glute Bridge', { reps: 10, sets: 2, instruction: 'Drive through heels; pause at top.', definition: 'Lower-chain activation' }),
      ex('Scap Push-Ups', { reps: 8, sets: 2, instruction: 'Protract/retract scapulae with locked elbows.', definition: 'Scapular activation for upper work' }),
    ];
  } else if (demand.olympic) {
    activation = [
      ex('Glute Bridge', { reps: 10, sets: 2, instruction: 'Drive through heels; pause at top.', definition: 'Posterior chain activation' }),
      ex('Scap Retractions', { reps: 12, sets: 2, instruction: 'Squeeze shoulder blades together with light band or empty hands.', definition: 'Upper-back activation for bar path' }),
    ];
  }

  // Remove activation items that already appear in warm-up
  const warmupNames = new Set();
  for (const b of day.blocks || []) {
    if (/warm/i.test(b.name || '')) {
      for (const e of b.exercises || []) warmupNames.add(KEY(e.name));
    }
  }
  activation = activation.filter((e) => !warmupNames.has(KEY(e.name)));

  // Also strip glute bridge from warm-up if we put it in activation (prefer activation placement)
  return activation;
}

function cleanWarmup(day, demand) {
  for (let i = 0; i < (day.blocks || []).length; i++) {
    const b = day.blocks[i];
    if (!/warm/i.test(b.name || '')) continue;
    let exercises = (b.exercises || []).map(fixBareNames);

    // Remove activation items that belong in Activation
    const activationDupes = new Set([
      KEY('Glute Bridge'),
      KEY('Glute Bridges'),
      KEY('Bird Dog'),
      KEY('Dead Bug'),
      KEY('Band Pull-Aparts'),
      KEY('Mini-Band Lateral Walk'),
      KEY('Mini-Band Lateral Walks'),
    ]);
    // Keep Band Pull-Aparts in warm-up for upper (dynamic), remove only if Activation will have scap work
    // Remove Glute Bridge/Bird Dog/Dead Bug from warm-up when Activation block exists or will exist
    const hasOrWillHaveActivation = (day.blocks || []).some((x) => /activation|activate/i.test(x.name || '')) ||
      demand.lower || demand.upper || demand.hinge || demand.squat || demand.full;

    if (hasOrWillHaveActivation) {
      exercises = exercises.filter((e) => {
        const k = KEY(e.name);
        if (k === KEY('Glute Bridge') || k === KEY('Glute Bridges') || k === KEY('Bird Dog') || k === KEY('Dead Bug')) {
          return false;
        }
        return true;
      });
    }

    // Upper warm-ups: keep one Band Pull-Aparts max; ensure scap/T-spine content
    if (demand.upper) {
      let seenPull = false;
      exercises = exercises.filter((e) => {
        if (KEY(e.name) === KEY('Band Pull-Aparts')) {
          if (seenPull) return false;
          seenPull = true;
        }
        return true;
      });
    }

    // Lower/squat: ensure ankle + hip openers present; trim excessive arm swings if lower-only
    if (demand.lower && !demand.upper) {
      exercises = exercises.filter((e) => !/^arm swings$/i.test(e.name || ''));
    }

    // Trap bar / hinge day: prefer hip hinge mobility over deep squat hold overload
    if (demand.hinge && !demand.squat) {
      const hasWgs = exercises.some((e) => /world.?s greatest/i.test(e.name || ''));
      if (!hasWgs) {
        exercises.push(ex("World's Greatest Stretch", { reps: '4 each side', instruction: 'Lunge, rotate, breathe into hip and T-spine.', definition: 'Hip flexor and T-spine prep for hinging' }));
      }
    }

    // Jump days: add ankle rocks if missing
    if (demand.jump) {
      const hasAnkle = exercises.some((e) => /ankle/i.test(e.name || ''));
      if (!hasAnkle) {
        exercises.push(ex('Ankle Dorsiflexion Rocks', { reps: '8 each side', instruction: 'Knee over toes keeping heel down.', definition: 'Ankle prep for landing and squatting' }));
      }
    }

    day.blocks[i] = { ...b, exercises: dedupe(exercises) };
  }
}

function applyActivationBlock(day, activation) {
  if (!activation.length) return;
  const idx = (day.blocks || []).findIndex((b) => /activation|^activate$/i.test(b.name || ''));
  if (idx >= 0) {
    day.blocks[idx] = { ...day.blocks[idx], name: /activate/i.test(day.blocks[idx].name) && !/activation/i.test(day.blocks[idx].name) ? day.blocks[idx].name : 'Activation', exercises: dedupe(activation) };
  } else {
    // Insert after last warm-up / mobility prep block
    let insertAt = 0;
    for (let i = 0; i < day.blocks.length; i++) {
      if (isPrepBlock(day.blocks[i].name) && !/potentiate/i.test(day.blocks[i].name || '')) insertAt = i + 1;
    }
    // Don't add Activation to rugby RAMP days (they have Activate)
    const isRamp = (day.blocks || []).some((b) => /^(raise|activate|mobilize|potentiate)$/i.test((b.name || '').trim()));
    if (isRamp) {
      const actIdx = day.blocks.findIndex((b) => /^activate$/i.test((b.name || '').trim()));
      if (actIdx >= 0) {
        // Merge non-dupes into existing Activate carefully — for rugby we mostly leave RAMP
        return;
      }
    }
    day.blocks.splice(insertAt, 0, { name: 'Activation', exercises: dedupe(activation) });
  }
}

function cleanCooldown(day, demand) {
  const mains = mainNames(day);
  const prepNames = new Set();
  for (const b of day.blocks || []) {
    if (isPrepBlock(b.name)) {
      for (const e of b.exercises || []) prepNames.add(KEY(e.name));
    }
  }

  for (let i = 0; i < (day.blocks || []).length; i++) {
    const b = day.blocks[i];
    if (!isCdBlock(b.name)) continue;
    let exercises = (b.exercises || []).map(fixBareNames);

    // Remove activation-style work from cool-down
    exercises = exercises.filter((e) => {
      const k = KEY(e.name);
      if (k === KEY('Band Pull-Aparts')) return false;
      if (k === KEY('Bodyweight Squats') || k === KEY('Bodyweight Squat')) return false;
      if (k === KEY('High Knees') || k === KEY('Butt Kicks')) return false;
      // Light Cardio in cool-down OK as downshift once — keep Easy Walk preferred
      return true;
    });

    // Remove exact duplicates of prep names except intentional foam roll after foam in prep
    exercises = exercises.filter((e) => {
      const k = KEY(e.name);
      if (prepNames.has(k) && !/foam roll|breathing|child pose/i.test(e.name || '')) {
        // Keep stretches even if similar mobility existed in prep (static vs dynamic)
        if (isStretchLike(e.name)) return true;
        return false;
      }
      return true;
    });

    day.blocks[i] = { ...b, exercises: dedupe(exercises) };
  }

  // Ensure cool-down matches tissues loaded
  let cdIdx = (day.blocks || []).findIndex((b) => /cool/i.test(b.name || ''));
  const target = [];
  if (demand.upper || (demand.press && !demand.lower)) {
    target.push(
      ex('Doorway Chest Stretch', { duration: '30 sec each side', instruction: 'Forearm on doorway; rotate torso away.', definition: 'Chest/anterior shoulder release after pressing' }),
      ex('Triceps + Lat Stretch', { duration: '30 sec each side', instruction: 'Arm overhead, elbow bent; gentle side lean.', definition: 'Lat and triceps length after pulling/pressing' }),
      ex('Upper Back Foam Roll', { duration: '30–45 sec', instruction: 'Roll mid-back only; support head.', definition: 'Thoracic soft-tissue recovery' }),
      ex('Lat Foam Roll', { duration: '30 sec each side', instruction: 'Side-lying; roll armpit to mid-rib.', definition: 'Lat recovery' }),
      ex('Box Breathing', { duration: '60 sec', instruction: 'Inhale 4, hold 4, exhale 4, hold 4.', definition: 'Nervous-system downshift' })
    );
  } else if (demand.hinge && demand.jump) {
    target.push(
      ex('Hamstring Stretch', { duration: '30 sec each side', instruction: 'Long-spine hinge; reach toward foot.', definition: 'Hamstring recovery after deadlift/jump' }),
      ex('Piriformis Stretch (Figure Four)', { duration: '30 sec each side', instruction: 'Ankle over knee; pull thigh toward chest.', definition: 'Glute recovery after hinging and jumping' }),
      ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Half-kneeling; tuck pelvis and lean forward.', definition: 'Hip flexor length after power work' }),
      ex('Foam Roll – Glutes & Hamstrings', { duration: '30 sec each', instruction: 'Slow rolls; pause on tender spots.', definition: 'Posterior-chain soft tissue' }),
      ex('Child Pose Breathing', { duration: '60 sec', instruction: 'Long nasal exhales.', definition: 'Parasympathetic downshift' })
    );
  } else if (demand.lower || demand.squat) {
    target.push(
      ex('Piriformis Stretch (Figure Four)', { duration: '30 sec each side', instruction: 'Ankle over knee; pull thigh toward chest.', definition: 'Glute/piriformis release after squatting' }),
      ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Half-kneeling; tuck pelvis and lean forward.', definition: 'Hip flexor length after squats/lunges' }),
      ex('Hamstring Stretch', { duration: '30 sec each side', instruction: 'Long-spine hinge stretch.', definition: 'Hamstring recovery after hinging accessories' }),
      ex('Foam Roll – Quads', { duration: '30–45 sec', instruction: 'Slow rolls hip to knee.', definition: 'Quad soft-tissue recovery' }),
      ex('Child Pose Breathing', { duration: '60 sec', instruction: 'Long nasal exhales.', definition: 'Nervous-system downshift' })
    );
  } else if (demand.sprint || /vo2|vo₂|interval|hill|mas/i.test(day.title || '')) {
    target.push(
      ex('Easy Walk', { duration: '2–3 min', instruction: 'Walk until breathing settles.', definition: 'Cardiovascular downshift' }),
      ex('Standing Calf Stretch', { duration: '30 sec each side', instruction: 'Heel down, knee straight then bent.', definition: 'Calf recovery after running' }),
      ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Half-kneeling hip flexor stretch.', definition: 'Hip recovery after sprinting' }),
      ex('Hamstring Stretch', { duration: '30 sec each side', instruction: 'Long-spine hinge stretch.', definition: 'Posterior chain recovery' }),
      ex('Box Breathing', { duration: '60 sec', instruction: 'Slow nasal box breathing.', definition: 'Nervous-system downshift' })
    );
  } else if (demand.conditioning) {
    target.push(
      ex('Easy Walk', { duration: '2–3 min', instruction: 'Walk to bring heart rate down.', definition: 'Cardiovascular downshift' }),
      ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Gentle half-kneeling stretch.', definition: 'Hip recovery' }),
      ex('Hamstring Stretch', { duration: '30 sec each side', instruction: 'Easy hamstring stretch.', definition: 'Posterior chain recovery' }),
      ex('Doorway Chest Stretch', { duration: '30 sec each side', instruction: 'Open chest after upper-body conditioning.', definition: 'Anterior shoulder recovery' }),
      ex('Child Pose Breathing', { duration: '60 sec', instruction: 'Long nasal exhales.', definition: 'Parasympathetic downshift' })
    );
  } else if (demand.full) {
    target.push(
      ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Half-kneeling stretch.', definition: 'Hip recovery' }),
      ex('Doorway Chest Stretch', { duration: '30 sec each side', instruction: 'Open chest after pressing.', definition: 'Anterior shoulder recovery' }),
      ex('Hamstring Stretch', { duration: '30 sec each side', instruction: 'Long-spine hinge stretch.', definition: 'Posterior chain recovery' }),
      ex('Upper Back Foam Roll', { duration: '30 sec', instruction: 'Gentle thoracic roll.', definition: 'Upper-back recovery' }),
      ex('Child Pose Breathing', { duration: '60 sec', instruction: 'Long nasal exhales.', definition: 'Nervous-system downshift' })
    );
  }

  if (target.length && !demand.recovery && !demand.rest) {
    if (cdIdx >= 0) {
      // Replace cool-down content with aligned set, preserving any unique high-quality stretches already present that match demand
      const existing = (day.blocks[cdIdx].exercises || []).map(fixBareNames);
      const keepBreathing = existing.filter((e) => /breathing|box breath|child pose/i.test(e.name || ''));
      day.blocks[cdIdx] = {
        ...day.blocks[cdIdx],
        name: /cool/i.test(day.blocks[cdIdx].name) ? day.blocks[cdIdx].name : 'Cool-Down',
        exercises: dedupe([...target, ...keepBreathing]),
      };
    } else {
      day.blocks.push({ name: 'Cool-Down', exercises: dedupe(target) });
    }
  }

  // Deduplicate across Cool-Down + Stretching
  const seen = new Set();
  for (const b of day.blocks || []) {
    if (!isCdBlock(b.name)) continue;
    const kept = [];
    for (const e of b.exercises || []) {
      const k = KEY(e.name);
      if (seen.has(k)) continue;
      seen.add(k);
      kept.push(fixBareNames(e));
    }
    b.exercises = kept;
  }
  day.blocks = (day.blocks || []).filter((b) => (b.exercises || []).length > 0 || (!isCdBlock(b.name) && !isPrepBlock(b.name)));
}

function moveStretchesOutOfMain(day) {
  const moved = [];
  for (let i = 0; i < (day.blocks || []).length; i++) {
    const b = day.blocks[i];
    if (isPrepBlock(b.name) || isCdBlock(b.name)) continue;
    if (/active recovery|recovery|rest/i.test(b.name || '')) continue;
    const keep = [];
    for (const e of b.exercises || []) {
      if (isStretchLike(e.name) && !/finisher|complex/i.test(b.name || '')) {
        // Stretches embedded mid-session as "restorative between sets" — move to cool-down
        moved.push(fixBareNames({
          ...e,
          trackingMode: e.trackingMode || 'time',
          duration: e.duration || '30 sec each side',
          instruction: e.instruction || `Perform ${e.name} as static recovery stretch.`,
          definition: e.definition || `Recovery stretch relocated from main block`,
        }));
      } else {
        keep.push(e);
      }
    }
    day.blocks[i] = { ...b, exercises: keep };
  }
  if (moved.length) {
    let cdIdx = day.blocks.findIndex((b) => /cool/i.test(b.name || ''));
    if (cdIdx >= 0) {
      day.blocks[cdIdx].exercises = mergeUnique(day.blocks[cdIdx].exercises || [], moved);
    } else {
      day.blocks.push({ name: 'Cool-Down', exercises: dedupe(moved) });
    }
  }
  // Drop empty main blocks
  day.blocks = day.blocks.filter((b) => (b.exercises || []).length > 0);
}

function alignFitnessStyleDay(day) {
  if (detectDemand(day).rest) return false;
  const before = JSON.stringify(day.blocks);
  const demand = detectDemand(day);
  const mains = mainNames(day);

  moveStretchesOutOfMain(day);
  cleanWarmup(day, demand);

  if (!demand.recovery) {
    const activation = replaceActivation(day, demand, mains);
    applyActivationBlock(day, activation);
  }

  // Recovery days: trim cool-down if Active Recovery already has full yoga — keep short downshift only
  if (demand.recovery) {
    const hasYoga = (day.blocks || []).some((b) =>
      (b.exercises || []).some((e) => /sun salutation|savasana|warrior|pigeon/i.test(e.name || ''))
    );
    if (hasYoga) {
      for (let i = 0; i < day.blocks.length; i++) {
        if (/cool/i.test(day.blocks[i].name || '')) {
          day.blocks[i] = {
            ...day.blocks[i],
            exercises: [
              ex('Box Breathing', { duration: '90 sec', instruction: 'Slow nasal box breathing to finish.', definition: 'Final nervous-system downshift after restorative flow' }),
            ],
          };
        }
      }
    }
  } else {
    cleanCooldown(day, demand);
  }

  // Cross-day duplicate: remove Activation Band Pull-Aparts if still present when Warm-up has them
  const wu = new Set();
  for (const b of day.blocks || []) {
    if (/warm/i.test(b.name || '')) (b.exercises || []).forEach((e) => wu.add(KEY(e.name)));
  }
  for (let i = 0; i < (day.blocks || []).length; i++) {
    if (!/activation/i.test(day.blocks[i].name || '')) continue;
    day.blocks[i].exercises = (day.blocks[i].exercises || []).filter((e) => {
      if (KEY(e.name) === KEY('Band Pull-Aparts') && wu.has(KEY('Band Pull-Aparts'))) return false;
      if (mains.has(KEY(e.name)) && KEY(e.name) === KEY('Dead Bug')) return false;
      if (mains.has(KEY(e.name)) && KEY(e.name) === KEY('Glute Bridge')) return false;
      return true;
    });
    // If Dead Bug removed due to main, ensure replacement
    if (!(day.blocks[i].exercises || []).length) {
      day.blocks[i].exercises = replaceActivation(day, demand, mains);
    }
  }

  // Soft-tissue in Mobility before lift: OK. Remove duplicate foam rolls from Mobility if identical in Cool-Down
  const cdFoam = new Set();
  for (const b of day.blocks || []) {
    if (isCdBlock(b.name)) {
      for (const e of b.exercises || []) {
        if (/foam roll/i.test(e.name || '')) cdFoam.add(KEY(e.name));
      }
    }
  }
  for (let i = 0; i < (day.blocks || []).length; i++) {
    if (!/^mobility$/i.test((day.blocks[i].name || '').trim())) continue;
    // Keep dynamic mobility; remove foam rolls that will be done in cool-down (prefer post-session for strength days)
    if (!demand.recovery) {
      day.blocks[i].exercises = (day.blocks[i].exercises || []).filter((e) => {
        if (/foam roll/i.test(e.name || '') && (cdFoam.has(KEY(e.name)) || demand.upper || demand.lower)) {
          return false;
        }
        return true;
      });
    }
  }
  day.blocks = day.blocks.filter((b) => (b.exercises || []).length > 0);

  return JSON.stringify(day.blocks) !== before;
}

function alignRugbyDay(day) {
  const demand = detectDemand(day);
  if (demand.rest && !/optional|mobility|recover/i.test(day.title || '')) {
    return false;
  }
  const before = JSON.stringify(day.blocks);

  // Fix bare names everywhere
  for (const b of day.blocks || []) {
    b.exercises = (b.exercises || []).map(fixBareNames);
  }

  // Align Potentiate to main work on conditioning circuit days
  const potIdx = (day.blocks || []).findIndex((b) => /^potentiate/i.test((b.name || '').trim()));
  const mainBlob = [...mainNames(day)].join(' ');
  if (potIdx >= 0) {
    if (/sled|box jump|medicine ball|farmer|tire/i.test(mainBlob)) {
      day.blocks[potIdx].exercises = dedupe([
        ex('Light Sled Push', { distance: '10m', trackingMode: 'distance', sets: 2, instruction: 'Easy drive; short steps, forward lean.', definition: 'Specific potentiation for sled work', rest: 30 }),
        ex('Small Box Jumps', { reps: 5, sets: 2, instruction: 'Low box; soft landing; step down.', definition: 'Jump potentiation before plyo/box work', rest: 45 }),
      ]);
    } else if (/clean|snatch|jerk|olympic/i.test(mainBlob) || demand.olympic) {
      // leave existing olympic potentiate if present and non-empty
      if (!(day.blocks[potIdx].exercises || []).length) {
        day.blocks[potIdx].exercises = [
          ex('High Knees', { duration: '15 sec per set', sets: 2, instruction: 'Quick knees, upright posture.', definition: 'CNS priming' }),
          ex('A-Skips', { reps: '20m', sets: 2, instruction: 'Light skip with quick ground contact.', definition: 'Elastic priming' }),
        ];
      }
    } else if (/sprint|shuttle|hill|agility|ladder/i.test(mainBlob) || demand.sprint) {
      const names = (day.blocks[potIdx].exercises || []).map((e) => KEY(e.name));
      if (!names.some((n) => /skip|stride|high knee|accel|ladder/i.test(n))) {
        day.blocks[potIdx].exercises = dedupe([
          ex('High Knees', { duration: '15 sec per set', sets: 2, instruction: 'Quick knees; tall posture.', definition: 'Sprint CNS priming' }),
          ex('A-Skips', { reps: '20m', sets: 2, instruction: 'Light elastic skips.', definition: 'Running mechanics potentiation' }),
        ]);
      }
    }
  }

  // Mobilize should match demand
  const mobIdx = (day.blocks || []).findIndex((b) => /^mobilize$/i.test((b.name || '').trim()));
  if (mobIdx >= 0 && (day.blocks[mobIdx].exercises || []).length) {
    // OK if present — ensure sprint days have ankle + hip
    if (demand.sprint || /sprint|hill|vo2|agility/i.test(day.title || '')) {
      const have = new Set((day.blocks[mobIdx].exercises || []).map((e) => KEY(e.name)));
      if (![...have].some((n) => /ankle/i.test(n))) {
        day.blocks[mobIdx].exercises.push(ex('Ankle Mobility Rocks', { reps: '8 each side', instruction: 'Knee over toes, heel down.', definition: 'Ankle prep for sprinting' }));
      }
      if (![...have].some((n) => /hip|world|opener/i.test(n))) {
        day.blocks[mobIdx].exercises.push(ex('Hip Openers (Open/Close Gate)', { reps: '6 each side', instruction: 'Open and close hip through full range.', definition: 'Hip mobility for sprint/COD' }));
      }
      day.blocks[mobIdx].exercises = dedupe(day.blocks[mobIdx].exercises);
    }
  }

  // Strength days: ensure Potentiate has empty bar patterns for squat/bench
  if (potIdx >= 0 && /squat|bench|deadlift/i.test(mainBlob) && !/circuit|sprint|olympic|clean/i.test(day.title || '')) {
    const pot = day.blocks[potIdx].exercises || [];
    const hasEmpty = pot.some((e) => /empty bar|empty barbell/i.test(e.name || ''));
    if (!hasEmpty && /squat|bench/i.test(mainBlob)) {
      const adds = [];
      if (/squat/i.test(mainBlob)) adds.push(ex('Empty Bar Squats', { reps: 5, sets: 2, instruction: 'Crisp empty-bar squat pattern.', definition: 'Squat pattern potentiation' }));
      if (/bench/i.test(mainBlob)) adds.push(ex('Empty Bar Bench Press', { reps: 5, sets: 2, instruction: 'Groove bench pattern with empty bar.', definition: 'Press pattern potentiation' }));
      if (adds.length) day.blocks[potIdx].exercises = mergeUnique(pot, adds);
    }
  }

  // Recovery: trim CD stretch duplicates vs yoga flow — keep foam + short stretch
  if (demand.recovery) {
    const yogaNames = new Set();
    for (const b of day.blocks || []) {
      if (/active recovery/i.test(b.name || '')) {
        (b.exercises || []).forEach((e) => yogaNames.add(KEY(e.name)));
      }
    }
    for (const b of day.blocks || []) {
      if (!/stretch/i.test(b.name || '')) continue;
      // Keep stretches not already in yoga; ensure calf/hip if foam is present
      b.exercises = (b.exercises || []).filter((e) => {
        // Always keep breathing
        if (/breath/i.test(e.name || '')) return true;
        // Drop if essentially same as yoga pose already done
        if (yogaNames.has(KEY(e.name))) return false;
        if (/child.?s? pose|seated forward fold|cat.?cow/i.test(e.name || '') && yogaNames.size) return false;
        return true;
      });
      if ((b.exercises || []).length < 2) {
        b.exercises = dedupe([
          ex('Hip Flexor Stretch', { duration: '45 sec each side', instruction: 'Half-kneeling; gentle lean.', definition: 'Hip flexor restoration' }),
          ex('Hamstring Stretch', { duration: '45 sec each side', instruction: 'Long-spine hinge.', definition: 'Hamstring restoration' }),
          ex('Box Breathing', { duration: '90 sec', instruction: 'Slow nasal box breathing.', definition: 'Final downshift' }),
        ]);
      }
    }
  }

  // Cool-down bare name fix already done; remove empty
  day.blocks = (day.blocks || []).filter((b) => (b.exercises || []).length > 0 || /rest/i.test(b.name || ''));

  // Deduplicate CD/stretching
  const seen = new Set();
  for (const b of day.blocks || []) {
    if (!isCdBlock(b.name) && !/foam/i.test(b.name || '')) continue;
    const kept = [];
    for (const e of b.exercises || []) {
      const k = KEY(e.name);
      if (seen.has(k)) continue;
      seen.add(k);
      kept.push(e);
    }
    b.exercises = kept;
  }

  return JSON.stringify(day.blocks) !== before;
}

function alignHypertrophyDay(day) {
  const before = JSON.stringify(day.blocks);
  moveStretchesOutOfMain(day);
  const demand = detectDemand(day);

  // Ensure a clear Warm-Up exists at start if only activation-named blocks
  const hasWarm = (day.blocks || []).some((b) => /warm/i.test(b.name || ''));
  if (!hasWarm && !demand.rest) {
    const raise = demand.upper
      ? [
          ex('Light Cardio', { duration: '3–5 min', instruction: 'Easy bike or row.', definition: 'Raise temperature before upper volume' }),
          ex('Arm Circles', { reps: '10 each way', instruction: 'Progressively larger circles.', definition: 'Shoulder warm-up' }),
          ex('Band Pull-Aparts', { reps: 15, instruction: 'Squeeze scapulae; control return.', definition: 'Scapular activation' }),
        ]
      : [
          ex('Light Cardio', { duration: '3–5 min', instruction: 'Easy bike or row.', definition: 'Raise temperature before lower loading' }),
          ex('Leg Swings (Front-to-Back)', { reps: '8 each leg', instruction: 'Controlled swings.', definition: 'Hip dynamic prep' }),
          ex('Hip Circles', { reps: '8 each direction per leg', instruction: 'Large controlled circles.', definition: 'Hip capsule prep' }),
          ex('Bodyweight Squat + Reach', { reps: 8, instruction: 'Heels down; reach overhead.', definition: 'Squat pattern prep' }),
        ];
    day.blocks.unshift({ name: 'Warm-Up', exercises: raise });
  }

  cleanCooldown(day, demand);
  // Fix bare names
  for (const b of day.blocks || []) b.exercises = (b.exercises || []).map(fixBareNames);

  return JSON.stringify(day.blocks) !== before;
}

function alignRecoveryWorkouts(data) {
  let changed = 0;
  for (const w of data.recoveryWorkouts || []) {
    const before = JSON.stringify(w.blocks);
    const id = w.id || '';

    // Expand vague circuit placeholders
    for (const b of w.blocks || []) {
      b.exercises = (b.exercises || []).flatMap((e) => {
        if (/hip mobility circuit/i.test(e.name || '')) {
          return [
            ex('Hip Circles', { reps: '10 each direction per leg', instruction: 'Large controlled knee circles.', definition: 'Hip mobility' }),
            ex('90/90 Hip Switches', { reps: '6 each side', instruction: 'Switch between 90/90 positions with tall posture.', definition: 'Hip internal/external rotation' }),
            ex("World's Greatest Stretch", { reps: '4 each side', instruction: 'Lunge with rotation.', definition: 'Hip and T-spine mobility' }),
          ];
        }
        if (/thoracic & shoulder mobility/i.test(e.name || '')) {
          return [
            ex('Thoracic Rotations (Quadruped)', { reps: '8 each side', instruction: 'Rotate through upper back; hips still.', definition: 'T-spine mobility' }),
            ex('Scapular Wall Slides', { reps: 10, instruction: 'Keep elbows/wrists on wall; slide up/down.', definition: 'Scapular mobility' }),
            ex('Doorway Chest Stretch', { duration: '30 sec each side', instruction: 'Gentle chest opener.', definition: 'Anterior shoulder length' }),
          ];
        }
        if (/full body stretch/i.test(e.name || '')) {
          return [
            ex('Hip Flexor Stretch', { duration: '45 sec each side', instruction: 'Half-kneeling stretch.', definition: 'Hip flexor restoration' }),
            ex('Hamstring Stretch', { duration: '45 sec each side', instruction: 'Long-spine hinge.', definition: 'Hamstring restoration' }),
            ex('Child Pose Breathing', { duration: '90 sec', instruction: 'Long nasal exhales.', definition: 'Downshift' }),
          ];
        }
        return [fixBareNames(e)];
      });
      b.exercises = dedupe(b.exercises);
    }

    // Breathwork: remove heavy mobility pack — keep breathing primary + 2 gentle openers
    if (/breath/i.test(id)) {
      const breathBlock = w.blocks.find((b) => /breath/i.test(b.name || ''));
      w.blocks = [
        breathBlock || w.blocks[0],
        {
          name: 'Gentle Openers',
          exercises: [
            ex('Cat-Cow', { reps: 10, instruction: 'Slow spinal flexion/extension with breath.', definition: 'Gentle spinal mobility' }),
            ex('Child Pose Breathing', { duration: '2 min', instruction: 'Rest forehead down; long exhales.', definition: 'Restorative downshift' }),
          ],
        },
      ].filter(Boolean);
    }

    // Yoga: cool-down should be breathing only (flow already stretches)
    if (/yoga/i.test(id)) {
      for (const b of w.blocks || []) {
        if (/cool/i.test(b.name || '')) {
          b.exercises = [
            ex('Box Breathing', { duration: '2 min', instruction: 'Inhale 4, hold 4, exhale 4, hold 4.', definition: 'Final downshift after yoga flow' }),
          ];
        }
      }
    }

    // Pool: keep water work; land mobility should be short and restorative
    if (/pool/i.test(id)) {
      for (const b of w.blocks || []) {
        if (/mobility|stretch/i.test(b.name || '')) {
          b.exercises = dedupe([
            ex('Hip Flexor Stretch', { duration: '30 sec each side', instruction: 'Gentle half-kneeling stretch.', definition: 'Hip restoration after pool work' }),
            ex('Doorway Chest Stretch', { duration: '30 sec each side', instruction: 'Open chest gently.', definition: 'Anterior shoulder restoration' }),
            ex('Child Pose Breathing', { duration: '60 sec', instruction: 'Long nasal exhales.', definition: 'Downshift' }),
          ]);
        }
      }
    }

    if (JSON.stringify(w.blocks) !== before) changed++;
  }
  return changed;
}

function processProgram(file, style) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = [];
  for (const m of data.macrocycle?.mesocycles || []) {
    for (const day of m.microcycle || []) {
      let changed = false;
      if (style === 'rugby') changed = alignRugbyDay(day);
      else if (style === 'hypertrophy') changed = alignHypertrophyDay(day);
      else changed = alignFitnessStyleDay(day);
      if (changed) report.push(`${m.id} D${day.day} ${day.title}`);
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return report;
}

console.log('PT/trainer day-by-day alignment...\n');
const fitness = processProgram('src/data/FitnessProgram.json', 'fitness');
console.log(`Fitness: ${fitness.length} days aligned`);
fitness.forEach((l) => console.log(' ', l));

const rugby = processProgram('src/data/rugbyProgram.json', 'rugby');
console.log(`\nRugby: ${rugby.length} days aligned`);
rugby.forEach((l) => console.log(' ', l));

const hypert = processProgram('src/data/HypertrophyMonth.json', 'hypertrophy');
console.log(`\nHypertrophy: ${hypert.length} days aligned`);
hypert.forEach((l) => console.log(' ', l));

const simple = processProgram('src/data/simpleweightProgram.json', 'fitness');
console.log(`\nSimple: ${simple.length} days aligned`);
simple.forEach((l) => console.log(' ', l));

const rec = JSON.parse(fs.readFileSync('src/data/recoveryWorkouts.json', 'utf8'));
const recN = alignRecoveryWorkouts(rec);
fs.writeFileSync('src/data/recoveryWorkouts.json', JSON.stringify(rec, null, 2) + '\n');
console.log(`\nRecovery workouts changed: ${recN}`);
console.log('\nDone.');
