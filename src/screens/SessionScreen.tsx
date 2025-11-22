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
import rugbyData from '../data/rugbyProgram.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;

  // Flatten all days across mesocycles
  const allDays = rugbyData.macrocycle.mesocycles.flatMap((meso: any) =>
    (meso.microcycle || []).map((day: any) => ({
      ...day,
      mesoId: meso.id,
    }))
  );

  // State for 1RMs
  const [oneRMMap, setOneRMMap] = useState<Record<string, number>>({});

  // Match by id directly (e.g. "m1-week0-day-1")
  const session = allDays.find((d: any) => d.id === sessionId);

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

  // Debug logs
  useEffect(() => {
    console.log('✅ Loaded rugbyData:', rugbyData);
    console.log('✅ Session ID:', sessionId);
    console.log('✅ Matched session:', session);
  }, [sessionId, session]);

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

  const markSessionComplete = async () => {
    try {
      if (!sessionId) {
        console.error('❌ Cannot finish session: sessionId is undefined');
        return;
      }

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

      navigation.navigate('SessionSummary', { sessionId, completed });
    } catch (error) {
      console.error('Error finishing session:', error);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Session not found</Text>
      </SafeAreaView>
    );
  }

  const progress =
    session.exercises?.length ? completed.length / session.exercises.length : 0;

  // Helper: calculate suggested weight
  const suggestedWeight = (exerciseName: string, percent: number) => {
    const oneRM = oneRMMap[exerciseName];
    return oneRM ? Math.round(oneRM * percent) : null;
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
        data={session.exercises}
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
              <Text style={styles.detail}>Reps: {item.reps}</Text>
              <Text style={styles.detail}>Rest: {item.rest} sec</Text>

              {/* New suggested weight line */}
              <Text style={styles.detail}>
                Suggested: {suggestedWeight(item.name, 0.7) ?? '—'} lbs (70% 1RM)
              </Text>

              <Text style={styles.status}>
                {completed.includes(index) ? '✅ Completed' : 'Tap to mark done'}
              </Text>
            </TouchableOpacity>

            {item.trackSets &&
              [...Array(item.sets)].map((_, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Weight (lbs)"
                    keyboardType="numeric"
                    value={setLogs[index]?.[setIndex]?.weight || ''}
                    onChangeText={(text) => updateSetLog(index, setIndex, 'weight', text)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Reps"
                    keyboardType="numeric"
                    value={setLogs[index]?.[setIndex]?.reps || ''}
                    onChangeText={(text) => updateSetLog(index, setIndex, 'reps', text)}
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

      <TouchableOpacity style={styles.finishButton} onPress={markSessionComplete}>
        <Text style={styles.finishText}>🏁 Finish Session</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
    borderColor: '#0a84ff', // highlight color for completed
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