import { createContext, useContext } from 'react';
import {
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * One clock for all the decorative idle motion inside a surface (card blobs, squirrel
 * tail, chart pulse...). Each loop derives its phase from this clock instead of
 * running its own `withRepeat`, which means:
 *
 *  - A surface that is off screen, or moving under the finger, pauses its clock. Paused
 *    clock = no shared value changes = no per-frame work for anything inside it, so the
 *    UI thread spends every frame on the gesture.
 *  - When the clock resumes, every loop picks up exactly where it stopped (no jumps).
 *  - Reduced motion never starts the clock, so everything holds still.
 */

const ClockContext = createContext<SharedValue<number> | null>(null);

/** Frames longer than this (app in background, a long stall) don't fast-forward loops. */
const MAX_STEP = 50;

export function MotionClock({
  active,
  children,
}: {
  /** Clock runs only while this is true. Omit to always run. */
  active?: SharedValue<boolean>;
  children: React.ReactNode;
}) {
  const clock = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useFrameCallback((frame) => {
    'worklet';
    if (active && !active.get()) return;
    const step = frame.timeSincePreviousFrame ?? 16;
    clock.set(clock.get() + Math.min(step, MAX_STEP));
  }, !reduceMotion);

  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

/** Milliseconds of motion time for the nearest <MotionClock>. Stays at 0 without one. */
export function useMotionClock() {
  const fallback = useSharedValue(0);
  return useContext(ClockContext) ?? fallback;
}

/**
 * Smooth 0 → 1 → 0 wave (like `withRepeat(withTiming(1, sin easing), -1, true)`).
 * `period` is one full there-and-back cycle in ms; `phase` (0..1) offsets it.
 */
export function wave(time: number, period: number, phase = 0) {
  'worklet';
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / period + phase));
}
