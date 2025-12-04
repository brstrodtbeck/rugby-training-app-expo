import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  AppState,
  AppStateStatus,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import IntervalTimer from '../components/IntervalTimer';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import { THEME } from '../theme/colors';
import {
  getProgressionType,
  applyRuleOf3Progression,
  inferExerciseCategory,
  getRuleOf3TipText,
  getProgressionIndicatorColor,
  ProgressionSuggestion,
} from '../utils/progressionLogic';
import {
  getWarmupSetsForTargetReps,
  formatPercentage,
  WarmupSet,
  adjustWorkoutForReadiness,
  getReadinessLabel,
  getReadinessColor,
  ReadinessAdjustment,
} from '../utils/1rmHybrid';
import {
  RugbyProgram,
  TrainingDay,
  Block,
  Exercise,
  FlattenedExercise,
  flattenExercises,
  createRenderableItems,
  RenderableItem,
  getBlockType,
  parseSessionId,
  parseNumericReps,
  parseIntensityPercent,
  isTrackableFor1RM,
  isTimeBased,
  hasSetReps,
} from '../types/program';

// Import all programs
import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';
import recoveryWorkoutsData from '../data/recoveryWorkouts.json';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

// Program registry matching HomeScreen
const PROGRAMS: Record<string, RugbyProgram> = {
  rugby: rugbyData as unknown as RugbyProgram,
  fitness: fitnessData as unknown as RugbyProgram,
  simple: simpleWeightData as unknown as RugbyProgram,
  test: testProgramData as unknown as RugbyProgram,
  hypertrophy: hypertrophyData as unknown as RugbyProgram,
};

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

/** Represents the session data structure for display */
interface SessionData {
  mesoId: string;
  weekIndex: number;
  dayNumber: number;
  title: string;
  durationMinutes: number;
  blocks: Block[];
  allExercises: FlattenedExercise[];
  renderableItems: RenderableItem[];
}

