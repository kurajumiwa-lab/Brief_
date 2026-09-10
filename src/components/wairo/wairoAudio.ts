// Futuristic Web Audio API Sound Synthesizer (Zero-dependency)
let audioCtx: AudioContext | null = null;
let soundEnabled = true;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const toggleSound = (enabled?: boolean): boolean => {
  soundEnabled = enabled !== undefined ? enabled : !soundEnabled;
  return soundEnabled;
};

export const isSoundEnabled = (): boolean => soundEnabled;

export const playSound = (_type: 'click' | 'open' | 'radar' | 'success' | 'message' = 'click'): void => {
  // SOUND IS DISABLED (product decision). No AudioContext is created.
  return;
};
