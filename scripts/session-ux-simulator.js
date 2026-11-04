/**
 * Session UX Simulator
 *
 * Walks through every session in the 20-week program as a user would, flags UX issues,
 * and outputs a report with suggestions. Runs in seconds without the app.
 */

const fs = require('fs');
const path = require('path');

const PROGRAM_PATH = path.join(__dirname, '../src/data/FitnessProgram.json');
const OUTPUT_JSON = path.join(__dirname, '../UX_TEST_REPORT.json');
const OUTPUT_MD = path.join(__dirname, '../UX_TEST_SUGGESTIONS.md');

const data = JSON.parse(fs.readFileSync(PROGRAM_PATH, 'utf8'));
const macro = data.macrocycle;

// --- Duration parsing (matches SessionScreen/audit) ---
function parseDurationToSeconds(duration) {
  if (!duration) return { seconds: 60, parseable: false };
  const lower = String(duration).toLowerCase().trim();
  const hasEachSide = lower.includes('each side');
  const multiplier = hasEachSide ? 2 : 1;
  const clean = lower.replace(/\s*each\s+side\s*/g, '').replace(/\s*per\s+set\s*/g, '').trim();

  if (/hard\s*\/|easy\s*\/|\/\s*\d+s/.test(clean)) {
    const match = clean.match(/(\d+)\s*s/);
    return { seconds: match ? parseInt(match[1], 10) * multiplier : 60, parseable: !!match };
  }

  const rangeMin = clean.match(/^(\d+)\s*-\s*(\d+)\s*min/);
  if (rangeMin) return { seconds: parseInt(rangeMin[2], 10) * 60 * multiplier, parseable: true };

  const minMatch = clean.match(/^(\d+)\s*min/);
  if (minMatch) return { seconds: parseInt(minMatch[1], 10) * 60 * multiplier, parseable: true };

  const rangeSec = clean.match(/^(\d+)\s*-\s*(\d+)\s*sec/);
  if (rangeSec) return { seconds: parseInt(rangeSec[2], 10) * multiplier, parseable: true };

  const secMatch = clean.match(/^(\d+)\s*sec/);
  if (secMatch) return { seconds: parseInt(secMatch[1], 10) * multiplier, parseable: true };

  const bareSec = clean.match(/^(\d+)s$/);
  if (bareSec) return { seconds: parseInt(bareSec[1], 10) * multiplier, parseable: true };

  const timeMatch = clean.match(/^(\d+):(\d+)$/);
  if (timeMatch)
    return {
      seconds: (parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)) * multiplier,
      parseable: true,
    };

  const plain = parseInt(clean, 10);
  if (!isNaN(plain)) return { seconds: plain * multiplier, parseable: true };

  return { seconds: 60, parseable: false };
}

// --- Flow expansion (matches program.ts) ---
function parseSetsAndReps(repsString) {
  if (!repsString) return { isTimeBased: false };
  const setRepsMatch = repsString.match(/^(\d+)\s*[×x]\s*(.+)$/i);
  if (setRepsMatch) {
    return {
      sets: parseInt(setRepsMatch[1], 10),
      reps: setRepsMatch[2].trim(),
      isTimeBased: false,
    };
  }
  const isTimeBased = /(sec|min|second|minute)/i.test(repsString);
  if (isTimeBased) return { reps: repsString, isTimeBased: true };
  const isNumber = /^\d+/.test(repsString);
  if (isNumber) return { reps: repsString, isTimeBased: false };
  return { reps: repsString, isTimeBased: false };
}

function convertFlowStepsToExercises(flowSteps, parentExercise) {
  return flowSteps.map((step) => {
    const exercise = { name: step.name };
    const { sets, reps, isTimeBased } = parseSetsAndReps(step.reps);

    if (sets !== undefined) {
      exercise.trackingMode = 'volume';
      exercise.sets = sets;
      if (reps) exercise.reps = reps;
    } else if (isTimeBased || (!reps && step.duration)) {
      exercise.trackingMode = 'time';
      exercise.sets = 1;
      if (step.duration) exercise.duration = step.duration;
      if (reps && isTimeBased) exercise.reps = reps;
    } else if (reps) {
      exercise.trackingMode = 'volume';
      exercise.sets = 1;
      exercise.reps = reps;
    } else {
      exercise.trackingMode = 'time';
      exercise.sets = 1;
      if (step.duration) exercise.duration = step.duration;
    }

    if (step.cue) exercise.notes = step.cue;
    if (step.detailedInstructions && step.detailedInstructions.length > 0) {
      exercise.instruction = step.detailedInstructions.join('\n');
    }
    if (parentExercise.flowGroupType) exercise.flowGroupType = parentExercise.flowGroupType;
    if (parentExercise.rest !== undefined) exercise.rest = parentExercise.rest;

    return exercise;
  });
}

