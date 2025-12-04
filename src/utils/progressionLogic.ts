/**
 * Progression Logic Utilities
 * Handles Rule of 3 progression, readiness safeguards, and quality gates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseCategory, TrackingMode } from '../types/program';

// Storage keys
const EXERCISE_HISTORY_KEY_PREFIX = 'exerciseHistory:';
const PROGRESSION_STATE_KEY_PREFIX = 'progressionState:';

/** Extended exercise log with all tracking fields */
export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  date: string; // ISO date string
  sessionId: string;
  
  // Performance data
  sets: number;
  reps?: number | string;
  weight?: number;
  rpe?: number;
  readiness?: number;
  
  // Completion tracking
  isCompleted: boolean;
  isWarmup?: boolean; // Warm-up sets excluded from progression
  
  // Rule of 3 tracking
  extraReps?: number; // Extra clean reps on last set
  consecutiveSuccesses?: number;
  
  // Quality gate
  qualityPass?: boolean; // Tempo, ROM, RPE within ±1 of target
  targetRPE?: number;
  
  // Readiness safeguard
  readinessMA3?: number; // 3-session moving average
  
  // History link
  historyLink?: string;
}

/** Progression state for an exercise */
export interface ProgressionState {
  exerciseName: string;
  currentWeight: number;
  consecutiveSuccesses: number;
  lastSuccessDate?: string;
  lastDeloadWeight?: number; // Weight before deload for resumption
  pendingIncrease: boolean;
  lastProgressionDate?: string;
}

/** Progression suggestion result */
export interface ProgressionSuggestion {
  suggestedWeight: number;
  reason: string;
  ruleApplied: 'rule_of_3' | 'extra_reps' | 'hybrid_1rm' | 'maintain' | 'reduce' | 'deload_resume';
  consecutiveSuccesses: number;
  showRuleOf3Tip: boolean;
  readinessSafeguard: boolean;
  qualityGatePassed: boolean;
}

/** Increment configuration by exercise category */
const CATEGORY_INCREMENTS: Record<ExerciseCategory, { min: number; max: number }> = {
  compound: { min: 2.5, max: 5 },
  assistance: { min: 2.5, max: 2.5 },
  isolation: { min: 1, max: 2.5 },
};

/** Readiness thresholds for safeguard decisions */
const READINESS_THRESHOLDS = {
  LOW_SINGLE: 4,      // Single session low readiness threshold
  LOW_MA3: 5,         // MA3 threshold for safeguard decisions
  CRITICAL_MA3: 4,    // MA3 threshold for reduction trigger
};

/**
 * Get exercise category based on name (fallback when not specified)
 */
export function inferExerciseCategory(exerciseName: string): ExerciseCategory {
  const name = exerciseName.toLowerCase();
  
  // Compound movements
  const compounds = [
    'squat', 'deadlift', 'bench press', 'overhead press', 'row', 'pull-up',
    'clean', 'snatch', 'push press', 'front squat', 'romanian deadlift'
  ];
  if (compounds.some(c => name.includes(c))) return 'compound';
  
  // Isolation movements
  const isolations = [
    'curl', 'extension', 'fly', 'raise', 'kickback', 'calf',
    'shrug', 'wrist', 'forearm'
  ];
  if (isolations.some(i => name.includes(i))) return 'isolation';
  
  // Default to assistance
  return 'assistance';
}

/**
 * Calculate weight increment based on category and equipment
 */
export function calculateIncrement(
  category: ExerciseCategory,
  currentWeight: number,
  minIncrement?: number
): number {
  const { min, max } = CATEGORY_INCREMENTS[category];
  
  // Calculate percentage-based increment
  const percentIncrease = category === 'compound' ? 0.025 : 0.025; // 2.5%
  let increment = Math.round(currentWeight * percentIncrease * 2) / 2; // Round to nearest 0.5
  
  // Clamp to category range
  increment = Math.max(min, Math.min(max, increment));
  
  // Round to nearest standard plate increment (2.5 or 5 lbs)
  increment = Math.round(increment / 2.5) * 2.5;
  if (increment === 0) increment = min;
  
  // If minIncrement is specified and larger than calculated, use reps fallback
  if (minIncrement && minIncrement > increment) {
    return 0; // Signal to use reps progression instead
  }
  
  return increment;
}

/**
 * Get exercise history from storage
 */
