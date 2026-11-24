import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Acorn, AcornRow } from '@/components/acorns/Acorn';
import { AcornJar } from '@/components/acorns/AcornJar';
import { Bubble } from '@/components/mascot/Bubble';
import { HazelFace } from '@/components/mascot/HazelFace';
import { Squirrel } from '@/components/mascot/Squirrel';
import { colors, fonts, themed } from '@/theme';

/**
 * The little moving pictures on each onboarding page. Each one starts when its page
 * becomes `active` and replays when you come back to it.
 */

/** An acorn that bobs up and down forever, a beat out of step with its neighbours. */
function Bobbing({ delay, size, style }: { delay: number; size: number; style: object }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.set(
      withDelay(
        delay,
        withRepeat(withTiming(-10, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true),
      ),
    );
  }, [delay, reduce, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { rotate: `${y.get() * 1.2}deg` }] }));
  return (
    <Animated.View style={[styles.abs, style, s]}>
      <Acorn size={size} />
    </Animated.View>
  );
}

/**
 * An acorn that falls in from above, spinning, and bounces once where it lands.
 * With `fade` it disappears after landing (it went into the jar). Remount to replay.
 */
function Drop({
  delay = 0,
  from = -180,
  size,
  fade,
  style,
}: {
  delay?: number;
  from?: number;
  size: number;
  fade?: boolean;
  style: object;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? 0 : from);
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(
      withDelay(
        delay,
        fade
          ? withSequence(withTiming(1, { duration: 80 }), withDelay(360, withTiming(0, { duration: 160 })))
          : withTiming(1, { duration: 80 }),
      ),
    );
    if (reduce) return;
    y.set(
      withDelay(
        delay,
        withSequence(
          withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
          withTiming(-14, { duration: 130, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) }),
        ),
      ),
    );
  }, [delay, fade, reduce, y, o]);
  const s = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateY: y.get() }, { rotate: `${(y.get() / from) * 300}deg` }],
  }));
  return (
    <Animated.View style={[styles.abs, style, s]}>
      <Acorn size={size} />
    </Animated.View>
  );
}

/** Hello: Hazel says hi while acorns rain down around her. */
export function HelloScene({ active }: { active: boolean }) {
  return (
    <View style={styles.scene}>
      <Bobbing delay={0} size={30} style={{ left: '12%', top: '18%' }} />
      <Bobbing delay={500} size={22} style={{ right: '14%', top: '12%' }} />
      {active && (
        <>
          <Drop delay={500} size={24} style={{ left: '20%', bottom: '18%' }} />
          <Drop delay={760} size={20} style={{ right: '20%', bottom: '22%' }} />
          <Drop delay={980} size={16} style={{ left: '34%', bottom: '11%' }} />
        </>
      )}
      <View style={styles.helloStack}>
        <View style={styles.helloBubble}>
          {active && (
            <Animated.View entering={ZoomIn.delay(450).springify().damping(11)}>
              <Bubble text="Hi! I'm Hazel." tail="down" />
            </Animated.View>
          )}
        </View>
        <Squirrel size={180} hopSignal={active ? 'hello' : 'away'} />
      </View>
    </View>
  );
}

