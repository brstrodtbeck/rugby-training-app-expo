/**
 * Hybrid 1RM utilities with warm-up set generation
 */

/** Represents a single warm-up set */
export interface WarmupSet {
  /** Weight to use for this warm-up set (in lbs) */
  weight: number;
  /** Number of reps for this warm-up set */
  reps: number;
  /** Percentage of working weight used */
  percentage: number;
  /** Indicates this is a warm-up set (non-loggable) */
  isWarmup: true;
}

/** Configuration for warm-up set percentages and fixed reps */
interface WarmupConfig {
  percentage: number;
  reps: number; // fixed number of reps for this percentage
}

/** Warm-up configurations by rep range - work backwards from 90% (closest to working weight) */
const WARMUP_CONFIGS = {
  /** Low rep exercises (1-3 reps) - need more gradual progression, 4-5 warm-up sets */
  low: [
    { percentage: 0.90, reps: 2 },   // 90% - 1-2 reps (close to working weight)
    { percentage: 0.75, reps: 4 },   // 75% - 4 reps
    { percentage: 0.60, reps: 6 },   // 60% - 6 reps
    { percentage: 0.50, reps: 8 },   // 50% - 8 reps
    { percentage: 0.40, reps: 10 },  // 40% - 10 reps (light weight, more reps)
  ],
  /** Medium rep exercises (4-7 reps) - moderate preparation, 2-3 warm-up sets */
  medium: [
    { percentage: 0.90, reps: 6 },   // 90% - 6 reps (close to working weight)
    { percentage: 0.75, reps: 6 },   // 75% - 6 reps
    { percentage: 0.50, reps: 8 },   // 50% - 8 reps
  ],
  /** High rep exercises (8+ reps) - lighter loads, less preparation, 1-2 warm-up sets */
  high: [
    { percentage: 0.90, reps: 2 },   // 90% - 1-2 reps (close to working weight)
    { percentage: 0.60, reps: 8 },   // 60% - 8-10 reps (moderate weight, more reps)
  ],
} as const;

/** Minimum weight for warm-up sets (20 lbs or bar weight) */
const MIN_WARMUP_WEIGHT = 20;

/**
 * Generates warm-up sets for a given target rep scheme and working weight.
 * 
 * Logic:
 * - Uses percentages of WORKING WEIGHT (not training max) to ensure warm-ups never exceed working sets
 * - Adapts warm-up volume based on target rep range:
 *   - High reps (8+): 1-2 warm-up sets (lighter loads, less preparation)
 *   - Medium reps (4-7): 2-3 warm-up sets (moderate preparation)
 *   - Low reps (1-3): 4-5 warm-up sets (heavier loads, more gradual progression)
 * - Works backwards from 90% (closest to working weight) to lighter percentages
 * - Lighter warm-up sets use more reps to properly warm up joints and body
 * - Heavier warm-up sets use fewer reps (closer to working weight)
 * 
 * @param targetReps - The number of reps planned for working sets
 * @param workingWeight - The actual working set weight (not training max)
 * @returns Array of warm-up sets with weight, reps, and percentage of working weight
 */
export function getWarmupSetsForTargetReps(
  targetReps: number,
  workingWeight: number
): WarmupSet[] {
  // Validate inputs
  if (!workingWeight || workingWeight <= 0 || !targetReps || targetReps <= 0) {
    return [];
  }

  // Determine rep range category
  let configs: readonly WarmupConfig[];
  if (targetReps >= 8) {
    // High rep exercises: 1-2 warm-up sets
    configs = WARMUP_CONFIGS.high;
  } else if (targetReps >= 4) {
    // Medium rep exercises: 2-3 warm-up sets
    configs = WARMUP_CONFIGS.medium;
  } else {
    // Low rep exercises (1-3): 4-5 warm-up sets
    configs = WARMUP_CONFIGS.low;
  }

  const warmupSets: WarmupSet[] = [];

  // Process configs in order (already sorted from 90% backwards)
  for (const config of configs) {
    // Calculate weight as percentage of WORKING WEIGHT (not training max)
    // This ensures warm-ups never exceed the working set weight
    const weight = Math.round((workingWeight * config.percentage) / 5) * 5;
    
    // Skip if weight is too light (less than 20 lbs or bar weight)
    if (weight < MIN_WARMUP_WEIGHT) {
      continue;
    }

    // Ensure warm-up weight never exceeds working weight
    if (weight >= workingWeight) {
      continue;
    }

    // For high rep exercises, adjust 60% reps to be 8-10 reps
    let reps = config.reps;
    if (targetReps >= 8 && config.percentage === 0.60) {
      // For high rep exercises, use 8-10 reps at 60% (clamp to range)
      reps = Math.min(10, Math.max(8, targetReps));
    }

    warmupSets.push({
      weight,
      reps,
      percentage: config.percentage,
      isWarmup: true,
    });
  }

  return warmupSets;
}

/**
 * Formats a percentage as a display string (e.g., 0.40 → "40%")
 */
export function formatPercentage(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}

/**
 * Calculates total warm-up volume from an array of warm-up sets
 */
export function calculateWarmupVolume(warmupSets: WarmupSet[]): number {
  return warmupSets.reduce((total, set) => total + set.weight * set.reps, 0);
}

