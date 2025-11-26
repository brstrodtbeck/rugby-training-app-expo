import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CompletedSession } from '../types';
import { calculateSuggestedLoad } from '../utils/loadCalculator';
import { getAllOneRMs } from '../utils/oneRMStore';
import { updateOneRMFromSession } from '../utils/oneRMUpdater';
import { StyleSheet } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

// Helpers
const formatDate = (isoDate: string) => {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
};

const getLoadCategory = (load: number | undefined) => {
  if (!load || load <= 0) return "None";
  if (load <= 150) return "Light";
  if (load <= 300) return "Moderate";
  if (load <= 600) return "High";
  return "Very High";
};

const getLoadColor = (load: number | undefined) => {
  if (!load || load <= 0) return "#6c757d";
  if (load <= 150) return "#28a745";
  if (load <= 300) return "#ffc107";
  if (load <= 600) return "#fd7e14";
  return "#dc3545";
};

const getPrilepinColor = (adjustedPercent: number, originalPercent: number) => {
  if (adjustedPercent === originalPercent) return "#28a745";
  if (Math.abs(adjustedPercent - originalPercent) <= 5) return "#ffc107";
  return "#dc3545";
};

// ✅ Child component for exercises
const ExerciseRow = ({ item, oneRM }: { item: any; oneRM: number }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [suggestion, setSuggestion] = useState<{ load: number; adjustedPercent: number } | null>(null);

  useEffect(() => {
    const fetchLoad = async () => {
      const result = await calculateSuggestedLoad(item.name, item.intensity || '', item.sets, item.reps);
      setSuggestion(result);
    };
    fetchLoad();
  }, [item]);

  return (
    <View style={styles.exerciseRow}>
      <Text style={styles.exerciseName}>{item.name}</Text>
      <Text style={styles.exerciseDetails}>
        Sets: {item.sets} | Reps: {item.reps} | Rest: {item.rest}s
      </Text>
      {item.intensity && <Text style={styles.exerciseDetails}>Intensity: {item.intensity}</Text>}
      {suggestion && (
        <Text
          style={[
            styles.exerciseDetails,
            { color: getPrilepinColor(suggestion.adjustedPercent, parseInt(item.intensity?.match(/(\d+)%/)?.[1] || '0')) },
          ]}
        >
          🔹 Suggested Load: {suggestion.load} lbs ({suggestion.adjustedPercent}% 1RM)
        </Text>
      )}

      {/* ✅ History button */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('OneRMHistory', { exerciseName: item.name })}
      >
        <Text style={styles.historyText}>📈 View History</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function SessionSummary({ route, navigation }: Props) {
  const { sessionId, completed, session } = route.params;

  if (!session || !session.exercises) {
    console.warn("⚠️ Session object or exercises missing:", session);
    return (
      <View style={styles.container}>
        <Text style={styles.header}>⚠️ Session data not available</Text>
        <Text>Please return to the previous screen and try again.</Text>
      </View>
    );
  }

  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [effort, setEffort] = useState<string>('5');
  const [duration, setDuration] = useState<string>('60');
  const [fatigue, setFatigue] = useState<string>('3');
  const [notes, setNotes] = useState<string>('');
  const [oneRMs, setOneRMs] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const stored = await AsyncStorage.getItem('completedSessions');
        if (stored) {
          setSessions(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading completed sessions:', error);
      }
    };

    const loadOneRMs = async () => {
      const storedOneRMs = await getAllOneRMs();
      setOneRMs(storedOneRMs);
    };

    loadSessions();
    loadOneRMs();
  }, []);

  const saveSummary = async () => {
    try {
      const stored = await AsyncStorage.getItem('completedSessions');
      const allSessions: CompletedSession[] = stored ? JSON.parse(stored) : [];

      const newSummary: CompletedSession = {
        id: sessionId,
        title: session.title,
        date: new Date().toISOString().split('T')[0],
        load: Number(effort) * Number(duration),
        fatigue: Number(fatigue),
        notes,
      };

      allSessions.push(newSummary);
      await AsyncStorage.setItem('completedSessions', JSON.stringify(allSessions));
      setSessions(allSessions);
      console.log('✅ Summary saved:', newSummary);

      // 🔥 Update 1RM for each exercise in this session using best set
      session.exercises.forEach((exercise: any) => {
        if (exercise.setsData) {
          updateOneRMFromSession(exercise.name, exercise.setsData);
        }
      });
    } catch (error) {
      console.error('Error saving summary:', error);
    }
  };

  const renderPastItem = ({ item }: { item: CompletedSession }) => {
    const category = getLoadCategory(item.load);
    const color = getLoadColor(item.load);

    return (
      <View style={styles.card}>
        <Text style={styles.subheader}>
          Session: {item.title ? item.title : item.id}
        </Text>
        <Text>Date: {formatDate(item.date)}</Text>
        <Text style={{ color }}>
          Training Load: {item.load ?? '-'} ({category})
          {"\n"}• Calculated as Effort × Duration (sRPE Load)
        </Text>
        <Text>
          Fatigue: {item.fatigue ?? '-'}
          {"\n"}• Self‑rated tiredness on a 1–5 scale
        </Text>
        {item.notes ? <Text>Notes: {item.notes}</Text> : null}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>🏁 Session Summary</Text>
      <Text style={styles.subheader}>Session: {session.title}</Text>
      <Text style={styles.count}>Completed exercises: {completed.length}</Text>

      <Text style={styles.sectionHeader}>📋 Exercises Completed</Text>
      <FlatList
        data={session.exercises}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => <ExerciseRow item={item} oneRM={oneRMs[item.name] ?? 100} />}
        scrollEnabled={false}
      />

      {/* Effort, Duration, Fatigue, Notes inputs unchanged */}

      <TouchableOpacity style={styles.saveButton} onPress={saveSummary}>
        <Text style={styles.saveText}>💾 Save Summary</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate('OneRMInput', { session })}
      >
        <Text style={styles.navText}>⚡ Update 1RMs</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>📊 Past Sessions</Text>
      {sessions.length === 0 ? (
        <Text>No past sessions logged yet.</Text>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderPastItem}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* ✅ Legend for color coding */}
      <Text style={styles.helperText}>
        ✅ Green = Optimal • ⚠️ Yellow = Borderline • ❌ Red = Outside Prilepin zone
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subheader: { fontSize: 18, marginBottom: 8 },
  count: { fontSize: 18, color: '#28a745', marginBottom: 12 },
  sectionHeader: { fontSize: 20, fontWeight: '600', marginTop: 24, marginBottom: 12 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  navButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#007bff',
    borderRadius: 8,
    alignItems: 'center',
  },
  navText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  exerciseRow: {
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f1f1f1',
    borderRadius: 6,
  },
  exerciseName: { fontWeight: '600', fontSize: 16 },
  exerciseDetails: { fontSize: 14, color: '#555' },
  inputLabel: { marginTop: 12, fontSize: 16, fontWeight: '500' },
  helperText: { fontSize: 13, color: '#555', marginBottom: 6, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
  },
  historyButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#0a84ff',
    borderRadius: 6,
    alignItems: 'center',
  },
  historyText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});