function expandFlowExercisesInBlocks(blocks) {
  return blocks.map((block) => {
    const expandedExercises = [];
    for (const exercise of block.exercises) {
      if (exercise.lockStructure === true || exercise.skipExpansion === true) {
        expandedExercises.push(exercise);
      } else if (exercise.flowSteps && exercise.flowSteps.length > 0) {
        expandedExercises.push(...convertFlowStepsToExercises(exercise.flowSteps, exercise));
      } else {
        expandedExercises.push(exercise);
      }
    }
    return { ...block, exercises: expandedExercises };
  });
}

function flattenExercises(blocks) {
  const result = [];
  blocks.forEach((block, blockIndex) => {
    block.exercises.forEach((exercise, exerciseIndex) => {
      result.push({
        ...exercise,
        blockName: block.name,
        blockIndex,
        exerciseIndex,
      });
    });
  });
  return result;
}

function isWarmupCooldownBlock(blockName) {
  const lower = (blockName || '').toLowerCase();
  return [
    'warm-up', 'warm up', 'cool-down', 'cool down', 'cooldown',
    'activation', 'mobility', 'stretching', 'breathing', 'recovery',
    'raise', 'activate', 'mobilize', 'potentiate',
  ].some((p) => lower.includes(p));
}

// --- Helpers for progression/history/suggestions ---
function parseNumericReps(reps) {
  if (reps === undefined) return null;
  if (typeof reps === 'number') return reps;
  const parsed = parseInt(String(reps).trim(), 10);
  if (!isNaN(parsed) && String(parsed) === String(reps).trim()) return parsed;
  return null;
}

function parseIntensityPercent(intensity) {
  if (!intensity) return null;
  const rangeMatch = String(intensity).match(/(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\s*%/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2 / 100;
  }
  const singleMatch = String(intensity).match(/(\d+(?:\.\d+)?)\s*%/);
  if (singleMatch) return parseFloat(singleMatch[1]) / 100;
  return null;
}

function isBodyweightByName(exercise) {
  const nameLower = (exercise.name || '').toLowerCase();
  const keywords = [
    'bodyweight', 'body weight', 'band', 'banded', 'push-up', 'pushup', 'pull-up', 'pullup',
    'plank', 'dead bug', 'bird dog', 'glute bridge', 'mountain climber', 'burpee', 'crunch',
    'sit-up', 'hollow hold', 'side plank', 'wall sit', 'lunge', 'calf raise', 'leg raise',
    'dip', 'chin-up', 'activation', 'mobility', 'stretch', 'pvc', 'band pull-apart',
  ];
  return keywords.some((k) => nameLower.includes(k));
}

function isCompoundByName(exercise) {
  const nameLower = (exercise.name || '').toLowerCase();
  const compounds = ['squat', 'deadlift', 'bench', 'press', 'row', 'clean', 'snatch', 'jerk', 'lunge', 'hip thrust'];
  return compounds.some((c) => nameLower.includes(c));
}

function getBlockType(block) {
  if (block.groupType === 'block') return 'standard';
  if (block.groupType) return block.groupType;
  if (block.blockType) return block.blockType;
  if (block.rounds && block.rounds > 1) return 'circuit';
  const lower = (block.name || '').toLowerCase();
  if (lower.includes('complex') || lower.includes('olympic')) return 'complex';
  if (lower.includes('circuit') || lower.includes('conditioning circuit')) return 'circuit';
  if (lower.includes('superset') || lower.includes('super set') || lower.includes('contrast') || lower.includes('density')) return 'superset';
  if (block.exercises && block.exercises.length > 1 && block.exercises.every((e) => e.sets === 1)) return 'superset';
  return 'standard';
}

// --- Build session (simplified: no mobility injection) ---
function buildSession(meso, weekIndex, day) {
  let blocks = JSON.parse(JSON.stringify(day.blocks));
  const weekKey = `week${meso.weeks[weekIndex] ?? weekIndex + 1}`;
  const adjustments = meso.weeklyAdjustments?.[weekKey];
  if (adjustments && typeof adjustments === 'object') {
    const dayKey = `day${day.day}`;
    const dayAdj = adjustments[dayKey];
    if (dayAdj && typeof dayAdj === 'object') {
      if (dayAdj.exercises) {
        const exerciseAdjs = dayAdj.exercises;
        blocks = blocks.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) => {
            const adj = exerciseAdjs[ex.name];
            return adj ? { ...ex, ...adj } : ex;
          }),
        }));
      }
      if (dayAdj.blocks) {
        const blockAdjs = dayAdj.blocks;
        blocks = blocks.map((block) => {
          const adj = blockAdjs[block.name];
          return adj ? { ...block, ...adj } : block;
        });
      }
    }
  }
  blocks = expandFlowExercisesInBlocks(blocks);
  return { blocks, day, meso, weekIndex };
}

