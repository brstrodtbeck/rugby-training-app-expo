/**
 * Audit script: timers and block structure (read-only).
 * Reports which exercises get interval timer (current vs after rule change),
 * block type, warm-up/cool-down, and in-group vs standalone.
 */
const fs = require('fs');
const path = require('path');

const programPath = path.join(__dirname, '../src/data/FitnessProgram.json');
const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));

function getBlockType(block) {
  if (block.groupType) {
    if (block.groupType === 'block') return 'standard';
    return block.groupType;
  }
  if (block.blockType) return block.blockType;
  if (block.rounds && block.rounds > 1) return 'circuit';
  const lowerName = (block.name || '').toLowerCase();
  if (lowerName.includes('complex') || lowerName.includes('olympic')) return 'complex';
  if (lowerName.includes('circuit') || lowerName.includes('conditioning circuit')) return 'circuit';
  if (lowerName.includes('superset') || lowerName.includes('super set')) return 'superset';
  if (lowerName.includes('contrast') || lowerName.includes('density')) return 'superset';
  if (block.exercises && block.exercises.length > 1 && block.exercises.every(e => e.sets === 1)) return 'superset';
  return 'standard';
}

function isWarmupCooldownBlock(blockName) {
  const n = (blockName || '').toLowerCase();
  return n.includes('warm') || n.includes('cool') || n.includes('cooldown')
    || n.includes('activation') || n.includes('mobility') || n.includes('stretching')
    || n.includes('breathing') || n.includes('recovery') || n === 'raise' || n === 'activate'
    || n === 'mobilize' || n === 'potentiate';
}

function hasSetReps(ex) {
  const r = ex.reps;
  if (r == null) return false;
  if (typeof r === 'number') return r > 0;
  if (typeof r === 'string') return r.trim().length > 0;
  return false;
}

function isDistanceSpeedExercise(ex) {
  const name = (ex.name || '').toLowerCase();
  if (ex.trackingMode !== 'distance') return false;
  if (name.includes('sprint') || name.includes('hill sprint')) return true;
  if (name.includes('shuttle') || name.includes('5-10-5')) return true;
  if (name.includes('acceleration buildup')) return true;
  return false;
}

function shouldShowSetCheckboxes(ex, blockName) {
  const blockLower = (blockName || '').toLowerCase();
  const isWarmup = isWarmupCooldownBlock(blockName);
  if (isWarmup) {
    const hasReps = hasSetReps(ex);
    const hasDuration = (ex.trackingMode === 'time' && ex.duration);
    const hasDistance = (ex.trackingMode === 'distance' && ex.distance);
    const hasSets = ex.sets && ex.sets > 0;
    if (hasSets && (hasReps || hasDuration || hasDistance)) return true;
  }
  if (ex.trackingMode === 'time' && ex.duration && ex.sets && ex.sets > 0 && ex.showInSetRounds) return true;
  if (ex.trackingMode === 'distance' && ex.sets && ex.sets > 0 && ex.distance) return true;
  return false;
}

// Build flattened exercises with block and inGroup
const entries = [];
let globalIndex = 0;

const macro = program.macrocycle;
if (!macro || !macro.mesocycles) {
  console.error('No macrocycle.mesocycles');
  process.exit(1);
}

for (const meso of macro.mesocycles) {
  if (!meso.microcycle) continue;
  for (const day of meso.microcycle) {
    if (!day.blocks) continue;
    for (const block of day.blocks) {
      const blockName = block.name || '';
      const blockType = getBlockType(block);
      const isWarmupBlock = isWarmupCooldownBlock(blockName);
      const inGroup = (blockType === 'circuit' || blockType === 'superset' || blockType === 'complex')
        || (isWarmupBlock && block.exercises && block.exercises.length > 1);

      for (const ex of block.exercises || []) {
        const flat = {
          globalIndex: globalIndex++,
          name: ex.name,
          blockName,
          blockType,
          inGroup,
          trackingMode: ex.trackingMode,
          sets: ex.sets,
          rest: ex.rest,
          duration: ex.duration,
          distance: ex.distance,
          reps: ex.reps,
        };
        const setCheckboxes = shouldShowSetCheckboxes(ex, blockName);
        const distanceSpeed = isDistanceSpeedExercise(ex);

        // Old logic: (time or distance) && sets > 1 && rest && !setCheckboxes && !distanceSpeed
        const intervalTimerOld = (ex.trackingMode === 'time' || ex.trackingMode === 'distance')
          && ex.sets && ex.sets > 1 && ex.rest != null
          && !setCheckboxes && !distanceSpeed;

        // New logic: (time && duration && sets>1 && rest) || (distance && distance && duration && sets>1 && rest), and !setCheckboxes && !distanceSpeed
        const intervalTimerNew = !setCheckboxes && !distanceSpeed && (
          (ex.trackingMode === 'time' && ex.duration && ex.sets && ex.sets > 1 && ex.rest != null)
          || (ex.trackingMode === 'distance' && ex.distance && ex.duration && ex.sets && ex.sets > 1 && ex.rest != null)
        );

        flat.setCheckboxes = setCheckboxes;
        flat.intervalTimerOld = intervalTimerOld;
        flat.intervalTimerNew = intervalTimerNew;
        flat.mesoId = meso.id;
        flat.day = day.day;
        entries.push(flat);
      }
    }
  }
}

