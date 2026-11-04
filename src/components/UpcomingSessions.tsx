import React, { useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';

interface SessionPreview {
  date: string;
  dateFormatted: string;
  title: string;
  durationMinutes: number;
  sessionType: string;
  sessionId: string;
}

interface UpcomingSessionsProps {
  startDateYMD: string | null;
  programOffset: number;
  totalWeeks: number;
  getSessionForDate: (dateYMD: string) => { sessionId: string; title: string } | null;
  getSessionTypeColor: (title: string) => string;
  onSessionPress: (sessionId: string, date: string) => void;
  formatYMD: (date: Date) => string;
  addDaysYMD: (ymd: string, days: number) => string;
  parseYMD: (ymd: string) => Date;
  selectedProgramId: string;
}

const UpcomingSessions = memo(function UpcomingSessions({
  startDateYMD,
  programOffset,
  totalWeeks,
  getSessionForDate,
  getSessionTypeColor,
  onSessionPress,
  formatYMD,
  addDaysYMD,
  parseYMD,
  selectedProgramId,
}: UpcomingSessionsProps) {
  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    scrollView: {
      paddingHorizontal: 4,
    },
    sessionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    sessionCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
      minWidth: 180,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    sessionDate: {
      fontSize: 11,
      color: theme.textMuted,
      fontWeight: '600',
      marginBottom: 6,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    sessionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    sessionMeta: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sessionTypeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    sessionTypeText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase' as const,
    },
    sessionDuration: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
  }));

  const upcomingSessions = useMemo(() => {
    if (!startDateYMD) return [];
    
    const today = new Date();
    const todayYMD = formatYMD(today);
    const sessions: SessionPreview[] = [];
    let daysAhead = 0;
    const maxDays = 35; // Look ahead 5 weeks
    const maxSessions = 5;
    
      while (sessions.length < maxSessions && daysAhead < maxDays) {
        const checkDate = addDaysYMD(todayYMD, daysAhead);
        // Skip today if it's day 0
        if (daysAhead === 0) {
          daysAhead++;
          continue;
        }
        
        const session = getSessionForDate(checkDate);
        
        if (session) {
          const date = parseYMD(checkDate);
          const dateFormatted = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          
          // Determine session type
          const titleLower = session.title.toLowerCase();
          let sessionType = 'Strength';
          if (titleLower.includes('recovery') || titleLower.includes('mobility')) {
            sessionType = 'Recovery';
          } else if (titleLower.includes('conditioning') || titleLower.includes('cardio')) {
            sessionType = 'Conditioning';
          }
          
          // Get duration (estimate if not available)
          const durationMinutes = 60; // Default, could be enhanced to get from session data
          
          sessions.push({
            date: checkDate,
            dateFormatted,
            title: session.title,
            durationMinutes,
            sessionType,
            sessionId: session.sessionId,
          });
        }
        
        daysAhead++;
      }
    
    return sessions;
  }, [
    startDateYMD,
    programOffset,
    totalWeeks,
    getSessionForDate,
    formatYMD,
    addDaysYMD,
    parseYMD,
    selectedProgramId,
  ]);
  
  if (upcomingSessions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔜 Upcoming Sessions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
      >
        <View style={styles.sessionsRow}>
          {upcomingSessions.map((session) => {
            const typeColor = getSessionTypeColor(session.title);
            return (
              <TouchableOpacity
                key={session.sessionId}
                style={styles.sessionCard}
                onPress={() => onSessionPress(session.sessionId, session.date)}
                activeOpacity={0.7}
              >
                <Text style={styles.sessionDate}>{session.dateFormatted}</Text>
                <Text style={styles.sessionTitle} numberOfLines={2}>
                  {session.title}
                </Text>
                <View style={styles.sessionMeta}>
                  <View
                    style={[
                      styles.sessionTypeBadge,
                      { backgroundColor: typeColor + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sessionTypeText,
                        { color: typeColor },
                      ]}
                    >
                      {session.sessionType}
                    </Text>
                  </View>
                  <Text style={styles.sessionDuration}>
                    {session.durationMinutes} min
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

export default UpcomingSessions;

