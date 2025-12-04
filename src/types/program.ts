/**
 * Type definitions for the rugby training program JSON schema
 */

/** Tracking modes for exercises */
export type TrackingMode = '1RM' | 'volume' | 'time' | 'distance' | 'maxReps';

/** Group types for blocks */
export type GroupType = 'superset' | 'circuit' | 'complex' | 'block';

/** Exercise categories for progression scaling */
export type ExerciseCategory = 'compound' | 'assistance' | 'isolation';

/** A single exercise within a block */
export interface Exercise {
  name: string;
  trackingMode: TrackingMode;
  
  // Volume-based fields (used when trackingMode is 'volume', '1RM', or 'distance')
  sets?: number;
  reps?: number | string; // Can be number (8) or string ("30m", "15s")
  
  // Time-based fields (used when trackingMode is 'time')
  duration?: string; // e.g., "16 min", "20 min"
  
  // Common fields
  rest?: number; // Rest time in seconds
  intensity?: string; // e.g., "70% 1RM", "90–95% HRmax"
  notes?: string;
  tempo?: string; // e.g., "3-0-X"
  substitutions?: string[];
  
  // Grouping identifier for flattening logic
  groupId?: string; // e.g., "block-4-supersetA-ex1"
  
  // Instruction/definition fields for mobility and cardio exercises
  instruction?: string; // Short description of how to perform the movement
  definition?: string;  // Brief definition or purpose of the exercise
  
  // Progression and categorization fields
  exerciseCategory?: ExerciseCategory; // compound, assistance, isolation
  minIncrement?: number; // Minimum weight increment in lbs (based on equipment)
  targetRPE?: number; // Target RPE for this exercise (1-10)
}

/** A block of exercises within a training day */
export interface Block {
  name: string;
  exercises: Exercise[];
  
  // Circuit/Superset/Complex fields
  rounds?: number;
  restBetweenRounds?: number;
  /** 
   * Explicit group type for rendering:
   * - 'superset': paired exercises with shared rest (strength+plyo, push/pull, core+lift)
   * - 'circuit': multi-exercise conditioning or density blocks
   * - 'complex': sequential barbell movements (Olympic lift clusters)
   * - 'block': normal individual exercises (default)
   */
  groupType?: GroupType;
  
  // Legacy field for backwards compatibility
  blockType?: 'circuit' | 'superset' | 'standard';
}

/**
 * Determines the block type based on explicit groupType or inferred properties
 */
export function getBlockType(block: Block): 'circuit' | 'superset' | 'complex' | 'standard' {
  // Use explicit groupType if provided
  if (block.groupType) {
    if (block.groupType === 'block') return 'standard';
    return block.groupType;
  }
  
  // Legacy blockType support
  if (block.blockType) return block.blockType;
  
  // If has rounds > 1, it's a circuit
  if (block.rounds && block.rounds > 1) return 'circuit';
  
  // Check name patterns for automatic detection
  const lowerName = block.name.toLowerCase();
  
  // Complex detection (Olympic lifts, barbell clusters)
  if (lowerName.includes('complex') || lowerName.includes('olympic')) return 'complex';
  
  // Circuit detection
  if (lowerName.includes('circuit') || lowerName.includes('conditioning circuit')) return 'circuit';
  
  // Superset detection
  if (lowerName.includes('superset') || lowerName.includes('super set')) return 'superset';
  if (lowerName.includes('contrast') || lowerName.includes('density')) return 'superset';
  
  // If multiple exercises with sets=1, likely a superset or circuit
  if (block.exercises.length > 1 && block.exercises.every(e => e.sets === 1)) {
    return 'superset';
  }
  
  return 'standard';
}

/** Represents a renderable item - either a single exercise or a grouped block */
export interface RenderableItem {
  type: 'exercise' | 'circuit' | 'superset' | 'complex';
  id: string;
  blockName: string;
  blockIndex: number;
  
