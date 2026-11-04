import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Alert, TouchableOpacity, Modal, FlatList, ScrollView, Dimensions, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { analytics } from '../utils/analytics';
import Toast from 'react-native-toast-message';
import ProgressDashboard from '../components/ProgressDashboard';
import UpcomingSessions from '../components/UpcomingSessions';

// Import all programs
import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';
import recoveryWorkoutsData from '../data/recoveryWorkouts.json';

import { RugbyProgram, generateSessionId, parseSessionId } from '../types/program';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_WIDTH = SCREEN_WIDTH / 7;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Program registry with all available programs
interface ProgramInfo {
  id: string;
  title: string;
  description: string;
  weeks: number;
  data: RugbyProgram;
}

const PROGRAMS: ProgramInfo[] = [
  {
    id: 'rugby',
    title: 'Rugby Season Prep',
    description: '16-week rugby-specific training',
    weeks: 16,
    data: rugbyData as unknown as RugbyProgram,
  },
  {
    id: 'fitness',
    title: '20-Week Foundation to Peak',
    description: 'Strength → Power → Conditioning',
    weeks: 20,
    data: fitnessData as unknown as RugbyProgram,
  },
  {
    id: 'simple',
    title: '12-Week Strength Program',
    description: 'Progressive strength development',
    weeks: 12,
    data: simpleWeightData as unknown as RugbyProgram,
  },
  {
    id: 'test',
    title: '🧪 Test Block – Progression Validation',
    description: '4-week test for Rule of 3, readiness safeguards',
    weeks: 4,
    data: testProgramData as unknown as RugbyProgram,
  },
  {
    id: 'hypertrophy',
    title: 'Hypertrophy Month',
    description: '4-week muscle building with power & mobility',
    weeks: 4,
    data: hypertrophyData as unknown as RugbyProgram,
  },
];

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

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
  const { theme } = useTheme();
  
  // Get session type color
  const getSessionTypeColor = useCallback((sessionTitle: string): string => {
    const lower = sessionTitle.toLowerCase();
    if (lower.includes('strength') || lower.includes('squat') || lower.includes('deadlift') || lower.includes('press')) {
      return theme.error; // Red for strength
    }
    if (lower.includes('recovery') || lower.includes('mobility') || lower.includes('yoga') || lower.includes('foam')) {
      return theme.primary; // Green for recovery
    }
    if (lower.includes('conditioning') || lower.includes('cardio') || lower.includes('interval') || lower.includes('circuit')) {
      return theme.secondary; // Blue for conditioning
    }
    return theme.textMuted; // Default gray
  }, [theme]);

  // Get readiness badge
  const getReadinessBadge = useCallback((readiness: number | null): { emoji: string; color: string } => {
    if (!readiness) return { emoji: '◇', color: theme.textMuted };
    if (readiness >= 8) return { emoji: '⚡', color: theme.readinessHigh };
    if (readiness <= 3) return { emoji: '◇', color: theme.readinessLow };
    return { emoji: '▲', color: theme.readinessMedium };
  }, [theme]);
  
  // Add help and account buttons to header
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Account')}
            style={{ padding: 4 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Help')}
            style={{ marginRight: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>❓</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  const [startDateYMD, setStartDateYMD] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{ id: string; date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [selectedProgramId, setSelectedProgramId] = useState<string>('rugby');
  const [showProgramPicker, setShowProgramPicker] = useState(false);
  const [todaySessionExpanded, setTodaySessionExpanded] = useState(true);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date()); // Track which month/week is being viewed
  const [showJumpToDate, setShowJumpToDate] = useState(false); // For jump to date picker
  const [jumpToDatePicker, setJumpToDatePicker] = useState<Date>(new Date()); // Date picker for jump to date
  const calendarScrollViewRef = useRef<ScrollView>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const [swapFilterType, setSwapFilterType] = useState<string | null>(null);
  const [swappedSessions, setSwappedSessions] = useState<Record<string, { originalSessionId: string; swappedSessionId: string; date: string }>>({});
  const [showPushModal, setShowPushModal] = useState(false);
  const [programOffset, setProgramOffset] = useState<number>(0);
  const [pendingPushDate, setPendingPushDate] = useState<string | null>(null);
  const [selectedMissedSessions, setSelectedMissedSessions] = useState<Set<string>>(new Set());
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryModalDate, setRecoveryModalDate] = useState<string | null>(null);
  const [showProgramCompleteModal, setShowProgramCompleteModal] = useState(false);
  const [programCompleteShown, setProgramCompleteShown] = useState(false);

  // Get the current program data based on selection
  const currentProgram = PROGRAMS.find(p => p.id === selectedProgramId) || PROGRAMS[0];
  const programData = currentProgram.data;

  // Load selected program from storage
  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await AsyncStorage.getItem(STORAGE_KEY_PROGRAM);
      if (storedProgram && PROGRAMS.some(p => p.id === storedProgram)) {
        setSelectedProgramId(storedProgram);
      }
    };
    loadProgram();
  }, []);

  // Load startDate and program offset
  useEffect(() => {
    const loadStartDate = async () => {
      const stored = await AsyncStorage.getItem('startDateYMD');
      if (stored) {
        setStartDateYMD(stored);
      }
      
      // Load program offset (for pushed workouts)
      const storedOffset = await AsyncStorage.getItem('programOffset');
      if (storedOffset) {
        setProgramOffset(parseInt(storedOffset, 10) || 0);
      }
    };
    loadStartDate();
  }, []);

  // Load readiness score
  useEffect(() => {
    const loadReadiness = async () => {
      const stored = await AsyncStorage.getItem('todayReadinessScore');
      if (stored) {
        setReadinessScore(parseInt(stored, 10));
      }
    };
    loadReadiness();
  }, []);

  // Load program completion shown flag
  useEffect(() => {
    const loadProgramCompleteShown = async () => {
      const stored = await AsyncStorage.getItem('programCompleteShown');
      if (stored === 'true') {
        setProgramCompleteShown(true);
      }
    };
    loadProgramCompleteShown();
  }, []);

  // Handle program selection
  const handleProgramSelect = useCallback(async (programId: string) => {
    if (programId === selectedProgramId) {
      setShowProgramPicker(false);
      return;
    }

    Alert.alert(
      'Change Program',
      'Switching programs will reset your start date and completed sessions. Continue?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowProgramPicker(false) },
        {
          text: 'Switch Program',
          style: 'destructive',
          onPress: async () => {
            // Save new program selection
            await AsyncStorage.setItem(STORAGE_KEY_PROGRAM, programId);
            // Clear progress data (but keep 1RMs and logs)
            await AsyncStorage.removeItem('startDateYMD');
            await AsyncStorage.removeItem('completedSessions');
            await AsyncStorage.removeItem('programOffset');
            await AsyncStorage.removeItem('programCompleteShown'); // Reset completion flag for new program
            // Update state
            setSelectedProgramId(programId);
            setStartDateYMD(null);
            setCompletedSessions([]);
            setSelectedDate(null);
            setProgramOffset(0);
            setProgramCompleteShown(false);
            setShowProgramPicker(false);
            
            // Track program selection
            const program = PROGRAMS.find(p => p.id === programId);
            if (program) {
              analytics.programSelected(programId, program.title).catch(() => {
                // Silently fail - analytics is optional
              });
            }
            
            if (__DEV__) {
              console.log('📋 Switched to program:', programId);
            }
          },
        },
      ]
    );
  }, [selectedProgramId]);

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
    const parsed = parseSessionId(sessionId);
    if (!parsed) return '';
    // weekIndex is 0-indexed within mesocycle, dayNumber is 1-indexed
    // We need to find which program week this corresponds to
    const mesocycles = getMesocycles();
    const meso = mesocycles.find(m => m.id === parsed.mesoId);
    if (!meso || !meso.weeks || !Array.isArray(meso.weeks)) return '';
    const programWeek = meso.weeks[parsed.weekIndex]; // This is the 1-indexed program week
    if (!programWeek) return '';
    
    // Special handling for Hypertrophy Month (3-day per week: Mon-Wed-Fri pattern)
    let offsetDays: number;
    if (selectedProgramId === 'hypertrophy') {
      // Map program day (1,2,3) back to offset within week cycle (0,2,4)
      const dayOffsetMap: Record<number, number> = {
        1: 0, // Day 1 = start date (offset 0)
        2: 2, // Day 2 = +2 days
        3: 4, // Day 3 = +4 days
      };
      const daysInCycle = dayOffsetMap[parsed.dayNumber] ?? 0;
      offsetDays = (programWeek - 1) * 7 + daysInCycle;
    } else {
      // Standard 7-day week calculation
      offsetDays = (programWeek - 1) * 7 + (parsed.dayNumber - 1);
    }
    
    return addDaysYMD(startYMD, offsetDays);
  }

  // Get mesocycles array - handle both schema formats
  const getMesocycles = (): any[] => {
    // Check if macrocycle.mesocycles exists and is an array of objects (not strings)
    const macrocycleMesocycles = programData.macrocycle?.mesocycles;
    if (macrocycleMesocycles && Array.isArray(macrocycleMesocycles) && macrocycleMesocycles.length > 0) {
      // Check if first element is an object (standard format) or string (HypertrophyMonth format)
      if (typeof macrocycleMesocycles[0] === 'object' && macrocycleMesocycles[0] !== null) {
        return macrocycleMesocycles;
      }
    }
    // Alternative format: root-level mesocycles (HypertrophyMonth)
    if ((programData as any).mesocycles && Array.isArray((programData as any).mesocycles)) {
      return (programData as any).mesocycles;
    }
    return [];
  };

  // Helper: find the correct mesocycle for a given program week (1-indexed)
  const getMesocycleForWeek = (programWeek: number): { mesoId: string; weekInMeso: number } | null => {
    const mesocycles = getMesocycles();
    for (const meso of mesocycles) {
      // Guard against undefined or non-array weeks
      if (!meso.weeks || !Array.isArray(meso.weeks)) {
        console.error('Mesocycle missing weeks array:', meso.id);
        continue;
      }
      if (meso.weeks.includes(programWeek)) {
        // weekInMeso is 0-indexed within the mesocycle
        const weekInMeso = meso.weeks.indexOf(programWeek);
        return { mesoId: meso.id, weekInMeso };
      }
    }
    return null;
  };

  // Get mesocycle color by mesoId
  const getMesocycleColor = useCallback((mesoId: string): string => {
    const id = mesoId.toLowerCase();
    if (id.includes('foundation') || id === 'm1' || id.includes('week1')) {
      return '#4A90E2'; // Blue for Foundation
    }
    if (id.includes('strength') || id === 'm2' || id.includes('week2')) {
      return '#E85A4F'; // Red/Orange for Strength
    }
    if (id.includes('power') || id === 'm3') {
      return '#F5A623'; // Yellow/Gold for Power
    }
    if (id.includes('conditioning') || id === 'm4') {
      return '#7ED321'; // Green for Conditioning
    }
    if (id.includes('peak') || id === 'm5') {
      return '#9013FE'; // Purple for Peak
    }
    return theme.secondary; // Default
  }, [theme]);

  // Get mesocycle info for a date
  const getMesocycleForDate = useCallback((dateYMD: string): { meso: any; weekInMeso: number; programWeek: number } | null => {
    if (!startDateYMD || !programData) return null;
    
    const offsetDays = daysBetweenYMD(startDateYMD, dateYMD) - programOffset;
    if (offsetDays < 0) return null;
    
    let programWeek: number;
    if (selectedProgramId === 'hypertrophy') {
      programWeek = Math.floor(offsetDays / 7) + 1;
    } else {
      programWeek = Math.floor(offsetDays / 7) + 1;
    }
    
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) return null;
    
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
    if (!meso) return null;
    
    return { meso, weekInMeso: mesoInfo.weekInMeso, programWeek };
  }, [startDateYMD, programData, programOffset, selectedProgramId]);

  // Get microcycle day number from sessionId
  const getMicrocycleDay = useCallback((sessionId: string): { day: number; totalDays: number } | null => {
    const parsed = parseSessionId(sessionId);
    if (!parsed) return null;

    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === parsed.mesoId);
    if (!meso) return null;

    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    return {
      day: parsed.dayNumber,
      totalDays: trainingDays.length,
    };
  }, []);

  // Get mesocycle progress percentage
  const getMesocycleProgress = useCallback((programWeek: number): number => {
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) return 0;

    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
    if (!meso || !meso.weeks || !Array.isArray(meso.weeks)) return 0;

    const totalWeeks = meso.weeks.length;
    const currentWeek = mesoInfo.weekInMeso + 1; // 1-indexed
    return Math.round((currentWeek / totalWeeks) * 100);
  }, []);

  // Calculate today's session (checking for swaps first)
  const todaySession = useMemo(() => {
    if (!startDateYMD) return null;
    
    const todayYMD = formatYMD(new Date());
    
    // Check if there's a swapped session for today
    const swap = swappedSessions[todayYMD];
    let sessionIdToUse: string | null = null;
    
    if (swap) {
      // Use swapped session
      sessionIdToUse = swap.swappedSessionId;
    } else {
      // Calculate original session (accounting for program offset)
      const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
      
      if (offsetDays < 0) return null; // Before program start
      
      // Special handling for Hypertrophy Month (3-day per week: Mon-Wed-Fri pattern)
      let programWeek: number;
      let dayNumber: number;
      
      if (selectedProgramId === 'hypertrophy') {
        // For 3-day programs: Day 1 = start date, Day 2 = +2 days, Day 3 = +4 days, then repeat weekly
        const daysInCycle = offsetDays % 7;
        programWeek = Math.floor(offsetDays / 7) + 1;
        
        // Map to program days: 0,2,4 → 1,2,3; others are rest days
        if (daysInCycle === 0) {
          dayNumber = 1; // Start date (Day 1)
        } else if (daysInCycle === 2) {
          dayNumber = 2; // +2 days (Day 2)
        } else if (daysInCycle === 4) {
          dayNumber = 3; // +4 days (Day 3)
        } else {
          // Rest day - no session
          return null;
        }
      } else {
        // Standard 7-day week calculation for other programs
        programWeek = Math.floor(offsetDays / 7) + 1;
        dayNumber = (offsetDays % 7) + 1;
      }
      
      // Get total weeks - use program info or macrocycle
      const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
      if (programWeek > totalWeeks) return null; // Beyond program
      
      const mesoInfo = getMesocycleForWeek(programWeek);
      if (!mesoInfo) {
        console.error('Could not find mesocycle for week:', programWeek, 'Available mesocycles:', getMesocycles().map((m: any) => ({ id: m.id, weeks: m.weeks })));
        return null;
      }
      
      sessionIdToUse = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
    }
    
    if (!sessionIdToUse) return null;
    
    // Parse session ID to get session details
    const parsed = parseSessionId(sessionIdToUse);
    if (!parsed) {
      console.error('Failed to parse session ID:', sessionIdToUse);
      return null;
    }
    
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === parsed.mesoId);
    if (!meso) {
      console.error('Mesocycle not found for swapped session:', parsed.mesoId);
      return null;
    }
    
    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    const day = trainingDays.find((d: any) => (d.day === parsed.dayNumber || d.dayNumber === parsed.dayNumber));
    if (!day) {
      console.error('Day not found in mesocycle:', parsed.dayNumber, 'Available days:', trainingDays.map((d: any) => d.day || d.dayNumber));
      return null;
    }
    
    // Get mesocycle and microcycle info
    let mesocycleInfo = null;
    let microcycleInfo = null;
    let programWeekForMeso = null;
    
    if (swap) {
      // For swapped sessions, get mesocycle from swapped session ID
      const swappedParsed = parseSessionId(swap.swappedSessionId);
      if (swappedParsed) {
        const swappedMeso = mesocycles.find((m: any) => m.id === swappedParsed.mesoId);
        if (swappedMeso) {
          // Calculate program week for swapped session
          const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
          if (offsetDays >= 0) {
            if (selectedProgramId === 'hypertrophy') {
              programWeekForMeso = Math.floor(offsetDays / 7) + 1;
            } else {
              programWeekForMeso = Math.floor(offsetDays / 7) + 1;
            }
            const swappedMesoInfo = getMesocycleForWeek(programWeekForMeso);
            if (swappedMesoInfo && swappedMesoInfo.mesoId === swappedParsed.mesoId) {
              mesocycleInfo = {
                id: swappedMeso.id,
                title: swappedMeso.title || swappedMeso.id,
                weekInMeso: swappedMesoInfo.weekInMeso + 1,
                totalWeeks: swappedMeso.weeks?.length || 0,
                phaseFocus: swappedMeso.phaseFocus || '',
              };
              microcycleInfo = getMicrocycleDay(swap.swappedSessionId);
            }
          }
        }
      }
    } else {
      // For regular sessions, calculate from program week
      const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
      if (offsetDays >= 0) {
        if (selectedProgramId === 'hypertrophy') {
          programWeekForMeso = Math.floor(offsetDays / 7) + 1;
        } else {
          programWeekForMeso = Math.floor(offsetDays / 7) + 1;
        }
        
        const mesoInfo = getMesocycleForWeek(programWeekForMeso);
        if (mesoInfo) {
          const currentMeso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
          if (currentMeso) {
            mesocycleInfo = {
              id: currentMeso.id,
              title: currentMeso.title || currentMeso.id,
              weekInMeso: mesoInfo.weekInMeso + 1,
              totalWeeks: currentMeso.weeks?.length || 0,
              phaseFocus: currentMeso.phaseFocus || '',
            };
            microcycleInfo = getMicrocycleDay(sessionIdToUse);
          }
        }
      }
    }
    
    return {
      sessionId: sessionIdToUse,
      title: day.title || `Day ${parsed.dayNumber}`,
      durationMinutes: day.durationMinutes || 60,
      blocks: day.blocks || [],
      date: todayYMD,
      isSwapped: !!swap,
      originalSessionId: swap?.originalSessionId,
      mesocycle: mesocycleInfo,
      microcycle: microcycleInfo,
      programWeek: programWeekForMeso,
    };
  }, [startDateYMD, programData, currentProgram, swappedSessions, programOffset, selectedProgramId, getMesocycleForWeek, getMesocycles, getMicrocycleDay]);

  // Check if program is complete
  const isProgramComplete = useMemo(() => {
    if (!startDateYMD) return false;
    
    const todayYMD = formatYMD(new Date());
    const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
    
    if (offsetDays < 0) return false; // Before program start
    
    // Calculate program week
    let programWeek: number;
    if (selectedProgramId === 'hypertrophy') {
      programWeek = Math.floor(offsetDays / 7) + 1;
    } else {
      programWeek = Math.floor(offsetDays / 7) + 1;
    }
    
    // Get total weeks
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
    
    return programWeek > totalWeeks;
  }, [startDateYMD, programOffset, selectedProgramId, currentProgram, programData]);

  // Show program completion modal when program is finished
  useEffect(() => {
    if (isProgramComplete && !programCompleteShown && startDateYMD) {
      setShowProgramCompleteModal(true);
    }
  }, [isProgramComplete, programCompleteShown, startDateYMD]);

  // Handle day press → show preview instead of navigating immediately
  const handleDayPress = (day: { dateString: string }) => {
    if (!startDateYMD) {
      Alert.alert(
        'Set Start Date',
        'Please pick a start date for your program before selecting a workout day.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pick Start Date', onPress: handleOpenPicker },
        ]
      );
      return;
    }

    const offsetDays = daysBetweenYMD(startDateYMD, day.dateString) - programOffset;
    
    // Check if it's before the start date
    if (offsetDays < 0) {
      Alert.alert(
        'Before Program Start',
        `This date is before your program start date. Please select a date on or after your start date.\n\nStart Date: ${startDateYMD}\nSelected: ${day.dateString}`
      );
      return;
    }

    // Just set the selected date - preview will show
    setSelectedDate(day.dateString);
  };

  // Handle navigation to session from preview
  const handleViewSession = (sessionId: string) => {
    navigation.navigate('Session', { sessionId });
  };

  // Initialize picker date when opening
  const handleOpenPicker = () => {
    // Set picker date to existing start date, or current date if not set
    const initialDate = startDateYMD ? parseYMD(startDateYMD) : new Date();
    setPickerDate(initialDate);
    setShowPicker(true);
  };

  // Handle date picker value change (iOS spinner updates)
  const handleDateChange = (event: any, date?: Date) => {
    // Update picker date state as user changes it
    if (date) {
      setPickerDate(date);
    }
    
    // On Android, save immediately when date is set
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date) {
        // Check if we're pushing workouts
        if (pendingPushDate !== null) {
          const targetYMD = formatYMD(date);
          executePushWorkouts(targetYMD);
          setPendingPushDate(null);
        } else {
          saveStartDate(date);
        }
        setShowPicker(false);
      } else if (event.type === 'dismissed') {
        setPendingPushDate(null); // Clear pending push if cancelled
        setShowPicker(false);
      }
    }
    // On iOS, we wait for "Done" button to save
  };

  // Save the start date
  const saveStartDate = async (date: Date) => {
    const ymd = formatYMD(date);
    
    // Track start date set
    analytics.startDateSet(selectedProgramId, ymd).catch(() => {
      // Silently fail - analytics is optional
    });
    setStartDateYMD(ymd);
    await AsyncStorage.setItem('startDateYMD', ymd);
    
    // Reset program offset when setting a new start date to ensure clean calculation
    // Only reset if offset is not 0 (to avoid unnecessary writes)
    if (programOffset !== 0) {
      setProgramOffset(0);
      await AsyncStorage.setItem('programOffset', '0');
      if (__DEV__) {
        console.log('📅 Reset programOffset to 0 when setting start date');
      }
    }
    
    // Success toast
    Toast.show({
      type: 'success',
      text1: '✅ Start Date Set',
      text2: `Program starts ${ymd}`,
      position: 'top',
      visibilityTime: 2000,
    });
    
    if (__DEV__) {
      console.log('📅 Start date set (YMD):', ymd, 'programOffset:', programOffset);
    }
  };

  // Handle Done button (iOS)
  const handleDatePickerDone = async () => {
    // Check if we're pushing workouts to this date
    if (pendingPushDate !== null) {
      const targetYMD = formatYMD(pickerDate);
      // Show confirmation alert for custom date push
      Alert.alert(
        'Push Workouts',
        `Push ${selectedMissedSessions.size} selected workout(s) to ${parseYMD(targetYMD).toLocaleDateString()}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setShowPicker(false) },
          {
            text: 'Push',
            onPress: async () => {
              await executePushWorkouts(targetYMD);
              setShowPicker(false);
            },
          },
        ]
      );
    } else {
      // Save whatever date is currently in the picker
      await saveStartDate(pickerDate);
      setShowPicker(false);
    }
  };

  // Handle start session
  const handleStartSession = () => {
    if (!todaySession) return;
    navigation.navigate('Session', { sessionId: todaySession.sessionId });
  };


  // Get missed/incomplete sessions
  const getMissedSessions = useMemo(() => {
    if (!startDateYMD) return [];
    
    const todayYMD = formatYMD(new Date());
    const missed: Array<{ sessionId: string; date: string; title: string; shouldHaveBeen: string }> = [];
    
    // Get all sessions from start date to today
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || 4;
    const mesocycles = getMesocycles();
    
    // Iterate through all program weeks
    for (let programWeek = 1; programWeek <= totalWeeks; programWeek++) {
      const mesoInfo = getMesocycleForWeek(programWeek);
      if (!mesoInfo) continue;
      
      const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
      if (!meso) continue;
      
      const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
      
      // Iterate through each training day in the microcycle
      trainingDays.forEach((day: any, dayIndex: number) => {
        const dayNumber = day.day || day.dayNumber || (dayIndex + 1);
        
        // Generate session ID using weekInMeso (0-indexed) and dayNumber
        const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
        
        // Calculate when this session should have occurred
        // dayNumber represents the day within the microcycle (1, 2, 3, etc.)
        // We need to map this to actual calendar days
        // For now, assume dayNumber corresponds to day of week (1=Monday, 2=Tuesday, etc.)
        // But it might be the sequential day in the microcycle
        // Use the same logic as getDateFromSessionId: (programWeek - 1) * 7 + (dayNumber - 1)
        const offsetDays = (programWeek - 1) * 7 + (dayNumber - 1) - programOffset;
        const shouldHaveBeen = addDaysYMD(startDateYMD, offsetDays);
        
        // Check if it's in the past and not completed
        if (shouldHaveBeen < todayYMD) {
          const isCompleted = completedSessions.some(s => s.id === sessionId);
          if (!isCompleted) {
            missed.push({
              sessionId,
              date: shouldHaveBeen,
              title: day.title || `Week ${programWeek} Day ${dayNumber}`,
              shouldHaveBeen,
            });
          }
        }
      });
    }
    
    return missed.sort((a, b) => a.shouldHaveBeen.localeCompare(b.shouldHaveBeen));
  }, [startDateYMD, programOffset, completedSessions, programData, currentProgram]);

  // Handle push workouts
  const handlePushWorkouts = () => {
    const missed = getMissedSessions;
    if (missed.length === 0) {
      Alert.alert('No Missed Workouts', 'All workouts are up to date!');
      return;
    }
    // Initialize with all sessions selected
    setSelectedMissedSessions(new Set(missed.map(s => s.sessionId)));
    setShowPushModal(true);
  };

  // Toggle selection of a missed session
  const toggleMissedSessionSelection = (sessionId: string) => {
    setSelectedMissedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Toggle select all missed sessions
  const toggleSelectAllMissedSessions = () => {
    const missed = getMissedSessions;
    if (selectedMissedSessions.size === missed.length) {
      setSelectedMissedSessions(new Set());
    } else {
      setSelectedMissedSessions(new Set(missed.map(s => s.sessionId)));
    }
  };

  // Execute push workouts
  const executePushWorkouts = async (targetDate: string) => {
    const missed = getMissedSessions;
    const selected = missed.filter(s => selectedMissedSessions.has(s.sessionId));
    
    if (selected.length === 0) {
      Alert.alert('No Sessions Selected', 'Please select at least one session to push.');
      return;
    }
    
    const todayYMD = formatYMD(new Date());
    const targetYMD = targetDate || todayYMD;
    
    // Calculate how many days to push forward
    // Find the earliest selected missed session date
    const earliestMissed = selected[0].shouldHaveBeen;
    const daysToPush = daysBetweenYMD(earliestMissed, targetYMD);
    
    if (daysToPush < 0) {
      Alert.alert('Invalid Date', 'Target date must be on or after the earliest missed workout.');
      return;
    }
    
    // Update program offset
    const newOffset = programOffset + daysToPush;
    setProgramOffset(newOffset);
    await AsyncStorage.setItem('programOffset', String(newOffset));
    
    // Success toast
    Toast.show({
      type: 'success',
      text1: '✅ Workouts Pushed!',
      text2: `${selected.length} missed workout(s) rescheduled`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    setShowPushModal(false);
    setSelectedMissedSessions(new Set());
    setPendingPushDate(null);
  };

  // Load swapped sessions and readiness score from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load swapped sessions
        const stored = await AsyncStorage.getItem('swappedSessions');
        if (stored) {
          setSwappedSessions(JSON.parse(stored));
        }
        
        // Load readiness score if available
        const todayYMD = formatYMD(new Date());
        const readinessKey = `readiness:${todayYMD}`;
        const storedReadiness = await AsyncStorage.getItem(readinessKey);
        if (storedReadiness) {
          const parsed = JSON.parse(storedReadiness);
          if (parsed.score) {
            setReadinessScore(parsed.score);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  // Get session type helper (must be defined before useMemo that uses it)
  const getSessionType = useCallback((title: string): string => {
    const lower = title.toLowerCase();
    if (lower.includes('recovery') || lower.includes('mobility') || lower.includes('yoga') || lower.includes('foam')) {
      return 'Recovery';
    }
    if (lower.includes('conditioning') || lower.includes('cardio') || lower.includes('interval')) {
      return 'Conditioning';
    }
    return 'Strength';
  }, []);

  // Get all available sessions from the current program
  const getAllAvailableSessions = useMemo(() => {
    const sessions: Array<{
      sessionId: string;
      title: string;
      durationMinutes: number;
      mesoId: string;
      weekInMeso: number;
      dayNumber: number;
      sessionType: string;
    }> = [];

    const mesocycles = getMesocycles();
    mesocycles.forEach((meso: any) => {
      const trainingDays = meso.trainingDays || meso.microcycle || [];
      trainingDays.forEach((day: any, dayIdx: number) => {
        const dayNumber = day.day || day.dayNumber || (dayIdx + 1);
        // Generate session IDs for all weeks in this mesocycle
        if (meso.weeks && Array.isArray(meso.weeks)) {
          meso.weeks.forEach((week: number) => {
            const weekInMeso = meso.weeks.indexOf(week);
            const sessionId = generateSessionId(meso.id, weekInMeso, dayNumber);
            const sessionType = getSessionType(day.title || `Day ${dayNumber}`);
            sessions.push({
              sessionId,
              title: day.title || `Day ${dayNumber}`,
              durationMinutes: day.durationMinutes || 60,
              mesoId: meso.id,
              weekInMeso,
              dayNumber,
              sessionType,
            });
          });
        }
      });
    });

    return sessions;
  }, [programData, selectedProgramId, getSessionType]);


  // Get suggested sessions based on readiness
  const getSuggestedSessions = useMemo(() => {
    if (readinessScore === null) return [];
    
    const allSessions = getAllAvailableSessions;
    if (readinessScore <= 4) {
      // Low readiness - suggest Recovery
      return allSessions.filter(s => s.sessionType === 'Recovery').slice(0, 3);
    } else if (readinessScore >= 8) {
      // High readiness - suggest Strength or Conditioning
      return allSessions.filter(s => s.sessionType === 'Strength' || s.sessionType === 'Conditioning').slice(0, 3);
    } else {
      // Moderate readiness - suggest moderate intensity
      return allSessions.filter(s => s.sessionType !== 'Recovery').slice(0, 3);
    }
  }, [readinessScore, getAllAvailableSessions]);

  // Filter sessions for swap modal
  const getFilteredSessions = useMemo(() => {
    let filtered = getAllAvailableSessions;

    // Filter by type
    if (swapFilterType) {
      filtered = filtered.filter(s => s.sessionType === swapFilterType);
    }

    // Filter by search query
    if (swapSearchQuery.trim()) {
      const query = swapSearchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.sessionType.toLowerCase().includes(query)
      );
    }

    // Exclude current session
    if (todaySession) {
      filtered = filtered.filter(s => s.sessionId !== todaySession.sessionId);
    }

    return filtered;
  }, [getAllAvailableSessions, swapFilterType, swapSearchQuery, todaySession]);

  // Handle swap session
  const handleSwap = () => {
    setShowSwapModal(true);
  };

  // Confirm and execute swap
  const confirmSwap = async (newSessionId: string, newSessionTitle: string) => {
    if (!todaySession) return;

    Alert.alert(
      'Confirm Swap',
      `Replace "${todaySession.title}" with "${newSessionTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          onPress: async () => {
            try {
              const todayYMD = formatYMD(new Date());
              const swapData = {
                originalSessionId: todaySession.sessionId,
                swappedSessionId: newSessionId,
                date: todayYMD,
              };

              // Save swap to storage
              const updated = { ...swappedSessions, [todayYMD]: swapData };
              setSwappedSessions(updated);
              await AsyncStorage.setItem('swappedSessions', JSON.stringify(updated));

              // Log swap for analytics
              const swapHistory = await AsyncStorage.getItem('swapHistory') || '[]';
              const history = JSON.parse(swapHistory);
              history.push({
                ...swapData,
                timestamp: new Date().toISOString(),
              });
              await AsyncStorage.setItem('swapHistory', JSON.stringify(history));

              setShowSwapModal(false);
              setSwapSearchQuery('');
              setSwapFilterType(null);
              
              // Success toast
              Toast.show({
                type: 'success',
                text1: '✅ Session Swapped!',
                text2: `Replaced with "${newSessionTitle}"`,
                position: 'top',
                visibilityTime: 2500,
              });
            } catch (error) {
              if (__DEV__) {
                console.error('Error swapping session:', error);
              }
              Alert.alert('Error', 'Failed to swap session. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Undo swap
  const handleUndoSwap = async () => {
    if (!todaySession) return;
    const todayYMD = formatYMD(new Date());
    const swap = swappedSessions[todayYMD];

    if (!swap) {
      Alert.alert('No Swap', 'No swap found for today to undo.');
      return;
    }

    Alert.alert(
      'Undo Swap',
      'Revert to original session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          onPress: async () => {
            try {
              const updated = { ...swappedSessions };
              delete updated[todayYMD];
              setSwappedSessions(updated);
              await AsyncStorage.setItem('swappedSessions', JSON.stringify(updated));
              
              // Success toast
              Toast.show({
                type: 'success',
                text1: '↩️ Swap Undone',
                text2: 'Reverted to original session',
                position: 'top',
                visibilityTime: 2000,
              });
            } catch (error) {
              if (__DEV__) {
                console.error('Error undoing swap:', error);
              }
              Alert.alert('Error', 'Failed to undo swap. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Generate multiple weeks for scrollable calendar (12 weeks = 84 days)
  // Memoized to prevent recalculation on every render
  const getMultiWeekDates = useCallback((viewDate?: Date): string[] => {
    const dates: string[] = [];
    const startDate = viewDate || calendarViewDate;
    
    // Get Monday of the week containing the view date
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(startDate);
    monday.setDate(startDate.getDate() + mondayOffset);
    
    // Generate 12 weeks (84 days) starting from the Monday of the view date
    // But also include 4 weeks before for scrolling backward
    const totalWeeks = 16; // 4 weeks before + 12 weeks forward
    const startMonday = new Date(monday);
    startMonday.setDate(monday.getDate() - (4 * 7)); // Go back 4 weeks
    
    for (let i = 0; i < totalWeeks * 7; i++) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + i);
      dates.push(formatYMD(date));
    }
    return dates;
  }, [calendarViewDate]);

  // Memoize multiWeekDates to prevent recalculation
  const multiWeekDates = useMemo(() => getMultiWeekDates(), [getMultiWeekDates]);
  
  // Memoize today's date to avoid recalculating on every render
  const todayYMD = useMemo(() => formatYMD(new Date()), []);
  
  // Get the index of today in the multi-week dates for auto-scrolling
  const todayIndex = useMemo(() => {
    return multiWeekDates.findIndex(d => d === todayYMD);
  }, [multiWeekDates, todayYMD]);

  // Auto-scroll to today when calendar loads or when view date changes
  useEffect(() => {
    if (todayIndex >= 0 && calendarScrollViewRef.current) {
      // Scroll to show today (with some offset to center it)
      const scrollPosition = Math.max(0, (todayIndex * DAY_WIDTH) - (SCREEN_WIDTH * 0.5));
      const timeoutId = setTimeout(() => {
        calendarScrollViewRef.current?.scrollTo({ x: scrollPosition, animated: false });
      }, 100);
      
      // Cleanup timeout on unmount or dependency change
      return () => clearTimeout(timeoutId);
    }
  }, [todayIndex, calendarViewDate]);

  // Get session for a specific date (basic info for calendar)
  // Memoized with useCallback to prevent recreation on every render
  const getSessionForDate = useCallback((dateYMD: string): { sessionId: string; title: string } | null => {
    if (!startDateYMD) return null;
    const offsetDays = daysBetweenYMD(startDateYMD, dateYMD) - programOffset;
    if (offsetDays < 0) return null;
    
    // Special handling for Hypertrophy Month (3-day per week: Mon-Wed-Fri pattern)
    let programWeek: number;
    let dayNumber: number;
    
    if (selectedProgramId === 'hypertrophy') {
      // For 3-day programs: Day 1 = start date, Day 2 = +2 days, Day 3 = +4 days, then repeat weekly
      const daysInCycle = offsetDays % 7;
      programWeek = Math.floor(offsetDays / 7) + 1;
      
      // Map to program days: 0,2,4 → 1,2,3; others are rest days
      if (daysInCycle === 0) {
        dayNumber = 1; // Start date (Day 1)
      } else if (daysInCycle === 2) {
        dayNumber = 2; // +2 days (Day 2)
      } else if (daysInCycle === 4) {
        dayNumber = 3; // +4 days (Day 3)
      } else {
        // Rest day - no session
        return null;
      }
    } else {
      // Standard 7-day week calculation for other programs
      programWeek = Math.floor(offsetDays / 7) + 1;
      dayNumber = (offsetDays % 7) + 1;
    }
    
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
    if (programWeek > totalWeeks) return null;
    
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) return null;
    
    const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
    if (!meso) return null;
    
    // Handle both microcycle and trainingDays formats
    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    // Handle both day and dayNumber properties
    const day = trainingDays.find((d: any) => (d.day === dayNumber || d.dayNumber === dayNumber));
    if (!day) return null;
    
    return {
      sessionId,
      title: day.title || `Day ${dayNumber}`,
    };
  }, [startDateYMD, programOffset, selectedProgramId, currentProgram, programData]);

  // Get full session details for selected date (for preview)
  const selectedDateSession = useMemo(() => {
    if (!selectedDate || !startDateYMD) return null;
    
    const offsetDays = daysBetweenYMD(startDateYMD, selectedDate) - programOffset;
    
    if (offsetDays < 0) return null; // Before program start
    
    // Special handling for Hypertrophy Month (3-day per week: Mon-Wed-Fri pattern)
    let programWeek: number;
    let dayNumber: number;
    
    if (selectedProgramId === 'hypertrophy') {
      const daysInCycle = offsetDays % 7;
      programWeek = Math.floor(offsetDays / 7) + 1;
      
      if (daysInCycle === 0) {
        dayNumber = 1;
      } else if (daysInCycle === 2) {
        dayNumber = 2;
      } else if (daysInCycle === 4) {
        dayNumber = 3;
      } else {
        return null; // Rest day
      }
    } else {
      programWeek = Math.floor(offsetDays / 7) + 1;
      dayNumber = (offsetDays % 7) + 1;
    }
    
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
    if (programWeek > totalWeeks) return null;
    
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) return null;
    
    const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
    if (!meso) return null;
    
    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    const day = trainingDays.find((d: any) => (d.day === dayNumber || d.dayNumber === dayNumber));
    if (!day) return null;
    
    // Get mesocycle and microcycle info
    const microcycleInfo = getMicrocycleDay(sessionId);
    
    return {
      sessionId,
      title: day.title || `Day ${dayNumber}`,
      durationMinutes: day.durationMinutes || 60,
      blocks: day.blocks || [],
      date: selectedDate,
      mesocycle: mesoInfo ? {
        id: meso.id,
        title: meso.title || meso.id,
        weekInMeso: mesoInfo.weekInMeso + 1,
        totalWeeks: meso.weeks?.length || 0,
        phaseFocus: meso.phaseFocus || '',
      } : null,
      microcycle: microcycleInfo,
      programWeek,
    };
  }, [selectedDate, startDateYMD, programOffset, programData, currentProgram, selectedProgramId, getMesocycleForWeek, getMesocycles, getMicrocycleDay]);

  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { padding: 20 },
  
  // Program Selector Styles
  programSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.primary,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  programSelectorContent: {
    flex: 1,
  },
  programSelectorLabel: {
    fontSize: 11,
    color: theme.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
  },
  programSelectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  programSelectorMeta: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  programSelectorArrow: {
    fontSize: 14,
    color: theme.primary,
    marginLeft: 8,
    fontWeight: '700',
  },

  // Today's Session Card
  todayCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  todayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  todayCardTitleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  todayCardLabel: {
    fontSize: 11,
    color: theme.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  todayCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.primary,
    flexShrink: 1,
  },
  todayCardMesocycleInfo: {
    marginBottom: 16,
    gap: 8,
  },
  mesocycleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  mesocycleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  microcycleIndicator: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: -4,
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarText: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '600',
    textAlign: 'right',
  },
  sessionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  sessionTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  todayCardDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  todayCardDetailItem: {
    flex: 1,
  },
  todayCardDetailLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },
  todayCardDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  todayCardInstructions: {
    backgroundColor: theme.backgroundLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 8,
  },
  instructionItem: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  todayCardActions: {
    gap: 10,
  },
  startButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: theme.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: theme.card,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 56,
  },
  quickActionButtonUndo: {
    backgroundColor: theme.primaryFaded,
    borderColor: theme.primary + '40',
  },
  quickActionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  quickActionText: {
    color: theme.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  expandButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  expandButtonText: {
    color: theme.secondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Start Date Button
  startDateButton: {
    backgroundColor: theme.card,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.secondary,
  },
  startDateButtonSet: {
    borderColor: theme.border,
    backgroundColor: theme.backgroundLight,
  },
  startDateButtonText: {
    color: theme.secondary,
    fontSize: 15,
    fontWeight: '700',
  },
  startDateButtonTextSet: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Date Picker Modal
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    marginBottom: 10,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  datePickerCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  datePickerCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.secondary,
  },
  datePickerContainer: {
    width: '100%',
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  datePicker: {
    width: '100%',
    height: 220,
  },

  // Calendar Section
  calendarSection: {
    marginBottom: 20,
  },
  calendarSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  calendarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  calendarNavButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
  },
  calendarHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  jumpToDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.secondary,
  },
  jumpToDateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textOnSecondary,
  },
  weeklyCalendar: {
    paddingVertical: 8,
  },
  multiWeekCalendar: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  calendarDay: {
    width: DAY_WIDTH - 8,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 70,
    justifyContent: 'flex-start',
  },
  calendarDayToday: {
    backgroundColor: theme.primaryFaded,
    borderColor: theme.primary,
    borderWidth: 2,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarDaySelected: {
    backgroundColor: theme.secondaryFaded,
    borderColor: theme.secondary,
    borderWidth: 2,
  },
  calendarDayName: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  calendarDayNameToday: {
    color: theme.primary,
  },
  calendarDayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  calendarDayNumberToday: {
    color: theme.primary,
  },
  calendarMesoLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionIndicator: {
    width: '80%',
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  readinessBadge: {
    fontSize: 14,
    marginTop: 2,
  },
  calendarDayCompleted: {
    backgroundColor: theme.success + '15',
  },
  calendarDayCompletedBorder: {
    borderColor: theme.success,
    borderWidth: 2,
  },
  completionCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: theme.success,
    borderRadius: 12,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  // Full Calendar
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    position: 'relative',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: theme.primary,
  },
  programOption: {
    backgroundColor: theme.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  programOptionSelected: {
    backgroundColor: theme.primaryFaded,
    borderColor: theme.primary,
  },
  programOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  programOptionTitleSelected: {
    color: theme.primary,
  },
  programOptionDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  programOptionWeeks: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },
  programOptionCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 18,
    color: theme.primary,
    fontWeight: '700',
  },
  modalCloseButton: {
    backgroundColor: theme.backgroundDark,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  // Swap Modal Styles
  swapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  swapModalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  swapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  swapModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
  },
  swapModalCloseButton: {
    padding: 8,
  },
  swapModalCloseText: {
    fontSize: 24,
    color: theme.textSecondary,
    fontWeight: '300',
  },
  suggestedSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 12,
  },
  suggestedScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  suggestedCard: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    minWidth: 180,
  },
  suggestedCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  suggestedCardMeta: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  swapFilters: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  swapSearchInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.textPrimary,
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterButtonTextActive: {
    color: theme.textOnPrimary,
  },
  swapListContent: {
    padding: 20,
    paddingTop: 0,
  },
  swapSessionCard: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  swapSessionCardSuggested: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  swapSessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  swapSessionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  swapSessionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  swapSessionTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  swapSessionCardMeta: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  swapEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  swapEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  swapEmptySubtext: {
    fontSize: 14,
    color: theme.textMuted,
  },

  // Push Workouts Modal Styles
  pushModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pushModalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  pushModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  pushModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
  },
  pushModalCloseButton: {
    padding: 8,
  },
  pushModalCloseText: {
    fontSize: 24,
    color: theme.textSecondary,
    fontWeight: '300',
  },
  pushModalInfo: {
    padding: 20,
    backgroundColor: theme.primaryFaded,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  pushModalInfoText: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
  },
  pushListContainer: {
    maxHeight: 200,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.background,
  },
  pushListContent: {
    paddingVertical: 10,
  },
  pushSessionCard: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pushSessionCardSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryFaded,
  },
  pushSessionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pushSessionCheckbox: {
    marginRight: 10,
  },
  pushSessionCheckboxText: {
    fontSize: 20,
    color: theme.textPrimary,
  },
  pushSessionCardText: {
    flex: 1,
  },
  pushSessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  pushSessionDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  pushEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  pushEmptyText: {
    fontSize: 16,
    color: theme.textMuted,
  },
  pushDateSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  pushDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  pushDateButton: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  pushDateButtonSecondary: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pushDateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textOnPrimary,
  },
  pushDateButtonTextSecondary: {
    color: theme.textPrimary,
  },
  pushHelperText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
  },
  pushSelectedCount: {
    fontSize: 16,
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  selectAllButton: {
    padding: 8,
    backgroundColor: theme.secondary,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 10,
  },
  selectAllButtonText: {
    color: theme.textOnSecondary,
    fontWeight: 'bold',
  },

  // Other Actions
  otherActions: {
    marginTop: 8,
    marginBottom: 8,
  },
  otherActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.secondary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonSet: {
    backgroundColor: theme.backgroundLight,
    borderWidth: 2,
    borderColor: theme.border,
  },
  actionButtonSecondary: {
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.accentMuted,
  },
  actionButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
    textAlign: 'center',
  },
  actionButtonText: {
    color: theme.textOnSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextSet: {
    color: theme.textSecondary,
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  devButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  
  // Recovery Modal Styles
  recoveryWorkoutList: {
    padding: 16,
  },
  recoveryWorkoutCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recoveryWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recoveryWorkoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
  },
  recoveryWorkoutDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  recoveryWorkoutDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  recoveryWorkoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recoveryWorkoutBadge: {
    backgroundColor: theme.secondary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recoveryWorkoutBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.secondary,
  },
  programCompleteOptions: {
    gap: 12,
    marginTop: 8,
  },
  programCompleteButton: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  programCompleteButtonPrimary: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  programCompleteButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: theme.secondary,
  },
  programCompleteButtonTertiary: {
    backgroundColor: 'transparent',
    borderColor: theme.borderLight,
  },
  programCompleteButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textOnPrimary,
    marginBottom: 4,
  },
  programCompleteButtonTextSecondary: {
    color: theme.secondary,
  },
  programCompleteButtonTextTertiary: {
    color: theme.textSecondary,
  },
  programCompleteButtonSubtext: {
    fontSize: 14,
    color: theme.textOnPrimary + 'CC',
    textAlign: 'center',
  },
  programCompleteButtonSubtextSecondary: {
    color: theme.textSecondary,
  },
  programCompleteButtonSubtextTertiary: {
    color: theme.textMuted,
  },
  programCompleteNote: {
    marginTop: 20,
    padding: 12,
    backgroundColor: theme.secondary + '15',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.secondary,
  },
  programCompleteNoteText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },

  // Start Date Banner Styles
  startDateBanner: {
    backgroundColor: theme.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: theme.secondaryDark,
  },
  startDateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startDateBannerIcon: {
    fontSize: 28,
  },
  startDateBannerTextContainer: {
    flex: 1,
  },
  startDateBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textOnSecondary,
    marginBottom: 4,
  },
  startDateBannerSubtitle: {
    fontSize: 13,
    color: theme.textOnSecondary,
    opacity: 0.9,
    lineHeight: 18,
  },
  startDateBannerArrow: {
    fontSize: 20,
    color: theme.textOnSecondary,
    fontWeight: '700',
  },

  // Empty State Card
  emptyStateCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: theme.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },

  // Selected Date Preview Card Styles
  previewCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginTop: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: theme.secondary,
  },
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  previewCardTitleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  previewCardLabel: {
    fontSize: 11,
    color: theme.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  previewCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
    flexShrink: 1,
  },
  previewCardMesocycleInfo: {
    marginBottom: 16,
    gap: 8,
  },
  phaseFocusText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  previewCardDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  previewCardDetailItem: {
    flex: 1,
  },
  previewCardDetailLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },
  previewCardDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  previewCardInstructions: {
    backgroundColor: theme.backgroundLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewViewButton: {
    backgroundColor: theme.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewViewButtonText: {
    color: theme.textOnSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Current Program Selector - Top Item */}
        <TouchableOpacity 
          style={styles.programSelector} 
          onPress={() => setShowProgramPicker(true)}
        >
          <View style={styles.programSelectorContent}>
            <Text style={styles.programSelectorLabel}>Current Program</Text>
            <Text style={styles.programSelectorTitle}>{currentProgram.title}</Text>
            <Text style={styles.programSelectorMeta}>
              {currentProgram.weeks} weeks • Tap to change
            </Text>
          </View>
          <Text style={styles.programSelectorArrow}>▼</Text>
        </TouchableOpacity>

        {/* Program Picker Modal */}
        <Modal
          visible={showProgramPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowProgramPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Training Program</Text>
              <FlatList
                data={PROGRAMS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.programOption,
                      item.id === selectedProgramId && styles.programOptionSelected,
                    ]}
                    onPress={() => handleProgramSelect(item.id)}
                  >
                    <Text style={[
                      styles.programOptionTitle,
                      item.id === selectedProgramId && styles.programOptionTitleSelected,
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.programOptionDesc}>{item.description}</Text>
                    <Text style={styles.programOptionWeeks}>{item.weeks} weeks</Text>
                    {item.id === selectedProgramId && (
                      <Text style={styles.programOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowProgramPicker(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Start Date Banner - Shows when start date is not set */}
        {!startDateYMD && (
          <TouchableOpacity 
            style={styles.startDateBanner}
            onPress={handleOpenPicker}
            activeOpacity={0.8}
          >
            <View style={styles.startDateBannerContent}>
              <Text style={styles.startDateBannerIcon}>📅</Text>
              <View style={styles.startDateBannerTextContainer}>
                <Text style={styles.startDateBannerTitle}>Set Your Program Start Date</Text>
                <Text style={styles.startDateBannerSubtitle}>Tap to select when you want to begin your training program</Text>
              </View>
              <Text style={styles.startDateBannerArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Progress Dashboard */}
        {startDateYMD && (
          <ProgressDashboard
            completedSessions={completedSessions}
            startDateYMD={startDateYMD}
            totalWeeks={currentProgram.weeks}
            programOffset={programOffset}
            selectedProgramId={selectedProgramId}
            programData={programData}
          />
        )}

        {/* Today's Session Card */}
        {todaySession && (
          <View style={styles.todayCard}>
            <View style={styles.todayCardHeader}>
              <View style={styles.todayCardTitleContainer}>
                <Text style={styles.todayCardLabel}>Today's Session</Text>
                <Text style={styles.todayCardTitle} numberOfLines={2} ellipsizeMode="tail">
                  {todaySession.title}
                </Text>
              </View>
              <View style={[styles.sessionTypeBadge, { backgroundColor: getSessionTypeColor(todaySession.title) + '20' }]}>
                <Text style={[styles.sessionTypeText, { color: getSessionTypeColor(todaySession.title) }]}>
                  {getSessionType(todaySession.title)}
                </Text>
              </View>
            </View>

            {/* Mesocycle and Microcycle Info */}
            {todaySession.mesocycle && (
              <View style={styles.todayCardMesocycleInfo}>
                <View style={[styles.mesocycleBadge, { backgroundColor: getMesocycleColor(todaySession.mesocycle.id) + '20', borderColor: getMesocycleColor(todaySession.mesocycle.id) }]}>
                  <Text style={[styles.mesocycleBadgeText, { color: getMesocycleColor(todaySession.mesocycle.id) }]}>
                    {todaySession.mesocycle.title} • Week {todaySession.mesocycle.weekInMeso} of {todaySession.mesocycle.totalWeeks}
                  </Text>
                </View>
                {todaySession.microcycle && (
                  <Text style={styles.microcycleIndicator}>
                    Day {todaySession.microcycle.day} of {todaySession.microcycle.totalDays} • {todaySession.durationMinutes} min
                  </Text>
                )}
                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { 
                          width: `${Math.round((todaySession.mesocycle.weekInMeso / todaySession.mesocycle.totalWeeks) * 100)}%`,
                          backgroundColor: getMesocycleColor(todaySession.mesocycle.id),
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressBarText}>
                    {Math.round((todaySession.mesocycle.weekInMeso / todaySession.mesocycle.totalWeeks) * 100)}% Complete
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.todayCardDetails}>
              <View style={styles.todayCardDetailItem}>
                <Text style={styles.todayCardDetailLabel}>Duration</Text>
                <Text style={styles.todayCardDetailValue}>{todaySession.durationMinutes} min</Text>
              </View>
              {readinessScore !== null && (
                <View style={styles.todayCardDetailItem}>
                  <Text style={styles.todayCardDetailLabel}>Readiness</Text>
                  <Text style={[styles.todayCardDetailValue, { color: getReadinessBadge(readinessScore).color }]}>
                    {readinessScore}/10
                  </Text>
                </View>
              )}
            </View>

            {/* Collapsible Instructions */}
            {todaySessionExpanded && todaySession.blocks && (
              <View style={styles.todayCardInstructions}>
                <Text style={styles.instructionsTitle}>Session Overview</Text>
                {todaySession.blocks.slice(0, 3).map((block: any, idx: number) => (
                  <Text key={idx} style={styles.instructionItem}>
                    • {block.name}
                  </Text>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.todayCardActions}>
              <TouchableOpacity style={styles.startButton} onPress={handleStartSession}>
                <Text style={styles.startButtonText}>▶ Start Session</Text>
              </TouchableOpacity>
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={styles.quickActionButton} 
                  onPress={handleSwap}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>🔄</Text>
                  <Text style={styles.quickActionText}>Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickActionButton} 
                  onPress={handlePushWorkouts}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>⏩</Text>
                  <Text style={styles.quickActionText}>Push</Text>
                </TouchableOpacity>
                {todaySession?.isSwapped && (
                  <TouchableOpacity 
                    style={[styles.quickActionButton, styles.quickActionButtonUndo]} 
                    onPress={handleUndoSwap}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickActionIcon}>↩️</Text>
                    <Text style={styles.quickActionText}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Expand Button */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => setTodaySessionExpanded(!todaySessionExpanded)}
            >
              <Text style={styles.expandButtonText}>
                {todaySessionExpanded ? '▲ Hide Details' : '▼ Show Instructions'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No Session Today - Enhanced Empty State */}
        {!todaySession && startDateYMD && (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateIcon}>💪</Text>
            <Text style={styles.emptyStateTitle}>Rest Day</Text>
            <Text style={styles.emptyStateSubtitle}>
              No session scheduled for today. Take time to recover or choose a recovery workout.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                setRecoveryModalDate(formatYMD(new Date()));
                setShowRecoveryModal(true);
              }}
            >
              <Text style={styles.emptyStateButtonText}>Choose Recovery Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upcoming Sessions */}
        {startDateYMD && (
          <UpcomingSessions
            startDateYMD={startDateYMD}
            programOffset={programOffset}
            totalWeeks={currentProgram.weeks}
            getSessionForDate={getSessionForDate}
            getSessionTypeColor={getSessionTypeColor}
            onSessionPress={(sessionId, date) => {
              setSelectedDate(date);
              handleViewSession(sessionId);
            }}
            formatYMD={formatYMD}
            addDaysYMD={addDaysYMD}
            parseYMD={parseYMD}
            selectedProgramId={selectedProgramId}
          />
        )}

        {/* Expanded Scrollable Calendar */}
        <View style={styles.calendarSection}>
          {/* Calendar Header with Navigation */}
          <View style={styles.calendarHeader}>
            <View style={styles.calendarHeaderLeft}>
              <TouchableOpacity 
                style={styles.calendarNavButton}
                onPress={() => {
                  const newDate = new Date(calendarViewDate);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setCalendarViewDate(newDate);
                }}
              >
                <Text style={styles.calendarNavButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calendarHeaderTitle}>
                {calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity 
                style={styles.calendarNavButton}
                onPress={() => {
                  const newDate = new Date(calendarViewDate);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setCalendarViewDate(newDate);
                }}
              >
                <Text style={styles.calendarNavButtonText}>›</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.jumpToDateButton}
              onPress={() => {
                setJumpToDatePicker(new Date());
                setShowJumpToDate(true);
              }}
            >
              <Text style={styles.jumpToDateButtonText}>📍 Jump to Date</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            ref={calendarScrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.multiWeekCalendar}
            decelerationRate="fast"
            snapToInterval={DAY_WIDTH * 7} // Snap to week boundaries
            snapToAlignment="start"
          >
            {multiWeekDates.map((dateYMD, index) => {
              const session = getSessionForDate(dateYMD);
              const isToday = dateYMD === todayYMD;
              const isSelected = dateYMD === selectedDate;
              const isCompleted = session && completedSessions.some(s => s.id === session.sessionId);
              const date = parseYMD(dateYMD);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNumber = date.getDate();
              const sessionColor = session ? getSessionTypeColor(session.title) : theme.textMuted;
              const badge = readinessScore !== null ? getReadinessBadge(readinessScore) : null;
              
              // Get mesocycle info for this date
              const mesoInfo = getMesocycleForDate(dateYMD);
              const mesoColor = mesoInfo ? getMesocycleColor(mesoInfo.meso.id) : null;
              
              // Check if this is the first day of a mesocycle week (show label)
              const isFirstDayOfMesoWeek = mesoInfo && index > 0 && (() => {
                const prevDate = parseYMD(multiWeekDates[index - 1]);
                const prevMesoInfo = getMesocycleForDate(multiWeekDates[index - 1]);
                return !prevMesoInfo || prevMesoInfo.meso.id !== mesoInfo.meso.id || 
                       (date.getDay() === 0 || date.getDay() === 1); // Sunday or Monday
              })();

              return (
                <TouchableOpacity
                  key={dateYMD}
                  style={[
                    styles.calendarDay,
                    isToday && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                    isCompleted && styles.calendarDayCompleted,
                    isCompleted && styles.calendarDayCompletedBorder,
                    mesoColor && { borderColor: mesoColor + '40', borderWidth: 2 },
                  ]}
                  onPress={() => handleDayPress({ dateString: dateYMD })}
                >
                  {isCompleted && (
                    <Text style={styles.completionCheckmark}>✓</Text>
                  )}
                  {isFirstDayOfMesoWeek && mesoInfo && mesoColor && (
                    <Text style={[styles.calendarMesoLabel, { color: mesoColor as string }]}>
                      {mesoInfo.meso.title.charAt(0).toUpperCase()}
                    </Text>
                  )}
                  <Text style={[styles.calendarDayName, isToday && styles.calendarDayNameToday]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.calendarDayNumber, isToday && styles.calendarDayNumberToday]}>
                    {dayNumber}
                  </Text>
                  {session && (
                    <>
                      <View style={[styles.sessionIndicator, { backgroundColor: sessionColor }]} />
                      {badge && (
                        <Text style={[styles.readinessBadge, { color: badge.color }]}>
                          {badge.emoji}
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Date Preview Card */}
        {selectedDate && selectedDateSession && (
          <View style={styles.previewCard}>
            <View style={styles.previewCardHeader}>
              <View style={styles.previewCardTitleContainer}>
                <Text style={styles.previewCardLabel}>
                  {parseYMD(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.previewCardTitle} numberOfLines={2} ellipsizeMode="tail">
                  {selectedDateSession.title}
                </Text>
              </View>
              <View style={[styles.sessionTypeBadge, { backgroundColor: getSessionTypeColor(selectedDateSession.title) + '20' }]}>
                <Text style={[styles.sessionTypeText, { color: getSessionTypeColor(selectedDateSession.title) }]}>
                  {getSessionType(selectedDateSession.title)}
                </Text>
              </View>
            </View>

            {/* Mesocycle Context */}
            {selectedDateSession.mesocycle && (
              <View style={styles.previewCardMesocycleInfo}>
                <View style={[styles.mesocycleBadge, { backgroundColor: getMesocycleColor(selectedDateSession.mesocycle.id) + '20', borderColor: getMesocycleColor(selectedDateSession.mesocycle.id) }]}>
                  <Text style={[styles.mesocycleBadgeText, { color: getMesocycleColor(selectedDateSession.mesocycle.id) }]}>
                    {selectedDateSession.mesocycle.title} Phase • Week {selectedDateSession.mesocycle.weekInMeso} of {selectedDateSession.mesocycle.totalWeeks}
                  </Text>
                </View>
                {selectedDateSession.microcycle && (
                  <Text style={styles.microcycleIndicator}>
                    Day {selectedDateSession.microcycle.day} of {selectedDateSession.microcycle.totalDays} in microcycle
                  </Text>
                )}
                {selectedDateSession.mesocycle.phaseFocus && (
                  <Text style={styles.phaseFocusText}>
                    Focus: {selectedDateSession.mesocycle.phaseFocus}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.previewCardDetails}>
              <View style={styles.previewCardDetailItem}>
                <Text style={styles.previewCardDetailLabel}>Duration</Text>
                <Text style={styles.previewCardDetailValue}>{selectedDateSession.durationMinutes} min</Text>
              </View>
            </View>

            {/* Session Overview */}
            {selectedDateSession.blocks && selectedDateSession.blocks.length > 0 && (
              <View style={styles.previewCardInstructions}>
                <Text style={styles.instructionsTitle}>Session Overview</Text>
                {selectedDateSession.blocks.slice(0, 3).map((block: any, idx: number) => (
                  <Text key={idx} style={styles.instructionItem}>
                    • {block.name}
                  </Text>
                ))}
              </View>
            )}

            {/* View Session Button */}
            <TouchableOpacity 
              style={styles.previewViewButton} 
              onPress={() => handleViewSession(selectedDateSession.sessionId)}
            >
              <Text style={styles.previewViewButtonText}>View Full Session</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* Date Picker Modal */}
        {Platform.OS === 'ios' && showPicker && (
          <Modal
            visible={showPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <View style={styles.datePickerModalOverlay}>
              <View style={styles.datePickerModalContent}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>
                    {pendingPushDate !== null ? 'Select Push Date' : 'Select Start Date'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleDatePickerDone}
                    style={styles.datePickerCloseButton}
                  >
                    <Text style={styles.datePickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    style={styles.datePicker}
                    textColor={theme.textPrimary}
                    themeVariant="light"
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
        
        {/* Android Date Picker (shows as system dialog) */}
        {Platform.OS === 'android' && showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Jump to Date Picker Modal */}
        {Platform.OS === 'ios' && showJumpToDate && (
          <Modal
            visible={showJumpToDate}
            transparent
            animationType="slide"
            onRequestClose={() => setShowJumpToDate(false)}
          >
            <View style={styles.datePickerModalOverlay}>
              <View style={styles.datePickerModalContent}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Jump to Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowJumpToDate(false);
                    }}
                    style={styles.datePickerCloseButton}
                  >
                    <Text style={styles.datePickerCloseText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={jumpToDatePicker}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (event.type === 'set' && selectedDate) {
                        setJumpToDatePicker(selectedDate);
                      } else if (event.type === 'dismissed') {
                        setShowJumpToDate(false);
                      }
                    }}
                    style={styles.datePicker}
                    textColor={theme.textPrimary}
                    themeVariant="light"
                  />
                </View>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    style={[styles.datePickerCloseButton, { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 12, marginHorizontal: 20 }]}
                    onPress={() => {
                      setCalendarViewDate(jumpToDatePicker);
                      setShowJumpToDate(false);
                      // Scroll to the selected date after a short delay to allow state update
                      const selectedYMD = formatYMD(jumpToDatePicker);
                      setTimeout(() => {
                        // Recalculate dates with new view date
                        const newDates = getMultiWeekDates(jumpToDatePicker);
                        const index = newDates.findIndex(d => d === selectedYMD);
                        if (index >= 0 && calendarScrollViewRef.current) {
                          const scrollPosition = Math.max(0, (index * DAY_WIDTH) - (SCREEN_WIDTH * 0.5));
                          calendarScrollViewRef.current?.scrollTo({ x: scrollPosition, animated: true });
                        }
                      }, 200);
                    }}
                  >
                    <Text style={[styles.datePickerCloseText, { color: theme.textOnPrimary, fontWeight: '700' }]}>Go to Date</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        
        {/* Android Jump to Date Picker (shows as system dialog) */}
        {Platform.OS === 'android' && showJumpToDate && (
          <DateTimePicker
            value={jumpToDatePicker}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                setJumpToDatePicker(selectedDate);
                setCalendarViewDate(selectedDate);
                setShowJumpToDate(false);
                // Scroll to the selected date after a short delay to allow state update
                const selectedYMD = formatYMD(selectedDate);
                setTimeout(() => {
                  // Recalculate dates with new view date
                  const newDates = getMultiWeekDates(selectedDate);
                  const index = newDates.findIndex(d => d === selectedYMD);
                  if (index >= 0 && calendarScrollViewRef.current) {
                    const scrollPosition = Math.max(0, (index * DAY_WIDTH) - (SCREEN_WIDTH * 0.5));
                    calendarScrollViewRef.current?.scrollTo({ x: scrollPosition, animated: true });
                  }
                }, 200);
              } else {
                setShowJumpToDate(false);
              }
            }}
          />
        )}

        {/* Swap Session Modal */}
        <Modal
          visible={showSwapModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowSwapModal(false);
            setSwapSearchQuery('');
            setSwapFilterType(null);
          }}
        >
          <View style={styles.swapModalOverlay}>
            <View style={styles.swapModalContent}>
              {/* Header */}
              <View style={styles.swapModalHeader}>
                <Text style={styles.swapModalTitle}>Swap Session</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSwapModal(false);
                    setSwapSearchQuery('');
                    setSwapFilterType(null);
                  }}
                  style={styles.swapModalCloseButton}
                >
                  <Text style={styles.swapModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Suggested Sessions (if readiness score available) */}
              {readinessScore !== null && getSuggestedSessions.length > 0 && (
                <View style={styles.suggestedSection}>
                  <Text style={styles.suggestedTitle}>
                    💡 Suggested for Readiness {readinessScore}/10
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestedScroll}>
                    {getSuggestedSessions.map((session) => (
                      <TouchableOpacity
                        key={session.sessionId}
                        style={[styles.suggestedCard, { borderColor: getSessionTypeColor(session.title) }]}
                        onPress={() => confirmSwap(session.sessionId, session.title)}
                      >
                        <Text style={styles.suggestedCardTitle}>{session.title}</Text>
                        <Text style={styles.suggestedCardMeta}>
                          {session.durationMinutes} min • {session.sessionType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Search and Filters */}
              <View style={styles.swapFilters}>
                <TextInput
                  style={styles.swapSearchInput}
                  placeholder="Search sessions..."
                  placeholderTextColor={theme.textMuted}
                  value={swapSearchQuery}
                  onChangeText={setSwapSearchQuery}
                />
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === null && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType(null)}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === null && styles.filterButtonTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Strength' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Strength')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Strength' && styles.filterButtonTextActive]}>
                      Strength
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Conditioning' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Conditioning')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Conditioning' && styles.filterButtonTextActive]}>
                      Conditioning
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Recovery' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Recovery')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Recovery' && styles.filterButtonTextActive]}>
                      Recovery
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Session List */}
              <FlatList
                data={getFilteredSessions}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => {
                  const isSuggested = getSuggestedSessions.some(s => s.sessionId === item.sessionId);
                  return (
                    <TouchableOpacity
                      style={[styles.swapSessionCard, isSuggested && styles.swapSessionCardSuggested]}
                      onPress={() => confirmSwap(item.sessionId, item.title)}
                    >
                      <View style={styles.swapSessionCardHeader}>
                        <Text style={styles.swapSessionCardTitle}>{item.title}</Text>
                        <View style={[styles.swapSessionTypeBadge, { backgroundColor: getSessionTypeColor(item.title) + '20' }]}>
                          <Text style={[styles.swapSessionTypeText, { color: getSessionTypeColor(item.title) }]}>
                            {item.sessionType}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.swapSessionCardMeta}>
                        {item.durationMinutes} min
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.swapEmptyContainer}>
                    <Text style={styles.swapEmptyText}>No sessions found</Text>
                    <Text style={styles.swapEmptySubtext}>Try adjusting your filters or search</Text>
                  </View>
                }
                contentContainerStyle={styles.swapListContent}
              />
            </View>
          </View>
        </Modal>

        {/* Push Workouts Modal */}
        <Modal
          visible={showPushModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowPushModal(false);
            setSelectedMissedSessions(new Set());
            setPendingPushDate(null);
          }}
        >
          <View style={styles.pushModalOverlay}>
            <View style={styles.pushModalContent}>
              {/* Header */}
              <View style={styles.pushModalHeader}>
                <Text style={styles.pushModalTitle}>Push Missed Workouts</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowPushModal(false);
                    setSelectedMissedSessions(new Set());
                    setPendingPushDate(null);
                  }}
                  style={styles.pushModalCloseButton}
                >
                  <Text style={styles.pushModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={styles.pushModalInfo}>
                <Text style={styles.pushModalInfoText}>
                  Found {getMissedSessions.length} missed workout(s). Select which ones to push forward.
                </Text>
              </View>

              {/* Selected Count */}
              <Text style={styles.pushSelectedCount}>
                {selectedMissedSessions.size} of {getMissedSessions.length} selected
              </Text>

              {/* Select All Button */}
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleSelectAllMissedSessions}
              >
                <Text style={styles.selectAllButtonText}>
                  {selectedMissedSessions.size === getMissedSessions.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>

              {/* Missed Sessions List */}
              <View style={styles.pushListContainer}>
                <FlatList
                  data={getMissedSessions}
                  keyExtractor={(item) => item.sessionId}
                  renderItem={({ item }) => {
                    const isSelected = selectedMissedSessions.has(item.sessionId);
                    return (
                      <TouchableOpacity
                        style={[styles.pushSessionCard, isSelected && styles.pushSessionCardSelected]}
                        onPress={() => toggleMissedSessionSelection(item.sessionId)}
                      >
                        <View style={styles.pushSessionCardContent}>
                          <Text style={styles.pushSessionCheckbox}>
                            {isSelected ? '☑' : '☐'}
                          </Text>
                          <View style={styles.pushSessionCardText}>
                            <Text style={styles.pushSessionTitle}>{item.title}</Text>
                            <Text style={styles.pushSessionDate}>
                              Missed on: {parseYMD(item.shouldHaveBeen).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.pushEmptyContainer}>
                      <Text style={styles.pushEmptyText}>No missed workouts</Text>
                    </View>
                  }
                  contentContainerStyle={styles.pushListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                />
              </View>

              {/* Target Date Selection */}
              <View style={styles.pushDateSection}>
                <Text style={styles.pushDateLabel}>Push to date:</Text>
                {pendingPushDate !== null && (
                  <Text style={styles.pushHelperText}>
                    Selected date: {parseYMD(formatYMD(pickerDate)).toLocaleDateString()}. Tap "Push to Selected Date" below to confirm.
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.pushDateButton, selectedMissedSessions.size === 0 && styles.disabledButton]}
                  onPress={() => {
                    if (selectedMissedSessions.size === 0) return;
                    const todayYMD = formatYMD(new Date());
                    executePushWorkouts(todayYMD);
                  }}
                  disabled={selectedMissedSessions.size === 0}
                >
                  <Text style={styles.pushDateButtonText}>Push to Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pushDateButton,
                    styles.pushDateButtonSecondary,
                    selectedMissedSessions.size === 0 && styles.disabledButton,
                  ]}
                  onPress={() => {
                    if (selectedMissedSessions.size === 0) return;
                    // Keep push modal open and open date picker with push flag
                    setPendingPushDate('pending'); // Flag that we want to push after date selection
                    setPickerDate(new Date()); // Initialize picker to today
                    setShowPicker(true);
                  }}
                  disabled={selectedMissedSessions.size === 0}
                >
                  <Text style={[styles.pushDateButtonText, styles.pushDateButtonTextSecondary]}>
                    {pendingPushDate !== null ? 'Push to Selected Date' : 'Choose Custom Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Recovery Workout Selection Modal */}
        <Modal
          visible={showRecoveryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecoveryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>No Session Scheduled</Text>
                <Text style={styles.modalSubtitle}>
                  {recoveryModalDate ? `Choose a recovery workout for ${recoveryModalDate}` : 'Choose a recovery workout'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowRecoveryModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={recoveryWorkoutsData.recoveryWorkouts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recoveryWorkoutCard}
                    onPress={() => {
                      // Create a recovery session ID and navigate
                      const recoverySessionId = `recovery:${item.id}:${recoveryModalDate || formatYMD(new Date())}`;
                      setShowRecoveryModal(false);
                      navigation.navigate('Session', { sessionId: recoverySessionId });
                    }}
                  >
                    <View style={styles.recoveryWorkoutHeader}>
                      <Text style={styles.recoveryWorkoutTitle}>{item.title}</Text>
                      <Text style={styles.recoveryWorkoutDuration}>{item.durationMinutes} min</Text>
                    </View>
                    <Text style={styles.recoveryWorkoutDescription}>{item.description}</Text>
                    <View style={styles.recoveryWorkoutMeta}>
                      <View style={styles.recoveryWorkoutBadge}>
                        <Text style={styles.recoveryWorkoutBadgeText}>{item.intensity}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.recoveryWorkoutList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        {/* Program Complete Modal */}
        <Modal
          visible={showProgramCompleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            // Don't allow closing without selecting an option
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎉 Program Complete!</Text>
                <Text style={styles.modalSubtitle}>
                  You've finished {currentProgram.title}. What would you like to do next?
                </Text>
              </View>

              <View style={styles.programCompleteOptions}>
                <TouchableOpacity
                  style={[styles.programCompleteButton, styles.programCompleteButtonPrimary]}
                  onPress={async () => {
                    // Repeat Program: Reset start date, programOffset, completedSessions (keep 1RMs and logs)
                    const todayYMD = formatYMD(new Date());
                    await AsyncStorage.setItem('startDateYMD', todayYMD);
                    await AsyncStorage.setItem('programOffset', '0');
                    await AsyncStorage.removeItem('completedSessions');
                    await AsyncStorage.removeItem('programCompleteShown');
                    setStartDateYMD(todayYMD);
                    setProgramOffset(0);
                    setCompletedSessions([]);
                    setProgramCompleteShown(false);
                    setShowProgramCompleteModal(false);
                    Toast.show({
                      type: 'success',
                      text1: '✅ Program Restarted',
                      text2: `${currentProgram.title} will start from Week 1, Day 1.`,
                      position: 'top',
                      visibilityTime: 3000,
                    });
                  }}
                >
                  <Text style={styles.programCompleteButtonText}>🔄 Repeat Program</Text>
                  <Text style={styles.programCompleteButtonSubtext}>
                    Start {currentProgram.title} from the beginning
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.programCompleteButton, styles.programCompleteButtonSecondary]}
                  onPress={async () => {
                    // Choose New Program: Show program picker
                    setShowProgramCompleteModal(false);
                    await AsyncStorage.removeItem('programCompleteShown');
                    setProgramCompleteShown(false);
                    setShowProgramPicker(true);
                  }}
                >
                  <Text style={[styles.programCompleteButtonText, styles.programCompleteButtonTextSecondary]}>
                    📋 Choose New Program
                  </Text>
                  <Text style={[styles.programCompleteButtonSubtext, styles.programCompleteButtonSubtextSecondary]}>
                    Select a different program to start
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.programCompleteButton, styles.programCompleteButtonTertiary]}
                  onPress={async () => {
                    // Continue Viewing: Dismiss modal, mark as shown
                    await AsyncStorage.setItem('programCompleteShown', 'true');
                    setProgramCompleteShown(true);
                    setShowProgramCompleteModal(false);
                  }}
                >
                  <Text style={[styles.programCompleteButtonText, styles.programCompleteButtonTextTertiary]}>
                    👀 Continue Viewing
                  </Text>
                  <Text style={[styles.programCompleteButtonSubtext, styles.programCompleteButtonSubtextTertiary]}>
                    Browse past sessions and data
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.programCompleteNote}>
                <Text style={styles.programCompleteNoteText}>
                  💡 Your 1RMs and workout logs are preserved and will carry over to your next program.
                </Text>
              </View>
            </View>
          </View>
        </Modal>

        {/* Other Actions - Enhanced */}
        <View style={styles.otherActions}>
          <Text style={styles.otherActionsTitle}>Quick Actions</Text>
          
          <View style={styles.actionButtonsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('My1RMs')}
            >
              <Text style={styles.actionButtonIcon}>💪</Text>
              <Text style={styles.actionButtonText}>My 1RMs</Text>
            </TouchableOpacity>

            {/* Pick Start Date Button */}
            <TouchableOpacity 
              style={[
                styles.actionButton,
                startDateYMD && styles.actionButtonSet
              ]}
              onPress={handleOpenPicker}
            >
              <Text style={styles.actionButtonIcon}>📅</Text>
              <Text style={[
                styles.actionButtonText,
                startDateYMD && styles.actionButtonTextSet
              ]}>
                {startDateYMD ? 'Start Date' : 'Set Date'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton,
                selectedProgramId !== 'test' && styles.actionButtonSecondary
              ]}
              onPress={() => navigation.navigate('TestValidation')}
            >
              <Text style={styles.actionButtonIcon}>🧪</Text>
              <Text style={[
                styles.actionButtonText,
                selectedProgramId !== 'test' && styles.actionButtonTextSecondary
              ]}>
                Tests
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButtonSecondary}
              onPress={() => navigation.navigate('ThemeMockups')}
            >
              <Text style={styles.actionButtonIcon}>🎨</Text>
              <Text style={styles.actionButtonTextSecondary}>
                Themes
              </Text>
            </TouchableOpacity>

            {/* Clear Store Data */}
            <TouchableOpacity 
              style={styles.actionButtonSecondary}
              onPress={async () => {
                Alert.alert(
                    'Clear Store Data',
                    'This will clear all exercise data, session logs, progression states, completed sessions, 1RMs, and exercise history. This cannot be undone. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear All Data',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            // Get all keys from AsyncStorage
                            const allKeys = await AsyncStorage.getAllKeys();
                            
                            // Filter out keys we want to keep (theme, analytics settings, etc.)
                            const keysToKeep = [
                              'theme',
                              'analyticsDisabled',
                              'soundAlertsEnabled',
                            ];
                            
                            // Get keys to remove (all except the ones to keep)
                            const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
                            
                            // Remove all exercise and session data
                            if (keysToRemove.length > 0) {
                              await AsyncStorage.multiRemove(keysToRemove);
                            }
                            
                            // Reset state
                            setStartDateYMD(null);
                            setProgramOffset(0);
                            setCompletedSessions([]);
                            setProgramCompleteShown(false);
                            
                            // Reset selected program to default
                            const defaultProgram = PROGRAMS[0].id;
                            setSelectedProgramId(defaultProgram);
                            await AsyncStorage.setItem(STORAGE_KEY_PROGRAM, defaultProgram);
                            
                            Toast.show({
                              type: 'success',
                              text1: '✅ Store Data Cleared',
                              text2: `Cleared ${keysToRemove.length} items. All exercise data, logs, and sessions reset.`,
                              position: 'top',
                              visibilityTime: 3000,
                            });
                          } catch (error) {
                            console.error('Error clearing store data:', error);
                            Alert.alert('Error', 'Failed to clear store data.');
                          }
                        },
                      },
                    ]
                  );
              }}
            >
              <Text style={styles.actionButtonIcon}>🗑️</Text>
              <Text style={styles.actionButtonTextSecondary}>
                Clear Data
              </Text>
            </TouchableOpacity>
          </View>

          {/* Developer Actions - Hidden but functionality preserved */}
          {false && __DEV__ && (
            <TouchableOpacity 
              style={[styles.actionButtonSecondary, styles.devButton, { borderColor: theme.error }]}
              onPress={async () => {
                Alert.alert(
                  'Reset Onboarding',
                  'This will reset your onboarding status. Would you like to go to the setup screen now?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset & Go to Setup',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await AsyncStorage.removeItem('onboardingComplete');
                          await AsyncStorage.removeItem('programOffset');
                          await AsyncStorage.removeItem('startDateYMD');
                          setStartDateYMD(null);
                          navigation.replace('Onboarding');
                        } catch (error) {
                          Alert.alert('Error', 'Failed to reset onboarding.');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={[styles.actionButtonTextSecondary, { color: theme.error }]}>
                🔄 Reset Onboarding (Dev)
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Bottom spacing for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
