"use client";

import { getPlatform, IS_ANDROID } from "@/platform";

// The end-of-rest signal (stage 35): three short beeps made in code (no sound files — works offline)
// and a vibration where the phone allows it (not on iPhone). In the APK (A5) the beeps are played by the phone itself,
// by the same rule as when the app is away: in headphones over the music, from the speaker only in the normal mode.

const SOUND_KEY = "st-rest-sound";
let ctx: AudioContext | null = null;
let nativeBeep: ((tick: boolean) => boolean) | null = null;
if (IS_ANDROID && typeof window !== "undefined") getPlatform().then((p) => (nativeBeep = p.restAlarm.beep));

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

/** APK: while the app is away the phone gives the signal itself (lib/rest-alarm); the page, still ticking, keeps quiet. */
function awayInApk(): boolean {
  return IS_ANDROID && document.visibilityState === "hidden";
}

export function playRestSignal() {
  if (awayInApk()) return;
  try {
    navigator.vibrate?.([180, 90, 180, 90, 180]);
  } catch {
    // No vibration API (iPhone).
  }
  if (!soundOn() || nativeBeep?.(false)) return;
  if (!ctx || ctx.state !== "running") return;
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

/** One short beep: «3 секунды до конца» in a timed circuit (stage 39). */
export function playTick() {
  if (awayInApk()) return;
  try {
    navigator.vibrate?.(80);
  } catch {
    // No vibration API (iPhone).
  }
  if (!soundOn() || nativeBeep?.(true)) return;
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}
