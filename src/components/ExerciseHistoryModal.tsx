import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ExerciseLog,
  getRecentHistory,
  getProgressionIndicatorColor,
} from '../utils/progressionLogic';
import { THEME } from '../theme/colors';

interface ExerciseHistoryModalProps {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
}

/**
 * Modal component to display exercise history
 * Shows last 5 sessions with load, reps, RPE, readiness, and qualityPass
 */
export default function ExerciseHistoryModal({
  visible,
  exerciseName,
  onClose,
}: ExerciseHistoryModalProps): React.ReactElement {
  const [history, setHistory] = useState<ExerciseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible && exerciseName) {
      loadHistory();
    }
  }, [visible, exerciseName]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const logs = await getRecentHistory(exerciseName, 5);
      setHistory(logs);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  const getQualityIcon = (log: ExerciseLog): string => {
    if (log.qualityPass === undefined) return '➖';
    return log.qualityPass ? '✅' : '⚠️';
  };

  const getReadinessColor = (readiness: number | undefined): string => {
    if (readiness === undefined) return THEME.textMuted;
    if (readiness >= 8) return THEME.readinessHigh;
    if (readiness >= 5) return THEME.readinessMedium;
    return THEME.readinessLow;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📊 {exerciseName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Last 5 Sessions</Text>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976d2" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No history yet</Text>
              <Text style={styles.emptySubtext}>
                Complete some sessions to see your progress here.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList}>
              {/* Column headers */}
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.dateCell]}>Date</Text>
                <Text style={[styles.headerCell, styles.loadCell]}>Load</Text>
                <Text style={[styles.headerCell, styles.repsCell]}>Reps</Text>
                <Text style={[styles.headerCell, styles.rpeCell]}>RPE</Text>
                <Text style={[styles.headerCell, styles.readinessCell]}>Ready</Text>
                <Text style={[styles.headerCell, styles.qualityCell]}>Quality</Text>
              </View>

              {/* History rows */}
              {history.map((log, index) => (
                <View
                  key={`${log.date}-${index}`}
                  style={[
                    styles.historyRow,
                    index % 2 === 0 && styles.historyRowAlt,
                  ]}
                >
                  <Text style={[styles.cell, styles.dateCell]}>
                    {formatDate(log.date)}
                  </Text>
                  <Text style={[styles.cell, styles.loadCell]}>
                    {log.weight ? `${log.weight} lbs` : '—'}
                  </Text>
                  <Text style={[styles.cell, styles.repsCell]}>
                    {log.sets}×{log.reps || '—'}
                    {log.extraReps ? ` (+${log.extraReps})` : ''}
                  </Text>
                  <Text style={[styles.cell, styles.rpeCell]}>
                    {log.rpe !== undefined ? log.rpe : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      styles.readinessCell,
                      { color: getReadinessColor(log.readiness) },
                    ]}
                  >
                    {log.readiness !== undefined ? log.readiness : '—'}
                  </Text>
                  <Text style={[styles.cell, styles.qualityCell]}>
                    {getQualityIcon(log)}
                  </Text>
                </View>
              ))}

              {/* Summary */}
              {history.length > 0 && (
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryTitle}>📈 Progress Summary</Text>
                  
                  {/* Consecutive successes */}
                  {history[0]?.consecutiveSuccesses !== undefined && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Consecutive Successes:</Text>
                      <View
                        style={[
                          styles.successBadge,
                          {
                            backgroundColor:
                              getProgressionIndicatorColor(
                                history[0].consecutiveSuccesses || 0
                              ) + '20',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.successBadgeText,
                            {
                              color: getProgressionIndicatorColor(
                                history[0].consecutiveSuccesses || 0
                              ),
                            },
                          ]}
                        >
                          {history[0].consecutiveSuccesses || 0}/3
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Readiness MA3 */}
                  {history[0]?.readinessMA3 !== undefined && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Readiness (3-session avg):</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          { color: getReadinessColor(history[0].readinessMA3) },
                        ]}
                      >
                        {history[0].readinessMA3.toFixed(1)}/10
                      </Text>
                    </View>
                  )}

                  {/* Weight trend */}
                  {history.length >= 2 && history[0].weight && history[1].weight && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Weight Trend:</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          {
                            color:
                              history[0].weight > history[1].weight
                                ? '#4caf50'
                                : history[0].weight < history[1].weight
                                ? '#f44336'
                                : '#666',
                          },
                        ]}
                      >
                        {history[0].weight > history[1].weight
                          ? `↑ +${history[0].weight - history[1].weight} lbs`
                          : history[0].weight < history[1].weight
                          ? `↓ ${history[1].weight - history[0].weight} lbs`
                          : '→ Maintained'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: THEME.textSecondary,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: THEME.textMuted,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  historyList: {
    paddingHorizontal: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: THEME.secondaryFaded,
    borderRadius: 8,
    marginBottom: 4,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.secondary,
    textTransform: 'uppercase',
  },
  historyRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  historyRowAlt: {
    backgroundColor: THEME.backgroundLight,
  },
  cell: {
    fontSize: 13,
    color: THEME.textPrimary,
  },
  dateCell: {
    flex: 1.2,
  },
  loadCell: {
    flex: 1.2,
    textAlign: 'center',
  },
  repsCell: {
    flex: 1.2,
    textAlign: 'center',
  },
  rpeCell: {
    flex: 0.6,
    textAlign: 'center',
  },
  readinessCell: {
    flex: 0.8,
    textAlign: 'center',
    fontWeight: '600',
  },
  qualityCell: {
    flex: 0.6,
    textAlign: 'center',
  },
  summaryContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  successBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