export async function getExerciseHistory(exerciseName: string): Promise<ExerciseLog[]> {
  try {
    const key = `${EXERCISE_HISTORY_KEY_PREFIX}${exerciseName}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading exercise history:', error);
    return [];
  }
}

/**
 * Save exercise log to history
 */
export async function saveExerciseLog(log: ExerciseLog): Promise<void> {
  try {
    const key = `${EXERCISE_HISTORY_KEY_PREFIX}${log.exerciseName}`;
    const history = await getExerciseHistory(log.exerciseName);
    
    // Add new log at the beginning
    history.unshift(log);
    
    // Keep last 50 sessions max
    const trimmed = history.slice(0, 50);
    
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving exercise log:', error);
  }
}

/**
 * Get progression state for an exercise
 */
export async function getProgressionState(exerciseName: string): Promise<ProgressionState | null> {
  try {
    const key = `${PROGRESSION_STATE_KEY_PREFIX}${exerciseName}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading progression state:', error);
    return null;
  }
}

/**
 * Save progression state
 */
export async function saveProgressionState(state: ProgressionState): Promise<void> {
  try {
    const key = `${PROGRESSION_STATE_KEY_PREFIX}${state.exerciseName}`;
    await AsyncStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving progression state:', error);
  }
}

/**
 * Calculate 3-session moving average for readiness
 */
export function calculateReadinessMA3(history: ExerciseLog[]): number | undefined {
  const recentWithReadiness = history
    .filter(log => log.readiness !== undefined && !log.isWarmup)
    .slice(0, 3);
  
  if (recentWithReadiness.length === 0) return undefined;
  
  const sum = recentWithReadiness.reduce((acc, log) => acc + (log.readiness || 5), 0);
  return Math.round((sum / recentWithReadiness.length) * 10) / 10;
}

/**
 * Check if quality gate passes (tempo, ROM, RPE within ±1 of target)
 */
export function checkQualityGate(log: ExerciseLog): boolean {
  // If no target RPE specified, pass by default
  if (log.targetRPE === undefined || log.rpe === undefined) return true;
  
  // RPE must be within ±1 of target
  const rpeDiff = Math.abs(log.rpe - log.targetRPE);
  return rpeDiff <= 1;
}

/**
 * Check if a single session has low readiness but still performed well
 * Used to decide if we should HOLD weight (not reduce, but not progress)
 */
export function shouldHoldDueToLowReadiness(
  currentReadiness: number | undefined,
  readinessMA3: number | undefined,
  isCompleted: boolean
): { shouldHold: boolean; reason: string } {
  // No readiness data = no hold
  if (currentReadiness === undefined) {
    return { shouldHold: false, reason: '' };
  }
  
  // Low single-session readiness + completed = HOLD (not reduce)
  // But only if MA3 is still reasonable (above critical threshold)
  if (currentReadiness <= READINESS_THRESHOLDS.LOW_SINGLE && isCompleted) {
    if (readinessMA3 === undefined || readinessMA3 >= READINESS_THRESHOLDS.CRITICAL_MA3) {
      return {
        shouldHold: true,
        reason: `Low readiness (${currentReadiness}/10) but completed → holding weight (MA3: ${readinessMA3?.toFixed(1) ?? 'N/A'})`,
      };
    }
  }
  
  return { shouldHold: false, reason: '' };
}

/**
 * Check if we should apply readiness reduction
 * Only reduce if:
 * 1. readinessMA3 is below CRITICAL_MA3 threshold
 * 2. Two consecutive sessions have BOTH low readiness AND missed performance
 */
export function shouldApplyReadinessReduction(
  history: ExerciseLog[],
  readinessMA3: number | undefined
): { shouldReduce: boolean; reason: string } {
  // MA3 must be below critical threshold for reduction
  if (readinessMA3 === undefined || readinessMA3 > READINESS_THRESHOLDS.CRITICAL_MA3) {
    return { shouldReduce: false, reason: '' };
  }
  
  // Check last 2 non-warmup sessions for missed performance
  const recentSessions = history
    .filter(log => !log.isWarmup && log.isCompleted !== undefined)
    .slice(0, 2);
  
  if (recentSessions.length < 2) {
    return { shouldReduce: false, reason: '' };
  }
  
  // Both sessions must have low readiness AND missed targets
  const bothMissed = recentSessions.every(log => 
    (log.readiness !== undefined && log.readiness <= READINESS_THRESHOLDS.LOW_SINGLE) &&
    (!log.qualityPass || !log.isCompleted)
  );
  
  if (bothMissed) {
    return {
      shouldReduce: true,
      reason: `2 consecutive low readiness + missed reps (MA3: ${readinessMA3.toFixed(1)}) → reducing weight -5%`,
    };
  }
  
  return { shouldReduce: false, reason: '' };
}