/** Money: acorns drop into a jar that fills as you arrive; each place has its own budget. */
export function MoneyScene({ active }: { active: boolean }) {
  const [ratio, setRatio] = useState(0.15);
  const squash = useSharedValue(1);
  useEffect(() => {
    if (!active) return;
    const steps = [0.3, 0.45, 0.6, 0.72];
    const timers = steps.map((r, i) => setTimeout(() => setRatio(r), 300 + i * 520));
    return () => {
      timers.forEach(clearTimeout);
      setRatio(0.15);
    };
  }, [active]);
  // The jar jiggles as each acorn lands.
  useEffect(() => {
    if (ratio <= 0.15) return;
    squash.set(
      withDelay(400, withSequence(withTiming(0.93, { duration: 80 }), withSpring(1, { damping: 6, stiffness: 280 }))),
    );
  }, [ratio, squash]);
  const jar = useAnimatedStyle(() => ({
    transform: [{ scale: 1.35 }, { scaleY: squash.get() }, { scaleX: 2 - squash.get() }],
  }));

  return (
    <View style={styles.scene}>
      {active && ratio > 0.15 && <Drop key={ratio} size={22} from={-130} fade style={{ top: '20%' }} />}
      <Animated.View style={[styles.jarWrap, jar]}>
        <AcornJar ratio={ratio} />
      </Animated.View>
      {active && (
        <View style={styles.placeCol}>
          {[
            { name: 'Groceries', left: '₹2,400 left', dot: colors.moss },
            { name: 'Coffee', left: '₹320 left', dot: colors.acorn },
          ].map((p, i) => (
            <Animated.View key={p.name} entering={FadeInDown.delay(300 + i * 160).springify().damping(16)} style={styles.placePill}>
              <View style={[styles.dot, { backgroundColor: p.dot }]} />
              <View>
                <Text style={styles.pillTitle}>{p.name}</Text>
                <Text style={styles.pillSub}>{p.left}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Tasks: a day picked, the list ticks itself off, and Hazel pops up to cheer. */
export function TasksScene({ active }: { active: boolean }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timers = [1, 2, 3].map((n) => setTimeout(() => setDone(n), 450 + n * 480));
    return () => {
      timers.forEach(clearTimeout);
      setDone(0);
    };
  }, [active]);

  const items = ['Pay electricity bill', 'Call grandma', 'Water the plants'];
  return (
    <View style={styles.scene}>
      <View style={styles.card}>
        {done === 3 && (
          <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.cheer}>
            <Squirrel size={64} hopSignal="cheer" />
          </Animated.View>
        )}
        <View style={styles.dayRow}>
          {['Mon', 'Tue', 'Wed'].map((d, i) => (
            <View key={d} style={[styles.day, i === 1 && styles.dayOn]}>
              <Text style={[styles.dayText, i === 1 && styles.dayTextOn]}>{d}</Text>
            </View>
          ))}
        </View>
        {items.map((t, i) => {
          const ticked = i < done;
          return (
            <View key={t} style={styles.taskRow}>
              <View style={[styles.check, ticked && styles.checkOn]}>
                {ticked && (
                  <Animated.View entering={ZoomIn.springify().damping(9)}>
                    <Feather name="check" size={14} color={colors.cream} />
                  </Animated.View>
                )}
              </View>
              <Text style={[styles.taskText, ticked && styles.taskDone]}>{t}</Text>
            </View>
          );
        })}
        <View style={styles.winRow}>
          <AcornRow total={3} filled={done} size={18} />
          <Text style={styles.pillSub}>{done === 3 ? 'All done!' : `${done} of 3 done`}</Text>
        </View>
      </View>
    </View>
  );
}

/** Links and notes: a link and a thought tuck themselves into the stash, again and again. */
export function StashScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const tuck = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) {
      tuck.set(0);
      return;
    }
    tuck.set(
      withRepeat(
        withSequence(
          withDelay(1300, withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) })),
          withDelay(1100, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })),
        ),
        -1,
      ),
    );
  }, [active, reduce, tuck]);

  const top = useAnimatedStyle(() => ({
    opacity: 1 - tuck.get(),
    transform: [{ translateY: tuck.get() * 130 }, { scale: 1 - tuck.get() * 0.55 }, { rotate: '-4deg' }],
  }));
  const second = useAnimatedStyle(() => ({
    opacity: 1 - tuck.get(),
    transform: [{ translateY: tuck.get() * 66 }, { scale: 1 - tuck.get() * 0.55 }, { rotate: '3deg' }],
  }));
  const folder = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + Math.sin(Math.PI * tuck.get()) * 0.07 }],
  }));
  const saved = useAnimatedStyle(() => ({ opacity: interpolate(tuck.get(), [0.7, 1], [0, 1], 'clamp') }));

  return (
    <View style={styles.scene}>
      {active && (
        <>
          <Animated.View entering={FadeInDown.delay(150).springify().damping(15)}>
            <Animated.View style={[styles.stashCard, top]}>
              <View style={[styles.badge, { backgroundColor: '#3F7C9E' }]}>
                <Feather name="link-2" size={15} color={colors.cream} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pillTitle}>Why squirrels forget</Text>
                <Text style={styles.pillSub}>Read later · #nature</Text>
              </View>
            </Animated.View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(380).springify().damping(15)}>
            <Animated.View style={[styles.stashCard, second]}>
              <View style={[styles.badge, { backgroundColor: colors.honey }]}>
                <Feather name="edit-3" size={15} color={colors.onHoney} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pillTitle}>Gift ideas</Text>
                <Text style={styles.pillSub}>Ideas / Birthdays</Text>
              </View>
            </Animated.View>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(650)}>
            <Animated.View style={[styles.folderRow, folder]}>
              <Feather name="folder" size={18} color={colors.acornCap} />
              <Text style={styles.pillTitle}>Stash</Text>
              <View style={{ flex: 1 }} />
              <Animated.Text style={[styles.pillSub, saved]}>2 tucked away</Animated.Text>
              <Acorn size={16} />
            </Animated.View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