// Classify for report
const intervalCorrect = entries.filter(e => e.intervalTimerNew && !e.inGroup);
const intervalWrong = entries.filter(e => e.intervalTimerOld && !e.intervalTimerNew);
const intervalLikeNoUI = entries.filter(e => e.intervalTimerNew && e.inGroup);
// Warm-up/cool-down with sets and (reps or duration or distance) - get checkboxes, no interval timer
const warmupCooldownRelevant = entries.filter(e =>
  isWarmupCooldownBlock(e.blockName) && e.sets && e.sets > 0 && (e.duration || e.distance || hasSetReps(e))
);

const reportPath = path.join(__dirname, '../TIMER_AUDIT_REPORT.md');
const lines = [
  '# Timer and Block Structure Audit Report',
  '',
  'Generated by `scripts/audit-timers-and-blocks.js` (read-only).',
  '',
  '## 1. Interval timer CORRECT (new logic, standalone)',
  '',
  'These exercises get the interval timer after the rule change and are standalone (timer will show).',
  '',
  '| Name | Block | Meso | Day | Sets | Duration | Rest |',
  '|------|-------|------|-----|------|----------|------|',
  ...intervalCorrect.map(e => `| ${e.name} | ${e.blockName} | ${e.mesoId} | ${e.day} | ${e.sets} | ${e.duration || '-'} | ${e.rest ?? '-'} |`),
  '',
  '## 2. Interval timer WRONG (old logic gave timer; new logic removes it)',
  '',
  'These would have gotten the interval timer before the change (e.g. distance-only or time without duration).',
  '',
  '| Name | Block | Meso | Day | Tracking | Sets | Duration | Distance | Rest |',
  '|------|-------|------|-----|----------|------|----------|-----------|------|',
  ...intervalWrong.map(e => `| ${e.name} | ${e.blockName} | ${e.mesoId} | ${e.day} | ${e.trackingMode} | ${e.sets} | ${e.duration || '-'} | ${e.distance || '-'} | ${e.rest ?? '-'} |`),
  '',
  '## 3. Interval-like but IN GROUP (no interval timer UI currently)',
  '',
  'Time/duration + sets + rest inside a circuit/superset; they pass new logic but are in a group so IntervalTimer is not rendered.',
  '',
  '| Name | Block | Meso | Day | Sets | Duration | Rest |',
  '|------|-------|------|-----|------|----------|------|',
  ...intervalLikeNoUI.map(e => `| ${e.name} | ${e.blockName} | ${e.mesoId} | ${e.day} | ${e.sets} | ${e.duration || '-'} | ${e.rest ?? '-'} |`),
  '',
  '## 4. Warm-up/Cool-down with sets + duration or distance',
  '',
  'These correctly get set checkboxes (no interval timer).',
  '',
  '| Name | Block | Meso | Day | Sets | Duration |',
  '|------|-------|------|-----|------|----------|',
  ...warmupCooldownRelevant.slice(0, 30).map(e => `| ${e.name} | ${e.blockName} | ${e.mesoId} | ${e.day} | ${e.sets} | ${e.duration || e.distance || '-'} |`),
  warmupCooldownRelevant.length > 30 ? `... and ${warmupCooldownRelevant.length - 30} more` : '',
  '',
  '## Summary',
  '',
  `- **Interval correct (standalone):** ${intervalCorrect.length}`,
  `- **Interval wrong (fixed by logic):** ${intervalWrong.length}`,
  `- **Interval-like in group:** ${intervalLikeNoUI.length}`,
  `- **Warm-up/cool-down with sets:** ${warmupCooldownRelevant.length}`,
  '',
];

fs.writeFileSync(reportPath, lines.filter(Boolean).join('\n'), 'utf8');
console.log('Wrote', reportPath);
console.log('Interval correct (standalone):', intervalCorrect.length);
console.log('Interval wrong (fixed by logic):', intervalWrong.length);
console.log('Interval-like in group:', intervalLikeNoUI.length);
