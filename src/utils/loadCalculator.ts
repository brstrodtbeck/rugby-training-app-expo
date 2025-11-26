// loadCalculator.ts
// Utility to calculate suggested training load based on Prilepin's Chart

import { getOneRM } from './oneRMStore';

// ✅ Prilepin chart defined locally (no separate file needed)
const prilepinChart: Record<number, { optimal: number; range: [number, number] }> = {
  70: { optimal: 12, range: [10, 20] },
  75: { optimal: 12, range: [10, 20] },
  80: { optimal: 10, range: [8, 12] },
  85: { optimal: 7, range: [6, 10] },
  90: { optimal: 4, range: [3, 6] },
};

// ✅ Main export used in SessionSummary
export async function calculateSuggestedLoad(
  exercise: string,
  intensity: string,
  sets: number,
  reps: number
): Promise<{ load: number; adjustedPercent: number } | null> {
  const oneRM = await getOneRM(exercise);
  if (!oneRM) return null;

  const match = intensity.match(/(\d+)%/);
  if (!match) return null;

  let percent = parseInt(match[1], 10);
  const totalReps = sets * reps;

  const chart = prilepinChart[percent];
  if (chart) {
    if (totalReps < chart.range[0]) {
      percent = Math.min(percent + 5, 95);
    } else if (totalReps > chart.range[1]) {
      percent = Math.max(percent - 5, 60);
    }
  }

  const load = Math.round(oneRM * (percent / 100));
  return { load, adjustedPercent: percent };
}

// ✅ Legacy export (optional, if other screens still use it)
export function getSuggestedLoad(sets: number, reps: number, oneRM: number) {
  const totalReps = sets * reps;

  if (totalReps >= 18 && totalReps <= 30) {
    return {
      percent: 0.72,
      weight: Math.round(oneRM * 0.72),
      descriptor: "Moderate volume, moderate intensity (Prilepin 70–75%)",
    };
  }
  if (totalReps >= 10 && totalReps <= 20) {
    return {
      percent: 0.80,
      weight: Math.round(oneRM * 0.80),
      descriptor: "Lower volume, higher intensity (Prilepin 76–85%)",
    };
  }
  if (totalReps >= 4 && totalReps <= 10) {
    return {
      percent: 0.88,
      weight: Math.round(oneRM * 0.88),
      descriptor: "Heavy singles/doubles (Prilepin 86–90%)",
    };
  }
  if (totalReps <= 4) {
    return {
      percent: 0.93,
      weight: Math.round(oneRM * 0.93),
      descriptor: "Maximal effort zone (Prilepin 91%+)",
    };
  }

  return {
    percent: 0.70,
    weight: Math.round(oneRM * 0.70),
    descriptor: "Default suggestion (approx. 70% of 1RM)",
  };
}
  // ✅ Simple wrapper for use in SessionScreen
export function calculateSuggestedWeight(
  exerciseName: string,
  oneRMMap: Record<string, number>,
  sets: number,
  reps: number
): number | null {
  const oneRM = oneRMMap[exerciseName];
  if (!oneRM) return null;

  const suggestion = getSuggestedLoad(sets, reps, oneRM);
  return suggestion?.weight ?? null;
}
