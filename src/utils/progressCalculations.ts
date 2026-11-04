/**
 * Progress calculation utilities for HomeScreen
 * Calculates statistics from completed sessions and program data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProgressStats {
  totalSessionsCompleted: number;
  completionRate: number;
  currentWeek: number;
  totalWeeks: number;
  weekProgress: number;
  programProgress: number;
  currentWeekCompletion: number;
  streakDays: number;
  totalTrainingMinutes: number;
  averageSessionDuration: number;
}

export interface WeeklyStats {
  thisWeek: number;
  thisMonth: number;
  totalVolume: number;
  favoriteSessionType: string | null;
}

export interface SessionInfo {
  id: string;
  date: string;
  title?: string;
  durationMinutes?: number;
  sessionType?: string;
}

/**
 * Calculate program progress statistics
 */
export async function calculateProgressStats(
  completedSessions: { id: string; date: string }[],
  startDateYMD: string | null,
  totalWeeks: number,
  programOffset: number = 0
): Promise<ProgressStats> {
  const todayYMD = formatYMD(new Date());
  
  // Default values
  let currentWeek = 0;
  let weekProgress = 0;
  let programProgress = 0;
  let currentWeekCompletion = 0;
  
  if (startDateYMD) {
    const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
    if (offsetDays >= 0) {
      currentWeek = Math.floor(offsetDays / 7) + 1;
      const daysInWeek = (offsetDays % 7) + 1;
      weekProgress = (daysInWeek / 7) * 100;
      
      // Calculate program progress
      if (totalWeeks > 0) {
        programProgress = Math.min(100, (currentWeek / totalWeeks) * 100);
      }
      
      // Calculate current week completion
      const weekStartYMD = addDaysYMD(startDateYMD, (currentWeek - 1) * 7 + programOffset);
      const weekEndYMD = addDaysYMD(weekStartYMD, 6);
      const weekSessions = completedSessions.filter(s => {
        return s.date >= weekStartYMD && s.date <= weekEndYMD;
      });
      
      // Estimate sessions per week (typically 3-5 for most programs)
      const estimatedSessionsPerWeek = 4;
      currentWeekCompletion = Math.min(100, (weekSessions.length / estimatedSessionsPerWeek) * 100);
    }
  }
  
  // Calculate total sessions completed
  const totalSessionsCompleted = completedSessions.length;
  
  // Calculate completion rate (estimate total possible sessions)
  const estimatedTotalSessions = totalWeeks * 4; // Assume 4 sessions per week average
  const completionRate = estimatedTotalSessions > 0 
    ? Math.min(100, (totalSessionsCompleted / estimatedTotalSessions) * 100)
    : 0;
  
  // Calculate streak
  const streakDays = calculateStreak(completedSessions, todayYMD);
  
  // Calculate training time
  const { totalMinutes, averageMinutes } = await calculateTrainingTime(completedSessions);
  
  return {
    totalSessionsCompleted,
    completionRate,
    currentWeek,
    totalWeeks,
    weekProgress,
    programProgress,
    currentWeekCompletion,
    streakDays,
    totalTrainingMinutes: totalMinutes,
    averageSessionDuration: averageMinutes,
  };
}

/**
 * Calculate weekly/monthly statistics
 */
export async function calculateWeeklyStats(
  completedSessions: { id: string; date: string }[]
): Promise<WeeklyStats> {
  const today = new Date();
  const todayYMD = formatYMD(today);
  
  // Calculate start of week (Monday)
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);
  const weekStartYMD = formatYMD(weekStart);
  
  // Calculate start of month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartYMD = formatYMD(monthStart);
  
  // Filter sessions
  const thisWeekSessions = completedSessions.filter(s => s.date >= weekStartYMD && s.date <= todayYMD);
  const thisMonthSessions = completedSessions.filter(s => s.date >= monthStartYMD && s.date <= todayYMD);
  
  // Calculate total volume (if available in session logs)
  // Optimized: Use batch reads
  const totalVolume = 0;
  const sessionTypes: Record<string, number> = {};
  
  if (completedSessions.length > 0) {
    const keys = completedSessions.map(session => `sessionLogs:${session.id}`);
    
    try {
      const results = await AsyncStorage.multiGet(keys);
      
      for (const [key, value] of results) {
        if (value) {
          try {
            const logs = JSON.parse(value);
            
            // Count session types
            if (logs.sessionType) {
              sessionTypes[logs.sessionType] = (sessionTypes[logs.sessionType] || 0) + 1;
            }
            
            // Calculate volume if exercise logs available
            // This would require accessing exercise logs which may not be stored this way
            // For now, we'll skip volume calculation
          } catch (parseError) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      // Fallback to individual reads if batch fails
      for (const session of completedSessions) {
        try {
          const logsKey = `sessionLogs:${session.id}`;
          const logsData = await AsyncStorage.getItem(logsKey);
          if (logsData) {
            const logs = JSON.parse(logsData);
            if (logs.sessionType) {
              sessionTypes[logs.sessionType] = (sessionTypes[logs.sessionType] || 0) + 1;
            }
          }
        } catch (error) {
          // Skip if can't load session data
        }
      }
    }
  }
  
  // Find favorite session type
  let favoriteSessionType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of Object.entries(sessionTypes)) {
    if (count > maxCount) {
      maxCount = count;
      favoriteSessionType = type;
    }
  }
  
  return {
    thisWeek: thisWeekSessions.length,
    thisMonth: thisMonthSessions.length,
    totalVolume,
    favoriteSessionType,
  };
}

