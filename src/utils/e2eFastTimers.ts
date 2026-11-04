/**
 * E2E Fast Timers
 *
 * When enabled (via Test Validation screen toggle), all timers run at 10x speed
 * so Maestro E2E flows can complete sessions without waiting real time.
 * Only active in __DEV__.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'e2e_fast_timers';

declare global {
  // eslint-disable-next-line no-var
  var __E2E_FAST_TIMERS__: boolean | undefined;
}

export function isFastTimersEnabled(): boolean {
  return __DEV__ && !!(global as unknown as { __E2E_FAST_TIMERS__?: boolean }).__E2E_FAST_TIMERS__;
}

/** Interval in ms between timer ticks (100 = 10x speed, 1000 = real time) */
export function getTickIntervalMs(): number {
  return isFastTimersEnabled() ? 100 : 1000;
}

/** How many seconds to subtract per tick (10 when fast = 10 sec per real second) */
export function getTickDecrement(): number {
  return isFastTimersEnabled() ? 10 : 1;
}

export async function setFastTimersEnabled(enabled: boolean): Promise<void> {
  (global as unknown as { __E2E_FAST_TIMERS__?: boolean }).__E2E_FAST_TIMERS__ = enabled;
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function loadFastTimersFromStorage(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    (global as unknown as { __E2E_FAST_TIMERS__?: boolean }).__E2E_FAST_TIMERS__ = v === 'true';
  } catch {
    // Ignore
  }
}
