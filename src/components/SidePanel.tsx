import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MotionClock } from '@/lib/motion';
import { themed } from '@/theme';

/**
 * Screens reached with a left swipe: a "fade-through". A host can hold several panels
 * (Money → All entries, Tasks → Notes); whichever `PanelSwipe` starts the swipe picks
 * which one comes in.
 *
 * While the finger moves, home fades out, shrinks a little and drifts left, and the
 * panel fades in over it from the right. Content on both sides can read `progress`
 * to stagger itself (see `usePanelReveal` / `usePanelExit`). When the finger lifts,
 * an eased timing finishes the move slowly enough to be seen even after a quick flick.
 */

type Ctx = {
  /** 0 = home, 1 = panel fully open. Driven by the finger while dragging. */
  progress: SharedValue<number>;
  width: number;
  isOpen: boolean;
  /** Key of the panel that is (or was last) shown. */
  active: string;
  /** Same, readable from worklets. */
  activeKey: SharedValue<string>;
  open: (key: string) => void;
  close: () => void;
  /** Called from the gesture worklet once the finger lifts. */
  settled: (open: boolean, key: string) => void;
  /** Pinned in place (desktop, side by side): swipes do nothing. */
  docked?: boolean;
};

const SidePanelContext = createContext<Ctx | null>(null);

export function useSidePanel() {
  const ctx = useContext(SidePanelContext);
  if (!ctx) throw new Error('useSidePanel must be used inside <SidePanelHost>');
  return ctx;
}

/** Same as `useSidePanel`, but `null` outside a <SidePanelHost> (e.g. on desktop). */
export function useSidePanelOptional() {
  return useContext(SidePanelContext);
}

/**
 * Desktop, wide window: home and its panel sit next to each other instead of trading
 * places. Wrap each side in one of these so the same components work unchanged: `at` 0
 * for the home side, 1 for the panel side. `open` / `close` are handed to the caller.
 */
export function DockedPanel({
  at,
  width,
  onOpen,
  onClose,
  children,
}: {
  at: 0 | 1;
  width: number;
  onOpen?: (key: string) => void;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const progress = useSharedValue<number>(at);
  const activeKey = useSharedValue('');
  const ctx = useMemo<Ctx>(
    () => ({
      progress,
      width,
      isOpen: at === 1,
      active: '',
      activeKey,
      open: (key) => onOpen?.(key),
      close: () => onClose?.(),
      settled: () => {},
      docked: true,
    }),
    [progress, activeKey, width, at, onOpen, onClose],
  );
  return <SidePanelContext.Provider value={ctx}>{children}</SidePanelContext.Provider>;
}

/** Finish the move from wherever the finger left it. Longer when there is further to go. */
function settle(from: number, to: number) {
  'worklet';
  return withTiming(to, {
    duration: 380 + 320 * Math.abs(to - from),
    // Gentle start, soft landing: the cross-fade stays visible even after a quick flick.
    easing: Easing.bezier(0.35, 0.05, 0.2, 1),
  });
}

/** A full drag across this share of the screen width takes the panel from closed to open. */
const DRAG_SPAN = 0.8;

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function SidePanelHost({
  panels,
  children,
  plain,
}: {
  /** The home side draws on the host's own ground (desktop); phones put their bark backdrop there. */
  plain?: boolean;
  /** Right-hand panels by key. */
  panels: Record<string, React.ReactNode>;
  /** The home screen. */
  children: React.ReactNode;
}) {
  // Sized to the host, which is the whole screen on phones and one column on desktop.
  const screen = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured || screen.width;
  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const keys = Object.keys(panels);
  const [active, setActive] = useState(keys[0]);
  const activeKey = useSharedValue(keys[0]);

  const openRef = useRef(false);

  const settled = useCallback((open: boolean, key: string) => {
    if (openRef.current !== open) tap();
    openRef.current = open;
    setIsOpen(open);
    setActive(key);
    if (!open) Keyboard.dismiss();
  }, []);

  const open = useCallback(
    (key: string) => {
      activeKey.set(key);
      progress.set(settle(progress.get(), 1));
      settled(true, key);
    },
    [progress, settled, activeKey],
  );

  const close = useCallback(() => {
    progress.set(settle(progress.get(), 0));
    settled(false, activeKey.get());
  }, [progress, settled, activeKey]);

  // Android back button closes the panel instead of leaving the app.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  // On desktop, Escape closes the panel. (Open forms and dialogs catch Escape first.)
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Home dissolves away a little ahead of the panel arriving.
  const homeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6], [1, 0], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, -width * 0.16]) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.93]) },
    ],
  }));

  const value = useMemo(
    () => ({ progress, width, isOpen, active, activeKey, open, close, settled }),
    [progress, width, isOpen, active, activeKey, open, close, settled],
  );

  return (
    <SidePanelContext.Provider value={value}>
      <View style={[styles.root, plain && styles.plain]} onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.layer, !plain && styles.home, homeStyle]}
          pointerEvents={isOpen ? 'none' : 'auto'}
        >
          {children}
        </Animated.View>
        {keys.map((key) => (
          <PanelLayer key={key} id={key} progress={progress} activeKey={activeKey} width={width} live={isOpen && active === key}>
            {panels[key]}
          </PanelLayer>
        ))}
      </View>
    </SidePanelContext.Provider>
  );
}