/** Extended exercise with readiness adjustments */
interface AdjustedExercise extends FlattenedExercise {
  readinessAdjustment?: ReadinessAdjustment;
  adjustedSets?: number;
  adjustedWeight?: number;
}

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;

  // State for program data
  const [programData, setProgramData] = useState<RugbyProgram | null>(null);
  const [isLoadingProgram, setIsLoadingProgram] = useState(true);
  
  // State for readiness score
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [showReadinessModal, setShowReadinessModal] = useState(true);
  const [tempReadinessInput, setTempReadinessInput] = useState('');
  
  // State for 1RMs
  const [oneRMMap, setOneRMMap] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<number[]>([]);
  const [restTimers, setRestTimers] = useState<{ [key: number]: number }>({});
  const [setLogs, setSetLogs] = useState<{ [key: number]: { weight: string; reps: string }[] }>({});
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  
  // State for exercise history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyExerciseName, setHistoryExerciseName] = useState('');
  
  // State for Rule of 3 progression suggestions
  const [progressionSuggestions, setProgressionSuggestions] = useState<Record<string, ProgressionSuggestion>>({});
  
  // State for scroll-aware bottom action bar
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const bottomBarOpacity = useRef(new Animated.Value(1)).current;
  const bottomBarTranslateY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // State for compact header
  const [headerExpanded, setHeaderExpanded] = useState(false);
  
  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Load selected program from storage
  useEffect(() => {
    const loadProgram = async () => {
      try {
        const storedProgramId = await AsyncStorage.getItem(STORAGE_KEY_PROGRAM);
        const programId = storedProgramId && PROGRAMS[storedProgramId] ? storedProgramId : 'rugby';
        setProgramData(PROGRAMS[programId]);
      } catch (error) {
        console.error('Error loading program:', error);
        setProgramData(PROGRAMS['rugby']); // Fallback
      } finally {
        setIsLoadingProgram(false);
      }
    };
    loadProgram();
  }, []);

  // Parse session ID and find the correct day
  const session = React.useMemo((): SessionData | null => {
    // Check if this is a recovery workout session (doesn't need programData)
    if (sessionId.startsWith('recovery:')) {
      const parts = sessionId.split(':');
      if (parts.length >= 2) {
        const recoveryWorkoutId = parts[1];
        const recoveryWorkout = recoveryWorkoutsData.recoveryWorkouts.find(w => w.id === recoveryWorkoutId);
        
        if (recoveryWorkout) {
          // Convert recovery workout to session format
          const allExercises = flattenExercises(recoveryWorkout.blocks);
          return {
            mesoId: 'recovery',
            weekIndex: 0,
            dayNumber: 0,
            title: recoveryWorkout.title,
            durationMinutes: recoveryWorkout.durationMinutes,
            blocks: recoveryWorkout.blocks,
            allExercises,
            renderableItems: createRenderableItems(recoveryWorkout.blocks, allExercises),
          };
        }
      }
      console.error('Recovery workout not found:', sessionId);
      return null;
    }
    
    // Regular program session - needs programData
    if (!programData) return null;
    
    const parsed = parseSessionId(sessionId);
    if (!parsed) {
      console.error('Failed to parse session ID:', sessionId);
      return null;
    }

    const { mesoId, weekIndex, dayNumber } = parsed;

    // Find the mesocycle
    const meso = programData.macrocycle.mesocycles.find(m => m.id === mesoId);
    if (!meso) {
      console.error('Mesocycle not found:', mesoId, 'Available:', programData.macrocycle.mesocycles.map(m => m.id));
      return null;
    }

    // Validate weeks array exists
    if (!meso.weeks || !Array.isArray(meso.weeks)) {
      console.error('Mesocycle missing weeks array:', mesoId);
      return null;
    }

    // Find the day in the microcycle
    const day = meso.microcycle.find(d => d.day === dayNumber);
    if (!day) {
      console.error('Day not found:', dayNumber, 'in mesocycle:', mesoId);
      return null;
    }

    // Apply weekly adjustments if applicable
    const weekKey = `week${meso.weeks[weekIndex] ?? weekIndex + 1}`;
    const adjustments = meso.weeklyAdjustments?.[weekKey];
    
    // Deep clone and apply adjustments
    let adjustedBlocks = JSON.parse(JSON.stringify(day.blocks)) as Block[];
    
    if (adjustments) {
      const dayKey = `day${dayNumber}`;
      const dayAdj = adjustments[dayKey];
      
      if (dayAdj && typeof dayAdj === 'object') {
        // Apply exercise adjustments
        if ('exercises' in dayAdj && dayAdj.exercises) {
          const exerciseAdjs = dayAdj.exercises as Record<string, any>;
          adjustedBlocks = adjustedBlocks.map(block => ({
            ...block,
            exercises: block.exercises.map(ex => {
              const adj = exerciseAdjs[ex.name];
              if (adj) {
                return { ...ex, ...adj };
              }
              return ex;
            }),
          }));
        }
        
        // Apply block adjustments
        if ('blocks' in dayAdj && dayAdj.blocks) {
          const blockAdjs = dayAdj.blocks as Record<string, any>;
          adjustedBlocks = adjustedBlocks.map(block => {
            const adj = blockAdjs[block.name];
            if (adj) {
              return { ...block, ...adj };
            }
            return block;
          });
        }
      }
    }

    return {
      mesoId,
      weekIndex,
      dayNumber,
      title: day.title,
      durationMinutes: day.durationMinutes,
      blocks: adjustedBlocks,
      allExercises: flattenExercises(adjustedBlocks),
      renderableItems: createRenderableItems(adjustedBlocks),
    };
  }, [sessionId, programData]);

  // Load completed sets and logs
  useEffect(() => {
    const loadCompleted = async () => {
      try {
        const stored = await AsyncStorage.getItem(`completed:${sessionId}`);
        if (stored) setCompleted(JSON.parse(stored));

        const logs = await AsyncStorage.getItem(`setLogs:${sessionId}`);
        if (logs) setSetLogs(JSON.parse(logs));

        // Load readiness score if saved
        const readinessKey = `readiness:${sessionId}`;
        const storedReadiness = await AsyncStorage.getItem(readinessKey);
        if (storedReadiness) {
          const parsed = JSON.parse(storedReadiness);
          if (parsed.score) {
            setReadinessScore(parsed.score);
            setShowReadinessModal(false); // Don't show modal if already set
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadCompleted();
  }, [sessionId]);

  // Save progress function
  const saveProgress = useCallback(async (silent = false) => {
    try {
      // Save completed exercises
      await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completed));
      
      // Save set logs
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(setLogs));
      
      // Save readiness score
      if (readinessScore !== null) {
        const readinessKey = `readiness:${sessionId}`;
        await AsyncStorage.setItem(readinessKey, JSON.stringify({
          score: readinessScore,
          timestamp: new Date().toISOString(),
        }));
      }

      if (!silent) {
        console.log('💾 Progress saved');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }, [sessionId, completed, setLogs, readinessScore]);

  // Auto-save on app background/close
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Auto-save when app goes to background
        saveProgress(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [saveProgress]);

  // Track if we're intentionally navigating away (e.g., finishing session)
  const isNavigatingAway = useRef(false);

  // Check if there's unsaved progress
  const hasUnsavedProgress = completed.length > 0 || Object.keys(setLogs).length > 0;

  // Reset navigation flag when screen loses focus (after navigation completes)
  useFocusEffect(
    useCallback(() => {
      // Reset flag when screen gains focus (user navigated back or screen mounted)
      isNavigatingAway.current = false;
      
      return () => {
        // Reset flag when screen loses focus (navigation completed)
        isNavigatingAway.current = false;
      };
    }, [])
  );

  // Use usePreventRemove hook (recommended for native-stack)
  usePreventRemove(
    hasUnsavedProgress,
    ({ data }) => {
      // If we're intentionally navigating away, don't prevent
      if (isNavigatingAway.current) {
        return;
      }

      // Prompt user to save
      Alert.alert(
        'Save Progress?',
        'You have unsaved progress. Would you like to save before leaving?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // Set flag and allow navigation
              isNavigatingAway.current = true;
              // Re-dispatch the action to allow navigation
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              await saveProgress();
              // Set flag and allow navigation
              isNavigatingAway.current = true;
              // Re-dispatch the action to allow navigation
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            // Navigation is already prevented, just close alert
          },
        ],
        { cancelable: false }
      );
    }
  );

  // Preload existing 1RMs for this session's exercises
  // Checks both storage formats for compatibility
  useEffect(() => {
    const loadExisting1RMs = async () => {
      try {
        const map: Record<string, number> = {};
        const names = session?.allExercises.map(e => e.name) ?? [];

        for (const name of names) {
          let value: number | null = null;
          
          // Try new format first: "1RM:ExerciseName" → {value: number, date: string}
          const newFormatRaw = await AsyncStorage.getItem(`1RM:${name}`);
          if (newFormatRaw) {
            try {
              const parsed = JSON.parse(newFormatRaw);
              if (typeof parsed?.value === 'number') {
                value = parsed.value;
              }
            } catch {
              // Not JSON, might be a plain number string
              const num = parseFloat(newFormatRaw);
              if (!isNaN(num)) value = num;
            }
          }
          
          // If not found, try old format: "ExerciseName-1RM" → "number"
          if (value === null) {
            const oldFormatRaw = await AsyncStorage.getItem(`${name}-1RM`);
            if (oldFormatRaw) {
              const num = parseFloat(oldFormatRaw);
              if (!isNaN(num)) {
                value = num;
                // Migrate to new format for future consistency
                await AsyncStorage.setItem(
                  `1RM:${name}`,
                  JSON.stringify({ value: num, date: new Date().toISOString(), migrated: true })
                );
                console.log(`📦 Migrated 1RM for ${name} to new format`);
              }
            }
          }
          
          if (value !== null) {
            map[name] = value;
          }
        }

        setOneRMMap(map);
        console.log('📊 Loaded 1RMs:', Object.keys(map).length, 'exercises');
      } catch (error) {
        console.error('Error loading 1RMs:', error);
      }
    };

    if (session) {
      loadExisting1RMs();
    }
  }, [sessionId, session]);

  // Debug logs
  useEffect(() => {
    console.log('✅ Session ID:', sessionId);
    console.log('✅ Parsed session:', session);
  }, [sessionId, session]);

  // Handle readiness score submission
  const handleReadinessSubmit = async (): Promise<void> => {
    const score = parseInt(tempReadinessInput, 10);
    if (!isNaN(score) && score >= 1 && score <= 10) {
      setReadinessScore(score);
      setShowReadinessModal(false);
      console.log('📊 Readiness score set:', score, getReadinessLabel(score));
      
      // Save readiness score immediately
      try {
        const readinessKey = `readiness:${sessionId}`;
        await AsyncStorage.setItem(readinessKey, JSON.stringify({
          score,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('Error saving readiness score:', error);
      }
    }
  };

  // Handle changing readiness score (tap badge)
  const handleChangeReadiness = (): void => {
    setTempReadinessInput(readinessScore?.toString() || '');
    setShowReadinessModal(true);
  };

  // Skip readiness check (use default moderate)
  const handleSkipReadiness = (): void => {
    setReadinessScore(5); // Default to moderate
    setShowReadinessModal(false);
    console.log('📊 Readiness skipped, defaulting to 5');
  };

  const toggleComplete = async (index: number) => {
    const updated = completed.includes(index)
      ? completed.filter((i) => i !== index)
      : [...completed, index];

    setCompleted(updated);
    await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(updated));
  };

  const startRest = (index: number, duration: number | undefined) => {
    const initial = duration && Number.isFinite(duration) ? duration : 60;

    const existing = intervalsRef.current.get(index);
    if (existing) {
      clearInterval(existing);
      intervalsRef.current.delete(index);
    }

    setRestTimers((prev) => ({ ...prev, [index]: initial }));

    const id = setInterval(() => {
      setRestTimers((prev) => {
        const current = prev[index];
        if (current === undefined) return prev;
        if (current <= 1) {
          const timerId = intervalsRef.current.get(index);
          if (timerId) clearInterval(timerId);
          intervalsRef.current.delete(index);
          const { [index]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [index]: current - 1 };
      });
    }, 1000);

    intervalsRef.current.set(index, id);
  };

  const updateSetLog = async (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string
  ) => {
    const existingLogs = setLogs[exerciseIndex] || [];
    const updatedLogs = [...existingLogs];
    updatedLogs[setIndex] = { ...updatedLogs[setIndex], [field]: value };

    const next = { ...setLogs, [exerciseIndex]: updatedLogs };
    setSetLogs(next);
    // Auto-save set logs immediately
    await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(next));
  };

  const markSessionComplete = async () => {
    try {
      if (!sessionId) {
        console.error('❌ Cannot finish session: sessionId is undefined');
        return;
      }

      // Mark that we're intentionally navigating away
      isNavigatingAway.current = true;

      // Add to global completedSessions for calendar highlighting
      const existing = await AsyncStorage.getItem('completedSessions');
      const parsed = existing ? JSON.parse(existing) : [];

      const updated = [...parsed, { id: sessionId, date: new Date().toISOString() }];
      await AsyncStorage.setItem('completedSessions', JSON.stringify(updated));

      // Clear per-session completion markers
      await AsyncStorage.removeItem(`completed:${sessionId}`);

      // Clean up timers
      intervalsRef.current.forEach((id) => clearInterval(id));
      intervalsRef.current.clear();
      setRestTimers({});

      // Clean up scroll timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      navigation.navigate('SessionSummary', { sessionId, completed });
    } catch (error) {
      console.error('Error finishing session:', error);
    }
  };

  // Show loading while program data is being fetched
  if (isLoadingProgram) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Session not found</Text>
        <Text style={styles.detail}>Session ID: {sessionId}</Text>
      </SafeAreaView>
    );
  }

  const progress =
    session.allExercises.length ? completed.length / session.allExercises.length : 0;

  // Helper: get training max (90% of 1RM)
  const getTrainingMax = (exerciseName: string): number | null => {
    const oneRM = oneRMMap[exerciseName];
    return oneRM ? Math.round(oneRM * 0.9) : null;
  };

  // Helper: calculate base weight from intensity or 1RM (without readiness adjustment)
  const getBaseWeight = (exercise: FlattenedExercise): number | null => {
    const oneRM = oneRMMap[exercise.name];
    if (!oneRM) return null;

    // Try to parse intensity percentage from the exercise
    const intensityPercent = parseIntensityPercent(exercise.intensity);
    if (intensityPercent) {
      return Math.round(oneRM * intensityPercent);
    }

    // Fallback to rep-based percentage
    const numericReps = parseNumericReps(exercise.reps);
    if (numericReps) {
      const percent = numericReps <= 3 ? 0.9 : numericReps <= 5 ? 0.85 : numericReps <= 8 ? 0.75 : 0.7;
      return Math.round(oneRM * percent);
    }

    return null;
  };

  // Helper: get readiness-adjusted exercise data
  const getAdjustedExerciseData = (exercise: FlattenedExercise): AdjustedExercise => {
    const baseWeight = getBaseWeight(exercise);
    const baseSets = exercise.sets ?? 0;
    
    // Only apply readiness adjustments if we have a score and a base weight
    if (readinessScore && baseWeight && isTrackableFor1RM(exercise)) {
      const adjustment = adjustWorkoutForReadiness(readinessScore, baseSets, baseWeight);
      return {
        ...exercise,
        readinessAdjustment: adjustment,
        adjustedSets: adjustment.adjustedSets,
        adjustedWeight: adjustment.adjustedWeight,
      };
    }
    
    return { ...exercise };
  };

  /** Detailed suggestion info for display */
  interface SuggestedLoadInfo {
    suggestedWeight: number;
    sets: number;
    reps: number | string;
    trainingMax: number;
    baseline1RM: number;
    percentOf1RM: number;
    intensitySource: string; // 'program' or 'rep-based'
    readinessAdjusted: boolean;
    readinessModifier?: number;
  }

  // Helper: get detailed suggested load info
  const getSuggestedLoadInfo = (exercise: AdjustedExercise): SuggestedLoadInfo | null => {
    const oneRM = oneRMMap[exercise.name];
    if (!oneRM) return null;

    const trainingMax = Math.round(oneRM * 0.9);
    const baseSets = exercise.sets ?? 0;
    const reps = exercise.reps ?? 0;
    const numericReps = parseNumericReps(exercise.reps);

    let baseWeight: number;
    let percentOf1RM: number;
    let intensitySource: string;

    // Try to parse intensity percentage from the exercise
    const intensityPercent = parseIntensityPercent(exercise.intensity);
    if (intensityPercent) {
      baseWeight = Math.round(oneRM * intensityPercent);
      percentOf1RM = intensityPercent;
      intensitySource = 'program';
    } else if (numericReps) {
      // Fallback to rep-based percentage
      percentOf1RM = numericReps <= 3 ? 0.9 : numericReps <= 5 ? 0.85 : numericReps <= 8 ? 0.75 : 0.7;
      baseWeight = Math.round(oneRM * percentOf1RM);
      intensitySource = 'rep-based';
    } else {
      return null;
    }

    // Apply readiness adjustment if present
    let finalWeight = baseWeight;
    let finalSets = baseSets;
    let readinessAdjusted = false;
    let readinessModifier: number | undefined;

    if (exercise.readinessAdjustment && exercise.adjustedWeight) {
      finalWeight = exercise.adjustedWeight;
      finalSets = exercise.adjustedSets ?? baseSets;
      readinessAdjusted = exercise.readinessAdjustment.readinessCategory !== 'moderate';
      readinessModifier = exercise.readinessAdjustment.weightModifier;
    }

    return {
      suggestedWeight: finalWeight,
      sets: finalSets,
      reps,
      trainingMax,
      baseline1RM: oneRM,
      percentOf1RM,
      intensitySource,
      readinessAdjusted,
      readinessModifier,
    };
  };

  // Helper: format suggested weight (simple version for backward compatibility)
  const getSuggestedWeight = (exercise: AdjustedExercise): string | null => {
    const info = getSuggestedLoadInfo(exercise);
    if (!info) return null;
    return `${info.suggestedWeight} lbs`;
  };

  // Helper: generate warm-up sets for an exercise
  const getWarmupSets = (exercise: FlattenedExercise): WarmupSet[] => {
    if (!isTrackableFor1RM(exercise)) return [];
    
    const trainingMax = getTrainingMax(exercise.name);
    if (!trainingMax) return [];
    
    const numericReps = parseNumericReps(exercise.reps);
    if (!numericReps) return [];
    
    return getWarmupSetsForTargetReps(numericReps, trainingMax);
  };

  // Helper: format reps display
  const formatRepsDisplay = (reps: number | string | undefined): string => {
    if (reps === undefined) return '—';
    return String(reps);
  };

  // Helper: check if exercise should show set logging inputs
  const shouldShowSetLogging = (exercise: FlattenedExercise): boolean => {
    return isTrackableFor1RM(exercise) || (hasSetReps(exercise) && exercise.trackingMode === 'volume');
  };

  // Helper: check if exercise should show history button
  // Hide for warm-up, cool-down, activation blocks and non-trackable exercises
  const shouldShowHistoryButton = (exercise: FlattenedExercise): boolean => {
    // Check block name for warm-up/cool-down/activation patterns
    const blockName = exercise.blockName?.toLowerCase() || '';
    const nonTrackableBlocks = ['warm-up', 'warm up', 'cool-down', 'cool down', 'cooldown', 'activation', 'recovery', 'breathing'];
    if (nonTrackableBlocks.some(pattern => blockName.includes(pattern))) {
      return false;
    }
    
    // Check if exercise has meaningful tracking (sets/reps or 1RM)
    const hasTracking = isTrackableFor1RM(exercise) || 
      (hasSetReps(exercise) && exercise.trackingMode === 'volume') ||
      (exercise.trackingMode === 'time' && (exercise.sets || 0) > 1);
    
    return hasTracking;
  };

  // Helper: check if exercise should show interval timer (cardio/conditioning with sets)
  const shouldShowIntervalTimer = (exercise: FlattenedExercise): boolean => {
    // Show for time-based or distance exercises with defined sets > 1
    if ((exercise.trackingMode === 'time' || exercise.trackingMode === 'distance') && 
        exercise.sets && exercise.sets > 1 && exercise.rest) {
      return true;
    }
    return false;
  };

  // Helper: parse duration string to seconds (e.g., "4 min" -> 240, "30s" -> 30)
  const parseDurationToSeconds = (duration: string | undefined): number => {
    if (!duration) return 60; // default 1 minute
    
    const lower = duration.toLowerCase().trim();
    
    // Handle "X min" or "X minutes"
    const minMatch = lower.match(/^(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1], 10) * 60;
    
    // Handle "Xs" or "X sec" or "X seconds"
    const secMatch = lower.match(/^(\d+)\s*s/);
    if (secMatch) return parseInt(secMatch[1], 10);
    
    // Handle "X:XX" format (MM:SS)
    const timeMatch = lower.match(/^(\d+):(\d+)$/);
    if (timeMatch) return parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    
    // Try to parse as plain number (assume seconds)
    const plainNum = parseInt(duration, 10);
    if (!isNaN(plainNum)) return plainNum;
    
    return 60; // default
  };

  // Helper: open exercise history modal
  const openHistoryModal = (exerciseName: string) => {
    setHistoryExerciseName(exerciseName);
    setShowHistoryModal(true);
  };

  // Helper: get progression type for display
  const getProgressionTypeLabel = (exercise: FlattenedExercise): { type: string; color: string } | null => {
    const progressionType = getProgressionType(exercise.trackingMode);
    switch (progressionType) {
      case 'hybrid_1rm':
        return { type: '1RM Tracked', color: '#1976d2' };
      case 'rule_of_3':
        return { type: 'Rule of 3', color: '#7b1fa2' };
      default:
        return null;
    }
  };

  // Helper: parse recovery activity from exercise notes/instruction
  const parseRecoveryActivity = (exercise: FlattenedExercise): string => {
    const textToSearch = `${exercise.notes || ''} ${exercise.instruction || ''}`.toLowerCase();
    
    // Common recovery activity patterns
    if (textToSearch.includes('jog recovery') || textToSearch.includes('jog rest')) return 'Jog';
    if (textToSearch.includes('walk recovery') || textToSearch.includes('walk rest') || textToSearch.includes('walk between')) return 'Walk';
    if (textToSearch.includes('easy spin') || textToSearch.includes('spin recovery')) return 'Easy Spin';
    if (textToSearch.includes('easy bike') || textToSearch.includes('bike recovery')) return 'Easy Bike';
    if (textToSearch.includes('easy row') || textToSearch.includes('row recovery')) return 'Easy Row';
    if (textToSearch.includes('light jog')) return 'Light Jog';
    if (textToSearch.includes('slow jog')) return 'Slow Jog';
    
    // Check for patterns like "X min jog" or "jog for X"
    if (textToSearch.includes(' jog')) return 'Jog';
    if (textToSearch.includes(' walk')) return 'Walk';
    if (textToSearch.includes(' spin')) return 'Spin';
    
    // Default to Rest
    return 'Rest';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Readiness Score Modal */}
      <Modal
        visible={showReadinessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSkipReadiness}
      >
        <View style={styles.readinessModalOverlay}>
          <View style={styles.readinessModalContent}>
            <Text style={styles.readinessModalTitle}>💪 How Are You Feeling?</Text>
            <Text style={styles.readinessModalSubtitle}>
              Rate your readiness from 1-10
            </Text>
            
            <View style={styles.readinessScaleContainer}>
              <Text style={styles.readinessScaleLabel}>1 = Very fatigued</Text>
              <Text style={styles.readinessScaleLabel}>10 = Peak energy</Text>
            </View>
            
            <TextInput
              style={styles.readinessInput}
              placeholder="Enter 1-10"
              keyboardType="numeric"
              value={tempReadinessInput}
              onChangeText={setTempReadinessInput}
              maxLength={2}
              autoFocus
            />
            
            {tempReadinessInput && parseInt(tempReadinessInput, 10) >= 1 && parseInt(tempReadinessInput, 10) <= 10 && (
              <Text style={[
                styles.readinessPreview,
                { color: getReadinessColor(parseInt(tempReadinessInput, 10)) }
              ]}>
                {getReadinessLabel(parseInt(tempReadinessInput, 10))}
              </Text>
            )}
            
            <View style={styles.readinessButtonRow}>
              <TouchableOpacity
                style={styles.readinessSkipButton}
                onPress={handleSkipReadiness}
              >
                <Text style={styles.readinessSkipButtonText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.readinessSubmitButton,
                  (!tempReadinessInput || parseInt(tempReadinessInput, 10) < 1 || parseInt(tempReadinessInput, 10) > 10) && 
                    styles.readinessSubmitButtonDisabled
                ]}
                onPress={handleReadinessSubmit}
                disabled={!tempReadinessInput || parseInt(tempReadinessInput, 10) < 1 || parseInt(tempReadinessInput, 10) > 10}
              >
                <Text style={styles.readinessSubmitButtonText}>Start Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Compact Header Section */}
      <TouchableOpacity 
        style={styles.compactHeader}
        onPress={() => setHeaderExpanded(!headerExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeaderMain}>
          <View style={styles.compactHeaderLeft}>
            <Text style={styles.compactHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
              {session.title}
            </Text>
            <Text style={styles.compactHeaderSubtitle}>
              {session.durationMinutes} min • W{session.weekIndex + 1}D{session.dayNumber}
            </Text>
          </View>
          <View style={styles.compactHeaderRight}>
            <View style={styles.compactProgressContainer}>
              <Progress.Bar
                progress={progress}
                width={60}
                height={8}
                color={THEME.primary}
                borderRadius={4}
                unfilledColor={THEME.borderLight}
                borderWidth={0}
              />
              <Text style={styles.compactProgressText}>{Math.round(progress * 100)}%</Text>
            </View>
            {readinessScore && (
              <View style={[styles.compactReadinessBadge, { backgroundColor: getReadinessColor(readinessScore) + '20' }]}>
                <Text style={[styles.compactReadinessText, { color: getReadinessColor(readinessScore) }]}>
                  {readinessScore}/10
                </Text>
              </View>
            )}
            <Text style={styles.expandIcon}>{headerExpanded ? '▼' : '▶'}</Text>
          </View>
        </View>
        
        {/* Expanded Details */}
        {headerExpanded && (
          <View style={styles.expandedHeaderContent}>
            {/* Readiness Badge - Tappable to change */}
            {readinessScore && (
              <TouchableOpacity
                style={[styles.readinessBadge, { backgroundColor: getReadinessColor(readinessScore) + '20' }]}
                onPress={handleChangeReadiness}
                activeOpacity={0.7}
              >
                <Text style={[styles.readinessBadgeText, { color: getReadinessColor(readinessScore) }]}>
                  {getReadinessLabel(readinessScore)} ({readinessScore}/10) ✏️
                </Text>
                {readinessScore >= 8 && (
                  <Text style={styles.readinessBadgeNote}>Weights increased, +1 set for compounds</Text>
                )}
                {readinessScore <= 3 && (
                  <Text style={styles.readinessBadgeNote}>Weights reduced, -1 set for recovery</Text>
                )}
              </TouchableOpacity>
            )}
            
            <View style={styles.expandedProgressContainer}>
              <Progress.Bar
                progress={progress}
                width={null}
                height={12}
                color={THEME.primary}
                borderRadius={6}
                unfilledColor={THEME.borderLight}
                borderWidth={0}
              />
              <Text style={styles.expandedProgressText}>{Math.round(progress * 100)}% Complete</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <FlatList
        data={session.renderableItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={(event) => {
          const currentScrollY = event.nativeEvent.contentOffset.y;
          const scrollDelta = currentScrollY - lastScrollY.current;
          lastScrollY.current = currentScrollY;
          scrollY.current = currentScrollY;
          
          // Clear existing timeout
          if (scrollTimeout.current) {
            clearTimeout(scrollTimeout.current);
          }
          
          // Show bar when scrolling up or at top/bottom
          if (scrollDelta < -10 || currentScrollY < 50) {
            // Scrolling up or near top - show bar
            if (!bottomBarVisible) {
              setBottomBarVisible(true);
              Animated.parallel([
                Animated.timing(bottomBarOpacity, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(bottomBarTranslateY, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            }
          } else if (scrollDelta > 10 && currentScrollY > 100) {
            // Scrolling down and past header - hide bar
            if (bottomBarVisible) {
              setBottomBarVisible(false);
              Animated.parallel([
                Animated.timing(bottomBarOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(bottomBarTranslateY, {
                  toValue: 100,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            }
          }
          
          // Auto-show bar when user stops scrolling (after 1 second)
          scrollTimeout.current = setTimeout(() => {
            if (scrollY.current > 50 && !bottomBarVisible) {
              setBottomBarVisible(true);
              Animated.parallel([
                Animated.timing(bottomBarOpacity, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(bottomBarTranslateY, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            }
          }, 1000);
        }}
        scrollEventThrottle={16}
        renderItem={({ item, index: itemIndex }) => {
          // Render grouped items (circuits/supersets/complexes)
          if (item.type === 'circuit' || item.type === 'superset' || item.type === 'complex') {
            const exercises = item.exercises || [];
            const exerciseIndices = item.exerciseIndices || [];
            const allCompleted = exerciseIndices.every(i => completed.includes(i));
            const someCompleted = exerciseIndices.some(i => completed.includes(i));
            const isCircuit = item.type === 'circuit';
            const isComplex = item.type === 'complex';
            const restDuration = item.restBetweenRounds || 60;
            // Use the first exercise index for the group timer
            const groupTimerKey = exerciseIndices[0] ?? itemIndex * 1000;
            
            // Get appropriate header style and icon
            const headerStyle = isCircuit 
              ? styles.circuitHeader 
              : isComplex 
                ? styles.complexHeader 
                : styles.supersetHeader;
            const headerIcon = isCircuit ? '🔄 ' : isComplex ? '🏋️ ' : '⚡ ';
            
            return (
              <View style={[styles.card, styles.groupedCard]}>
                {/* Group header */}
                <View style={[styles.blockHeader, headerStyle]}>
                  <Text style={styles.blockHeaderText}>
                    {headerIcon}{item.blockName}
                  </Text>
                  {isCircuit && item.rounds && (
                    <Text style={styles.roundsText}>{item.rounds} rounds</Text>
                  )}
                  {isComplex && (
                    <Text style={styles.complexText}>Perform exercises in sequence</Text>
                  )}
                </View>

                {/* Exercises in the group */}
                {exercises.map((exercise, exIdx) => {
                  const globalIndex = exerciseIndices[exIdx];
                  const isExerciseCompleted = completed.includes(globalIndex);
                  const adjustedExercise = getAdjustedExerciseData(exercise);
                  const warmupSets = getWarmupSets(exercise);
                  const numSets = adjustedExercise.adjustedSets ?? adjustedExercise.sets ?? 0;
                  const showLogging = shouldShowSetLogging(exercise);
                  const hasAdjustment = adjustedExercise.readinessAdjustment && 
                    adjustedExercise.readinessAdjustment.readinessCategory !== 'moderate';
                  
                  return (
                    <View key={`grouped-${exIdx}`} style={styles.groupedExerciseContainer}>
                      <TouchableOpacity
                        style={[
                          styles.groupedExercise,
                          isExerciseCompleted && styles.groupedExerciseCompleted,
                        ]}
                        onPress={() => toggleComplete(globalIndex)}
                      >
                        <View style={styles.groupedExerciseHeader}>
                          <Text style={styles.groupedExerciseNumber}>{exIdx + 1}</Text>
                          <View style={styles.groupedExerciseContent}>
                            <Text style={styles.exercise}>{exercise.name}</Text>
                            
                            {/* Display based on tracking mode */}
                            {isTimeBased(exercise) ? (
                              <Text style={styles.groupedExerciseDetails}>
                                {exercise.sets && exercise.sets > 1 
                                  ? `${exercise.sets} sets × ${exercise.duration}` 
                                  : `Duration: ${exercise.duration}`}
                                {exercise.rest ? ` • Rest ${exercise.rest}s` : ''}
                              </Text>
                            ) : (
                              <>
                                {hasAdjustment && adjustedExercise.adjustedSets !== exercise.sets ? (
                                  <View>
                                    <View style={styles.adjustedRow}>
                                      <Text style={styles.groupedExerciseDetails}>Sets: </Text>
                                      <Text style={styles.originalValue}>{exercise.sets}</Text>
                                      <Text style={styles.adjustedArrow}> → </Text>
                                      <Text style={[styles.adjustedValue, { color: getReadinessColor(readinessScore || 5) }]}>
                                        {adjustedExercise.adjustedSets}
                                      </Text>
                                    </View>
                                    <Text style={styles.groupedExerciseDetails}>
                                      Reps: {formatRepsDisplay(exercise.reps)}
                                      {exercise.rest && !isCircuit ? ` • Rest ${exercise.rest}s` : ''}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.groupedExerciseDetails}>
                                    {numSets} × {formatRepsDisplay(exercise.reps)}
                                    {exercise.rest && !isCircuit ? ` • Rest ${exercise.rest}s` : ''}
                                  </Text>
                                )}
                              </>
                            )}
                            
                            {exercise.intensity && <Text style={styles.groupedExerciseDetails}>Intensity: {exercise.intensity}</Text>}
                            {exercise.tempo && <Text style={styles.groupedExerciseDetails}>Tempo: {exercise.tempo}</Text>}
                            {exercise.notes && (
                              <Text style={styles.groupedExerciseNotes}>📝 {exercise.notes}</Text>
                            )}
                            {exercise.instruction && (
                              <Text style={styles.groupedExerciseInstruction}>💡 {exercise.instruction}</Text>
                            )}
                            
                            {/* Suggested weight for 1RM-tracked exercises */}
                            {isTrackableFor1RM(exercise) && (() => {
                              const loadInfo = getSuggestedLoadInfo(adjustedExercise);
                              
                              if (!loadInfo) {
                                return (
                                  <View style={styles.no1RMBoxInline}>
                                    <Text style={styles.no1RMTextSmall}>
                                      No 1RM available — please enter manually.
                                    </Text>
                                  </View>
                                );
                              }
                              
                              const percentRounded = Math.round(loadInfo.percentOf1RM * 100);
                              const estimatedRPE = percentRounded >= 90 ? 10 : percentRounded >= 85 ? 9 : percentRounded >= 80 ? 8.5 : percentRounded >= 75 ? 8 : percentRounded >= 70 ? 7.5 : 7;
                              
                              return (
                                <View style={styles.suggestionBoxInline}>
                                  <Text style={styles.suggestionTitleSmall}>
                                    Suggested {loadInfo.suggestedWeight} lbs @ RPE {estimatedRPE}, based on TM ({loadInfo.trainingMax} lbs).
                                  </Text>
                                  <Text style={styles.suggestionDetailSmall}>
                                    ~{percentRounded}% of baseline 1RM ({loadInfo.baseline1RM} lbs).
                                  </Text>
                                  {loadInfo.readinessAdjusted && (
                                    <Text style={[styles.readinessNoteSmall, { color: getReadinessColor(readinessScore || 5) }]}>
                                      ⚡ Readiness adjusted
                                    </Text>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                          <Text style={styles.groupedExerciseCheck}>
                            {isExerciseCompleted ? '✅' : '○'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      
                      {/* Warm-up sets for grouped exercises */}
                      {warmupSets.length > 0 && (
                        <View style={styles.warmupSectionInline}>
                          <Text style={styles.warmupHeaderSmall}>🔥 Warm-ups</Text>
                          {warmupSets.map((warmup, wIndex) => (
                            <Text key={`warmup-${wIndex}`} style={styles.warmupDetailSmall}>
                              {warmup.weight} lbs × {warmup.reps} ({formatPercentage(warmup.percentage)})
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {/* Working sets logging for grouped exercises */}
                      {showLogging && numSets > 0 && (
                        <View style={styles.workingSetsSectionInline}>
                          <Text style={styles.workingSetsHeaderSmall}>
                            {isTrackableFor1RM(exercise) ? '💪 Working Sets' : '📊 Log Sets'}
                          </Text>
                          {[...Array(numSets)].map((_, setIndex) => (
                            <View key={setIndex} style={styles.setRowInline}>
                              <Text style={styles.setLabelSmall}>Set {setIndex + 1}</Text>
                              <TextInput
                                style={styles.inputSmall}
                                placeholder="lbs"
                                keyboardType="numeric"
                                value={setLogs[globalIndex]?.[setIndex]?.weight || ''}
                                onChangeText={(text) => updateSetLog(globalIndex, setIndex, 'weight', text)}
                              />
                              <TextInput
                                style={styles.inputSmall}
                                placeholder="reps"
                                keyboardType="numeric"
                                value={setLogs[globalIndex]?.[setIndex]?.reps || ''}
                                onChangeText={(text) => updateSetLog(globalIndex, setIndex, 'reps', text)}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* View History button for grouped exercise - hide for warm-up/cool-down */}
                      {shouldShowHistoryButton(exercise) && (
                        <TouchableOpacity 
                          style={styles.historyButtonSmall}
                          onPress={() => openHistoryModal(exercise.name)}
                        >
                          <Text style={styles.historyButtonTextSmall}>📊 History</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* Group completion status */}
                <View style={styles.groupStatus}>
                  <Text style={styles.groupStatusText}>
                    {allCompleted 
                      ? '✅ All exercises completed' 
                      : someCompleted 
                        ? `${exerciseIndices.filter(i => completed.includes(i)).length}/${exercises.length} completed`
                        : 'Tap each exercise to mark done'}
                  </Text>
                </View>

                {/* Shared rest timer for the group */}
                {restTimers[groupTimerKey] !== undefined ? (
                  <Text style={styles.timer}>⏱ Rest: {restTimers[groupTimerKey]}s remaining</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.restButton, styles.groupRestButton]}
                    onPress={() => startRest(groupTimerKey, restDuration)}
                  >
                    <Text style={styles.restText}>
                      {isCircuit ? `Start Round Rest (${restDuration}s)` : `Start Rest (${restDuration}s)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }
          
          // Render individual exercise
          const exercise = item.exercise!;
          const exerciseIndex = item.exerciseIndex!;
          const adjustedExercise = getAdjustedExerciseData(exercise);
          const warmupSets = getWarmupSets(exercise);
          const numSets = adjustedExercise.adjustedSets ?? adjustedExercise.sets ?? 0;
          const showLogging = shouldShowSetLogging(exercise);
          const hasAdjustment = adjustedExercise.readinessAdjustment && 
            adjustedExercise.readinessAdjustment.readinessCategory !== 'moderate';
          const showBlockHeader = itemIndex === 0 || 
            session.renderableItems[itemIndex - 1].blockName !== item.blockName;
          
          return (
            <View style={styles.card}>
              {/* Block name indicator */}
              {showBlockHeader && (
                <View style={styles.blockHeader}>
                  <Text style={styles.blockHeaderText}>{exercise.blockName}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.exerciseBlock,
                  completed.includes(exerciseIndex) && styles.completedCard,
                ]}
                onPress={() => toggleComplete(exerciseIndex)}
              >
                <Text style={styles.exercise}>{exercise.name}</Text>
                
                {/* Display based on tracking mode */}
                {isTimeBased(exercise) ? (
                  <>
                    {exercise.sets && exercise.sets > 1 ? (
                      <>
                        <Text style={styles.detail}>Sets: {exercise.sets}</Text>
                        <Text style={styles.detail}>Duration: {exercise.duration} per set</Text>
                      </>
                    ) : (
                      <Text style={styles.detail}>Duration: {exercise.duration}</Text>
                    )}
                  </>
                ) : (
                  <>
                    {hasAdjustment && adjustedExercise.adjustedSets !== exercise.sets ? (
                      <View style={styles.adjustedRow}>
                        <Text style={styles.detail}>Sets: </Text>
                        <Text style={styles.originalValue}>{exercise.sets}</Text>
                        <Text style={styles.adjustedArrow}> → </Text>
                        <Text style={[styles.adjustedValue, { color: getReadinessColor(readinessScore || 5) }]}>
                          {adjustedExercise.adjustedSets}
                        </Text>
                      </View>
                    ) : (
                      exercise.sets && <Text style={styles.detail}>Sets: {numSets}</Text>
                    )}
                    {exercise.reps !== undefined && (
                      <Text style={styles.detail}>Reps: {formatRepsDisplay(exercise.reps)}</Text>
                    )}
                  </>
                )}
                
                {exercise.rest && <Text style={styles.detail}>Rest: {exercise.rest} sec</Text>}
                {exercise.intensity && <Text style={styles.detail}>Intensity: {exercise.intensity}</Text>}
                {exercise.tempo && <Text style={styles.detail}>Tempo: {exercise.tempo}</Text>}
                {exercise.notes && <Text style={styles.notes}>📝 {exercise.notes}</Text>}
                {exercise.instruction && <Text style={styles.instruction}>💡 {exercise.instruction}</Text>}

                {/* Progression type badge */}
                {(() => {
                  const progressionLabel = getProgressionTypeLabel(exercise);
                  if (progressionLabel) {
                    return (
                      <View style={[styles.progressionBadge, { backgroundColor: progressionLabel.color + '15' }]}>
                        <Text style={[styles.progressionBadgeText, { color: progressionLabel.color }]}>
                          {progressionLabel.type}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                {/* Suggested weight for 1RM-tracked exercises */}
                {isTrackableFor1RM(exercise) && (() => {
                  const loadInfo = getSuggestedLoadInfo(adjustedExercise);
                  
                  if (!loadInfo) {
                    return (
                      <View style={styles.no1RMBox}>
                        <Text style={styles.no1RMText}>
                          No 1RM available — please enter manually or use the 1RM calculator
                        </Text>
                      </View>
                    );
                  }
                  
                  // Estimate RPE based on percentage (rough guideline)
                  const percentRounded = Math.round(loadInfo.percentOf1RM * 100);
                  const estimatedRPE = percentRounded >= 90 ? 10 : percentRounded >= 85 ? 9 : percentRounded >= 80 ? 8.5 : percentRounded >= 75 ? 8 : percentRounded >= 70 ? 7.5 : 7;
                  
                  return (
                    <View style={styles.suggestionBox}>
                      <Text style={styles.suggestionTitle}>
                        Suggested {loadInfo.suggestedWeight} lbs for {loadInfo.sets}×{formatRepsDisplay(loadInfo.reps)} @ RPE {estimatedRPE}, based on training max ({loadInfo.trainingMax} lbs).
                      </Text>
                      <Text style={styles.suggestionDetail}>
                        Suggested load is ~{percentRounded}% of your baseline 1RM ({loadInfo.baseline1RM} lbs).
                      </Text>
                      {loadInfo.readinessAdjusted && loadInfo.readinessModifier && (
                        <Text style={[
                          styles.readinessAdjustmentNote,
                          { color: getReadinessColor(readinessScore || 5) }
                        ]}>
                          ⚡ {adjustedExercise.readinessAdjustment?.adjustmentReason} ({loadInfo.readinessModifier > 1 ? '+' : ''}{Math.round((loadInfo.readinessModifier - 1) * 100)}% weight)
                        </Text>
                      )}
                    </View>
                  );
                })()}

                {/* Rule of 3 tip for volume exercises */}
                {exercise.trackingMode === 'volume' && (
                  <View style={styles.ruleOf3Box}>
                    <Text style={styles.ruleOf3Text}>
                      📈 {getRuleOf3TipText()}
                    </Text>
                  </View>
                )}

                <Text style={styles.status}>
                  {completed.includes(exerciseIndex) ? '✅ Completed' : 'Tap to mark done'}
                </Text>
              </TouchableOpacity>
              
              {/* View History button - hide for warm-up/cool-down */}
              {shouldShowHistoryButton(exercise) && (
                <TouchableOpacity 
                  style={styles.historyButton}
                  onPress={() => openHistoryModal(exercise.name)}
                >
                  <Text style={styles.historyButtonText}>📊 View History →</Text>
                </TouchableOpacity>
              )}

              {/* Warm-up sets section */}
              {warmupSets.length > 0 && (
                <View style={styles.warmupSection}>
                  <Text style={styles.warmupHeader}>🔥 Warm-up Sets</Text>
                  {warmupSets.map((warmup, wIndex) => (
                    <View key={`warmup-${wIndex}`} style={styles.warmupRow}>
                      <Text style={styles.warmupLabel}>Warm-up {wIndex + 1}</Text>
                      <Text style={styles.warmupDetail}>
                        {warmup.weight} lbs × {warmup.reps} reps
                      </Text>
                      <Text style={styles.warmupPercent}>
                        ({formatPercentage(warmup.percentage)})
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.warmupNote}>ℹ️ Warm-up sets are not logged</Text>
                </View>
              )}

              {/* Working sets section */}
              {showLogging && numSets > 0 && (
                <View style={styles.workingSetsSection}>
                  <Text style={styles.workingSetsHeader}>
                    {isTrackableFor1RM(exercise) ? '💪 Working Sets' : '📊 Log Sets'}
                  </Text>
                  {[...Array(numSets)].map((_, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Weight (lbs)"
                        keyboardType="numeric"
                        value={setLogs[exerciseIndex]?.[setIndex]?.weight || ''}
                        onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'weight', text)}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Reps"
                        keyboardType="numeric"
                        value={setLogs[exerciseIndex]?.[setIndex]?.reps || ''}
                        onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'reps', text)}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Interval Timer for cardio/conditioning exercises */}
              {shouldShowIntervalTimer(exercise) && (
                <IntervalTimer
                  totalSets={exercise.sets || 1}
                  workDuration={parseDurationToSeconds(exercise.duration)}
                  restDuration={exercise.rest || 60}
                  exerciseName={exercise.name}
                  instruction={exercise.instruction}
                  restLabel={parseRecoveryActivity(exercise)}
                  onComplete={() => toggleComplete(exerciseIndex)}
                  onSetComplete={(setNum) => console.log(`${exercise.name}: Set ${setNum} complete`)}
                />
              )}

              {/* Regular rest timer (hidden when interval timer is shown) */}
              {!shouldShowIntervalTimer(exercise) && (
                restTimers[exerciseIndex] !== undefined ? (
                  <Text style={styles.timer}>⏱ Rest: {restTimers[exerciseIndex]}s remaining</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.restButton}
                    onPress={() => startRest(exerciseIndex, exercise.rest)}
                  >
                    <Text style={styles.restText}>Start Rest</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      {/* Scroll-Aware Bottom Action Bar */}
      <Animated.View
        style={[
          styles.bottomActionBar,
          {
            opacity: bottomBarOpacity,
            transform: [{ translateY: bottomBarTranslateY }],
          },
        ]}
      >
        <View style={styles.bottomActionBarShadow} />
        <View style={styles.bottomActionBarContent}>
          <TouchableOpacity
            style={styles.oneRMButton}
            onPress={() =>
              navigation.navigate('My1RMs' as any, {
                onUpdate1RM: (exerciseName: string, newValue: number) => {
                  setOneRMMap((prev) => ({ ...prev, [exerciseName]: newValue }));
                },
              })
            }
          >
            <Text style={styles.oneRMText}>💪 Open 1RM Calculator</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.finishButton} onPress={markSessionComplete}>
            <Text style={styles.finishText}>🏁 Finish Session</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Exercise History Modal */}
      <ExerciseHistoryModal
        visible={showHistoryModal}
        exerciseName={historyExerciseName}
        onClose={() => setShowHistoryModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: THEME.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textMuted,
  },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: THEME.primary },
  subheader: { fontSize: 14, color: THEME.textSecondary, marginBottom: 16 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card },
  
  // Readiness Modal Styles
  readinessModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  readinessModalContent: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  readinessModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: THEME.primary,
  },
  readinessModalSubtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginBottom: 16,
  },
  readinessScaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  readinessScaleLabel: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  readinessInput: {
    borderWidth: 2,
    borderColor: THEME.primary,
    borderRadius: 12,
    padding: 16,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    width: 120,
    marginBottom: 12,
    color: THEME.textPrimary,
    backgroundColor: THEME.card,
  },
  readinessPreview: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  readinessButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  readinessSkipButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: THEME.backgroundDark,
    borderRadius: 10,
    alignItems: 'center',
  },
  readinessSkipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  readinessSubmitButton: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  readinessSubmitButtonDisabled: {
    backgroundColor: THEME.backgroundDark,
  },
  readinessSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
  
  // Readiness Badge
  readinessBadge: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  readinessBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  readinessBadgeNote: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
  },
  
  // Adjusted values display
  adjustedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  originalValue: {
    color: THEME.textMuted,
    textDecorationLine: 'line-through',
  },
  adjustedArrow: {
    color: THEME.textSecondary,
    marginHorizontal: 4,
  },
  adjustedValue: {
    fontWeight: '600',
  },
  readinessAdjustmentNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // Suggestion box styles
  suggestionBox: {
    backgroundColor: THEME.primaryFaded,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 4,
  },
  suggestionDetail: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  no1RMBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.warning,
  },
  no1RMText: {
    fontSize: 13,
    color: '#856404',
    fontStyle: 'italic',
  },
  
  // Block header styles
  blockHeader: {
    backgroundColor: THEME.secondaryFaded,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  blockHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  exerciseBlock: {},
  completedCard: {
    backgroundColor: THEME.primaryFaded,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  detail: { marginTop: 2, color: THEME.textPrimary },
  notes: { marginTop: 4, color: THEME.textMuted, fontStyle: 'italic', fontSize: 13 },
  instruction: { marginTop: 6, color: THEME.secondary, fontSize: 12, lineHeight: 16 },
  suggested: { marginTop: 4, color: THEME.primary, fontWeight: '500' },
  exercise: { fontSize: 16, fontWeight: '600', color: THEME.textPrimary },
  status: { marginTop: 6, color: THEME.textSecondary },
  
  // Warm-up sets styles (non-loggable)
  warmupSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  warmupHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.warning,
    marginBottom: 8,
  },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff9e6',
    borderRadius: 6,
    marginBottom: 4,
  },
  warmupLabel: {
    width: 80,
    fontSize: 13,
    fontWeight: '500',
    color: '#b8860b',
  },
  warmupDetail: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
  },
  warmupPercent: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  warmupNote: {
    marginTop: 6,
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
  },
  
  // Working sets styles (loggable)
  workingSetsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  workingSetsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  setLabel: { width: 64, fontWeight: '500', color: THEME.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 6,
    padding: 8,
    flex: 1,
    backgroundColor: THEME.card,
    color: THEME.textPrimary,
  },
  timer: { marginTop: 8, color: THEME.textPrimary },
  restButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.secondary,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  restText: { color: THEME.textOnSecondary, fontWeight: '600' },
  
  // Grouped card styles (circuits/supersets)
  groupedCard: {
    borderWidth: 2,
    padding: 0,
    overflow: 'hidden',
  },
  circuitHeader: {
    backgroundColor: THEME.primaryFaded,
    borderBottomWidth: 1,
    borderBottomColor: THEME.primaryLight,
    paddingVertical: 12,
  },
  supersetHeader: {
    backgroundColor: THEME.secondaryFaded,
    borderBottomWidth: 1,
    borderBottomColor: THEME.secondaryLight,
    paddingVertical: 12,
  },
  complexHeader: {
    backgroundColor: '#fff3e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
    paddingVertical: 12,
  },
  roundsText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  complexText: {
    fontSize: 11,
    color: THEME.warning,
    fontStyle: 'italic',
    marginTop: 2,
  },
  groupedExercise: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
    backgroundColor: THEME.card,
  },
  groupedExerciseCompleted: {
    backgroundColor: THEME.primaryFaded,
  },
  groupedExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupedExerciseNumber: {
    width: 24,
    height: 24,
    backgroundColor: THEME.secondary,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textOnSecondary,
    marginRight: 10,
  },
  groupedExerciseContent: {
    flex: 1,
  },
  groupedExerciseDetails: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  groupedExerciseNotes: {
    fontSize: 12,
    color: THEME.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  groupedExerciseInstruction: {
    fontSize: 11,
    color: THEME.secondary,
    marginTop: 4,
    lineHeight: 14,
  },
  groupedExerciseCheck: {
    fontSize: 20,
    marginLeft: 8,
  },
  groupStatus: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: THEME.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  groupStatusText: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  groupRestButton: {
    margin: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  groupedExerciseContainer: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  
  // Inline styles for grouped exercise features
  no1RMBoxInline: {
    backgroundColor: '#fff3e0',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  no1RMTextSmall: {
    fontSize: 11,
    color: THEME.warning,
  },
  suggestionBoxInline: {
    backgroundColor: THEME.primaryFaded,
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  suggestionTitleSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
  },
  suggestionDetailSmall: {
    fontSize: 11,
    color: THEME.primaryDark,
    fontStyle: 'italic',
    marginTop: 1,
  },
  readinessNoteSmall: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  warmupSectionInline: {
    backgroundColor: '#fff9e6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 34,
  },
  warmupHeaderSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.warning,
    marginBottom: 2,
  },
  warmupDetailSmall: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  workingSetsSectionInline: {
    backgroundColor: THEME.backgroundLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 34,
  },
  workingSetsHeaderSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 4,
  },
  setRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  setLabelSmall: {
    width: 45,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 4,
    padding: 6,
    flex: 1,
    fontSize: 12,
    backgroundColor: THEME.card,
    color: THEME.textPrimary,
  },
  
  // Compact Header Styles
  compactHeader: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  compactHeaderMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  compactHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  compactHeaderSubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  compactHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactProgressContainer: {
    alignItems: 'center',
    gap: 4,
  },
  compactProgressText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  compactReadinessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactReadinessText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandIcon: {
    fontSize: 12,
    color: THEME.textMuted,
    marginLeft: 4,
  },
  expandedHeaderContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  expandedProgressContainer: {
    marginTop: 12,
  },
  expandedProgressText: {
    marginTop: 6,
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  
  // Bottom Action Bar Styles
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.background,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    zIndex: 1000,
  },
  bottomActionBarShadow: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'transparent',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomActionBarContent: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },
  oneRMButton: {
    paddingVertical: 14,
    backgroundColor: THEME.secondary,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  oneRMText: { 
    color: THEME.textOnSecondary, 
    fontWeight: '700',
    fontSize: 16,
  },
  finishButton: {
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  finishText: { 
    color: THEME.textOnPrimary, 
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Progression badge styles
  progressionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 6,
  },
  progressionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Rule of 3 tip box
  ruleOf3Box: {
    backgroundColor: THEME.secondaryFaded,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.secondary,
  },
  ruleOf3Text: {
    fontSize: 12,
    color: THEME.secondary,
    lineHeight: 16,
  },
  
  // History button styles
  historyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  historyButtonText: {
    fontSize: 13,
    color: THEME.secondary,
    fontWeight: '500',
  },
  historyButtonSmall: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 12,
  },
  historyButtonTextSmall: {
    fontSize: 11,
    color: THEME.secondary,
    fontWeight: '500',
  },
});
