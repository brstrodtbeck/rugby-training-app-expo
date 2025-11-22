import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// ---- Date-only helpers (no timezones) ----
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // local date at midnight
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
  // Round to handle DST transitions robustly
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export default function HomeScreen({ navigation }: Props) {
  const [startDateYMD, setStartDateYMD] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{ id: string; date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Load startDate (stored as YYYY-MM-DD)
  useEffect(() => {
    const loadStartDate = async () => {
      const stored = await AsyncStorage.getItem('startDateYMD');
      if (stored) {
        setStartDateYMD(stored);
      }
    };
    loadStartDate();
  }, []);

  // Load completed sessions whenever screen is focused, cleaning invalid entries
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

  // Convert sessionId to calendar date (YYYY-MM-DD) using date-only math
  function getDateFromSessionId(sessionId?: string, startYMD?: string): string {
    if (!sessionId || !startYMD) return '';
    const match = sessionId.match(/week(\d+)-day-(\d+)/);
    if (!match) return '';
    const week = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const offsetDays = week * 7 + (day - 1);
    return addDaysYMD(startYMD, offsetDays);
  }

  // Build markedDates for calendar
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

  // Handle day press → compute sessionId based on date-only offset
  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);

    if (!startDateYMD) {
      console.warn('Start date not set — cannot calculate session ID');
      return;
    }

    const offsetDays = daysBetweenYMD(startDateYMD, day.dateString);
    const mesoId = 'm1'; // hardcoded for now
    const week = Math.floor(offsetDays / 7);
    const dayNumber = (offsetDays % 7) + 1;
    const sessionId = `${mesoId}-week${week}-day-${dayNumber}`;

    console.log('➡️ Navigating to session:', sessionId, 'offsetDays:', offsetDays);
    navigation.navigate('Session', { sessionId });
  };

  // Handle start date change (picker)
  const handleDateChange = async (_event: any, date?: Date) => {
    if (date) {
      setShowPicker(Platform.OS === 'ios'); // keep open on iOS
      const ymd = formatYMD(date);
      setStartDateYMD(ymd);
      await AsyncStorage.setItem('startDateYMD', ymd);
      console.log('📅 Start date set (YMD):', ymd);
    } else {
      setShowPicker(false);
    }
  };

  // Reset completed sessions with confirmation
  const resetCompletedSessions = async () => {
    Alert.alert('Reset progress', 'Clear all completed sessions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('completedSessions');
          setCompletedSessions([]);
          console.log('🔄 Completed sessions reset');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
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

      <View style={{ marginTop: 20 }}>
        <Button title="Pick Start Date" onPress={() => setShowPicker(true)} />
      </View>

      {showPicker && (
        <DateTimePicker
          value={startDateYMD ? parseYMD(startDateYMD) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <View style={{ marginTop: 20 }}>
        <Button title="Reset Completed Sessions" color="red" onPress={resetCompletedSessions} />
      </View>
      <View style={{ marginTop: 20 }}>
        <Button
          title="Go to My 1RMs"
          onPress={() => navigation.navigate('My1RMs')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  startDate: { fontSize: 16, marginBottom: 12, color: '#333' },
  legend: { marginBottom: 8 },
  legendItem: { fontSize: 14, color: '#555' },
});