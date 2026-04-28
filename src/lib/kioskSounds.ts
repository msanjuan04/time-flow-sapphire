/**
 * Sound feedback for kiosks (NFC, code, etc).
 *
 * Uses the Web Audio API to synthesize short tones at runtime — no audio
 * files to load, works offline, and there's nothing to ship.
 *
 * The first call lazily creates an AudioContext. Browsers require a user
 * interaction before audio can play, but on a kiosk the page is opened by
 * a person (touch/click), so the first beep usually happens AFTER that.
 * If the context is "suspended" (autoplay policy) we attempt to resume.
 */

type SoundKind = "success_in" | "success_out" | "error" | "queued";

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
};

interface Tone {
  freq: number;       // Hz
  startAt: number;    // seconds offset from "now"
  duration: number;   // seconds
  gain?: number;      // 0..1, default 0.18
  type?: OscillatorType; // default "sine"
}

const playTones = (tones: Tone[]) => {
  const audio = getCtx();
  if (!audio) return;

  // Resume if suspended (autoplay policies)
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  const now = audio.currentTime;
  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;

    const peak = t.gain ?? 0.18;
    const start = now + t.startAt;
    const end = start + t.duration;

    // Smooth attack & release to avoid clicks
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.setValueAtTime(peak, end - 0.04);
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
};

const PRESETS: Record<SoundKind, Tone[]> = {
  // Pleasant ascending major third — entrada
  success_in: [
    { freq: 880, startAt: 0,    duration: 0.12, type: "sine" }, // A5
    { freq: 1318.5, startAt: 0.13, duration: 0.18, type: "sine" }, // E6
  ],
  // Descending — salida
  success_out: [
    { freq: 1046.5, startAt: 0,    duration: 0.12, type: "sine" }, // C6
    { freq: 783.99, startAt: 0.13, duration: 0.18, type: "sine" }, // G5
  ],
  // Single warm beep — guardado offline
  queued: [
    { freq: 660, startAt: 0, duration: 0.22, type: "sine", gain: 0.16 },
  ],
  // Two short low buzzes — error
  error: [
    { freq: 220, startAt: 0,    duration: 0.13, type: "square", gain: 0.10 },
    { freq: 196, startAt: 0.18, duration: 0.18, type: "square", gain: 0.10 },
  ],
};

export const playKioskSound = (kind: SoundKind): void => {
  try {
    playTones(PRESETS[kind]);
  } catch (err) {
    // Audio is best-effort; never throw on a kiosko.
    console.warn("playKioskSound failed:", err);
  }
};

/**
 * Call once after the first user interaction in the kiosko (touch, click,
 * keypress). Some browsers require this so the AudioContext can play later
 * without user gesture. Safe to call multiple times.
 */
export const primeKioskAudio = (): void => {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }
};
