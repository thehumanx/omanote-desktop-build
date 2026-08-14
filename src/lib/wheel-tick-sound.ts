// A tiny synthesized "tick" for the history date wheel — no audio asset
// needed, just a short decaying blip via the Web Audio API.
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

export function playWheelTick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Browsers suspend AudioContext until a user gesture — scrolling/clicking
  // the wheel counts, so resume lazily here rather than requiring a separate
  // "enable sound" interaction.
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const duration = 0.09;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 420;
  // Soft attack (no sharp click transient) into a slow, gentle decay —
  // a muffled thump rather than a mechanical tick.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}
