import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import type { BlockDef } from '@/blocks';
import { Squirrel } from '@/components/mascot/Squirrel';
import { Guide } from '@/components/Guide';
import { useSidePanelOptional } from '@/components/SidePanel';
import { BlockActive, BlockSpace } from '@/lib/blockSpace';
import { MotionClock } from '@/lib/motion';
import { colors, fonts, isDark, themed } from '@/theme';

/**
 * Vertical stack of full-screen "sheets" on a black backdrop, joined by a dock.
 *
 * At rest the current block fills the screen and the dock is a small floating black
 * pill naming the neighbouring block. Pull the pill and the sheets pull apart: the
 * current one gets rounded corners and lifts, the pill stretches into a full-width
 * black bar with a grab handle sitting in the gap, and the next sheet follows
 * underneath. When the pull completes, the bar shrinks back into a pill.
 *
 * Pulling the dock is the only way between blocks. Swiping the content never changes
 * block, and neither does pressing or holding the dock: nothing moves until the
 * finger actually pulls, and a release only commits after a real pull or flick.
 *
 * Every boundary between two blocks has its own dock, so a middle block shows two: one
 * at the top (back to the block above) and one at the bottom (on to the block below).
 * Holding a dock still opens a menu of every block, to jump straight to any of them.
 *
 * Everything is driven by one shared value, `pos` (in pages), and drawn with
 * transforms only, so sheets, gap, bar and finger all move in the same frame:
 *  - while the finger is down, the bar sits exactly under it (1:1);
 *  - on release, a spring seeded with the finger's velocity finishes the move.
 */

const BACKDROP = '#2A1D14';
/** Bark behind the sheets and on the dock; a touch lighter at night so the dock still lifts off the dark grounds. */
const backdrop = () => (isDark() ? '#30241B' : BACKDROP);
/** Height of the dock, and of the gap that opens between sheets. */
const DOCK_H = 56;
const PILL_W = 204;
/** Pill on the top edge of a middle block: just the label, no Hazel or + button. */
const PILL_COMPACT = 150;
const SHEET_RADIUS = 38;
/** Travel (pt) over which the seam opens / closes at each end of a pull. */
const RAMP = 150;

/** A pull must travel this far before a flick counts, so a wobbly hold never commits. */
const MIN_FLICK_TRAVEL = 28;
const FLICK_VELOCITY = 650;
/** Share of the page to pull before release commits without a flick. */
const COMMIT_SHARE = 0.28;

/** Full-page settle: critically damped (no overshoot past the screen edge). */
const SNAP = { duration: 480, dampingRatio: 1 } as const;

