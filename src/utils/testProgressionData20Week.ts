/**
 * 20-Week Foundation to Peak – Test seed and clear
 * Seeds AsyncStorage with session IDs, set logs, and exercise history
 * so the app (with 20-week program selected) shows completed sessions,
 * loads set logs, and shows history/suggestions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RugbyProgram,
  Block,
  generateSessionId,
  parseSessionId,
  expandFlowExercisesInBlocks,
  flattenExercises,
  hasSetReps,
  isTrackableFor1RM,
  parseNumericReps,
} from '../types/program';
import {
  ExerciseLog,
  saveProgressionState,
  ProgressionState,
  getExerciseHistory,
  getLastWeightFromHistory,
} from './progressionLogic';
import { saveExercise1RM, append1RMHistory, getExercise1RM } from '../storage/logs';
import { compute1RMUpdateFromCompletedSets } from './1rm';
import fitnessData from '../data/FitnessProgram.json';

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Get m1 day 1 blocks and flattened exercises (same order as SessionScreen for week 0, no mobility injection) */
function getM1Day1Exercises(program: RugbyProgram): { blocks: Block[]; allExercises: ReturnType<typeof flattenExercises> } {
  return getM1DayExercises(program, 1);
}

/** Get m1 day N blocks and flattened exercises for day-specific sessions */
function getM1DayExercises(program: RugbyProgram, dayNum: number): { blocks: Block[]; allExercises: ReturnType<typeof flattenExercises> } {
  const meso = program.macrocycle.mesocycles.find(m => m.id === 'm1');
  if (!meso || !meso.microcycle) throw new Error('m1 mesocycle not found');
  const day = meso.microcycle.find(d => d.day === dayNum);
  if (!day || !day.blocks) throw new Error(`m1 day ${dayNum} not found`);
  const blocks = JSON.parse(JSON.stringify(day.blocks)) as Block[];
  const expanded = expandFlowExercisesInBlocks(blocks);
  const allExercises = flattenExercises(expanded);
  return { blocks: expanded, allExercises };
}

/** 12 sessions: 6 weeks × 2 per week (day 1 and day 3), dates baseDate+0,2,7,9,14,16,21,23,28,30,35,37 */
const SEED_SESSION_CONFIGS: { mesoId: string; weekInMeso: number; dayNumber: number; daysFromStart: number }[] = [
  { mesoId: 'm1', weekInMeso: 0, dayNumber: 1, daysFromStart: 0 },
  { mesoId: 'm1', weekInMeso: 0, dayNumber: 3, daysFromStart: 2 },
  { mesoId: 'm1', weekInMeso: 1, dayNumber: 1, daysFromStart: 7 },
  { mesoId: 'm1', weekInMeso: 1, dayNumber: 3, daysFromStart: 9 },
  { mesoId: 'm1', weekInMeso: 2, dayNumber: 1, daysFromStart: 14 },
  { mesoId: 'm1', weekInMeso: 2, dayNumber: 3, daysFromStart: 16 },
  { mesoId: 'm1', weekInMeso: 3, dayNumber: 1, daysFromStart: 21 },
  { mesoId: 'm1', weekInMeso: 3, dayNumber: 3, daysFromStart: 23 },
  { mesoId: 'm1', weekInMeso: 4, dayNumber: 1, daysFromStart: 28 },
  { mesoId: 'm1', weekInMeso: 4, dayNumber: 3, daysFromStart: 30 },
  { mesoId: 'm1', weekInMeso: 5, dayNumber: 1, daysFromStart: 35 },
  { mesoId: 'm1', weekInMeso: 5, dayNumber: 3, daysFromStart: 37 },
];

/**
 * Build rich exercise history for Romanian Deadlift and Back Squat to validate progression logic
 * (Rule of 3, +3 fallback, deload, readiness MA3, quality gate). Session IDs match SEED_SESSION_CONFIGS.
 */
