/** Per-set log entry used by SessionScreen / SessionBlockViewScreen */
export type SetLogEntry = {
  weight: string;
  reps: string;
  /** Rated Perceived Exertion 1-10 (optional) */
  rpe?: string;
  /** Reps in Reserve; if set without rpe, rpe is derived as 10 - rir */
  rir?: string;
};

export type SetLogsMap = Record<number, SetLogEntry[]>;

export function parseOptionalRpe(value: string | undefined): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const n = parseFloat(String(value));
  if (isNaN(n) || n < 1 || n > 10) return undefined;
  return Math.round(n * 2) / 2; // allow .5
}

export function parseOptionalRir(value: string | undefined): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const n = parseFloat(String(value));
  if (isNaN(n) || n < 0 || n > 10) return undefined;
  return Math.round(n * 2) / 2;
}

/** Prefer explicit RPE; else derive from RIR (RPE ≈ 10 - RIR). */
export function resolveSetRpe(entry: SetLogEntry | undefined): number | undefined {
  if (!entry) return undefined;
  const rpe = parseOptionalRpe(entry.rpe);
  if (rpe != null) return rpe;
  const rir = parseOptionalRir(entry.rir);
  if (rir != null) return Math.max(1, Math.min(10, 10 - rir));
  return undefined;
}

/**
 * Session-level RPE for history / Rule of 3:
 * prefer last completed set with RPE, else average of sets that have RPE.
 */
export function aggregateSessionRpe(entries: SetLogEntry[]): number | undefined {
  if (!entries.length) return undefined;
  const last = [...entries].reverse().map(resolveSetRpe).find((v) => v != null);
  if (last != null) return last;
  const vals = entries.map(resolveSetRpe).filter((v): v is number => v != null);
  if (!vals.length) return undefined;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2) / 2;
}