function smoothstep(x: number) {
  'worklet';
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 0 at rest, 1 while the sheets are apart. `p` is the seam's travel (0..height). */
function seamOpen(p: number, height: number) {
  'worklet';
  return smoothstep(Math.min(p, height - p) / RAMP);
}

type Geometry = {
  height: number;
  width: number;
  /** Centre Y of the pill when resting at the bottom / top of the screen. */
  restBottom: number;
  restTop: number;
  last: number;
};


/**
 * Centre Y of the bar for seam travel `p`. At rest it floats at its rest spot; once the
 * seam is open it sits exactly in the gap. Strictly decreasing in `p` (RAMP is long
 * enough for that), so it can be inverted to put the bar under the finger.
 */
function barY(p: number, g: Geometry) {
  'worklet';
  const boundary = g.height - p;
  const rest = p < g.height / 2 ? g.restBottom - g.height : g.restTop;
  return boundary + rest * (1 - seamOpen(p, g.height));
}

/** Seam travel that puts the bar's centre at `y`. */
function travelForBarY(y: number, g: Geometry) {
  'worklet';
  if (y >= barY(0, g)) return 0;
  if (y <= barY(g.height, g)) return g.height;
  let lo = 0;
  let hi = g.height;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (barY(mid, g) > y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

type Props = {
  blocks: BlockDef[];
  /** Rendered at the top of the first sheet (logo etc.). */
  header?: React.ReactNode;
  /** The user dragged the blocks into a new order (keys, top to bottom). */
  onReorder?: (keys: string[]) => void;
};

/** Room under a sheet's content: clears the dock resting on its bottom edge, if any. */
const SPACE_ABOVE_DOCK = { bottom: 96 };
const SPACE_AT_END = { bottom: 30 };

export function BlockPager({ blocks, header, onReorder }: Props) {
  const insets = useSafeAreaInsets();
  const pos = useSharedValue(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const { h: height, w: width } = size;
  const last = blocks.length - 1;
  const panel = useSidePanelOptional();

  const indexRef = useRef(0);
  const updateIndex = (i: number) => {
    if (indexRef.current === i) return;
    indexRef.current = i;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIndex(i);
  };

  const goTo = (i: number) => {
    pos.set(withSpring(i, SNAP));
    updateIndex(i);
  };

  // Long-press menu: which dock opened it (its boundary), or null when closed.
  const [menuFrom, setMenuFrom] = useState<number | null>(null);
  const openMenu = (k: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMenuFrom(k);
  };

  // A new order keeps you on the block you were looking at, wherever it moved to.
  const reorder = (keys: string[]) => {
    const here = blocks[indexRef.current]?.key;
    const i = Math.max(0, keys.indexOf(here));
    indexRef.current = i;
    setIndex(i);
    pos.set(i);
    onReorder?.(keys);
  };

  // Space reserved in a sheet for the dock when it rests there.
  const dockTopSpace = insets.top + 10 + DOCK_H + 12;

  const geometry: Geometry = {
    height,
    width,
    restBottom: height - insets.bottom - 16 - DOCK_H / 2,
    restTop: insets.top + 10 + DOCK_H / 2,
    last,
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {height > 0 && (
        <>
          {blocks.map((b, i) => (
            <Sheet
              key={b.key}
              index={i}
              height={height}
              ground={b.ground}
              pos={pos}
              panelProgress={panel?.progress}
              // Every sheet after the first has a dock resting along its top edge.
              paddingTop={i > 0 ? dockTopSpace : insets.top}
              paddingBottom={insets.bottom + 10}
            >
              <BlockSpace.Provider value={i < last ? SPACE_ABOVE_DOCK : SPACE_AT_END}>
                <BlockActive.Provider value={i === index}>
                  {i === 0 && header}
                  <b.Component />
                </BlockActive.Provider>
              </BlockSpace.Provider>
            </Sheet>
          ))}

          {blocks.slice(0, -1).map((b, k) => (
            <Dock
              key={`dock-${k}`}
              k={k}
              blocks={blocks}
              index={index}
              pos={pos}
              g={geometry}
              onSnap={updateIndex}
              goTo={goTo}
              onHold={openMenu}
              onSettings={() => router.push('/settings')}
            />
          ))}

          {index === 0 && last > 0 && menuFrom === null && (
            <Guide
              width={width}
              height={height}
              dockY={geometry.restBottom}
              pillWidth={PILL_W}
              nextTitle={blocks[1].title}
            />
          )}

          {menuFrom !== null && (
            <BlockMenu
              blocks={blocks}
              current={blocks[index]?.key}
              // Opens next to the dock that was held: above a bottom dock, below a top one.
              atTop={menuFrom < index}
              insets={insets}
              onPick={(key) => {
                setMenuFrom(null);
                const i = blocks.findIndex((b) => b.key === key);
                if (i >= 0 && i !== index) goTo(i);
              }}
              onReorder={onReorder ? reorder : undefined}
              onClose={() => setMenuFrom(null)}
            />
          )}
        </>
      )}
    </View>
  );
}

function Sheet({
  index,
  height,
  ground,
  pos,
  panelProgress,
  paddingTop,
  paddingBottom,
  children,
}: {
  index: number;
  height: number;
  ground: string;
  pos: SharedValue<number>;
  /** Side panel progress (0 = home showing). Idle motion pauses while it moves. */
  panelProgress?: SharedValue<number>;
  paddingTop: number;
  paddingBottom: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const d = pos.get() - index;
    // How far apart this sheet is from the one below it / above it.
    const below = d > 0 && d < 1 ? seamOpen(d * height, height) : 0;
    const above = d < 0 && d > -1 ? seamOpen((d + 1) * height, height) : 0;
    return {
      borderBottomLeftRadius: SHEET_RADIUS * below,
      borderBottomRightRadius: SHEET_RADIUS * below,
      borderTopLeftRadius: SHEET_RADIUS * above,
      borderTopRightRadius: SHEET_RADIUS * above,
      // Stack position, plus half a dock-height gap either side of an open seam.
      transform: [{ translateY: -d * height + ((above - below) * DOCK_H) / 2 }],
    };
  });

  // Idle motion inside a sheet runs only while it is the settled, visible one.
  const active = useDerivedValue(
    () => Math.abs(pos.get() - index) < 0.001 && (panelProgress ? panelProgress.get() === 0 : true),
  );

  return (
    <Animated.View style={[{ height, paddingTop, paddingBottom, backgroundColor: ground }, styles.sheet, style]}>
      <MotionClock active={active}>{children}</MotionClock>
    </Animated.View>
  );
}

function Dock({
  k,
  blocks,
  index,
  pos,
  g,
  onSnap,
  goTo,
  onHold,
  onSettings,
}: {
  /** This dock joins block `k` (above) and block `k + 1` (below). */
  k: number;
  blocks: BlockDef[];
  index: number;
  pos: SharedValue<number>;
  g: Geometry;
  onSnap: (i: number) => void;
  goTo: (i: number) => void;
  onHold: (k: number) => void;
  onSettings: () => void;
}) {
  const { width, last } = g;
  const upperBlock = blocks[k];
  const lowerBlock = blocks[k + 1];
  // Resting at the top of a middle block, the dock is a compact label-only pill: Hazel
  // and + live on that block's bottom dock instead.
  const compactTop = k + 1 < last;
  const restingTop = index === k + 1;
  const showsTools = !(restingTop && compactTop);
  const current = blocks[index];
  const target = index <= k ? lowerBlock : upperBlock;

  /** Seam travel (0..1), openness and bar position for this dock's boundary. */
  const seam = useDerivedValue(() => {
    const p = pos.get();
    const f = Math.min(1, Math.max(0, p - k));
    // Away from its boundary, the dock rides along with the sheet edge it rests on.
    const away = p < k ? (k - p) * g.height : p > k + 1 ? -(p - k - 1) * g.height : 0;
    const rest = f >= 0.5 && compactTop ? PILL_COMPACT : PILL_W;
    return { f, m: seamOpen(f * g.height, g.height), y: barY(f * g.height, g) + away, rest };
  });

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: seam.get().y - DOCK_H / 2 }],
  }));
  // The pill is built from two round caps and a middle that only scales, so it can
  // stretch into a full-width bar with transforms alone (no layout per frame).
  const pillWidth = (m: number, rest: number) => {
    'worklet';
    return rest + (width - rest) * m;
  };
  const leftCapStyle = useAnimatedStyle(() => {
    const { m, rest } = seam.get();
    return { transform: [{ translateX: (width - pillWidth(m, rest)) / 2 }] };
  });
  const rightCapStyle = useAnimatedStyle(() => {
    const { m, rest } = seam.get();
    return { transform: [{ translateX: (width + pillWidth(m, rest)) / 2 - DOCK_H }] };
  });
  const middleStyle = useAnimatedStyle(() => {
    const { m, rest } = seam.get();
    return { transform: [{ scaleX: (pillWidth(m, rest) - DOCK_H) / width }] };
  });
  // Hazel and + sit in the pill's ends; on a compact pill they only show once it opens up.
  const toolsOpacity = (f: number, m: number) => {
    'worklet';
    return f >= 0.5 && compactTop ? m : 1;
  };
  const avatarStyle = useAnimatedStyle(() => {
    const { f, m, rest } = seam.get();
    return {
      opacity: toolsOpacity(f, m),
      transform: [{ translateX: (width - pillWidth(m, rest)) / 2 + 8 + 12 * m }],
    };
  });
  const plusStyle = useAnimatedStyle(() => {
    const { f, m, rest } = seam.get();
    return {
      opacity: toolsOpacity(f, m),
      transform: [{ translateX: (width + pillWidth(m, rest)) / 2 - 8 - 12 * m - 40 }],
    };
  });
  // The pill floats (shadow); the bar is flush with the backdrop (no shadow).
  const shadowStyle = useAnimatedStyle(() => {
    const { m, rest } = seam.get();
    return { opacity: 1 - m, transform: [{ scaleX: rest / PILL_W }] };
  });

  // Label naming the block below (shown while resting above the boundary) ...
  const lowerLabelStyle = useAnimatedStyle(() => {
    const { f, m } = seam.get();
    return { opacity: f < 0.5 ? 1 - m : 0 };
  });
  // ... the block above (shown while resting below it) ...
  const upperLabelStyle = useAnimatedStyle(() => {
    const { f, m } = seam.get();
    return { opacity: f >= 0.5 ? 1 - m : 0 };
  });
  // ... and the grab handle while the sheets are apart.
  const handleStyle = useAnimatedStyle(() => {
    const m = seam.get().m;
    return { opacity: m, transform: [{ scaleX: 0.5 + 0.5 * m }] };
  });

  // ---- Pull gesture ----------------------------------------------------------------
  /** Bar centre minus finger Y at grab, and seam side (0 = bar resting at the bottom, 1 = at the top). */
  const startBar = useSharedValue(0);
  const startSide = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** Whether this touch ever became a pull (vs a press, hold, or a tap on + / Hazel). */
  const pulled = useSharedValue(false);
  /** Finger's screen Y at touch-down. */
  const touchY = useSharedValue(0);

  const pan = usePanGesture({
    // Ignore the small wobble of a finger that is just pressing or holding.
    activeOffsetY: [-10, 10],
    onBegin: (e) => {
      'worklet';
      pulled.set(false);
      touchY.set(e.absoluteY);
      // Catch the sheets mid-flight: freeze them where they are under the finger.
      cancelAnimation(pos);
    },
    onActivate: () => {
      'worklet';
      const f = Math.min(1, Math.max(0, pos.get() - k));
      // Anchor at touch-down, so the bar is under the finger from the first frame.
      startBar.set(barY(f * g.height, g) - touchY.get());
      startSide.set(f >= 0.5 ? 1 : 0);
      pulled.set(true);
      dragging.set(true);
    },
    onUpdate: (e) => {
      'worklet';
      // Ignore any stray update that arrives after release, so it can't cancel the snap.
      if (!dragging.get()) return;
      // The bar goes exactly where the finger is; the sheets follow from that.
      // Screen coordinates on purpose: `translationY` is measured against the bar,
      // which itself moves, so it would drift (and creep while the finger is held).
      const p = travelForBarY(startBar.get() + e.absoluteY, g);
      pos.set(k + p / g.height);
    },
    onDeactivate: (e) => {
      'worklet';
      dragging.set(false);
      const f = Math.min(1, Math.max(0, pos.get() - k));
      const from = startSide.get();
      // Travel in pt towards the next block (positive) or the previous one (negative).
      const travel = (f - from) * g.height;

      let to = from;
      if (!e.canceled) {
        if (e.velocityY < -FLICK_VELOCITY && travel > MIN_FLICK_TRAVEL) to = 1;
        else if (e.velocityY > FLICK_VELOCITY && travel < -MIN_FLICK_TRAVEL) to = 0;
        else if (from === 0) to = f > COMMIT_SHARE ? 1 : 0;
        else to = f < 1 - COMMIT_SHARE ? 0 : 1;
      }
      // Leave the finger at the speed it was moving (pages per second).
      pos.set(withSpring(k + to, { ...SNAP, velocity: -e.velocityY / g.height }));
      scheduleOnRN(onSnap, k + to);
    },
    onFinalize: () => {
      'worklet';
      // A press that never became a pull: if it caught the sheets mid-flight, finish
      // the move to the nearest block instead of leaving them parked half way.
      if (pulled.get()) return;
      const p = pos.get();
      const nearest = Math.round(p);
      if (Math.abs(p - nearest) > 0.001) {
        pos.set(withSpring(nearest, SNAP));
        scheduleOnRN(onSnap, nearest);
      }
    },
  });

  // Holding the dock still (no pull) opens the block menu. Whichever of the two
  // gestures starts first wins: moving past 10pt is a pull, staying put is a hold.
  const hold = useLongPressGesture({
    minDuration: 380,
    maxDistance: 10,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onHold, k);
    },
  });
  const gesture = useCompetingGestures(pan, hold);

  // Screen readers can't pull; give them an action instead.
  const accessibilityGo = () => goTo(index <= k ? k + 1 : k);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.dock, { width }, barStyle]} pointerEvents="box-none">
        <View pointerEvents="none" style={[styles.shadowWrap, { width }]}>
          <Animated.View style={[styles.dockShadow, shadowStyle]} />
        </View>

        {/* Pill / bar body. All three pieces are touchable so the whole bar can be pulled. */}
        <Animated.View
          style={[styles.middle, { width }, middleStyle]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Pull to go to ${target.title}. Hold for all blocks.`}
          accessibilityActions={[
            { name: 'activate', label: `Go to ${target.title}` },
            { name: 'longpress', label: 'Show all blocks' },
          ]}
          onAccessibilityAction={(e) =>
            e.nativeEvent.actionName === 'longpress' ? onHold(k) : accessibilityGo()
          }
        />
        <Animated.View style={[styles.cap, leftCapStyle]} />
        <Animated.View style={[styles.cap, rightCapStyle]} />

        <View pointerEvents="none" style={[styles.labels, { width }]}>
          <Animated.View style={[styles.dockLabel, lowerLabelStyle]}>
            <Text style={styles.dockText}>{lowerBlock.title}</Text>
            <Feather name="chevron-up" size={16} color="rgba(255,244,223,0.6)" />
          </Animated.View>
          <Animated.View style={[styles.dockLabel, upperLabelStyle]}>
            <Text style={styles.dockText}>{upperBlock.title}</Text>
            <Feather name="chevron-down" size={16} color="rgba(255,244,223,0.6)" />
          </Animated.View>
          <Animated.View style={[styles.handle, handleStyle]} />
        </View>

        <Animated.View style={[styles.dockAvatar, avatarStyle]} pointerEvents={showsTools ? 'auto' : 'none'}>
          <DockAvatar hopSignal={index} onPress={onSettings} />
        </Animated.View>

        <Animated.View style={[styles.plusSlot, plusStyle]} pointerEvents={showsTools ? 'auto' : 'none'}>
          <Pressable
            style={({ pressed }) => [styles.dockPlus, pressed && styles.dockPlusPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push(current.addRoute);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={current.addLabel}
          >
            <Feather name="plus" size={20} color={colors.onHoney} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** How often Hazel turns into a gear, and for how long. */
const GEAR_EVERY = 15000;
const GEAR_HOLD = 1600;

/**
 * Hazel on the dock doubles as the settings button. So that's discoverable, she flips
 * into a gear for a moment every 15 seconds, then back.
 */
function DockAvatar({ hopSignal, onPress }: { hopSignal: number; onPress: () => void }) {
  const reduce = useReducedMotion();
  const gear = useSharedValue(0);
  useEffect(() => {
    const t = setInterval(() => {
      gear.set(
        withSequence(
          withTiming(1, { duration: reduce ? 0 : 320 }),
          withDelay(GEAR_HOLD, withTiming(0, { duration: reduce ? 0 : 320 })),
        ),
      );
    }, GEAR_EVERY);
    return () => clearInterval(t);
  }, [gear, reduce]);

  const hazel = useAnimatedStyle(() => ({
    opacity: 1 - gear.get(),
    transform: [{ scale: 1 - gear.get() * 0.4 }],
  }));
  const cog = useAnimatedStyle(() => ({
    opacity: gear.get(),
    transform: [{ rotate: `${gear.get() * 180}deg` }, { scale: 0.6 + gear.get() * 0.4 }],
  }));

  return (
    <View
      style={styles.avatarFill}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onPress}
    >
      <Animated.View style={hazel}>
        <Squirrel
          size={42}
          hopSignal={hopSignal}
          acorn={false}
          onPress={onPress}
          style={{ transform: [{ translateX: -5 }, { translateY: 7 }] }}
        />
      </Animated.View>
      <Animated.View style={[styles.avatarFill, styles.avatarGear, cog]} pointerEvents="none">
        <Feather name="settings" size={20} color={colors.cream} />
      </Animated.View>
    </View>
  );
}

/** Height of one row in the hold menu, and the step between rows. */
const ROW_H = 64;
const ROW_STEP = ROW_H + 4;
const ROW_SPRING = { damping: 22, stiffness: 300, mass: 0.7 };

const tick = () => Haptics.selectionAsync().catch(() => {});
const lift = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/**
 * Menu of every block, opened by holding a dock. Tap a row to jump there; hold a row
 * and drag it to change the order of the blocks (the other rows make way as it passes).
 */
function BlockMenu({
  blocks,
  current,
  atTop,
  insets,
  onPick,
  onReorder,
  onClose,
}: {
  blocks: BlockDef[];
  /** Key of the block on screen. */
  current: string | undefined;
  atTop: boolean;
  insets: { top: number; bottom: number };
  onPick: (key: string) => void;
  /** Omit to make the list fixed. */
  onReorder?: (keys: string[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // Slot of each row, by block key. Owned by the UI thread while a row is dragged.
  const slots = useSharedValue<Record<string, number>>({});
  useEffect(() => {
    slots.set(Object.fromEntries(blocks.map((b, i) => [b.key, i])));
  }, [blocks, slots]);

  const drop = (map: Record<string, number>) => {
    const keys = [...blocks].sort((a, b) => (map[a.key] ?? 0) - (map[b.key] ?? 0)).map((b) => b.key);
    if (keys.some((k, i) => k !== blocks[i].key)) onReorder?.(keys);
  };
  const move = (key: string, by: number) => {
    const keys = blocks.map((b) => b.key);
    const from = keys.indexOf(key);
    const to = from + by;
    if (to < 0 || to >= keys.length) return;
    keys.splice(to, 0, ...keys.splice(from, 1));
    tick();
    onReorder?.(keys);
  };

  const edge = 10 + DOCK_H + 12;
  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)} style={styles.menuBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View
        entering={FadeInDown.springify().damping(18).stiffness(220)}
        style={[
          styles.menu,
          atTop ? { top: insets.top + edge } : { bottom: insets.bottom + 16 + edge - 12 },
        ]}
        accessibilityRole="menu"
      >
        <View style={styles.menuHead}>
          <Text style={styles.menuTitle}>Jump to</Text>
          {onReorder && <Text style={styles.menuTip}>Hold and drag to reorder</Text>}
        </View>
        <View style={{ height: blocks.length * ROW_STEP - (ROW_STEP - ROW_H) }}>
          {blocks.map((b, i) => (
            <MenuRow
              key={b.key}
              b={b}
              start={i}
              count={blocks.length}
              here={b.key === current}
              slots={slots}
              sortable={!!onReorder}
              onPick={() => onPick(b.key)}
              onDrop={drop}
              onMove={(by) => move(b.key, by)}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function MenuRow({
  b,
  start,
  count,
  here,
  slots,
  sortable,
  onPick,
  onDrop,
  onMove,
}: {
  b: BlockDef;
  /** Slot when the menu opened (before the shared slots are filled in). */
  start: number;
  count: number;
  here: boolean;
  slots: SharedValue<Record<string, number>>;
  sortable: boolean;
  onPick: () => void;
  onDrop: (slots: Record<string, number>) => void;
  onMove: (by: number) => void;
}) {
  const key = b.key;
  const top = useSharedValue(start * ROW_STEP);
  const startTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pressed = useSharedValue(false);

  // Slide to the row's slot whenever it changes (another row was dragged past it).
  useAnimatedReaction(
    () => slots.get()[key],
    (slot, prev) => {
      if (slot === undefined || slot === prev || dragging.get()) return;
      top.set(withSpring(slot * ROW_STEP, ROW_SPRING));
    },
  );

  const tap = useTapGesture({
    onBegin: () => {
      'worklet';
      pressed.set(true);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(tick);
      scheduleOnRN(onPick);
    },
    onFinalize: () => {
      'worklet';
      pressed.set(false);
    },
  });

  // Hold, then drag: the row lifts, follows the finger, and swaps with any row it covers.
  const drag = usePanGesture({
    enabled: sortable,
    activateAfterLongPress: 260,
    onActivate: () => {
      'worklet';
      cancelAnimation(top);
      startTop.set(top.get());
      dragging.set(true);
      pressed.set(false);
      scheduleOnRN(lift);
    },
    onUpdate: (e) => {
      'worklet';
      if (!dragging.get()) return;
      const y = Math.min((count - 1) * ROW_STEP, Math.max(0, startTop.get() + e.translationY));
      top.set(y);
      const map = slots.get();
      const from = map[key];
      const to = Math.round(y / ROW_STEP);
      if (from === undefined || to === from) return;
      const next: Record<string, number> = {};
      for (const k in map) next[k] = map[k] === to ? from : map[k];
      next[key] = to;
      slots.set(next);
      scheduleOnRN(tick);
    },
    onDeactivate: () => {
      'worklet';
      dragging.set(false);
      const map = slots.get();
      top.set(withSpring((map[key] ?? 0) * ROW_STEP, ROW_SPRING));
      scheduleOnRN(onDrop, map);
    },
  });
  const gesture = useCompetingGestures(drag, tap);

  const style = useAnimatedStyle(() => {
    const up = dragging.get();
    return {
      top: top.get(),
      zIndex: up ? 2 : 0,
      backgroundColor: up ? '#3A2A1F' : here ? 'rgba(255,244,223,0.09)' : 'rgba(255,244,223,0)',
      boxShadow: up ? '0px 14px 28px -8px rgba(0,0,0,0.55)' : '0px 0px 0px 0px rgba(0,0,0,0)',
      transform: [{ scale: withSpring(up ? 1.035 : pressed.get() ? 0.98 : 1, ROW_SPRING) }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.menuItem, style]}
        accessible
        accessibilityRole="menuitem"
        accessibilityLabel={`${b.title}. ${here ? 'You are here' : b.blurb}`}
        accessibilityState={{ selected: here }}
        accessibilityActions={[
          { name: 'activate' },
          ...(sortable
            ? [
                { name: 'moveUp', label: 'Move up' },
                { name: 'moveDown', label: 'Move down' },
              ]
            : []),
        ]}
        onAccessibilityAction={(e) => {
          const a = e.nativeEvent.actionName;
          if (a === 'moveUp') onMove(-1);
          else if (a === 'moveDown') onMove(1);
          else onPick();
        }}
      >
        <View style={[styles.menuIcon, { backgroundColor: b.ground }]}>
          <Feather name={b.icon} size={18} color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuItemTitle}>{b.title}</Text>
          <Text style={styles.menuItemSub} numberOfLines={1}>
            {here ? 'You are here' : b.blurb}
          </Text>
        </View>
        {here && <View style={styles.menuHere} />}
        {sortable ? (
          <Feather name="menu" size={17} color="rgba(255,244,223,0.4)" />
        ) : (
          <Feather name="arrow-right" size={17} color="rgba(255,244,223,0.55)" />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: backdrop() },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },

  dock: { position: 'absolute', left: 0, top: 0, height: DOCK_H },
  shadowWrap: { position: 'absolute', top: 0, left: 0, height: DOCK_H, alignItems: 'center' },
  dockShadow: {
    width: PILL_W,
    height: DOCK_H,
    borderRadius: DOCK_H / 2,
    backgroundColor: backdrop(),
    boxShadow: '0px 12px 24px -8px rgba(42, 29, 20, 0.45)',
  },
  middle: { position: 'absolute', left: 0, top: 0, height: DOCK_H, backgroundColor: backdrop() },
  cap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOCK_H,
    height: DOCK_H,
    borderRadius: DOCK_H / 2,
    backgroundColor: backdrop(),
  },
  labels: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: DOCK_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dockText: { fontFamily: fonts.displaySoft, fontSize: 17.5, color: '#FFF4DF' },
  handle: {
    position: 'absolute',
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dockAvatar: {
    position: 'absolute',
    left: 0,
    top: (DOCK_H - 40) / 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarFill: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarGear: { position: 'absolute', top: 0, left: 0 },
  plusSlot: { position: 'absolute', left: 0, top: (DOCK_H - 40) / 2 },
  dockPlus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.honey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockPlusPressed: { transform: [{ scale: 0.92 }] },

  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42, 29, 20, 0.35)',
  },
  menu: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: backdrop(),
    borderRadius: 30,
    borderCurve: 'continuous',
    padding: 10,
    gap: 4,
    boxShadow: '0px 18px 40px -12px rgba(42, 29, 20, 0.6)',
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  menuTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: 'rgba(255,244,223,0.55)' },
  menuTip: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,244,223,0.38)' },
  menuItem: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  menuIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  menuItemTitle: { fontFamily: fonts.displaySoft, fontSize: 17, color: colors.cream },
  menuItemSub: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,244,223,0.6)', marginTop: 1 },
  menuHere: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.honey, marginRight: 5 },
  }),
);
