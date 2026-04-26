import { clamp } from "@b-m4th/shared";

export type SoundCue =
  | "cell-select"
  | "entry-correct"
  | "entry-wrong"
  | "combo"
  | "bingo"
  | "puzzle-complete";

export interface SoundSettings {
  enabled: boolean;
  volume: number;
}

const STORAGE_KEY = "b-m4th.sound";

class SoundManagerImpl {
  private context: AudioContext | null = null;
  private enabled = true;
  private volume = 0.45;

  load(): SoundSettings {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SoundSettings>;
        this.enabled = parsed.enabled ?? this.enabled;
        this.volume = clamp(parsed.volume ?? this.volume, 0, 1);
      } catch (err) {
        console.warn("Sound settings parse failed:", err);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return this.settings();
  }

  configure(settings: Partial<SoundSettings>): SoundSettings {
    this.enabled = settings.enabled ?? this.enabled;
    this.volume = clamp(settings.volume ?? this.volume, 0, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings()));
    return this.settings();
  }

  settings(): SoundSettings {
    return { enabled: this.enabled, volume: this.volume };
  }

  trigger(cue: SoundCue): void {
    if (!this.enabled || this.volume <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    if (cue === "cell-select") this.blip(context, 520, 0.035, "square", 0.25);
    else if (cue === "entry-correct") this.arpeggio(context, [660, 880, 1040], 0.055, "triangle");
    else if (cue === "entry-wrong") this.blip(context, 170, 0.11, "sawtooth", 0.18);
    else if (cue === "combo") this.arpeggio(context, [740, 980], 0.07, "triangle");
    else if (cue === "bingo") this.arpeggio(context, [523, 659, 784, 1046], 0.105, "square");
    else if (cue === "puzzle-complete") this.arpeggio(context, [523, 659, 784, 987, 1174], 0.115, "triangle");
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    return this.context;
  }

  private arpeggio(
    context: AudioContext,
    freqs: number[],
    step: number,
    type: OscillatorType,
  ): void {
    freqs.forEach((freq, index) => {
      this.tone(context, freq, context.currentTime + index * step, step * 1.25, type, 0.22);
    });
  }

  private blip(
    context: AudioContext,
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
  ): void {
    this.tone(context, freq, context.currentTime, duration, type, gain);
  }

  private tone(
    context: AudioContext,
    freq: number,
    start: number,
    duration: number,
    type: OscillatorType,
    gainAmount: number,
  ): void {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainAmount * this.volume), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const SoundManager = new SoundManagerImpl();

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