function build20WeekProgressionLogs(baseDate: Date): { rdlLogs: ExerciseLog[]; squatLogs: ExerciseLog[] } {
  const sessionIds = SEED_SESSION_CONFIGS.map(c => generateSessionId(c.mesoId, c.weekInMeso, c.dayNumber));
  const sessionDates = SEED_SESSION_CONFIGS.map(c => addDays(baseDate, c.daysFromStart));

  type Row = {
    sessionIndex: number;
    readiness: number;
    weight: number;
    sets: number;
    reps: string;
    extraReps?: number;
    consecutiveSuccesses: number;
    qualityPass: boolean;
    isCompleted: boolean;
  };

  // RDL: 12 entries matching plan (week 1 streak, week 2 +3, week 3 deload, week 4 readiness, week 5 quality, week 6 Rule of 3)
  const rdlRows: Row[] = [
    { sessionIndex: 0, readiness: 7, weight: 95, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 1, readiness: 7, weight: 95, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 2, qualityPass: true, isCompleted: true },
    { sessionIndex: 2, readiness: 8, weight: 95, sets: 3, reps: '10,10,13', extraReps: 3, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 3, readiness: 7, weight: 97.5, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 4, readiness: 8, weight: 90, sets: 2, reps: '10', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 5, readiness: 8, weight: 90, sets: 2, reps: '10', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 6, readiness: 3, weight: 97.5, sets: 3, reps: '8', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 7, readiness: 2, weight: 97.5, sets: 3, reps: '7', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 8, readiness: 7, weight: 97.5, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 0, qualityPass: false, isCompleted: true },
    { sessionIndex: 9, readiness: 7, weight: 97.5, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 10, readiness: 7, weight: 100, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 2, qualityPass: true, isCompleted: true },
    { sessionIndex: 11, readiness: 7, weight: 100, sets: 3, reps: '10', extraReps: 0, consecutiveSuccesses: 3, qualityPass: true, isCompleted: true },
  ];

  const rdlLogs: ExerciseLog[] = rdlRows.map((row, i) => {
    const recentReadiness = rdlRows.slice(Math.max(0, i - 2), i + 1).map(r => r.readiness);
    const readinessMA3 = recentReadiness.length > 0
      ? Math.round((recentReadiness.reduce((a, b) => a + b, 0) / recentReadiness.length) * 10) / 10
      : row.readiness;
    return {
      exerciseId: `${sessionIds[row.sessionIndex]}-rdl`,
      exerciseName: 'Romanian Deadlift',
      date: sessionDates[row.sessionIndex].toISOString(),
      sessionId: sessionIds[row.sessionIndex],
      sets: row.sets,
      reps: row.reps,
      weight: row.weight,
      readiness: row.readiness,
      readinessMA3,
      isCompleted: row.isCompleted,
      isWarmup: false,
      extraReps: row.extraReps,
      consecutiveSuccesses: row.consecutiveSuccesses,
      qualityPass: row.qualityPass,
      targetRPE: 7,
      historyLink: 'history:Romanian%20Deadlift',
    };
  });

  // Back Squat: same 12 sessions, progression fields for validation (streak >= 3, MA3, etc.)
  const squatRows: Row[] = [
    { sessionIndex: 0, readiness: 7, weight: 135, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 1, readiness: 7, weight: 135, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 2, qualityPass: true, isCompleted: true },
    { sessionIndex: 2, readiness: 8, weight: 135, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 3, qualityPass: true, isCompleted: true },
    { sessionIndex: 3, readiness: 7, weight: 137.5, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 4, readiness: 8, weight: 125, sets: 3, reps: '5', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 5, readiness: 8, weight: 125, sets: 3, reps: '5', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 6, readiness: 4, weight: 137.5, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 7, readiness: 5, weight: 137.5, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 8, readiness: 7, weight: 140, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 0, qualityPass: true, isCompleted: true },
    { sessionIndex: 9, readiness: 7, weight: 140, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, isCompleted: true },
    { sessionIndex: 10, readiness: 7, weight: 140, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 2, qualityPass: true, isCompleted: true },
    { sessionIndex: 11, readiness: 7, weight: 140, sets: 5, reps: '5', extraReps: 0, consecutiveSuccesses: 3, qualityPass: true, isCompleted: true },
  ];

  const squatLogs: ExerciseLog[] = squatRows.map((row, i) => {
    const recentReadiness = squatRows.slice(Math.max(0, i - 2), i + 1).map(r => r.readiness);
    const readinessMA3 = recentReadiness.length > 0
      ? Math.round((recentReadiness.reduce((a, b) => a + b, 0) / recentReadiness.length) * 10) / 10
      : row.readiness;
    return {
      exerciseId: `${sessionIds[row.sessionIndex]}-squat`,
      exerciseName: 'Back Squat',
      date: sessionDates[row.sessionIndex].toISOString(),
      sessionId: sessionIds[row.sessionIndex],
      sets: row.sets,
      reps: row.reps,
      weight: row.weight,
      readiness: row.readiness,
      readinessMA3,
      isCompleted: row.isCompleted,
      isWarmup: false,
      extraReps: row.extraReps ?? 0,
      consecutiveSuccesses: row.consecutiveSuccesses,
      qualityPass: row.qualityPass,
      targetRPE: 7,
      historyLink: 'history:Back%20Squat',
    };
  });

  return { rdlLogs, squatLogs };
}

