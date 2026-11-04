// Estimate 1RM using Epley formula
export const estimate1RM = (weight: number, reps: number): number | null => {
  if (!weight || !reps || reps <= 0) return null;
  return weight * (1 + reps / 30);
};

// Calculate average 1RM from multiple sets
export const calculateAverage1RM = (
  logs: { weight: string; reps: string }[]
): number | null => {
  const estimates = logs
    .map(({ weight, reps }) => estimate1RM(Number(weight), Number(reps)))
    .filter((val): val is number => typeof val === 'number' && !isNaN(val));

  if (estimates.length === 0) return null;
  const sum = estimates.reduce((a, b) => a + b, 0);
  return sum / estimates.length;
};

/**
 * Get percentage of 1RM for a given rep count (Epley-aligned).
 * Single source of truth for rep-based intensity across the app.
 */
export function getRepBasedPercent(reps: number): number {
  if (reps <= 0) return 0.65;
  if (reps <= 2) return 0.95;
  if (reps <= 3) return 0.91;
  if (reps <= 4) return 0.88;
  if (reps <= 5) return 0.86;
  if (reps <= 6) return 0.83;
  if (reps <= 8) return 0.79;
  if (reps <= 10) return 0.75;
  if (reps <= 12) return 0.70;
  return 0.65;
}

/**
 * Compute whether 1RM should be updated from completed set logs.
 * Used by SessionScreen on session complete and by validation tests.
 * @param logs - Per-set { weight, reps } for completed sets
 * @param current1RM - Current stored 1RM (must exist)
 * @param minIncrement - Minimum increase required (default 2.5 lbs)
 * @returns { shouldUpdate, new1RM } or { shouldUpdate: false } if no update
 */
export function compute1RMUpdateFromCompletedSets(
  logs: { weight: string; reps: string }[],
  current1RM: number,
  minIncrement: number = 2.5
): { shouldUpdate: boolean; new1RM?: number } {
  const validLogs = logs.filter(log => log.weight && log.reps);
  if (validLogs.length === 0) return { shouldUpdate: false };

  const estimates = validLogs
    .map(log => {
      const w = parseFloat(log.weight || '0');
      const r = parseInt(log.reps || '0', 10);
      return estimate1RM(w, r);
    })
    .filter((e): e is number => e != null);
  if (estimates.length === 0) return { shouldUpdate: false };

  const maxEstimate = Math.max(...estimates);
  const delta = maxEstimate - current1RM;
  if (delta >= minIncrement) {
    return { shouldUpdate: true, new1RM: Math.round(maxEstimate) };
  }
  return { shouldUpdate: false };
}

// Suggest weight based on 1RM and target reps
export const suggestWeights = (oneRM: number, targetReps: number): number[] => {
  if (!oneRM || targetReps <= 0) return [];
  const percent = getRepBasedPercent(targetReps);
  return [Math.round(oneRM * percent)];
};