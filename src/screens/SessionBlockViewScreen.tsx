/**
 * Block-by-block session view: one block full-screen at a time,
 * with swipe and header prev/next. Full tracking: set logging, timers, completion.
 * Uses same session data and persistence as SessionScreen.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSessionData, SessionData } from '../hooks/useSessionData';
import { THEME } from '../theme/colors';
import {
  RenderableItem,
  FlattenedExercise,
  isTimeBased,
  hasSetReps,
  isTrackableFor1RM,
  parseNumericReps,
  parseIntensityPercent,
} from '../types/program';
import { getExercise1RM } from '../storage/logs';
import { getRepBasedPercent } from '../utils/1rm';
import { validateWeightInput, validateRepsInput } from '../utils/inputValidation';
import { SetLogEntry, SetLogsMap } from '../types/setLog';
import { triggerHaptic } from '../utils/haptics';
import {
  playTimerStart,
  playTimerStop,
  playRestComplete,
  playCountdownBeep,
} from '../utils/sounds';
import { speakRestComplete } from '../utils/voice';
import { getTickIntervalMs, getTickDecrement } from '../utils/e2eFastTimers';
import Toast from 'react-native-toast-message';
import IntervalTimer from '../components/IntervalTimer';
import { isBodyweightExercise } from '../types/program';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionBlockView'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SessionBlockViewScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const { session, isLoadingProgram } = useSessionData(sessionId);

  const [blockIndex, setBlockIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [setLogs, setSetLogs] = useState<SetLogsMap>({});
  const [setCompletions, setSetCompletions] = useState<Record<number, Set<number>>>({});
  const [setNotes, setSetNotes] = useState<Record<string, string>>({});
  const [oneRMMap, setOneRMMap] = useState<Record<string, number>>({});
  const [restTimers, setRestTimers] = useState<Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean }>>({});
  const [timeBasedTimers, setTimeBasedTimers] = useState<Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean; beepedAt?: number[] }>>({});
  const flatListRef = useRef<FlatList>(null);
  const editGenRef = useRef(0);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const hydrated = hydratedSessionId === sessionId;
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const restEndTimeRef = useRef<Map<number, number>>(new Map());
  const timeBasedEndTimeRef = useRef<Map<number, number>>(new Map());

  const blocks = session?.blocks ?? [];
  const totalBlocks = blocks.length;
  const currentBlock = blocks[blockIndex] ?? null;
  const blockName = currentBlock?.name ?? '';
  const isFirstBlock = blockIndex === 0;
  const isLastBlock = blockIndex >= totalBlocks - 1;

  // Load completed, setLogs, setNotes from same keys as SessionScreen; load 1RMs for session exercises
  useEffect(() => {
    let cancelled = false;
    const genAtStart = editGenRef.current;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(`completed:${sessionId}`);
        const logs = await AsyncStorage.getItem(`setLogs:${sessionId}`);
        const notes = await AsyncStorage.getItem(`setNotes:${sessionId}`);
        if (cancelled) return;
        if (editGenRef.current === genAtStart) {
          if (stored) setCompleted(JSON.parse(stored));
          if (logs) setSetLogs(JSON.parse(logs));
          if (notes) setSetNotes(JSON.parse(notes));
        }
      } catch (e) {
        if (__DEV__) console.error('SessionBlockView load error', e);
      } finally {
        if (!cancelled) setHydratedSessionId(sessionId);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Load 1RMs for exercises in this session
  useEffect(() => {
    if (!session?.allExercises?.length) return;
    const load = async () => {
      const map: Record<string, number> = {};
      for (const ex of session.allExercises) {
        const val = await getExercise1RM(ex.name);
        if (val != null) map[ex.name] = val;
      }
      setOneRMMap(map);
    };
    load();
  }, [session?.allExercises]);

  // Persist when completed, setLogs, or setNotes change
  useEffect(() => {
    if (!hydrated) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completed));
        await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(setLogs));
        await AsyncStorage.setItem(`setNotes:${sessionId}`, JSON.stringify(setNotes));
      } catch (e) {
        if (__DEV__) console.error('SessionBlockView save error', e);
      }
    };
    save();
  }, [sessionId, completed, setLogs, setNotes, hydrated]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((id) => clearInterval(id));
      intervalsRef.current.clear();
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const parseDurationToSeconds = (duration: string | undefined): number => {
    if (!duration?.trim()) return 60;
    const d = duration.trim().toLowerCase();
    const eachSide = d.includes('each side') || d.includes('per side');
    const multiplier = eachSide ? 2 : 1;
    const withoutSide = d.replace(/\s*(each|per)\s*side/gi, '').trim();
    const minMatch = withoutSide.match(/^(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1], 10) * 60 * multiplier;
    const secMatch = withoutSide.match(/^(\d+)\s*sec/);
    if (secMatch) return parseInt(secMatch[1], 10) * multiplier;
    const timeMatch = withoutSide.match(/^(\d+):(\d+)$/);
    if (timeMatch) return (parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)) * multiplier;
    const num = parseInt(withoutSide, 10);
    return (!isNaN(num) ? num : 60) * multiplier;
  };

  const getBaseWeight = (exercise: FlattenedExercise): number | null => {
    const oneRM = oneRMMap[exercise.name];
    if (!oneRM) return null;
    const pct = parseIntensityPercent(exercise.intensity);
    if (pct) return Math.round(oneRM * pct);
    const reps = parseNumericReps(exercise.reps);
    if (reps) return Math.round(oneRM * getRepBasedPercent(reps));
    return null;
  };

  const getAdjustedExerciseData = (exercise: FlattenedExercise): FlattenedExercise => exercise;

  const getEffectiveSetCount = (exerciseIndex: number): number => {
    const exercise = session?.allExercises[exerciseIndex];
    return exercise ? (exercise.sets ?? 0) : 0;
  };

  const isWarmupCooldownExercise = (exercise: FlattenedExercise): boolean => {
    const name = (exercise.blockName ?? '').toLowerCase();
    return ['warm', 'cool', 'cooldown', 'activation', 'mobility', 'stretching', 'breathing', 'raise', 'activate', 'mobilize', 'potentiate'].some(
      (p) => name.includes(p)
    );
  };

  const shouldShowSetLogging = (exercise: FlattenedExercise): boolean => {
    if (isWarmupCooldownExercise(exercise)) return false;
    const isAccessory = (exercise.blockName ?? '').toLowerCase().includes('accessory') || (exercise.groupId ?? '').includes('accessory');
    if (isAccessory && hasSetReps(exercise) && exercise.trackingMode === 'volume') return true;
    if (isBodyweightExercise(exercise) && !isAccessory && !exercise.exerciseCategory) return false;
    return isTrackableFor1RM(exercise) || (hasSetReps(exercise) && exercise.trackingMode === 'volume');
  };

  const shouldShowSetCheckboxes = (exercise: FlattenedExercise): boolean => {
    if (isWarmupCooldownExercise(exercise)) return !!(exercise.sets && (hasSetReps(exercise) || (isTimeBased(exercise) && exercise.duration)));
    if (isTimeBased(exercise) && exercise.duration && (exercise.sets ?? 0) > 0 && exercise.showInSetRounds) return true;
    return !!(hasSetReps(exercise) && exercise.sets && exercise.sets > 0);
  };

  const updateSetLog = useCallback(
    (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps' | 'rpe' | 'rir', value: string) => {
      editGenRef.current += 1;
      let validated = value;
      if (field === 'weight') validated = validateWeightInput(value);
      else if (field === 'reps') validated = validateRepsInput(value);
      else validated = value.replace(/[^\d.]/g, '').slice(0, 4);

      setSetLogs((prevLogs) => {
        const existing = prevLogs[exerciseIndex] || [];
        const updated = [...existing];
        const prev: SetLogEntry = { weight: '', reps: '', ...updated[setIndex] };
        updated[setIndex] = { ...prev, [field]: validated };

        if (field === 'rpe' && validated) {
          const rpeNum = parseFloat(validated);
          if (!isNaN(rpeNum)) updated[setIndex].rir = String(Math.max(0, Math.min(10, 10 - rpeNum)));
        } else if (field === 'rir' && validated) {
          const rirNum = parseFloat(validated);
          if (!isNaN(rirNum)) updated[setIndex].rpe = String(Math.max(1, Math.min(10, 10 - rirNum)));
        }

        const next = { ...prevLogs, [exerciseIndex]: updated };
        AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [sessionId]
  );

  const toggleSetCompletion = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      editGenRef.current += 1;
      triggerHaptic.light();
      setSetCompletions((prev) => {
        const current = prev[exerciseIndex] || new Set<number>();
        const next = new Set(current);
        if (next.has(setIndex)) next.delete(setIndex);
        else next.add(setIndex);
        const numSets = getEffectiveSetCount(exerciseIndex);
        const newState = { ...prev, [exerciseIndex]: next };
        if (numSets > 0 && next.size === numSets) setCompleted((c) => (c.includes(exerciseIndex) ? c : [...c, exerciseIndex]));
        else setCompleted((c) => c.filter((i) => i !== exerciseIndex));
        return newState;
      });
    },
    []
  );

  const startRest = useCallback(
    async (index: number, duration: number | undefined) => {
      triggerHaptic.light();
      void playTimerStart();
      const initial = duration != null && Number.isFinite(duration) ? duration : 60;
      const existing = intervalsRef.current.get(index);
      if (existing) {
        clearInterval(existing);
        intervalsRef.current.delete(index);
      }
      setRestTimers((prev) => ({ ...prev, [index]: { remaining: initial, isRunning: true, isPaused: false, notificationShown: false } }));
      restEndTimeRef.current.set(index, Date.now() + initial * 1000);
      const tickMs = getTickIntervalMs();
      const tickDec = getTickDecrement();
      const id = setInterval(() => {
        setRestTimers((prev) => {
          const current = prev[index];
          if (!current || current.isPaused) return prev;
          let updated = current;
          if (current.remaining <= 10 && current.remaining > 9 && !current.notificationShown) {
            triggerHaptic.warning();
            Toast.show({ type: 'info', text1: '⏱ 10 seconds remaining', text2: 'Get ready for your next set!', visibilityTime: 2000 });
            updated = { ...current, notificationShown: true };
          }
          if (updated.remaining <= tickDec) {
            intervalsRef.current.delete(index);
            restEndTimeRef.current.delete(index);
            playRestComplete();
            speakRestComplete();
            const { [index]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [index]: { ...updated, remaining: updated.remaining - tickDec } };
        });
      }, tickMs);
      intervalsRef.current.set(index, id);
    },
    []
  );

  const toggleRestTimer = useCallback((index: number) => {
    setRestTimers((prev) => {
      const current = prev[index];
      if (!current) return prev;
      return { ...prev, [index]: { ...current, isPaused: !current.isPaused } };
    });
  }, []);

  const stopRestTimer = useCallback(async (index: number) => {
    const id = intervalsRef.current.get(index);
    if (id) {
      clearInterval(id);
      intervalsRef.current.delete(index);
    }
    restEndTimeRef.current.delete(index);
    await playTimerStop();
    setRestTimers((prev) => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const startTimeBasedTimer = useCallback(
    async (index: number, durationSeconds: number) => {
      const existing = intervalsRef.current.get(index);
      if (existing) {
        clearInterval(existing);
        intervalsRef.current.delete(index);
      }
      triggerHaptic.light();
      setTimeBasedTimers((prev) => ({
        ...prev,
        [index]: { remaining: durationSeconds, isRunning: true, isPaused: false, notificationShown: false, beepedAt: [] },
      }));
      timeBasedEndTimeRef.current.set(index, Date.now() + durationSeconds * 1000);
      void playTimerStart();
      const tickMs = getTickIntervalMs();
      const tickDec = getTickDecrement();
      const id = setInterval(() => {
        setTimeBasedTimers((prev) => {
          const current = prev[index];
          if (!current || current.isPaused) return prev;
          let updated = { ...current };
          if (current.remaining <= 10 && current.remaining > 9 && !current.notificationShown) {
            triggerHaptic.warning();
            Toast.show({ type: 'info', text1: '⏱ 10 seconds remaining', visibilityTime: 2000 });
            updated = { ...current, notificationShown: true };
          }
          if (updated.remaining <= 3 && updated.remaining > 0) playCountdownBeep();
          if (updated.remaining <= tickDec) {
            intervalsRef.current.delete(index);
            timeBasedEndTimeRef.current.delete(index);
            playTimerStop();
            const { [index]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [index]: { ...updated, remaining: updated.remaining - tickDec } };
        });
      }, tickMs);
      intervalsRef.current.set(index, id);
    },
    []
  );

  const toggleTimeBasedTimer = useCallback((index: number) => {
    setTimeBasedTimers((prev) => {
      const current = prev[index];
      if (!current) return prev;
      return { ...prev, [index]: { ...current, isPaused: !current.isPaused } };
    });
  }, []);

  const goPrevBlock = useCallback(() => {
    if (blockIndex <= 0) return;
    const next = blockIndex - 1;
    setBlockIndex(next);
    flatListRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
  }, [blockIndex]);

  const goNextBlock = useCallback(() => {
    if (blockIndex >= totalBlocks - 1) return;
    const next = blockIndex + 1;
    setBlockIndex(next);
    flatListRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
  }, [blockIndex, totalBlocks]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (index >= 0 && index < totalBlocks) setBlockIndex(index);
  }, [totalBlocks]);

  const toggleExerciseComplete = useCallback((globalIndex: number) => {
    setCompleted(prev =>
      prev.includes(globalIndex)
        ? prev.filter(i => i !== globalIndex)
        : [...prev, globalIndex]
    );
  }, []);

  const toggleGroupComplete = useCallback((indices: number[]) => {
    setCompleted(prev => {
      const allDone = indices.every(i => prev.includes(i));
      if (allDone) return prev.filter(i => !indices.includes(i));
      const added = new Set(prev);
      indices.forEach(i => added.add(i));
      return Array.from(added);
    });
  }, []);

  // Items for current block only (from renderableItems)
  const itemsForCurrentBlock = (session?.renderableItems ?? []).filter(
    item => item.blockIndex === blockIndex
  );

  // Header: Back to Session, title (block name + "Block x of y"), Prev / Next
  React.useEffect(() => {
    navigation.setOptions({
      title: totalBlocks > 0 ? `${blockName} (${blockIndex + 1}/${totalBlocks})` : 'Block View',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={headerButton}>
          <Text style={headerButtonText}>Session</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={headerNavRow}>
          <TouchableOpacity
            onPress={goPrevBlock}
            disabled={isFirstBlock}
            style={[headerButton, isFirstBlock && headerButtonDisabled]}
          >
            <Text style={[headerButtonText, isFirstBlock && headerButtonTextDisabled]}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNextBlock}
            disabled={isLastBlock}
            style={[headerButton, isLastBlock && headerButtonDisabled]}
          >
            <Text style={[headerButtonText, isLastBlock && headerButtonTextDisabled]}>Next</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, blockName, blockIndex, totalBlocks, isFirstBlock, isLastBlock, goPrevBlock, goNextBlock]);

  if (isLoadingProgram || !session) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['bottom']}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading session…</Text>
      </SafeAreaView>
    );
  }

  if (totalBlocks === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['bottom']}>
        <Text style={styles.emptyText}>No blocks in this session.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back to Session</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const blockViewContext = {
    session: session!,
    completed,
    setCompletions,
    setLogs,
    setNotes,
    setSetNotes,
    sessionId,
    oneRMMap,
    restTimers,
    timeBasedTimers,
    updateSetLog,
    toggleSetCompletion,
    toggleExerciseComplete,
    toggleGroupComplete,
    startRest,
    toggleRestTimer,
    stopRestTimer,
    startTimeBasedTimer,
    toggleTimeBasedTimer,
    getEffectiveSetCount,
    getAdjustedExerciseData,
    getBaseWeight,
    formatTime,
    parseDurationToSeconds,
    shouldShowSetLogging,
    shouldShowSetCheckboxes,
    isWarmupCooldownExercise,
  };

  const renderBlockPage = ({ item }: { item: { block: typeof currentBlock; index: number } }) => {
    const block = item.block;
    const bIndex = item.index;
    const items = (session?.renderableItems ?? []).filter(ri => ri.blockIndex === bIndex);
    return (
      <View style={styles.page}>
        <ScrollView
          style={styles.scrollPage}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          nestedScrollEnabled
        >
          <Text style={styles.blockTitle}>{block.name}</Text>
          {items.map((ri) => (
            <BlockViewItem key={ri.id} item={ri} ctx={blockViewContext} />
          ))}
        </ScrollView>
      </View>
    );
  };

  const data = blocks.map((block, index) => ({ block, index }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderBlockPage}
        keyExtractor={(item) => `block-${item.index}`}
        horizontal
        pagingEnabled
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        nestedScrollEnabled
        onMomentumScrollEnd={onScroll}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
      />
    </SafeAreaView>
  );
}

type BlockViewContext = {
  session: SessionData;
  completed: number[];
  setCompletions: React.Dispatch<React.SetStateAction<Record<number, Set<number>>>>;
  setLogs: SetLogsMap;
  setNotes: Record<string, string>;
  setSetNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sessionId: string;
  oneRMMap: Record<string, number>;
  restTimers: Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean }>;
  timeBasedTimers: Record<number, { remaining: number; isRunning: boolean; isPaused: boolean; notificationShown?: boolean; beepedAt?: number[] }>;
  updateSetLog: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps' | 'rpe' | 'rir', value: string) => Promise<void>;
  toggleSetCompletion: (exerciseIndex: number, setIndex: number) => void;
  toggleExerciseComplete: (i: number) => void;
  toggleGroupComplete: (indices: number[]) => void;
  startRest: (index: number, duration: number | undefined) => Promise<void>;
  toggleRestTimer: (index: number) => void;
  stopRestTimer: (index: number) => Promise<void>;
  startTimeBasedTimer: (index: number, durationSeconds: number) => Promise<void>;
  toggleTimeBasedTimer: (index: number) => void;
  getEffectiveSetCount: (exerciseIndex: number) => number;
  getAdjustedExerciseData: (ex: FlattenedExercise) => FlattenedExercise;
  getBaseWeight: (ex: FlattenedExercise) => number | null;
  formatTime: (seconds: number) => string;
  parseDurationToSeconds: (duration: string | undefined) => number;
  shouldShowSetLogging: (ex: FlattenedExercise) => boolean;
  shouldShowSetCheckboxes: (ex: FlattenedExercise) => boolean;
  isWarmupCooldownExercise: (ex: FlattenedExercise) => boolean;
};

function BlockViewItem({ item, ctx }: { item: RenderableItem; ctx: BlockViewContext }) {
  const {
    session,
    completed,
    setCompletions,
    setLogs,
    setNotes,
    setSetNotes,
    sessionId,
    restTimers,
    timeBasedTimers,
    updateSetLog,
    toggleSetCompletion,
    toggleExerciseComplete,
    toggleGroupComplete,
    startRest,
    toggleRestTimer,
    stopRestTimer,
    startTimeBasedTimer,
    toggleTimeBasedTimer,
    getEffectiveSetCount,
    getAdjustedExerciseData,
    getBaseWeight,
    formatTime,
    parseDurationToSeconds,
    shouldShowSetLogging,
    shouldShowSetCheckboxes,
    isWarmupCooldownExercise,
  } = ctx;

  const [cuesExpanded, setCuesExpanded] = useState<Record<number, boolean>>({});

  if (item.type === 'exercise' && item.exerciseIndex !== undefined && item.exercise) {
    const ex = item.exercise;
    const globalIdx = item.exerciseIndex;
    const done = completed.includes(globalIdx);
    const numSets = getEffectiveSetCount(globalIdx);
    const showSetLogging = shouldShowSetLogging(ex);
    const showCheckboxes = shouldShowSetCheckboxes(ex);
    const timeBased = isTimeBased(ex);
    const restSec = ex.rest ?? 60;
    const suggestedWeight = getBaseWeight(ex);
    const oneRM = oneRMMap[ex.name];
    const hasCues = !!(ex.instruction || ex.notes || ex.definition || (suggestedWeight != null && oneRM != null));
    const cuesOpen = cuesExpanded[globalIdx] ?? false;

    return (
      <View style={[styles.card, done && styles.rowDone]}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExerciseComplete(globalIdx)}
          activeOpacity={0.7}
        >
          <Text style={styles.checkbox}>{done ? '✓' : '○'}</Text>
          <Text style={styles.exerciseName} numberOfLines={2}>{ex.name}</Text>
        </TouchableOpacity>

        {(ex.intensity || ex.tempo) && (
          <View style={styles.metaLineWrap}>
            <Text style={styles.metaLine} numberOfLines={1}>
              {[ex.intensity && `Intensity: ${ex.intensity}`, ex.tempo && `Tempo: ${ex.tempo}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        {hasCues && (
          <View style={styles.cuesSection}>
            <TouchableOpacity
              style={styles.cuesToggleRow}
              onPress={() => setCuesExpanded(prev => ({ ...prev, [globalIdx]: !cuesOpen }))}
              activeOpacity={0.7}
            >
              <Text style={styles.cuesToggleText}>{cuesOpen ? '▼' : '▶'} Cues & notes</Text>
            </TouchableOpacity>
            {cuesOpen && (
              <View style={styles.cuesBlock}>
                {suggestedWeight != null && oneRM != null && (
                  <View style={styles.suggestedWeightBlock}>
                    <Text style={styles.suggestedWeightTitle}>Suggested weight</Text>
                    <Text style={styles.suggestedWeightLine}>Use {suggestedWeight} lbs for this exercise.</Text>
                    <Text style={styles.cueNotes}>
                      1RM: {oneRM} lbs · Training max (90%): {Math.round(oneRM * 0.9)} lbs · This load is ~{Math.round((suggestedWeight / oneRM) * 100)}% of 1RM
                    </Text>
                  </View>
                )}
                {ex.instruction && <Text style={styles.cueInstruction}>Cues: {ex.instruction}</Text>}
                {ex.notes && <Text style={styles.cueNotes}>Notes: {ex.notes}</Text>}
                {ex.definition && (
                  <View style={styles.definitionBlock}>
                    <Text style={styles.definitionText}>{ex.definition}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {timeBased && ex.duration && (
          <View style={styles.timerSection}>
            {ex.sets === 1 ? (
              <TimeBasedTimerRow
                exerciseIndex={globalIdx}
                duration={ex.duration}
                timer={timeBasedTimers[globalIdx]}
                formatTime={formatTime}
                parseDurationToSeconds={parseDurationToSeconds}
                onStart={() => startTimeBasedTimer(globalIdx, parseDurationToSeconds(ex.duration))}
                onToggle={() => toggleTimeBasedTimer(globalIdx)}
              />
            ) : (
              <IntervalTimer
                totalSets={ex.sets ?? 1}
                workDuration={parseDurationToSeconds(ex.duration) / (ex.sets ?? 1)}
                restDuration={restSec}
                exerciseName={ex.name}
                instruction={ex.instruction}
              />
            )}
          </View>
        )}

        {showCheckboxes && !showSetLogging && !timeBased && numSets > 0 && (
          <View style={styles.setsSection}>
            {Array.from({ length: numSets }, (_, setIndex) => {
              const isSetDone = setCompletions[globalIdx]?.has(setIndex);
              const repsDisplay = ex.reps != null ? String(ex.reps) : '—';
              return (
                <TouchableOpacity
                  key={`set-${setIndex}`}
                  style={[styles.setCheckboxRow, isSetDone && styles.setCheckboxRowDone]}
                  onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                >
                  <Text style={styles.checkbox}>{isSetDone ? '✓' : '○'}</Text>
                  <Text style={styles.setLabel}>Set {setIndex + 1} ({repsDisplay})</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {showSetLogging && numSets > 0 && (
          <View style={styles.setsSection}>
            {Array.from({ length: numSets }, (_, setIndex) => {
              const weight = setLogs[globalIdx]?.[setIndex]?.weight ?? '';
              const reps = setLogs[globalIdx]?.[setIndex]?.reps ?? '';
              const rpe = setLogs[globalIdx]?.[setIndex]?.rpe ?? '';
              const isSetDone = setCompletions[globalIdx]?.has(setIndex);
              const timer = restTimers[globalIdx];
              const restDuration = restSec;
              return (
                <View key={`log-${setIndex}`} style={styles.setLogBlock}>
                  <View style={styles.setLogRow}>
                    <Text style={styles.setLogLabel}>Set {setIndex + 1}</Text>
                    <View style={styles.setLogInputs}>
                      <TextInput
                        style={styles.input}
                        value={weight}
                        onChangeText={(v) => updateSetLog(globalIdx, setIndex, 'weight', v)}
                        placeholder={suggestedWeight != null ? `${suggestedWeight}` : 'Wt'}
                        placeholderTextColor={THEME.textSecondary}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.setLogUnit}>lbs</Text>
                      <TextInput
                        style={styles.input}
                        value={reps}
                        onChangeText={(v) => updateSetLog(globalIdx, setIndex, 'reps', v)}
                        placeholder={ex.reps != null ? String(ex.reps) : 'Reps'}
                        placeholderTextColor={THEME.textSecondary}
                        keyboardType="number-pad"
                      />
                      <TextInput
                        style={styles.input}
                        value={rpe}
                        onChangeText={(v) => updateSetLog(globalIdx, setIndex, 'rpe', v)}
                        placeholder={ex.targetRPE != null ? `RPE ${ex.targetRPE}` : 'RPE'}
                        placeholderTextColor={THEME.textSecondary}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.setCheckboxSmall, isSetDone && styles.setCheckboxRowDone]}
                      onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                    >
                      <Text style={styles.checkbox}>{isSetDone ? '✓' : '○'}</Text>
                    </TouchableOpacity>
                    <View style={styles.restTimerWrap}>
                      {!timer ? (
                        <TouchableOpacity
                          style={styles.restButton}
                          onPress={() => startRest(globalIdx, restDuration)}
                        >
                          <Text style={styles.restButtonText}>Rest {restDuration}s</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.restButton, styles.restButtonActive]}
                          onPress={() => toggleRestTimer(globalIdx)}
                        >
                          <Text style={styles.restButtonText}>
                            {timer.isPaused ? `⏸ ${formatTime(timer.remaining)}` : `⏱ ${formatTime(timer.remaining)}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {suggestedWeight != null && !weight.trim() && (
                    <TouchableOpacity
                      style={styles.useSuggestedButton}
                      onPress={() => updateSetLog(globalIdx, setIndex, 'weight', suggestedWeight.toString())}
                    >
                      <Text style={styles.useSuggestedButtonText}>Use suggested: {suggestedWeight} lbs</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {!showSetLogging && !showCheckboxes && !timeBased && (
          <View style={styles.setsSection}>
            <Text style={styles.hintText}>Tap header to mark complete</Text>
          </View>
        )}
      </View>
    );
  }

  if ((item.type === 'circuit' || item.type === 'superset' || item.type === 'complex') && item.exerciseIndices && item.exercises) {
    const indices = item.exerciseIndices;
    const completedCount = indices.filter((i) => completed.includes(i)).length;
    const allDone = completedCount === indices.length;
    return (
      <View style={[styles.card, styles.groupCard, allDone && styles.rowDone]}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleGroupComplete(indices)}
          activeOpacity={0.7}
        >
          <Text style={styles.checkbox}>{allDone ? '✓' : '○'}</Text>
          <View style={styles.groupInfo}>
            <Text style={styles.groupLabel}>{item.type}</Text>
            <Text style={styles.progressText}>{completedCount}/{indices.length}</Text>
          </View>
        </TouchableOpacity>
        {item.exercises.map((ex, idx) => {
          const globalIdx = indices[idx];
          if (globalIdx == null) return null;
          const exDone = completed.includes(globalIdx);
          const numSets = getEffectiveSetCount(globalIdx);
          const showLog = shouldShowSetLogging(ex);
          const showCb = shouldShowSetCheckboxes(ex);
          const timeBased = isTimeBased(ex);
          const restSec = ex.rest ?? 60;
          const suggestedWeight = getBaseWeight(ex);
          const oneRM = oneRMMap[ex.name];
          const hasCues = !!(ex.instruction || ex.notes || ex.definition || (suggestedWeight != null && oneRM != null));
          const cuesOpen = cuesExpanded[globalIdx] ?? false;
          return (
            <View key={`${globalIdx}`} style={styles.groupExercise}>
              <TouchableOpacity
                style={styles.groupExerciseHeader}
                onPress={() => toggleExerciseComplete(globalIdx)}
              >
                <Text style={styles.checkbox}>{exDone ? '✓' : '○'}</Text>
                <Text style={styles.exerciseNameSmall} numberOfLines={1}>{ex.name}</Text>
              </TouchableOpacity>
              {(ex.intensity || ex.tempo) && (
                <View style={styles.metaLineWrap}>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    {[ex.intensity && `Intensity: ${ex.intensity}`, ex.tempo && `Tempo: ${ex.tempo}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {hasCues && (
                <View style={styles.cuesSection}>
                  <TouchableOpacity
                    style={styles.cuesToggleRow}
                    onPress={() => setCuesExpanded(prev => ({ ...prev, [globalIdx]: !cuesOpen }))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cuesToggleText}>{cuesOpen ? '▼' : '▶'} Cues & notes</Text>
                  </TouchableOpacity>
                  {cuesOpen && (
                    <View style={styles.cuesBlock}>
                      {suggestedWeight != null && oneRM != null && (
                        <View style={styles.suggestedWeightBlock}>
                          <Text style={styles.suggestedWeightTitle}>Suggested weight</Text>
                          <Text style={styles.suggestedWeightLine}>Use {suggestedWeight} lbs for this exercise.</Text>
                          <Text style={styles.cueNotes}>
                            1RM: {oneRM} lbs · Training max (90%): {Math.round(oneRM * 0.9)} lbs · This load is ~{Math.round((suggestedWeight / oneRM) * 100)}% of 1RM
                          </Text>
                        </View>
                      )}
                      {ex.instruction && <Text style={styles.cueInstruction}>Cues: {ex.instruction}</Text>}
                      {ex.notes && <Text style={styles.cueNotes}>Notes: {ex.notes}</Text>}
                      {ex.definition && (
                        <View style={styles.definitionBlock}>
                          <Text style={styles.definitionText}>{ex.definition}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
              {showLog && numSets > 0 && (
                <View style={styles.setsSection}>
                  {Array.from({ length: numSets }, (_, setIndex) => {
                    const weight = setLogs[globalIdx]?.[setIndex]?.weight ?? '';
                    const reps = setLogs[globalIdx]?.[setIndex]?.reps ?? '';
                    const isSetDone = setCompletions[globalIdx]?.has(setIndex);
                    const timer = restTimers[globalIdx];
                    return (
                      <View key={`${globalIdx}-${setIndex}`} style={styles.setLogBlock}>
                        <View style={styles.setLogRow}>
                          <Text style={styles.setLogLabel}>Set {setIndex + 1}</Text>
                          <View style={styles.setLogInputs}>
                            <TextInput
                              style={styles.inputSmall}
                              value={weight}
                              onChangeText={(v) => updateSetLog(globalIdx, setIndex, 'weight', v)}
                              placeholder={suggestedWeight != null ? `${suggestedWeight}` : 'Wt'}
                              placeholderTextColor={THEME.textSecondary}
                              keyboardType="decimal-pad"
                            />
                            <TextInput
                              style={styles.inputSmall}
                              value={reps}
                              onChangeText={(v) => updateSetLog(globalIdx, setIndex, 'reps', v)}
                              placeholder={ex.reps != null ? String(ex.reps) : 'R'}
                              placeholderTextColor={THEME.textSecondary}
                              keyboardType="number-pad"
                            />
                          </View>
                          <TouchableOpacity onPress={() => toggleSetCompletion(globalIdx, setIndex)}>
                            <Text style={styles.checkbox}>{isSetDone ? '✓' : '○'}</Text>
                          </TouchableOpacity>
                          {!timer ? (
                            <TouchableOpacity style={styles.restButtonSmall} onPress={() => startRest(globalIdx, restSec)}>
                              <Text style={styles.restButtonText}>Rest</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={[styles.restButtonSmall, styles.restButtonActive]} onPress={() => toggleRestTimer(globalIdx)}>
                              <Text style={styles.restButtonText}>{formatTime(timer.remaining)}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {suggestedWeight != null && !weight.trim() && (
                          <TouchableOpacity
                            style={styles.useSuggestedButton}
                            onPress={() => updateSetLog(globalIdx, setIndex, 'weight', suggestedWeight.toString())}
                          >
                            <Text style={styles.useSuggestedButtonText}>Use suggested: {suggestedWeight} lbs</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
              {showCb && !showLog && !timeBased && numSets > 0 && (
                <View style={styles.setsSection}>
                  {Array.from({ length: numSets }, (_, setIndex) => {
                    const isSetDone = setCompletions[globalIdx]?.has(setIndex);
                    return (
                      <TouchableOpacity
                        key={`cb-${setIndex}`}
                        style={styles.setCheckboxRow}
                        onPress={() => toggleSetCompletion(globalIdx, setIndex)}
                      >
                        <Text style={styles.checkbox}>{isSetDone ? '✓' : '○'}</Text>
                        <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {timeBased && ex.duration && (
                <TimeBasedTimerRow
                  exerciseIndex={globalIdx}
                  duration={ex.duration}
                  timer={timeBasedTimers[globalIdx]}
                  formatTime={formatTime}
                  parseDurationToSeconds={parseDurationToSeconds}
                  onStart={() => startTimeBasedTimer(globalIdx, parseDurationToSeconds(ex.duration))}
                  onToggle={() => toggleTimeBasedTimer(globalIdx)}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return null;
}

function TimeBasedTimerRow({
  exerciseIndex,
  duration,
  timer,
  formatTime,
  parseDurationToSeconds,
  onStart,
  onToggle,
}: {
  exerciseIndex: number;
  duration: string | undefined;
  timer: { remaining: number; isRunning: boolean; isPaused: boolean } | undefined;
  formatTime: (s: number) => string;
  parseDurationToSeconds: (d: string | undefined) => number;
  onStart: () => void;
  onToggle: () => void;
}) {
  const sec = parseDurationToSeconds(duration);
  if (!timer) {
    return (
      <TouchableOpacity style={styles.restButton} onPress={onStart}>
        <Text style={styles.restButtonText}>Start {duration} ({sec}s)</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={[styles.restButton, styles.restButtonActive]} onPress={onToggle}>
      <Text style={styles.restButtonText}>
        {timer.isPaused ? `⏸ ${formatTime(timer.remaining)}` : `⏱ ${formatTime(timer.remaining)}`}
      </Text>
    </TouchableOpacity>
  );
}

const headerButton = { paddingHorizontal: 12, paddingVertical: 8 };
const headerButtonText = { fontSize: 16, color: THEME.primary, fontWeight: '600' };
const headerButtonDisabled = { opacity: 0.5 };
const headerButtonTextDisabled = { color: THEME.textSecondary };
const headerNavRow = { flexDirection: 'row' as const, alignItems: 'center', gap: 8 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textSecondary,
  },
  emptyText: {
    fontSize: 16,
    color: THEME.textSecondary,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: THEME.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  scrollPage: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    marginBottom: 8,
  },
  rowDone: {
    backgroundColor: THEME.secondaryFaded,
  },
  card: {
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  groupCard: {
    paddingBottom: 8,
  },
  groupInfo: {
    flex: 1,
  },
  groupLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  groupExercise: {
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.textSecondary + '20',
  },
  groupExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  exerciseNameSmall: {
    flex: 1,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  checkbox: {
    fontSize: 20,
    color: THEME.primary,
    marginRight: 12,
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  progressText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  timerSection: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  setsSection: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  setCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  setCheckboxRowDone: {
    opacity: 0.8,
  },
  setCheckboxSmall: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  setLabel: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  setLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  setLogLabel: {
    width: 44,
    fontSize: 13,
    color: THEME.textSecondary,
  },
  setLogInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    minWidth: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.background,
    borderRadius: 6,
    fontSize: 15,
    color: THEME.textPrimary,
  },
  inputSmall: {
    width: 48,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: THEME.background,
    borderRadius: 6,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  setLogUnit: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  restTimerWrap: {
    marginLeft: 'auto',
  },
  restButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.primary + '22',
    borderRadius: 8,
  },
  restButtonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: THEME.primary + '22',
    borderRadius: 6,
  },
  restButtonActive: {
    backgroundColor: THEME.primary + '44',
  },
  restButtonText: {
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: THEME.textSecondary,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  metaLineWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  metaLine: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  cuesSection: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cuesToggleRow: {
    paddingVertical: 6,
  },
  cuesToggleText: {
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '500',
  },
  cuesBlock: {
    marginTop: 4,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.textSecondary + '30',
  },
  suggestedWeightBlock: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.primary + '18',
    borderRadius: 8,
  },
  suggestedWeightTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 4,
  },
  suggestedWeightLine: {
    fontSize: 12,
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  cueInstruction: {
    fontSize: 12,
    color: THEME.secondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  cueNotes: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  definitionBlock: {
    backgroundColor: THEME.secondaryFaded,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  definitionText: {
    fontSize: 12,
    color: THEME.textPrimary,
    lineHeight: 18,
  },
  setLogBlock: {
    marginBottom: 12,
  },
  useSuggestedButton: {
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.primary + '22',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  useSuggestedButtonText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '600',
  },
});
