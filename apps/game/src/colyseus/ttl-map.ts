export interface TtlMapOptions {
  sweepIntervalMs?: number;
  now?: () => number;
}

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export class TtlMap<V> {
  protected readonly store = new Map<string, { value: V; expiresAt: number }>();
  protected readonly ttlMs: number;
  protected readonly now: () => number;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(ttlMs: number, opts: TtlMapOptions = {}) {
    this.ttlMs = ttlMs;
    this.now = opts.now ?? Date.now;
    const interval = opts.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    if (interval > 0 && typeof setInterval === "function") {
      this.sweepTimer = setInterval(() => this.sweep(), interval);
      this.sweepTimer.unref?.();
    }
  }

  protected set(key: string, value: V): void {
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  protected getEntry(key: string): V | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  protected deleteEntry(key: string): void {
    this.store.delete(key);
  }

  sweep(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }

  dispose(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.store.clear();
  }
}