  // For single exercise
  exercise?: FlattenedExercise;
  exerciseIndex?: number;
  
  // For grouped items (circuit/superset/complex)
  exercises?: FlattenedExercise[];
  exerciseIndices?: number[];
  rounds?: number;
  restBetweenRounds?: number;
}

/** A single training day within a microcycle */
export interface TrainingDay {
  day: number; // 1-7
  title: string;
  durationMinutes: number;
  blocks: Block[];
}

/** Weekly intensity/volume progression */
export interface WeekProgression {
  intensity: string;
  volume: string;
}

/** Exercise-level adjustments for a specific week */
export interface ExerciseAdjustment {
  intensity?: string;
  sets?: number;
  reps?: number | string;
  rest?: number;
  duration?: string;
}

/** Block-level adjustments for a specific week */
export interface BlockAdjustment {
  rounds?: number;
  restBetweenRounds?: number;
}

/** Day-level adjustments */
export interface DayAdjustment {
  exercises?: Record<string, ExerciseAdjustment>;
  blocks?: Record<string, BlockAdjustment>;
}

/** Weekly adjustments configuration */
export interface WeeklyAdjustment {
  deload?: boolean;
  taper?: boolean;
  setReduction?: number;
  [dayKey: string]: DayAdjustment | boolean | number | undefined;
}

/** A mesocycle (training block) */
export interface Mesocycle {
  id: string;
  title: string;
  weeks: number[];
  phaseFocus: string;
  progression: { [key: string]: WeekProgression | undefined };
  microcycle: TrainingDay[];
  weeklyAdjustments?: Record<string, WeeklyAdjustment>;
}

/** The macrocycle (overall program structure) */
export interface Macrocycle {
  lengthWeeks: number;
  mesocycles: Mesocycle[];
}

/** Schema definition for exercise fields */
export interface SchemaDefinition {
  exerciseFields: {
    required: string[];
    trackingModes: Partial<Record<TrackingMode, string[]>>;
  };
}

/** App implementation configuration */
export interface AppImplementation {
  autoCalcLoads: string;
  rpeGuardrails: string;
  qualityChecks: {
    plyo?: string;
    substitutions: Record<string, string[]>;
  };
  tempoFormats: string;
  restDefaults: Record<string, number>;
  trackingModes: Partial<Record<TrackingMode, string>>;
}

/** Root program structure */
export interface RugbyProgram {
  id: string;
  title: string;
  description: string;
  trainingMaxNote: string;
  version: string;
  schema: SchemaDefinition;
  macrocycle: Macrocycle;
  appImplementation: AppImplementation;
}

// ============================================
// Helper types for UI consumption
// ============================================

/** Flattened exercise with context for display */
export interface FlattenedExercise extends Exercise {
  blockName: string;
  blockIndex: number;
  exerciseIndex: number;
}

/** Session with flattened exercises for UI consumption */
export interface FlattenedSession {
  mesoId: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  durationMinutes: number;
  blocks: Block[];
  allExercises: FlattenedExercise[];
}

// ============================================
// Utility functions
// ============================================

/**
 * Checks if an exercise should be tracked for 1RM calculations
 */
export function isTrackableFor1RM(exercise: Exercise): boolean {
  return exercise.trackingMode === '1RM';
}

/**
 * Checks if an exercise has sets/reps (vs time-based)
 */
export function hasSetReps(exercise: Exercise): boolean {
  return exercise.trackingMode !== 'time' && 
         exercise.sets !== undefined && 
         exercise.reps !== undefined;
}

/**
 * Checks if an exercise is time-based
 */
export function isTimeBased(exercise: Exercise): boolean {
  return exercise.trackingMode === 'time';
}

/**
 * Checks if an exercise is distance-based
 */
export function isDistanceBased(exercise: Exercise): boolean {
  return exercise.trackingMode === 'distance';
}

/**
 * Parses numeric reps from a reps field that might be a string
 * Returns the numeric value or null if it's a distance/time string
 */
