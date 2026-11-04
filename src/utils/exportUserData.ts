/**
 * Export user data for debugging suggestions and weight calculations.
 * Collects AsyncStorage progression data and optional suggestion snapshot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExercise1RM } from '../storage/logs';
import {
  getExerciseHistory,
  getProgressionState,
  getLastWeightFromHistory,
  applyRuleOf3Progression,
  inferExerciseCategory,
} from './progressionLogic';
import { getRepBasedPercent } from './1rm';
import { parseNumericReps, parseIntensityPercent, isTrackableFor1RM, flattenExercises } from '../types/program';
import type { RugbyProgram, Block, FlattenedExercise } from '../types/program';
import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';

const PROGRAMS: Record<string, RugbyProgram> = {
  rugby: rugbyData as unknown as RugbyProgram,
  fitness: fitnessData as unknown as RugbyProgram,
  simple: simpleWeightData as unknown as RugbyProgram,
  test: testProgramData as unknown as RugbyProgram,
  hypertrophy: hypertrophyData as unknown as RugbyProgram,
};

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

const EXPORT_KEY_PREFIXES = [
  '1RM:',
  '1RMHistory:',
  '1rmHistory-',
  'exerciseHistory:',
  'progressionState:',
  'setLogs:',
  'completed:',
  'sessionLogs:',
  'readiness:',
  'setNotes:',
];

const EXPORT_KEYS_EXACT = [
  'completedSessions',
  STORAGE_KEY_PROGRAM,
  'startDateYMD',
  'programOffset',
  'swappedSessions',
  'swapHistory',
  'programCompleteShown',
  'todayReadinessScore',
  'selectedTheme',
  'onboardingComplete',
  'soundAlertsEnabled',
];

// Legacy 1RM keys are "ExerciseName-1RM" - we include any key ending with -1RM
function isLegacy1RMKey(key: string): boolean {
  return key.endsWith('-1RM') && !key.startsWith('1RM:');
}

export interface ExportSummary {
  exportedAt: string;
  appVersion: string;
  storageKeyCount: number;
  exerciseCount1RM: number;
  exerciseCountHistory: number;
  completedSessionsCount: number;
  suggestionSnapshotSummary?: string;
}

export interface SuggestionSnapshotEntry {
  exerciseName: string;
  type: '1rm' | 'rule_of_3';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface ExportResult {
  summary: ExportSummary;
  storage: Record<string, unknown>;
  suggestionSnapshot?: SuggestionSnapshotEntry[];
}

/**
 * Collect all progression-related keys from AsyncStorage and return as object.
 */
