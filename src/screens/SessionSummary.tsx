import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { THEME } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSessionId, RugbyProgram, FlattenedExercise, isTrackableFor1RM, hasSetReps, parseNumericReps } from '../types/program';
import { getExerciseHistory, getRuleOf3TipText, applyRuleOf3Progression, getProgressionState, ExerciseLog, ProgressionState } from '../utils/progressionLogic';
import { getExercise1RM, get1RMHistory } from '../storage/logs';
import { estimate1RM } from '../utils/1rm';
import { calculateProgressStats } from '../utils/progressCalculations';
import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';
import recoveryWorkoutsData from '../data/recoveryWorkouts.json';
import { flattenExercises } from '../types/program';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

const PROGRAMS: Record<string, RugbyProgram> = {
  rugby: rugbyData as unknown as RugbyProgram,
  fitness: fitnessData as unknown as RugbyProgram,
  simple: simpleWeightData as unknown as RugbyProgram,
  test: testProgramData as unknown as RugbyProgram,
  hypertrophy: hypertrophyData as unknown as RugbyProgram,
};

const STORAGE_KEY_PROGRAM = 'selectedProgramId';
const BACKUP_TIP_SHOWN_KEY = 'backupTipShown';

// TypeScript interfaces
interface OneRMChange {
  exerciseName: string;
  previous1RM: number;
  current1RM: number;
  change: number;
  changePercent: number;
}

interface RuleOf3Info {
  exerciseName: string;
  consecutiveSuccesses: number;
  hitThreshold: boolean;
}

interface VolumeMetrics {
  totalWeight: number;
  totalReps: number;
  totalSets: number;
  avgWeightPerSet: number;
}

interface PersonalRecord {
  exerciseName: string;
  type: 'weight' | 'reps' | 'volume';
  previousMax: number;
  newMax: number;
  sessionDate: string;
}

interface ProgressionReadiness {
  exerciseName: string;
  readyForProgression: boolean;
  suggestedWeight?: number;
  currentWeight: number;
  consecutiveSuccesses: number;
  reason: string;
}

interface ReadinessInsights {
  averageReadiness: number;
  readinessCorrelation: 'positive' | 'negative' | 'neutral';
  highReadinessCount: number;
  lowReadinessCount: number;
}

interface RPEAnalysis {
  averageRPE: number;
  exercisesOverTarget: Array<{ exerciseName: string; rpe: number; targetRPE: number }>;
  exercisesUnderTarget: Array<{ exerciseName: string; rpe: number; targetRPE: number }>;
}

interface ProgramProgress {
  currentMeso: string;
  currentWeek: number;
  sessionsInMeso: number;
  totalSessionsInMeso: number;
  programProgressPercent: number;
}

interface ExerciseComparison {
  exerciseName: string;
  trend: 'improving' | 'declining' | 'stable';
  weightTrend: number;
  volumeTrend: number;
  isBestPerformer: boolean;
  needsAttention: boolean;
}

interface SessionComparison {
  exerciseName: string;
  weightChange?: number;
  volumeChange?: number;
  readinessChange?: number;
}

interface SessionExerciseData {
  exercise: FlattenedExercise;
  exerciseIndex: number;
  setLogs: Array<{ weight: string; reps: string }>;
  exerciseLog?: ExerciseLog;
}

