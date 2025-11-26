import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-gifted-charts';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OneRMHistory'>;

interface HistoryEntry {
  value: number;
  date: string;
}

export default function OneRMHistory({ route }: Props) {
  const { exerciseName } = route.params;
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(`1RMHistory:${exerciseName}`);
        const data: HistoryEntry[] = raw ? JSON.parse(raw) : [];
        const sorted = data.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
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
    label: new Date(entry.date).toLocaleDateString(),
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
        data={[...history].reverse()}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text style={styles.value}>{item.value} lbs</Text>
          </View>
        )}
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