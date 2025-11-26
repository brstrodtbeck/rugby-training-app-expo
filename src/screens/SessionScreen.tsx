import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RugbyProgram, TrainingSession, Mesocycle, MicrocycleDay } from '../types';
import { calculateSuggestedWeight } from '../utils/loadCalculator';

import rugbyDataRaw from '../data/rugbyProgram.json';
const rugbyData: RugbyProgram = rugbyDataRaw as RugbyProgram;

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;

  // Flatten all days across mesocycles
  const allDays: TrainingSession[] = rugbyData.macrocycle.mesocycles.flatMap(
    (meso: Mesocycle) =>
      (meso.microcycle || []).map((day: MicrocycleDay) => ({
        ...day,
        mesoId: meso.id,
      }))
  );

  // Match by id directly (e.g. "m1-week0-day-1")
  const session: TrainingSession | undefined = allDays.find(
    (d: TrainingSession) => d.id === sessionId
  );

  const [completed, setCompleted] = useState<number[]>([]);
  const [restTimers, setRestTimers] = useState<{ [key: number]: number }>({});
  const [setLogs, setSetLogs] = useState<{ [key: number]: { weight: string; reps: string }[] }>({});
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Load completed sets and logs
  useEffect(() => {
    const loadCompleted = async () => {
      try {
        const stored = await AsyncStorage.getItem(`completed:${sessionId}`);
        if (stored) setCompleted(JSON.parse(stored));

        const logs = await AsyncStorage.getItem(`setLogs:${sessionId}`);
        if (logs) setSetLogs(JSON.parse(logs));
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadCompleted();
  }, [sessionId]);

  // State for 1RMs
  const [oneRMMap, setOneRMMap] = useState<Record<string, number>>({});

  // Preload existing 1RMs for this session’s exercises
  useEffect(() => {
    const loadExisting1RMs = async () => {
      try {
        const map: Record<string, number> = {};
        const names = (session?.exercises ?? []).map((e: any) => e.name);

        for (const name of names) {
          const raw = await AsyncStorage.getItem(`1RM:${name}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.value === 'number') {
              map[name] = parsed.value;
            }
          }
        }
        setOneRMMap(map);
      } catch (error) {
        console.error('Error loading 1RMs:', error);
      }
    };

    if (session) {
      loadExisting1RMs();
    }
  }, [sessionId, session]);

  // States for session summary logging
  const [effort, setEffort] = useState<number>(5);     // RPE scale 1–10
  const [duration, setDuration] = useState<number>(60); // minutes
  const [fatigue, setFatigue] = useState<number>(3);   // 1–5 scale
  const [notes, setNotes] = useState<string>('');      // optional notes

  const toggleComplete = async (index: number) => {
    const updated = completed.includes(index)
      ? completed.filter((i) => i !== index)
      : [...completed, index];

    setCompleted(updated);
    await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(updated));
  };

  const startRest = (index: number, duration: any) => {
    const seconds = parseInt(duration, 10);
    const initial = Number.isFinite(seconds) ? seconds : 30;

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
    await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(next));
  };

  async function finishSession() {
    try {
      if (!session) {
        console.error('❌ Cannot finish session: session is undefined');
        return;
      }

      // Add to global completedSessions for calendar highlighting
      const existing = await AsyncStorage.getItem('completedSessions');
      const parsed = existing ? JSON.parse(existing) : [];

      const newSession = {
        id: sessionId,
        title: session.title, // ✅ ensure workout name is saved
        date: new Date().toISOString().split('T')[0],
        load: effort * duration,
        fatigue,
        notes,
      };

      parsed.push(newSession);
      await AsyncStorage.setItem('completedSessions', JSON.stringify(parsed));

      // Clean up timers
      intervalsRef.current.forEach((id) => clearInterval(id));
      intervalsRef.current.clear();
      setRestTimers({});

      // Navigate to summary
      navigation.navigate('SessionSummary', { 
        sessionId, 
        completed, 
        session: {
          ...session,
          title: session.title // ✅ pass workout name
        }
      });
    } catch (error) {
      console.error('Error finishing session:', error);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Session not found</Text>
      </SafeAreaView>
    );
  }

  const progress =
    session.exercises?.length ? completed.length / session.exercises.length : 0;

  const suggestedWeight = (exerciseName: string, percent: number) => {
    const oneRM = oneRMMap[exerciseName];
    return oneRM ? Math.round(oneRM * percent) : null;
  };
  // Helper: decide if an exercise is a weight-lift
  const isWeightLift = (exerciseName: string) => {
    const lifts = [
      'squat',
      'bench',
      'press',
      'deadlift',
      'clean',
      'snatch',
      'row',
      'curl',
      'pull',
      'push',
    ];
    return lifts.some(lift => exerciseName.toLowerCase().includes(lift));
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{session.title}</Text>

      <View style={{ marginBottom: 20 }}>
        <Progress.Bar
          progress={progress}
          width={null}
          height={12}
          color="#28a745"
          borderRadius={6}
        />
        <Text style={{ marginTop: 6 }}>{Math.round(progress * 100)}% Complete</Text>
      </View>

      <FlatList
        data={session?.exercises || []}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={[
                styles.exerciseBlock,
                completed.includes(index) && styles.completedCard,
              ]}
              onPress={() => toggleComplete(index)}
            >
              <Text style={styles.exercise}>{item.name}</Text>
              <Text style={styles.detail}>Sets: {item.sets}</Text>
              <Text style={styles.detail}>Reps: {String(item.reps)}</Text>
              <Text style={styles.detail}>Rest: {item.rest} sec</Text>

              {/* ✅ Only show suggested weight for lifting exercises */}
              {isWeightLift(item.name) && (
                <Text style={styles.detail}>
                  Suggested: {calculateSuggestedWeight(item.name, oneRMMap, item.sets, Number(item.reps)) ?? '—'} lbs
                </Text>
              )}

              <Text style={styles.status}>
                {completed.includes(index) ? '✅ Completed' : 'Tap to mark done'}
              </Text>
            </TouchableOpacity>

            {item.trackSets &&
              Number.isInteger(Number(item.sets)) &&
              [...Array(Number(item.sets))].map((_, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Weight (lbs)"
                    keyboardType="numeric"
                    value={setLogs[index]?.[setIndex]?.weight || ''}
                    onChangeText={(text) =>
                      updateSetLog(index, setIndex, 'weight', text)
                    }
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Reps"
                    keyboardType="numeric"
                    value={setLogs[index]?.[setIndex]?.reps || ''}
                    onChangeText={(text) =>
                      updateSetLog(index, setIndex, 'reps', text)
                    }
                  />
                </View>
              ))}

            {restTimers[index] !== undefined ? (
              <Text style={styles.timer}>⏱ Rest: {restTimers[index]}s remaining</Text>
            ) : (
              <TouchableOpacity
                style={styles.restButton}
                onPress={() => startRest(index, item.rest)}
              >
                <Text style={styles.restText}>Start Rest</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />

        {/* Modal access to 1RM calculator with session-aware callback */}
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

        <TouchableOpacity style={styles.finishButton} onPress={finishSession}>
          <Text style={styles.finishText}>🏁 Finish Session</Text>
        </TouchableOpacity>
        </SafeAreaView>
        );
        }

        // ✅ styles defined after the component, at module level
        const styles = StyleSheet.create({
          container: { flex: 1, padding: 20, backgroundColor: '#fff' },
          header: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
          card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
          exerciseBlock: {},
          completedCard: {
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#0a84ff',
          },
          detail: { marginTop: 2, color: '#333' },
          exercise: { fontSize: 16, fontWeight: '600' },
          status: { marginTop: 6, color: '#555' },
          setRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
          },
          setLabel: { width: 64, fontWeight: '500' },
          input: {
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 6,
            padding: 8,
            flex: 1,
          },
          timer: { marginTop: 8, color: '#333' },
          restButton: {
            marginTop: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: '#0a84ff',
            borderRadius: 6,
            alignSelf: 'flex-start',
          },
          restText: { color: '#fff', fontWeight: '600' },
          oneRMButton: {
            marginTop: 16,
            paddingVertical: 12,
            backgroundColor: '#0a84ff',
            borderRadius: 8,
            alignItems: 'center',
          },
          oneRMText: { color: '#fff', fontWeight: '700' },
          finishButton: {
            marginTop: 16,
            paddingVertical: 12,
            backgroundColor: '#28a745',
            borderRadius: 8,
            alignItems: 'center',
          },
          finishText: { color: '#fff', fontWeight: '700' },
        });