export default function SessionSummary({ route, navigation }: Props) {
  const { sessionId, completed } = route.params;
  const [sessionData, setSessionData] = useState<{ title?: string; durationMinutes?: number; totalExercises?: number } | null>(null);
  const [programData, setProgramData] = useState<RugbyProgram | null>(null);
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseData[]>([]);
  const [oneRMChanges, setOneRMChanges] = useState<OneRMChange[]>([]);
  const [ruleOf3Info, setRuleOf3Info] = useState<RuleOf3Info[]>([]);
  const [volumeMetrics, setVolumeMetrics] = useState<VolumeMetrics | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [progressionReadiness, setProgressionReadiness] = useState<ProgressionReadiness[]>([]);
  const [readinessInsights, setReadinessInsights] = useState<ReadinessInsights | null>(null);
  const [rpeAnalysis, setRpeAnalysis] = useState<RPEAnalysis | null>(null);
  const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null);
  const [exerciseComparisons, setExerciseComparisons] = useState<ExerciseComparison[]>([]);
  const [sessionComparisons, setSessionComparisons] = useState<SessionComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBackupTip, setShowBackupTip] = useState<boolean | null>(null);

  // One-time backup tip (after first session summary)
  useEffect(() => {
    const checkBackupTip = async () => {
      try {
        const shown = await AsyncStorage.getItem(BACKUP_TIP_SHOWN_KEY);
        setShowBackupTip(shown !== 'true');
      } catch {
        setShowBackupTip(true);
      }
    };
    checkBackupTip();
  }, []);

  const dismissBackupTip = async () => {
    setShowBackupTip(false);
    try {
      await AsyncStorage.setItem(BACKUP_TIP_SHOWN_KEY, 'true');
    } catch {}
  };

  // Load program data
  useEffect(() => {
    const loadProgram = async () => {
      try {
        const storedProgramId = await AsyncStorage.getItem(STORAGE_KEY_PROGRAM);
        const programId = storedProgramId && PROGRAMS[storedProgramId] ? storedProgramId : 'rugby';
        setProgramData(PROGRAMS[programId]);
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading program:', error);
        }
        setProgramData(PROGRAMS['rugby']);
      }
    };
    loadProgram();
  }, []);

  // Load all session data
  useEffect(() => {
    if (!programData) return;

    const loadAllData = async () => {
      setIsLoading(true);
      try {
        // Load session data
        const logsKey = `sessionLogs:${sessionId}`;
        const logsData = await AsyncStorage.getItem(logsKey);
        if (logsData) {
          const logs = JSON.parse(logsData);
          setSessionData({
            title: logs.title,
            durationMinutes: logs.durationMinutes,
            totalExercises: logs.totalExercises,
          });
        }

        // Load session exercises
        const exercises = await loadSessionExercises();
        setSessionExercises(exercises);

        // Load set logs
        const setLogsData = await AsyncStorage.getItem(`setLogs:${sessionId}`);
        const setLogs = setLogsData ? JSON.parse(setLogsData) : {};

        // Update exercises with set logs (use exerciseIndex which is the original index)
        const exercisesWithLogs = exercises.map(ex => ({
          ...ex,
          setLogs: setLogs[String(ex.exerciseIndex)] || setLogs[ex.exerciseIndex] || [],
        }));
        setSessionExercises(exercisesWithLogs);

        // Calculate all metrics
        const changes = await detect1RMChanges(exercisesWithLogs);
        setOneRMChanges(changes);

        const ruleOf3 = await detectRuleOf3Triggers(exercisesWithLogs);
        setRuleOf3Info(ruleOf3);

        const volume = calculateVolumeMetrics(exercisesWithLogs);
        setVolumeMetrics(volume);

        const prs = await detectPersonalRecords(exercisesWithLogs);
        setPersonalRecords(prs);

        const readiness = await getProgressionReadiness(exercisesWithLogs);
        setProgressionReadiness(readiness);

        const insights = analyzeReadiness(exercisesWithLogs);
        setReadinessInsights(insights);

        const rpe = analyzeRPE(exercisesWithLogs);
        setRpeAnalysis(rpe);

        const progress = await calculateProgramProgress();
        setProgramProgress(progress);

        const exComparisons = await compareExercises(exercisesWithLogs);
        setExerciseComparisons(exComparisons);

        const sessionComps = compareToPreviousSessions(exercisesWithLogs);
        setSessionComparisons(sessionComps);
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading session data:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [sessionId, programData]);

  // Load session exercises
  const loadSessionExercises = async (): Promise<SessionExerciseData[]> => {
    if (!programData) return [];

    // Check if this is a recovery workout
    if (sessionId.startsWith('recovery:')) {
      const parts = sessionId.split(':');
      if (parts.length >= 2) {
        const recoveryWorkoutId = parts[1];
        const recoveryWorkout = recoveryWorkoutsData.recoveryWorkouts.find(w => w.id === recoveryWorkoutId);
        if (recoveryWorkout) {
          const allExercises = flattenExercises(recoveryWorkout.blocks as any[]);
          return allExercises
            .filter((ex, idx) => completed.includes(idx))
            .map((ex, idx) => ({
              exercise: ex,
              exerciseIndex: completed.indexOf(allExercises.indexOf(ex)),
              setLogs: [],
            }));
        }
      }
      return [];
    }

    // Regular program session
    const parsed = parseSessionId(sessionId);
    if (!parsed) return [];

    const { mesoId, weekIndex, dayNumber } = parsed;
    const meso = programData.macrocycle.mesocycles.find(m => m.id === mesoId);
    if (!meso) return [];

    const day = meso.microcycle.find(d => d.day === dayNumber);
    if (!day) return [];

    const allExercises = flattenExercises(day.blocks);

    // Filter out warm-up/cool-down exercises, but keep original index for set logs
    const filteredExercises = allExercises
      .map((ex, idx) => ({ exercise: ex, originalIndex: idx }))
      .filter(({ exercise }) => {
        const blockName = exercise.blockName?.toLowerCase() || '';
        return !(
          blockName.includes('warm-up') ||
          blockName.includes('warm up') ||
          blockName.includes('cool-down') ||
          blockName.includes('cool down') ||
          blockName.includes('cooldown') ||
          blockName.includes('activation') ||
          blockName.includes('mobility') ||
          blockName.includes('stretching')
        );
      })
      .filter(({ originalIndex }) => completed.includes(originalIndex));

    // Load exercise history for each exercise
    const exercisesWithHistory = await Promise.all(
      filteredExercises.map(async ({ exercise, originalIndex }) => {
        const history = await getExerciseHistory(exercise.name);
        const sessionLog = history.find(log => log.sessionId === sessionId);
        return {
          exercise,
          exerciseIndex: originalIndex, // Use original index for set logs
          setLogs: [],
          exerciseLog: sessionLog,
        };
      })
    );

    return exercisesWithHistory;
  };

  // Detect 1RM changes
  const detect1RMChanges = async (exercises: SessionExerciseData[]): Promise<OneRMChange[]> => {
    const changes: OneRMChange[] = [];

    for (const { exercise } of exercises) {
      if (!isTrackableFor1RM(exercise)) continue;

      // Get current 1RM
      const current1RM = await getExercise1RM(exercise.name);
      if (!current1RM) continue;

      // Get 1RM history (try both formats)
      let history: Array<{ date: string; value: number }> = [];
      try {
        const history1 = await AsyncStorage.getItem(`1RMHistory:${exercise.name}`);
        if (history1) {
          history = JSON.parse(history1);
        } else {
          const history2 = await AsyncStorage.getItem(`1rmHistory-${exercise.name}`);
          if (history2) {
            history = JSON.parse(history2);
          }
        }
      } catch (e) {
        // Ignore
      }

      // Find entry from today (session date)
      const sessionLog = exercises.find(ex => ex.exercise.name === exercise.name)?.exerciseLog;
      if (!sessionLog) continue;

      const sessionDate = new Date(sessionLog.date).toDateString();
      const todayEntry = history.find(entry => new Date(entry.date).toDateString() === sessionDate);

      if (todayEntry) {
        // Find previous 1RM (before today)
        const previousEntries = history.filter(entry => new Date(entry.date).toDateString() !== sessionDate);
        const previous1RM = previousEntries.length > 0 ? previousEntries[0].value : current1RM;

        if (Math.abs(current1RM - previous1RM) > 0.1) {
          const change = current1RM - previous1RM;
          const changePercent = (change / previous1RM) * 100;
          changes.push({
            exerciseName: exercise.name,
            previous1RM,
            current1RM,
            change,
            changePercent,
          });
        }
      }
    }

    return changes;
  };

  // Detect Rule of 3 triggers
  const detectRuleOf3Triggers = async (exercises: SessionExerciseData[]): Promise<RuleOf3Info[]> => {
    const info: RuleOf3Info[] = [];

    for (const { exercise, exerciseLog } of exercises) {
      // Check if exercise uses Rule of 3 (volume tracking, not 1RM tracked)
      if (exercise.trackingMode !== 'volume' || isTrackableFor1RM(exercise)) continue;

      // Get consecutiveSuccesses from progression state (more reliable than exercise log)
      const state = await getProgressionState(exercise.name);
      const consecutiveSuccesses = state?.consecutiveSuccesses || exerciseLog?.consecutiveSuccesses || 0;

      if (consecutiveSuccesses > 0 || exerciseLog) {
        info.push({
          exerciseName: exercise.name,
          consecutiveSuccesses,
          hitThreshold: consecutiveSuccesses >= 3,
        });
      }
    }

    return info;
  };

  // Calculate volume metrics
  const calculateVolumeMetrics = (exercises: SessionExerciseData[]): VolumeMetrics | null => {
    let totalWeight = 0;
    let totalReps = 0;
    let totalSets = 0;

    for (const { setLogs } of exercises) {
      for (const set of setLogs) {
        const weight = parseFloat(set.weight || '0');
        const reps = parseNumericReps(set.reps || '0') || 0;
        if (!isNaN(weight) && weight > 0 && reps > 0) {
          totalWeight += weight * reps;
          totalReps += reps;
          totalSets += 1;
        }
      }
    }

    if (totalSets === 0) return null;

    return {
      totalWeight,
      totalReps,
      totalSets,
      avgWeightPerSet: totalWeight / totalSets,
    };
  };

  // Detect personal records
  const detectPersonalRecords = async (exercises: SessionExerciseData[]): Promise<PersonalRecord[]> => {
    const prs: PersonalRecord[] = [];

    for (const { exercise, setLogs, exerciseLog } of exercises) {
      if (!exerciseLog) continue;

      const history = await getExerciseHistory(exercise.name);
      const previousSessions = history.filter(log => log.sessionId !== sessionId && log.isCompleted);

      // Check for max weight
      if (exerciseLog.weight && previousSessions.length > 0) {
        const maxWeight = Math.max(...previousSessions.map(log => log.weight || 0).filter(w => w > 0));
        if (exerciseLog.weight > maxWeight) {
          prs.push({
            exerciseName: exercise.name,
            type: 'weight',
            previousMax: maxWeight,
            newMax: exerciseLog.weight,
            sessionDate: exerciseLog.date,
          });
        }
      }

      // Check for max reps
      const sessionReps = parseNumericReps(exerciseLog.reps?.toString() || '0') || 0;
      if (sessionReps > 0 && previousSessions.length > 0) {
        const maxReps = Math.max(
          ...previousSessions
            .map(log => parseNumericReps(log.reps?.toString() || '0') || 0)
            .filter(r => r > 0)
        );
        if (sessionReps > maxReps) {
          prs.push({
            exerciseName: exercise.name,
            type: 'reps',
            previousMax: maxReps,
            newMax: sessionReps,
            sessionDate: exerciseLog.date,
          });
        }
      }

      // Check for max volume
      const sessionVolume = exerciseLog.weight && sessionReps ? exerciseLog.weight * sessionReps * (exerciseLog.sets || 1) : 0;
      if (sessionVolume > 0 && previousSessions.length > 0) {
        const maxVolumes = previousSessions.map(log => {
          const reps = parseNumericReps(log.reps?.toString() || '0') || 0;
          return (log.weight || 0) * reps * (log.sets || 1);
        }).filter(v => v > 0);
        const maxVolume = maxVolumes.length > 0 ? Math.max(...maxVolumes) : 0;
        if (sessionVolume > maxVolume) {
          prs.push({
            exerciseName: exercise.name,
            type: 'volume',
            previousMax: maxVolume,
            newMax: sessionVolume,
            sessionDate: exerciseLog.date,
          });
        }
      }
    }

    return prs;
  };

  // Get progression readiness
  const getProgressionReadiness = async (exercises: SessionExerciseData[]): Promise<ProgressionReadiness[]> => {
    const readiness: ProgressionReadiness[] = [];

    for (const { exercise, exerciseLog } of exercises) {
      if (exercise.trackingMode !== 'volume' || isTrackableFor1RM(exercise)) continue;

      const state = await getProgressionState(exercise.name);
      if (!state && !exerciseLog) continue;

      const currentWeight = exerciseLog?.weight || state?.currentWeight || 0;
      if (currentWeight <= 0) continue;

      // Apply Rule of 3 progression to get suggestions
      try {
        const suggestion = await applyRuleOf3Progression(
          exercise.name,
          currentWeight,
          exercise.exerciseCategory || 'assistance',
          exercise,
          exercise.minIncrement
        );

        readiness.push({
          exerciseName: exercise.name,
          readyForProgression: suggestion.consecutiveSuccesses >= 3 || suggestion.ruleApplied === 'rule_of_3',
          suggestedWeight: suggestion.suggestedWeight !== currentWeight ? suggestion.suggestedWeight : undefined,
          currentWeight,
          consecutiveSuccesses: suggestion.consecutiveSuccesses || 0,
          reason: suggestion.reason,
        });
      } catch (error) {
        // Ignore errors
      }
    }

    return readiness;
  };

  // Analyze readiness
  const analyzeReadiness = (exercises: SessionExerciseData[]): ReadinessInsights | null => {
    const readinessScores = exercises
      .map(ex => ex.exerciseLog?.readiness)
      .filter((r): r is number => r !== undefined && r > 0);

    if (readinessScores.length === 0) return null;

    const averageReadiness = readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length;
    const highReadinessCount = readinessScores.filter(r => r >= 8).length;
    const lowReadinessCount = readinessScores.filter(r => r <= 3).length;

    // Simple correlation: if high readiness, check if performance was good
    // This is a simplified check - could be enhanced
    let correlation: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (readinessScores.length > 0) {
      const highReadinessSessions = exercises.filter(ex => (ex.exerciseLog?.readiness || 0) >= 8);
      const avgWeightHigh = highReadinessSessions.reduce((sum, ex) => sum + (ex.exerciseLog?.weight || 0), 0) / highReadinessSessions.length;
      const lowReadinessSessions = exercises.filter(ex => (ex.exerciseLog?.readiness || 0) <= 3);
      const avgWeightLow = lowReadinessSessions.reduce((sum, ex) => sum + (ex.exerciseLog?.weight || 0), 0) / lowReadinessSessions.length;

      if (avgWeightHigh > avgWeightLow * 1.05) {
        correlation = 'positive';
      } else if (avgWeightHigh < avgWeightLow * 0.95) {
        correlation = 'negative';
      }
    }

    return {
      averageReadiness,
      readinessCorrelation: correlation,
      highReadinessCount,
      lowReadinessCount,
    };
  };

  // Analyze RPE
  const analyzeRPE = (exercises: SessionExerciseData[]): RPEAnalysis | null => {
    type RpeScore = { rpe: number; exercise: SessionExerciseData['exercise'] };
    const rpeScores = exercises
      .map(ex => ({ rpe: ex.exerciseLog?.rpe, exercise: ex.exercise }))
      .filter((item): item is RpeScore => item.rpe !== undefined && item.rpe > 0);

    if (rpeScores.length === 0) return null;

    const averageRPE = rpeScores.reduce((sum, item) => sum + item.rpe, 0) / rpeScores.length;

    const exercisesOverTarget: Array<{ exerciseName: string; rpe: number; targetRPE: number }> = [];
    const exercisesUnderTarget: Array<{ exerciseName: string; rpe: number; targetRPE: number }> = [];

    for (const item of rpeScores) {
      const { rpe, exercise } = item;
      const targetRPE = exercise.targetRPE;
      if (targetRPE) {
        if (rpe > targetRPE + 1) {
          exercisesOverTarget.push({ exerciseName: exercise.name, rpe, targetRPE });
        } else if (rpe < targetRPE - 1) {
          exercisesUnderTarget.push({ exerciseName: exercise.name, rpe, targetRPE });
        }
      }
    }

    return {
      averageRPE,
      exercisesOverTarget,
      exercisesUnderTarget,
    };
  };

  // Calculate program progress
  const calculateProgramProgress = async (): Promise<ProgramProgress | null> => {
    if (!programData) return null;

    const parsed = parseSessionId(sessionId);
    if (!parsed) return null;

    const { mesoId, weekIndex } = parsed;
    const meso = programData.macrocycle.mesocycles.find(m => m.id === mesoId);
    if (!meso) return null;

    // Get completed sessions
    const completedSessionsData = await AsyncStorage.getItem('completedSessions');
    const completedSessions = completedSessionsData ? JSON.parse(completedSessionsData) : [];

    // Count sessions in this mesocycle
    const mesoSessions = completedSessions.filter((s: { id: string }) => {
      const parsed = parseSessionId(s.id);
      return parsed && parsed.mesoId === mesoId;
    });

    // Estimate total sessions in mesocycle (approximate)
    const totalSessionsInMeso = (meso.weeks?.length || 1) * (meso.microcycle?.length || 1);

    const sessionsInMeso = mesoSessions.length;
    const programProgressPercent = totalSessionsInMeso > 0 ? (sessionsInMeso / totalSessionsInMeso) * 100 : 0;

    return {
      currentMeso: mesoId,
      currentWeek: weekIndex,
      sessionsInMeso,
      totalSessionsInMeso,
      programProgressPercent: Math.min(100, programProgressPercent),
    };
  };

  // Compare exercises
  const compareExercises = async (exercises: SessionExerciseData[]): Promise<ExerciseComparison[]> => {
    const comparisons: ExerciseComparison[] = [];

    for (const { exercise, exerciseLog } of exercises) {
      if (!exerciseLog) continue;

      const history = await getExerciseHistory(exercise.name);
      const recentSessions = history
        .filter(log => log.sessionId !== sessionId && log.isCompleted)
        .slice(0, 5);

      if (recentSessions.length < 2) continue;

      const currentWeight = exerciseLog.weight || 0;
      const currentVolume = currentWeight * (parseNumericReps(exerciseLog.reps?.toString() || '0') || 0) * (exerciseLog.sets || 1);

      const avgRecentWeight = recentSessions.reduce((sum, log) => sum + (log.weight || 0), 0) / recentSessions.length;
      const avgRecentVolume = recentSessions.reduce((sum, log) => {
        const reps = parseNumericReps(log.reps?.toString() || '0') || 0;
        return sum + (log.weight || 0) * reps * (log.sets || 1);
      }, 0) / recentSessions.length;

      const weightTrend = currentWeight - avgRecentWeight;
      const volumeTrend = currentVolume - avgRecentVolume;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (weightTrend > avgRecentWeight * 0.05 || volumeTrend > avgRecentVolume * 0.1) {
        trend = 'improving';
      } else if (weightTrend < -avgRecentWeight * 0.05 || volumeTrend < -avgRecentVolume * 0.1) {
        trend = 'declining';
      }

      comparisons.push({
        exerciseName: exercise.name,
        trend,
        weightTrend,
        volumeTrend,
        isBestPerformer: trend === 'improving',
        needsAttention: trend === 'declining',
      });
    }

    // Mark best and worst performers
    if (comparisons.length > 0) {
      const improving = comparisons.filter(c => c.trend === 'improving');
      if (improving.length > 0) {
        const best = improving.reduce((a, b) => (b.weightTrend + b.volumeTrend > a.weightTrend + a.volumeTrend ? b : a));
        comparisons.forEach(c => {
          c.isBestPerformer = c.exerciseName === best.exerciseName;
        });
      }

      const declining = comparisons.filter(c => c.trend === 'declining');
      if (declining.length > 0) {
        const worst = declining.reduce((a, b) => (b.weightTrend + b.volumeTrend < a.weightTrend + a.volumeTrend ? b : a));
        comparisons.forEach(c => {
          c.needsAttention = c.exerciseName === worst.exerciseName && c.trend === 'declining';
        });
      }
    }

    return comparisons;
  };

  // Compare to previous sessions
  const compareToPreviousSessions = (exercises: SessionExerciseData[]): SessionComparison[] => {
    // This is a simplified comparison - could be enhanced with actual previous session data
    return exercises
      .filter(ex => ex.exerciseLog)
      .map(({ exercise, exerciseLog }) => ({
        exerciseName: exercise.name,
        weightChange: exerciseLog?.weight,
        volumeChange: exerciseLog?.weight && exerciseLog.reps
          ? exerciseLog.weight * (parseNumericReps(exerciseLog.reps.toString()) || 0) * (exerciseLog.sets || 1)
          : undefined,
        readinessChange: exerciseLog?.readiness,
      }));
  };

  // Format percentage change
  const formatPercentageChange = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  // Format weight
  const formatWeight = (weight: number): string => {
    return `${Math.round(weight)} lbs`;
  };

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    if (!sessionData?.totalExercises) return null;
    return Math.round((completed.length / sessionData.totalExercises) * 100);
  }, [completed.length, sessionData?.totalExercises]);

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.header}>🏁 Session Summary</Text>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {showBackupTip === true && (
        <View style={styles.backupTipBanner}>
          <Text style={styles.backupTipText}>
            Tip: Back up your data in Help so you don't lose it if you change phones.
          </Text>
          <TouchableOpacity onPress={dismissBackupTip} style={styles.backupTipDismiss}>
            <Text style={styles.backupTipDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.header}>🏁 Session Summary</Text>
        {sessionData?.title && (
          <Text style={styles.sessionTitle}>{sessionData.title}</Text>
        )}
        
          {/* Enhanced Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{completed.length}</Text>
            <Text style={styles.statLabel}>Exercises Completed</Text>
          </View>
          
          {completionPercentage !== null && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{completionPercentage}%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </View>
          )}
          
          {sessionData?.durationMinutes && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{sessionData.durationMinutes}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          )}

            {volumeMetrics && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{Math.round(volumeMetrics.totalWeight)}</Text>
                <Text style={styles.statLabel}>Total Volume (lbs)</Text>
              </View>
            )}

            {readinessInsights && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{readinessInsights.averageReadiness.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Avg Readiness</Text>
              </View>
            )}

            {rpeAnalysis && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{rpeAnalysis.averageRPE.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Avg RPE</Text>
              </View>
            )}
        </View>

          {/* Program Progress Card */}
          {programProgress && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📊 Program Progress</Text>
              <Text style={styles.sectionText}>
                Mesocycle: {programProgress.currentMeso}
              </Text>
              <Text style={styles.sectionText}>
                Week {programProgress.currentWeek}
              </Text>
              <Text style={styles.sectionText}>
                {programProgress.sessionsInMeso} / {programProgress.totalSessionsInMeso} sessions completed
              </Text>
              <Text style={styles.progressText}>
                {programProgress.programProgressPercent.toFixed(0)}% complete
              </Text>
            </View>
          )}

          {/* Volume Metrics Card */}
          {volumeMetrics && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>💪 Volume Metrics</Text>
              <Text style={styles.sectionText}>Total Weight: {formatWeight(volumeMetrics.totalWeight)}</Text>
              <Text style={styles.sectionText}>Total Reps: {volumeMetrics.totalReps}</Text>
              <Text style={styles.sectionText}>Total Sets: {volumeMetrics.totalSets}</Text>
              <Text style={styles.sectionText}>Avg per Set: {formatWeight(volumeMetrics.avgWeightPerSet)}</Text>
            </View>
          )}

          {/* Personal Records Card */}
          {personalRecords.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🏆 Personal Records</Text>
              {personalRecords.map((pr, idx) => (
                <View key={idx} style={styles.prItem}>
                  <Text style={styles.prExercise}>{pr.exerciseName}</Text>
                  <Text style={styles.prText}>
                    New {pr.type === 'weight' ? 'Max Weight' : pr.type === 'reps' ? 'Max Reps' : 'Max Volume'}: {pr.newMax.toFixed(0)}
                    {pr.type === 'weight' ? ' lbs' : ''}
                  </Text>
                  <Text style={styles.prSubtext}>
                    Previous: {pr.previousMax.toFixed(0)}{pr.type === 'weight' ? ' lbs' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* 1RM Changes Card */}
          {oneRMChanges.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📈 1RM Changes</Text>
              {oneRMChanges.map((change, idx) => (
                <View key={idx} style={styles.changeItem}>
                  <Text style={styles.changeExercise}>{change.exerciseName}</Text>
                  <Text style={[styles.changeText, change.change > 0 ? styles.positiveChange : styles.negativeChange]}>
                    {formatWeight(change.previous1RM)} → {formatWeight(change.current1RM)}
                    {' '}({formatPercentageChange(change.changePercent)})
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Rule of 3 Card */}
          {ruleOf3Info.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📋 Rule of 3</Text>
              <Text style={styles.educationText}>{getRuleOf3TipText()}</Text>
              {ruleOf3Info.map((info, idx) => (
                <View key={idx} style={styles.ruleOf3Item}>
                  <Text style={styles.ruleOf3Exercise}>{info.exerciseName}</Text>
                  <Text style={styles.ruleOf3Text}>
                    {info.hitThreshold
                      ? `✅ Threshold met! (${info.consecutiveSuccesses} consecutive successes)`
                      : `Building: ${info.consecutiveSuccesses}/3 consecutive successes`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Progression Readiness Card */}
          {progressionReadiness.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🚀 Progression Readiness</Text>
              {progressionReadiness
                .filter(pr => pr.readyForProgression || pr.consecutiveSuccesses > 0)
                .map((pr, idx) => (
                  <View key={idx} style={styles.progressionItem}>
                    <Text style={styles.progressionExercise}>{pr.exerciseName}</Text>
                    <Text style={styles.progressionText}>{pr.reason}</Text>
                    {pr.suggestedWeight && (
                      <Text style={styles.progressionSuggestion}>
                        Suggested weight: {formatWeight(pr.suggestedWeight)}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          )}

          {/* Readiness Insights Card */}
          {readinessInsights && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>⚡ Readiness Insights</Text>
              <Text style={styles.sectionText}>
                Average Readiness: {readinessInsights.averageReadiness.toFixed(1)}/10
              </Text>
              <Text style={styles.sectionText}>
                High Readiness: {readinessInsights.highReadinessCount} exercises
              </Text>
              <Text style={styles.sectionText}>
                Low Readiness: {readinessInsights.lowReadinessCount} exercises
              </Text>
              <Text style={styles.correlationText}>
                Correlation: {readinessInsights.readinessCorrelation === 'positive'
                  ? '✅ Positive (high readiness = better performance)'
                  : readinessInsights.readinessCorrelation === 'negative'
                  ? '⚠️ Negative'
                  : '➖ Neutral'}
              </Text>
            </View>
          )}

          {/* RPE Analysis Card */}
          {rpeAnalysis && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🔥 RPE Analysis</Text>
              <Text style={styles.sectionText}>Average RPE: {rpeAnalysis.averageRPE.toFixed(1)}/10</Text>
              {rpeAnalysis.exercisesOverTarget.length > 0 && (
                <View>
                  <Text style={styles.rpeSectionLabel}>Over Target RPE:</Text>
                  {rpeAnalysis.exercisesOverTarget.map((ex, idx) => (
                    <Text key={idx} style={styles.rpeItem}>
                      {ex.exerciseName}: {ex.rpe.toFixed(1)} (target: {ex.targetRPE})
                    </Text>
                  ))}
                </View>
              )}
              {rpeAnalysis.exercisesUnderTarget.length > 0 && (
                <View>
                  <Text style={styles.rpeSectionLabel}>Under Target RPE:</Text>
                  {rpeAnalysis.exercisesUnderTarget.map((ex, idx) => (
                    <Text key={idx} style={styles.rpeItem}>
                      {ex.exerciseName}: {ex.rpe.toFixed(1)} (target: {ex.targetRPE})
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Exercise Comparison Card */}
          {exerciseComparisons.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📊 Exercise Comparison</Text>
              {exerciseComparisons
                .filter(ec => ec.isBestPerformer || ec.needsAttention)
                .map((ec, idx) => (
                  <View key={idx} style={styles.comparisonItem}>
                    <Text style={styles.comparisonExercise}>{ec.exerciseName}</Text>
                    <Text style={styles.comparisonText}>
                      {ec.isBestPerformer
                        ? `⭐ Best Performer: ${ec.trend === 'improving' ? 'Improving' : 'Stable'}`
                        : ec.needsAttention
                        ? `⚠️ Needs Attention: ${ec.trend === 'declining' ? 'Declining' : 'Stable'}`
                        : `Trend: ${ec.trend}`}
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {/* Session Comparisons Card */}
          {sessionComparisons.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📈 Session Comparison</Text>
              {sessionComparisons.slice(0, 5).map((sc, idx) => (
                <View key={idx} style={styles.comparisonItem}>
                  <Text style={styles.comparisonExercise}>{sc.exerciseName}</Text>
                  {sc.weightChange && (
                    <Text style={styles.comparisonText}>Weight: {formatWeight(sc.weightChange)}</Text>
                  )}
                  {sc.volumeChange && (
                    <Text style={styles.comparisonText}>Volume: {formatWeight(sc.volumeChange)}</Text>
                  )}
                  {sc.readinessChange && (
                    <Text style={styles.comparisonText}>Readiness: {sc.readinessChange}/10</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackToHome}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>🏠 Back to Home</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backupTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.primaryFaded,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  backupTipText: {
    flex: 1,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  backupTipDismiss: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backupTipDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 8,
    color: THEME.primary,
  },
  sessionTitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    backgroundColor: THEME.primaryFaded,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
    flex: 1,
    maxWidth: '48%',
  },
  statValue: { 
    fontSize: 36, 
    fontWeight: '800',
    color: THEME.primary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: THEME.primaryFaded,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  educationText: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
    marginTop: 8,
  },
  prItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  prExercise: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  prText: {
    fontSize: 14,
    color: THEME.primary,
    fontWeight: '600',
  },
  prSubtext: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  changeItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  changeExercise: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  positiveChange: {
    color: '#22c55e',
  },
  negativeChange: {
    color: '#ef4444',
  },
  ruleOf3Item: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  ruleOf3Exercise: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  ruleOf3Text: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  progressionItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  progressionExercise: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  progressionText: {
    fontSize: 14,
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  progressionSuggestion: {
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '600',
  },
  correlationText: {
    fontSize: 14,
    color: THEME.textPrimary,
    marginTop: 8,
    fontWeight: '500',
  },
  rpeSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  rpeItem: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  comparisonItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  comparisonExercise: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  comparisonText: {
    fontSize: 14,
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
});
