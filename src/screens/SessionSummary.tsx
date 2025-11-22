import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

export default function SessionSummary({ route }: Props) {
  const { sessionId, completed } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏁 Session Summary</Text>
      <Text style={styles.subheader}>Session ID: {sessionId}</Text>
      <Text style={styles.count}>Completed exercises: {completed.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  subheader: { fontSize: 18, marginBottom: 8 },
  count: { fontSize: 18, color: '#28a745' },
});