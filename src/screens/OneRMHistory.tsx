import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-gifted-charts';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, '1RMHistory'>;
type HistoryRouteProp = RouteProp<RootStackParamList, '1RMHistory'>;

interface HistoryEntry {
  value: number;
  date: string;
}

// Helper to safely parse dates (handles both ISO and toLocaleString formats)
const parseDate = (dateString: string): Date => {
  // Try ISO format first (new format) - e.g., "2024-01-15T20:30:00.000Z"
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime()) && dateString.includes('T')) {
    return isoDate;
  }
  
  // Try parsing toLocaleString() format: "M/D/YYYY, H:MM:SS AM/PM"
  // Example: "12/19/2025, 2:21:01 PM"
  // Note: The space after comma might be a regular space or non-breaking space
  const localeStringPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i;
  const localeMatch = dateString.match(localeStringPattern);
  
  if (localeMatch) {
    const [, month, day, year, hour12, minute, second, ampm] = localeMatch;
    const monthNum = parseInt(month, 10) - 1; // 0-indexed
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    let hour24 = parseInt(hour12, 10);
    
    // Convert 12-hour to 24-hour format
    if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    const date = new Date(yearNum, monthNum, dayNum, hour24, parseInt(minute, 10), parseInt(second, 10));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try other common formats as fallback
  const fallbackDate = new Date(dateString);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }
  
  // Last resort: return current date if parsing fails
  if (__DEV__) {
    console.warn('Failed to parse date:', dateString, 'using current date as fallback');
  }
  return new Date();
};

export default function OneRMHistory(_: Props) {
  const route = useRoute<HistoryRouteProp>();
  const { exerciseName } = route.params;
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(`1RMHistory:${exerciseName}`);
        const data: HistoryEntry[] = raw ? JSON.parse(raw) : [];
        
        // Filter out invalid dates and migrate old format to ISO
        const processed = data.map((entry) => {
          const parsedDate = parseDate(entry.date);
          const isValid = !isNaN(parsedDate.getTime());
          
          // If date is invalid or in old format, convert to ISO
          if (!isValid || !entry.date.includes('T')) {
            return { ...entry, date: parsedDate.toISOString() };
          }
          return entry;
        });
        
        // Save migrated data back if any were updated
        const needsMigration = processed.some((entry, idx) => entry.date !== data[idx].date);
        if (needsMigration) {
          await AsyncStorage.setItem(`1RMHistory:${exerciseName}`, JSON.stringify(processed));
        }
        
        const sorted = processed.sort(
          (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
        );
        setHistory(sorted);
      } catch (error) {
        console.error('Error loading history:', error);
      }
    };
    loadHistory();
  }, [exerciseName]);

  const chartData = history.map((entry) => ({
    value: entry.value,
    label: parseDate(entry.date).toLocaleDateString(),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exerciseName} — 1RM History</Text>
      <Text style={styles.note}>
        This chart shows how your estimated 1RM has changed over time — both PRs and regressions.
      </Text>

      {chartData.length > 1 ? (
        <LineChart
          data={chartData}
          curved
          thickness={2}
          color="#0a84ff"
          hideDataPoints={false}
          areaChart
          startFillColor="#0a84ff"
          endFillColor="#ffffff"
          startOpacity={0.4}
          endOpacity={0.1}
          yAxisTextStyle={{ color: '#555' }}
          xAxisLabelTextStyle={{ color: '#555', fontSize: 10 }}
          noOfSections={4}
          maxValue={Math.max(...chartData.map((d) => d.value)) + 10}
          initialSpacing={10}
        />
      ) : (
        <Text style={styles.noData}>Not enough data to display chart</Text>
      )}

      <FlatList
        data={[...history].reverse()} // latest first
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => {
          const date = parseDate(item.date);
          const dateString = !isNaN(date.getTime()) 
            ? date.toLocaleDateString() 
            : 'Invalid Date';
          
          return (
            <View style={styles.row}>
              <Text style={styles.date}>{dateString}</Text>
              <Text style={styles.value}>{item.value} lbs</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  note: { fontSize: 14, color: '#666', marginBottom: 12 },
  noData: { fontSize: 14, color: '#999', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  date: { fontSize: 14, color: '#555' },
  value: { fontSize: 14, fontWeight: '600' },
});