/**
 * Shared hook to load session data (program + computed session).
 * Warm-ups and cool-downs are authored per day in program JSON — no type-based merge.
 * Used by SessionScreen and SessionBlockViewScreen so both get identical session data.
 */

import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  RugbyProgram,
  Block,
  flattenExercises,
  createRenderableItems,
  parseSessionId,
  expandFlowExercisesInBlocks,
} from '../types/program';

import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';
import recoveryWorkoutsData from '../data/recoveryWorkouts.json';

const PROGRAMS: Record<string, RugbyProgram> = {
  rugby: rugbyData as unknown as RugbyProgram,
  fitness: fitnessData as unknown as RugbyProgram,
  simple: simpleWeightData as unknown as RugbyProgram,
  test: testProgramData as unknown as RugbyProgram,
  hypertrophy: hypertrophyData as unknown as RugbyProgram,
};

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

export interface SessionData {
  mesoId: string;
  weekIndex: number;
  programWeek: number;
  dayNumber: number;
  title: string;
  durationMinutes: number;
  /** Optional coach/PT intent (e.g. DUP strength vs power stimulus) */
  sessionIntent?: string;
  blocks: Block[];
  allExercises: ReturnType<typeof flattenExercises>;
  renderableItems: ReturnType<typeof createRenderableItems>;
}

export function useSessionData(sessionId: string): {
  session: SessionData | null;
  programId: string;
  programData: RugbyProgram | null;
  isLoadingProgram: boolean;
} {
  const [programData, setProgramData] = useState<RugbyProgram | null>(null);
  const [programId, setProgramId] = useState<string>('rugby');
  const [isLoadingProgram, setIsLoadingProgram] = useState(true);

  useEffect(() => {
    const loadProgram = async () => {
      try {
        const storedProgramId = await AsyncStorage.getItem(STORAGE_KEY_PROGRAM);
        const id = storedProgramId && PROGRAMS[storedProgramId] ? storedProgramId : 'rugby';
        setProgramId(id);
        setProgramData(PROGRAMS[id] ?? PROGRAMS['rugby']);
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading program:', error);
        }
        setProgramData(PROGRAMS['rugby']);
        setProgramId('rugby');
        Alert.alert(
          'Loading Error',
          'Failed to load program data. Using default program.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsLoadingProgram(false);
      }
    };
    loadProgram();
  }, []);

  const session = useMemo((): SessionData | null => {
    if (sessionId.startsWith('recovery:')) {
      const parts = sessionId.split(':');
      if (parts.length >= 2) {
        const recoveryWorkoutId = parts[1];
        const recoveryWorkout = recoveryWorkoutsData.recoveryWorkouts.find(w => w.id === recoveryWorkoutId);
        if (recoveryWorkout) {
          const allExercises = flattenExercises(recoveryWorkout.blocks as Block[]);
          return {
            mesoId: 'recovery',
            weekIndex: 0,
            programWeek: 0,
            dayNumber: 0,
            title: recoveryWorkout.title,
            durationMinutes: recoveryWorkout.durationMinutes,
            blocks: recoveryWorkout.blocks as Block[],
            allExercises,
            renderableItems: createRenderableItems(recoveryWorkout.blocks as Block[]),
          };
        }
      }
      return null;
    }

    if (!programData) return null;

    const parsed = parseSessionId(sessionId);
    if (!parsed) return null;

    const { mesoId, weekIndex, dayNumber } = parsed;
    const meso = programData.macrocycle.mesocycles.find(m => m.id === mesoId);
    if (!meso || !meso.weeks || !Array.isArray(meso.weeks)) return null;

    const day = meso.microcycle.find(d => d.day === dayNumber);
    if (!day) return null;

    const weekKey = `week${meso.weeks[weekIndex] ?? weekIndex + 1}`;
    const adjustments = meso.weeklyAdjustments?.[weekKey];
    let adjustedBlocks = JSON.parse(JSON.stringify(day.blocks)) as Block[];

    if (adjustments) {
      const dayKey = `day${dayNumber}`;
      const dayAdj = adjustments[dayKey];
      if (dayAdj && typeof dayAdj === 'object') {
        if ('exercises' in dayAdj && dayAdj.exercises) {
          const exerciseAdjs = dayAdj.exercises as Record<string, any>;
          adjustedBlocks = adjustedBlocks.map(block => ({
            ...block,
            exercises: block.exercises.map(ex => {
              const adj = exerciseAdjs[ex.name];
              return adj ? { ...ex, ...adj } : ex;
            }),
          }));
        }
        if ('blocks' in dayAdj && dayAdj.blocks) {
          const blockAdjs = dayAdj.blocks as Record<string, any>;
          adjustedBlocks = adjustedBlocks.map(block => {
            const adj = blockAdjs[block.name];
            return adj ? { ...block, ...adj } : block;
          });
        }
      }
    }

    // Day-authored warm-ups/cool-downs only — expand intentional flow groups, no type-based merge
    adjustedBlocks = expandFlowExercisesInBlocks(adjustedBlocks);

    const programWeek = meso.weeks[weekIndex] ?? weekIndex + 1;
    return {
      mesoId,
      weekIndex,
      programWeek,
      dayNumber,
      title: day.title,
      durationMinutes: day.durationMinutes,
      sessionIntent: (day as { sessionIntent?: string }).sessionIntent,
      blocks: adjustedBlocks,
      allExercises: flattenExercises(adjustedBlocks),
      renderableItems: createRenderableItems(adjustedBlocks),
    };
  }, [sessionId, programData, programId]);

  return { session, programId, programData, isLoadingProgram };
}
