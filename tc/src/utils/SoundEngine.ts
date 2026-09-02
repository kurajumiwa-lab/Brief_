/**
 * SoundEngine
 * Zero-asset audio feedback synthesizer using the Web Audio API.
 * SSR-safe, test-safe, lazy-initialized on first user gesture.
 *
 * This is additive and non-destructive: it never touches global styles or
 * layout, never fetches an .mp3/.png/.webm, and fails silently when the
 * browser blocks/supports neither audio nor haptics. State is kept in a module
 * singleton and the mute preference is persisted under its own key.
 */

type SoundType = 'tap' | 'heavyTap' | 'reward' | 'victory' | 'defeat' | 'countdown' | 'matchReady' | 'cheer';

const MUTE_KEY = 'brief_arena_sound_muted';

function safeReadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

function safeWriteMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // localStorage can be unavailable (private mode, embedded webview).
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Read persisted preference at construction; this runs only where window
    // exists but still survives SSR/node test bundles because it is guarded.
    this.isMuted = safeReadMuted();
  }

  /**
   * Lazily initialize AudioContext on user interaction
   * to comply with browser autoplay policies.
   */
  private initContext(): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return false;
      }
    }

    if (this.ctx.state === 'suspended') {
      // resume() can reject on some muted/mobile contexts; never surface it.
      void this.ctx.resume().catch(() => undefined);
    }

    return true;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    safeWriteMuted(muted);
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public triggerHaptic(pattern: number | number[] = 15): void {
    if (typeof window === 'undefined') return;
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Suppress errors on unsupported devices.
    }
  }

  public play(type: SoundType): void {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      switch (type) {
        case 'tap':
          this.synthesizeTap();
          break;
        case 'heavyTap':
          this.synthesizeHeavyTap();
          break;
        case 'reward':
          this.synthesizeReward();
          break;
        case 'victory':
        case 'cheer':
          this.synthesizeVictory();
          break;
        case 'defeat':
          this.synthesizeDefeat();
          break;
        case 'countdown':
          this.synthesizeCountdown();
          break;
        case 'matchReady':
          this.synthesizeMatchReady();
          break;
      }
    } catch {
      // Fail silently if audio subsystem is blocked.
    }
  }

  // --- Synthesis Subroutines ---

  private synthesizeTap(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
    this.triggerHaptic(12);
  }

  private synthesizeHeavyTap(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
    this.triggerHaptic([25, 30, 45]);
  }

  private synthesizeReward(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 -> E5 -> G5 -> C6

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });

    this.triggerHaptic([30, 20, 40]);
  }

  private synthesizeVictory(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880]; // A Major fanfare

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    });

    this.triggerHaptic([40, 30, 60, 30, 80]);
  }

  private synthesizeDefeat(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
    this.triggerHaptic([60, 40, 60]);
  }

  private synthesizeCountdown(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
    this.triggerHaptic(20);
  }

  private synthesizeMatchReady(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [330, 440, 660, 880];

    freqs.forEach((freq, idx) => {
      const noteTime = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.12);
    });

    this.triggerHaptic([50, 40, 80]);
  }
}

export const soundEngine = new SoundEngine();