// --- UX Analysis ---
const findings = [];
const issuesByType = {};
const HIGH_INPUT_THRESHOLD = 12; // weight+reps inputs before moving on
const LONG_TIMER_BLOCK_SECONDS = 600; // 10 min of timers in one block
const VERY_LONG_SINGLE_DURATION_SEC = 300; // 5 min single exercise

function record(type, severity, ctx, msg, suggestion, meta = {}) {
  const key = `${type}:${severity}`;
  issuesByType[key] = (issuesByType[key] || 0) + 1;
  findings.push({
    type,
    severity,
    ...ctx,
    message: msg,
    suggestion: suggestion || null,
    ...meta,
  });
}

function analyzeExercise(ex, idx, ctx) {
  const { sessionId, dayTitle, mesoTitle, weekNum, blockName } = ctx;

  // 1. Missing name or trackingMode
  if (!ex.name || !ex.trackingMode) {
    record('missing_required', 'error', ctx, `Missing name or trackingMode`, 'Add name and trackingMode to exercise', { exerciseIndex: idx });
  }

  const blockNameLower = (blockName || '').toLowerCase();
  const isWarmupCooldown = isWarmupCooldownBlock(blockName);

  // 2. Determine user action type
  let userAction = 'unknown';
  if (isWarmupCooldown) {
    if ((ex.trackingMode === 'time' && ex.duration) || (ex.trackingMode === 'volume' && ex.reps)) {
      userAction = ex.sets > 1 ? 'time_based_multiset' : 'checkbox_or_timer';
    } else {
      userAction = 'checkbox';
    }
  } else if (ex.trackingMode === '1RM' || (ex.trackingMode === 'volume' && ex.sets && ex.reps)) {
    userAction = 'set_logging';
  } else if (ex.trackingMode === 'time' && ex.sets > 1 && ex.rest) {
    userAction = 'interval_timer';
  } else if (ex.trackingMode === 'time' && ex.duration) {
    userAction = 'time_based_timer';
  } else if (ex.trackingMode === 'distance' && ex.sets) {
    userAction = ex.sets > 1 && ex.rest ? 'interval_timer' : 'set_logging';
  } else {
    userAction = 'checkbox';
  }

  // 3. Duration parseability
  if (ex.trackingMode === 'time' && ex.duration) {
    const { seconds, parseable } = parseDurationToSeconds(ex.duration);
    if (!parseable) {
      record(
        'duration_unparseable',
        'warning',
        ctx,
        `Duration may not parse: "${ex.duration}"`,
        `Use format like "30 sec", "2 min", or "1:30"`,
        { exerciseIndex: idx, fallbackSeconds: seconds }
      );
    }
    if (parseable && seconds > VERY_LONG_SINGLE_DURATION_SEC) {
      record(
        'long_single_timer',
        'suggestion',
        ctx,
        `Single exercise timer very long: ${ex.duration} (${Math.round(seconds / 60)} min)`,
        'Consider splitting or adding rest checkpoints',
        { exerciseIndex: idx, seconds }
      );
    }
  }

  // 4. Missing rest for volume/1RM with multiple sets
  const needsRest =
    (ex.trackingMode === 'volume' || ex.trackingMode === '1RM') &&
    ex.sets &&
    ex.sets > 1 &&
    !isWarmupCooldown &&
    !ex.isFlowGroup;
  if (needsRest && ex.rest === undefined) {
    record(
      'missing_rest',
      'warning',
      ctx,
      `Volume/1RM with sets>1 but no rest`,
      'Add rest (e.g. 90) for recovery between sets',
      { exerciseIndex: idx, suggested: 90 }
    );
  }

  // 5. Interval (time/distance, sets>1) missing rest
  const wantsIntervalRest =
    (ex.trackingMode === 'time' || ex.trackingMode === 'distance') && ex.sets && ex.sets > 1;
  if (wantsIntervalRest && !ex.rest) {
    record(
      'interval_missing_rest',
      'error',
      ctx,
      `Interval exercise with sets>1 needs rest`,
      'Add rest (e.g. 60) for work/rest intervals',
      { exerciseIndex: idx, suggested: 60 }
    );
  }

  // 6. 1RM missing intensity
  if (ex.trackingMode === '1RM' && !ex.intensity) {
    record('1rm_missing_intensity', 'error', ctx, `1RM exercise missing intensity`, 'Add intensity (e.g. "70% 1RM")', { exerciseIndex: idx });
  }

  // 7. No instruction for complex exercises
  if (!isWarmupCooldown && !ex.instruction && (ex.trackingMode === '1RM' || (ex.sets && ex.sets > 2))) {
    record(
      'missing_instruction',
      'suggestion',
      ctx,
      `No instruction for ${ex.name}`,
      'Add instruction for form/setup cues',
      { exerciseIndex: idx }
    );
  }

  // --- History / suggestions / progression checks ---

  // 8. 1RM intensity parseable and in valid range
  if (ex.trackingMode === '1RM' && ex.intensity) {
    const pct = parseIntensityPercent(ex.intensity);
    if (pct === null) {
      record(
        'intensity_unparseable',
        'warning',
        ctx,
        `1RM intensity may not parse: "${ex.intensity}"`,
        'Use format like "70% 1RM" or "80-85% TM"',
        { exerciseIndex: idx }
      );
    } else if (pct < 0.3 || pct > 1.1) {
      record(
        'intensity_out_of_range',
        'warning',
        ctx,
        `1RM intensity ${ex.intensity} (${Math.round(pct * 100)}%) outside typical 30-110%`,
        'Verify intended load',
        { exerciseIndex: idx, parsedPercent: pct }
      );
    }
  }

  // 9. 1RM compound: formCues for better UX
  if (
    !isWarmupCooldown &&
    ex.trackingMode === '1RM' &&
    isCompoundByName(ex) &&
    (!ex.formCues || !Array.isArray(ex.formCues) || ex.formCues.length === 0)
  ) {
    record(
      '1rm_compound_missing_formcues',
      'suggestion',
      ctx,
      `1RM compound ${ex.name} has no formCues`,
      'Add formCues array for in-session guidance',
      { exerciseIndex: idx }
    );
  }

  // 10. Volume/Rule of 3: targetRPE for quality gate
  if (
    !isWarmupCooldown &&
    ex.trackingMode === 'volume' &&
    ex.sets >= 3 &&
    ex.reps &&
    ex.targetRPE === undefined
  ) {
    record(
      'volume_missing_targetrpe',
      'suggestion',
      ctx,
      `Volume exercise ${ex.name} (3+ sets) has no targetRPE`,
      'Add targetRPE (e.g. 7) for Rule of 3 quality gate',
      { exerciseIndex: idx }
    );
  }

  // 11. Volume/Rule of 3: reps parseable for progression
  if (
    !isWarmupCooldown &&
    ex.trackingMode === 'volume' &&
    ex.sets >= 3 &&
    ex.reps &&
    parseNumericReps(ex.reps) === null
  ) {
    const repsStr = typeof ex.reps === 'string' ? ex.reps : String(ex.reps);
    if (!/amrap|max|as many/i.test(repsStr)) {
      record(
        'reps_not_numeric',
        'suggestion',
        ctx,
        `Volume reps "${repsStr}" may not parse for Rule of 3 progression`,
        'Use numeric target (e.g. "10") for progression tracking',
        { exerciseIndex: idx }
      );
    }
  }

  // 12. 1RM/volume weighted: minIncrement for suggested weight step
  if (
    !isWarmupCooldown &&
    (ex.trackingMode === '1RM' || ex.trackingMode === 'volume') &&
    !isBodyweightByName(ex) &&
    ex.minIncrement === undefined
  ) {
    record(
      'weighted_missing_minincrement',
      'suggestion',
      ctx,
      `Weighted exercise ${ex.name} has no minIncrement`,
      'Add minIncrement (e.g. 2.5 for barbell) for weight step suggestions',
      { exerciseIndex: idx }
    );
  }

  // 13. exerciseCategory for 1RM inference
  if (
    !isWarmupCooldown &&
    ex.trackingMode === '1RM' &&
    !ex.exerciseCategory &&
    isCompoundByName(ex)
  ) {
    record(
      '1rm_missing_exercisecategory',
      'suggestion',
      ctx,
      `1RM compound ${ex.name} has no exerciseCategory`,
      'Add exerciseCategory: "compound" for load inference',
      { exerciseIndex: idx }
    );
  }

  // 14. Substitutions: empty or placeholder
  if (ex.substitutions && Array.isArray(ex.substitutions)) {
    if (ex.substitutions.length === 0) {
      record(
        'substitutions_empty',
        'suggestion',
        ctx,
        `Exercise ${ex.name} has empty substitutions array`,
        'Remove or add valid substitution options',
        { exerciseIndex: idx }
      );
    } else if (ex.substitutions.some((s) => !s || String(s).trim().length < 2)) {
      record(
        'substitutions_invalid',
        'warning',
        ctx,
        `Exercise ${ex.name} has invalid substitution entries`,
        'Ensure all substitutions are non-empty strings',
        { exerciseIndex: idx }
      );
    }
  }

  // 15. Definition for non-obvious exercises
  if (
    !isWarmupCooldown &&
    !ex.definition &&
    (ex.trackingMode === '1RM' || (ex.trackingMode === 'volume' && ex.sets >= 3)) &&
    /^(optional|arm exercise|accessory|finisher)\s*\d*$/i.test((ex.name || '').trim())
  ) {
    record(
      'placeholder_missing_definition',
      'suggestion',
      ctx,
      `Placeholder-style exercise ${ex.name} has no definition`,
      'Replace with concrete exercise or add definition',
      { exerciseIndex: idx }
    );
  }

  // 16. Tempo format (if present)
  if (ex.tempo && ex.tempo.trim()) {
    const t = ex.tempo.trim();
    const standardTempo = /^\d+[–-]\d+[–-]([Xx]|\d+)$/.test(t) || /^\d+-\d+-\d+$/.test(t);
    if (!standardTempo && t.length > 2) {
      record(
        'tempo_format_unusual',
        'suggestion',
        ctx,
        `Tempo "${ex.tempo}" may not match standard X-X-X format`,
        'Use format like "3-0-X" (eccentric-pause-concentric)',
        { exerciseIndex: idx }
      );
    }
  }

  // 17. Placeholder/generic exercise names
  if (ex.name && /^(exercise\s*\d+|arm exercise\s*\d+)$/i.test(ex.name.trim())) {
    record(
      'generic_exercise_name',
      'suggestion',
      ctx,
      `Generic name "${ex.name}" - consider specific exercise`,
      'Use concrete exercise name for history and suggestions',
      { exerciseIndex: idx }
    );
  }

  return userAction;
}

