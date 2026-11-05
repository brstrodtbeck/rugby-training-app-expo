import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  LayoutAnimation,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect } from '@react-navigation/native';
import IntervalTimer from '../components/IntervalTimer';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import SixPackShuffleModal from '../components/SixPackShuffleModal';
import { THEME } from '../theme/colors';
import { triggerHaptic } from '../utils/haptics';
import {
  loadSoundSettings,
  playTimerStart,
  playTimerStop,
  playTimerPause,
  playTimerComplete,
  playRestComplete,
  playCountdownBeep,
} from '../utils/sounds';
import {
  loadVoiceSettings,
  speakRestComplete,
  stopSpeaking,
} from '../utils/voice';
import { analytics } from '../utils/analytics';
import { getTickIntervalMs, getTickDecrement } from '../utils/e2eFastTimers';
import Toast from 'react-native-toast-message';
import { validateWeightInput, validateRepsInput, validateReadinessInput } from '../utils/inputValidation';
import {
  getProgressionType,
  applyRuleOf3Progression,
  inferExerciseCategory,
  getRuleOf3TipText,
  getProgressionIndicatorColor,
  ProgressionSuggestion,
  ChallengeOption,
  getLastWeightFromHistory,
  getProgressionState,
  saveProgressionState,
  ProgressionState,
  saveExerciseLog,
  ExerciseLog,
  checkQualityGate,
} from '../utils/progressionLogic';
import {
  SetLogEntry,
  SetLogsMap,
  aggregateSessionRpe,
  parseOptionalRpe,
} from '../types/setLog';
import { getRepBasedPercent, compute1RMUpdateFromCompletedSets } from '../utils/1rm';
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
  isBodyweightExercise,
  expandFlowExercisesInBlocks,
} from '../types/program';
import { saveExercise1RM, append1RMHistory, getExercise1RM } from '../storage/logs';
import { useSessionData, SessionData } from '../hooks/useSessionData';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