export function parseNumericReps(reps: number | string | undefined): number | null {
  if (reps === undefined) return null;
  if (typeof reps === 'number') return reps;
  
  // Try to parse as number first (e.g., "8" -> 8)
  const parsed = parseInt(reps, 10);
  if (!isNaN(parsed) && String(parsed) === reps) {
    return parsed;
  }
  
  return null; // It's a distance/time string like "30m" or "15s"
}

/**
 * Parses intensity percentage from intensity string
 * e.g., "70% 1RM" -> 0.70, "80-85% 1RM" -> 0.825 (average)
 */
export function parseIntensityPercent(intensity: string | undefined): number | null {
  if (!intensity) return null;
  
  // Match patterns like "70% 1RM", "80-85% 1RM", "70–75% 1RM"
  const rangeMatch = intensity.match(/(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\s*%/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2 / 100;
  }
  
  const singleMatch = intensity.match(/(\d+(?:\.\d+)?)\s*%/);
  if (singleMatch) {
    return parseFloat(singleMatch[1]) / 100;
  }
  
  return null;
}

/**
 * Flattens blocks into a single exercise array for UI consumption
 */
export function flattenExercises(blocks: Block[]): FlattenedExercise[] {
  const result: FlattenedExercise[] = [];
  
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

/**
 * Creates renderable items from blocks, grouping circuits, supersets, and complexes
 */
export function createRenderableItems(blocks: Block[]): RenderableItem[] {
  const items: RenderableItem[] = [];
  let globalExerciseIndex = 0;
  
  blocks.forEach((block, blockIndex) => {
    const blockType = getBlockType(block);
    
    if (blockType === 'circuit' || blockType === 'superset' || blockType === 'complex') {
      // Group all exercises in this block together
      const groupedExercises: FlattenedExercise[] = [];
      const exerciseIndices: number[] = [];
      
      block.exercises.forEach((exercise, localIndex) => {
        groupedExercises.push({
          ...exercise,
          blockName: block.name,
          blockIndex,
          exerciseIndex: localIndex,
        });
        exerciseIndices.push(globalExerciseIndex);
        globalExerciseIndex++;
      });
      
      items.push({
        type: blockType,
        id: `${blockIndex}-group`,
        blockName: block.name,
        blockIndex,
        exercises: groupedExercises,
        exerciseIndices,
        rounds: block.rounds,
        restBetweenRounds: block.restBetweenRounds,
      });
    } else {
      // Add each exercise as individual item
      block.exercises.forEach((exercise, localIndex) => {
        items.push({
          type: 'exercise',
          id: `${blockIndex}-${localIndex}`,
          blockName: block.name,
          blockIndex,
          exercise: {
            ...exercise,
            blockName: block.name,
            blockIndex,
            exerciseIndex: localIndex,
          },
          exerciseIndex: globalExerciseIndex,
        });
        globalExerciseIndex++;
      });
    }
  });
  
  return items;
}

/**
 * Generates a session ID from mesocycle, week, and day
 */
export function generateSessionId(mesoId: string, weekIndex: number, dayNumber: number): string {
  return `${mesoId}-week${weekIndex}-day-${dayNumber}`;
}

/**
 * Parses a session ID to extract mesocycle, week, and day
 * Supports various mesocycle ID formats (m1, m2, p1, p2, test, etc.)
 */
export function parseSessionId(sessionId: string): { mesoId: string; weekIndex: number; dayNumber: number } | null {
  // Match any alphanumeric mesocycle ID followed by -week{n}-day-{n}
  // Supports both short IDs (m1, p1) and longer IDs (test, foundation)
  const match = sessionId.match(/^([a-zA-Z][a-zA-Z0-9]*)-week(\d+)-day-(\d+)$/);
  if (!match) return null;
  
  return {
    mesoId: match[1],
    weekIndex: parseInt(match[2], 10),
    dayNumber: parseInt(match[3], 10),
  };
}

