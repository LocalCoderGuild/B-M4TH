export function minutesToMs(minutes: number): number {
  return minutes * 60_000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