// ============================================
// Readiness-Based Workout Adjustments
// ============================================

/** Readiness adjustment result */
export interface ReadinessAdjustment {
  /** Adjusted number of sets */
  adjustedSets: number;
  /** Adjusted working weight */
  adjustedWeight: number;
  /** Percentage modifier applied to weight (e.g., 1.03 = +3%) */
  weightModifier: number;
  /** Set modifier (e.g., +1, 0, -1) */
  setModifier: number;
  /** Description of the adjustment for UI display */
  adjustmentReason: string;
  /** Readiness category: 'high', 'moderate', 'low' */
  readinessCategory: 'high' | 'moderate' | 'low';
}

/** Readiness score ranges and their adjustments */
interface ReadinessConfig {
  minScore: number;
  maxScore: number;
  category: 'high' | 'moderate' | 'low';
  weightModifierMin: number;
  weightModifierMax: number;
  setModifier: number;
  description: string;
}

/** Configuration for readiness-based adjustments */
const READINESS_CONFIGS: ReadinessConfig[] = [
  {
    minScore: 8,
    maxScore: 10,
    category: 'high',
    weightModifierMin: 1.02,  // +2%
    weightModifierMax: 1.05,  // +5%
    setModifier: 1,           // +1 set
    description: 'Feeling great! Pushing harder today.',
  },
  {
    minScore: 4,
    maxScore: 7,
    category: 'moderate',
    weightModifierMin: 1.0,   // no change
    weightModifierMax: 1.0,   // no change
    setModifier: 0,           // no change
    description: 'Standard prescription.',
  },
  {
    minScore: 1,
    maxScore: 3,
    category: 'low',
    weightModifierMin: 0.90,  // -10%
    weightModifierMax: 0.95,  // -5%
    setModifier: -1,          // -1 set
    description: 'Recovery mode: lighter load today.',
  },
];

/** Minimum sets allowed after adjustment */
const MIN_SETS = 1;

/** Maximum sets allowed after adjustment */
const MAX_SETS = 8;

/** Minimum weight in lbs (to avoid too light weights) */
const MIN_WEIGHT = 20;

/**
 * Adjusts workout sets and weight based on user's readiness score.
 * 
 * Logic:
 * - High readiness (8-10): Increase weight by 2-5%, optionally add 1 set
 * - Moderate readiness (4-7): Keep base prescription unchanged
 * - Low readiness (1-3): Decrease weight by 5-10%, reduce sets by 1
 * 
 * @param readinessScore - User's readiness score (1-10)
 * @param baseSets - Base number of sets from the program
 * @param baseWeight - Base working weight (in lbs)
 * @returns ReadinessAdjustment object with adjusted values and metadata
 */
export function adjustWorkoutForReadiness(
  readinessScore: number,
  baseSets: number,
  baseWeight: number
): ReadinessAdjustment {
  // Validate readiness score (clamp to 1-10)
  const clampedScore = Math.max(1, Math.min(10, Math.round(readinessScore)));
  
  // Find the appropriate config for this score
  const config = READINESS_CONFIGS.find(
    c => clampedScore >= c.minScore && clampedScore <= c.maxScore
  ) || READINESS_CONFIGS[1]; // Default to moderate

  // Calculate weight modifier based on where the score falls within the range
  let weightModifier: number;
  if (config.category === 'moderate') {
    weightModifier = 1.0;
  } else {
    // Interpolate within the range
    const rangePosition = (clampedScore - config.minScore) / (config.maxScore - config.minScore);
    weightModifier = config.weightModifierMin + 
      (config.weightModifierMax - config.weightModifierMin) * rangePosition;
  }

  // Calculate adjusted weight
  let adjustedWeight = Math.round(baseWeight * weightModifier);
  
  // Ensure weight doesn't go below minimum
  adjustedWeight = Math.max(MIN_WEIGHT, adjustedWeight);
  
  // Round to nearest 5 lbs for practical gym use
  adjustedWeight = Math.round(adjustedWeight / 5) * 5;

  // Calculate adjusted sets
  let adjustedSets = baseSets + config.setModifier;
  
  // Clamp sets to safe range
  adjustedSets = Math.max(MIN_SETS, Math.min(MAX_SETS, adjustedSets));

  return {
    adjustedSets,
    adjustedWeight,
    weightModifier,
    setModifier: config.setModifier,
    adjustmentReason: config.description,
    readinessCategory: config.category,
  };
}

/**
 * Gets a description label for a readiness score
 */
export function getReadinessLabel(score: number): string {
  if (score >= 8) return '💪 High Energy';
  if (score >= 6) return '👍 Good';
  if (score >= 4) return '😐 Moderate';
  if (score >= 2) return '😴 Fatigued';
  return '🛑 Very Low';
}

/**
 * Gets the color associated with a readiness score for UI
 */
export function getReadinessColor(score: number): string {
  if (score >= 8) return '#28a745'; // green
  if (score >= 6) return '#5cb85c'; // light green
  if (score >= 4) return '#f0ad4e'; // orange
  if (score >= 2) return '#d9534f'; // red
  return '#c9302c'; // dark red
}

