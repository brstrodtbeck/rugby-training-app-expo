import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { THEME } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

export default function SessionSummary({ route }: Props) {
  const { sessionId, completed } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.header}>🏁 Session Summary</Text>
        <Text style={styles.subheader}>Session ID: {sessionId}</Text>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{completed.length}</Text>
          <Text style={styles.statLabel}>Exercises Completed</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: THEME.background,
    padding: 20,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 8,
    color: THEME.primary,
  },
  subheader: { 
    fontSize: 14, 
    marginBottom: 20,
    color: THEME.textMuted,
  },
  statBox: {
    backgroundColor: THEME.primaryFaded,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  statValue: { 
    fontSize: 48, 
    fontWeight: '800',
    color: THEME.primary,
  },
  statLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
});