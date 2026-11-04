/**
 * Audit: identify exercises missing cues and tips (instruction, notes, definition).
 * Used by Block view "Cues & notes" section. Flow steps/group exercises use
 * cue, detailedInstructions, description.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../src/data');

function hasCues(ex) {
  const i = (ex.instruction && String(ex.instruction).trim()) || '';
  const n = (ex.notes && String(ex.notes).trim()) || '';
  const d = (ex.definition && String(ex.definition).trim()) || '';
  return i.length > 0 || n.length > 0 || d.length > 0;
}

function hasFlowStepCues(step) {
  const c = (step.cue && String(step.cue).trim()) || '';
  const di = Array.isArray(step.detailedInstructions) && step.detailedInstructions.length > 0
    ? step.detailedInstructions.some(s => String(s).trim().length > 0)
    : false;
  return c.length > 0 || di;
}

function hasFlowExCues(flowEx) {
  const c = (flowEx.cue && String(flowEx.cue).trim()) || '';
  const d = (flowEx.description && String(flowEx.description).trim()) || '';
  const di = Array.isArray(flowEx.detailedInstructions) && flowEx.detailedInstructions.length > 0
    ? flowEx.detailedInstructions.some(s => String(s).trim().length > 0)
    : false;
  return c.length > 0 || d.length > 0 || di;
}

function collectMissingFromBlocks(blocks, programId, out) {
  if (!Array.isArray(blocks)) return;
  blocks.forEach(block => {
    const exercises = block.exercises;
    if (!Array.isArray(exercises)) return;
    exercises.forEach(ex => {
      if (!ex.name) return;
      // Direct exercise
      if (!hasCues(ex)) {
        out.push({
          program: programId,
          block: block.name,
          exercise: ex.name,
          kind: 'exercise',
        });
      }
      // Flow steps (expand to steps)
      if (Array.isArray(ex.flowSteps)) {
        ex.flowSteps.forEach(step => {
          if (!step.name) return;
          if (!hasFlowStepCues(step)) {
            out.push({
              program: programId,
              block: block.name,
              exercise: step.name,
              kind: 'flowStep',
            });
          }
        });
      }
      // Flow groups
      const groups = [
        ex.warmUpGroup,
        ex.exercisesGroup,
        ex.coolDownGroup,
      ].filter(Boolean);
      groups.forEach(grp => {
        if (!Array.isArray(grp.exercises)) return;
        grp.exercises.forEach(flowEx => {
          if (!flowEx.name) return;
          if (!hasFlowExCues(flowEx)) {
            out.push({
              program: programId,
              block: block.name,
              exercise: flowEx.name,
              kind: 'flowExercise',
            });
          }
        });
      });
    });
  });
}

function getBlocksFromProgram(program) {
  const blocks = [];
  const macro = program.macrocycle;
  if (macro && Array.isArray(macro.mesocycles)) {
    macro.mesocycles.forEach(m => {
      const days = m.microcycle || m.days || [];
      days.forEach(d => {
        if (Array.isArray(d.blocks)) {
          d.blocks.forEach(b => blocks.push(b));
        }
        if (d.blocks && !Array.isArray(d.blocks) && typeof d.blocks === 'object') {
          Object.values(d.blocks).forEach(bArr => {
            if (Array.isArray(bArr)) bArr.forEach(b => blocks.push(b));
          });
        }
      });
    });
  }
  return blocks;
}

function run() {
  const programs = [
    { id: 'rugbyProgram', file: 'rugbyProgram.json' },
    { id: 'FitnessProgram', file: 'FitnessProgram.json' },
    { id: 'HypertrophyMonth', file: 'HypertrophyMonth.json' },
    { id: 'simpleweightProgram', file: 'simpleweightProgram.json' },
    { id: 'TestProgram', file: 'TestProgram.json' },
  ];

  const recoveryPath = path.join(DATA_DIR, 'recoveryWorkouts.json');
  const missing = [];

  programs.forEach(({ id, file }) => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) return;
    const program = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const blocks = getBlocksFromProgram(program);
    collectMissingFromBlocks(blocks, id, missing);
  });

  if (fs.existsSync(recoveryPath)) {
    const recovery = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
    const workouts = recovery.recoveryWorkouts || [];
    workouts.forEach(w => {
      if (Array.isArray(w.blocks)) {
        collectMissingFromBlocks(w.blocks, `recoveryWorkouts:${w.id || w.title}`, missing);
      }
    });
  }

  // Dedupe by program + block + exercise name (same exercise in multiple weeks counted once)
  const seen = new Set();
  const unique = missing.filter(m => {
    const key = `${m.program}|${m.block}|${m.exercise}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const byProgram = {};
  unique.forEach(m => {
    if (!byProgram[m.program]) byProgram[m.program] = [];
    byProgram[m.program].push({ block: m.block, exercise: m.exercise, kind: m.kind });
  });

  const lines = [
    '# Exercises missing cues and tips',
    '',
    'These exercises have no **instruction**, **notes**, or **definition** (and no **cue** / **detailedInstructions** / **description** for flow steps). They will show an empty "Cues & notes" section in Block view unless they have a suggested weight from 1RM.',
    '',
    '---',
    '',
  ];
  Object.keys(byProgram).sort().forEach(programId => {
    const items = byProgram[programId];
    lines.push(`## ${programId} (${items.length} items)`);
    lines.push('');
    items.forEach(({ block, exercise, kind }) => {
      lines.push(`- **${exercise}** — block: _${block}_ (${kind})`);
    });
    lines.push('');
  });
  lines.push(`**Total unique exercise instances missing cues: ${unique.length}**`);
  const report = lines.join('\n');
  console.log(report);
  const reportPath = path.join(__dirname, '../MISSING_CUES_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('\nReport written to MISSING_CUES_REPORT.md');
}

run();
