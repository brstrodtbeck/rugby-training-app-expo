/**
 * Audit script: mobility flow merge targets (read-only).
 * For each day, reports which block would be chosen as warm-up and cool-down
 * using the same logic as useSessionData, and flags risky days.
 */
const fs = require('fs');
const path = require('path');

const STRENGTH_BLOCK_PATTERNS = ['row', 'press', 'bench', 'main', 'secondary', 'optional', 'accessory', 'contrast'];

function isStrengthBlock(blockName) {
  const lower = (blockName || '').toLowerCase().trim();
  return STRENGTH_BLOCK_PATTERNS.some(p => lower.includes(p));
}

function auditProgram(program, programName) {
  const macro = program.macrocycle;
  if (!macro || !macro.mesocycles) return [];

  const results = [];
  for (const meso of macro.mesocycles) {
    if (!meso.microcycle) continue;
    for (const day of meso.microcycle) {
      const blocks = day.blocks || [];
      const blockCount = blocks.length;
      const firstHalfEnd = Math.ceil(blockCount / 2);
      const secondHalfStart = Math.floor(blockCount / 2);

      let warmupBlockIndex = -1;
      let cooldownBlockIndex = -1;

      blocks.forEach((block, index) => {
        const blockNameLower = (block.name || '').toLowerCase().trim();
        if ((blockNameLower.includes('warm') || blockNameLower.includes('warm-up')) && index < firstHalfEnd) {
          warmupBlockIndex = index;
        }
        if ((blockNameLower.includes('cool') || blockNameLower.includes('cool-down') || blockNameLower.includes('cooldown')) && index >= secondHalfStart) {
          cooldownBlockIndex = index;
        }
      });

      if (warmupBlockIndex >= 0 && isStrengthBlock(blocks[warmupBlockIndex].name)) {
        warmupBlockIndex = -1;
      }
      if (cooldownBlockIndex >= 0 && isStrengthBlock(blocks[cooldownBlockIndex].name)) {
        cooldownBlockIndex = -1;
      }

      const warmupBlockName = warmupBlockIndex >= 0 ? blocks[warmupBlockIndex].name : '(none)';
      const cooldownBlockName = cooldownBlockIndex >= 0 ? blocks[cooldownBlockIndex].name : '(none)';

      const hasCoolBlock = blocks.some(b => {
        const n = (b.name || '').toLowerCase();
        return n.includes('cool') || n.includes('cooldown');
      });
      const hasWarmBlock = blocks.some(b => {
        const n = (b.name || '').toLowerCase();
        return n.includes('warm');
      });

      const flags = [];
      if (cooldownBlockIndex < 0 && hasCoolBlock) {
        flags.push('NO COOL-DOWN TARGET (block exists but filtered by position or strength check)');
      }
      if (warmupBlockIndex < 0 && hasWarmBlock) {
        flags.push('NO WARM-UP TARGET (block exists but filtered by position or strength check)');
      }

      results.push({
        program: programName,
        mesoId: meso.id,
        day: day.day,
        title: day.title,
        blockCount,
        blockNames: blocks.map(b => b.name),
        warmupBlockIndex,
        warmupBlockName,
        cooldownBlockIndex,
        cooldownBlockName,
        flags,
      });
    }
  }
  return results;
}

function run() {
  const programs = [
    { path: path.join(__dirname, '../src/data/FitnessProgram.json'), name: 'fitness' },
    { path: path.join(__dirname, '../src/data/rugbyProgram.json'), name: 'rugby' },
    { path: path.join(__dirname, '../src/data/simpleweightProgram.json'), name: 'simple' },
  ];

  const allResults = [];
  for (const { path: p, name } of programs) {
    if (!fs.existsSync(p)) continue;
    const program = JSON.parse(fs.readFileSync(p, 'utf8'));
    allResults.push(...auditProgram(program, name));
  }

  const outputPath = path.join(__dirname, '../mobility-merge-audit.txt');
  const lines = [];

  lines.push('=== Mobility Flow Merge Audit ===');
  lines.push('');
  lines.push('Reports which block would receive warm-up and cool-down flow merge for each day.');
  lines.push('Flags days where the target block looks like a strength block or is in the wrong half.');
  lines.push('');

  const flagged = allResults.filter(r => r.flags.length > 0);
  if (flagged.length > 0) {
    lines.push(`*** ${flagged.length} DAY(S) FLAGGED ***`);
    lines.push('');
    for (const r of flagged) {
      lines.push(`${r.program} | ${r.mesoId} D${r.day} | ${r.title}`);
      lines.push(`  Blocks: ${r.blockNames.join(' | ')}`);
      lines.push(`  Warm-up target: [${r.warmupBlockIndex}] ${r.warmupBlockName}`);
      lines.push(`  Cool-down target: [${r.cooldownBlockIndex}] ${r.cooldownBlockName}`);
      lines.push(`  FLAGS: ${r.flags.join('; ')}`);
      lines.push('');
    }
  }

  lines.push('--- All days (summary) ---');
  lines.push('');
  for (const r of allResults) {
    const flagStr = r.flags.length > 0 ? ` [${r.flags.join(', ')}]` : '';
    lines.push(`${r.program} ${r.mesoId} D${r.day}: warmup=[${r.warmupBlockIndex}] ${r.warmupBlockName}, cooldown=[${r.cooldownBlockIndex}] ${r.cooldownBlockName}${flagStr}`);
  }

  const out = lines.join('\n');
  fs.writeFileSync(outputPath, out, 'utf8');
  console.log(`Wrote ${outputPath}`);
  if (flagged.length > 0) {
    console.log(`${flagged.length} day(s) flagged - see report for details`);
  } else {
    console.log('No risky days found.');
  }
}

run();