function analyzeSession(allExercises, sessionCtx, day) {
  // Session duration sanity
  const duration = day.durationMinutes;
  if (duration !== undefined) {
    if (duration <= 0) {
      record('session_duration_zero', 'warning', { ...sessionCtx, blockName: '(session)' }, 'Session has durationMinutes 0 or negative', 'Set realistic duration', { duration });
    } else if (duration < 15) {
      record('session_duration_short', 'suggestion', { ...sessionCtx, blockName: '(session)' }, `Session only ${duration} min - verify intended length`, 'Recovery sessions may be short; strength typically 45-90 min', { duration });
    } else if (duration > 120) {
      record('session_duration_long', 'suggestion', { ...sessionCtx, blockName: '(session)' }, `Session ${duration} min - may be too long for most users`, 'Consider splitting or reducing volume', { duration });
    }
  }

  // Duplicate exercise names in session → history/progression collision
  const byName = {};
  allExercises.forEach((ex, idx) => {
    const name = (ex.name || '').trim();
    if (!name) return;
    if (!byName[name]) byName[name] = [];
    byName[name].push({ blockName: ex.blockName, exerciseIndex: idx });
  });
  Object.entries(byName).forEach(([name, occurrences]) => {
    if (occurrences.length > 1) {
      record(
        'duplicate_exercise_name',
        'warning',
        { ...sessionCtx, blockName: '(session)' },
        `"${name}" appears ${occurrences.length} times in session - history keys will collide`,
        'Rename or use distinct identifiers for each occurrence',
        { occurrences: occurrences.map((o) => `${o.blockName} (idx ${o.exerciseIndex})`) }
      );
    }
  });
}