function PanelLayer({
  id,
  progress,
  activeKey,
  width,
  live,
  children,
}: {
  id: string;
  progress: SharedValue<number>;
  activeKey: SharedValue<string>;
  width: number;
  live: boolean;
  children: React.ReactNode;
}) {
  // The panel dissolves in, arriving from a short distance to the right.
  const style = useAnimatedStyle(() => {
    const mine = activeKey.get() === id;
    return {
      // Starts once home is half gone, so the two screens barely overlap.
      opacity: mine ? interpolate(progress.value, [0.3, 0.9], [0, 1], 'clamp') : 0,
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [width * 0.28, 0]) },
        { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
      ],
    };
  });
  // Idle motion inside the panel only runs while it is fully open and still.
  const panelLive = useDerivedValue(() => activeKey.get() === id && progress.get() === 1);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents={live ? 'auto' : 'none'}>
      <MotionClock active={panelLive}>{children}</MotionClock>
    </Animated.View>
  );
}

/**
 * Wrap any area that should drag a panel.
 *  - mode "open":  swipe left  (finger moves right → left) pulls the panel in.
 *  - mode "close": swipe right (finger moves left → right) pushes it back out.
 * Vertical movement makes the gesture give up, so lists and the block pager still scroll.
 */
export function PanelSwipe({
  mode,
  panel,
  style,
  children,
}: {
  mode: 'open' | 'close';
  /** Which panel an "open" swipe brings in. */
  panel?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const { progress, width, settled, activeKey, docked } = useSidePanel();
  const startProgress = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = usePanGesture({
    enabled: !docked,
    activeOffsetX: mode === 'open' ? -10 : 10,
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      if (mode === 'open' && panel && progress.get() === 0) activeKey.set(panel);
      startProgress.set(progress.get());
      startX.set(e.absoluteX);
    },
    onUpdate: (e) => {
      'worklet';
      // Screen coordinates: the swiped layer slides with the finger, so `translationX`
      // (measured against that layer) would under-read and drift.
      const moved = (e.absoluteX - startX.get()) / (width * DRAG_SPAN);
      progress.set(Math.min(1, Math.max(0, startProgress.get() - moved)));
    },
    onDeactivate: (e) => {
      'worklet';
      const p = progress.get();
      const from = startProgress.get() > 0.5 ? 1 : 0;
      // Velocity in "panels per second"; positive = opening.
      const v = -e.velocityX / width;
      let to = from;
      if (!e.canceled) {
        if (v > 0.9) to = 1;
        else if (v < -0.9) to = 0;
        // A quarter of the way is enough to commit in the direction you started.
        else to = from === 0 ? (p > 0.25 ? 1 : 0) : p < 0.75 ? 0 : 1;
      }
      progress.set(settle(p, to));
      scheduleOnRN(settled, to === 1, activeKey.get());
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}

/**
 * Style for a piece of panel content so the pieces arrive one after another as the
 * panel opens. `order` 0 arrives first.
 */
export function usePanelReveal(order: number) {
  const { progress } = useSidePanel();
  const start = 0.3 + order * 0.08;
  const end = Math.min(1, start + 0.4);
  return useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [start, end], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [start, end], [34, 0], 'clamp') },
      { translateY: interpolate(progress.value, [start, end], [10, 0], 'clamp') },
    ],
  }));
}

/**
 * Style for a piece of home content so it drifts left as the panel opens. Higher
 * `order` drifts further, which fans the pieces out.
 */
export function usePanelExit(order: number) {
  const { progress } = useSidePanel();
  const distance = 36 + order * 34;
  return useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, -distance]) }],
  }));
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground, overflow: 'hidden' },
  layer: { flex: 1 },
  home: { backgroundColor: colors.backdrop },
  plain: { backgroundColor: 'transparent', overflow: 'visible' },
  }),
);