/**
 * Apply Rule of 3 progression logic for volume-based exercises
 * Returns progression suggestion based on consecutive successes and extra reps
 * 
 * DELOAD SUPPRESSION:
 * - During deload: ALL progression triggers blocked (Rule of 3, fallback, etc.)
 * - consecutiveSuccesses forced to 0 during deload
 * - After deload: resume at pre-deload working weight
 * 
 * READINESS SAFEGUARDS:
 * - Uses readinessMA3 (3-session moving average) for decisions
 * - Single low readiness + completed = HOLD (if MA3 reasonable)
 * - Two consecutive low readiness + missed = REDUCE (if MA3 critical)
 */
export async function applyRuleOf3Progression(
  exerciseName: string,
  currentWeight: number,
  category: ExerciseCategory,
  minIncrement?: number,
  isDeload?: boolean,
  isTaper?: boolean,
  preDeloadWeight?: number, // Weight before deload for resumption tracking
  currentReadiness?: number
): Promise<ProgressionSuggestion> {
  const history = await getExerciseHistory(exerciseName);
  const state = await getProgressionState(exerciseName);
  const readinessMA3 = calculateReadinessMA3(history);
  
  // Default result
  let result: ProgressionSuggestion = {
    suggestedWeight: currentWeight,
    reason: 'Maintain current weight',
    ruleApplied: 'maintain',
    consecutiveSuccesses: state?.consecutiveSuccesses || 0,
    showRuleOf3Tip: true,
    readinessSafeguard: false,
    qualityGatePassed: true,
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DELOAD/TAPER SUPPRESSION - Block ALL progression triggers
  // ═══════════════════════════════════════════════════════════════════════════
  if (isDeload || isTaper) {
    // Force consecutiveSuccesses to 0 during deload
    result.consecutiveSuccesses = 0;
    result.reason = isDeload 
      ? '⏸️ Deload week - ALL progression suppressed (streak held at 0)' 
      : '⏸️ Taper week - progression suppressed';
    result.showRuleOf3Tip = false;
    result.ruleApplied = 'maintain';
    
    // Store pre-deload weight for later resumption if not already stored
    if (preDeloadWeight && state) {
      state.lastDeloadWeight = preDeloadWeight;
      await saveProgressionState(state);
    }
    
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // POST-DELOAD RESUME - Return to pre-deload working weight
  // ═══════════════════════════════════════════════════════════════════════════
  if (state?.lastDeloadWeight && currentWeight < state.lastDeloadWeight) {
    result.suggestedWeight = state.lastDeloadWeight;
    result.reason = `📈 Post-deload: Resuming pre-deload weight (${state.lastDeloadWeight} lbs)`;
    result.ruleApplied = 'deload_resume';
    result.consecutiveSuccesses = 0; // Reset streak after deload
    return result;
  }
  
  // Get recent non-warmup sessions (excluding deload sessions)
  const recentSessions = history
    .filter(log => !log.isWarmup && log.isCompleted !== undefined)
    .slice(0, 5);
  
  // Count consecutive quality successes (excluding deload/taper sessions)
  let consecutiveSuccesses = 0;
  for (const session of recentSessions) {
    // Skip counting if this was a deload session (marked by very low reps or weight drop)
    if (session.qualityPass !== false && session.isCompleted) {
      consecutiveSuccesses++;
    } else {
      break;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // READINESS SAFEGUARD - Check for reduction trigger
  // Only triggers if MA3 is below critical threshold AND 2 consecutive failures
  // ═══════════════════════════════════════════════════════════════════════════
  const reductionCheck = shouldApplyReadinessReduction(history, readinessMA3);
  if (reductionCheck.shouldReduce) {
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    const reduction = increment > 0 ? increment : currentWeight * 0.05; // Default to 5%
    result.suggestedWeight = Math.round((currentWeight - reduction) * 2) / 2;
    result.reason = `⚠️ ${reductionCheck.reason}`;
    result.ruleApplied = 'reduce';
    result.readinessSafeguard = true;
    result.consecutiveSuccesses = 0;
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // READINESS SAFEGUARD - Check for hold trigger
  // Single low readiness + completed = HOLD (don't progress, but don't reduce)
  // ═══════════════════════════════════════════════════════════════════════════
  const lastSession = recentSessions[0];
  const holdCheck = shouldHoldDueToLowReadiness(
    currentReadiness ?? lastSession?.readiness,
    readinessMA3,
    lastSession?.isCompleted ?? true
  );
  
  if (holdCheck.shouldHold) {
    result.reason = `⚠️ ${holdCheck.reason}`;
    result.readinessSafeguard = true;
    result.consecutiveSuccesses = consecutiveSuccesses; // Preserve streak count
    result.showRuleOf3Tip = true;
    // Don't progress, but don't reset streak either
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE OF 3: Progress after 3 consecutive quality successes
  // ═══════════════════════════════════════════════════════════════════════════
  if (consecutiveSuccesses >= 3) {
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    if (increment > 0) {
      result.suggestedWeight = Math.round((currentWeight + increment) * 2) / 2;
      result.reason = `🟢 Rule of 3: ${consecutiveSuccesses} consecutive successes → +${increment} lbs`;
      result.ruleApplied = 'rule_of_3';
      result.consecutiveSuccesses = consecutiveSuccesses;
      return result;
    } else {
      // Increment too small, suggest adding reps
      result.reason = `🟢 Rule of 3: ${consecutiveSuccesses} successes, but weight increment too small. Try +1 rep.`;
      result.ruleApplied = 'rule_of_3';
      result.consecutiveSuccesses = consecutiveSuccesses;
      return result;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRA REPS FALLBACK: ≥3 extra clean reps on last set = immediate progression
  // Note: This is also suppressed during deload (handled above)
  // ═══════════════════════════════════════════════════════════════════════════
  if (lastSession?.extraReps && lastSession.extraReps >= 3) {
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    if (increment > 0) {
      result.suggestedWeight = Math.round((currentWeight + increment) * 2) / 2;
      result.reason = `⚡ Extra reps fallback: +${lastSession.extraReps} clean reps on last set → +${increment} lbs`;
      result.ruleApplied = 'extra_reps';
      result.consecutiveSuccesses = 0; // Reset after fallback
      return result;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTAIN: No progression trigger met, continue building streak
  // ═══════════════════════════════════════════════════════════════════════════
  result.consecutiveSuccesses = consecutiveSuccesses;
  if (consecutiveSuccesses > 0) {
    result.reason = `🟡 ${consecutiveSuccesses}/3 consecutive successes. ${3 - consecutiveSuccesses} more to progress!`;
  } else {
    result.reason = '🔴 Building streak - complete quality sessions to progress';
  }
  
  return result;
}

/**
 * Determine which progression logic to use based on tracking mode
 */
export function getProgressionType(trackingMode: TrackingMode): 'hybrid_1rm' | 'rule_of_3' | 'none' {
  switch (trackingMode) {
    case '1RM':
      return 'hybrid_1rm';
    case 'volume':
    case 'maxReps':
      return 'rule_of_3';
    case 'time':
    case 'distance':
    default:
      return 'none';
  }
}

/**
 * Generate history link for an exercise
 */
export function generateHistoryLink(exerciseName: string): string {
  return `history:${encodeURIComponent(exerciseName)}`;
}

/**
 * Get last N sessions for display
 */
export async function getRecentHistory(
  exerciseName: string,
  count: number = 5
): Promise<ExerciseLog[]> {
  const history = await getExerciseHistory(exerciseName);
  return history
    .filter(log => !log.isWarmup)
    .slice(0, count);
}

/**
 * Format progression indicator color
 */
export function getProgressionIndicatorColor(consecutiveSuccesses: number): string {
  if (consecutiveSuccesses >= 3) return '#4caf50'; // Green - ready to progress
  if (consecutiveSuccesses >= 1) return '#ff9800'; // Orange - making progress
  return '#f44336'; // Red - needs work
}

/**
 * Get Rule of 3 tip text
 */
export function getRuleOf3TipText(): string {
  return 'Rule of 3: Progress when you succeed 3 sessions in a row, or add ≥3 reps on the last set.';
}