function analyzeBlock(block, blockIdx, sessionCtx, allExercisesInBlock) {
  const ctx = { ...sessionCtx, blockName: block.name, blockIndex: blockIdx };
  const blockType = getBlockType(block);

  const isWarmupCooldown = isWarmupCooldownBlock(block.name);
  // Circuit without restBetweenRounds (exclude warm-up/cool-down sequences)
  if (
    (blockType === 'circuit' || block.rounds > 1) &&
    block.restBetweenRounds === undefined &&
    block.restBetweenRounds !== 0 &&
    !isWarmupCooldown
  ) {
    record(
      'circuit_missing_rest',
      'warning',
      ctx,
      `Circuit block "${block.name}" without restBetweenRounds`,
      'Add restBetweenRounds (e.g. 60)',
      { suggested: 60 }
    );
  }
  if (
    blockType === 'superset' &&
    block.exercises?.length > 1 &&
    block.restBetweenRounds === undefined &&
    block.restBetweenRounds !== 0 &&
    !isWarmupCooldown
  ) {
    record(
      'superset_missing_rest',
      'warning',
      ctx,
      `Superset "${block.name}" without restBetweenRounds`,
      'Add restBetweenRounds (e.g. 90)',
      { suggested: 90 }
    );
  }

  // High input burden: many set-logging exercises in one block
  const setLoggingCount = allExercisesInBlock.filter(
    (e) =>
      !isWarmupCooldownBlock(block.name) &&
      (e.trackingMode === 'volume' || e.trackingMode === '1RM') &&
      e.sets &&
      e.reps
  ).length;
  const totalInputs = allExercisesInBlock.reduce((sum, e) => {
    if (isWarmupCooldownBlock(block.name)) return sum;
    if (e.trackingMode === 'volume' || e.trackingMode === '1RM') {
      const sets = e.sets || 1;
      return sum + sets * 2; // weight + reps per set
    }
    return sum;
  }, 0);
  if (totalInputs > HIGH_INPUT_THRESHOLD) {
    record(
      'high_input_burden',
      'suggestion',
      ctx,
      `Block has ${totalInputs} weight/reps inputs before moving on`,
      'Consider splitting block or reducing sets for better flow',
      { totalInputs, exerciseCount: allExercisesInBlock.length }
    );
  }

  // Long timer block: sum of time-based durations
  let blockTimerSeconds = 0;
  allExercisesInBlock.forEach((e) => {
    if (e.trackingMode === 'time' && e.duration) {
      const { seconds } = parseDurationToSeconds(e.duration);
      const sets = e.sets || 1;
      blockTimerSeconds += seconds * sets;
    }
  });
  if (blockTimerSeconds > LONG_TIMER_BLOCK_SECONDS) {
    record(
      'long_timer_block',
      'suggestion',
      ctx,
      `Block has ~${Math.round(blockTimerSeconds / 60)} min of timer-based exercises`,
      'Consider shorter holds or adding variety',
      { blockTimerSeconds }
    );
  }
}

