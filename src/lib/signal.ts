"use client";

// The end-of-rest signal (stage 35): three short beeps made in code (no sound files — works offline)
// and a vibration where the phone allows it (not on iPhone).

const SOUND_KEY = "st-rest-sound";
let ctx: AudioContext | null = null;

/**
 * Browsers play sound only after a tap. Call this from tap handlers (ticking a set, «Начать подход»),
 * so the beep at the end of the rest can play later.
 */
export function primeSignal() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, "off");
  } catch {
    // Private mode: the choice lasts until the screen is closed.
  }
}

export function playRestSignal() {
  try {
    navigator.vibrate?.([180, 90, 180, 90, 180]);
  } catch {
    // No vibration API (iPhone).
  }
  if (!soundOn() || !ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = i === 2 ? 1320 : 880;
    const t = t0 + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}