/**
 * Seed 20-Week test data: program=fitness, 12 sessions (6 weeks × 2), rich RDL/Back Squat history for progression validation.
 * Sets selectedProgramId and startDateYMD so the app opens in 20-week with past sessions.
 */
export async function seed20WeekTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const program = fitnessData as unknown as RugbyProgram;
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 42); // 6 weeks ago so seeded weeks are in the past

    await AsyncStorage.setItem(STORAGE_KEY_PROGRAM, 'fitness');
    await AsyncStorage.setItem('startDateYMD', baseDate.toISOString().split('T')[0]);

    const completedSessions: { id: string; date: string }[] = [];
    const logsByExercise: Record<string, ExerciseLog[]> = {};
    let lastDay1SessionId: string | null = null;
    let lastDay1AllEx: ReturnType<typeof flattenExercises> = [];
    let lastDay3SessionId: string | null = null;
    let lastDay3AllEx: ReturnType<typeof flattenExercises> = [];

    for (const { mesoId, weekInMeso, dayNumber, daysFromStart } of SEED_SESSION_CONFIGS) {
      const sessionId = generateSessionId(mesoId, weekInMeso, dayNumber);
      const sessionDate = addDays(baseDate, daysFromStart);

      const { allExercises } = getM1DayExercises(program, dayNumber);
      const allEx = allExercises;
      if (dayNumber === 1) {
        lastDay1SessionId = sessionId;
        lastDay1AllEx = allEx;
      } else {
        lastDay3SessionId = sessionId;
        lastDay3AllEx = allEx;
      }

      const setLogs: Record<number, { weight: string; reps: string }[]> = {};
      allEx.forEach((exercise, globalIndex) => {
        const sets = exercise.sets ?? 0;
        const reps = exercise.reps ?? '';
        const repsStr = typeof reps === 'string' ? reps : String(reps);
        const numReps = parseNumericReps(reps);
        if (exercise.trackingMode === 'time' || sets === 0) return;
        let weight = 0;
        if (isTrackableFor1RM(exercise)) weight = 135;
        else if (hasSetReps(exercise) && exercise.trackingMode === 'volume') {
          const name = (exercise.name || '').toLowerCase();
          if (name.includes('squat') || name.includes('deadlift') || name.includes('rdl') || name.includes('romanian')) weight = 95;
          else if (name.includes('row') || name.includes('pull')) weight = 35;
          else if (name.includes('bug') || name.includes('plank')) weight = 0;
          else weight = 25;
        }
        setLogs[globalIndex] = Array.from({ length: sets }, () => ({
          weight: weight > 0 ? String(weight) : '',
          reps: numReps ? String(numReps) : repsStr,
        }));
        if (!logsByExercise[exercise.name]) logsByExercise[exercise.name] = [];
        logsByExercise[exercise.name].push({
          exerciseId: String(globalIndex),
          exerciseName: exercise.name,
          date: sessionDate.toISOString(),
          sessionId,
          sets,
          reps: repsStr,
          weight: weight > 0 ? weight : undefined,
          readiness: 7,
          isCompleted: true,
          isWarmup: false,
        });
      });

      completedSessions.push({ id: sessionId, date: sessionDate.toISOString() });
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(setLogs));
      const completedIndices = Array.from({ length: allEx.length }, (_, i) => i);
      await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completedIndices));
    }

    const existingCompleted = await AsyncStorage.getItem('completedSessions');
    const previous: { id: string; date: string }[] = existingCompleted ? JSON.parse(existingCompleted) : [];
    const twentyWeekIds = new Set(completedSessions.map(s => s.id));
    const merged = [...completedSessions, ...previous.filter(p => !twentyWeekIds.has(p.id))];
    await AsyncStorage.setItem('completedSessions', JSON.stringify(merged));

    // Write minimal history for all m1 day 1 exercises except RDL and Back Squat (overwritten below)
    for (const [exerciseName, logs] of Object.entries(logsByExercise)) {
      if (exerciseName === 'Romanian Deadlift' || exerciseName === 'Back Squat') continue;
      const key = `exerciseHistory:${exerciseName}`;
      const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      await AsyncStorage.setItem(key, JSON.stringify(sorted));
    }

    // Rich progression logs for RDL and Back Squat (overwrite minimal)
    const { rdlLogs, squatLogs } = build20WeekProgressionLogs(baseDate);
    const rdlSorted = [...rdlLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const squatSorted = [...squatLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await AsyncStorage.setItem('exerciseHistory:Romanian Deadlift', JSON.stringify(rdlSorted));
    await AsyncStorage.setItem('exerciseHistory:Back Squat', JSON.stringify(squatSorted));

    const lastDate = addDays(baseDate, 37);
    const backSquatState: ProgressionState = {
      exerciseName: 'Back Squat',
      currentWeight: 140,
      consecutiveSuccesses: 3,
      lastSuccessDate: lastDate.toISOString().split('T')[0],
      pendingIncrease: false,
    };
    const rdlState: ProgressionState = {
      exerciseName: 'Romanian Deadlift',
      currentWeight: 100,
      consecutiveSuccesses: 3,
      lastSuccessDate: lastDate.toISOString().split('T')[0],
      pendingIncrease: false,
    };
    await saveProgressionState(backSquatState);
    await saveProgressionState(rdlState);

    // Seed initial 1RM for Back Squat and Bench Press (150 so 135×5 → Epley ~158 triggers update)
    await saveExercise1RM('Back Squat', 150);
    await saveExercise1RM('Bench Press', 150);

    // Simulate session complete to run 1RM auto-update for both
    const simulate1RMUpdate = async (
      sessionId: string,
      allEx: ReturnType<typeof flattenExercises>,
      exerciseName: string,
      current1RM: number
    ) => {
      const raw = await AsyncStorage.getItem(`setLogs:${sessionId}`);
      if (!raw) return;
      const setLogs = JSON.parse(raw) as Record<number, { weight: string; reps: string }[]>;
      const idx = allEx.findIndex(e => e.name === exerciseName);
      if (idx < 0) return;
      const logs = setLogs[idx] || [];
      const validLogs = logs.filter(l => l.weight && l.reps);
      const { shouldUpdate, new1RM } = compute1RMUpdateFromCompletedSets(validLogs, current1RM, 2.5);
      if (shouldUpdate && new1RM != null) {
        await saveExercise1RM(exerciseName, new1RM);
        await append1RMHistory(exerciseName, new1RM);
      }
    };

    if (lastDay1SessionId && lastDay1AllEx.length > 0) {
      await simulate1RMUpdate(lastDay1SessionId, lastDay1AllEx, 'Back Squat', 150);
    }
    if (lastDay3SessionId && lastDay3AllEx.length > 0) {
      await simulate1RMUpdate(lastDay3SessionId, lastDay3AllEx, 'Bench Press', 150);
    }

    return {
      success: true,
      message: `20-Week test data seeded.\n\n• Program: 20-Week Foundation to Peak (selected)\n• Sessions: 12 (m1 weeks 0–5, 2 per week)\n• Start date: ${baseDate.toISOString().split('T')[0]}\n• Rich exercise history for Romanian Deadlift and Back Squat (Rule of 3, +3 fallback, deload, readiness, quality gate).\n• 1RM auto-update: Back Squat and Bench Press seeded with simulated session complete.\n\nOpen Home and tap a completed session to see history and suggestions. Run Validation to see 20-Week progression checks.`,
    };
  } catch (error) {
    console.error('Error seeding 20-week test data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/** Session ID pattern for 20-week seeded sessions */
const TWENTY_WEEK_SESSION_PATTERN = /^m[1-5]-week\d+-day-\d+$/;

/** Session IDs we seed (12 sessions: 6 weeks × 2) - used by clear */
const SEEDED_20_WEEK_SESSION_IDS = SEED_SESSION_CONFIGS.map(c =>
  generateSessionId(c.mesoId, c.weekInMeso, c.dayNumber)
);

/**
 * Clear only 20-week seeded data: completedSessions entries matching m1-week etc.,
 * their setLogs/completed keys, and exercise history for 20-week exercise names we seeded.
 * Does not remove Test program seed data.
 */
export async function clear20WeekTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const completedRaw = await AsyncStorage.getItem('completedSessions');
    const completed: { id: string; date: string }[] = completedRaw ? JSON.parse(completedRaw) : [];
    const remaining = completed.filter(c => !TWENTY_WEEK_SESSION_PATTERN.test(c.id));
    await AsyncStorage.setItem('completedSessions', JSON.stringify(remaining));

    const keys: string[] = [];
    for (const id of SEEDED_20_WEEK_SESSION_IDS) {
      keys.push(`setLogs:${id}`, `completed:${id}`);
    }

    const program = fitnessData as unknown as RugbyProgram;
    const { allExercises: day1 } = getM1Day1Exercises(program);
    const { allExercises: day3 } = getM1DayExercises(program, 3);
    const exerciseNames = [...new Set([...day1.map(e => e.name), ...day3.map(e => e.name)])];
    for (const name of exerciseNames) {
      keys.push(`exerciseHistory:${name}`);
      keys.push(`progressionState:${name}`);
    }
    keys.push('1RM:Back Squat', '1RM:Bench Press');
    keys.push('1rmHistory-Back Squat', '1rmHistory-Bench Press');

    await AsyncStorage.multiRemove(keys);

    return {
      success: true,
      message: '20-Week test data cleared. Test program seed (if any) was left unchanged.',
    };
  } catch (error) {
    console.error('Error clearing 20-week test data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export { TWENTY_WEEK_SESSION_PATTERN };

export interface ValidationResult {
  scenario: string;
  passed: boolean;
  details: string;
}

/**
 * Run 20-week seed validation: session ID parses, program resolves, set logs exist, history and suggestion weight.
 */
export async function validate20WeekSeed(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const parsed = parseSessionId('m1-week0-day-1');
    const sessionIdOk = parsed && parsed.mesoId === 'm1' && parsed.weekIndex === 0 && parsed.dayNumber === 1;
    results.push({
      scenario: '20-Week: Session ID parses',
      passed: !!sessionIdOk,
      details: sessionIdOk
        ? 'm1-week0-day-1 parses to { mesoId: m1, weekIndex: 0, dayNumber: 1 }'
        : `parseSessionId failed or wrong: ${JSON.stringify(parsed)}`,
    });

    const program = fitnessData as unknown as RugbyProgram;
    let dayOk = false;
    try {
      const { allExercises } = getM1Day1Exercises(program);
      dayOk = allExercises.length > 0;
      results.push({
        scenario: '20-Week: Program m1 day 1 resolves',
        passed: dayOk,
        details: dayOk ? `m1 day 1 has ${allExercises.length} exercises` : 'm1 day 1 not found or no exercises',
      });
    } catch (e) {
      results.push({
        scenario: '20-Week: Program m1 day 1 resolves',
        passed: false,
        details: `Error: ${e instanceof Error ? e.message : 'Unknown'}`,
      });
    }

    const completedRaw = await AsyncStorage.getItem('completedSessions');
    const completed: { id: string; date: string }[] = completedRaw ? JSON.parse(completedRaw) : [];
    const twentyWeekSessions = completed.filter(c => TWENTY_WEEK_SESSION_PATTERN.test(c.id));
    const setLogsKey = twentyWeekSessions.length > 0 ? `setLogs:${twentyWeekSessions[0].id}` : null;
    let setLogsOk = false;
    if (setLogsKey) {
      const raw = await AsyncStorage.getItem(setLogsKey);
      if (raw) {
        const obj = JSON.parse(raw);
        setLogsOk = typeof obj === 'object' && obj !== null && Object.keys(obj).length > 0;
      }
      results.push({
        scenario: '20-Week: Set logs exist',
        passed: setLogsOk,
        details: setLogsOk
          ? `setLogs:${twentyWeekSessions[0].id} exists with exercise indices`
          : `No set logs for ${twentyWeekSessions[0].id} or empty`,
      });
    } else {
      results.push({
        scenario: '20-Week: Set logs exist',
        passed: false,
        details: 'No 20-week completed sessions found',
      });
    }

    const backSquatHistory = await getExerciseHistory('Back Squat');
    const historyOk = backSquatHistory.length > 0 && backSquatHistory.some(l => l.sessionId && l.weight !== undefined);
    results.push({
      scenario: '20-Week: History for Back Squat',
      passed: historyOk,
      details: historyOk
        ? `Back Squat has ${backSquatHistory.length} log(s) with weight`
        : `Back Squat history missing or no weight (count: ${backSquatHistory.length})`,
    });

    const rdlWeight = await getLastWeightFromHistory('Romanian Deadlift');
    results.push({
      scenario: '20-Week: Suggestion weight for RDL',
      passed: typeof rdlWeight === 'number' && rdlWeight > 0,
      details: typeof rdlWeight === 'number' && rdlWeight > 0
        ? `getLastWeightFromHistory(Romanian Deadlift) = ${rdlWeight} lbs`
        : `No weight from history for Romanian Deadlift (got ${String(rdlWeight)})`,
    });

    // Progression logic checks (require rich 20-Week seed)
    const rdlHistory = await getExerciseHistory('Romanian Deadlift');
    const squatHistory = await getExerciseHistory('Back Squat');
    const hasProgressionHistory = rdlHistory.length > 0 || squatHistory.length > 0;
    if (!hasProgressionHistory) {
      results.push({
        scenario: '20-Week: Progression history present',
        passed: false,
        details: 'No RDL or Back Squat history; seed 20-Week test data with progression logs.',
      });
    } else {
      const ruleOf3Logs = [...rdlHistory, ...squatHistory].filter(
        l => l.consecutiveSuccesses !== undefined && l.consecutiveSuccesses >= 3
      );
      results.push({
        scenario: '20-Week: Rule of 3 streak',
        passed: ruleOf3Logs.length > 0,
        details: ruleOf3Logs.length > 0
          ? `Found ${ruleOf3Logs.length} log(s) with consecutiveSuccesses >= 3`
          : 'No streak >= 3 in RDL or Back Squat history',
      });

      const extraRepsLog = [...rdlHistory, ...squatHistory].find(
        l => l.extraReps !== undefined && l.extraReps >= 3
      );
      results.push({
        scenario: '20-Week: +3 reps fallback',
        passed: !!extraRepsLog,
        details: extraRepsLog
          ? `${extraRepsLog.exerciseName} has +${extraRepsLog.extraReps} reps on ${extraRepsLog.date.split('T')[0]}`
          : 'No +3 extraReps found in 20-Week history',
      });

      const deloadWeekSessionIds = SEED_SESSION_CONFIGS.filter(c => c.weekInMeso === 2).map(c =>
        generateSessionId(c.mesoId, c.weekInMeso, c.dayNumber)
      );
      const deloadLogs = [...rdlHistory, ...squatHistory].filter(l =>
        deloadWeekSessionIds.includes(l.sessionId)
      );
      const deloadSuppressed = deloadLogs.length === 0 || deloadLogs.every(l =>
        l.consecutiveSuccesses === 0 || l.consecutiveSuccesses === undefined
      );
      results.push({
        scenario: '20-Week: Deload suppression',
        passed: deloadSuppressed,
        details: deloadSuppressed
          ? (deloadLogs.length > 0 ? 'Deload week (m1-week2) has suppressed progression' : 'No deload week logs in history')
          : `Deload week logs have unexpected streaks: ${deloadLogs.map(l => l.consecutiveSuccesses).join(', ')}`,
      });

      const ma3Logs = [...rdlHistory, ...squatHistory].filter(l => l.readinessMA3 !== undefined);
      const lowMa3Logs = ma3Logs.filter(l => (l.readinessMA3 ?? 10) < 5);
      results.push({
        scenario: '20-Week: Readiness MA3',
        passed: ma3Logs.length > 0,
        details: ma3Logs.length > 0
          ? `${ma3Logs.length} log(s) with readinessMA3${lowMa3Logs.length > 0 ? `, ${lowMa3Logs.length} with MA3 < 5` : ''}`
          : 'No MA3 tracking in 20-Week history',
      });

      const qualityFailLog = [...rdlHistory, ...squatHistory].find(
        l => l.qualityPass === false && l.isCompleted === true
      );
      const qualityStreakReset = !qualityFailLog || (qualityFailLog.consecutiveSuccesses === 0 || qualityFailLog.consecutiveSuccesses === undefined);
      results.push({
        scenario: '20-Week: Quality gate breaks streak',
        passed: !!qualityFailLog && qualityStreakReset,
        details: qualityFailLog && qualityStreakReset
          ? 'Quality failure present and streak reset (consecutiveSuccesses 0 or undefined)'
          : !qualityFailLog
            ? 'No quality gate failure in 20-Week history'
            : `Quality failure but streak not reset: consecutiveSuccesses=${qualityFailLog.consecutiveSuccesses}`,
      });

      // 1RM Auto-Update validation (Back Squat and Bench Press)
      const benchLogs = [{ weight: '135', reps: '5' }, { weight: '135', reps: '5' }, { weight: '135', reps: '5' }, { weight: '135', reps: '5' }, { weight: '135', reps: '5' }];
      const squatUpdate = compute1RMUpdateFromCompletedSets(benchLogs, 150, 2.5);
      const benchUpdate = compute1RMUpdateFromCompletedSets(benchLogs, 150, 2.5);
      const squatUpdateOk = squatUpdate.shouldUpdate === true && squatUpdate.new1RM === 158;
      const benchUpdateOk = benchUpdate.shouldUpdate === true && benchUpdate.new1RM === 158;
      results.push({
        scenario: '20-Week: 1RM Auto-Update - Back Squat',
        passed: squatUpdateOk,
        details: squatUpdateOk
          ? `compute1RMUpdateFromCompletedSets: 135×5 → shouldUpdate=true, new1RM=158`
          : `Expected shouldUpdate=true, new1RM=158; got shouldUpdate=${squatUpdate.shouldUpdate}, new1RM=${squatUpdate.new1RM ?? 'undefined'}`,
      });
      results.push({
        scenario: '20-Week: 1RM Auto-Update - Bench Press',
        passed: benchUpdateOk,
        details: benchUpdateOk
          ? `compute1RMUpdateFromCompletedSets: 135×5 → shouldUpdate=true, new1RM=158`
          : `Expected shouldUpdate=true, new1RM=158; got shouldUpdate=${benchUpdate.shouldUpdate}, new1RM=${benchUpdate.new1RM ?? 'undefined'}`,
      });
      const squatStored = await getExercise1RM('Back Squat');
      const benchStored = await getExercise1RM('Bench Press');
      const storedOk = (squatStored == null || Math.abs((squatStored ?? 0) - 158) <= 1) &&
        (benchStored == null || Math.abs((benchStored ?? 0) - 158) <= 1);
      if (!storedOk && (squatStored != null || benchStored != null)) {
        results.push({
          scenario: '20-Week: 1RM storage after seed',
          passed: false,
          details: `Stored 1RM mismatch: Back Squat=${squatStored ?? 'null'}, Bench Press=${benchStored ?? 'null'} (expected ~158)`,
        });
      }
    }
  } catch (error) {
    results.push({
      scenario: '20-Week: Validation',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
    });
  }

  return results;
}
