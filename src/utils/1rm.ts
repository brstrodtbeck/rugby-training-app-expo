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

// Suggest weight based on 1RM and target reps
export const suggestWeights = (oneRM: number, targetReps: number): number[] => {
  if (!oneRM || targetReps <= 0) return [];

  if (targetReps <= 2) return [Math.round(oneRM * 0.9)];
  if (targetReps <= 4) return [Math.round(oneRM * 0.85)];
  if (targetReps <= 6) return [Math.round(oneRM * 0.75)];
  if (targetReps <= 10) return [Math.round(oneRM * 0.65)];
  return [Math.round(oneRM * 0.55)];
};