export async function collectStorageKeys(): Promise<Record<string, unknown>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const wanted = allKeys.filter(
    (key) =>
      EXPORT_KEYS_EXACT.includes(key) ||
      EXPORT_KEY_PREFIXES.some((p) => key.startsWith(p)) ||
      isLegacy1RMKey(key)
  );
  if (wanted.length === 0) return {};
  const pairs = await AsyncStorage.multiGet(wanted);
  const result: Record<string, unknown> = {};
  for (const [key, value] of pairs) {
    if (value == null) continue;
    try {
      result[key] = JSON.parse(value) as unknown;
    } catch {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Get first session's exercises from a program (first meso, week 0, first day).
 */
function getFirstSessionExercises(program: RugbyProgram): FlattenedExercise[] | null {
  const mesos = program?.macrocycle?.mesocycles;
  if (!mesos?.length) return null;
  const meso = mesos[0];
  const microcycle = meso?.microcycle;
  if (!microcycle?.length) return null;
  const day = microcycle.find((d) => d?.blocks?.length) ?? microcycle[0];
  if (!day?.blocks?.length) return null;
  return flattenExercises(day.blocks as Block[]);
}

/**
 * Build a suggestion snapshot for the current program: for each exercise that gets
 * a suggestion, record inputs and outputs (1RM-based or Rule of 3).
 */
export async function buildSuggestionSnapshot(
  programId: string | null
): Promise<SuggestionSnapshotEntry[]> {
  const entries: SuggestionSnapshotEntry[] = [];
  const program = getProgramById(programId);
  const exercises = program ? getFirstSessionExercises(program) : null;

  if (exercises?.length) {
    for (const exercise of exercises) {
      if (isTrackableFor1RM(exercise)) {
        const oneRM = await getExercise1RM(exercise.name);
        if (oneRM == null) continue;
        const trainingMax = Math.round(oneRM * 0.9);
        const numericReps = parseNumericReps(exercise.reps);
        const intensityPercent = parseIntensityPercent(exercise.intensity);
        let baseWeight: number;
        let percentOf1RM: number;
        if (intensityPercent != null) {
          percentOf1RM = intensityPercent;
          baseWeight = Math.round(oneRM * intensityPercent);
        } else if (numericReps != null) {
          percentOf1RM = getRepBasedPercent(numericReps);
          baseWeight = Math.round(oneRM * percentOf1RM);
        } else {
          continue;
        }
        entries.push({
          exerciseName: exercise.name,
          type: '1rm',
          inputs: {
            oneRM,
            trainingMax,
            reps: exercise.reps,
            intensity: exercise.intensity,
            percentOf1RM,
          },
          outputs: {
            suggestedWeight: baseWeight,
            note: 'Readiness adjustment not applied in export snapshot',
          },
        });
      } else if (exercise.trackingMode === 'volume' || exercise.trackingMode === 'maxReps') {
        const lastWeight = await getLastWeightFromHistory(exercise.name);
        if (lastWeight == null) continue;
        const category = exercise.exerciseCategory ?? inferExerciseCategory(exercise.name);
        const history = await getExerciseHistory(exercise.name);
        const state = await getProgressionState(exercise.name);
        const suggestion = await applyRuleOf3Progression(
          exercise.name,
          lastWeight,
          category,
          exercise,
          exercise.minIncrement,
          false,
          false,
          undefined,
          undefined
        );
        entries.push({
          exerciseName: exercise.name,
          type: 'rule_of_3',
          inputs: {
            lastWeight,
            historyLength: history.length,
            consecutiveSuccesses: state?.consecutiveSuccesses ?? 0,
            currentWeight: state?.currentWeight,
          },
          outputs: {
            suggestedWeight: suggestion.suggestedWeight,
            reason: suggestion.reason,
            ruleApplied: suggestion.ruleApplied,
          },
        });
      }
    }
  }

  return entries;
}

function getProgramById(programId: string | null): RugbyProgram | null {
  if (!programId || !(programId in PROGRAMS)) return null;
  return PROGRAMS[programId] ?? null;
}

/**
 * Build summary counts from storage and optional snapshot.
 */
function buildSummary(
  storage: Record<string, unknown>,
  snapshot: SuggestionSnapshotEntry[] | undefined,
  appVersion: string
): ExportSummary {
  const storageKeys = Object.keys(storage);
  let exerciseCount1RM = 0;
  let exerciseCountHistory = 0;
  for (const key of storageKeys) {
    if (key.startsWith('1RM:') || isLegacy1RMKey(key)) exerciseCount1RM++;
    if (key.startsWith('exerciseHistory:')) exerciseCountHistory++;
  }
  const completed = storage['completedSessions'];
  const completedSessionsCount = Array.isArray(completed) ? completed.length : 0;

  let suggestionSnapshotSummary: string | undefined;
  if (snapshot?.length) {
    const r3 = snapshot.filter((e) => e.type === 'rule_of_3').length;
    const oneRM = snapshot.filter((e) => e.type === '1rm').length;
    suggestionSnapshotSummary = `${oneRM} 1RM-based, ${r3} Rule of 3`;
  }

  return {
    exportedAt: new Date().toISOString(),
    appVersion,
    storageKeyCount: storageKeys.length,
    exerciseCount1RM,
    exerciseCountHistory,
    completedSessionsCount,
    suggestionSnapshotSummary,
  };
}

/**
 * Export all progression-related data and optional suggestion snapshot.
 * Returns a JSON string suitable for Share or clipboard.
 */
export async function exportUserData(options?: {
  includeSuggestionSnapshot?: boolean;
  appVersion?: string;
}): Promise<string> {
  const includeSnapshot = options?.includeSuggestionSnapshot !== false;
  const appVersion = options?.appVersion ?? '1.0.5';

  const storage = await collectStorageKeys();
  let suggestionSnapshot: SuggestionSnapshotEntry[] | undefined;
  if (includeSnapshot) {
    const programId = (storage[STORAGE_KEY_PROGRAM] as string) ?? null;
    suggestionSnapshot = await buildSuggestionSnapshot(programId);
  }

  const summary = buildSummary(storage, suggestionSnapshot, appVersion);
  const result: ExportResult = {
    summary,
    storage,
    ...(suggestionSnapshot?.length ? { suggestionSnapshot } : {}),
  };
  return JSON.stringify(result, null, 2);
}

export interface ImportResult {
  success: boolean;
  restoredKeys: number;
  error?: string;
}

/**
 * Restore progression data from a previously exported JSON string.
 * Use this when moving from Expo Go to the standalone app (or after reinstall).
 * Only restores keys that are in our export format (storage object).
 */
export async function importUserData(jsonString: string): Promise<ImportResult> {
  try {
    const data = JSON.parse(jsonString) as unknown;
    if (data == null || typeof data !== 'object' || !('storage' in data)) {
      return { success: false, restoredKeys: 0, error: 'Invalid export file: missing "storage" data.' };
    }
    const storage = (data as ExportResult).storage;
    if (storage == null || typeof storage !== 'object') {
      return { success: false, restoredKeys: 0, error: 'Invalid export file: "storage" is not an object.' };
    }

    let count = 0;
    const pairs: [string, string][] = [];
    for (const [key, value] of Object.entries(storage)) {
      if (value === undefined) continue;
      const str =
        typeof value === 'string'
          ? value
          : JSON.stringify(value);
      pairs.push([key, str]);
      count++;
    }
    if (pairs.length === 0) {
      return { success: true, restoredKeys: 0 };
    }
    await AsyncStorage.multiSet(pairs);
    return { success: true, restoredKeys: count };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    return { success: false, restoredKeys: 0, error: message };
  }
}
