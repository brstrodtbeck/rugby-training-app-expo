import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import ChartComponent from '../components/ChartComponent';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysYMD(ymd: string, days: number): string {
  const dt = parseYMD(ymd);
  dt.setDate(dt.getDate() + days);
  return formatYMD(dt);
}

function daysBetweenYMD(startYMD: string, endYMD: string): number {
  const start = parseYMD(startYMD);
  const end = parseYMD(endYMD);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export default function HomeScreen({ navigation }: Props) {
  const [startDateYMD, setStartDateYMD] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{ id: string; date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const loadStartDate = async () => {
      const stored = await AsyncStorage.getItem('startDateYMD');
      if (stored) {
        setStartDateYMD(stored);
      }
    };
    loadStartDate();
  }, []);

  useEffect(() => {
    const loadCompletedSessions = async () => {
      try {
        const stored = await AsyncStorage.getItem('completedSessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          const cleaned = parsed.filter((s: any) => s.id && typeof s.id === 'string');
          if (cleaned.length !== parsed.length) {
            await AsyncStorage.setItem('completedSessions', JSON.stringify(cleaned));
          }
          setCompletedSessions(cleaned);
        } else {
          setCompletedSessions([]);
        }
      } catch (error) {
        console.error('Error loading completed sessions:', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', loadCompletedSessions);
    return unsubscribe;
  }, [navigation]);

  const getDateFromSessionId = (sessionId?: string, startYMD?: string | null): string => {
    if (!sessionId || !startYMD) return '';
    const match = sessionId.match(/week(\d+)-day-(\d+)/);
    if (!match) return '';
    const week = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const offsetDays = week * 7 + (day - 1);
    return addDaysYMD(startYMD, offsetDays);
  };

  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (startDateYMD) {
      completedSessions.forEach((s) => {
        const date = getDateFromSessionId(s.id, startDateYMD);
        if (date) {
          marks[date] = {
            marked: true,
            dotColor: 'green',
            customStyles: {
              container: { backgroundColor: '#d4fcd2' },
              text: { color: 'black' },
            },
          };
        }
      });
    }
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: '#0a84ff',
      };
    }
    return marks;
  };

  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
    if (!startDateYMD) return;

    const offsetDays = daysBetweenYMD(startDateYMD, day.dateString);
    const mesoId = 'm1';
    const week = Math.floor(offsetDays / 7);
    const dayNumber = (offsetDays % 7) + 1;
    const sessionId = `${mesoId}-week${week}-day-${dayNumber}`;

    navigation.navigate('Session', { sessionId });
  };

  const handleDateChange = async (_event: any, date?: Date) => {
    if (date) {
      setShowPicker(Platform.OS === 'ios');
      const ymd = formatYMD(date);
      setStartDateYMD(ymd);
      await AsyncStorage.setItem('startDateYMD', ymd);
    } else {
      setShowPicker(false);
    }
  };

  const resetCompletedSessions = async () => {
    Alert.alert('Reset progress', 'Clear all completed sessions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('completedSessions');
          setCompletedSessions([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>🏉 Rugby Training Program</Text>

        {startDateYMD && (
          <Text style={styles.startDate}>
            Current start date: {parseYMD(startDateYMD).toDateString()}
          </Text>
        )}

        <View style={styles.legend}>
          <Text style={styles.legendItem}>🟢 Green = Completed session</Text>
          <Text style={styles.legendItem}>🔵 Blue = Selected day</Text>
        </View>

        <Calendar
          markedDates={getMarkedDates()}
          markingType="custom"
          onDayPress={handleDayPress}
        />

        <TouchableOpacity style={styles.navButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.navText}>📅 Pick Start Date</Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={startDateYMD ? parseYMD(startDateYMD) : new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        <TouchableOpacity style={[styles.navButton, { backgroundColor: '#dc3545' }]} onPress={resetCompletedSessions}>
          <Text style={styles.navText}>🗑️ Reset Completed Sessions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('My1RMs')}>
          <Text style={styles.navText}>📈 Go to My 1RMs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navButton, { backgroundColor: '#007bff' }]} onPress={() => navigation.navigate('OneRMInput')}>
          <Text style={styles.navText}>⚡ Set Your 1RMs</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  startDate: { fontSize: 16, marginBottom: 12, color: '#333' },
  legend: { marginBottom: 8 },
  legendItem: { fontSize: 14, color: '#555' },
  navButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
  },
  navText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});