/** Extended exercise with readiness adjustments */
interface AdjustedExercise extends FlattenedExercise {
  readinessAdjustment?: ReadinessAdjustment;
  adjustedSets?: number;
  adjustedWeight?: number;
}

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;

  // Scroll configuration constants
  const SCROLL_CONFIG = {
    // Standard delay for scroll operations to allow state updates and re-renders
    DELAY_MS: 300,
    // View position for scrollToIndex (0.18 = 18% from top, accounts for sticky flow indicator only)
    // Only flow indicator is sticky (~50px when collapsed, ~200px when expanded)
    // Compact header is in ListHeaderComponent and scrolls with content
    VIEW_POSITION: 0.18,
    // Approximate item heights for fallback offset calculations (rough estimates)
    APPROX_ITEM_HEIGHT: 200, // Average height per FlatList item
    APPROX_CIRCUIT_ITEM_HEIGHT: 250, // Height per circuit/superset/complex item
    APPROX_EXERCISE_IN_CIRCUIT_HEIGHT: 180, // Height per exercise within a circuit
  };

  // Add Block view and Help buttons to header
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SessionBlockView', { sessionId })}
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, color: THEME.primary, fontWeight: '600' }}>Block view</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Help')}
            style={{ marginRight: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>❓</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, sessionId]);

  // State for program data
  const { session, programId, programData, isLoadingProgram } = useSessionData(sessionId);
  
  // State for readiness score
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [showReadinessModal, setShowReadinessModal] = useState(true);
  const [tempReadinessInput, setTempReadinessInput] = useState('');
  
  // State for 1RMs
  const [oneRMMap, setOneRMMap] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<number[]>([]);
  const [restTimers, setRestTimers] = useState<{ [key: number]: { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean } }>({});
  // Track completed rounds per group (key: groupTimerKey, value: Set of completed round indices)
  const [completedRounds, setCompletedRounds] = useState<{ [key: number]: Set<number> }>({});
  const [setLogs, setSetLogs] = useState<SetLogsMap>({});
  const [setCompletions, setSetCompletions] = useState<{ [key: number]: Set<number> }>({}); // Track individual set completions: exerciseIndex -> Set<setIndex>
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  /** End timestamps (ms) for rest timers - used to recalc remaining when app returns from background */
  const restEndTimeRef = useRef<Map<number, number>>(new Map());
  /** End timestamps (ms) for time-based timers - used to recalc remaining when app returns from background */
  const timeBasedEndTimeRef = useRef<Map<number, number>>(new Map());
  const restTimersStateRef = useRef<Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean }>>({});
  const timeBasedTimersStateRef = useRef<Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean; countdownShown?: boolean; beepedAt?: number[] }>>({});

  // Track if initial data load has completed to avoid saving during load
  const isInitialLoad = useRef(true);
  // Bumped on user edits so a late storage reload cannot overwrite in-progress input
  const editGenRef = useRef(0);
  // False until the first storage read finishes, so leaving early cannot wipe saved work
  const persistReadyRef = useRef(false);
  // Track if we're intentionally navigating away (e.g., finishing session)
  const isNavigatingAway = useRef(false);
  
  // State for exercise history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyExerciseName, setHistoryExerciseName] = useState('');
  
  // State for explanation modals
  const [showRuleOf3Modal, setShowRuleOf3Modal] = useState(false);
  const [show1RMModal, setShow1RMModal] = useState(false);
  const [showSixPackModal, setShowSixPackModal] = useState(false);
  
  // State for Rule of 3 progression suggestions
  const [progressionSuggestions, setProgressionSuggestions] = useState<Record<string, ProgressionSuggestion>>({});
  
  // State for scroll-aware bottom action bar
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const bottomBarOpacity = useRef(new Animated.Value(1)).current;
  const bottomBarTranslateY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const bannerDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bannerDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for compact header
  const [headerExpanded, setHeaderExpanded] = useState(false);
  
  // Global state for all exercise details visibility (false = hide all by default for progressive disclosure)
  const [allDetailsVisible, setAllDetailsVisible] = useState(false);
  
  // State for section navigation and flow guidance
  const [currentSection, setCurrentSection] = useState<string>('');
  const [sectionTransitionBanner, setSectionTransitionBanner] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [nextExercisePreview, setNextExercisePreview] = useState<{ name: string; blockName: string } | null>(null);
  const [sectionCompletions, setSectionCompletions] = useState<Record<string, boolean>>({});
  const [focusedInputRef, setFocusedInputRef] = useState<{ exerciseIndex: number; setIndex: number; field: 'weight' | 'reps' | 'rpe' | 'rir' } | null>(null);
  const [showSetCompletePrompt, setShowSetCompletePrompt] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [stickyTimerVisible, setStickyTimerVisible] = useState(false);
  const [activeTimerInfo, setActiveTimerInfo] = useState<{ type: 'rest' | 'interval' | 'time'; exerciseIndex: number; remaining: number; isPaused: boolean } | null>(null);
  const [contextualTip, setContextualTip] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  
  // State for clutter reduction and UX enhancements
  const [flowIndicatorExpanded, setFlowIndicatorExpanded] = useState(false);
  const [showCompletedSets, setShowCompletedSets] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<number, boolean>>({}); // Track which completed exercises are expanded
  const [exerciseDetailsExpanded, setExerciseDetailsExpanded] = useState<Record<number, boolean>>({});
  const [formCuesExpanded, setFormCuesExpanded] = useState<Record<number, boolean>>({}); // Separate state for form cues
  const [setNotes, setSetNotes] = useState<Record<string, string>>({}); // key: `${exerciseIndex}-${setIndex}`
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null); // exerciseIndex for which menu is open
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({}); // key: `${exerciseIndex}-${setIndex}` - tracks which sets are expanded for editing
  const [expandedTimers, setExpandedTimers] = useState<Record<number, boolean>>({}); // key: timerKey - tracks which timers are expanded
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set()); // Track which blocks are expanded
  
  // Timer state for time-based exercises (warm-up/cool-down)
  const [timeBasedTimers, setTimeBasedTimers] = useState<{ [key: number]: { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean; countdownShown?: boolean; beepedAt?: number[] } }>({});
  
  restTimersStateRef.current = restTimers;
  timeBasedTimersStateRef.current = timeBasedTimers;

  // Toggle all exercise details visibility (global toggle)
  const toggleAllExerciseDetails = () => {
    setAllDetailsVisible(prev => !prev);
  };
  
  // Toggle individual exercise details
  const toggleExerciseDetails = (exerciseIndex: number) => {
    setExerciseDetailsExpanded(prev => ({
      ...prev,
      [exerciseIndex]: !prev[exerciseIndex],
    }));
  };

  // Check if exercise has any expandable content
  const hasExpandableContent = (exercise: FlattenedExercise): boolean => {
    return !!(exercise.instruction || exercise.notes || exercise.definition || isTrackableFor1RM(exercise));
  };

  // Check if any details are expanded (form cues OR exercise details)
  const isAnyDetailsExpanded = (exerciseIndex: number): boolean => {
    return formCuesExpanded[exerciseIndex] || exerciseDetailsExpanded[exerciseIndex] || allDetailsVisible;
  };

  // Toggle all exercise details (form cues + exercise details) together with smooth animation
  // Toggles details for all exercises in the same block
  const toggleExerciseDetailsAll = (exerciseIndex: number) => {
    if (!session) return;
    
    // Get the exercise to find its blockName
    const exercise = session.allExercises[exerciseIndex];
    if (!exercise?.blockName) return;
    
    // Get all exercises in the same block
    const exercisesInBlock = getExercisesInBlock(exercise.blockName);
    
    // Collect all exercise indices from the block
    const allExerciseIndices: number[] = [];
    exercisesInBlock.forEach(item => {
      if (item.exerciseIndex !== undefined) {
        allExerciseIndices.push(item.exerciseIndex);
      } else if (item.exerciseIndices && item.exerciseIndices.length > 0) {
        allExerciseIndices.push(...item.exerciseIndices);
      }
    });
    
    // Determine if we should expand or collapse based on current state
    // If the clicked exercise is expanded, we collapse all; otherwise expand all
    const isCurrentlyExpanded = formCuesExpanded[exerciseIndex] || exerciseDetailsExpanded[exerciseIndex];
    
    // Capture current scroll position before state changes
    // Use scrollY.current which is updated by onScroll event for accuracy
    const savedScrollOffset = scrollY.current;
    
    // Configure animation before state changes for smooth transitions
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    // Toggle both states together for all exercises in the block
    setFormCuesExpanded(prev => {
      const updated = { ...prev };
      allExerciseIndices.forEach(idx => {
        updated[idx] = !isCurrentlyExpanded;
      });
      return updated;
    });
    setExerciseDetailsExpanded(prev => {
      const updated = { ...prev };
      allExerciseIndices.forEach(idx => {
        updated[idx] = !isCurrentlyExpanded;
      });
      return updated;
    });
    
    // Restore scroll position after LayoutAnimation completes
    // Use requestAnimationFrame to ensure it happens after layout, then setTimeout for additional delay
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (flatListRef.current && savedScrollOffset !== undefined) {
          flatListRef.current.scrollToOffset({ 
            offset: savedScrollOffset, 
            animated: false 
          });
        }
      }, 450); // Increased delay to ensure LayoutAnimation completes
    });
  };

  // Check if exercise details are expanded
  const isExerciseDetailsExpanded = (exerciseIndex: number): boolean => {
    return exerciseDetailsExpanded[exerciseIndex] || allDetailsVisible;
  };
  
  // Cleanup scroll timeout and banner timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (bannerDismissTimeoutRef.current) {
        clearTimeout(bannerDismissTimeoutRef.current);
      }
    };
  }, []);

  // Load completed sets and logs
  useEffect(() => {
    // Reset initial load flag when session changes
    isInitialLoad.current = true;
    persistReadyRef.current = false;
    const genAtStart = editGenRef.current;
    
    const loadCompleted = async () => {
      try {
        const stored = await AsyncStorage.getItem(`completed:${sessionId}`);
        const logs = await AsyncStorage.getItem(`setLogs:${sessionId}`);
        const notes = await AsyncStorage.getItem(`setNotes:${sessionId}`);
        // A check or keystroke that landed while storage was reading must win.
        if (editGenRef.current !== genAtStart) return;
        if (stored) setCompleted(JSON.parse(stored));
        if (logs) setSetLogs(JSON.parse(logs));
        if (notes) setSetNotes(JSON.parse(notes));

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
        if (__DEV__) {
          console.error('Error loading data:', error);
        }
        // Non-critical error, don't show alert to user
      } finally {
        persistReadyRef.current = true;
      }
    };
    loadCompleted();
  }, [sessionId]);

  // Latest values for saves. The callback stays stable so focus/blur
  // does not reload storage on every checkbox or keystroke.
  const completedRef = useRef(completed);
  const setLogsRef = useRef(setLogs);
  const setNotesRef = useRef(setNotes);
  const readinessScoreRef = useRef(readinessScore);
  completedRef.current = completed;
  setLogsRef.current = setLogs;
  setNotesRef.current = setNotes;
  readinessScoreRef.current = readinessScore;

  // Save progress function
  const saveProgress = useCallback(async (silent = false) => {
    const completedNow = completedRef.current;
    const logsNow = setLogsRef.current;
    const notesNow = setNotesRef.current;
    const readinessNow = readinessScoreRef.current;
    try {
      // Save completed exercises
      await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completedNow));
      
      // Save set logs
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(logsNow));
      await AsyncStorage.setItem(`setNotes:${sessionId}`, JSON.stringify(notesNow));
      
      // Save readiness score
      if (readinessNow !== null) {
        const readinessKey = `readiness:${sessionId}`;
        await AsyncStorage.setItem(readinessKey, JSON.stringify({
          score: readinessNow,
          timestamp: new Date().toISOString(),
        }));
      }

      if (!silent) {
        // Show subtle success toast for auto-save (only if significant progress)
        if (completedNow.length > 0 || Object.keys(logsNow).length > 0) {
          Toast.show({
            type: 'success',
            text1: '💾 Progress saved',
            position: 'bottom',
            visibilityTime: 1500,
            topOffset: 60,
          });
        }
      }
      if (!silent && __DEV__) {
        console.log('💾 Progress saved');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving progress:', error);
      }
      Alert.alert(
        'Save Error',
        'Failed to save your progress. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [sessionId]);

  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

  // Auto-save on app background/close; recalc timer remaining when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        saveProgress(true);
        return;
      }
      if (nextAppState !== 'active') return;

      const now = Date.now();

      // Recalc rest timers from stored end times so they stay correct after screen off / app background
      const rest = restTimersStateRef.current;
      Object.keys(rest).forEach((keyStr) => {
        const index = parseInt(keyStr, 10);
        const endTime = restEndTimeRef.current.get(index);
        if (endTime == null) return;
        const current = rest[index];
        if (!current || current.isPaused) return;
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        if (remaining <= 0) {
          const timerId = intervalsRef.current.get(index);
          if (timerId) {
            clearInterval(timerId);
            intervalsRef.current.delete(index);
          }
          restEndTimeRef.current.delete(index);
          playRestComplete();
          speakRestComplete();
          analytics.timerCompleted('rest', current.remaining || 0).catch(() => {});
          setRestTimers((prev) => {
            const { [index]: _, ...next } = prev;
            return next;
          });
        } else {
          setRestTimers((prev) => ({
            ...prev,
            [index]: { ...current, remaining },
          }));
        }
      });

      // Recalc time-based timers from stored end times
      const timeBased = timeBasedTimersStateRef.current;
      Object.keys(timeBased).forEach((keyStr) => {
        const index = parseInt(keyStr, 10);
        const endTime = timeBasedEndTimeRef.current.get(index);
        if (endTime == null) return;
        const current = timeBased[index];
        if (!current || current.isPaused || !current.isRunning) return;
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        if (remaining <= 0) {
          const timerId = intervalsRef.current.get(index);
          if (timerId) {
            clearInterval(timerId);
            intervalsRef.current.delete(index);
          }
          timeBasedEndTimeRef.current.delete(index);
          playTimerComplete();
          analytics.timerCompleted('time-based', current.remaining || 0).catch(() => {});
          setTimeBasedTimers((prev) => ({
            ...prev,
            [index]: { ...current, remaining: 0, isRunning: false, isPaused: false },
          }));
        } else {
          setTimeBasedTimers((prev) => ({
            ...prev,
            [index]: { ...current, remaining },
          }));
        }
      });
    });

    return () => {
      subscription.remove();
    };
  }, [saveProgress]);

  // Auto-save when completed state changes (skip initial load)
  useEffect(() => {
    // Skip save on initial mount/data load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    // Auto-save silently when completed exercises change
    saveProgress(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  // Rehydrate from storage only when the screen gains focus (e.g. returning from Block view).
  // Do not depend on saveProgress: that callback used to change on every edit and
  // immediately wrote stale data back over the check or keystroke.
  useFocusEffect(
    useCallback(() => {
      isNavigatingAway.current = false;
      const genAtStart = editGenRef.current;
      let cancelled = false;

      const rehydrate = async () => {
        try {
          const stored = await AsyncStorage.getItem(`completed:${sessionId}`);
          const logs = await AsyncStorage.getItem(`setLogs:${sessionId}`);
          const notes = await AsyncStorage.getItem(`setNotes:${sessionId}`);
          if (cancelled || editGenRef.current !== genAtStart) return;
          if (stored) setCompleted(JSON.parse(stored));
          if (logs) setSetLogs(JSON.parse(logs));
          if (notes) setSetNotes(JSON.parse(notes));
        } catch (e) {
          if (__DEV__) console.error('Session rehydrate error', e);
        }
      };
      rehydrate();

      return () => {
        cancelled = true;
        if (persistReadyRef.current && !isNavigatingAway.current) {
          saveProgressRef.current(true);
        }
        isNavigatingAway.current = false;
      };
    }, [sessionId])
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
                if (__DEV__) {
                  console.log(`📦 Migrated 1RM for ${name} to new format`);
                }
              }
            }
          }
          
          if (value !== null) {
            map[name] = value;
          }
        }

        setOneRMMap(map);
        if (__DEV__) {
          console.log('📊 Loaded 1RMs:', Object.keys(map).length, 'exercises');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading 1RMs:', error);
        }
        // Non-critical error, don't show alert
      }
    };

    if (session) {
      loadExisting1RMs();
    }
  }, [sessionId, session]);

  // Helper: check if exercise is in warm-up/cool-down block
  const isWarmupCooldownExercise = (exercise: FlattenedExercise): boolean => {
    const blockName = exercise.blockName?.toLowerCase() || '';
    return ['warm-up', 'warm up', 'cool-down', 'cool down', 'cooldown', 
            'activation', 'mobility', 'stretching', 'breathing', 'recovery',
            'raise', 'activate', 'mobilize', 'potentiate'].some(
      pattern => blockName.includes(pattern)
    );
  };

  // Helper: verify exercise set count consistency (for debugging)
  const verifyExerciseSetCount = (exercise: FlattenedExercise): {
    hasInconsistency: boolean;
    expectedSets?: number;
    actualSets?: number;
    reason?: string;
  } => {
    // Only check mobility/stretching exercises
    if (!isWarmupCooldownExercise(exercise)) {
      return { hasInconsistency: false };
    }
    
    // For time-based exercises from mobility flows, should be 1 set
    // But if explicitly set in JSON, use that value
    if (isTimeBased(exercise) && exercise.duration) {
      // Time-based exercises typically have 1 set, but can have more if specified
      // No inconsistency if sets >= 1
      return { hasInconsistency: false };
    }
    
    // For volume-based exercises from mobility flows, should be 3 sets (warmup) or 1 set (cooldown)
    // But if explicitly set in JSON, use that value
    if (exercise.trackingMode === 'volume' && hasSetReps(exercise)) {
      const blockName = exercise.blockName?.toLowerCase() || '';
      const isCooldown = blockName.includes('cool') || blockName.includes('cooldown');
      const expectedSets = isCooldown ? 1 : 3;
      
      if (exercise.sets && exercise.sets !== expectedSets) {
        return {
          hasInconsistency: true,
          expectedSets,
          actualSets: exercise.sets,
          reason: `Expected ${expectedSets} sets for ${isCooldown ? 'cooldown' : 'warmup'} exercise, got ${exercise.sets}`
        };
      }
    }
    
    return { hasInconsistency: false };
  };

  // In development, log exercises with set count inconsistencies
  useEffect(() => {
    if (__DEV__ && session?.allExercises) {
      session.allExercises.forEach((exercise, index) => {
        if (isWarmupCooldownExercise(exercise)) {
          const verification = verifyExerciseSetCount(exercise);
          if (verification.hasInconsistency) {
            console.warn(`[Set Count Inconsistency] ${exercise.name}:`, verification);
          }
        }
      });
    }
  }, [session?.allExercises]);

  // Helper: Get last weight from saved setLogs or history
  const getLastWeightForExercise = async (
    exerciseIndex: number,
    exerciseName: string
  ): Promise<number | null> => {
    // First, check if we have saved setLogs for this exercise in current session
    const savedLogs = setLogs[exerciseIndex] || [];
    if (savedLogs.length > 0) {
      // Find the most recent set with valid weight
      const validWeights = savedLogs
        .map(log => {
          const weight = parseFloat(log.weight || '0');
          return !isNaN(weight) && weight > 0 ? weight : null;
        })
        .filter((w): w is number => w !== null);
      
      if (validWeights.length > 0) {
        // Use average of all valid weights from saved logs
        const avgWeight = Math.round(
          validWeights.reduce((a, b) => a + b, 0) / validWeights.length
        );
        if (__DEV__) {
          console.log(`📊 Using saved weight from setLogs for "${exerciseName}": ${avgWeight} lbs`);
        }
        return avgWeight;
      }
    }
    
    // Fallback to history from prior weeks
    const historyWeight = await getLastWeightFromHistory(exerciseName);
    if (historyWeight) {
      if (__DEV__) {
        console.log(`📊 Using weight from history for "${exerciseName}": ${historyWeight} lbs`);
      }
      return historyWeight;
    }
    
    if (__DEV__) {
      console.log(`⚠️ No weight found for "${exerciseName}" (no saved logs or history)`);
    }
    return null;
  };

  // Load progression suggestions for volume exercises
  // Recalculates when session, readinessScore, or setLogs change
  // This ensures suggestions update when saved exercise data is loaded from prior weeks
  useEffect(() => {
    const loadProgressionSuggestions = async () => {
      if (!session) return;
      
      if (__DEV__) {
        console.log('🔄 Loading progression suggestions...');
      }
      
      const suggestions: Record<string, ProgressionSuggestion> = {};
      
      for (let i = 0; i < session.allExercises.length; i++) {
        const exercise = session.allExercises[i];
        
        // Only for volume exercises (not 1RM tracked)
        if (exercise.trackingMode === 'volume' && !isTrackableFor1RM(exercise)) {
          if (__DEV__) {
            console.log(`🔍 Checking suggestions for "${exercise.name}" (index ${i})`);
          }
          
          // Get last weight from saved setLogs (current session) or history (prior weeks)
          const lastWeight = await getLastWeightForExercise(i, exercise.name);
          
          if (lastWeight) {
            const category = exercise.exerciseCategory || inferExerciseCategory(exercise.name);
            const suggestion = await applyRuleOf3Progression(
              exercise.name,
              lastWeight,
              category,
              exercise, // Pass full exercise object
              exercise.minIncrement,
              false, // isDeload - would need to check session context
              false, // isTaper
              undefined, // preDeloadWeight
              readinessScore || undefined
            );
            
            suggestions[exercise.name] = suggestion;
            
            if (__DEV__) {
              console.log(`✅ Generated suggestion for "${exercise.name}": ${suggestion.suggestedWeight} lbs (${suggestion.reason})`);
            }
          } else {
            if (__DEV__) {
              console.log(`⏭️ Skipping suggestion for "${exercise.name}" (no weight data)`);
            }
          }
        }
      }
      
      setProgressionSuggestions(suggestions);
      
      if (__DEV__) {
        console.log(`✅ Loaded ${Object.keys(suggestions).length} progression suggestions`);
      }
    };
    
    if (!session) return;
    // Debounce so each keystroke does not reload every exercise suggestion
    // and freeze checks, typing, and timer ticks.
    const timeoutId = setTimeout(() => {
      loadProgressionSuggestions();
    }, 700);
    return () => clearTimeout(timeoutId);
  }, [session, readinessScore, setLogs]);

  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      console.log('✅ Session ID:', sessionId);
      console.log('✅ Parsed session:', session);
    }
  }, [sessionId, session]);

  // Track session start
  const sessionStartTime = useRef<number>(Date.now());
  useEffect(() => {
    if (session) {
      sessionStartTime.current = Date.now();
      // Track session started
      analytics.sessionStarted(
        sessionId,
        session.title || 'Unknown',
        session.weekIndex || 0,
        session.dayNumber || 0,
        session.title || 'Unknown'
      ).catch(() => {
        // Silently fail - analytics is optional
      });
    }
  }, [sessionId, session]);

  // Timer state for time-based exercises (warm-up/cool-down) - MOVED FROM BELOW
  // This was causing hooks order violation when declared after early returns

  // Handle readiness score submission
  const handleReadinessSubmit = async (): Promise<void> => {
    const score = parseInt(tempReadinessInput, 10);
    if (!isNaN(score) && score >= 1 && score <= 10) {
      setReadinessScore(score);
      setShowReadinessModal(false);
      if (__DEV__) {
        console.log('📊 Readiness score set:', score, getReadinessLabel(score));
      }
      
      // Haptic feedback for readiness submission
      triggerHaptic.selection();
      
      // Track readiness score
      analytics.readinessScoreSet(score, getReadinessLabel(score)).catch(() => {
        // Silently fail - analytics is optional
      });
      
      // Save readiness score immediately
      try {
        const readinessKey = `readiness:${sessionId}`;
        await AsyncStorage.setItem(readinessKey, JSON.stringify({
          score,
          timestamp: new Date().toISOString(),
        }));

        // Success toast
        Toast.show({
          type: 'success',
          text1: '✅ Readiness Set',
          text2: `${getReadinessLabel(score)} (${score}/10)`,
          position: 'top',
          visibilityTime: 2000,
        });
      } catch (error) {
        if (__DEV__) {
          console.error('Error saving readiness score:', error);
        }
        Alert.alert('Error', 'Failed to save readiness score. Please try again.');
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
    if (__DEV__) {
      console.log('📊 Readiness skipped, defaulting to 5');
    }
  };

  const toggleComplete = async (index: number) => {
    const exercise = session?.allExercises[index];
    const isWarmupCooldown = exercise && isWarmupCooldownExercise(exercise);
    const wasCompleted = completed.includes(index);
    
    // Capture scroll position before unchecking to prevent scroll jumps
    const savedScrollOffset = wasCompleted ? scrollY.current : undefined;
    
    // Haptic feedback for exercise completion
    if (wasCompleted) {
      triggerHaptic.light(); // Unmarking
      // When unmarking, also remove from expandedExercises so it shows compact when re-completed
      setExpandedExercises((prev) => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    } else {
      triggerHaptic.medium(); // Marking complete
      // Keep the card open so the row does not collapse under the tap.
      setExpandedExercises((prev) => ({ ...prev, [index]: true }));
    }
    editGenRef.current += 1;
    
    // Calculate the updated completion state BEFORE updating state
    // This ensures auto-expand logic uses the correct completion state
    const currentCompleted = wasCompleted
      ? completed.filter((i) => i !== index)
      : [...completed, index];
    
    if (isWarmupCooldown && shouldShowSetCheckboxes(exercise)) {
      // For warm-up/cool-down with sets, mark all sets as complete
      if (wasCompleted) {
        // Unmarking - remove from completed and clear set completions
        setCompleted((comp) => comp.filter((i) => i !== index));
        setSetCompletions((prev) => {
          const { [index]: _, ...rest } = prev;
          return rest;
        });
      } else {
        // Marking complete - mark all sets as complete
        const allSetIndices = Array.from({ length: getEffectiveSetCount(index) }, (_, i) => i);
        setSetCompletions((prev) => ({
          ...prev,
          [index]: new Set(allSetIndices),
        }));
        setCompleted((comp) => [...comp, index]);
      }
    } else {
      // Regular exercise completion
      const updated = wasCompleted
        ? completed.filter((i) => i !== index)
        : [...completed, index];
      setCompleted(updated);
      
      // Track exercise completion (only when marking complete, not unmarking)
      if (!completed.includes(index) && exercise) {
        analytics.exerciseCompleted(
          exercise.name,
          exercise.sets || 1,
          exercise.reps || 'N/A',
          undefined
        ).catch(() => {
          // Silently fail - analytics is optional
        });
        
        // For volume exercises, update progression state when marked complete
        if (exercise.trackingMode === 'volume' && !isTrackableFor1RM(exercise)) {
          const setLogsForExercise = setLogs[index] || [];
          const weights = setLogsForExercise
            .map(log => parseFloat(log.weight))
            .filter(w => !isNaN(w) && w > 0);
          
          if (weights.length > 0) {
            // Use average weight across sets
            const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
            
            const state = await getProgressionState(exercise.name);
            const updatedState: ProgressionState = {
              exerciseName: exercise.name,
              currentWeight: Math.round(avgWeight),
              consecutiveSuccesses: state?.consecutiveSuccesses || 0,
              pendingIncrease: false,
              currentRestTime: state?.currentRestTime || exercise.rest,
              restTimeLevel: state?.restTimeLevel || 0,
              tempoModifications: state?.tempoModifications || [],
            };
            
            await saveProgressionState(updatedState);
          }
        }
      }
    }
    
    // Save to storage
    await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(currentCompleted));
    
    // Helper to calculate progress with updated completion state
    const getSectionProgressWithState = (blockName: string, completedState: number[]): { completed: number; total: number; percentage: number } => {
      if (!session) return { completed: 0, total: 0, percentage: 0 };
      
      const blockNameLower = blockName.toLowerCase().trim();
      
      const individualExercises = session.renderableItems.filter(
        item => item.blockName && item.blockName.toLowerCase().trim() === blockNameLower && item.exerciseIndex !== undefined
      );
      
      const groupedExercises = session.renderableItems.filter(
        item => item.blockName && item.blockName.toLowerCase().trim() === blockNameLower && 
        (item.type === 'circuit' || item.type === 'superset' || item.type === 'complex') &&
        item.exerciseIndices && item.exerciseIndices.length > 0
      );
      
      const completedIndividual = individualExercises.filter(item => 
        item.exerciseIndex !== undefined && completedState.includes(item.exerciseIndex)
      ).length;
      
      const totalIndividual = individualExercises.length;
      const totalGroupedExercises = groupedExercises.reduce((sum, item) => {
        return sum + (item.exerciseIndices?.length || 0);
      }, 0);
      const total = totalIndividual + totalGroupedExercises;
      
      const completedInGroups = groupedExercises.reduce((sum, item) => {
        const exerciseIndices = item.exerciseIndices || [];
        if (exerciseIndices.length === 0) return sum;
        const allCompleted = exerciseIndices.every(idx => completedState.includes(idx));
        return sum + (allCompleted ? exerciseIndices.length : 0);
      }, 0);
      const completedCount = completedIndividual + completedInGroups;
      
      return { completed: completedCount, total, percentage: total > 0 ? completedCount / total : 0 };
    };
    
    // Restore scroll position after unchecking to prevent scroll jumps
    if (wasCompleted && savedScrollOffset !== undefined && flatListRef.current) {
      setTimeout(() => {
        if (flatListRef.current && savedScrollOffset !== undefined) {
          flatListRef.current.scrollToOffset({ 
            offset: savedScrollOffset, 
            animated: false 
          });
        }
      }, 150); // Allow time for state updates and layout to settle
    }
  };

  const startRest = async (index: number, duration: number | undefined) => {
    // Haptic feedback for starting rest timer
    triggerHaptic.light();
    // Sound feedback must not block the countdown if audio init hangs.
    void playTimerStart();
    
    const initial = duration && Number.isFinite(duration) ? duration : 60;
    
    // Track rest timer started
    analytics.timerStarted('rest', initial).catch(() => {
      // Silently fail - analytics is optional
    });

    const existing = intervalsRef.current.get(index);
    if (existing) {
      clearInterval(existing);
      intervalsRef.current.delete(index);
    }

    setRestTimers((prev) => ({ ...prev, [index]: { remaining: initial, isRunning: true, isPaused: false, notificationShown: false } }));
    restEndTimeRef.current.set(index, Date.now() + initial * 1000);

    const restTickMs = getTickIntervalMs();
    const restTickDec = getTickDecrement();
    const id = setInterval(() => {
      setRestTimers((prev) => {
        const current = prev[index];
        if (!current || current.isPaused) return prev;
        
        // Countdown notification at 10 seconds (show once per timer run)
        let updatedCurrent = current;
        if (current.remaining <= 10 && current.remaining > 9 && !current.notificationShown) {
          triggerHaptic.warning();
          Toast.show({
            type: 'info',
            text1: '⏱ 10 seconds remaining',
            text2: 'Get ready for your next set!',
            visibilityTime: 2000,
          });
          updatedCurrent = { ...current, notificationShown: true };
        }
        
        if (updatedCurrent.remaining <= restTickDec) {
          const timerId = intervalsRef.current.get(index);
          if (timerId) clearInterval(timerId);
          intervalsRef.current.delete(index);
          restEndTimeRef.current.delete(index);
          // Sound and voice feedback when rest completes
          playRestComplete();
          speakRestComplete();
          // Track rest timer completed
          analytics.timerCompleted('rest', initial).catch(() => {
            // Silently fail - analytics is optional
          });
          const { [index]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [index]: { ...updatedCurrent, remaining: updatedCurrent.remaining - restTickDec } };
      });
    }, restTickMs);

    intervalsRef.current.set(index, id);
  };

  // Pause/resume timer for rest timer
  const toggleRestTimer = (index: number) => {
    setRestTimers((prev) => {
      const current = prev[index];
      if (!current) return prev;
      return {
        ...prev,
        [index]: { ...current, isPaused: !current.isPaused },
      };
    });
  };

  // Stop rest timer
  const stopRestTimer = async (index: number) => {
    const timerId = intervalsRef.current.get(index);
    if (timerId) {
      clearInterval(timerId);
      intervalsRef.current.delete(index);
    }
    restEndTimeRef.current.delete(index);
    // Sound feedback for stopping timer
    await playTimerStop();
    setRestTimers((prev) => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  };

  // Quick adjust rest timer duration
  const adjustRestTimer = (index: number, delta: number) => {
    setRestTimers((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const newRemaining = Math.max(0, current.remaining + delta);
      return {
        ...prev,
        [index]: { ...current, remaining: newRemaining },
      };
    });
    triggerHaptic.light();
  };

  // Start timer for time-based exercise
  const startTimeBasedTimer = async (index: number, durationSeconds: number) => {
    // Track timer started
    const exercise = session?.allExercises[index];
    analytics.timerStarted('time-based', durationSeconds, exercise?.name).catch(() => {
      // Silently fail - analytics is optional
    });
    
    const existing = intervalsRef.current.get(index);
    if (existing) {
      clearInterval(existing);
      intervalsRef.current.delete(index);
    }

    triggerHaptic.light();
    setTimeBasedTimers((prev) => ({ ...prev, [index]: { remaining: durationSeconds, isRunning: true, isPaused: false, notificationShown: false, countdownShown: false, beepedAt: [] } }));
    timeBasedEndTimeRef.current.set(index, Date.now() + durationSeconds * 1000);
    void playTimerStart();

    const tickMs = getTickIntervalMs();
    const tickDec = getTickDecrement();
    const id = setInterval(() => {
      setTimeBasedTimers((prev) => {
        const current = prev[index];
        if (!current || current.isPaused) return prev;
        
        const exercise = session?.allExercises[index];
        const isLadderFlow = exercise?.name === '3 Min Continuous Ladder Flow';
        
        // 30-second beeps for 3 Min Continuous Ladder Flow
        let updatedCurrent = current;
        if (isLadderFlow && durationSeconds === 180) {
          const beepedAt = current.beepedAt || [];
          const thirtySecondMarks = [150, 120, 90, 60, 30]; // Remaining seconds at each 30-second mark
          
          thirtySecondMarks.forEach(mark => {
            // Beep when we cross a 30-second mark (e.g., at exactly 150s, 120s, etc.)
            if (current.remaining === mark && !beepedAt.includes(mark)) {
              playCountdownBeep();
              triggerHaptic.light();
              beepedAt.push(mark);
              updatedCurrent = { ...current, beepedAt: [...beepedAt] };
            }
          });
        }
        
        // Countdown notification at 10 seconds (show once per timer run)
        if (updatedCurrent.remaining <= 10 && updatedCurrent.remaining > 9 && !updatedCurrent.notificationShown) {
          triggerHaptic.warning();
          Toast.show({
            type: 'info',
            text1: '⏱ 10 seconds remaining',
            text2: 'Timer almost complete!',
            visibilityTime: 2000,
          });
          updatedCurrent = { ...updatedCurrent, notificationShown: true };
        }
        
        // 3-second countdown beep sequence (3-2-1) before timer ends
        if (updatedCurrent.remaining <= 3 && updatedCurrent.remaining > 0) {
          // Play countdown beep for each second (3, 2, 1)
          playCountdownBeep();
        }
        
        if (updatedCurrent.remaining <= tickDec) {
          const timerId = intervalsRef.current.get(index);
          if (timerId) clearInterval(timerId);
          intervalsRef.current.delete(index);
          timeBasedEndTimeRef.current.delete(index);
          // Sound and voice feedback when timer completes
          playTimerComplete();
          // Track timer completed
          analytics.timerCompleted('time-based', durationSeconds).catch(() => {
            // Silently fail - analytics is optional
          });
          return { ...prev, [index]: { remaining: 0, isRunning: false, isPaused: false } };
        }
        return { ...prev, [index]: { ...updatedCurrent, remaining: updatedCurrent.remaining - tickDec } };
      });
    }, tickMs);

    intervalsRef.current.set(index, id);
  };

  // Pause/resume timer for time-based exercise
  const toggleTimeBasedTimer = async (index: number) => {
    // Haptic feedback for pausing/resuming timer
    triggerHaptic.light();
    // Sound feedback must not block pause/resume.
    void playTimerPause();
    
    // Track timer pause
    setTimeBasedTimers((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const isPaused = !current.isPaused;
      if (isPaused) {
        analytics.timerPaused('time-based').catch(() => {
          // Silently fail - analytics is optional
        });
      } else if (current.isRunning) {
        timeBasedEndTimeRef.current.set(index, Date.now() + current.remaining * 1000);
      }
      return { ...prev, [index]: { ...current, isPaused } };
    });
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const updateSetLog = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps' | 'rpe' | 'rir',
    value: string
  ) => {
    editGenRef.current += 1;
    // Validate input based on field type
    let validated = value;
    if (field === 'weight') {
      validated = validateWeightInput(value);
    } else if (field === 'reps') {
      validated = validateRepsInput(value);
    } else if (field === 'rpe' || field === 'rir') {
      // Allow empty clear; otherwise keep digits and optional decimal
      validated = value.replace(/[^\d.]/g, '').slice(0, 4);
    }

    setSetLogs((prevLogs) => {
      const existingLogs = prevLogs[exerciseIndex] || [];
      const updatedLogs = [...existingLogs];
      const prev: SetLogEntry = { weight: '', reps: '', ...updatedLogs[setIndex] };
      updatedLogs[setIndex] = { ...prev, [field]: validated };

      // Keep RPE/RIR loosely linked when one is set
      if (field === 'rpe' && validated) {
        const rpeNum = parseOptionalRpe(validated);
        if (rpeNum != null) {
          updatedLogs[setIndex].rir = String(Math.max(0, Math.min(10, 10 - rpeNum)));
        }
      } else if (field === 'rir' && validated) {
        const rirNum = parseFloat(validated);
        if (!isNaN(rirNum)) {
          updatedLogs[setIndex].rpe = String(Math.max(1, Math.min(10, 10 - rirNum)));
        }
      }

      const next = { ...prevLogs, [exerciseIndex]: updatedLogs };
      AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(next)).catch(() => {});

      const weight = updatedLogs[setIndex]?.weight || '';
      const reps = updatedLogs[setIndex]?.reps || '';
      if (weight && reps && validateWeightInput(weight) && validateRepsInput(reps)) {
        setTimeout(() => {
          setShowSetCompletePrompt({ exerciseIndex, setIndex });
        }, 500);
      }
      return next;
    });
  };

  const updateSetNote = (key: string, text: string) => {
    editGenRef.current += 1;
    setSetNotes((prev) => {
      const updated = { ...prev, [key]: text };
      AsyncStorage.setItem(`setNotes:${sessionId}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // Helper: Quick adjust weight/reps
  const quickAdjustSetLog = async (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    delta: number
  ) => {
    const currentValue = setLogs[exerciseIndex]?.[setIndex]?.[field] || '0';
    const numValue = parseFloat(currentValue) || 0;
    const newValue = Math.max(0, numValue + delta);
    await updateSetLog(exerciseIndex, setIndex, field, newValue.toString());
    triggerHaptic.light();
  };

  // Helper: Copy from previous set
  const copyFromPreviousSet = async (exerciseIndex: number, setIndex: number) => {
    if (setIndex === 0) return; // No previous set
    const prevSet = setLogs[exerciseIndex]?.[setIndex - 1];
    if (prevSet) {
      const existingLogs = setLogs[exerciseIndex] || [];
      const updatedLogs = [...existingLogs];
      const nextEntry: SetLogEntry = { weight: '', reps: '', ...updatedLogs[setIndex] };

      if (prevSet.weight) nextEntry.weight = validateWeightInput(prevSet.weight);
      if (prevSet.reps) nextEntry.reps = validateRepsInput(prevSet.reps);
      if (prevSet.rpe) nextEntry.rpe = prevSet.rpe;
      if (prevSet.rir) nextEntry.rir = prevSet.rir;

      updatedLogs[setIndex] = nextEntry;
      const next = { ...setLogs, [exerciseIndex]: updatedLogs };
      setSetLogs(next);
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(next));

      const weight = updatedLogs[setIndex]?.weight || '';
      const reps = updatedLogs[setIndex]?.reps || '';
      if (weight && reps && validateWeightInput(weight) && validateRepsInput(reps)) {
        setTimeout(() => {
          setShowSetCompletePrompt({ exerciseIndex, setIndex });
        }, 500);
      }

      triggerHaptic.light();
    }
  };

  // Helper: Render a single set for an exercise in a superset
  const renderSupersetSet = (
    exerciseIndex: number,
    setIndex: number,
    exerciseName: string,
    exerciseNumber: number
  ) => {
    const weight = setLogs[exerciseIndex]?.[setIndex]?.weight || '';
    const reps = setLogs[exerciseIndex]?.[setIndex]?.reps || '';
    const exercise = session?.allExercises[exerciseIndex];
    // For accessory exercises, allow 0 as valid weight (0 = bodyweight)
    const isAccessoryExercise = exercise?.blockName?.toLowerCase().includes('accessory') || 
                                 exercise?.groupId?.includes('accessory');
    const weightNum = weight ? parseFloat(weight) : NaN;
    const isWeightValid = weight && validateWeightInput(weight) && 
                          (!isNaN(weightNum) && (isAccessoryExercise ? weightNum >= 0 : weightNum > 0));
    const isRepsValid = reps && validateRepsInput(reps);
    const isSetComplete = setCompletions[exerciseIndex]?.has(setIndex) || false;
    const adjustedExercise = exercise ? getAdjustedExerciseData(exercise) : null;
    const loadInfo = adjustedExercise && exercise && isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedExercise) : null;
    const suggestedWeight = loadInfo?.suggestedWeight ?? (exercise ? progressionSuggestions[exercise.name]?.suggestedWeight : undefined);
    
    // Check if this is a distance exercise
    const isDistanceExercise = exercise?.trackingMode === 'distance';
    const needsWeightInput = exercise && isDistanceExerciseWithWeight(exercise);
    const distanceValue = exercise?.distance || '';
    
    return (
      <View key={`set-${exerciseIndex}-${setIndex}`} style={styles.supersetSetContainer}>
        <View style={styles.supersetSetHeader}>
          <Text style={styles.supersetSetLabel}>
            {exerciseName} - Set {setIndex + 1}
          </Text>
          {setIndex > 0 && (
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => copyFromPreviousSet(exerciseIndex, setIndex)}
            >
              <Text style={styles.copyButtonText}>📋 Copy</Text>
            </TouchableOpacity>
          )}
          {isSetComplete && (
            <Text style={styles.setCompleteBadge}>✓</Text>
          )}
        </View>
        
        {/* Weight Input - Show for regular exercises or distance exercises with weight */}
        {(shouldShowSetLogging(exercise!) || needsWeightInput) && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight (lbs)</Text>
            <View style={styles.inputWithButtons}>
              <TouchableOpacity
                style={styles.quickAdjustButton}
                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', -5)}
              >
                <Text style={styles.quickAdjustButtonText}>-5</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.enhancedInput,
                  isWeightValid && styles.inputValid,
                ]}
                placeholder="Weight"
                keyboardType="numeric"
                value={weight}
                onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'weight', text)}
                accessibilityLabel={`Weight for ${exerciseName} set ${setIndex + 1}`}
              />
              <TouchableOpacity
                style={styles.quickAdjustButton}
                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', 5)}
              >
                <Text style={styles.quickAdjustButtonText}>+5</Text>
              </TouchableOpacity>
            </View>
            {suggestedWeight && !weight && (
              <TouchableOpacity
                style={styles.useSuggestedButton}
                onPress={() => {
                  updateSetLog(exerciseIndex, setIndex, 'weight', suggestedWeight.toString());
                }}
              >
                <Text style={styles.useSuggestedButtonText}>
                  Use Suggested: {suggestedWeight} lbs
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Distance Display - Show for distance exercises (read-only) */}
        {isDistanceExercise && distanceValue && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Distance</Text>
            <View style={[styles.enhancedInput, { backgroundColor: THEME.background, justifyContent: 'center' }]}>
              <Text style={styles.distanceDisplayText}>{distanceValue}</Text>
            </View>
          </View>
        )}
        
        {/* Reps Input - Show only for non-distance exercises */}
        {!isDistanceExercise && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reps</Text>
            <View style={styles.inputWithButtons}>
              <TouchableOpacity
                style={styles.quickAdjustButton}
                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', -1)}
              >
                <Text style={styles.quickAdjustButtonText}>-1</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.enhancedInput,
                  isRepsValid && styles.inputValid,
                ]}
                placeholder="Reps"
                keyboardType="numeric"
                value={reps}
                onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'reps', text)}
                accessibilityLabel={`Reps for ${exerciseName} set ${setIndex + 1}`}
              />
              <TouchableOpacity
                style={styles.quickAdjustButton}
                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', 1)}
              >
                <Text style={styles.quickAdjustButtonText}>+1</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Quick Note Input */}
        <View style={styles.quickNoteContainer}>
          <TextInput
            style={styles.quickNoteInput}
            placeholder="Quick note (e.g., 'felt heavy', 'form good')"
            value={setNotes[`${exerciseIndex}-${setIndex}`] || ''}
            onChangeText={(text) => updateSetNote(`${exerciseIndex}-${setIndex}`, text)}
            multiline
            maxLength={100}
          />
        </View>
        
        {/* Mark Set Complete Button - Validation depends on exercise type */}
        {(() => {
          if (isSetComplete) return null;
          
          // For distance exercises with weight: need weight only
          if (isDistanceExercise && needsWeightInput) {
            if (isWeightValid) {
              return (
                <TouchableOpacity
                  style={styles.setCompleteButton}
                  onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                >
                  <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                </TouchableOpacity>
              );
            }
            return null;
          }
          
          // For distance exercises without weight: can mark complete immediately (distance is prescribed)
          if (isDistanceExercise && !needsWeightInput) {
            return (
              <TouchableOpacity
                style={styles.setCompleteButton}
                onPress={() => handleSetComplete(exerciseIndex, setIndex)}
              >
                <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
              </TouchableOpacity>
            );
          }
          
          // For regular exercises: need both weight and reps
          if (isWeightValid && isRepsValid) {
            return (
              <TouchableOpacity
                style={styles.setCompleteButton}
                onPress={() => handleSetComplete(exerciseIndex, setIndex)}
              >
                <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
              </TouchableOpacity>
            );
          }
          
          return null;
        })()}
      </View>
    );
  };

  // Helper: Render compact preview for future set (expandable)
  const renderFutureSetPreview = (
    exercise: FlattenedExercise,
    exerciseIndex: number,
    setIndex: number,
    isGrouped: boolean = false
  ) => {
    const setKey = `${exerciseIndex}-${setIndex}`;
    const isExpanded = expandedSets[setKey] || false;
    const adjustedEx = getAdjustedExerciseData(exercise);
    const numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
    
    // If expanded, show full form (reuse existing logic from individual exercise rendering)
    if (isExpanded) {
      // Check if prior set is complete
      const priorSetComplete = setIndex === 0 || setCompletions[exerciseIndex]?.has(setIndex - 1);
      const weight = setLogs[exerciseIndex]?.[setIndex]?.weight || '';
      const reps = setLogs[exerciseIndex]?.[setIndex]?.reps || '';
      const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                   exercise.groupId?.includes('accessory');
      const weightNum = weight ? parseFloat(weight) : NaN;
      const isWeightValid = weight && validateWeightInput(weight) && 
                            (!isNaN(weightNum) && (isAccessoryExercise ? weightNum >= 0 : weightNum > 0));
      const isRepsValid = reps && validateRepsInput(reps);
      const isSetComplete = setCompletions[exerciseIndex]?.has(setIndex) || false;
      const loadInfo = isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedEx) : null;
      const suggestedWeight = loadInfo?.suggestedWeight ?? progressionSuggestions[exercise.name]?.suggestedWeight;
      const isDistanceExercise = exercise.trackingMode === 'distance';
      const needsWeightInput = isDistanceExerciseWithWeight(exercise);
      const distanceValue = exercise.distance || '';
      
      return (
        <View key={`future-expanded-${setKey}`} style={styles.supersetSetContainer}>
          <View style={styles.supersetSetHeader}>
            <Text style={styles.supersetSetLabel}>
              {(() => {
                // Build exercise name with rep/distance info
                let exerciseLabel = exercise.name;
                if (exercise.trackingMode === 'distance' && exercise.distance) {
                  exerciseLabel = `${exercise.name} (${exercise.distance})`;
                } else if (exercise.reps) {
                  exerciseLabel = `${exercise.name} (${formatRepsDisplay(exercise.reps)})`;
                }
                return `${exerciseLabel} - Set ${setIndex + 1} (Preview)`;
              })()}
            </Text>
            <View style={styles.setHeaderActions}>
              {setIndex > 0 && (
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyFromPreviousSet(exerciseIndex, setIndex)}
                >
                  <Text style={styles.copyButtonText}>📋 Copy</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.collapseButton}
                onPress={() => {
                  setExpandedSets(prev => {
                    const updated = { ...prev };
                    delete updated[setKey];
                    return updated;
                  });
                }}
              >
                <Text style={styles.collapseButtonText}>▼ Collapse</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Show warning if prior set not complete */}
          {!priorSetComplete && (
            <View style={styles.futureSetWarningContainer}>
              <Text style={styles.futureSetWarning}>
                ⚠️ Complete Set {setIndex} first before marking this set complete
              </Text>
            </View>
          )}
          
          {/* Weight Input */}
          {(shouldShowSetLogging(exercise) || needsWeightInput) && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight (lbs)</Text>
              <View style={styles.inputWithButtons}>
                <TouchableOpacity
                  style={styles.quickAdjustButton}
                  onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', -5)}
                >
                  <Text style={styles.quickAdjustButtonText}>-5</Text>
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.enhancedInput,
                    isWeightValid && styles.inputValid,
                  ]}
                  placeholder="Weight"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'weight', text)}
                  accessibilityLabel={`Weight for ${exercise.name} set ${setIndex + 1}`}
                />
                <TouchableOpacity
                  style={styles.quickAdjustButton}
                  onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', 5)}
                >
                  <Text style={styles.quickAdjustButtonText}>+5</Text>
                </TouchableOpacity>
              </View>
              {suggestedWeight && !weight && (
                <TouchableOpacity
                  style={styles.useSuggestedButton}
                  onPress={() => {
                    updateSetLog(exerciseIndex, setIndex, 'weight', suggestedWeight.toString());
                  }}
                >
                  <Text style={styles.useSuggestedButtonText}>
                    Use Suggested: {suggestedWeight} lbs
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Distance Display */}
          {isDistanceExercise && distanceValue && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Distance</Text>
              <View style={[styles.enhancedInput, { backgroundColor: THEME.background, justifyContent: 'center' }]}>
                <Text style={styles.distanceDisplayText}>{distanceValue}</Text>
              </View>
            </View>
          )}
          
          {/* Reps Input */}
          {!isDistanceExercise && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <View style={styles.inputWithButtons}>
                <TouchableOpacity
                  style={styles.quickAdjustButton}
                  onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', -1)}
                >
                  <Text style={styles.quickAdjustButtonText}>-1</Text>
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.enhancedInput,
                    isRepsValid && styles.inputValid,
                  ]}
                  placeholder="Reps"
                  keyboardType="numeric"
                  value={reps}
                  onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'reps', text)}
                  accessibilityLabel={`Reps for ${exercise.name} set ${setIndex + 1}`}
                />
                <TouchableOpacity
                  style={styles.quickAdjustButton}
                  onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', 1)}
                >
                  <Text style={styles.quickAdjustButtonText}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Quick Note Input */}
          <View style={styles.quickNoteContainer}>
            <TextInput
              style={styles.quickNoteInput}
              placeholder="Quick note (e.g., 'felt heavy', 'form good')"
              value={setNotes[setKey] || ''}
              onChangeText={(text) => updateSetNote(setKey, text)}
              multiline
              maxLength={100}
            />
          </View>
          
          {/* Mark Set Complete Button - only enabled if prior set is complete */}
          {(() => {
            if (isSetComplete) return null;
            if (!priorSetComplete) return null; // Don't show button if prior set not complete
            
            // For distance exercises with weight: need weight only
            if (isDistanceExercise && needsWeightInput) {
              if (isWeightValid) {
                return (
                  <TouchableOpacity
                    style={styles.setCompleteButton}
                    onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                  >
                    <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            }
            
            // For distance exercises without weight: can mark complete immediately
            if (isDistanceExercise && !needsWeightInput) {
              return (
                <TouchableOpacity
                  style={styles.setCompleteButton}
                  onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                >
                  <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                </TouchableOpacity>
              );
            }
            
            // For regular exercises: need both weight and reps
            if (isWeightValid && isRepsValid) {
              return (
                <TouchableOpacity
                  style={styles.setCompleteButton}
                  onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                >
                  <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                </TouchableOpacity>
              );
            }
            
            return null;
          })()}
        </View>
      );
    }
    
    // Otherwise, show compact preview
    const repsDisplay = exercise.reps ? formatRepsDisplay(exercise.reps) : '—';
    return (
      <TouchableOpacity
        key={`future-preview-${setKey}`}
        style={styles.futureSetPreview}
        onPress={() => {
          setExpandedSets(prev => ({ ...prev, [setKey]: true }));
        }}
      >
        <Text style={styles.futureSetPreviewLabel}>
          {exercise.name} - Set {setIndex + 1}
        </Text>
        <Text style={styles.futureSetPreviewDetail}>
          {repsDisplay} reps • Tap to prepare
        </Text>
        <Text style={styles.futureSetPreviewHint}>▶ Preview</Text>
      </TouchableOpacity>
    );
  };

  // Helper: Check if exercise is part of a group (superset/circuit)
  const isExerciseInGroup = (exerciseIndex: number): { isGrouped: boolean; groupItem?: RenderableItem; groupIndex?: number } => {
    if (!session) return { isGrouped: false };
    
    const groupItem = session.renderableItems.find(item => 
      item.exerciseIndices && item.exerciseIndices.includes(exerciseIndex)
    );
    
    if (groupItem && groupItem.exerciseIndices && groupItem.exerciseIndices.length > 1) {
      return { 
        isGrouped: true, 
        groupItem,
        groupIndex: groupItem.exerciseIndices.indexOf(exerciseIndex)
      };
    }
    
    return { isGrouped: false };
  };

  // Helper: Check if all exercises in a group are complete
  const areAllExercisesInGroupComplete = (groupItem: RenderableItem): boolean => {
    if (!groupItem.exerciseIndices || groupItem.exerciseIndices.length === 0) return false;
    
    return groupItem.exerciseIndices.every(idx => completed.includes(idx));
  };

  // Helper: Check if a specific round is complete (all exercises in group have completed that set index)
  const isRoundComplete = (groupItem: RenderableItem, roundIndex: number): boolean => {
    if (!groupItem.exerciseIndices || groupItem.exerciseIndices.length === 0) return false;
    
    return groupItem.exerciseIndices.every(exerciseIndex => {
      const numSets = getEffectiveSetCount(exerciseIndex);
      // If the exercise has fewer sets than the round index, consider it "complete" for that round
      if (roundIndex >= numSets) return true;
      
      // Check if this set index is marked as complete
      const completions = setCompletions[exerciseIndex] || new Set<number>();
      return completions.has(roundIndex);
    });
  };

  // Helper: Determine if a set is completed, current, or future
  const getSetState = (exerciseIndex: number, setIndex: number): 'completed' | 'current' | 'future' => {
    const isComplete = setCompletions[exerciseIndex]?.has(setIndex) || false;
    if (isComplete) return 'completed';
    
    const numSets = getEffectiveSetCount(exerciseIndex);
    const currentSetIndex = [...Array(numSets)].findIndex((_, idx) => 
      !setCompletions[exerciseIndex]?.has(idx)
    );
    
    if (currentSetIndex === setIndex) return 'current';
    return 'future';
  };

  // Helper: For grouped exercises, determine round state
  const getRoundState = (item: RenderableItem, roundIndex: number): 'completed' | 'current' | 'future' => {
    const roundComplete = isRoundComplete(item, roundIndex);
    if (roundComplete) return 'completed';
    
    // Find first incomplete round
    if (!item.exerciseIndices || item.exerciseIndices.length === 0) return 'future';
    
    // For circuits, use circuit rounds instead of exercise sets
    let maxRounds: number;
    if (item.type === 'circuit' && item.rounds && item.rounds > 0) {
      maxRounds = item.rounds;
    } else {
      maxRounds = Math.max(...item.exerciseIndices.map(idx => getEffectiveSetCount(idx)));
    }
    
    for (let i = 0; i < maxRounds; i++) {
      if (!isRoundComplete(item, i)) {
        return i === roundIndex ? 'current' : 'future';
      }
    }
    
    return 'future';
  };

  // Helper: Check if a future set should be shown (for per-exercise progression)
  const shouldShowFutureSet = (exerciseIndex: number, setIndex: number): boolean => {
    // Always show first set
    if (setIndex === 0) return true;
    // Show set N+1 if set N is complete
    return setCompletions[exerciseIndex]?.has(setIndex - 1) || false;
  };

  // Helper: check if exercise is a sprint exercise
  const isSprintExercise = (exercise: FlattenedExercise): boolean => {
    const exerciseNameLower = exercise.name.toLowerCase();
    return exercise.trackingMode === 'distance' && 
           (exerciseNameLower.includes('sprint') || exerciseNameLower.includes('hill sprint'));
  };

  // Helper: check if exercise is a shuttle exercise
  const isShuttleExercise = (exercise: FlattenedExercise): boolean => {
    const exerciseNameLower = exercise.name.toLowerCase();
    return exercise.trackingMode === 'distance' && 
           (exerciseNameLower.includes('shuttle') || exerciseNameLower.includes('5-10-5'));
  };

  // Helper: check if exercise is an acceleration buildup exercise
  const isAccelerationBuildupExercise = (exercise: FlattenedExercise): boolean => {
    const exerciseNameLower = exercise.name.toLowerCase();
    return exercise.trackingMode === 'distance' && 
           exerciseNameLower.includes('acceleration buildup');
  };

  // Helper: check if exercise is a distance-based speed exercise (sprints, shuttles, acceleration buildups) that shouldn't use interval timers
  const isDistanceSpeedExercise = (exercise: FlattenedExercise): boolean => {
    return isSprintExercise(exercise) || isShuttleExercise(exercise) || isAccelerationBuildupExercise(exercise);
  };

  // Helper: get rest duration for exercise (90s default for sprints, existing rest or 60s for others)
  const getRestDuration = (exercise: FlattenedExercise): number => {
    if (isSprintExercise(exercise) && exercise.sets && exercise.sets > 1) {
      return exercise.rest || 90; // 90s default for sprints
    }
    // Shuttle and acceleration buildup exercises use existing rest time (no default override)
    if ((isShuttleExercise(exercise) || isAccelerationBuildupExercise(exercise)) && exercise.sets && exercise.sets > 1) {
      return exercise.rest || 60; // Use existing rest or 60s default
    }
    return exercise.rest || 60; // 60s default for others
  };

  // Helper: Mark set complete and suggest rest timer
  const handleSetComplete = async (exerciseIndex: number, setIndex: number) => {
    // Mark set as complete
    setSetCompletions(prev => {
      const exerciseCompletions = new Set(prev[exerciseIndex] || []);
      exerciseCompletions.add(setIndex);
      return { ...prev, [exerciseIndex]: exerciseCompletions };
    });
    
    setShowSetCompletePrompt(null);
    triggerHaptic.success();
    
    // Check if all sets are complete for this exercise
    const exercise = session?.allExercises[exerciseIndex];
    if (!exercise) return;
    
    const numSets = getEffectiveSetCount(exerciseIndex);
    const allSetsComplete = Array.from({ length: numSets }).every((_, idx) => {
      const completions = setCompletions[exerciseIndex] || new Set<number>();
      return idx === setIndex || completions.has(idx);
    });
    
    // Check if exercise is part of a group
    const { isGrouped, groupItem } = isExerciseInGroup(exerciseIndex);
    
    if (isGrouped && groupItem) {
      // For grouped exercises, show rest timer after each round completes
      const groupTimerKey = groupItem.exerciseIndices?.[0] ?? exerciseIndex;
      const restDuration = calculateGroupRestDuration(groupItem);
      
      // Check if this round (setIndex) is now complete for all exercises in the group
      setTimeout(() => {
        // Check round completion with updated state using functional update to read latest state
        const allExercisesInGroup = groupItem.exerciseIndices || [];
        
        // Use functional update to read the latest setCompletions state
        setSetCompletions(currentCompletions => {
          const roundComplete = allExercisesInGroup.every(exIdx => {
            const numSets = getEffectiveSetCount(exIdx);
            // If the exercise has fewer sets than the round index, consider it "complete" for that round
            if (setIndex >= numSets) return true;
            
            // Check if this set index is marked as complete
            // Use currentCompletions which includes the set we just completed
            const completions = currentCompletions[exIdx] || new Set<number>();
            return completions.has(setIndex);
          });
          
          // Handle round completion alert in a separate callback to avoid nested state updates
          if (roundComplete) {
            // Use setTimeout to ensure this runs after the setSetCompletions update
            setTimeout(() => {
              setCompletedRounds(prev => {
                const groupRounds = prev[groupTimerKey] || new Set<number>();
                const alreadyCompleted = groupRounds.has(setIndex);
                
                // Show timer alert when round is complete (for all sets, including first set)
                if (!alreadyCompleted && restDuration > 0) {
                  // Mark this round as completed
                  const updatedRounds = new Set(groupRounds);
                  updatedRounds.add(setIndex);
                  
                  // Show rest timer for this round
                  Alert.alert(
                    'Round Complete!',
                    `Set Round ${setIndex + 1} complete. Start ${restDuration}s rest timer?`,
                    [
                      { text: 'Skip', style: 'cancel' },
                      { 
                        text: 'Start Timer', 
                        onPress: () => startRest(groupTimerKey, restDuration)
                      },
                    ]
                  );
                  
                  return { ...prev, [groupTimerKey]: updatedRounds };
                }
                
                return prev;
              });
            }, 0);
          }
          
          // Return unchanged state (we're just reading it)
          return currentCompletions;
        });
      }, 500); // Timeout to ensure state update
      
      // Also check if all sets are complete for this exercise
      if (allSetsComplete) {
        // Mark this exercise as complete (if not already)
        const wasAlreadyComplete = completed.includes(exerciseIndex);
        if (!wasAlreadyComplete) {
          setCompleted(prev => [...prev, exerciseIndex]);
        }
      }
    } else {
      // Individual exercise - show rest timer after each set or when all sets complete
      if (allSetsComplete) {
        // Mark this exercise as complete (if not already)
        const wasAlreadyComplete = completed.includes(exerciseIndex);
        if (!wasAlreadyComplete) {
          setCompleted(prev => [...prev, exerciseIndex]);
        }
        
        // Show rest timer alert if exercise has rest time or is a sprint
        const restDuration = getRestDuration(exercise);
        if (restDuration > 0) {
          setTimeout(() => {
            Alert.alert(
              'All Sets Complete!',
              `Start ${restDuration}s rest timer?`,
              [
                { text: 'Skip', style: 'cancel' },
                { 
                  text: 'Start Timer', 
                  onPress: () => startRest(exerciseIndex, restDuration)
                },
              ]
            );
          }, 300);
        }
      } else {
        // Not last set, suggest rest timer if exercise has rest time or is a sprint
        const restDuration = getRestDuration(exercise);
        if (restDuration > 0 && setIndex < numSets - 1) {
          setTimeout(() => {
            Alert.alert(
              'Set Complete',
              `Start ${restDuration}s rest timer?`,
              [
                { text: 'Skip', style: 'cancel' },
                { 
                  text: 'Start Timer', 
                  onPress: () => startRest(exerciseIndex, restDuration)
                },
              ]
            );
          }, 300);
        }
      }
    }
  };

  // Helper: Apply suggested weight to a set
  const applySuggestedWeight = async (exerciseIndex: number, setIndex: number, suggestedWeight: number) => {
    await updateSetLog(exerciseIndex, setIndex, 'weight', suggestedWeight.toString());
    triggerHaptic.light();
  };

  // Helper: Get reps string for a specific set (handles "5", "5,5,5,3", etc.)
  const getRepsForSet = (exercise: FlattenedExercise, setIndex: number): string => {
    const reps = exercise.reps;
    if (reps === undefined) return '';
    const str = String(reps).trim();
    const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return str;
    if (setIndex < parts.length) return parts[setIndex];
    return parts[0];
  };

  // Helper: Complete all sets at suggested weight (batch)
  const handleCompleteAllSetsAtSuggested = async (exerciseIndex: number, suggestedWeight: number) => {
    const exercise = session?.allExercises[exerciseIndex];
    if (!exercise) return;
    const adjusted = getAdjustedExerciseData(exercise);
    const numSets = adjusted.adjustedSets ?? adjusted.sets ?? exercise.sets ?? 0;
    if (numSets === 0) return;

    const updates: Array<{ setIndex: number; weight: string; reps: string }> = [];
    for (let setIndex = 0; setIndex < numSets; setIndex++) {
      const existing = setLogs[exerciseIndex]?.[setIndex];
      const weight = existing?.weight?.trim() || '';
      if (!weight) {
        const reps = getRepsForSet(exercise, setIndex) || String(exercise.reps ?? '');
        updates.push({ setIndex, weight: suggestedWeight.toString(), reps });
      }
    }
    if (updates.length === 0) return;

    for (const { setIndex, weight, reps } of updates) {
      await updateSetLog(exerciseIndex, setIndex, 'weight', weight);
      if (reps) await updateSetLog(exerciseIndex, setIndex, 'reps', reps);
    }
    setSetCompletions((prev) => {
      const next = { ...prev };
      const exerciseCompletions = new Set(next[exerciseIndex] || []);
      updates.forEach((u) => exerciseCompletions.add(u.setIndex));
      next[exerciseIndex] = exerciseCompletions;
      return next;
    });
    triggerHaptic.success();
    saveProgress(false);
  };

  const markSessionComplete = async () => {
    try {
      if (!sessionId) {
        if (__DEV__) {
          console.error('❌ Cannot finish session: sessionId is undefined');
        }
        Alert.alert('Error', 'Unable to complete session. Please try again.');
        return;
      }

      // Haptic feedback for finishing session
      triggerHaptic.success();

      // Mark that we're intentionally navigating away
      isNavigatingAway.current = true;

      // Save all progress before completing session
      await saveProgress(true);

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
      restEndTimeRef.current.clear();
      timeBasedEndTimeRef.current.clear();
      setRestTimers({});
      setTimeBasedTimers({});

      // Clean up scroll timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Stop any ongoing voice/speech
      stopSpeaking();

      // Track session completion
      const duration = Math.floor((Date.now() - sessionStartTime.current) / 1000);
      const exercisesCompleted = completed.length;
      analytics.sessionCompleted(sessionId, duration, exercisesCompleted).catch(() => {
        // Silently fail - analytics is optional
      });

      // Cloud backup (non-blocking)
      import('../storage/cloudBackup').then(({ backupToCloudIfNeeded }) =>
        backupToCloudIfNeeded().catch(() => {})
      );

      // Save session data for summary screen
      try {
        const sessionLogsKey = `sessionLogs:${sessionId}`;
        await AsyncStorage.setItem(sessionLogsKey, JSON.stringify({
          title: session?.title || 'Training Session',
          durationMinutes: session?.durationMinutes || 0,
          totalExercises: session?.allExercises.length || 0,
        }));
      } catch (logError) {
        // Non-critical, continue
      }

      // Save exercise history for completed exercises
      if (session && completed.length > 0) {
        try {
          const currentDate = new Date().toISOString();
          
          for (const exerciseIndex of completed) {
            const exercise = session.allExercises[exerciseIndex];
            if (!exercise) continue;
            
            // Skip warm-up/cool-down exercises from history
            const blockName = exercise.blockName?.toLowerCase() || '';
            const isWarmupCooldown = blockName.includes('warm-up') || 
                                     blockName.includes('warm up') || 
                                     blockName.includes('cool-down') || 
                                     blockName.includes('cool down') || 
                                     blockName.includes('cooldown') ||
                                     blockName.includes('activation') ||
                                     blockName.includes('mobility') ||
                                     blockName.includes('stretching');
            
            if (isWarmupCooldown) continue;
            
            // Get set logs for this exercise
            const logs = setLogs[exerciseIndex] || [];
            const completedSets = setCompletions[exerciseIndex] || new Set<number>();
            const numCompletedSets = completedSets.size;
            
            if (numCompletedSets === 0) continue; // No sets completed, skip
            
            // Calculate average weight and reps from completed sets
            const validLogs = logs.filter((log, idx) => 
              completedSets.has(idx) && log.weight && log.reps
            );
            
            if (validLogs.length === 0) continue; // No valid logs
            
            const weights = validLogs
              .map(log => parseFloat(log.weight || '0'))
              .filter(w => !isNaN(w) && w > 0);
            const avgWeight = weights.length > 0 
              ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length)
              : undefined;
            
            // Get reps (use first set's reps as representative, or average if different)
            const firstReps = validLogs[0]?.reps || exercise.reps;
            const lastRepsNum = parseFloat(String(validLogs[validLogs.length - 1]?.reps ?? ''));
            const prescribedRepsNum = typeof exercise.reps === 'number'
              ? exercise.reps
              : parseFloat(String(exercise.reps ?? ''));
            const extraReps =
              !isNaN(lastRepsNum) && !isNaN(prescribedRepsNum)
                ? Math.max(0, Math.round(lastRepsNum - prescribedRepsNum))
                : undefined;

            const sessionRpe = aggregateSessionRpe(validLogs);
            const targetRPE = exercise.targetRPE;
            const exerciseLog: ExerciseLog = {
              exerciseId: `${exerciseIndex}`,
              exerciseName: exercise.name,
              date: currentDate,
              sessionId: sessionId,
              sets: numCompletedSets,
              reps: firstReps,
              weight: avgWeight,
              rpe: sessionRpe,
              targetRPE,
              readiness: readinessScore || undefined,
              isCompleted: true,
              isWarmup: false,
              extraReps,
              qualityPass: undefined,
            };
            exerciseLog.qualityPass = checkQualityGate(exerciseLog);
            
            // Save to history
            await saveExerciseLog(exerciseLog);
          }
        } catch (historyError) {
          // Non-critical error, log but don't block session completion
          if (__DEV__) {
            console.error('Error saving exercise history:', historyError);
          }
        }
      }

      // Auto-update 1RM for completed 1RM-tracked exercises (conservative: only increase)
      if (session && completed.length > 0) {
        try {
          for (const exerciseIndex of completed) {
            const exercise = session.allExercises[exerciseIndex];
            if (!exercise || !isTrackableFor1RM(exercise)) continue;

            const current1RM = await getExercise1RM(exercise.name);
            if (current1RM == null) continue;

            const logs = setLogs[exerciseIndex] || [];
            const completedSets = setCompletions[exerciseIndex] || new Set<number>();
            const validLogs = logs.filter((log, idx) =>
              completedSets.has(idx) && log.weight && log.reps
            );

            const { shouldUpdate, new1RM } = compute1RMUpdateFromCompletedSets(
              validLogs,
              current1RM,
              2.5
            );
            if (shouldUpdate && new1RM != null) {
              await saveExercise1RM(exercise.name, new1RM);
              await append1RMHistory(exercise.name, new1RM);
              Toast.show({
                type: 'success',
                text1: 'New PR!',
                text2: `${exercise.name} 1RM updated to ${new1RM} lbs`,
                position: 'top',
                visibilityTime: 2500,
              });
            }
          }
        } catch (rmError) {
          if (__DEV__) {
            console.error('Error updating 1RM from session:', rmError);
          }
        }
      }

      // Success toast before navigation
      Toast.show({
        type: 'success',
        text1: '🎉 Session Complete!',
        text2: `Completed ${completed.length} exercises`,
        position: 'top',
        visibilityTime: 2500,
      });

      // Small delay to show toast before navigation
      setTimeout(() => {
        navigation.navigate('SessionSummary', { sessionId, completed });
      }, 500);
    } catch (error) {
      if (__DEV__) {
        console.error('Error finishing session:', error);
      }
      Alert.alert('Error', 'Failed to complete session. Please try again.');
    }
  };

  // Helper functions (moved before hooks to ensure they're always defined)
  // Helper: Determine section type from block name
  const getSectionType = (blockName: string): string => {
    if (!blockName) return 'main';
    const nameLower = blockName.toLowerCase();
    // Program-specific warm-up blocks
    if (nameLower === 'raise') return 'raise';
    if (nameLower === 'activate') return 'activate';
    if (nameLower === 'mobilize') return 'mobilize';
    if (nameLower === 'potentiate') return 'potentiate';
    // Generic blocks
    if (nameLower.includes('warm') || nameLower.includes('warm-up')) return 'warmup';
    if (nameLower.includes('mobility')) return 'mobility';
    if (nameLower.includes('activation')) return 'activation';
    if (nameLower.includes('cool') || nameLower.includes('cooldown')) return 'cooldown';
    return 'main';
  };

  // Helper: Get all sections in order (memoized for performance)
  const sections = useMemo(() => {
    if (!session) return [];
    const sectionsList: Array<{ name: string; type: string; blockName: string }> = [];
    const seenBlocks = new Set<string>();
    
    session.renderableItems.forEach((item) => {
      const blockName = item.blockName || '';
      if (blockName && !seenBlocks.has(blockName)) {
        seenBlocks.add(blockName);
        sectionsList.push({
          name: blockName,
          type: getSectionType(blockName),
          blockName,
        });
      }
    });
    
    return sectionsList;
  }, [session]);

  // Helper: Get section progress (used by memoized map)
  // Wrapped in useCallback to ensure stable reference for use in other hooks' dependency arrays
  const getSectionProgress = useCallback((blockName: string): { completed: number; total: number; percentage: number } => {
    if (!session) return { completed: 0, total: 0, percentage: 0 };
    
    // Use case-insensitive matching for blockName to handle any casing differences
    const blockNameLower = blockName.toLowerCase().trim();
    
    // Count individual exercises (exact match on blockName)
    const individualExercises = session.renderableItems.filter(
      item => item.blockName && item.blockName.toLowerCase().trim() === blockNameLower && item.exerciseIndex !== undefined
    );
    
    // Count grouped exercises (circuits/supersets) - these have exerciseIndices array
    const groupedExercises = session.renderableItems.filter(
      item => item.blockName && item.blockName.toLowerCase().trim() === blockNameLower && 
      (item.type === 'circuit' || item.type === 'superset' || item.type === 'complex') &&
      item.exerciseIndices && item.exerciseIndices.length > 0
    );
    
    // Count completed individual exercises
    const completedIndividual = individualExercises.filter(item => 
      item.exerciseIndex !== undefined && completed.includes(item.exerciseIndex)
    ).length;
    
    // Total exercises = individual + all exercises within grouped exercises
    const totalIndividual = individualExercises.length;
    const totalGroupedExercises = groupedExercises.reduce((sum, item) => {
      return sum + (item.exerciseIndices?.length || 0);
    }, 0);
    const total = totalIndividual + totalGroupedExercises;
    
    // Completed exercises = completed individual + all exercises in completed groups
    // For grouped exercises, count all exercises in the group only if ALL are completed
    const completedInGroups = groupedExercises.reduce((sum, item) => {
      const exerciseIndices = item.exerciseIndices || [];
      if (exerciseIndices.length === 0) return sum;
      const allCompleted = exerciseIndices.every(idx => completed.includes(idx));
      return sum + (allCompleted ? exerciseIndices.length : 0);
    }, 0);
    const completedCount = completedIndividual + completedInGroups;
    
    return { completed: completedCount, total, percentage: total > 0 ? completedCount / total : 0 };
  }, [session, completed]);

  // Memoized section progress map (for performance)
  const sectionProgressMap = useMemo(() => {
    if (!session) return {};
    const progressMap: Record<string, { completed: number; total: number; percentage: number }> = {};
    
    // Get unique block names from sections
    sections.forEach(section => {
      progressMap[section.blockName] = getSectionProgress(section.blockName);
    });
    
    return progressMap;
  }, [session, completed, sections, getSectionProgress]);

  // Group renderableItems by blockName for collapsible sections
  interface GroupedBlockItem {
    type: 'block-header';
    blockName: string;
    blockIndex: number;
    items: RenderableItem[];
    isExpanded: boolean;
    progress: { completed: number; total: number; percentage: number };
  }
  
  type FlatListItem = GroupedBlockItem | RenderableItem;
  
  const groupedData = useMemo((): FlatListItem[] => {
    if (!session) return [];
    
    // Group items by blockName
    const blockMap = new Map<string, { items: RenderableItem[]; blockIndex: number }>();
    
    session.renderableItems.forEach((item) => {
      const blockName = item.blockName || '';
      if (!blockMap.has(blockName)) {
        blockMap.set(blockName, { items: [], blockIndex: item.blockIndex });
      }
      blockMap.get(blockName)!.items.push(item);
    });
    
    // Convert to array and create flat list with headers
    const result: FlatListItem[] = [];
    const blockNames = Array.from(blockMap.keys());
    
    blockNames.forEach((blockName) => {
      const { items, blockIndex } = blockMap.get(blockName)!;
      const progress = getSectionProgress(blockName);
      const isExpanded = expandedBlocks.has(blockName);
      
      // Add block header
      result.push({
        type: 'block-header',
        blockName,
        blockIndex,
        items,
        isExpanded,
        progress,
      });
      
      // Add items if expanded
      if (isExpanded) {
        result.push(...items);
      }
    });
    
    return result;
  }, [session, expandedBlocks, completed, getSectionProgress]);

  // Initialize expanded blocks: expand first block with incomplete exercises
  useEffect(() => {
    if (!session || expandedBlocks.size > 0) return; // Only initialize once
    
    // Find first block with incomplete exercises
    for (const section of sections) {
      const progress = getSectionProgress(section.blockName);
      if (progress.completed < progress.total) {
        setExpandedBlocks(new Set([section.blockName]));
        break;
      }
    }
  }, [session, sections, getSectionProgress, expandedBlocks]);

  // Helper: Get current section based on first incomplete exercise
  // This should match the block that contains the first incomplete exercise
  const getCurrentSection = (): string => {
    if (!session) return '';
    
    // Find first incomplete exercise
    for (let i = 0; i < session.allExercises.length; i++) {
      if (!completed.includes(i)) {
        // Find which renderable item contains this exercise
        const item = session.renderableItems.find(ri => 
          ri.exerciseIndex === i || 
          (ri.exerciseIndices && ri.exerciseIndices.includes(i))
        );
        if (item?.blockName) {
          // Try to match with a section's blockName to ensure consistency
          const blockNameLower = item.blockName.toLowerCase().trim();
          const matchingSection = sections.find(s => 
            s.blockName.toLowerCase().trim() === blockNameLower
          );
          // Return the section's blockName if found (for consistency), otherwise return the item's blockName
          return matchingSection ? matchingSection.blockName : item.blockName;
        }
      }
    }
    
    // All exercises completed, return last section
    return sections.length > 0 ? sections[sections.length - 1].blockName : '';
  };
  
  // Helper: Get current section with explicit completion state (for use in callbacks)
  const getCurrentSectionWithState = (completedState: number[]): string => {
    if (!session) return '';
    
    // Find first incomplete exercise using provided state
    for (let i = 0; i < session.allExercises.length; i++) {
      if (!completedState.includes(i)) {
        // Find which renderable item contains this exercise
        const item = session.renderableItems.find(ri => 
          ri.exerciseIndex === i || 
          (ri.exerciseIndices && ri.exerciseIndices.includes(i))
        );
        if (item?.blockName) {
          return item.blockName;
        }
      }
    }
    
    // All exercises completed, return last section
    return sections.length > 0 ? sections[sections.length - 1].blockName : '';
  };

  // Helper: Check if section is complete
  const isSectionComplete = (blockName: string): boolean => {
    const progress = sectionProgressMap[blockName] || { completed: 0, total: 0, percentage: 0 };
    return progress.total > 0 && progress.completed === progress.total;
  };

  // Helper: Get next exercise preview
  const getNextExercise = (): { name: string; blockName: string } | null => {
    if (!session) return null;
    for (let i = 0; i < session.allExercises.length; i++) {
      if (!completed.includes(i)) {
        const item = session.renderableItems.find(ri => ri.exerciseIndex === i);
        if (item?.exercise) {
          return { name: item.exercise.name, blockName: item.blockName || '' };
        }
      }
    }
    return null;
  };

  // Update active timer info for sticky bar
  useEffect(() => {
    // Check rest timers
    const restTimerEntries = Object.entries(restTimers);
    if (restTimerEntries.length > 0) {
      const [exerciseIndexStr, timer] = restTimerEntries[0];
      const exerciseIndex = parseInt(exerciseIndexStr, 10);
      if (timer.isRunning && !timer.isPaused) {
        setActiveTimerInfo({
          type: 'rest',
          exerciseIndex,
          remaining: timer.remaining,
          isPaused: false,
        });
        setStickyTimerVisible(true);
        return;
      }
    }
    
    // Check time-based timers
    const timeBasedTimerEntries = Object.entries(timeBasedTimers);
    if (timeBasedTimerEntries.length > 0) {
      const [exerciseIndexStr, timer] = timeBasedTimerEntries[0];
      const exerciseIndex = parseInt(exerciseIndexStr, 10);
      if (timer.isRunning && !timer.isPaused) {
        setActiveTimerInfo({
          type: 'time',
          exerciseIndex,
          remaining: timer.remaining,
          isPaused: false,
        });
        setStickyTimerVisible(true);
        return;
      }
    }
    
    // No active timers
    setStickyTimerVisible(false);
    setActiveTimerInfo(null);
  }, [restTimers, timeBasedTimers]);
  // Smart banner management - show only one banner at a time
  const showBanner = useCallback((message: string, type: 'transition' | 'tip', duration: number = 4000) => {
    // Clear any existing debounce timeout
    if (bannerDebounceTimeoutRef.current) {
      clearTimeout(bannerDebounceTimeoutRef.current);
      bannerDebounceTimeoutRef.current = null;
    }
    
    // Debounce banner changes to prevent rapid hide/show cycles
    bannerDebounceTimeoutRef.current = setTimeout(() => {
      // Clear any existing dismiss timeout
      if (bannerDismissTimeoutRef.current) {
        clearTimeout(bannerDismissTimeoutRef.current);
        bannerDismissTimeoutRef.current = null;
      }
      
      // Hide any existing banners first
      setSectionTransitionBanner({ visible: false, message: '' });
      setContextualTip({ visible: false, message: '' });
      
      // Show with small delay to ensure smooth transition (debouncing prevents rapid changes)
      const delay = 100; // Small delay for smooth hide/show transition
      setTimeout(() => {
        if (type === 'transition') {
          setSectionTransitionBanner({ visible: true, message });
          // Auto-dismiss after specified duration (default 3000ms for transitions)
          bannerDismissTimeoutRef.current = setTimeout(() => {
            setSectionTransitionBanner(prev => ({ ...prev, visible: false }));
            bannerDismissTimeoutRef.current = null;
          }, duration);
        } else {
          setContextualTip({ visible: true, message });
          // Auto-dismiss after specified duration (default 5000ms for tips)
          bannerDismissTimeoutRef.current = setTimeout(() => {
            setContextualTip(prev => ({ ...prev, visible: false }));
            bannerDismissTimeoutRef.current = null;
          }, duration);
        }
      }, delay);
      
      bannerDebounceTimeoutRef.current = null;
    }, 150); // Debounce delay to prevent rapid hide/show cycles
  }, []);

  // Update current section and next exercise when completion changes
  useEffect(() => {
    if (!session) return;
    
    // Use a small delay to ensure state is fully updated, especially for set checkbox completions
    const timeoutId = setTimeout(() => {
      const newCurrentSection = getCurrentSection();
      
      // Use case-insensitive comparison to handle any casing differences
      const currentSectionLower = currentSection.toLowerCase().trim();
      const newCurrentSectionLower = newCurrentSection.toLowerCase().trim();
      
      if (newCurrentSectionLower !== currentSectionLower) {
        setCurrentSection(newCurrentSection);
        
        // Show transition banner if moving to new section (with smart banner management)
        if (currentSection && newCurrentSection && currentSectionLower !== newCurrentSectionLower) {
          const sectionNames: Record<string, string> = {
            'raise': 'Raise',
            'activate': 'Activate',
            'mobilize': 'Mobilize',
            'potentiate': 'Potentiate',
            'warmup': 'Warm-up',
            'mobility': 'Mobility',
            'activation': 'Activation',
            'main': 'Main Exercises',
            'cooldown': 'Cool-down',
          };
          const newType = getSectionType(newCurrentSection);
          const message = sectionNames[newType] || newCurrentSection;
          showBanner(`Moving to ${message}`, 'transition', 3000);
        }
      }
      
      setNextExercisePreview(getNextExercise());
      
      // Update section completions and trigger celebration
      const newCompletions: Record<string, boolean> = {};
      sections.forEach(section => {
        const wasComplete = sectionCompletions[section.blockName] || false;
        const isNowComplete = isSectionComplete(section.blockName);
        newCompletions[section.blockName] = isNowComplete;
        
        // Celebration when section is newly completed
        if (!wasComplete && isNowComplete) {
          triggerHaptic.success();
          // Show celebration message
          Toast.show({
            type: 'success',
            text1: `🎉 ${section.name} Complete!`,
            text2: 'Great work! Keep it up!',
            visibilityTime: 2000,
          });
        }
      });
      setSectionCompletions(newCompletions);
    }, 100); // Small delay to ensure state is updated
    
    return () => clearTimeout(timeoutId);
  }, [completed, session, showBanner, sections, currentSection]);

  // Update contextual tip based on current section (with smart banner management)
  useEffect(() => {
    if (!currentSection) return;
    
    // Check immediately if we should show tip
    const checkAndShowTip = () => {
      // Check current state synchronously
      setSectionTransitionBanner(prev => {
        if (!prev.visible) {
          const sectionType = getSectionType(currentSection);
          const tips: Record<string, string> = {
            'raise': 'Raise core temperature and prepare cardiovascular system for training.',
            'activate': 'Activate key muscle groups. Light work to "wake up" muscles.',
            'mobilize': 'Mobilize joints and improve movement quality. Focus on smooth, controlled movements.',
            'potentiate': 'Potentiate movement patterns. Prepare nervous system for explosive movements.',
            'warmup': 'Take your time in warm-up. Focus on gradually increasing heart rate and mobility.',
            'mobility': 'Focus on smooth, controlled movements through full range of motion.',
            'activation': 'Light activation work to "wake up" muscles. Quality over quantity.',
            'main': 'Main work time! Focus on form and progressive overload.',
            'cooldown': 'Great work! Take time to cool down and recover.',
          };
          const tip = tips[sectionType];
          if (tip) {
            // Show tip immediately if no transition banner
            showBanner(tip, 'tip', 5000);
          }
        } else {
          // Wait for transition banner to finish (3s + small buffer), then show tip
          setTimeout(() => {
            checkAndShowTip();
          }, 3200); // Reduced from 3500ms to 3200ms (3000ms transition + 200ms buffer)
        }
        return prev; // Return unchanged state
      });
    };
    
    // Use a delay (200ms) to ensure state is settled after section change
    const tipTimeout = setTimeout(() => {
      checkAndShowTip();
    }, 200);
    
    return () => clearTimeout(tipTimeout);
  }, [currentSection, sectionTransitionBanner.visible, showBanner]);

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
      const percent = getRepBasedPercent(numericReps);
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

  // Helper: effective set count for current session (readiness-adjusted when applicable)
  const getEffectiveSetCount = (exerciseIndex: number): number => {
    const exercise = session?.allExercises[exerciseIndex];
    if (!exercise) return 0;
    const adjusted = getAdjustedExerciseData(exercise);
    return adjusted.adjustedSets ?? adjusted.sets ?? 0;
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
      percentOf1RM = getRepBasedPercent(numericReps);
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
    
    const loadInfo = getSuggestedLoadInfo(getAdjustedExerciseData(exercise));
    if (!loadInfo) return [];
    
    const numericReps = parseNumericReps(exercise.reps);
    if (!numericReps) return [];
    
    // Use actual working weight (not training max) to ensure warm-ups never exceed working sets
    return getWarmupSetsForTargetReps(numericReps, loadInfo.suggestedWeight);
  };

  // Helper: format reps display
  const formatRepsDisplay = (reps: number | string | undefined): string => {
    if (reps === undefined) return '—';
    return String(reps);
  };

  // Helper: check if exercise is unilateral (done on each side/leg)
  const isUnilateralExercise = (exercise: FlattenedExercise): boolean => {
    const unilateralKeywords = [
      'switch sides',
      'each side',
      'per side',
      'each leg',
      'alternate sides',
      'on each side',
      'both sides',
      'repeat on other',
      'other side',
      'other leg'
    ];
    
    // Check text fields (notes, instruction, formCues)
    const textToCheck = [
      exercise.notes || '',
      exercise.instruction || '',
      Array.isArray((exercise as any).formCues) ? (exercise as any).formCues.join(' ') : ''
    ].join(' ').toLowerCase();
    
    if (unilateralKeywords.some(keyword => textToCheck.includes(keyword))) {
      return true;
    }
    
    // Also check exercise name for unilateral patterns
    const nameLower = exercise.name.toLowerCase();
    const unilateralNamePatterns = [
      'foam roll',
      'stretch',
      'hip flexor',
      'hamstring',
      'quad',
      'glute',
      'calf',
      'pec',
      'shoulder',
      'lat',
      'piriformis',
      'couch stretch',
      'doorway stretch',
      'seated hamstring',
      'standing calf',
      'prone quad',
      'supine hamstring',
      'half-kneeling',
      'sleeper stretch',
      'figure-4',
      'figure four'
    ];
    
    // Check if name matches unilateral patterns AND is in cool-down/stretching/mobility blocks
    const blockNameLower = exercise.blockName?.toLowerCase() || '';
    const isInRelevantBlock = blockNameLower.includes('cool') || 
                              blockNameLower.includes('stretching') || 
                              blockNameLower.includes('mobility');
    
    if (isInRelevantBlock && unilateralNamePatterns.some(pattern => nameLower.includes(pattern))) {
      // Exclude bilateral exercises
      const bilateralPatterns = ['both', 'simultaneous', 'together'];
      if (!bilateralPatterns.some(pattern => textToCheck.includes(pattern))) {
        return true;
      }
    }
    
    return false;
  };

  // Helper: format duration with "per side" for unilateral exercises
  const formatDurationWithPerSide = (exercise: FlattenedExercise): string => {
    if (!exercise.duration) return '';
    
    const duration = exercise.duration;
    const durationLower = duration.toLowerCase();
    
    // Check if duration already includes per side indicators
    if (durationLower.includes('per side') || 
        durationLower.includes('each side') || 
        durationLower.includes('each leg') ||
        durationLower.includes('per leg')) {
      return duration; // Already has it, don't add again
    }
    
    // If unilateral exercise, add "per side"
    if (isUnilateralExercise(exercise)) {
      if (__DEV__ && (exercise.name.includes('Foam Roll') || exercise.name.includes('Couch Stretch'))) {
        console.log(`[formatDurationWithPerSide] Adding "per side" to ${exercise.name} (block: ${exercise.blockName})`);
      }
      return `${duration} per side`;
    }
    
    return duration;
  };

  // Handle challenge selection for volume exercises
  const handleChallengeSelection = async (
    exerciseName: string,
    option: ChallengeOption
  ) => {
    try {
      // Update progression state with selected challenge
      const state = await getProgressionState(exerciseName);
      const exercise = session?.allExercises.find(e => e.name === exerciseName);
      
      const updatedState: ProgressionState = {
        exerciseName,
        currentWeight: state?.currentWeight || 0,
        consecutiveSuccesses: 0, // Reset after applying challenge
        pendingIncrease: false,
        currentRestTime: state?.currentRestTime || exercise?.rest,
        restTimeLevel: state?.restTimeLevel || 0,
        tempoModifications: state?.tempoModifications || [],
      };
      
      if (option.type === 'rest_reduction') {
        updatedState.currentRestTime = option.value as number;
        updatedState.restTimeLevel = (state?.restTimeLevel || 0) + 1;
      } else if (option.type === 'tempo_change') {
        updatedState.tempoModifications = [
          ...(state?.tempoModifications || []),
          option.value as string
        ];
      } else if (option.type === 'weight_increase') {
        updatedState.currentWeight = option.value as number;
        updatedState.pendingIncrease = false;
      }
      
      await saveProgressionState(updatedState);
      
      // Refresh suggestions
      const lastWeight = await getLastWeightFromHistory(exerciseName);
      if (lastWeight && exercise) {
        const category = exercise.exerciseCategory || inferExerciseCategory(exerciseName);
        const suggestion = await applyRuleOf3Progression(
          exerciseName,
          lastWeight,
          category,
          exercise,
          exercise.minIncrement,
          false,
          false,
          undefined,
          readinessScore || undefined
        );
        
        setProgressionSuggestions(prev => ({
          ...prev,
          [exerciseName]: suggestion,
        }));
      }
      
      Toast.show({
        type: 'success',
        text1: '✅ Challenge Applied',
        text2: `${option.description}`,
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Error applying challenge:', error);
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to apply challenge. Please try again.',
        position: 'top',
      });
    }
  };

  // Helper: check if a distance exercise needs weight input (loaded carries)
  const isDistanceExerciseWithWeight = (exercise: FlattenedExercise): boolean => {
    if (exercise.trackingMode !== 'distance') return false;
    const nameLower = exercise.name.toLowerCase();
    const instructionLower = (exercise.instruction || '').toLowerCase();
    const notesLower = (exercise.notes || '').toLowerCase();
    
    // Check name patterns
    if (nameLower.includes('carry') || nameLower.includes('sled') || nameLower.includes('push') || 
        nameLower.includes('weighted') || nameLower.includes('loaded') ||
        nameLower.includes("farmer's walk") || nameLower.includes('farmer walk')) {
      return true;
    }
    
    // Check instruction/notes for weight-related keywords
    if (instructionLower.includes('heavy weight') || instructionLower.includes('hold weight') ||
        instructionLower.includes('carry weight') || instructionLower.includes('loaded') ||
        instructionLower.includes('kbs') || instructionLower.includes('kettlebells') ||
        notesLower.includes('heavy') || notesLower.includes('weight')) {
      return true;
    }
    
    return false;
  };

  // Helper: check if exercise should show set logging inputs (weight/reps)
  const shouldShowSetLogging = (exercise: FlattenedExercise): boolean => {
    // Don't show weight/reps logging for warm-up/cool-down exercises
    if (isWarmupCooldownExercise(exercise)) {
      return false;
    }
    // Allow accessory exercises to show weight/rep fields even if they match bodyweight patterns
    // (e.g., Pull-Ups can be done with added weight - 0 = bodyweight, >0 = added weight)
    const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                 exercise.groupId?.includes('accessory');
    if (isAccessoryExercise && hasSetReps(exercise) && exercise.trackingMode === 'volume') {
      return true; // Accessory exercises with volume tracking should show weight/reps
    }
    // Show weight/reps logging for maxReps exercises with showInSetRounds flag (e.g., Plate Floor Press AMRAP)
    // These exercises need weight (plate weight) and reps (max reps achieved) inputs
    if (exercise.trackingMode === 'maxReps' && exercise.sets && exercise.sets > 0 && exercise.showInSetRounds) {
      // Don't show if it's a bodyweight exercise (unless it has exerciseCategory indicating it needs weight)
      if (isBodyweightExercise(exercise) && !exercise.exerciseCategory) {
        return false;
      }
      return true;
    }
    // Don't show weight/reps logging for bodyweight exercises (check name pattern directly to avoid circular dependency)
    // BUT exclude exercises with exerciseCategory (they can use weight) and accessory exercises from this check
    if (isBodyweightExercise(exercise) && !isAccessoryExercise && !exercise.exerciseCategory) {
      return false;
    }
    // Distance exercises with weight (loaded carries) need weight input
    if (isDistanceExerciseWithWeight(exercise)) {
      return true;
    }
    return isTrackableFor1RM(exercise) || (hasSetReps(exercise) && exercise.trackingMode === 'volume');
  };

  // Helper: Enhanced bodyweight detection (combines name patterns with weight capability)
  const isBodyweightExerciseEnhanced = (exercise: FlattenedExercise): boolean => {
    // Exclude distance exercises - they have their own checkbox logic
    if (exercise.trackingMode === 'distance') {
      return false;
    }
    
    // Exclude exercises with exerciseCategory - they can use weight (compound, assistance, isolation)
    if (exercise.exerciseCategory) {
      return false; // Exercises with category are NOT bodyweight-only
    }
    
    // Exclude accessory exercises - they can use weight (0 = bodyweight, >0 = added weight)
    const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                 exercise.groupId?.includes('accessory');
    if (isAccessoryExercise && hasSetReps(exercise) && exercise.trackingMode === 'volume') {
      return false; // Accessory exercises with volume tracking are NOT bodyweight-only
    }
    
    // Check 1: Name patterns (from isBodyweightExercise function) - primary check
    const matchesNamePattern = isBodyweightExercise(exercise);
    if (matchesNamePattern) {
      return true;
    }
    
    // Check 2: Weight capability - if exercise doesn't show weight input, it's likely bodyweight
    // Check directly without calling shouldShowSetLogging to avoid circular dependency
    const hasWeightInput = isTrackableFor1RM(exercise) || 
                          (hasSetReps(exercise) && exercise.trackingMode === 'volume' && !isDistanceExerciseWithWeight(exercise));
    
    // Return true if no weight input capability (and not warmup/cool-down, which are handled separately)
    return !hasWeightInput && !isWarmupCooldownExercise(exercise);
  };

  // Helper: check if exercise should show set checkboxes (for warm-up/cool-down and bodyweight)
  const shouldShowSetCheckboxes = (exercise: FlattenedExercise): boolean => {
    // Show checkboxes for warm-up/cool-down exercises
    if (isWarmupCooldownExercise(exercise)) {
      // Show checkboxes if exercise has sets
      // For volume-based: must have reps
      // For time-based: must have duration
      // For distance-based: must have distance
      const hasReps = hasSetReps(exercise);
      const hasDuration = isTimeBased(exercise) && exercise.duration;
      const hasDistance = exercise.trackingMode === 'distance' && exercise.distance;
      const hasSets = exercise.sets && exercise.sets > 0;
      
      return !!(hasSets && (hasReps || hasDuration || hasDistance));
    }
    
    // Show checkboxes for time-based exercises with duration that have showInSetRounds flag
    // (e.g., Side Plank in supersets - needs checkboxes and timer in Set Rounds)
    // IMPORTANT: Check this BEFORE bodyweight check to take precedence
    if (isTimeBased(exercise) && exercise.duration && exercise.sets && exercise.sets > 0 && exercise.showInSetRounds) {
      return true;
    }
    
    // Show checkboxes for bodyweight exercises
    if (isBodyweightExerciseEnhanced(exercise)) {
      return !!(hasSetReps(exercise) && exercise.sets && exercise.sets > 0);
    }
    
    // Show checkboxes for distance exercises with sets that don't need weight input
    // (e.g., "Acceleration Buildups" - just checkboxes with distance displayed)
    if (exercise.trackingMode === 'distance' && exercise.sets && exercise.sets > 0 && exercise.distance) {
      // Only show checkboxes if it doesn't need weight input (like sled pushes, weighted carries)
      if (!isDistanceExerciseWithWeight(exercise)) {
        return true;
      }
    }
    
    return false;
  };

  // Helper: get number of sets/rounds to show for an exercise in a circuit
  const getCircuitExerciseRounds = (exercise: FlattenedExercise, item: RenderableItem): number => {
    // If exercise is in a circuit with rounds specified, use that
    if (item.type === 'circuit' && item.rounds && item.rounds > 0) {
      return item.rounds;
    }
    // Otherwise, use effective set count (readiness-adjusted when applicable)
    const adjusted = getAdjustedExerciseData(exercise);
    return adjusted.adjustedSets ?? adjusted.sets ?? 0;
  };

  // Helper: Get all exercises in a block
  const getExercisesInBlock = (blockName: string): RenderableItem[] => {
    if (!session) return [];
    return session.renderableItems.filter(item => 
      item.blockName === blockName && 
      (item.exerciseIndex !== undefined || (item.exerciseIndices && item.exerciseIndices.length > 0))
    );
  };

  // Helper: Get block metadata from block name
  const getBlockFromName = (blockName: string): Block | undefined => {
    if (!session) return undefined;
    return session.blocks.find(block => block.name === blockName);
  };

  // Helper: Check if an exercise has incomplete sets
  const hasIncompleteSets = (exerciseIndex: number, updatedCompletions?: Set<number>): boolean => {
    const effectiveSets = getEffectiveSetCount(exerciseIndex);
    if (effectiveSets === 0) return false;
    // Use provided updated completions if available (for the current exercise), otherwise use state
    const completions = updatedCompletions || setCompletions[exerciseIndex] || new Set<number>();
    return completions.size < effectiveSets;
  };

  // Check if all sets are completed for an exercise
  const areAllSetsCompleted = (exerciseIndex: number): boolean => {
    const effectiveSets = getEffectiveSetCount(exerciseIndex);
    if (effectiveSets === 0) return false;
    const completions = setCompletions[exerciseIndex] || new Set();
    return completions.size === effectiveSets;
  };

  // Check if all sets in a block are completed
  const areAllSetsInBlockCompleted = useCallback((
    blockName: string,
    customSetCompletions?: { [key: number]: Set<number> },
    customCompleted?: number[]
  ): boolean => {
    if (!session) return false;
    
    // Use provided state or fall back to current state
    const setCompletionsToUse = customSetCompletions ?? setCompletions;
    const completedToUse = customCompleted ?? completed;
    
    const blockNameLower = blockName.toLowerCase().trim();
    
    // Get all exercises in this block
    const blockExercises = session.renderableItems.filter(
      item => item.blockName && 
      item.blockName.toLowerCase().trim() === blockNameLower &&
      (item.exerciseIndex !== undefined || (item.exerciseIndices && item.exerciseIndices.length > 0))
    );
    
    // Check each exercise
    for (const item of blockExercises) {
      if (item.exerciseIndex !== undefined) {
        const idx = item.exerciseIndex;
        const effectiveSets = getEffectiveSetCount(idx);
        if (effectiveSets > 0) {
          const completions = setCompletionsToUse[idx] || new Set();
          if (completions.size !== effectiveSets) {
            return false; // Not all sets completed
          }
        } else if (!completedToUse.includes(idx)) {
          return false; // Exercise not marked complete (for exercises without sets)
        }
      } else if (item.exerciseIndices && item.exerciseIndices.length > 0) {
        // For grouped exercises (circuits, supersets)
        for (const idx of item.exerciseIndices) {
          const effectiveSets = getEffectiveSetCount(idx);
          if (effectiveSets > 0) {
            const completions = setCompletionsToUse[idx] || new Set();
            if (completions.size !== effectiveSets) {
              return false;
            }
          } else if (!completedToUse.includes(idx)) {
            return false;
          }
        }
      }
    }
    
    return true; // All sets in block are completed
  }, [session, setCompletions, completed]);

  // Find next incomplete block
  const findNextIncompleteBlock = useCallback((
    currentBlockName: string,
    customSetCompletions?: { [key: number]: Set<number> },
    customCompleted?: number[]
  ): { blockName: string; blockIndex: number } | null => {
    if (!session) return null;
    
    const currentBlockNameLower = currentBlockName.toLowerCase().trim();
    const currentBlockIndex = sections.findIndex(s => 
      s.blockName.toLowerCase().trim() === currentBlockNameLower
    );
    
    if (currentBlockIndex === -1) return null;
    
    // Find next block with incomplete sets
    for (let i = currentBlockIndex + 1; i < sections.length; i++) {
      const nextBlock = sections[i];
      if (!areAllSetsInBlockCompleted(nextBlock.blockName, customSetCompletions, customCompleted)) {
        return { blockName: nextBlock.blockName, blockIndex: i };
      }
    }
    
    return null; // No incomplete blocks found
  }, [session, sections, areAllSetsInBlockCompleted]);

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
        <View style={styles.errorContainer}>
          <Text style={styles.header}>Session not found</Text>
          <Text style={styles.detail}>Session ID: {sessionId}</Text>
          <TouchableOpacity
            style={styles.errorBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorBackButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Check if this is a rest day (no blocks or no exercises)
  if (session.blocks.length === 0 || session.allExercises.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.restDayContainer}>
          <Text style={styles.restDayIcon}>💪</Text>
          <Text style={styles.restDayTitle}>Rest Day</Text>
          <Text style={styles.restDaySubtitle}>
            No session scheduled for today. Take time to recover and recharge.
          </Text>
          <TouchableOpacity
            style={styles.restDayBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.restDayBackButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progress =
    session.allExercises.length ? completed.length / session.allExercises.length : 0;

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

  // Helper: open exercise history modal
  const openHistoryModal = (exerciseName: string) => {
    setHistoryExerciseName(exerciseName);
    setShowHistoryModal(true);
  };

  // Toggle individual set completion
  const toggleSetCompletion = async (exerciseIndex: number, setIndex: number) => {
    // Haptic feedback for set completion
    triggerHaptic.light();
    editGenRef.current += 1;
    
    let exerciseWasJustCompleted = false;
    let wasCompletedBefore = false;
    let updatedSetCompletions: Set<number> | undefined = undefined;
    let updatedSetCompletionsState: { [key: number]: Set<number> } | undefined = undefined;
    
    setSetCompletions((prev) => {
      const current = prev[exerciseIndex] || new Set<number>();
      const updated = new Set(current);
      
      wasCompletedBefore = completed.includes(exerciseIndex);
      
      if (updated.has(setIndex)) {
        updated.delete(setIndex);
      } else {
        updated.add(setIndex);
      }
      
      // Store updated completions for use in intra-block scrolling
      updatedSetCompletions = updated;
      // Store the full updated state for checking other exercises
      updatedSetCompletionsState = { ...prev, [exerciseIndex]: updated };
      
      const newState = { ...prev, [exerciseIndex]: updated };
      
      // If all sets are completed, also mark the exercise as complete
      const effectiveSets = getEffectiveSetCount(exerciseIndex);
      if (effectiveSets > 0 && updated.size === effectiveSets) {
        if (!completed.includes(exerciseIndex)) {
          exerciseWasJustCompleted = true;
          setCompleted((comp) => [...comp, exerciseIndex]);
          setExpandedExercises((prevExp) => ({ ...prevExp, [exerciseIndex]: true }));
        }
      } else {
        // If not all sets complete, remove from completed if it was there
        if (completed.includes(exerciseIndex)) {
          setCompleted((comp) => comp.filter(i => i !== exerciseIndex));
        }
      }
      
      return newState;
    });
    
    // Check if block is now complete and auto-expand next block
    // Wait for state to update, then check block completion
    setTimeout(() => {
      if (!session || !flatListRef.current) return;
      
      const currentRenderableItem = session.renderableItems.find(item => 
        item.exerciseIndex === exerciseIndex || 
        (item.exerciseIndices && item.exerciseIndices.includes(exerciseIndex))
      );
      
      if (!currentRenderableItem?.blockName) return;
      
      // Calculate updated completed state
      const updatedCompleted = exerciseWasJustCompleted
        ? [...completed, exerciseIndex]
        : (wasCompletedBefore ? completed.filter((i) => i !== exerciseIndex) : completed);
      
      // Check if all sets in current block are now completed (using updated state)
      if (areAllSetsInBlockCompleted(
        currentRenderableItem.blockName,
        updatedSetCompletionsState,
        updatedCompleted
      )) {
        if (__DEV__) {
          console.log('[Auto-expand] [Set Checkbox] All sets in block completed:', currentRenderableItem.blockName);
        }
        
        // Find next incomplete block (using updated state)
        const nextBlock = findNextIncompleteBlock(
          currentRenderableItem.blockName,
          updatedSetCompletionsState,
          updatedCompleted
        );
        
        if (nextBlock) {
          if (__DEV__) {
            console.log('[Auto-expand] [Set Checkbox] ✅ Expanding next block:', nextBlock.blockName);
          }
          
          // Expand next block
          setExpandedBlocks(prev => {
            const next = new Set(prev);
            next.add(nextBlock.blockName);
            return next;
          });
        } else {
          if (__DEV__) {
            console.log('[Auto-expand] [Set Checkbox] No next incomplete block found');
          }
        }
      }
    }, SCROLL_CONFIG.DELAY_MS);
  };

  // Helper: check if exercise should show history button
  // Hide for warm-up, cool-down, activation blocks and non-trackable exercises
  // Also check if exercise actually has history data
  const shouldShowHistoryButton = (exercise: FlattenedExercise): boolean => {
    // Check block name for warm-up/cool-down/activation patterns
    const blockName = exercise.blockName?.toLowerCase() || '';
    const nonTrackableBlocks = ['warm-up', 'warm up', 'cool-down', 'cool down', 'cooldown', 'activation', 'mobility', 'stretching', 'breathing', 'recovery'];
    if (nonTrackableBlocks.some(pattern => blockName.includes(pattern))) {
      return false;
    }
    
    // Check if exercise has meaningful tracking (sets/reps or 1RM)
    const hasTracking = isTrackableFor1RM(exercise) || 
      (hasSetReps(exercise) && exercise.trackingMode === 'volume') ||
      (exercise.trackingMode === 'time' && (exercise.sets || 0) > 1);
    
    if (!hasTracking) return false;
    
    // Check if exercise actually has history data (async check will be done when button is pressed)
    // For now, show button if exercise is trackable (history check happens in modal)
    return true;
  };

  // Helper function to determine if icons should be on separate row
  const shouldShowIconsOnSeparateRow = (exerciseName: string, iconCount: number): boolean => {
    // Move to separate row if:
    // - All 3 icons present, OR
    // - Name is long (>40 chars or likely to wrap)
    return iconCount >= 3 || exerciseName.length > 40;
  };

  // Helper: check if exercise should show interval timer (cardio/conditioning with sets)
  const shouldShowIntervalTimer = (exercise: FlattenedExercise): boolean => {
    // Don't show interval timer if exercise should show checkboxes instead
    if (shouldShowSetCheckboxes(exercise)) {
      return false;
    }
    
    // Exclude sprint, shuttle, and acceleration buildup exercises - they are distance-based but performed for speed, not timed
    if (isDistanceSpeedExercise(exercise)) {
      return false;
    }
    
    // Time-based: require explicit duration so we have a work phase to count down
    if (exercise.trackingMode === 'time' && exercise.duration && exercise.sets && exercise.sets > 1 && exercise.rest) {
      return true;
    }
    // Distance-based: only show interval timer when BOTH distance and duration are set (timed work phase + distance description)
    if (exercise.trackingMode === 'distance' && exercise.distance && exercise.duration && exercise.sets && exercise.sets > 1 && exercise.rest) {
      return true;
    }
    return false;
  };

  // Helper: calculate group rest duration for supersets/circuits
  const calculateGroupRestDuration = (item: RenderableItem): number => {
    // Primary: Use restBetweenRounds if explicitly set
    if (item.restBetweenRounds) {
      return item.restBetweenRounds;
    }
    
    // Fallback: Use maximum of individual exercise rest values
    if (item.exercises && item.exercises.length > 0) {
      const restValues = item.exercises
        .map(ex => ex.rest)
        .filter((rest): rest is number => rest !== undefined && rest > 0);
      if (restValues.length > 0) {
        return Math.max(...restValues);
      }
    }
    
    // Default: 60 seconds
    return 60;
  };

  // Helper: determine if individual rest timer should show
  const shouldShowIndividualRestTimer = (exercise: FlattenedExercise, isInGroup: boolean): boolean => {
    if (isWarmupCooldownExercise(exercise)) return false;
    if (isInGroup) return false; // Use group timer instead
    
    // For sprint, shuttle, and acceleration buildup exercises, always show rest timer (if they have multiple sets)
    if (isDistanceSpeedExercise(exercise) && exercise.sets && exercise.sets > 1) {
      return true;
    }
    
    if (!exercise.rest) return false;
    return !shouldShowIntervalTimer(exercise);
  };

  // Helper: determine if rest text should be displayed (Option A: only if timer button shows)
  const shouldShowRestText = (exercise: FlattenedExercise, isInGroup: boolean): boolean => {
    return shouldShowIndividualRestTimer(exercise, isInGroup);
  };

  // Helper: parse duration string to seconds (e.g., "4 min" -> 240, "30s" -> 30, "3-5 min" -> 240, "30 sec each side" -> 60)
  const parseDurationToSeconds = (duration: string | undefined): number => {
    if (!duration) return 60; // default 1 minute
    
    const lower = duration.toLowerCase().trim();
    
    // Check for "each side" and extract multiplier
    const hasEachSide = lower.includes('each side');
    const multiplier = hasEachSide ? 2 : 1;
    const durationWithoutEachSide = lower.replace(/\s*each\s+side\s*/g, '').trim();
    
    // Handle range formats like "3-5 min" or "3-5 minutes" (use maximum)
    const rangeMinMatch = durationWithoutEachSide.match(/^(\d+)\s*-\s*(\d+)\s*min/);
    if (rangeMinMatch) {
      const min = parseInt(rangeMinMatch[1], 10);
      const max = parseInt(rangeMinMatch[2], 10);
      const result = max * 60 * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (range ${min}-${max} min, using max ${max} min, multiplier ${multiplier})`);
      }
      return result;
    }
    
    // Handle single "X min" or "X minutes"
    const minMatch = durationWithoutEachSide.match(/^(\d+)\s*min/);
    if (minMatch) {
      const result = parseInt(minMatch[1], 10) * 60 * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (${minMatch[1]} min, multiplier ${multiplier})`);
      }
      return result;
    }
    
    // Handle range in seconds like "30-60 sec" (use maximum)
    const rangeSecMatch = durationWithoutEachSide.match(/^(\d+)\s*-\s*(\d+)\s*sec/);
    if (rangeSecMatch) {
      const min = parseInt(rangeSecMatch[1], 10);
      const max = parseInt(rangeSecMatch[2], 10);
      const result = max * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (range ${min}-${max} sec, using max ${max} sec, multiplier ${multiplier})`);
      }
      return result;
    }
    
    // Handle "Xs" or "X sec" or "X seconds"
    const secMatch = durationWithoutEachSide.match(/^(\d+)\s*sec/);
    if (secMatch) {
      const result = parseInt(secMatch[1], 10) * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (${secMatch[1]} sec, multiplier ${multiplier})`);
      }
      return result;
    }
    
    // Handle "X:XX" format (MM:SS)
    const timeMatch = durationWithoutEachSide.match(/^(\d+):(\d+)$/);
    if (timeMatch) {
      const result = (parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)) * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (${timeMatch[1]}:${timeMatch[2]}, multiplier ${multiplier})`);
      }
      return result;
    }
    
    // Try to parse as plain number (assume seconds)
    const plainNum = parseInt(durationWithoutEachSide, 10);
    if (!isNaN(plainNum)) {
      const result = plainNum * multiplier;
      if (__DEV__) {
        console.log(`[parseDurationToSeconds] "${duration}" -> ${result}s (plain number, multiplier ${multiplier})`);
      }
      return result;
    }
    
    if (__DEV__) {
      console.warn(`[parseDurationToSeconds] Could not parse "${duration}", using default 60s`);
    }
    return 60; // default
  };

  // Helper: Get exercise summary for compact view
  const getExerciseSummary = (exercise: FlattenedExercise, exerciseIndex: number): string => {
    // For exercises with sets (weight/reps logging)
    if (exercise.sets && !isTimeBased(exercise) && shouldShowSetLogging(exercise)) {
      const logs = setLogs[exerciseIndex] || [];
      const completedSets = setCompletions[exerciseIndex]?.size || 0;
      
      // Calculate average weight from completed sets
      const weightsWithValues = logs
        .map((log, idx) => {
          const weight = parseFloat(log.weight || '0');
          return setCompletions[exerciseIndex]?.has(idx) && weight > 0 ? weight : null;
        })
        .filter((w): w is number => w !== null);
      
      if (weightsWithValues.length > 0) {
        const avgWeight = Math.round(
          weightsWithValues.reduce((sum, w) => sum + w, 0) / weightsWithValues.length
        );
        return `${completedSets} sets @ ${avgWeight} lbs`;
      }
      
      if (completedSets > 0) {
        return `${completedSets} sets completed`;
      }
      
      return `${getEffectiveSetCount(exerciseIndex)} sets`;
    }
    
    // For time-based exercises
    if (isTimeBased(exercise)) {
      return exercise.duration ? `Duration: ${formatDurationWithPerSide(exercise)}` : 'Time-based';
    }
    
    // For exercises with set checkboxes (warm-up/cool-down)
    if (shouldShowSetCheckboxes(exercise)) {
      const completedSets = setCompletions[exerciseIndex]?.size || 0;
      return `${completedSets}/${getEffectiveSetCount(exerciseIndex)} sets completed`;
    }
    
    // Default
    return 'Completed';
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

  // Helper: Render compact timer button with expand functionality
  const renderCompactTimer = (
    timerKey: number,
    timer: { remaining: number; isRunning: boolean; isPaused: boolean } | undefined,
    restDuration: number,
    onStart: () => void,
    onToggle: () => void,
    onStop: () => void,
    onAdjust?: (seconds: number) => void, // Optional - only for rest timers
    label?: string,
    inline?: boolean // New parameter: if true, render as inline badge
  ) => {
    // For inline timers, skip expanded view entirely - always show horizontal button that directly controls timer
    // Ignore expanded state for inline timers to prevent any expansion
    if (inline) {
      const buttonStyle = styles.inlineTimerButton;
      const runningStyle = timer?.isRunning && !timer?.isPaused ? styles.inlineTimerButtonRunning : undefined;
      const pausedStyle = timer?.isPaused ? styles.inlineTimerButtonPaused : undefined;
      // Text color changes based on state
      const buttonTextStyle = [
        styles.inlineTimerButtonText,
        timer?.isRunning && !timer?.isPaused ? styles.inlineTimerButtonTextRunning : undefined,
        timer?.isPaused ? styles.inlineTimerButtonTextPaused : undefined,
      ];
      
      // Determine label based on timer type
      const timerLabel = label || (onAdjust ? 'Rest' : 'Timer');
      
      // If timer doesn't exist, show start button
      if (!timer) {
        const timeText = restDuration < 60 ? `${restDuration}s` : formatTime(restDuration);
        return (
          <TouchableOpacity
            style={[buttonStyle, runningStyle, pausedStyle]}
            onPress={onStart}
          >
            <Text style={buttonTextStyle}>
              Start {timerLabel}: {timeText}
            </Text>
          </TouchableOpacity>
        );
      }
      
      // Timer exists - show running/paused button with direct control
      const displayTime = timer.remaining > 0 ? timer.remaining : restDuration;
      
      // Determine what happens on press based on timer state
      const handlePress = () => {
        if (timer.remaining === 0) {
          // Timer complete - restart
          onStart();
        } else if (timer.isRunning && !timer.isPaused) {
          // Timer running - pause
          onToggle();
        } else if (timer.isPaused) {
          // Timer paused - resume
          onToggle();
        } else {
          // Timer stopped - start
          onStart();
        }
      };
      
      // Determine button text based on state
      let buttonText = '';
      if (timer.remaining === 0) {
        buttonText = `Restart ${timerLabel}: ${restDuration < 60 ? `${restDuration}s` : formatTime(restDuration)}`;
      } else if (timer.isPaused) {
        buttonText = `⏸ ${formatTime(displayTime)} (Paused)`;
      } else if (timer.isRunning) {
        buttonText = `⏱ ${formatTime(displayTime)}`;
      } else {
        const timeText = restDuration < 60 ? `${restDuration}s` : formatTime(restDuration);
        buttonText = `Start ${timerLabel}: ${timeText}`;
      }
      
      return (
        <TouchableOpacity
          style={[buttonStyle, runningStyle, pausedStyle]}
          onPress={handlePress}
        >
          <Text style={buttonTextStyle}>
            {buttonText}
          </Text>
        </TouchableOpacity>
      );
    }
    
    // For non-inline timers, keep expand/collapse behavior
    const isExpanded = expandedTimers[timerKey] || false;
    // If expanded, always show full controls (block style)
    if (isExpanded) {
      // Expanded view logic continues below...
    } else {
      // Collapsed view - block style with horizontal button (same style as inline but not inline)
      const buttonStyle = styles.inlineTimerButton;
      const runningStyle = timer?.isRunning && !timer?.isPaused ? styles.inlineTimerButtonRunning : undefined;
      const pausedStyle = timer?.isPaused ? styles.inlineTimerButtonPaused : undefined;
      const buttonTextStyle = [
        styles.inlineTimerButtonText,
        timer?.isRunning && !timer?.isPaused ? styles.inlineTimerButtonTextRunning : undefined,
        timer?.isPaused ? styles.inlineTimerButtonTextPaused : undefined,
      ];
      
      // Determine label based on timer type
      const timerLabel = label || (onAdjust ? 'Rest' : 'Timer');
      
      // If timer doesn't exist, show start button
      if (!timer) {
        const timeText = restDuration < 60 ? `${restDuration}s` : formatTime(restDuration);
        return (
          <TouchableOpacity
            style={[buttonStyle, runningStyle, pausedStyle]}
            onPress={() => {
              setExpandedTimers(prev => ({ ...prev, [timerKey]: true }));
              onStart();
            }}
          >
            <Text style={buttonTextStyle}>
              Start {timerLabel}: {timeText}
            </Text>
          </TouchableOpacity>
        );
      }
      
      // Timer exists - show running/paused button
      const displayTime = timer.remaining > 0 ? timer.remaining : restDuration;
      
      // Determine button text based on state
      let buttonText = '';
      if (timer.remaining === 0) {
        buttonText = `Restart ${timerLabel}: ${restDuration < 60 ? `${restDuration}s` : formatTime(restDuration)}`;
      } else if (timer.isPaused) {
        buttonText = `⏸ ${formatTime(displayTime)} (Paused)`;
      } else if (timer.isRunning) {
        buttonText = `⏱ ${formatTime(displayTime)}`;
      } else {
        const timeText = restDuration < 60 ? `${restDuration}s` : formatTime(restDuration);
        buttonText = `Start ${timerLabel}: ${timeText}`;
      }
      
      return (
        <TouchableOpacity
          style={[buttonStyle, runningStyle, pausedStyle]}
          onPress={() => setExpandedTimers(prev => ({ ...prev, [timerKey]: true }))}
        >
          <Text style={buttonTextStyle}>
            {buttonText}
          </Text>
        </TouchableOpacity>
      );
    }
    
    // Expanded view - show full timer controls (always block style)
    if (timer && timer.remaining === 0) {
      return (
        <View style={styles.timeBasedTimerContainer}>
          {label && <Text style={styles.timerLabel}>{label}</Text>}
          <Text style={styles.timerCompleteText}>✅ Rest Complete</Text>
          <View style={styles.timerExpandHeader}>
            <TouchableOpacity
              style={styles.collapseTimerButton}
              onPress={() => setExpandedTimers(prev => {
                const updated = { ...prev };
                delete updated[timerKey];
                return updated;
              })}
            >
              <Text style={styles.collapseTimerButtonText}>▼ Collapse</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.startTimerButton}
            onPress={onStart}
          >
            <Text style={styles.startTimerText}>🔄 Restart Timer</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (timer && timer.isRunning) {
      const progress = timer.remaining / restDuration;
      return (
        <View style={styles.timeBasedTimerContainer}>
          {label && <Text style={styles.timerLabel}>{label}</Text>}
          <Text style={styles.timeBasedTimerText}>
            {formatTime(timer.remaining)}
          </Text>
          <View style={styles.timerExpandHeader}>
            <TouchableOpacity
              style={styles.collapseTimerButton}
              onPress={() => setExpandedTimers(prev => {
                const updated = { ...prev };
                delete updated[timerKey];
                return updated;
              })}
            >
              <Text style={styles.collapseTimerButtonText}>▼ Collapse</Text>
            </TouchableOpacity>
          </View>
          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${progress * 100}%`,
                  backgroundColor: THEME.primary,
                }
              ]} 
            />
          </View>
          {/* Quick adjust buttons - only show if onAdjust is provided (rest timers) */}
          {onAdjust && (
            <View style={styles.quickTimerAdjustRow}>
              <TouchableOpacity
                style={styles.quickTimerButton}
                onPress={() => onAdjust(-15)}
              >
                <Text style={styles.quickTimerButtonText}>-15s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTimerButton}
                onPress={() => onAdjust(30)}
              >
                <Text style={styles.quickTimerButtonText}>+30s</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.timerButtonRow}>
            <TouchableOpacity
              style={styles.timerControlButton}
              onPress={onToggle}
            >
              <Text style={styles.timerControlText}>
                {timer.isPaused ? '▶ Resume' : '⏸ Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timerControlButton}
              onPress={onStop}
            >
              <Text style={styles.timerControlText}>⏹ Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else if (!timer && isExpanded) {
      // Expanded but timer not started - show start button with quick options (only for rest timers)
      return (
        <View style={styles.restTimerContainer}>
          <View style={styles.timerExpandHeader}>
            <TouchableOpacity
              style={styles.collapseTimerButton}
              onPress={() => setExpandedTimers(prev => {
                const updated = { ...prev };
                delete updated[timerKey];
                return updated;
              })}
            >
              <Text style={styles.collapseTimerButtonText}>▼ Collapse</Text>
            </TouchableOpacity>
          </View>
          {label && <Text style={styles.timerLabel}>{label}</Text>}
          <TouchableOpacity
            style={styles.startTimerButton}
            onPress={onStart}
          >
            <Text style={styles.startTimerText}>
              ⏱ Start Timer ({restDuration}s)
            </Text>
          </TouchableOpacity>
          {/* Quick rest time buttons - only show for rest timers (when onAdjust is provided) */}
          {onAdjust && (
            <>
              <View style={styles.quickRestButtonsRow}>
                <Text style={styles.quickRestLabel}>Quick:</Text>
                {[30, 60, 90, 120].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.quickRestButton,
                      time === restDuration && styles.quickRestButtonActive,
                    ]}
                    onPress={() => {
                      if (time !== restDuration) {
                        onStart();
                        setTimeout(() => onAdjust(time - restDuration), 100);
                      } else {
                        onStart();
                      }
                    }}
                  >
                    <Text style={[
                      styles.quickRestButtonText,
                      time === restDuration && styles.quickRestButtonTextActive,
                    ]}>
                      {time}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      );
    }
    
    return null;
  };

  // Helper: parse work activity label from exercise name/notes/instruction
  const parseWorkActivity = (exercise: FlattenedExercise): string => {
    const nameLower = exercise.name.toLowerCase();
    const textToSearch = `${exercise.notes || ''} ${exercise.instruction || ''}`.toLowerCase();

    // MAS Intervals - should say "Sprint"
    if (nameLower.includes('mas interval') || nameLower.includes('maximal aerobic')) {
      return 'Sprint';
    }
    
    // Sprint intervals
    if (nameLower.includes('sprint') || textToSearch.includes('sprint')) {
      return 'Sprint';
    }

    // Default to Go
    return 'Go';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
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
              onChangeText={(text) => {
                const validated = validateReadinessInput(text);
                setTempReadinessInput(validated);
              }}
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

      {/* Flow Indicator - Section Navigation (Collapsible) - Sticky at top */}
      {session && (
        <View style={styles.flowIndicatorContainerSticky}>
          <TouchableOpacity
            style={styles.flowIndicatorHeader}
            onPress={() => setFlowIndicatorExpanded(!flowIndicatorExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.flowIndicatorHeaderLeft}>
              {/* Current Section Row */}
              <View style={styles.flowIndicatorCurrentRow}>
                {(() => {
                  // Use case-insensitive matching to find current section
                  const currentSectionLower = currentSection.toLowerCase().trim();
                  const currentSectionData = sections.find(s => 
                    s.blockName.toLowerCase().trim() === currentSectionLower
                  );
                  const sectionIcons: Record<string, string> = {
                    'raise': '🌡️',
                    'activate': '⚡',
                    'mobilize': '🔄',
                    'potentiate': '🚀',
                    'warmup': '🔥',
                    'mobility': '🧘',
                    'activation': '⚡',
                    'main': '💪',
                    'cooldown': '🧊',
                  };
                  const icon = currentSectionData ? sectionIcons[currentSectionData.type] || '•' : '•';
                  
                  // Get progress for current section (use case-insensitive matching)
                  let sectionProgress = { completed: 0, total: 0, percentage: 0 };
                  if (currentSection) {
                    // Try exact match first
                    sectionProgress = sectionProgressMap[currentSection] || { completed: 0, total: 0, percentage: 0 };
                    // If not found, try case-insensitive match
                    if (sectionProgress.total === 0) {
                      const matchingSection = sections.find(s => 
                        s.blockName.toLowerCase().trim() === currentSectionLower
                      );
                      if (matchingSection) {
                        sectionProgress = sectionProgressMap[matchingSection.blockName] || { completed: 0, total: 0, percentage: 0 };
                      }
                    }
                  }
                  
                  return (
                    <>
                      <Text style={styles.flowIndicatorCurrentIcon}>{icon}</Text>
                      <Text style={styles.flowIndicatorCurrentText}>
                        {currentSection ? (() => {
                          const sectionType = getSectionType(currentSection);
                          const sectionNames: Record<string, string> = {
                            'raise': 'Raise',
                            'activate': 'Activate',
                            'mobilize': 'Mobilize',
                            'potentiate': 'Potentiate',
                            'warmup': 'Warm-up',
                            'mobility': 'Mobility',
                            'activation': 'Activation',
                            'main': 'Main Exercises',
                            'cooldown': 'Cool-down',
                          };
                          // Use the actual block name if we found a match, otherwise use the type name
                          return currentSectionData ? currentSectionData.name : (sectionNames[sectionType] || currentSection);
                        })() : 'Starting...'}
                      </Text>
                      {currentSection && sectionProgress.total > 0 && (
                        <Text style={styles.flowIndicatorCurrentProgress}>
                          {sectionProgress.completed}/{sectionProgress.total}
                        </Text>
                      )}
                    </>
                  );
                })()}
              </View>
              
              {/* Next Exercise Preview Row */}
              {nextExercisePreview && (
                <View style={styles.flowIndicatorNextRow}>
                  <Text style={styles.flowIndicatorNextLabel}>Next:</Text>
                  <Text style={styles.flowIndicatorNextName}>{nextExercisePreview.name}</Text>
                </View>
              )}
            </View>
            <Text style={styles.flowIndicatorToggle}>
              {flowIndicatorExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {flowIndicatorExpanded && (
            <Animated.View style={styles.flowIndicatorExpanded}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flowIndicatorScroll}>
                {sections.map((section, index) => {
                  const sectionProgress = sectionProgressMap[section.blockName] || { completed: 0, total: 0, percentage: 0 };
                  // Use case-insensitive comparison for current section
                  const currentSectionLower = currentSection.toLowerCase().trim();
                  const sectionBlockNameLower = section.blockName.toLowerCase().trim();
                  const isCurrent = currentSectionLower === sectionBlockNameLower;
                  const isComplete = sectionCompletions[section.blockName] || false;
                  const sectionIcons: Record<string, string> = {
                    'raise': '🌡️',
                    'activate': '⚡',
                    'mobilize': '🔄',
                    'potentiate': '🚀',
                    'warmup': '🔥',
                    'mobility': '🧘',
                    'activation': '⚡',
                    'main': '💪',
                    'cooldown': '🧊',
                  };
                  const icon = sectionIcons[section.type] || '•';
                  
                  return (
                    <View key={section.blockName} style={styles.flowSectionItem}>
                      <View style={[
                        styles.flowSectionDot,
                        isCurrent && styles.flowSectionDotCurrent,
                        isComplete && styles.flowSectionDotComplete,
                      ]}>
                        <Text style={styles.flowSectionIcon}>{icon}</Text>
                        {isComplete && <Text style={styles.flowSectionCheck}>✓</Text>}
                      </View>
                      <Text style={[
                        styles.flowSectionLabel,
                        isCurrent && styles.flowSectionLabelCurrent,
                        isComplete && styles.flowSectionLabelComplete,
                      ]} numberOfLines={1}>
                        {section.name}
                      </Text>
                      {isCurrent && sectionProgress.total > 0 && (
                        <Text style={styles.flowSectionProgress}>
                          {sectionProgress.completed}/{sectionProgress.total}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      )}

      {/* Smart Banner Management - Show only one banner at a time */}
      {sectionTransitionBanner.visible && (
        <Animated.View style={styles.transitionBanner}>
          <Text style={styles.transitionBannerText}>{sectionTransitionBanner.message}</Text>
        </Animated.View>
      )}
      {!sectionTransitionBanner.visible && contextualTip.visible && (
        <View style={styles.contextualTipContainer}>
          <Text style={styles.contextualTipText}>💡 {contextualTip.message}</Text>
        </View>
      )}


      <FlatList
        ref={flatListRef}
        data={groupedData}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        keyExtractor={(item, index) => {
          if ('type' in item && item.type === 'block-header') {
            return `block-header-${item.blockName}`;
          }
          return item.id || `item-${index}`;
        }}
        ListHeaderComponent={() => (
      <TouchableOpacity 
        style={styles.compactHeader}
        onPress={() => setHeaderExpanded(!headerExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeaderMain}>
          <View style={styles.compactHeaderLeft}>
            <Text style={styles.compactHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
                  {session?.title}
            </Text>
            <Text style={styles.compactHeaderSubtitle}>
                  {session?.durationMinutes} min • W{session?.programWeek || (session?.weekIndex + 1)}D{session?.dayNumber}
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
            {!!session?.sessionIntent && (
              <Text style={styles.readinessBadgeNote}>
                {session.sessionIntent}
              </Text>
            )}
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
        )}
        contentContainerStyle={{ 
          paddingBottom: 20,
          paddingTop: (flowIndicatorExpanded ? 200 : 50) + 10 // Account for sticky flow indicator only
        }}
        onScrollToIndexFailed={(info) => {
          // Handle scroll failure gracefully
          if (__DEV__) {
            console.log('Scroll to index failed:', info);
          }
        }}
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
          // Render block header if this is a block header item
          if ('type' in item && item.type === 'block-header') {
            const blockHeader = item as GroupedBlockItem;
            const sectionType = getSectionType(blockHeader.blockName);
            const sectionIcons: Record<string, string> = {
              'raise': '🌡️',
              'activate': '⚡',
              'mobilize': '🔄',
              'potentiate': '🚀',
              'warmup': '🔥',
              'mobility': '🧘',
              'activation': '⚡',
              'main': '💪',
              'cooldown': '🧊',
            };
            const icon = sectionIcons[sectionType] || '•';
            const { completed, total } = blockHeader.progress;
            const isComplete = total > 0 && completed === total;
            
            return (
              <TouchableOpacity
                style={styles.collapsibleBlockHeader}
                onPress={() => {
                  setExpandedBlocks(prev => {
                    const next = new Set(prev);
                    if (next.has(blockHeader.blockName)) {
                      next.delete(blockHeader.blockName);
                    } else {
                      next.add(blockHeader.blockName);
                    }
                    return next;
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.collapsibleBlockHeaderContent}>
                  <Text style={styles.collapsibleBlockHeaderIcon}>{icon}</Text>
                  <View style={styles.collapsibleBlockHeaderText}>
                    <Text style={styles.collapsibleBlockHeaderName}>{blockHeader.blockName}</Text>
                    {total > 0 && (
                      <Text style={styles.collapsibleBlockHeaderProgress}>
                        {completed}/{total} exercises
                      </Text>
                    )}
                  </View>
                  <Text style={styles.collapsibleBlockHeaderChevron}>
                    {blockHeader.isExpanded ? '▼' : '▶'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
          
          // Render grouped items (circuits/supersets/complexes)
          const renderableItem = item as RenderableItem;
          if (renderableItem.type === 'circuit' || renderableItem.type === 'superset' || renderableItem.type === 'complex') {
            const exercises = renderableItem.exercises || [];
            const exerciseIndices = renderableItem.exerciseIndices || [];
            const allCompleted = exerciseIndices.every((i: number) => completed.includes(i));
            const someCompleted = exerciseIndices.some((i: number) => completed.includes(i));
            const isCircuit = renderableItem.type === 'circuit';
            const isComplex = renderableItem.type === 'complex';
            const restDuration = calculateGroupRestDuration(renderableItem);
            // Use the first exercise index for the group timer
            const groupTimerKey = exerciseIndices[0] ?? itemIndex * 1000;
            
            // Check if this is a warm-up/cool-down sequence
            const blockNameLower = renderableItem.blockName?.toLowerCase() || '';
            const isWarmupSequence = blockNameLower.includes('warm') || 
                                     blockNameLower.includes('cool') || 
                                     blockNameLower.includes('cooldown') ||
                                     blockNameLower === 'raise' ||
                                     blockNameLower === 'activate' ||
                                     blockNameLower === 'mobilize' ||
                                     blockNameLower === 'potentiate' ||
                                     blockNameLower.includes('activation') ||
                                     blockNameLower.includes('mobility') ||
                                     blockNameLower.includes('stretching') ||
                                     blockNameLower.includes('breathing') ||
                                     blockNameLower.includes('recovery');
            
            // Get appropriate header style and icon
            const headerStyle = isWarmupSequence
              ? styles.warmupSequenceHeader
              : isCircuit 
                ? styles.circuitHeader 
                : isComplex 
                  ? styles.complexHeader 
                  : styles.supersetHeader;
            const headerIcon = isWarmupSequence ? '🔥 ' : isCircuit ? '🔄 ' : isComplex ? '🏋️ ' : '⚡ ';
            
            return (
              <View style={[styles.card, styles.groupedCard]}>
                {/* Group header */}
                <View style={[styles.blockHeader, headerStyle]}>
                  <Text style={styles.blockHeaderText}>
                    {headerIcon}{renderableItem.blockName}
                  </Text>
                  {isWarmupSequence && (
                    <Text style={styles.sequenceText}>Perform exercises in sequence</Text>
                  )}
                  {isCircuit && !isWarmupSequence && renderableItem.rounds && (
                    <Text style={styles.roundsText}>{renderableItem.rounds} rounds</Text>
                  )}
                  {!isCircuit && !isWarmupSequence && renderableItem.rounds && (
                    <Text style={styles.roundsText}>{renderableItem.rounds} rounds</Text>
                  )}
                  {isComplex && (
                    <Text style={styles.complexText}>Perform exercises in sequence</Text>
                  )}
                </View>

                {/* Exercise headers - show once at top */}
                {exercises.map((exercise: FlattenedExercise, exIdx: number) => {
                  const globalIndex = exerciseIndices[exIdx];
                  const isExerciseCompleted = completed.includes(globalIndex);
                  const isExpanded = expandedExercises[globalIndex] || false;
                  const adjustedExercise = getAdjustedExerciseData(exercise);
                  const numSets = adjustedExercise.adjustedSets ?? adjustedExercise.sets ?? 0;
                  const hasAdjustment = adjustedExercise.readinessAdjustment && 
                    adjustedExercise.readinessAdjustment.readinessCategory !== 'moderate';
                  
                  // Render compact view for completed exercises (unless expanded)
                  if (isExerciseCompleted && !isExpanded) {
                  return (
                      <View key={`grouped-compact-${exIdx}`} style={styles.groupedExerciseContainer}>
                        <TouchableOpacity
                          style={styles.compactExerciseCard}
                          onPress={() => setExpandedExercises(prev => ({ ...prev, [globalIndex]: true }))}
                          activeOpacity={0.7}
                        >
                          <View style={styles.compactExerciseHeader}>
                            <Text style={styles.compactExerciseCheckmark}>✓</Text>
                            <Text style={styles.compactExerciseName}>{exercise.name}</Text>
                          </View>
                          <Text style={styles.compactExerciseSummary}>
                            {getExerciseSummary(exercise, globalIndex)}
                          </Text>
                          <Text style={styles.compactExerciseHint}>Tap to expand</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  
                  return (
                    <View key={`grouped-header-${exIdx}`} style={styles.groupedExerciseContainer}>
                      <View
                        style={[
                          styles.groupedExercise,
                          isExerciseCompleted && styles.groupedExerciseCompleted,
                        ]}
                      >
                        <View style={styles.groupedExerciseHeader}>
                          <Text style={styles.groupedExerciseNumber}>{exIdx + 1}</Text>
                          <View style={styles.groupedExerciseContent}>
                            {/* Exercise name row with checkbox and icons */}
                            {(() => {
                              const iconCount = [
                                exercise.instruction,
                                (exercise.notes || exercise.definition || isTrackableFor1RM(exercise)),
                                shouldShowHistoryButton(exercise),
                              ].filter(Boolean).length;
                              const showIconsOnSeparateRow = shouldShowIconsOnSeparateRow(exercise.name, iconCount);
                              const isCompleted = completed.includes(globalIndex);
                              
                              return (
                                <>
                                  <View style={styles.exerciseNameRow}>
                                    {/* Checkbox on left */}
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                        toggleComplete(globalIndex);
                                      }}
                                      style={[
                                        styles.exerciseCheckbox,
                                        isCompleted && styles.exerciseCheckboxCompleted,
                                      ]}
                                      accessibilityLabel={isCompleted ? `Mark ${exercise.name} as incomplete` : `Mark ${exercise.name} as complete`}
                                      accessibilityRole="checkbox"
                                      accessibilityState={{ checked: isCompleted }}
                                    >
                                      <Text style={[
                                        styles.exerciseCheckboxText,
                                        isCompleted && styles.exerciseCheckboxTextCompleted,
                                      ]}>
                                        {isCompleted ? '✓' : ''}
                                </Text>
                                    </TouchableOpacity>
                                    
                                    {/* Exercise name */}
                                    <TouchableOpacity
                                      onPress={() => toggleComplete(globalIndex)}
                                      style={{ flex: 1 }}
                                    >
                                      <Text style={[styles.exercise, styles.exerciseWithCheckbox]}>{exercise.name}</Text>
                                    </TouchableOpacity>
                                    
                                    {/* Icons on same row (if not moving to separate row) */}
                                    {!showIconsOnSeparateRow && (
                                      <View style={styles.exerciseActionButtons}>
                                        {hasExpandableContent(exercise) && (
                                          <TouchableOpacity
                                            onPress={(e) => {
                                              e.stopPropagation();
                                              toggleExerciseDetailsAll(globalIndex);
                                            }}
                                            style={[
                                              styles.detailsButton,
                                              isAnyDetailsExpanded(globalIndex) && styles.detailsButtonExpanded
                                            ]}
                                            accessibilityLabel="Show exercise details"
                                            accessibilityRole="button"
                                          >
                                            <Text style={[
                                              styles.detailsButtonText,
                                              isAnyDetailsExpanded(globalIndex) && styles.detailsButtonTextExpanded
                                            ]}>Details</Text>
                              </TouchableOpacity>
                            )}
                                        {shouldShowHistoryButton(exercise) && (
                                          <TouchableOpacity
                                            onPress={(e) => {
                                              e.stopPropagation();
                                              openHistoryModal(exercise.name);
                                            }}
                                            style={styles.historyButtonInline}
                                            accessibilityLabel="View exercise history"
                                            accessibilityRole="button"
                                          >
                                            <Text style={styles.historyButtonInlineText}>🕐</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                  
                                  {/* Icons on separate row (if needed) */}
                                  {showIconsOnSeparateRow && (
                                    <View style={styles.exerciseIconRow}>
                                      {hasExpandableContent(exercise) && (
                                        <TouchableOpacity
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            toggleExerciseDetailsAll(globalIndex);
                                          }}
                                          style={[
                                            styles.detailsButton,
                                            isAnyDetailsExpanded(globalIndex) && styles.detailsButtonExpanded
                                          ]}
                                          accessibilityLabel="Show exercise details"
                                          accessibilityRole="button"
                                        >
                                          <Text style={[
                                            styles.detailsButtonText,
                                            isAnyDetailsExpanded(globalIndex) && styles.detailsButtonTextExpanded
                                          ]}>Details</Text>
                                        </TouchableOpacity>
                                      )}
                                      {shouldShowHistoryButton(exercise) && (
                                        <TouchableOpacity
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            openHistoryModal(exercise.name);
                                          }}
                                          style={styles.historyButtonInline}
                                          accessibilityLabel="View exercise history"
                                          accessibilityRole="button"
                                        >
                                          <Text style={styles.historyButtonInlineText}>🕐</Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  )}
                                </>
                              );
                            })()}
                            
                            {/* Definition box for warm-up/cool-down exercises */}
                            {isExerciseDetailsExpanded(globalIndex) && isWarmupSequence && exercise.definition && (
                              <View style={styles.definitionBox}>
                                <Text style={styles.definitionText}>{exercise.definition}</Text>
                              </View>
                            )}
                            
                            {/* Display based on tracking mode */}
                                {isTimeBased(exercise) ? (
                              <Text style={styles.groupedExerciseDetails}>
                                {exercise.sets && exercise.sets > 1
                                  ? `Sets: ${exercise.sets}, Duration: ${formatDurationWithPerSide(exercise)}` 
                                  : `Duration: ${formatDurationWithPerSide(exercise)}`}
                                {/* Don't show individual rest text for grouped exercises - they use group timer */}
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
                                      {exercise.trackingMode === 'distance' && exercise.distance ? `Distance: ${exercise.distance}` : `Reps: ${formatRepsDisplay(exercise.reps)}`}
                                      {/* Don't show individual rest text for grouped exercises - they use group timer */}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.groupedExerciseDetails}>
                                    {exercise.trackingMode === 'distance' && exercise.distance
                                      ? `Sets: ${numSets}, Distance: ${exercise.distance}`
                                      : exercise.reps !== undefined
                                        ? `Sets: ${numSets}, Reps: ${formatRepsDisplay(exercise.reps)}`
                                        : `Sets: ${numSets}`}
                                    {/* Don't show individual rest text for grouped exercises - they use group timer */}
                                  </Text>
                                )}
                              </>
                            )}
                            
                            {exercise.intensity && <Text style={styles.groupedExerciseDetails}>Intensity: {exercise.intensity}</Text>}
                            {exercise.tempo && <Text style={styles.groupedExerciseDetails}>Tempo: {exercise.tempo}</Text>}
                            {/* Form cues (instruction) - shown when Form icon is toggled */}
                            {formCuesExpanded[globalIndex] && exercise.instruction && (
                              <Text style={styles.groupedExerciseInstruction} numberOfLines={0}>💡 {exercise.instruction}</Text>
                            )}
                            
                            {/* Exercise details (notes, definition, suggestions) - shown when Info icon is toggled */}
                            {isExerciseDetailsExpanded(globalIndex) && (
                              <>
                                {exercise.notes && (
                              <Text style={styles.groupedExerciseNotes}>📝 {exercise.notes}</Text>
                            )}
                            {/* Show target muscles from definition if available */}
                                {isWarmupSequence && exercise.definition && exercise.definition.includes('Targets:') && (
                              <Text style={styles.targetMusclesText}>
                                🎯 {exercise.definition.replace('Targets: ', '')}
                              </Text>
                                )}
                                {exercise.substitutions && exercise.substitutions.length > 0 && (
                                  <View style={styles.substitutionsContainer}>
                                    <Text style={styles.substitutionsLabel}>🔄 Alternatives:</Text>
                                    {exercise.substitutions.map((sub, idx) => (
                                      <Text key={idx} style={styles.substitutionItem}>• {sub}</Text>
                                    ))}
                                  </View>
                                )}
                              </>
                            )}
                            
                            {/* Suggested weight for 1RM-tracked exercises - always shown when available */}
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
                              const displayRPE = adjustedExercise.targetRPE ?? estimatedRPE;
                              
                              return (
                                <View style={styles.suggestionBoxInline}>
                                  <Text style={styles.suggestionTitleSmall}>
                                    Suggested {loadInfo.suggestedWeight} lbs @ RPE {displayRPE}, based on TM ({loadInfo.trainingMax} lbs).
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
                        </View>
                      </View>
                      
                      {/* Warm-up sets for grouped exercises - always shown when available */}
                      {(() => {
                        const warmupSets = getWarmupSets(exercise);
                        return warmupSets.length > 0 ? (
                        <View style={styles.warmupSectionInline}>
                          <Text style={styles.warmupHeaderSmall}>🔥 Warm-ups</Text>
                          {warmupSets.map((warmup, wIndex) => (
                            <Text key={`warmup-${wIndex}`} style={styles.warmupDetailSmall}>
                              {warmup.weight} lbs, Reps: {warmup.reps} ({formatPercentage(warmup.percentage)})
                            </Text>
                          ))}
                        </View>
                        ) : null;
                      })()}
                      
                      {/* Set checkboxes for warm-up/cool-down grouped exercises */}
                      {shouldShowSetCheckboxes(exercise) && numSets > 0 && isWarmupCooldownExercise(exercise) && (
                        <View style={styles.setCheckboxesSectionInline}>
                          <Text style={styles.setCheckboxesHeaderSmall}>
                            Sets: {exercise.sets}, {exercise.trackingMode === 'distance' && exercise.distance ? `Distance: ${exercise.distance}` : isTimeBased(exercise) && exercise.duration ? `Duration: ${formatDurationWithPerSide(exercise)}` : `Reps: ${formatRepsDisplay(exercise.reps)}`}
                          </Text>
                          <View style={styles.setCheckboxesRowInline}>
                            {[...Array(numSets)].map((_, setIndex) => {
                              const isSetCompleted = setCompletions[globalIndex]?.has(setIndex) || false;
                              return (
                                <TouchableOpacity
                                  key={setIndex}
                                  style={[
                                    styles.setCheckboxSmall,
                                    isSetCompleted && styles.setCheckboxCompleted,
                                  ]}
                                  onPress={() => toggleSetCompletion(globalIndex, setIndex)}
                                >
                                  <Text style={[
                                    styles.setCheckboxTextSmall,
                                    isSetCompleted && styles.setCheckboxTextCompleted,
                                  ]}>
                                    {isSetCompleted ? '✓' : '○'} {exercise.name} {setIndex + 1}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}
                      
                      {/* Set checkboxes for circuit exercises (bodyweight and time-based) - show per exercise using circuit rounds */}
                      {/* Exclude exercises with showInSetRounds flag (they display in Set Round sections instead) */}
                      {isCircuit && !isWarmupSequence && !isWarmupCooldownExercise(exercise) && 
                       !exercise.showInSetRounds &&
                       (shouldShowSetCheckboxes(exercise) || (isTimeBased(exercise) && exercise.duration)) && (() => {
                        const circuitRounds = getCircuitExerciseRounds(exercise, item);
                        if (circuitRounds <= 0) return null;
                        
                          return (
                          <View style={styles.setCheckboxesSectionInline}>
                            <Text style={styles.setCheckboxesHeaderSmall}>
                              Sets: {circuitRounds}, {isTimeBased(exercise) && exercise.duration ? `Duration: ${formatDurationWithPerSide(exercise)}` : `Reps: ${formatRepsDisplay(exercise.reps)}`}
                              </Text>
                            <View style={styles.setCheckboxesRowInline}>
                              {[...Array(circuitRounds)].map((_, roundIndex) => {
                                const isSetCompleted = setCompletions[globalIndex]?.has(roundIndex) || false;
                                return (
                                <TouchableOpacity
                                    key={`circuit-${globalIndex}-${roundIndex}`}
                                    style={[
                                      styles.setCheckboxSmall,
                                      isSetCompleted && styles.setCheckboxCompleted,
                                    ]}
                                    onPress={() => toggleSetCompletion(globalIndex, roundIndex)}
                                  >
                                    <Text style={[
                                      styles.setCheckboxTextSmall,
                                      isSetCompleted && styles.setCheckboxTextCompleted,
                                    ]}>
                                      {isSetCompleted ? '✓' : '○'} {roundIndex + 1}
                                  </Text>
                                </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })()}
                      
                      {/* Time-based timer for all grouped exercises with duration */}
                      {isTimeBased(exercise) && exercise.duration && (() => {
                        // Don't show compact timer if IntervalTimer is shown (for interval-based exercises)
                        if (shouldShowIntervalTimer(exercise)) return null;
                        
                        const timer = timeBasedTimers[globalIndex];
                        const durationSeconds = parseDurationToSeconds(exercise.duration);
                        if (durationSeconds <= 0) return null;
                        
                        return renderCompactTimer(
                          globalIndex,
                          timer,
                          durationSeconds,
                          () => startTimeBasedTimer(globalIndex, durationSeconds),
                          () => toggleTimeBasedTimer(globalIndex),
                          async () => {
                                    const timerId = intervalsRef.current.get(globalIndex);
                                    if (timerId) clearInterval(timerId);
                                    intervalsRef.current.delete(globalIndex);
                                    timeBasedEndTimeRef.current.delete(globalIndex);
                                    await playTimerStop();
                                    setTimeBasedTimers((prev) => {
                                      const updated = { ...prev };
                                      delete updated[globalIndex];
                                      return updated;
                                    });
                          },
                          undefined, // No adjust function for time-based timers
                          'Timer',
                          true // inline mode
                        );
                      })()}

                            </View>
                          );
                })}

                {/* Alternating Set Rounds - Show sets in rounds (Set 1 for all exercises, then Set 2, etc.) */}
                {(() => {
                  // For circuits, use the circuit's rounds property instead of exercise.sets
                  let maxSets: number;
                  if (isCircuit && item.rounds && item.rounds > 0) {
                    maxSets = item.rounds;
                        } else {
                    // Calculate max sets across all exercises (needed for single-round complex check)
                    maxSets = Math.max(...exercises.map((exercise: FlattenedExercise, exIdx: number) => {
                      const globalIdx = exerciseIndices[exIdx];
                      const adjustedEx = getAdjustedExerciseData(exercise);
                      return adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                    }));
                  }
                  
                  // For single-round complex groups, skip the "Set Round 1" wrapper
                  const isSingleRoundComplex = maxSets === 1 && isComplex;
                  
                  // Only apply alternating view to exercises with set logging OR set checkboxes (not warm-up sequences)
                  const exercisesWithLogging = exercises.filter((exercise: FlattenedExercise, exIdx: number) => {
                    const globalIdx = exerciseIndices[exIdx];
                    const adjustedEx = getAdjustedExerciseData(exercise);
                    const numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                    // Include exercises that need set logging OR set checkboxes
                    // BUT exclude circuit exercises with checkboxes (they're shown separately per exercise)
                    // ALSO exclude single-round complex groups with checkboxes (they're rendered in the single-round section above)
                    const isCircuitWithCheckboxes = isCircuit && !isWarmupSequence && 
                                                    shouldShowSetCheckboxes(exercise) && 
                                                    !isWarmupCooldownExercise(exercise) &&
                                                    !exercise.showInSetRounds;
                    const isSingleRoundComplexWithCheckboxes = isSingleRoundComplex && 
                                                               shouldShowSetCheckboxes(exercise) && 
                                                               !isWarmupCooldownExercise(exercise);
                    return (shouldShowSetLogging(exercise) || (shouldShowSetCheckboxes(exercise) && !isCircuitWithCheckboxes && !isSingleRoundComplexWithCheckboxes)) && 
                           numSets > 0 && 
                           !isWarmupCooldownExercise(exercise);
                  });
                  
                  // If no exercises need set logging, don't render this section
                  if (exercisesWithLogging.length === 0) return null;
                  
                  return (
                    <View style={styles.supersetSetRoundsContainer}>
                      <View style={styles.workingSetsHeaderRow}>
                        <Text style={styles.workingSetsHeader}>
                          💪 Working Sets (Superset)
                          </Text>
                      </View>
                      
                      {/* Render set rounds */}
                      {isSingleRoundComplex ? (
                        // For single-round complex groups, render exercises directly without round wrapper
                        (() => {
                          const setIndex = 0;
                          return (
                            <View key={`single-round-complex`}>
                              {exercises.map((exercise: FlattenedExercise, exIdx: number) => {
                                const globalIdx = exerciseIndices[exIdx];
                                const adjustedEx = getAdjustedExerciseData(exercise);
                                const numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                                
                                if (setIndex >= numSets) return null;
                                
                                const isCircuitWithCheckboxes = isCircuit && !isWarmupSequence && 
                                                                shouldShowSetCheckboxes(exercise) && 
                                                                !isWarmupCooldownExercise(exercise) &&
                                                                !exercise.showInSetRounds;
                                if ((!shouldShowSetLogging(exercise) && (!shouldShowSetCheckboxes(exercise) || isCircuitWithCheckboxes)) || 
                                    isWarmupCooldownExercise(exercise)) return null;
                                
                                const setState = getSetState(globalIdx, setIndex);
                                if (setState === 'future') {
                                  return renderFutureSetPreview(exercise, globalIdx, setIndex, true);
                                }
                                
                                if (shouldShowSetCheckboxes(exercise) && !isWarmupCooldownExercise(exercise)) {
                                  const isSetCompleted = setCompletions[globalIdx]?.has(setIndex) || false;
                                  let displayValue = '';
                                  if (exercise.trackingMode === 'distance' && exercise.distance) {
                                    displayValue = exercise.distance;
                                  } else if (isTimeBased(exercise) && exercise.duration) {
                                    displayValue = formatDurationWithPerSide(exercise);
                                  } else if (exercise.reps) {
                                    displayValue = formatRepsDisplay(exercise.reps);
                                  }
                                  const checkboxLabel = displayValue 
                                    ? `${exercise.name} Set ${setIndex + 1} (${displayValue})`
                                    : `${exercise.name} Set ${setIndex + 1}`;
                                  
                                  // For time-based exercises, render both checkbox and timer
                                  if (isTimeBased(exercise) && exercise.duration) {
                                    const timerKey = globalIdx; // Use exercise index as timer key
                                    const timer = timeBasedTimers[timerKey];
                                    const durationSeconds = parseDurationToSeconds(exercise.duration);
                                    
                                    return (
                                      <View key={`time-${globalIdx}-${setIndex}`} style={{ marginBottom: 8, width: '100%' }}>
                                        <TouchableOpacity
                                          style={[
                                            styles.setCheckboxSmall,
                                            isSetCompleted && styles.setCheckboxCompleted,
                                          ]}
                                          onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                                        >
                                          <Text style={[
                                            styles.setCheckboxTextSmall,
                                            isSetCompleted && styles.setCheckboxTextCompleted,
                                          ]}>
                                            {isSetCompleted ? '✓' : '○'} {checkboxLabel}
                                          </Text>
                                        </TouchableOpacity>
                                        {durationSeconds > 0 && (
                                          <View style={{ marginTop: 8, marginLeft: 0 }}>
                                            {renderCompactTimer(
                                              timerKey,
                                              timer,
                                              durationSeconds,
                                              () => startTimeBasedTimer(timerKey, durationSeconds),
                                              () => toggleTimeBasedTimer(timerKey),
                                              async () => {
                                                const timerId = intervalsRef.current.get(timerKey);
                                                if (timerId) clearInterval(timerId);
                                                intervalsRef.current.delete(timerKey);
                                                timeBasedEndTimeRef.current.delete(timerKey);
                                                await playTimerStop();
                                                setTimeBasedTimers((prev) => {
                                                  const updated = { ...prev };
                                                  delete updated[timerKey];
                                                  return updated;
                                                });
                                              },
                                              undefined,
                                              'Timer',
                                              true // inline mode
                                            )}
                                          </View>
                                        )}
                                      </View>
                                    );
                                  }
                                  
                                  // For non-time-based exercises, just render checkbox
                                  return (
                                    <TouchableOpacity
                                      key={`bw-${globalIdx}-${setIndex}`}
                                      style={[
                                        styles.setCheckboxSmall,
                                        isSetCompleted && styles.setCheckboxCompleted,
                                      ]}
                                      onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                                    >
                                      <Text style={[
                                        styles.setCheckboxTextSmall,
                                        isSetCompleted && styles.setCheckboxTextCompleted,
                                      ]}>
                                        {isSetCompleted ? '✓' : '○'} {checkboxLabel}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                }
                                
                                // Weight/rep inputs - reuse existing rendering logic
                                const weight = setLogs[globalIdx]?.[setIndex]?.weight || '';
                                const reps = setLogs[globalIdx]?.[setIndex]?.reps || '';
                                const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                                             exercise.groupId?.includes('accessory');
                                const weightNum = weight ? parseFloat(weight) : NaN;
                                const isWeightValid = weight && validateWeightInput(weight) && 
                                                      (!isNaN(weightNum) && (isAccessoryExercise ? weightNum >= 0 : weightNum > 0));
                                const isRepsValid = reps && validateRepsInput(reps);
                                const isSetComplete = setCompletions[globalIdx]?.has(setIndex) || false;
                                const allSetsForExerciseComplete = [...Array(numSets)].every((_, idx) => 
                                  setCompletions[globalIdx]?.has(idx)
                                );
                                const currentSetIndex = [...Array(numSets)].findIndex((_, idx) => 
                                  !setCompletions[globalIdx]?.has(idx)
                                );
                                const isCurrentSet = currentSetIndex !== -1 && setIndex === currentSetIndex;
                                const hasData = (weight && weight.trim() !== '') || (reps && reps.trim() !== '');
                                const setKeySuperset = `${globalIdx}-${setIndex}`;
                                const isExpandedSuperset = expandedSets[setKeySuperset] || false;
                                
                                if ((allSetsForExerciseComplete || (!isCurrentSet && (isSetComplete || hasData))) && !isExpandedSuperset) {
                                  return (
                                    <TouchableOpacity
                                      key={`compact-${globalIdx}-${setIndex}`}
                                      style={styles.compactSetRow}
                                      onPress={() => {
                                        setExpandedSets(prev => ({
                                          ...prev,
                                          [setKeySuperset]: true,
                                        }));
                                      }}
                                    accessibilityLabel={`Edit ${exercise.name} Set ${setIndex + 1}`}
                                    accessibilityRole="button"
                                  >
                                    <Text style={styles.compactSetLabel}>{exercise.name} - Set {setIndex + 1}:</Text>
                                    <Text style={styles.compactSetValue}>
                                      {weight && weight.trim() ? `${weight} lbs` : '-'}
                                      {exercise.trackingMode === 'distance' && exercise.distance ? `, Distance: ${exercise.distance}` : (reps && reps.trim() ? `, Reps: ${reps}` : '')}
                          </Text>
                                    {isSetComplete && <Text style={styles.compactSetComplete}>✓</Text>}
                                      {setNotes[setKeySuperset] && setNotes[setKeySuperset].trim() && (
                                        <Text style={styles.compactSetNote}>
                                          📝 {setNotes[setKeySuperset]}
                                        </Text>
                                      )}
                                      <Text style={styles.compactSetEditHint}>Tap to edit</Text>
                                    </TouchableOpacity>
                                  );
                                }
                                
                                const loadInfo = isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedEx) : null;
                                const suggestedWeight = loadInfo?.suggestedWeight ?? progressionSuggestions[exercise.name]?.suggestedWeight;
                                
                                return (
                                  <View key={`set-${globalIdx}-${setIndex}`} style={styles.supersetSetContainer}>
                                    <View style={styles.supersetSetHeader}>
                                      <Text style={styles.supersetSetLabel}>
                                        {exercise.name} - Set {setIndex + 1}
                                      </Text>
                                      <View style={styles.setHeaderActions}>
                                        {isExpandedSuperset && (
                                          <TouchableOpacity
                                            style={styles.collapseButton}
                                            onPress={() => {
                                              setExpandedSets(prev => {
                                                const updated = { ...prev };
                                                delete updated[setKeySuperset];
                                                return updated;
                                              });
                                            }}
                                          >
                                            <Text style={styles.collapseButtonText}>▼ Collapse</Text>
                                          </TouchableOpacity>
                                        )}
                                        {isSetComplete && (
                                          <Text style={styles.setCompleteBadge}>✓</Text>
                                        )}
                                      </View>
                                    </View>
                                    <View style={styles.inputGroup}>
                                      <Text style={styles.inputLabel}>Weight (lbs)</Text>
                                      <View style={styles.inputWithButtons}>
                                        <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'weight', -5)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>-5</Text>
                                        </TouchableOpacity>
                              <TextInput
                                          style={[
                                            styles.enhancedInput,
                                            isWeightValid && styles.inputValid,
                                          ]}
                                          placeholder="Weight"
                                keyboardType="numeric"
                                          value={weight}
                                          onChangeText={(text) => updateSetLog(globalIdx, setIndex, 'weight', text)}
                                          accessibilityLabel={`Weight for ${exercise.name} set ${setIndex + 1}`}
                                        />
                                        <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'weight', 5)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>+5</Text>
                                        </TouchableOpacity>
                                      </View>
                                      {suggestedWeight && !weight && (
                                        <TouchableOpacity
                                          style={styles.useSuggestedButton}
                                          onPress={() => {
                                            updateSetLog(globalIdx, setIndex, 'weight', suggestedWeight.toString());
                                          }}
                                        >
                                          <Text style={styles.useSuggestedButtonText}>
                                            Use Suggested: {suggestedWeight} lbs
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                      {suggestedWeight && setIndex === 0 && (() => {
                                        const hasIncomplete = [...Array(numSets)].some((_, idx) => !(setLogs[globalIdx]?.[idx]?.weight?.trim() || ''));
                                        return hasIncomplete ? (
                                          <TouchableOpacity
                                            style={styles.completeAllSuggestedButton}
                                            onPress={() => handleCompleteAllSetsAtSuggested(globalIdx, suggestedWeight)}
                                          >
                                            <Text style={styles.completeAllSuggestedButtonText}>Complete all at suggested</Text>
                                          </TouchableOpacity>
                                        ) : null;
                                      })()}
                                    </View>
                                    <View style={styles.inputGroup}>
                                      <Text style={styles.inputLabel}>Reps</Text>
                                      <View style={styles.inputWithButtons}>
                                        <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'reps', -1)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>-1</Text>
                                        </TouchableOpacity>
                              <TextInput
                                          style={[
                                            styles.enhancedInput,
                                            isRepsValid && styles.inputValid,
                                          ]}
                                          placeholder="Reps"
                                keyboardType="numeric"
                                          value={reps}
                                          onChangeText={(text) => updateSetLog(globalIdx, setIndex, 'reps', text)}
                                          accessibilityLabel={`Reps for ${exercise.name} set ${setIndex + 1}`}
                                        />
                                        <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'reps', 1)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>+1</Text>
                                        </TouchableOpacity>
                            </View>
                        </View>
                                    <View style={styles.quickNoteContainer}>
                                      <TextInput
                                        style={styles.quickNoteInput}
                                        placeholder="Quick note (e.g., 'felt heavy', 'form good')"
                                        value={setNotes[setKeySuperset] || ''}
                                        onChangeText={(text) => updateSetNote(setKeySuperset, text)}
                                        multiline
                                        maxLength={100}
                                      />
                                    </View>
                                    {isWeightValid && isRepsValid && !isSetComplete && (
                        <TouchableOpacity 
                                        style={styles.setCompleteButton}
                                        onPress={() => handleSetComplete(globalIdx, setIndex)}
                        >
                                        <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                              {/* Timer for single round */}
                              {!isWarmupSequence && (() => {
                                const roundComplete = isRoundComplete(renderableItem, 0);
                                const groupRounds = completedRounds[groupTimerKey] || new Set<number>();
                                const roundCompleted = groupRounds.has(0);
                                const shouldShowTimer = roundComplete || roundCompleted || true;
                                if (!shouldShowTimer) return null;
                                const timer = restTimers[groupTimerKey];
                                return renderCompactTimer(
                                  groupTimerKey,
                                  timer,
                                  restDuration,
                                  () => startRest(groupTimerKey, restDuration),
                                  () => toggleRestTimer(groupTimerKey),
                                  () => stopRestTimer(groupTimerKey),
                                  (seconds) => adjustRestTimer(groupTimerKey, seconds),
                                  'Rest Timer'
                                );
                              })()}
                            </View>
                          );
                        })()
                      ) : (
                        // Existing round-based rendering for multiple rounds
                        [...Array(maxSets)].map((_, setIndex: number) => {
                        // Determine round state
                        const roundState = getRoundState(item, setIndex);
                        
                        // Find the current round index (first incomplete round)
                        const currentRoundIndex = (() => {
                          if (!item.exerciseIndices || item.exerciseIndices.length === 0) return -1;
                          const maxSets = Math.max(...item.exerciseIndices.map((idx: number) => getEffectiveSetCount(idx)));
                          for (let i = 0; i < maxSets; i++) {
                            if (!isRoundComplete(item, i)) {
                              return i;
                            }
                          }
                          return -1; // All rounds complete
                        })();
                        
                        // For future rounds: always show the next round (currentRound + 1) in preview
                        // For rounds beyond that, only show if at least one exercise's prior set is complete
                        if (roundState === 'future') {
                          const isNextRound = currentRoundIndex !== -1 && setIndex === currentRoundIndex + 1;
                          
                          if (isNextRound) {
                            // Always show the immediate next round in preview form
                            // (no need to check shouldShowFutureSet for the next round)
                        } else {
                            // For rounds beyond the next one, check if any exercise should show it
                            const shouldShow = exercises.some((exercise: FlattenedExercise, exIdx: number) => {
                              const globalIdx = exerciseIndices[exIdx];
                              const adjustedEx = getAdjustedExerciseData(exercise);
                              const numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                              if (setIndex >= numSets) return false;
                              return shouldShowFutureSet(globalIdx, setIndex);
                            });
                            if (!shouldShow) return null;
                          }
                        }
                        
                        // Check if this set round has any visible sets
                        const hasVisibleSets = exercises.some((exercise: FlattenedExercise, exIdx: number) => {
                          const globalIdx = exerciseIndices[exIdx];
                          const adjustedEx = getAdjustedExerciseData(exercise);
                          // For circuits, check against circuit rounds, not exercise sets
                          let numSets: number;
                          if (isCircuit && item.rounds && item.rounds > 0) {
                            numSets = item.rounds;
                          } else {
                            numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                          }
                          if (setIndex >= numSets) return false;
                          // Exclude circuit exercises with checkboxes (they're shown separately per exercise)
                          const isCircuitWithCheckboxes = isCircuit && !isWarmupSequence && 
                                                          shouldShowSetCheckboxes(exercise) && 
                                                          !isWarmupCooldownExercise(exercise) &&
                                                          !exercise.showInSetRounds;
                          return !(((!shouldShowSetLogging(exercise) && (!shouldShowSetCheckboxes(exercise) || isCircuitWithCheckboxes)) || isWarmupCooldownExercise(exercise)));
                        });
                        
                        // Always show the immediate next round preview, even if hasVisibleSets is false initially
                        const isNextRound = currentRoundIndex !== -1 && setIndex === currentRoundIndex + 1;
                        if (!hasVisibleSets && !isNextRound) return null;
                        
                        return (
                          <View key={`set-round-${setIndex}`} style={styles.setRoundContainer}>
                            {/* Set round header - skip for single-round complex groups */}
                            {!isSingleRoundComplex && (
                              <View style={styles.setRoundHeader}>
                                <Text style={styles.setRoundLabel}>
                                  Set Round {setIndex + 1}
                                  {roundState === 'future' && ' (Preview)'}
                  </Text>
                </View>
                            )}
                            
                            {/* Render this set for all exercises */}
                            {exercises.map((exercise: FlattenedExercise, exIdx: number) => {
                              const globalIdx = exerciseIndices[exIdx];
                              const adjustedEx = getAdjustedExerciseData(exercise);
                              // For circuits, check against circuit rounds, not exercise sets
                              let numSets: number;
                              if (isCircuit && item.rounds && item.rounds > 0) {
                                numSets = item.rounds;
                              } else {
                                numSets = adjustedEx.adjustedSets ?? adjustedEx.sets ?? 0;
                              }
                              
                              // Skip if this exercise doesn't have this set number
                              if (setIndex >= numSets) return null;
                              
                              // Skip if this exercise doesn't need set logging OR set checkboxes
                              // BUT exclude circuit exercises with checkboxes (they're shown separately per exercise)
                              const isCircuitWithCheckboxes = isCircuit && !isWarmupSequence && 
                                                              shouldShowSetCheckboxes(exercise) && 
                                                              !isWarmupCooldownExercise(exercise) &&
                                                              !exercise.showInSetRounds;
                              if ((!shouldShowSetLogging(exercise) && (!shouldShowSetCheckboxes(exercise) || isCircuitWithCheckboxes)) || 
                                  isWarmupCooldownExercise(exercise)) return null;
                              
                              // Determine set state
                              const setState = getSetState(globalIdx, setIndex);
                              
                              // For future sets: always show if it's the next round, otherwise check per-exercise progression
                              if (setState === 'future') {
                                const isNextRound = currentRoundIndex !== -1 && setIndex === currentRoundIndex + 1;
                                
                                if (isNextRound) {
                                  // Always show all exercises in the next round in preview form
                                  return renderFutureSetPreview(exercise, globalIdx, setIndex, true);
                                } else {
                                  // For rounds beyond the next one, check per-exercise progression
                                  if (!shouldShowFutureSet(globalIdx, setIndex)) {
                                    return null;
                                  }
                                  // Show future set preview (expandable)
                                  return renderFutureSetPreview(exercise, globalIdx, setIndex, true);
                                }
                              }
                              
                              // If bodyweight exercise, show checkbox instead of weight/rep inputs
                              if (shouldShowSetCheckboxes(exercise) && !isWarmupCooldownExercise(exercise)) {
                                // Render checkbox for this set
                                const isSetCompleted = setCompletions[globalIdx]?.has(setIndex) || false;
                                let displayValue = '';
                                if (exercise.trackingMode === 'distance' && exercise.distance) {
                                  displayValue = exercise.distance;
                                } else if (isTimeBased(exercise) && exercise.duration) {
                                  displayValue = formatDurationWithPerSide(exercise);
                                } else if (exercise.reps) {
                                  displayValue = formatRepsDisplay(exercise.reps);
                                }
                                const checkboxLabel = displayValue 
                                  ? `${exercise.name} Set ${setIndex + 1} (${displayValue})`
                                  : `${exercise.name} Set ${setIndex + 1}`;
                                
                                // For time-based exercises, render both checkbox and timer
                                if (isTimeBased(exercise) && exercise.duration) {
                                  const timerKey = globalIdx; // Use exercise index as timer key
                                  const timer = timeBasedTimers[timerKey];
                                  const durationSeconds = parseDurationToSeconds(exercise.duration);
                                  
                                  return (
                                    <View key={`time-${globalIdx}-${setIndex}`} style={{ marginBottom: 8, width: '100%' }}>
                                      <TouchableOpacity
                                        style={[
                                          styles.setCheckboxSmall,
                                          isSetCompleted && styles.setCheckboxCompleted,
                                        ]}
                                        onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                                      >
                                        <Text style={[
                                          styles.setCheckboxTextSmall,
                                          isSetCompleted && styles.setCheckboxTextCompleted,
                                        ]}>
                                          {isSetCompleted ? '✓' : '○'} {checkboxLabel}
                                        </Text>
                                      </TouchableOpacity>
                                      {durationSeconds > 0 && (
                                        <View style={{ marginTop: 8, marginLeft: 0 }}>
                                          {renderCompactTimer(
                                            timerKey,
                                            timer,
                                            durationSeconds,
                                            () => startTimeBasedTimer(timerKey, durationSeconds),
                                            () => toggleTimeBasedTimer(timerKey),
                                            async () => {
                                              const timerId = intervalsRef.current.get(timerKey);
                                              if (timerId) clearInterval(timerId);
                                              intervalsRef.current.delete(timerKey);
                                              timeBasedEndTimeRef.current.delete(timerKey);
                                              await playTimerStop();
                                              setTimeBasedTimers((prev) => {
                                                const updated = { ...prev };
                                                delete updated[timerKey];
                                                return updated;
                                              });
                                            },
                                            undefined,
                                            'Timer',
                                            true // inline mode
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  );
                                }
                                
                                // For non-time-based exercises, just render checkbox
                                return (
                                  <TouchableOpacity
                                    key={`bw-${globalIdx}-${setIndex}`}
                                    style={[
                                      styles.setCheckboxSmall,
                                      isSetCompleted && styles.setCheckboxCompleted,
                                    ]}
                                    onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                                  >
                                    <Text style={[
                                      styles.setCheckboxTextSmall,
                                      isSetCompleted && styles.setCheckboxTextCompleted,
                                    ]}>
                                      {isSetCompleted ? '✓' : '○'} {checkboxLabel}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              }
                              
                              // Otherwise, show weight/rep inputs (existing logic)
                              const isDistanceExercise = exercise.trackingMode === 'distance';
                              const needsWeightInput = isDistanceExerciseWithWeight(exercise);
                              const distanceValue = exercise.distance || '';
                              const weight = setLogs[globalIdx]?.[setIndex]?.weight || '';
                              const reps = setLogs[globalIdx]?.[setIndex]?.reps || '';
                              // For accessory exercises, allow 0 as valid weight (0 = bodyweight)
                              const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                                           exercise.groupId?.includes('accessory');
                              const weightNum = weight ? parseFloat(weight) : NaN;
                              const isWeightValid = weight && validateWeightInput(weight) && 
                                                    (!isNaN(weightNum) && (isAccessoryExercise ? weightNum >= 0 : weightNum > 0));
                              const isRepsValid = reps && validateRepsInput(reps);
                              const isSetComplete = setCompletions[globalIdx]?.has(setIndex) || false;
                              
                              // Check if all sets for this exercise are complete
                              const allSetsForExerciseComplete = [...Array(numSets)].every((_, idx) => 
                                setCompletions[globalIdx]?.has(idx)
                              );
                              
                              // Show as compact row if:
                              // 1. All sets for this exercise are complete, OR
                              // 2. This set is complete/has data and is not the current set (and not explicitly expanded)
                              const currentSetIndex = [...Array(numSets)].findIndex((_, idx) => 
                                !setCompletions[globalIdx]?.has(idx)
                              );
                              const isCurrentSet = currentSetIndex !== -1 && setIndex === currentSetIndex;
                              const hasData = (weight && weight.trim() !== '') || (reps && reps.trim() !== '');
                              const setKeySuperset = `${globalIdx}-${setIndex}`;
                              const isExpandedSuperset = expandedSets[setKeySuperset] || false;
                              
                              // Show as compact if:
                              // - All sets complete for this exercise, OR
                              // - This set is complete/has data and not current, AND not explicitly expanded
                              if ((allSetsForExerciseComplete || (!isCurrentSet && (isSetComplete || hasData))) && !isExpandedSuperset) {
                                // Show as compact tappable row
                    return (
                                  <TouchableOpacity
                                    key={`compact-${globalIdx}-${setIndex}`}
                                    style={styles.compactSetRow}
                                    onPress={() => {
                                      // Expand this set for editing
                                      setExpandedSets(prev => ({
                                        ...prev,
                                        [setKeySuperset]: true,
                                      }));
                                    }}
                                    accessibilityLabel={`Edit ${exercise.name} Set ${setIndex + 1}`}
                                    accessibilityRole="button"
                                  >
                                    {(() => {
                                      // Build exercise name with rep/distance info
                                      let exerciseLabel = exercise.name;
                                      if (exercise.trackingMode === 'distance' && exercise.distance) {
                                        exerciseLabel = `${exercise.name} (${exercise.distance})`;
                                      } else if (exercise.reps) {
                                        exerciseLabel = `${exercise.name} (${formatRepsDisplay(exercise.reps)})`;
                                      }
                                      return <Text style={styles.compactSetLabel}>{exerciseLabel} - Set {setIndex + 1}:</Text>;
                                    })()}
                                    <Text style={styles.compactSetValue}>
                                      {weight && weight.trim() ? `${weight} lbs` : '-'}
                                      {exercise.trackingMode === 'distance' && exercise.distance ? `, Distance: ${exercise.distance}` : (reps && reps.trim() ? `, Reps: ${reps}` : '')}
                        </Text>
                                    {isSetComplete && <Text style={styles.compactSetComplete}>✓</Text>}
                                    {setNotes[setKeySuperset] && setNotes[setKeySuperset].trim() && (
                                      <Text style={styles.compactSetNote}>
                                        📝 {setNotes[setKeySuperset]}
                                      </Text>
                                    )}
                                    <Text style={styles.compactSetEditHint}>Tap to edit</Text>
                                  </TouchableOpacity>
                                );
                              }
                              
                              // Show full input for current set or expanded set
                              const loadInfo = isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedEx) : null;
                              const suggestedWeight = loadInfo?.suggestedWeight ?? progressionSuggestions[exercise.name]?.suggestedWeight;
                              
                              return (
                                <View key={`set-${globalIdx}-${setIndex}`} style={styles.supersetSetContainer}>
                                  <View style={styles.supersetSetHeader}>
                                    <Text style={styles.supersetSetLabel}>
                                      {(() => {
                                        // Build exercise name with rep/distance info
                                        let exerciseLabel = exercise.name;
                                        if (exercise.trackingMode === 'distance' && exercise.distance) {
                                          exerciseLabel = `${exercise.name} (${exercise.distance})`;
                                        } else if (exercise.reps) {
                                          const formatRepsDisplay = (reps: string | number): string => {
                                            if (typeof reps === 'number') return reps.toString();
                                            return reps;
                                          };
                                          exerciseLabel = `${exercise.name} (${formatRepsDisplay(exercise.reps)})`;
                                        }
                                        return `${exerciseLabel} - Set ${setIndex + 1}`;
                                      })()}
                                    </Text>
                                    <View style={styles.setHeaderActions}>
                                      {setIndex > 0 && (
                        <TouchableOpacity 
                                          style={styles.copyButton}
                                          onPress={() => copyFromPreviousSet(globalIdx, setIndex)}
                        >
                                          <Text style={styles.copyButtonText}>📋 Copy</Text>
                        </TouchableOpacity>
                      )}
                                      {isExpandedSuperset && (
                                        <TouchableOpacity
                                          style={styles.collapseButton}
                                          onPress={() => {
                                            // Collapse this set back to compact view
                                            setExpandedSets(prev => {
                                              const updated = { ...prev };
                                              delete updated[setKeySuperset];
                                              return updated;
                                            });
                                          }}
                                        >
                                          <Text style={styles.collapseButtonText}>▼ Collapse</Text>
                                        </TouchableOpacity>
                                      )}
                                      {isSetComplete && (
                                        <Text style={styles.setCompleteBadge}>✓</Text>
                                      )}
                    </View>
                </View>

                                  <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Weight (lbs)</Text>
                                    <View style={styles.inputWithButtons}>
                        <TouchableOpacity
                                        style={styles.quickAdjustButton}
                                        onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'weight', -5)}
                        >
                                        <Text style={styles.quickAdjustButtonText}>-5</Text>
                        </TouchableOpacity>
                              <TextInput
                            style={[
                                          styles.enhancedInput,
                                          isWeightValid && styles.inputValid,
                                        ]}
                                        placeholder="Weight"
                                keyboardType="numeric"
                                        value={weight}
                                        onChangeText={(text) => updateSetLog(globalIdx, setIndex, 'weight', text)}
                                        accessibilityLabel={`Weight for ${exercise.name} set ${setIndex + 1}`}
                                      />
                                      <TouchableOpacity
                                        style={styles.quickAdjustButton}
                                        onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'weight', 5)}
                                      >
                                        <Text style={styles.quickAdjustButtonText}>+5</Text>
                                      </TouchableOpacity>
                        </View>
                                    {suggestedWeight && !weight && (
                          <TouchableOpacity
                                        style={styles.useSuggestedButton}
                                        onPress={() => {
                                          updateSetLog(globalIdx, setIndex, 'weight', suggestedWeight.toString());
                                        }}
                                      >
                                        <Text style={styles.useSuggestedButtonText}>
                                          Use Suggested: {suggestedWeight} lbs
                                        </Text>
                          </TouchableOpacity>
                                    )}
                                    {suggestedWeight && setIndex === 0 && (() => {
                                      const hasIncomplete = [...Array(numSets)].some((_, idx) => !(setLogs[globalIdx]?.[idx]?.weight?.trim() || ''));
                                      return hasIncomplete ? (
                                        <TouchableOpacity
                                          style={styles.completeAllSuggestedButton}
                                          onPress={() => handleCompleteAllSetsAtSuggested(globalIdx, suggestedWeight)}
                                        >
                                          <Text style={styles.completeAllSuggestedButtonText}>Complete all at suggested</Text>
                                        </TouchableOpacity>
                                      ) : null;
                                    })()}
                                  </View>
                                  
                                  {/* Distance Display - Show for distance exercises (read-only) */}
                                  {isDistanceExercise && distanceValue && (
                                    <View style={styles.inputGroup}>
                                      <Text style={styles.inputLabel}>Distance</Text>
                                      <View style={[styles.enhancedInput, { backgroundColor: THEME.background, justifyContent: 'center' }]}>
                                        <Text style={styles.distanceDisplayText}>{distanceValue}</Text>
                                      </View>
                                    </View>
                                  )}
                                  
                                  {/* Reps Input - Show only for non-distance exercises */}
                                  {!isDistanceExercise && (
                                    <View style={styles.inputGroup}>
                                      <Text style={styles.inputLabel}>Reps</Text>
                                      <View style={styles.inputWithButtons}>
                          <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'reps', -1)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>-1</Text>
                                        </TouchableOpacity>
                                <TextInput
                                          style={[
                                            styles.enhancedInput,
                                            isRepsValid && styles.inputValid,
                                          ]}
                                          placeholder="Reps"
                                  keyboardType="numeric"
                                          value={reps}
                                          onChangeText={(text) => updateSetLog(globalIdx, setIndex, 'reps', text)}
                                          accessibilityLabel={`Reps for ${exercise.name} set ${setIndex + 1}`}
                                        />
                                        <TouchableOpacity
                                          style={styles.quickAdjustButton}
                                          onPress={() => quickAdjustSetLog(globalIdx, setIndex, 'reps', 1)}
                                        >
                                          <Text style={styles.quickAdjustButtonText}>+1</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                                  )}
                                  
                                  {/* Quick Note Input */}
                                  <View style={styles.quickNoteContainer}>
                                    <TextInput
                                      style={styles.quickNoteInput}
                                      placeholder="Quick note (e.g., 'felt heavy', 'form good')"
                                      value={setNotes[setKeySuperset] || ''}
                                      onChangeText={(text) => updateSetNote(setKeySuperset, text)}
                                      multiline
                                      maxLength={100}
                                    />
                                  </View>
                                  
                                  {/* Mark Set Complete Button - only enabled if not a future set or prior set is complete */}
                                  {(() => {
                                    // Check if prior set is complete (for future sets)
                                    const priorSetComplete = setIndex === 0 || setCompletions[globalIdx]?.has(setIndex - 1);
                                    // Check if this is a future set by checking the round state
                                    // If we're in a future round, check if this specific set is also future
                                    const isFutureSet = roundState === 'future' && (() => {
                                      const currentSetStateCheck = getSetState(globalIdx, setIndex);
                                      return currentSetStateCheck === 'future';
                                    })();
                                    
                                    // Don't show button for future sets if prior set not complete
                                    if (isFutureSet && !priorSetComplete) return null;
                                    
                                    if (isWeightValid && isRepsValid && !isSetComplete) {
                    return (
                      <TouchableOpacity
                                          style={styles.setCompleteButton}
                                          onPress={() => handleSetComplete(globalIdx, setIndex)}
                      >
                                          <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
                                  })()}
                    </View>
                  );
                })}
                          
                          {/* Timer for this round - show if round is complete OR if it's the first set (setIndex === 0) */}
                          {!isWarmupSequence && (() => {
                            // Check if this round is complete
                            const roundComplete = isRoundComplete(renderableItem, setIndex);
                            const groupRounds = completedRounds[groupTimerKey] || new Set<number>();
                            const roundCompleted = groupRounds.has(setIndex);
                            
                            // Show timer if:
                            // 1. Round is complete, OR
                            // 2. It's the first set (setIndex === 0) - allow starting rest timer before first set
                            const shouldShowTimer = roundComplete || roundCompleted || setIndex === 0;
                            if (!shouldShowTimer) return null;
                            
                            // Check if there's a timer for this group
                            const timer = restTimers[groupTimerKey];
                            
                            // For first set, always show timer (even if not started)
                            // For other sets, only show timer for the most recent completed round (or if timer is already running)
                            if (setIndex === 0) {
                              return renderCompactTimer(
                                groupTimerKey,
                                timer,
                                restDuration,
                                () => startRest(groupTimerKey, restDuration),
                                () => toggleRestTimer(groupTimerKey),
                                () => stopRestTimer(groupTimerKey),
                                (seconds) => adjustRestTimer(groupTimerKey, seconds),
                                setIndex === 0 ? 'Rest Timer' : `Round ${setIndex + 1} Rest`
                              );
                            }
                            
                            const isMostRecentRound = setIndex === Math.max(...Array.from(groupRounds), -1);
                            if (!isMostRecentRound && !timer) return null;
                            
                            return renderCompactTimer(
                              groupTimerKey,
                              timer,
                              restDuration,
                              () => startRest(groupTimerKey, restDuration),
                              () => toggleRestTimer(groupTimerKey),
                              () => stopRestTimer(groupTimerKey),
                              (seconds) => adjustRestTimer(groupTimerKey, seconds),
                              `Round ${setIndex + 1} Rest`
                            );
                          })()}
                        </View>
                      );
                      })
                      )}
                    </View>
                  );
                })()}

                {/* Group completion status */}
                <View style={styles.groupStatus}>
                  <Text style={styles.groupStatusText}>
                    {allCompleted 
                      ? '✅ All exercises completed' 
                      : someCompleted 
                        ? `${exerciseIndices.filter((i: number) => completed.includes(i)).length}/${exercises.length} completed`
                        : 'Tap each exercise to mark done'}
                  </Text>
                </View>

                {/* Shared rest timer for the group - hidden for warm-up sequences */}
                {!isWarmupSequence && (() => {
                  const timer = restTimers[groupTimerKey];
                  
                  if (restDuration <= 0) return null;
                  
                  return renderCompactTimer(
                    groupTimerKey,
                    timer,
                    restDuration,
                    () => startRest(groupTimerKey, restDuration),
                    () => toggleRestTimer(groupTimerKey),
                    () => stopRestTimer(groupTimerKey),
                    (seconds) => adjustRestTimer(groupTimerKey, seconds),
                    isCircuit ? 'Round Rest' : 'Rest Timer'
                  );
                })()}
              </View>
            );
          }
          
          // Render individual exercise
          const exercise = renderableItem.exercise!;
          const exerciseIndex = renderableItem.exerciseIndex!;
          const adjustedExercise = getAdjustedExerciseData(exercise);
          const warmupSets = getWarmupSets(exercise);
          const numSets = adjustedExercise.adjustedSets ?? adjustedExercise.sets ?? 0;
          const showLogging = shouldShowSetLogging(exercise);
          const hasAdjustment = adjustedExercise.readinessAdjustment && 
            adjustedExercise.readinessAdjustment.readinessCategory !== 'moderate';
          
          const isCompleted = completed.includes(exerciseIndex);
          const isExpanded = expandedExercises[exerciseIndex] || false;
          
          // Render compact view for completed exercises (unless expanded)
          if (isCompleted && !isExpanded) {
          return (
            <View style={styles.card}>
                <TouchableOpacity
                  style={styles.compactExerciseCard}
                  onPress={() => setExpandedExercises(prev => ({ ...prev, [exerciseIndex]: true }))}
                  activeOpacity={0.7}
                >
                  <View style={styles.compactExerciseHeader}>
                    <Text style={styles.compactExerciseCheckmark}>✓</Text>
                    <Text style={styles.compactExerciseName}>{exercise.name}</Text>
                </View>
                  <Text style={styles.compactExerciseSummary}>
                    {getExerciseSummary(exercise, exerciseIndex)}
                  </Text>
                  <Text style={styles.compactExerciseHint}>Tap to expand</Text>
                </TouchableOpacity>
              </View>
            );
          }
          
          return (
            <View style={styles.card}>
              <View
                style={[
                  styles.exerciseBlock,
                  completed.includes(exerciseIndex) && styles.completedCard,
                ]}
              >
                {/* Exercise name row with checkbox and icons */}
                {(() => {
                  const iconCount = [
                    hasExpandableContent(exercise),
                    shouldShowHistoryButton(exercise),
                  ].filter(Boolean).length;
                  const showIconsOnSeparateRow = shouldShowIconsOnSeparateRow(exercise.name, iconCount);
                  const isCompleted = completed.includes(exerciseIndex);
                  
                  return (
                    <>
                      <View style={styles.exerciseNameRow}>
                        {/* Checkbox on left */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                            toggleComplete(exerciseIndex);
                          }}
                          style={[
                            styles.exerciseCheckbox,
                            isCompleted && styles.exerciseCheckboxCompleted,
                          ]}
                          accessibilityLabel={isCompleted ? `Mark ${exercise.name} as incomplete` : `Mark ${exercise.name} as complete`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isCompleted }}
                        >
                          <Text style={[
                            styles.exerciseCheckboxText,
                            isCompleted && styles.exerciseCheckboxTextCompleted,
                          ]}>
                            {isCompleted ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                        
                        {/* Exercise name */}
                        <TouchableOpacity
                          onPress={() => toggleComplete(exerciseIndex)}
                          style={{ flex: 1 }}
                          accessibilityLabel={isCompleted ? `Mark ${exercise.name} as incomplete` : `Mark ${exercise.name} as complete`}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.exercise, styles.exerciseWithCheckbox]}>{exercise.name}</Text>
                        </TouchableOpacity>
                        
                        {/* Collapse button for expanded completed exercises */}
                        {isCompleted && isExpanded && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setExpandedExercises(prev => {
                                const updated = { ...prev };
                                delete updated[exerciseIndex];
                                return updated;
                              });
                            }}
                            style={styles.collapseButton}
                          >
                            <Text style={styles.collapseButtonText}>▼ Collapse</Text>
                  </TouchableOpacity>
                )}
                        
                        {/* Icons on same row (if not moving to separate row) */}
                        {!showIconsOnSeparateRow && (
                          <View style={styles.exerciseActionButtons}>
                            {hasExpandableContent(exercise) && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  toggleExerciseDetailsAll(exerciseIndex);
                                }}
                                style={[
                                  styles.detailsButton,
                                  isAnyDetailsExpanded(exerciseIndex) && styles.detailsButtonExpanded
                                ]}
                                accessibilityLabel="Show exercise details"
                                accessibilityRole="button"
                              >
                                <Text style={[
                                  styles.detailsButtonText,
                                  isAnyDetailsExpanded(exerciseIndex) && styles.detailsButtonTextExpanded
                                ]}>Details</Text>
                              </TouchableOpacity>
                            )}
                            {shouldShowHistoryButton(exercise) && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  openHistoryModal(exercise.name);
                                }}
                                style={styles.historyButtonInline}
                                accessibilityLabel="View exercise history"
                                accessibilityRole="button"
                              >
                                <Text style={styles.historyButtonInlineText}>🕐</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                      
                      {/* Icons on separate row (if needed) */}
                      {showIconsOnSeparateRow && (
                        <View style={styles.exerciseIconRow}>
                          {hasExpandableContent(exercise) && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                toggleExerciseDetailsAll(exerciseIndex);
                              }}
                              style={[
                                styles.detailsButton,
                                isAnyDetailsExpanded(exerciseIndex) && styles.detailsButtonExpanded
                              ]}
                              accessibilityLabel="Show exercise details"
                              accessibilityRole="button"
                            >
                              <Text style={[
                                styles.detailsButtonText,
                                isAnyDetailsExpanded(exerciseIndex) && styles.detailsButtonTextExpanded
                              ]}>Details</Text>
                            </TouchableOpacity>
                          )}
                          {shouldShowHistoryButton(exercise) && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                openHistoryModal(exercise.name);
                              }}
                              style={styles.historyButtonInline}
                              accessibilityLabel="View exercise history"
                              accessibilityRole="button"
                            >
                              <Text style={styles.historyButtonInlineText}>🕐</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  );
                })()}
                
                {/* Enhanced display for warm-up/cool-down blocks */}
                {isExerciseDetailsExpanded(exerciseIndex) && (exercise.blockName?.toLowerCase().includes('warm') || 
                  exercise.blockName?.toLowerCase().includes('cool') || 
                  exercise.blockName?.toLowerCase().includes('activation')) && exercise.definition && (
                  <View style={styles.definitionBox}>
                    <Text style={styles.definitionText}>{exercise.definition}</Text>
                  </View>
                )}
                
                {/* Display based on tracking mode */}
                {isTimeBased(exercise) ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.detail}>Duration: {formatDurationWithPerSide(exercise)}{exercise.sets && exercise.sets > 1 ? ` per set` : ''}</Text>
                        {(() => {
                        // Don't show compact timer if IntervalTimer is shown (for interval-based exercises)
                        if (shouldShowIntervalTimer(exercise)) return null;
                        
                          const timer = timeBasedTimers[exerciseIndex];
                          const durationSeconds = parseDurationToSeconds(exercise.duration);
                        if (durationSeconds <= 0) return null;
                        
                        return renderCompactTimer(
                          exerciseIndex,
                          timer,
                          durationSeconds,
                          () => startTimeBasedTimer(exerciseIndex, durationSeconds),
                          () => toggleTimeBasedTimer(exerciseIndex),
                          async () => {
                                      const timerId = intervalsRef.current.get(exerciseIndex);
                                      if (timerId) clearInterval(timerId);
                                      intervalsRef.current.delete(exerciseIndex);
                                      timeBasedEndTimeRef.current.delete(exerciseIndex);
                                      await playTimerStop();
                                      setTimeBasedTimers((prev) => {
                                        const { [exerciseIndex]: _, ...rest } = prev;
                                        return rest;
                                      });
                          },
                          undefined, // No adjust function for time-based timers
                          'Timer',
                          true // inline mode
                        );
                        })()}
                    </View>
                    {exercise.sets && exercise.sets > 1 && (
                      <Text style={styles.detail}>Sets: {exercise.sets}</Text>
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
                    {exercise.trackingMode === 'distance' && exercise.distance ? (
                      <Text style={styles.detail}>Distance: {exercise.distance}</Text>
                    ) : exercise.reps !== undefined && (
                      <Text style={styles.detail}>Reps: {formatRepsDisplay(exercise.reps)}</Text>
                    )}
                  </>
                )}
                
                {shouldShowRestText(exercise, false) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.detail}>Rest: {getRestDuration(exercise)} sec</Text>
                    {(() => {
                      const timer = restTimers[exerciseIndex];
                      const initialDuration = getRestDuration(exercise);
                      if (initialDuration <= 0) return null;
                      
                      return renderCompactTimer(
                        exerciseIndex,
                        timer,
                        initialDuration,
                        () => startRest(exerciseIndex, getRestDuration(exercise)),
                        () => toggleRestTimer(exerciseIndex),
                        () => stopRestTimer(exerciseIndex),
                        (seconds) => adjustRestTimer(exerciseIndex, seconds),
                        'Rest Timer',
                        true // inline mode
                      );
                    })()}
                  </View>
                )}
                {exercise.intensity && <Text style={styles.detail}>Intensity: {exercise.intensity}</Text>}
                {exercise.tempo && <Text style={styles.detail}>Tempo: {exercise.tempo}</Text>}
                {/* Form cues (instruction) - shown when Form icon is toggled */}
                {formCuesExpanded[exerciseIndex] && exercise.instruction && (
                  <Text style={styles.instruction} numberOfLines={0}>💡 {exercise.instruction}</Text>
                )}
                
                {/* Exercise details (notes, definition, suggestions) - shown when Info icon is toggled */}
                {isExerciseDetailsExpanded(exerciseIndex) && (
                  <>
                    {exercise.notes && <Text style={styles.notes}>📝 {exercise.notes}</Text>}
                    {exercise.substitutions && exercise.substitutions.length > 0 && (
                      <View style={styles.substitutionsContainer}>
                        <Text style={styles.substitutionsLabel}>🔄 Alternatives:</Text>
                        {exercise.substitutions.map((sub, idx) => (
                          <Text key={idx} style={styles.substitutionItem}>• {sub}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* Progression type badge - shown only when expanded */}
                {isExpanded && (() => {
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

                {/* 1RM indicator - always shown when available */}
                {isTrackableFor1RM(exercise) && (() => {
                  const loadInfo = getSuggestedLoadInfo(adjustedExercise);
                  
                  if (!loadInfo) {
                    return (
                      <TouchableOpacity
                        style={styles.oneRMIndicatorBox}
                        onPress={() => setShow1RMModal(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.oneRMIndicatorText}>
                          💪 1RM: Enter your 1RM to get weight suggestions (tap to learn more)
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  // Prefer programmed targetRPE (autoregulation); fall back to % estimate
                  const percentRounded = Math.round(loadInfo.percentOf1RM * 100);
                  const estimatedRPE = percentRounded >= 90 ? 10 : percentRounded >= 85 ? 9 : percentRounded >= 80 ? 8.5 : percentRounded >= 75 ? 8 : percentRounded >= 70 ? 7.5 : 7;
                  const displayRPE = adjustedExercise.targetRPE ?? estimatedRPE;
                  
                  return (
                    <TouchableOpacity
                      style={styles.suggestionBox}
                      onPress={() => setShow1RMModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionTitle}>
                        💪 1RM: Suggested {loadInfo.suggestedWeight} lbs for {loadInfo.sets}×{formatRepsDisplay(loadInfo.reps)} @ RPE {displayRPE}, based on training max ({loadInfo.trainingMax} lbs). (tap to learn more)
                      </Text>
                      <Text style={styles.suggestionDetail}>
                        Suggested load is ~{percentRounded}% of your target 1RM ({loadInfo.trainingMax} lbs). Your baseline 1RM is {loadInfo.baseline1RM} lbs.
                      </Text>
                      {loadInfo.readinessAdjusted && loadInfo.readinessModifier && (
                        <Text style={[
                          styles.readinessAdjustmentNote,
                          { color: getReadinessColor(readinessScore || 5) }
                        ]}>
                          ⚡ {adjustedExercise.readinessAdjustment?.adjustmentReason} ({loadInfo.readinessModifier > 1 ? '+' : ''}{Math.round((loadInfo.readinessModifier - 1) * 100)}% weight)
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* Rule of 3 indicator - always shown when expanded */}
                {exercise.trackingMode === 'volume' && !isTrackableFor1RM(exercise) && !isBodyweightExerciseEnhanced(exercise) && isExerciseDetailsExpanded(exerciseIndex) && (() => {
                  const suggestion = progressionSuggestions[exercise.name];
                  
                  if (!suggestion) {
                    // First time - show clickable tip
                    return (
                      <TouchableOpacity
                        style={styles.ruleOf3Box}
                        onPress={() => setShowRuleOf3Modal(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.ruleOf3Text}>
                          📈 {getRuleOf3TipText()} (tap to learn more)
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  // Show progression status and options with clickable header
                  return (
                    <View style={styles.progressionSuggestionBox}>
                      <TouchableOpacity onPress={() => setShowRuleOf3Modal(true)} activeOpacity={0.7}>
                      <Text style={styles.progressionStatusText}>
                          📈 Rule of 3: {suggestion.reason} (tap to learn more)
                      </Text>
                      </TouchableOpacity>
                      
                      {/* Challenge options when Rule of 3 is met */}
                      {suggestion.challengeOptions && suggestion.challengeOptions.length > 0 && (
                        <View style={styles.challengeOptionsContainer}>
                          <Text style={styles.challengeOptionsTitle}>
                            💪 Challenge Options (choose one):
                          </Text>
                          {suggestion.challengeOptions.map((option, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.challengeOptionButton}
                              onPress={() => handleChallengeSelection(exercise.name, option)}
                            >
                              <Text style={styles.challengeOptionText}>
                                {option.type === 'rest_reduction' && '⏱️ '}
                                {option.type === 'tempo_change' && '🎯 '}
                                {option.type === 'weight_increase' && '⚖️ '}
                                {option.description}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      
                      {/* Weight suggestion if available (when no challenge options or as fallback) */}
                      {suggestion.suggestedWeight && 
                       suggestion.ruleApplied !== 'maintain' &&
                       (!suggestion.challengeOptions || 
                        (suggestion.challengeOptions.length > 0 && 
                         !suggestion.challengeOptions.some(opt => opt.type === 'weight_increase'))) && (
                        <Text style={styles.suggestedWeightText}>
                          Suggested weight: {suggestion.suggestedWeight} lbs
                        </Text>
                      )}
                    </View>
                  );
                })()}

              </View>
              

              {/* Warm-up sets section - always shown when available */}
              {warmupSets.length > 0 && (
                <View style={styles.warmupSection}>
                  <Text style={styles.warmupHeader}>🔥 Warm-up Sets</Text>
                  {warmupSets.map((warmup, wIndex) => (
                    <View key={`warmup-${wIndex}`} style={styles.warmupRow}>
                      <Text style={styles.warmupLabel}>Warm-up {wIndex + 1}</Text>
                      <Text style={styles.warmupDetail}>
                        {warmup.weight} lbs, Reps: {warmup.reps} ({formatPercentage(warmup.percentage)})
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.warmupNote}>ℹ️ Warm-up sets are not logged</Text>
                </View>
              )}

              {/* Set checkboxes for warm-up/cool-down exercises */}
              {shouldShowSetCheckboxes(exercise) && numSets > 0 && isWarmupCooldownExercise(exercise) && (
                <View style={styles.setCheckboxesSection}>
                  <Text style={styles.setCheckboxesHeader}>
                    {exercise.sets} × {exercise.trackingMode === 'distance' && exercise.distance ? `Distance: ${exercise.distance}` : isTimeBased(exercise) && exercise.duration ? formatDurationWithPerSide(exercise) : formatRepsDisplay(exercise.reps)}
                  </Text>
                  <View style={styles.setCheckboxesRow}>
                    {[...Array(numSets)].map((_, setIndex) => {
                      const isSetCompleted = setCompletions[exerciseIndex]?.has(setIndex) || false;
                      return (
                        <TouchableOpacity
                          key={setIndex}
                          style={[
                            styles.setCheckbox,
                            isSetCompleted && styles.setCheckboxCompleted,
                          ]}
                          onPress={() => toggleSetCompletion(exerciseIndex, setIndex)}
                        >
                          <Text style={[
                            styles.setCheckboxText,
                            isSetCompleted && styles.setCheckboxTextCompleted,
                          ]}>
                            {isSetCompleted ? '✓' : '○'} {exercise.name} Set {setIndex + 1}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {areAllSetsCompleted(exerciseIndex) && (
                    <Text style={styles.allSetsCompleteText}>✅ All sets complete</Text>
                  )}
                </View>
              )}

              {/* Working sets section (weight/reps logging) - hidden for warm-up/cool-down and distance exercises with checkboxes */}
              {showLogging && numSets > 0 && !isWarmupCooldownExercise(exercise) && 
               !(exercise.trackingMode === 'distance' && exercise.sets && exercise.sets > 0 && exercise.distance && !isDistanceExerciseWithWeight(exercise)) && (
                <View style={styles.workingSetsSection}>
                  {(() => {
                    const loadInfoForHeader = isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedExercise) : null;
                    const volumeSuggestion = progressionSuggestions[exercise.name];
                    const suggestedWeightForSection = loadInfoForHeader?.suggestedWeight ?? volumeSuggestion?.suggestedWeight;
                    const hasIncompleteSets = [...Array(numSets)].some((_, idx) => !setCompletions[exerciseIndex]?.has(idx));
                    return (
                  <View style={styles.workingSetsHeaderRow}>
                  <Text style={styles.workingSetsHeader}>
                    {isTrackableFor1RM(exercise) ? '💪 Working Sets' : '📊 Log Sets'}
                    {suggestedWeightForSection != null && ` • Suggested: ${suggestedWeightForSection} lbs`}
                  </Text>
                    {suggestedWeightForSection != null && hasIncompleteSets && (
                      <TouchableOpacity
                        style={styles.completeAllSuggestedButton}
                        onPress={() => handleCompleteAllSetsAtSuggested(exerciseIndex, suggestedWeightForSection)}
                      >
                        <Text style={styles.completeAllSuggestedButtonText}>Complete all at suggested</Text>
                      </TouchableOpacity>
                    )}
                    {/* Set status summary with toggle */}
                    {(() => {
                      const completedCount = Array.from({ length: numSets }).filter((_, idx) => 
                        setCompletions[exerciseIndex]?.has(idx)
                      ).length;
                      // Check if this is W1D4 accessory exercise - don't show toggle for these
                      const isW1D4Accessory = session?.weekIndex === 0 && session?.dayNumber === 4 && 
                                               exercise.blockName?.toLowerCase().includes('accessory');
                      return completedCount > 0 && !isW1D4Accessory ? (
                        <TouchableOpacity
                          onPress={() => setShowCompletedSets(!showCompletedSets)}
                          style={styles.showCompletedToggle}
                        >
                          <Text style={styles.setStatusText}>
                            {showCompletedSets ? '▼' : '▶'} {completedCount} completed
                          </Text>
                        </TouchableOpacity>
                      ) : null;
                    })()}
                  </View>
                    );
                  })()}
                  {[...Array(numSets)].map((_, setIndex) => {
                    // Determine set state
                    const setState = getSetState(exerciseIndex, setIndex);
                    
                    // Hide future sets that shouldn't be shown yet
                    if (setState === 'future' && !shouldShowFutureSet(exerciseIndex, setIndex)) {
                      return null;
                    }
                    
                    // Render future sets in preview form
                    if (setState === 'future') {
                      return renderFutureSetPreview(exercise, exerciseIndex, setIndex, false);
                    }
                    
                    const isSetComplete = setCompletions[exerciseIndex]?.has(setIndex) || false;
                    const weight = setLogs[exerciseIndex]?.[setIndex]?.weight || '';
                    const reps = setLogs[exerciseIndex]?.[setIndex]?.reps || '';
                    const rpe = setLogs[exerciseIndex]?.[setIndex]?.rpe || '';
                    const rir = setLogs[exerciseIndex]?.[setIndex]?.rir || '';
                    const targetRPE = adjustedExercise.targetRPE;
                    const isAccessoryExercise = exercise.blockName?.toLowerCase().includes('accessory') || 
                                                 exercise.groupId?.includes('accessory');
                    const weightNum = weight ? parseFloat(weight) : NaN;
                    const isWeightValid = weight && validateWeightInput(weight) && 
                                          (!isNaN(weightNum) && (isAccessoryExercise ? weightNum >= 0 : weightNum > 0));
                    const isRepsValid = reps && validateRepsInput(reps);
                    const loadInfo = isTrackableFor1RM(exercise) ? getSuggestedLoadInfo(adjustedExercise) : null;
                    const suggestedWeight = loadInfo?.suggestedWeight ?? progressionSuggestions[exercise.name]?.suggestedWeight;
                    
                    // Check if all sets for this exercise are complete
                    const allSetsForExerciseComplete = [...Array(numSets)].every((_, idx) => 
                      setCompletions[exerciseIndex]?.has(idx)
                    );
                    
                    // Find current set (first incomplete set)
                    const currentSetIndex = [...Array(numSets)].findIndex((_, idx) => 
                      !setCompletions[exerciseIndex]?.has(idx)
                    );
                    const isCurrentSet = currentSetIndex !== -1 && setIndex === currentSetIndex;
                    
                    // Hide completed sets if toggle is off, but always show W1D4 accessory completed sets
                    const isW1D4Accessory = session?.weekIndex === 0 && session?.dayNumber === 4 && 
                                             exercise.blockName?.toLowerCase().includes('accessory');
                    if (!showCompletedSets && isSetComplete && !allSetsForExerciseComplete && !isW1D4Accessory) return null;
                    
                    // Check if this is a distance exercise
                    const isDistanceExercise = exercise.trackingMode === 'distance';
                    const needsWeightInput = isDistanceExerciseWithWeight(exercise);
                    const distanceValue = exercise.distance || '';
                    
                    // Show as compact row if:
                    // 1. All sets for this exercise are complete, OR
                    // 2. This set is complete/has data and is not the current set (and not explicitly expanded)
                    const hasData = (weight && weight.trim() !== '') || (reps && reps.trim() !== '');
                    const setKey = `${exerciseIndex}-${setIndex}`;
                    const isExpanded = expandedSets[setKey] || false;
                    
                    if ((allSetsForExerciseComplete || (!isCurrentSet && (isSetComplete || hasData))) && !isExpanded) {
                      // Show as compact tappable row
                      return (
                        <TouchableOpacity
                          key={setIndex}
                          style={styles.compactSetRow}
                          onPress={() => {
                            // Expand this set for editing
                            setExpandedSets(prev => ({
                              ...prev,
                              [setKey]: true,
                            }));
                          }}
                          accessibilityLabel={`Edit Set ${setIndex + 1}`}
                          accessibilityRole="button"
                        >
                          <Text style={styles.compactSetLabel}>Set {setIndex + 1}:</Text>
                          <Text style={styles.compactSetValue}>
                            {isDistanceExercise ? (
                              <>
                                {needsWeightInput && (weight && weight.trim() ? `${weight} lbs` : '-')}
                                {needsWeightInput && distanceValue ? ' × ' : ''}
                                {distanceValue || '-'}
                              </>
                            ) : (
                              <>
                                {weight && weight.trim() ? `${weight} lbs` : '-'} × {reps && reps.trim() ? `${reps} reps` : '-'}
                                {rpe ? ` @ RPE ${rpe}` : rir ? ` @ RIR ${rir}` : ''}
                              </>
                            )}
                          </Text>
                          {isSetComplete && <Text style={styles.compactSetComplete}>✓</Text>}
                          {setNotes[setKey] && setNotes[setKey].trim() && (
                            <Text style={styles.compactSetNote}>
                              📝 {setNotes[setKey]}
                            </Text>
                          )}
                          <Text style={styles.compactSetEditHint}>Tap to edit</Text>
                        </TouchableOpacity>
                      );
                    }
                    
                    // Show full input for current set
                    return (
                      <View key={setIndex} style={styles.enhancedSetRow}>
                        <View style={styles.setRowHeader}>
                      <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                          {setIndex > 0 && (
                            <TouchableOpacity
                              style={styles.copyButton}
                              onPress={() => copyFromPreviousSet(exerciseIndex, setIndex)}
                            >
                              <Text style={styles.copyButtonText}>📋 Copy Previous</Text>
                            </TouchableOpacity>
                          )}
                          {isSetComplete && (
                            <Text style={styles.setCompleteBadge}>✓ Complete</Text>
                          )}
                        </View>
                        
                        {/* Weight Input with Quick Adjust - Show for regular exercises or distance exercises with weight */}
                        {(shouldShowSetLogging(exercise) || needsWeightInput) && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Weight (lbs)</Text>
                            <View style={styles.inputWithButtons}>
                              <TouchableOpacity
                                style={styles.quickAdjustButton}
                                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', -5)}
                              >
                                <Text style={styles.quickAdjustButtonText}>-5</Text>
                              </TouchableOpacity>
                      <TextInput
                                style={[
                                  styles.enhancedInput,
                                  isWeightValid && styles.inputValid,
                                  isSetComplete && styles.inputComplete,
                                ]}
                                placeholder="Weight"
                        keyboardType="numeric"
                                value={weight}
                        onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'weight', text)}
                                accessibilityLabel={`Weight for set ${setIndex + 1}`}
                              />
                              <TouchableOpacity
                                style={styles.quickAdjustButton}
                                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'weight', 5)}
                              >
                                <Text style={styles.quickAdjustButtonText}>+5</Text>
                              </TouchableOpacity>
                              {isWeightValid && (
                                <Text style={styles.validationCheck}>✓</Text>
                              )}
                            </View>
                            {suggestedWeight && !weight && (
                              <TouchableOpacity
                                style={styles.useSuggestedButton}
                                onPress={() => applySuggestedWeight(exerciseIndex, setIndex, suggestedWeight)}
                              >
                                <Text style={styles.useSuggestedButtonText}>
                                  Use Suggested: {suggestedWeight} lbs
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                        
                        {/* Distance Display - Show for distance exercises (read-only) */}
                        {isDistanceExercise && distanceValue && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Distance</Text>
                            <View style={[styles.enhancedInput, { backgroundColor: THEME.background, justifyContent: 'center' }]}>
                              <Text style={styles.distanceDisplayText}>{distanceValue}</Text>
                            </View>
                          </View>
                        )}
                        
                        {/* Reps Input with Quick Adjust - Show only for non-distance exercises */}
                        {!isDistanceExercise && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Reps</Text>
                            <View style={styles.inputWithButtons}>
                              <TouchableOpacity
                                style={styles.quickAdjustButton}
                                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', -1)}
                              >
                                <Text style={styles.quickAdjustButtonText}>-1</Text>
                              </TouchableOpacity>
                      <TextInput
                                style={[
                                  styles.enhancedInput,
                                  isRepsValid && styles.inputValid,
                                  isSetComplete && styles.inputComplete,
                                ]}
                        placeholder="Reps"
                        keyboardType="numeric"
                                value={reps}
                        onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'reps', text)}
                        accessibilityLabel={`Reps for set ${setIndex + 1}`}
                              />
                              <TouchableOpacity
                                style={styles.quickAdjustButton}
                                onPress={() => quickAdjustSetLog(exerciseIndex, setIndex, 'reps', 1)}
                              >
                                <Text style={styles.quickAdjustButtonText}>+1</Text>
                              </TouchableOpacity>
                              {isRepsValid && (
                                <Text style={styles.validationCheck}>✓</Text>
                              )}
                    </View>
                </View>
              )}

                        {/* Per-set RPE / RIR (autoregulation) */}
                        {(shouldShowSetLogging(exercise) || isTrackableFor1RM(exercise)) && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                              RPE{targetRPE != null ? ` (target ${targetRPE})` : ''} / RIR
                            </Text>
                            <View style={styles.rpeChipRow}>
                              {[6, 7, 8, 9, 10].map((val) => {
                                const selected = String(rpe) === String(val) || String(rpe) === `${val}.0`;
                                return (
                                  <TouchableOpacity
                                    key={`rpe-${val}`}
                                    style={[styles.rpeChip, selected && styles.rpeChipSelected]}
                                    onPress={() => updateSetLog(exerciseIndex, setIndex, 'rpe', String(val))}
                                  >
                                    <Text style={[styles.rpeChipText, selected && styles.rpeChipTextSelected]}>
                                      {val}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                              <TouchableOpacity
                                style={styles.rpeChip}
                                onPress={() => {
                                  updateSetLog(exerciseIndex, setIndex, 'rpe', '');
                                  updateSetLog(exerciseIndex, setIndex, 'rir', '');
                                }}
                              >
                                <Text style={styles.rpeChipText}>Clear</Text>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.rpeManualRow}>
                              <TextInput
                                style={[styles.enhancedInput, styles.rpeManualInput]}
                                placeholder="RPE"
                                keyboardType="numeric"
                                value={rpe}
                                onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'rpe', text)}
                                accessibilityLabel={`RPE for set ${setIndex + 1}`}
                              />
                              <TextInput
                                style={[styles.enhancedInput, styles.rpeManualInput]}
                                placeholder="RIR"
                                keyboardType="numeric"
                                value={rir}
                                onChangeText={(text) => updateSetLog(exerciseIndex, setIndex, 'rir', text)}
                                accessibilityLabel={`RIR for set ${setIndex + 1}`}
                              />
                            </View>
                          </View>
                        )}

                        {/* Quick Note Input */}
                        <View style={styles.quickNoteContainer}>
                          <TextInput
                            style={styles.quickNoteInput}
                            placeholder="Quick note (e.g., 'felt heavy', 'form good')"
                            value={setNotes[`${exerciseIndex}-${setIndex}`] || ''}
                            onChangeText={(text) => updateSetNote(`${exerciseIndex}-${setIndex}`, text)}
                            multiline
                            maxLength={100}
                          />
                        </View>
                        
                        {/* Set Complete Button - Validation depends on exercise type */}
                        {(() => {
                          if (isSetComplete) return null;
                          
                          // Check if prior set is complete (for future sets that might be expanded)
                          const priorSetComplete = setIndex === 0 || setCompletions[exerciseIndex]?.has(setIndex - 1);
                          const currentSetState = getSetState(exerciseIndex, setIndex);
                          const isFutureSet = currentSetState === 'future';
                          
                          // Don't show button for future sets if prior set not complete
                          if (isFutureSet && !priorSetComplete) return null;
                          
                          // For distance exercises with weight: need weight only
                          if (isDistanceExercise && needsWeightInput) {
                            if (isWeightValid) {
                  return (
                      <TouchableOpacity
                                  style={styles.setCompleteButton}
                                  onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                      >
                                  <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                      </TouchableOpacity>
                              );
                            }
                            return null;
                          }
                          
                          // For distance exercises without weight: can mark complete immediately (distance is prescribed)
                          if (isDistanceExercise && !needsWeightInput) {
                            return (
                        <TouchableOpacity
                                style={styles.setCompleteButton}
                                onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                        >
                                <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                        </TouchableOpacity>
                            );
                          }
                          
                          // For regular exercises: need both weight and reps
                          if (isWeightValid && isRepsValid) {
                            return (
                        <TouchableOpacity
                                style={styles.setCompleteButton}
                                onPress={() => handleSetComplete(exerciseIndex, setIndex)}
                        >
                                <Text style={styles.setCompleteButtonText}>✓ Mark Set Complete</Text>
                        </TouchableOpacity>
                            );
                          }
                          
                          return null;
                        })()}
                    </View>
                  );
                  })}
                </View>
              )}

              {/* Set checkboxes for bodyweight and distance exercises (non-warm-up/cool-down) */}
              {shouldShowSetCheckboxes(exercise) && !isWarmupCooldownExercise(exercise) && numSets > 0 && (
                <View style={styles.setCheckboxesSection}>
                  <Text style={styles.setCheckboxesHeader}>
                    {exercise.sets} × {exercise.trackingMode === 'distance' && exercise.distance ? `Distance: ${exercise.distance}` : formatRepsDisplay(exercise.reps)}
                  </Text>
                  <View style={styles.setCheckboxesRow}>
                    {[...Array(numSets)].map((_, setIndex) => {
                      const isSetCompleted = setCompletions[exerciseIndex]?.has(setIndex) || false;
                  return (
                    <TouchableOpacity
                          key={setIndex}
                          style={[styles.setCheckbox, isSetCompleted && styles.setCheckboxCompleted]}
                          onPress={() => toggleSetCompletion(exerciseIndex, setIndex)}
                        >
                          <Text style={[styles.setCheckboxText, isSetCompleted && styles.setCheckboxTextCompleted]}>
                            {isSetCompleted ? '✓' : '○'} {exercise.name} Set {setIndex + 1}
                          </Text>
                    </TouchableOpacity>
                  );
                    })}
                  </View>
                  {areAllSetsCompleted(exerciseIndex) && (
                    <Text style={styles.allSetsCompleteText}>✅ All sets complete</Text>
                  )}
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
                  workLabel={parseWorkActivity(exercise)}
                  restLabel={parseRecoveryActivity(exercise)}
                  onComplete={() => toggleComplete(exerciseIndex)}
                  onSetComplete={(setNum) => {
                    if (__DEV__) {
                      console.log(`${exercise.name}: Set ${setNum} complete`);
                    }
                  }}
                />
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={() => (
          <View style={styles.bottomActionBarFooter}>
        <View style={styles.bottomActionBarShadow} />
        <View style={styles.bottomActionBarContent}>
          <TouchableOpacity
            style={styles.oneRMButton}
            onPress={() =>
              navigation.navigate('My1RMs', {
                onUpdate1RM: (exerciseName: string, newValue: number) => {
                  setOneRMMap((prev) => ({ ...prev, [exerciseName]: newValue }));
                },
              })
            }
          >
            <Text style={styles.oneRMText}>💪 Open 1RM Calculator</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sixPackButton}
            onPress={() => setShowSixPackModal(true)}
            accessibilityLabel="Core Roulette"
            accessibilityRole="button"
            accessibilityHint="Generate a personalized core workout"
          >
            <Text style={styles.sixPackText}>💪 Core Roulette</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.finishButton} 
            onPress={markSessionComplete}
            accessibilityLabel="Finish session"
            accessibilityRole="button"
            accessibilityHint="Completes the current training session and shows summary"
          >
            <Text style={styles.finishText}>🏁 Finish Session</Text>
          </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Sticky Timer Bar */}
      {stickyTimerVisible && activeTimerInfo && (
        <Animated.View style={styles.stickyTimerBar}>
          <View style={styles.stickyTimerContent}>
            <View style={styles.stickyTimerLeft}>
              <Text style={styles.stickyTimerLabel}>
                {activeTimerInfo.type === 'rest' ? '⏱ Rest' : activeTimerInfo.type === 'interval' ? '🔄 Interval' : '⏱ Timer'}
              </Text>
              <Text style={styles.stickyTimerTime}>
                {formatTime(activeTimerInfo.remaining)}
              </Text>
            </View>
            <View style={styles.stickyTimerRight}>
              <TouchableOpacity
                style={styles.stickyTimerButton}
                onPress={() => {
                  if (activeTimerInfo.type === 'rest') {
                    toggleRestTimer(activeTimerInfo.exerciseIndex);
                  } else if (activeTimerInfo.type === 'time') {
                    toggleTimeBasedTimer(activeTimerInfo.exerciseIndex);
                  }
                }}
              >
                <Text style={styles.stickyTimerButtonText}>
                  {activeTimerInfo.isPaused ? '▶ Resume' : '⏸ Pause'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stickyTimerButton}
                onPress={() => {
                  if (activeTimerInfo.type === 'rest') {
                    stopRestTimer(activeTimerInfo.exerciseIndex);
                  } else if (activeTimerInfo.type === 'time') {
                    const timerId = intervalsRef.current.get(activeTimerInfo.exerciseIndex);
                    if (timerId) clearInterval(timerId);
                    intervalsRef.current.delete(activeTimerInfo.exerciseIndex);
                    timeBasedEndTimeRef.current.delete(activeTimerInfo.exerciseIndex);
                    playTimerStop();
                    setTimeBasedTimers((prev) => {
                      const updated = { ...prev };
                      delete updated[activeTimerInfo.exerciseIndex];
                      return updated;
                    });
                  }
                }}
              >
                <Text style={styles.stickyTimerButtonText}>⏹ Stop</Text>
              </TouchableOpacity>
            </View>
        </View>
      </Animated.View>
      )}


      {/* Rule of 3 Explanation Modal */}
      <Modal
        visible={showRuleOf3Modal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRuleOf3Modal(false)}
      >
        <View style={styles.explanationModalOverlay}>
          <View style={styles.explanationModalContent}>
            <Text style={styles.explanationModalTitle}>📈 Rule of 3 Progression</Text>
            
            <ScrollView style={styles.explanationModalScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.explanationModalSectionTitle}>What is it?</Text>
              <Text style={styles.explanationModalText}>
                The Rule of 3 is a simple progression system that helps you know when to increase weight or difficulty. It prevents overreaching and ensures sustainable progress.
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>How it works</Text>
              <Text style={styles.explanationModalText}>
                Progress when you succeed 3 sessions in a row at the same weight, or add ≥3 reps on the last set of your workout.
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>How to use it</Text>
              <Text style={styles.explanationModalText}>
                1. Track your workouts consistently{'\n'}
                2. Look for the Rule of 3 indicator in the Details section{'\n'}
                3. When you meet the Rule of 3, you'll see challenge options{'\n'}
                4. Choose one challenge option to progress: reduce rest time, change tempo, or increase weight
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>Benefits</Text>
              <Text style={styles.explanationModalText}>
                • Prevents overreaching and burnout{'\n'}
                • Ensures sustainable, long-term progress{'\n'}
                • Reduces injury risk by not progressing too quickly{'\n'}
                • Builds confidence through consistent success
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>Example</Text>
              <Text style={styles.explanationModalText}>
                If you complete 3 sets of 8 reps at 100 lbs for 3 sessions in a row, you're ready to progress. The app will suggest challenge options like reducing rest time or increasing weight slightly.
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.explanationModalCloseButton}
              onPress={() => setShowRuleOf3Modal(false)}
            >
              <Text style={styles.explanationModalCloseButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 1RM Explanation Modal */}
      <Modal
        visible={show1RMModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShow1RMModal(false)}
      >
        <View style={styles.explanationModalOverlay}>
          <View style={styles.explanationModalContent}>
            <Text style={styles.explanationModalTitle}>💪 1RM Training Max System</Text>
            
            <ScrollView style={styles.explanationModalScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.explanationModalSectionTitle}>What is it?</Text>
              <Text style={styles.explanationModalText}>
                The 1RM (One Rep Max) Training Max system uses 90% of your true 1RM to calculate working weights. This makes your training safer and accounts for daily fluctuations in strength.
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>How it's calculated</Text>
              <Text style={styles.explanationModalText}>
                Training Max = 90% of your true 1RM{'\n'}
                {'\n'}
                Example: If your true 1RM is 225 lbs, your Training Max is 202.5 lbs (rounded to 203 lbs).
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>How to use it</Text>
              <Text style={styles.explanationModalText}>
                1. Enter your true 1RM in the My 1RMs screen{'\n'}
                2. The app calculates your Training Max (90% of 1RM){'\n'}
                3. Working weights are suggested based on percentages of your Training Max{'\n'}
                4. The app adjusts weights based on your readiness score if needed
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>Benefits</Text>
              <Text style={styles.explanationModalText}>
                • Safer than using true 1RM (reduces injury risk){'\n'}
                • Accounts for daily strength fluctuations{'\n'}
                • Enables progressive overload without overreaching{'\n'}
                • Provides consistent weight suggestions based on your strength level
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>How it helps improve</Text>
              <Text style={styles.explanationModalText}>
                By using 90% of your true 1RM, you train at a sustainable intensity that allows you to complete all sets with proper form. This builds strength consistently over time while reducing the risk of injury or burnout.
              </Text>
              
              <Text style={styles.explanationModalSectionTitle}>Example</Text>
              <Text style={styles.explanationModalText}>
                If your 1RM is 225 lbs, your Training Max is 203 lbs. For 5 reps at 70% intensity, the app suggests 142 lbs (70% of 203 lbs), which is safer and more sustainable than 158 lbs (70% of 225 lbs).
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.explanationModalCloseButton}
              onPress={() => setShow1RMModal(false)}
            >
              <Text style={styles.explanationModalCloseButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exercise History Modal */}
      <ExerciseHistoryModal
        visible={showHistoryModal}
        exerciseName={historyExerciseName}
        onClose={() => setShowHistoryModal(false)}
      />

      {/* Six Pack Shuffle Modal */}
      <SixPackShuffleModal
        visible={showSixPackModal}
        onClose={() => setShowSixPackModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: THEME.background },
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
  detail: { fontSize: 14, color: THEME.textMuted, marginBottom: 8, marginTop: 2 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorBackButton: {
    marginTop: 24,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorBackButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  restDayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  restDayIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  restDayTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    color: THEME.primary,
  },
  restDaySubtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  restDayBackButton: {
    marginTop: 24,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  restDayBackButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  
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
  },
  oneRMIndicatorBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.warning,
  },
  oneRMIndicatorText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  
  // Explanation Modal Styles
  explanationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  explanationModalContent: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  explanationModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: THEME.primary,
  },
  explanationModalScroll: {
    maxHeight: 400,
  },
  explanationModalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  explanationModalText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  explanationModalCloseButton: {
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  explanationModalCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textOnPrimary,
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
  },
  // Collapsible block header styles
  collapsibleBlockHeader: {
    backgroundColor: THEME.secondaryFaded,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  collapsibleBlockHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsibleBlockHeaderIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  collapsibleBlockHeaderText: {
    flex: 1,
  },
  collapsibleBlockHeaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  collapsibleBlockHeaderProgress: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  collapsibleBlockHeaderChevron: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginLeft: 8,
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
  notes: { marginTop: 4, color: THEME.textMuted, fontStyle: 'italic', fontSize: 13 },
  instruction: { marginTop: 6, color: THEME.secondary, fontSize: 12, lineHeight: 16 },
  suggested: { marginTop: 4, color: THEME.primary, fontWeight: '500' },
  exercise: { fontSize: 16, fontWeight: '600', color: THEME.textPrimary, marginBottom: 4 },
  exerciseWithCheckbox: {
    flex: 1,
    marginRight: 8,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  exerciseSummaryRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  exerciseSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  exerciseCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.border,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  exerciseCheckboxCompleted: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  exerciseCheckboxText: {
    fontSize: 18,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  exerciseCheckboxTextCompleted: {
    color: '#fff',
    fontWeight: '700',
  },
  exerciseActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  exerciseIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 36, // Align with exercise name (checkbox width + margin)
    marginBottom: 4,
  },
  formCuesButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.primaryLight,
  },
  formCuesButtonText: {
    fontSize: 11,
    color: THEME.primary,
    fontWeight: '600',
  },
  infoButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: THEME.borderLight,
    borderRadius: 6,
  },
  infoButtonText: {
    fontSize: 11,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  historyButtonInline: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: THEME.secondaryFaded || THEME.borderLight,
    borderRadius: 6,
  },
  historyButtonInlineText: {
    fontSize: 11,
    color: THEME.secondary || THEME.textPrimary,
    fontWeight: '600',
  },
  detailsButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: THEME.borderLight,
    borderRadius: 6,
  },
  detailsButtonExpanded: {
    backgroundColor: THEME.primaryFaded,
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  detailsButtonText: {
    fontSize: 11,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  detailsButtonTextExpanded: {
    color: THEME.primary,
  },
  detailsToggleButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailsToggleButtonText: {
    fontSize: 13,
    color: THEME.secondary,
    fontWeight: '600',
  },
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
  
  // Definition box for warm-up/cool-down
  definitionBox: {
    backgroundColor: THEME.secondaryFaded,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: THEME.secondary,
  },
  definitionText: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  targetMusclesText: {
    fontSize: 12,
    color: THEME.secondary,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // Time-based timer styles
  // Compact Timer Styles
  compactTimerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.card,
    borderWidth: 2,
    borderColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  compactTimerButtonRunning: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
  },
  compactTimerButtonPaused: {
    borderColor: THEME.secondary,
    backgroundColor: THEME.secondaryFaded,
  },
  compactTimerIcon: {
    fontSize: 24,
    color: THEME.primary,
  },
  compactTimerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.card,
  },
  compactTimerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
  // Inline Timer Styles (for inline rendering with text - horizontal button style)
  inlineTimerButton: {
    height: 28,
    minWidth: 120,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inlineTimerButtonRunning: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
  },
  inlineTimerButtonPaused: {
    borderColor: THEME.secondary,
    backgroundColor: THEME.secondaryFaded,
  },
  inlineTimerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
  },
  inlineTimerButtonTextRunning: {
    color: '#2e7d32',
  },
  inlineTimerButtonTextPaused: {
    color: THEME.secondary,
  },
  timerExpandHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  collapseTimerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  collapseTimerButtonText: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  timerLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBasedTimerContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeBasedTimerText: {
    fontSize: 48,
    fontWeight: '200',
    color: THEME.primary,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  timerButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  timerControlButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: THEME.backgroundDark,
    borderRadius: 6,
  },
  timerControlText: {
    color: THEME.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  timerCompleteText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
  },
  startTimerButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  startTimerText: {
    color: THEME.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: THEME.backgroundDark,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  
  // Set checkboxes for warm-up/cool-down
  setCheckboxesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  setCheckboxesHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  setCheckboxesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setCheckbox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    minWidth: 80,
    alignItems: 'center',
  },
  setCheckboxCompleted: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
  },
  setCheckboxText: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  setCheckboxTextCompleted: {
    color: THEME.primary,
    fontWeight: '600',
  },
  allSetsCompleteText: {
    marginTop: 8,
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Inline set checkboxes for grouped exercises
  setCheckboxesSectionInline: {
    backgroundColor: THEME.backgroundLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  setCheckboxesHeaderSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  setCheckboxesRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  setCheckboxSmall: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    minWidth: 80,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  setCheckboxTextSmall: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  futureSetPreview: {
    padding: 12,
    marginVertical: 6,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  futureSetPreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  futureSetPreviewDetail: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 4,
  },
  futureSetPreviewHint: {
    fontSize: 11,
    color: THEME.primary,
    fontStyle: 'italic',
  },
  futureSetWarningContainer: {
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  futureSetWarning: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  
  // Flow group styles (for warm-up/cool-down flows)
  flowGroupHeader: {
    padding: 16,
    backgroundColor: THEME.secondaryFaded,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: THEME.secondary,
  },
  flowGroupHeaderCompleted: {
    backgroundColor: THEME.primaryFaded,
    borderLeftColor: THEME.primary,
  },
  flowGroupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  flowGroupDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  flowGroupInstruction: {
    fontSize: 13,
    color: THEME.secondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  flowGroupDuration: {
    fontSize: 13,
    color: THEME.textMuted,
    marginBottom: 8,
    fontWeight: '500',
  },
  flowGroupCompleteButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  flowGroupCompleteText: {
    color: THEME.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Flow sub-group styles
  flowSubGroup: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  flowSubGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  flowSubGroupDescription: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  flowSubGroupDuration: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 8,
    fontWeight: '500',
  },
  
  // Flow exercise item styles
  flowExerciseItem: {
    marginTop: 10,
    padding: 10,
    backgroundColor: THEME.card,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: THEME.secondaryLight,
  },
  flowExerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  flowExerciseDetail: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  flowExerciseDescription: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  flowExerciseCue: {
    fontSize: 12,
    color: THEME.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  flowExerciseInstructions: {
    marginTop: 6,
    paddingLeft: 8,
  },
  flowExerciseInstructionText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  trainerNotesBox: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  trainerNotesText: {
    fontSize: 13,
    color: THEME.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  
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
  warmupSequenceHeader: {
    backgroundColor: '#fff9e6',
    borderBottomWidth: 1,
    borderBottomColor: '#ffd54f',
    paddingVertical: 12,
  },
  sequenceText: {
    fontSize: 11,
    color: THEME.warning,
    fontStyle: 'italic',
    marginTop: 2,
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
  substitutionsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: THEME.card,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: THEME.secondary,
  },
  substitutionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.secondary,
    marginBottom: 4,
  },
  substitutionItem: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    lineHeight: 18,
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
  // Alternating set rounds styles
  supersetSetRoundsContainer: {
    padding: 14,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  setRoundContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: THEME.borderLight,
  },
  setRoundHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.primaryFaded,
  },
  setRoundLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  supersetSetContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  supersetSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  supersetSetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
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
  compactHeaderSticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.card,
    borderRadius: 0,
    padding: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
  bottomActionBarFooter: {
    backgroundColor: THEME.background,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    marginTop: 20,
    paddingTop: 8,
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
  sixPackButton: {
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
  sixPackText: { 
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
  progressionSuggestionBox: {
    backgroundColor: THEME.secondaryFaded,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  progressionStatusText: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  challengeOptionsContainer: {
    marginTop: 8,
  },
  challengeOptionsTitle: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  challengeOptionButton: {
    backgroundColor: THEME.card,
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  challengeOptionText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  suggestedWeightText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '600',
    marginTop: 8,
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
  
  // More Menu Styles
  moreMenuContainer: {
    position: 'relative',
    marginTop: 8,
  },
  moreMenuButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.borderLight,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  moreMenuButtonText: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  moreMenuDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    backgroundColor: THEME.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 180,
  },
  moreMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  moreMenuItemText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  
  // Flow Indicator Styles
  flowIndicatorContainer: {
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  flowIndicatorContainerSticky: {
    position: 'absolute',
    top: 0, // Fixed at the very top of the screen
    left: 0,
    right: 0,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  flowIndicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  flowIndicatorHeaderLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
  },
  flowIndicatorCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  flowIndicatorNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  flowIndicatorNextLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  flowIndicatorNextName: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  flowIndicatorCurrentIcon: {
    fontSize: 20,
  },
  flowIndicatorCurrentText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
  },
  flowIndicatorCurrentProgress: {
    fontSize: 12,
    color: THEME.textMuted,
    marginLeft: 4,
  },
  flowIndicatorToggle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginLeft: 8,
  },
  flowIndicatorExpanded: {
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
    paddingVertical: 8,
  },
  flowIndicatorScroll: {
    paddingHorizontal: 8,
  },
  flowSectionItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 80,
  },
  flowSectionDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  flowSectionDotCurrent: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
    borderWidth: 3,
  },
  flowSectionDotComplete: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  flowSectionIcon: {
    fontSize: 18,
  },
  flowSectionCheck: {
    position: 'absolute',
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  flowSectionLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  flowSectionLabelCurrent: {
    color: THEME.primary,
    fontWeight: '700',
  },
  flowSectionLabelComplete: {
    color: '#4caf50',
    fontWeight: '600',
  },
  flowSectionProgress: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 2,
  },
  
  // Transition Banner Styles
  transitionBanner: {
    backgroundColor: THEME.primaryFaded,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.primaryLight,
  },
  transitionBannerText: {
    fontSize: 14,
    color: THEME.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Contextual Tip Styles
  contextualTipContainer: {
    backgroundColor: '#fff9e6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffd54f',
  },
  contextualTipText: {
    fontSize: 13,
    color: THEME.textPrimary,
    lineHeight: 18,
  },
  
  // Enhanced Set Input Styles
  enhancedSetRow: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: THEME.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  setRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  setHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: THEME.secondaryFaded,
    borderRadius: 4,
  },
  copyButtonText: {
    fontSize: 11,
    color: THEME.secondary,
    fontWeight: '500',
  },
  setCompleteBadge: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  rpeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  rpeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    backgroundColor: THEME.background,
  },
  rpeChipSelected: {
    backgroundColor: THEME.primary + '22',
    borderColor: THEME.primary,
  },
  rpeChipText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  rpeChipTextSelected: {
    color: THEME.primary,
  },
  rpeManualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rpeManualInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  inputWithButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAdjustButton: {
    width: 40,
    height: 40,
    backgroundColor: THEME.borderLight,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAdjustButtonText: {
    fontSize: 14,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  enhancedInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: THEME.background,
    color: THEME.textPrimary,
  },
  inputValid: {
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  inputComplete: {
    backgroundColor: '#e8f5e9',
  },
  validationCheck: {
    fontSize: 18,
    color: '#4caf50',
    marginLeft: 4,
  },
  useSuggestedButton: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  useSuggestedButtonText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '600',
  },
  completeAllSuggestedButton: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completeAllSuggestedButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  setCompleteButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  setCompleteButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  quickNoteContainer: {
    marginTop: 8,
  },
  quickNoteInput: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    color: THEME.textPrimary,
    backgroundColor: THEME.background,
    minHeight: 36,
    maxHeight: 60,
  },
  
  // Compact Set Row Styles (for completed/previous sets)
  compactSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 6,
    marginBottom: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  compactSetLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  compactSetValue: {
    fontSize: 12,
    color: THEME.textPrimary,
    flex: 1,
  },
  distanceDisplayText: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  compactSetComplete: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
  },
  compactSetNote: {
    fontSize: 10,
    color: THEME.textMuted,
    fontStyle: 'italic',
  },
  compactSetEditHint: {
    fontSize: 10,
    color: THEME.primary,
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  
  // Compact Exercise Card Styles
  compactExerciseCard: {
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  compactExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  compactExerciseCheckmark: {
    fontSize: 16,
    color: THEME.primary,
    fontWeight: 'bold',
  },
  compactExerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
  },
  compactExerciseSummary: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  compactExerciseHint: {
    fontSize: 10,
    color: THEME.textMuted,
    fontStyle: 'italic',
  },
  
  // Collapse Button
  collapseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  collapseButtonText: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  
  // Sticky Timer Bar Styles
  stickyTimerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.card,
    borderBottomWidth: 2,
    borderBottomColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  stickyTimerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stickyTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stickyTimerLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  stickyTimerTime: {
    fontSize: 20,
    color: THEME.primary,
    fontWeight: '700',
  },
  stickyTimerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  stickyTimerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.primary,
    borderRadius: 6,
  },
  stickyTimerButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Next Exercise Preview Styles
  // Set Status Styles
  workingSetsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setStatusSummary: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  setStatusText: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: '500',
  },
  setStatusInProgress: {
    color: THEME.primary,
  },
  showCompletedToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // Quick Timer Adjust Styles
  quickTimerAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  quickTimerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.borderLight,
    borderRadius: 6,
  },
  quickTimerButtonText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  
  // Smart Rest Suggestions Styles
  restTimerContainer: {
    marginTop: 8,
  },
  quickRestButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  quickRestLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    marginRight: 4,
  },
  quickRestButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.borderLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  quickRestButtonActive: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
  },
  quickRestButtonText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  quickRestButtonTextActive: {
    color: THEME.primary,
    fontWeight: '600',
  },
});