// --- Main ---
let sessionCount = 0;
let exerciseCount = 0;

macro.mesocycles.forEach((meso) => {
  const weekCount = meso.weeks?.length ?? 1;
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    (meso.microcycle || []).forEach((day) => {
      sessionCount++;
      const sessionId = `${meso.id}-week${weekIndex}-day-${day.day}`;
      const sessionCtx = {
        sessionId,
        mesoTitle: meso.title,
        weekNum: meso.weeks?.[weekIndex] ?? weekIndex + 1,
        dayTitle: day.title,
        dayNumber: day.day,
      };

      const { blocks } = buildSession(meso, weekIndex, day);
      const allExercises = flattenExercises(blocks);

      analyzeSession(allExercises, sessionCtx, day);

      blocks.forEach((block, blockIdx) => {
        const blockExercises = block.exercises.map((ex, i) => ({
          ...ex,
          blockName: block.name,
          blockIndex: blockIdx,
          exerciseIndex: allExercises.findIndex(
            (e) => e.name === ex.name && e.blockName === block.name && e.blockIndex === blockIdx
          ),
        }));
        analyzeBlock(block, blockIdx, sessionCtx, block.exercises);
      });

      allExercises.forEach((ex, idx) => {
        exerciseCount++;
        analyzeExercise(ex, idx, {
          ...sessionCtx,
          blockName: ex.blockName,
          blockIndex: ex.blockIndex,
        });
      });
    });
  }
});