/** Focus: one block on screen; a finger pulls the dock and the next block follows. */
export function FocusScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) {
      y.set(0);
      return;
    }
    y.set(
      withRepeat(
        withSequence(
          withDelay(800, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) })),
          withDelay(900, withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) })),
        ),
        -1,
      ),
    );
  }, [active, reduce, y]);

  const H = 210;
  const TRAVEL = H - 48;
  const sheets = useAnimatedStyle(() => ({ transform: [{ translateY: -y.get() * H }] }));
  const dock = useAnimatedStyle(() => ({ transform: [{ translateY: -y.get() * TRAVEL }] }));
  const finger = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, 0.08, 0.92, 1], [0, 0.75, 0.75, 0]),
    transform: [{ translateY: -y.get() * TRAVEL }, { scale: interpolate(y.get(), [0, 0.08, 0.92, 1], [1.4, 1, 1, 1.4]) }],
  }));
  const down = useAnimatedStyle(() => ({ opacity: 1 - y.get() }));
  const up = useAnimatedStyle(() => ({ opacity: y.get() }));

  return (
    <View style={styles.scene}>
      <View style={[styles.phone, { height: H }]}>
        <Animated.View style={sheets}>
          <View style={[styles.mini, { height: H, backgroundColor: colors.ground }]}>
            <View style={[styles.miniHero, { backgroundColor: colors.forest }]}>
              <Text style={styles.miniHeroText}>₹1,050</Text>
            </View>
            <View style={styles.miniLine} />
            <View style={[styles.miniLine, { width: '60%' }]} />
          </View>
          <View style={[styles.mini, { height: H, backgroundColor: colors.groundTasks, paddingTop: 48 }]}>
            <Text style={styles.miniTitle}>3 tasks left</Text>
            <View style={styles.miniLine} />
            <View style={[styles.miniLine, { width: '70%' }]} />
            <View style={[styles.miniLine, { width: '50%' }]} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.miniDock, dock]}>
          <Animated.View style={[styles.miniDockRow, down]}>
            <Text style={styles.miniDockText}>Tasks</Text>
            <Feather name="chevron-up" size={12} color={colors.cream} />
          </Animated.View>
          <Animated.View style={[styles.miniDockRow, styles.abs, up]}>
            <Text style={styles.miniDockText}>Money</Text>
            <Feather name="chevron-down" size={12} color={colors.cream} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.finger, finger]} />
      </View>
    </View>
  );
}

/** Last page: Hazel, ready, with her acorns circling. */
export function ReadyScene({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) return;
    turn.set(0);
    turn.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1));
    breathe.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [active, reduce, turn, breathe]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  const face = useAnimatedStyle(() => ({
    transform: [{ translateY: -breathe.get() * 6 }, { scale: 1 + breathe.get() * 0.025 }],
  }));

  const R = 128;
  return (
    <View style={styles.scene}>
      <Animated.View style={[styles.ring, { width: R * 2, height: R * 2 }, ring]}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * 2 * Math.PI;
          const size = i % 2 ? 18 : 24;
          return (
            <View
              key={i}
              style={[
                styles.abs,
                { left: R + Math.cos(a) * R - size / 2, top: R + Math.sin(a) * R - size / 2, transform: [{ rotate: `${(a * 180) / Math.PI + 90}deg` }] },
              ]}
            >
              <Acorn size={size} />
            </View>
          );
        })}
      </Animated.View>
      {active && (
        <Animated.View entering={ZoomIn.springify().damping(11)}>
          <Animated.View style={face}>
            <HazelFace size={170} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    abs: { position: 'absolute' },

    helloStack: { alignItems: 'center' },
    helloBubble: { height: 44, justifyContent: 'flex-end', marginBottom: -6, marginLeft: 70 },

    jarWrap: { marginBottom: 30 },
    placeCol: { flexDirection: 'row', gap: 10, marginTop: 18 },
    placePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    pillTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    pillSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },

    card: {
      width: 270,
      padding: 16,
      gap: 10,
      borderRadius: 28,
      borderCurve: 'continuous',
      backgroundColor: colors.surface,
    },
    cheer: { position: 'absolute', right: 8, top: -50 },
    dayRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
    day: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.chip },
    dayOn: { backgroundColor: colors.forest },
    dayText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft },
    dayTextOn: { color: colors.cream },
    taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.forest },
    taskText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
    taskDone: { color: colors.muted, textDecorationLine: 'line-through' },
    winRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },

    stashCard: {
      width: 250,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      marginBottom: 10,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
    badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    folderRow: {
      width: 250,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: colors.honeySoft,
      marginTop: 6,
    },

    phone: {
      width: 170,
      borderRadius: 30,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: '#2A1D14',
    },
    mini: { padding: 14, gap: 8 },
    miniHero: { height: 70, borderRadius: 18, padding: 10, justifyContent: 'flex-end' },
    miniHeroText: { fontFamily: fonts.display, fontSize: 18, color: colors.cream },
    miniTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginTop: 4 },
    miniLine: { height: 12, borderRadius: 6, backgroundColor: colors.surface, width: '85%' },
    miniDock: {
      position: 'absolute',
      bottom: 10,
      alignSelf: 'center',
      width: 86,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#2A1D14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniDockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    miniDockText: { fontFamily: fonts.displaySoft, fontSize: 12.5, color: colors.cream },
    finger: {
      position: 'absolute',
      bottom: 6,
      alignSelf: 'center',
      marginLeft: 30,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.honey,
    },

    ring: { position: 'absolute' },
  }),
);