/**
 * Calculate consecutive days streak
 */
function calculateStreak(completedSessions: { id: string; date: string }[], todayYMD: string): number {
  if (completedSessions.length === 0) return 0;
  
  // Sort sessions by date (newest first)
  const sortedSessions = [...completedSessions]
    .map(s => ({ ...s, date: s.date }))
    .sort((a, b) => b.date.localeCompare(a.date));
  
  // Check if today has a session
  let currentDate = todayYMD;
  let streak = 0;
  let sessionIndex = 0;
  
  // Start from today and work backwards
  while (sessionIndex < sortedSessions.length) {
    const session = sortedSessions[sessionIndex];
    
    // If we find a session for the current date, increment streak
    if (session.date === currentDate) {
      streak++;
      sessionIndex++;
      // Move to previous day
      currentDate = addDaysYMD(currentDate, -1);
    } else if (session.date < currentDate) {
      // Session is older than current date, move to previous day
      currentDate = addDaysYMD(currentDate, -1);
    } else {
      // Session is in the future (shouldn't happen), skip it
      sessionIndex++;
    }
    
    // Stop if we've gone too far back (more than 30 days without a session)
    const daysBack = daysBetweenYMD(currentDate, todayYMD);
    if (daysBack > 30) break;
  }
  
  return streak;
}

/**
 * Calculate total training time from completed sessions
 * Optimized: Uses batch reads instead of individual AsyncStorage calls
 */
async function calculateTrainingTime(
  completedSessions: { id: string; date: string }[]
): Promise<{ totalMinutes: number; averageMinutes: number }> {
  if (completedSessions.length === 0) {
    return { totalMinutes: 0, averageMinutes: 0 };
  }
  
  let totalMinutes = 0;
  let sessionsWithDuration = 0;
  
  // Batch read all session logs at once instead of individual reads
  const keys = completedSessions.map(session => `sessionLogs:${session.id}`);
  
  try {
    const results = await AsyncStorage.multiGet(keys);
    
    for (const [key, value] of results) {
      if (value) {
        try {
          const logs = JSON.parse(value);
          if (logs.durationMinutes) {
            totalMinutes += logs.durationMinutes;
            sessionsWithDuration++;
          }
        } catch (parseError) {
          // Skip invalid JSON
        }
      }
    }
  } catch (error) {
    // Fallback to individual reads if batch fails (shouldn't happen)
    for (const session of completedSessions) {
      try {
        const logsKey = `sessionLogs:${session.id}`;
        const logsData = await AsyncStorage.getItem(logsKey);
        if (logsData) {
          const logs = JSON.parse(logsData);
          if (logs.durationMinutes) {
            totalMinutes += logs.durationMinutes;
            sessionsWithDuration++;
          }
        }
      } catch (error) {
        // Skip if can't load
      }
    }
  }
  
  const averageMinutes = sessionsWithDuration > 0 
    ? Math.round(totalMinutes / sessionsWithDuration)
    : 0;
  
  return { totalMinutes, averageMinutes };
}

/**
 * Helper: Format date as YYYY-MM-DD
 */
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Helper: Parse YYYY-MM-DD to Date
 */
function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Helper: Add days to YYYY-MM-DD
 */
function addDaysYMD(ymd: string, days: number): string {
  const dt = parseYMD(ymd);
  dt.setDate(dt.getDate() + days);
  return formatYMD(dt);
}

/**
 * Helper: Days between two YYYY-MM-DD dates
 */
function daysBetweenYMD(startYMD: string, endYMD: string): number {
  const start = parseYMD(startYMD);
  const end = parseYMD(endYMD);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