// --- Output ---
const summary = {
  sessionsAnalyzed: sessionCount,
  exercisesAnalyzed: exerciseCount,
  totalFindings: findings.length,
  byType: issuesByType,
  errorCount: findings.filter((f) => f.severity === 'error').length,
  warningCount: findings.filter((f) => f.severity === 'warning').length,
  suggestionCount: findings.filter((f) => f.severity === 'suggestion').length,
};

const report = {
  summary,
  findings,
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));

// Markdown suggestions
const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warning');
const suggestions = findings.filter((f) => f.severity === 'suggestion');

let md = `# Session UX Test Suggestions

Generated: ${new Date().toISOString()}

## Summary

- **Sessions analyzed:** ${sessionCount}
- **Exercises analyzed:** ${exerciseCount}
- **Total findings:** ${findings.length}
  - Errors: ${errors.length}
  - Warnings: ${warnings.length}
  - Suggestions: ${suggestions.length}

---

## Errors (fix these first)

`;

errors.slice(0, 50).forEach((f) => {
  md += `- **${f.sessionId}** / ${f.blockName || '(session)'} / ${f.message}`;
  if (f.suggestion) md += `\n  - Suggestion: ${f.suggestion}`;
  md += '\n';
});
if (errors.length > 50) md += `\n... and ${errors.length - 50} more (see UX_TEST_REPORT.json)\n`;

md += `\n---

## Warnings (review)

`;

warnings.slice(0, 30).forEach((f) => {
  md += `- **${f.sessionId}** / ${f.blockName || '(session)'} / ${f.message}`;
  if (f.suggestion) md += `\n  - Suggestion: ${f.suggestion}`;
  md += '\n';
});
if (warnings.length > 30) md += `\n... and ${warnings.length - 30} more\n`;

md += `\n---

## Suggestions (UX improvements)

`;

suggestions.slice(0, 30).forEach((f) => {
  md += `- **${f.sessionId}** / ${f.blockName || '(session)'} / ${f.message}`;
  if (f.suggestion) md += `\n  - Suggestion: ${f.suggestion}`;
  md += '\n';
});
if (suggestions.length > 30) md += `\n... and ${suggestions.length - 30} more\n`;

md += `
---

Full structured report: \`UX_TEST_REPORT.json\`
`;

fs.writeFileSync(OUTPUT_MD, md);

console.log('=== Session UX Simulator ===\n');
console.log(`Sessions: ${sessionCount}, Exercises: ${exerciseCount}`);
console.log(`Findings: ${findings.length} (${summary.errorCount} errors, ${summary.warningCount} warnings, ${summary.suggestionCount} suggestions)`);
console.log(`\nOutputs:\n  - ${OUTPUT_JSON}\n  - ${OUTPUT_MD}`);
