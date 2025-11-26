// src/types.ts

export type Exercise = {
  name: string;
  sets: number;
  reps: string | number;   // can be "15s sprint / 15s rest" or a number
  rest: number | string;   // JSON sometimes has rest as string, so allow both
  intensity?: string;
  trackSets?: boolean;
};

export type TrainingSession = {
  id: string;
  title: string;
  day: number;
  exercises: Exercise[];
};

export type CompletedSession = {
  id: string;
  title?: string;
  date: string;
  load?: number;
  fatigue?: number;
  notes?: string;
};

// 👇 New types for rugbyData structure
export type MicrocycleDay = TrainingSession;

export type Mesocycle = {
  id: string;
  title: string;
  phase: string;
  goal: string;
  frequency: string;
  microcycle: MicrocycleDay[];
};

export type RugbyProgram = {
  macrocycle: {
    mesocycles: Mesocycle[];
  };
};