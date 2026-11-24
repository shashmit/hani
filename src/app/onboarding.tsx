import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Acorn } from '@/components/acorns/Acorn';
import { Bubble } from '@/components/mascot/Bubble';
import { HazelFace } from '@/components/mascot/HazelFace';
import { Squirrel } from '@/components/mascot/Squirrel';
import {
  FocusScene,
  HelloScene,
  MoneyScene,
  ReadyScene,
  StashScene,
  TasksScene,
} from '@/components/onboarding/Scenes';
import { importBackup } from '@/lib/backupActions';
import { usePrefs } from '@/store/prefs';
import { colors, fonts, isDark, themed, type Palette } from '@/theme';

type Page = {
  key: string;
  Scene: ComponentType<{ active: boolean }>;
  /** Palette key for the soft glow behind the picture. */
  tint: keyof Palette;
  /** Palette key for the page's background; the screen blends between them as you swipe. */
  ground: keyof Palette;
  kicker?: string;
  title: string;
  body: string;
  /** Where the idea comes from. */
  source?: string;
  /** What Hazel has to say about it. */
  quip?: string;
  /** Offers to bring a stash over from a backup file, for people moving in. */
  restore?: boolean;
};

/**
 * The first-run tour: what hani is, and the research behind each part, kept short and
 * honest ("studies suggest", with sources). Swipe or tap Next; Skip any time. Finishing
 * (or skipping) marks it done; it can be replayed by holding the hani logo on Money.
 *
 * Motion: the background blends between pages, words arrive one after another, Hazel
 * hops in with a remark, the progress acorns fill as you go (the goal-gradient effect,
 * demonstrated), and finishing throws a handful of acorns in the air.
 */
const PAGES: Page[] = [
  {
    key: 'hello',
    Scene: HelloScene,
    tint: 'honeySoft',
    ground: 'ground',
    title: 'Meet Hazel.',
    body: 'hani keeps your money, tasks, links and notes in one cosy stash, and all of it stays on your phone. Each part is built on a simple idea from behavioural science. Here is the short version.',
    restore: true,
  },
  {
    key: 'money',
    Scene: MoneyScene,
    tint: 'sageSoft',
    ground: 'ground',
    kicker: 'Money',
    title: 'Every place gets its own jar.',
    body: 'We already sort money into mental "accounts": groceries, coffee, fun. Economist Richard Thaler called it mental accounting, and hani leans into it: each place gets a budget, and the acorns show what is left. Studies also find people try harder as a goal visibly gets closer, the goal-gradient effect.',
    source: 'Thaler, 1999 · Kivetz, Urminsky & Zheng, 2006',
    quip: 'Jars beat spreadsheets.',
  },
  {
    key: 'tasks',
    Scene: TasksScene,
    tint: 'sageSoft',
    ground: 'groundTasks',
    kicker: 'Tasks',
    title: 'Give it a day, not just a list.',
    body: 'A plan like "I will do it on Tuesday" gets done far more often than a vague intention. Psychologists call these implementation intentions. Making a plan also quiets the nagging thought of an unfinished task, and ticking off small wins is one of the strongest everyday motivators.',
    source: 'Gollwitzer, 1999 · Masicampo & Baumeister, 2011 · Amabile & Kramer, 2011',
    quip: 'Tuesday-you says thanks.',
  },
  {
    key: 'stash',
    Scene: StashScene,
    tint: 'honeySoft',
    ground: 'groundBookmarks',
    kicker: 'Bookmarks & Notes',
    title: 'Out of your head, into the stash.',
    body: 'Working memory is small. Putting things somewhere you trust, which researchers call cognitive offloading, frees it up for actual thinking. So links go into collections, and thoughts into folders and tags, ready for when you need them.',
    source: 'Risko & Gilbert, 2016',
    quip: 'I bury it, you find it.',
  },
  {
    key: 'focus',
    Scene: FocusScene,
    tint: 'sageSoft',
    ground: 'groundNotes',
    kicker: 'One thing at a time',
    title: 'One block on screen.',
    body: 'Jumping between tasks leaves part of your attention stuck on the last one. Researcher Sophie Leroy named it attention residue. So hani shows one block at a time: pull the dock to move along, hold it to jump anywhere or reorder.',
    source: 'Leroy, 2009',
    quip: 'One nut at a time.',
  },
  {
    key: 'ready',
    Scene: ReadyScene,
    tint: 'honeySoft',
    ground: 'ground',
    title: 'Ready to stash?',
    body: 'Hazel will be around; give her a tap now and then. No account, no cloud: your stash never leaves this phone.',
    restore: true,
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const setOnboarded = usePrefs((s) => s.setOnboarded);
  const setGuided = usePrefs((s) => s.setGuided);
  const scroller = useRef<Animated.ScrollView>(null);
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const last = PAGES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  // The page "arrives" as soon as it is more than half on screen, so its words and
  // picture start moving while the swipe is still settling.
  const onPage = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPage(i);
  };
  useAnimatedReaction(
    () => Math.min(last, Math.max(0, Math.round(x.get() / width))),
    (i, prev) => {
      if (prev !== null && i !== prev) scheduleOnRN(onPage, i);
    },
  );

  const goTo = (i: number) => scroller.current?.scrollTo({ x: i * width, animated: true });

  const leave = () => {
    setOnboarded(true);
    // The short how-to follows the tour on the home screen, replays included.
    setGuided(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const finish = () => {
    if (leaving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduce) return leave();
    // A handful of acorns goes up first.
    setLeaving(true);
    setTimeout(leave, 800);
  };
  // Moving in from another device: the backup goes in, and the tour is done.
  const restore = () => importBackup(finish);

  // Background blends from one page's ground to the next.
  const grounds = PAGES.map((p) => colors[p.ground]);
  const stops = PAGES.map((_, i) => i);
  const rootStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(x.get() / width, stops, grounds),
  }));

  // The glow behind every picture breathes slowly.
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    breathe.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, breathe]);

  // "Next" nudges its arrow now and then.
  const nudge = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    nudge.set(
      withRepeat(
        withSequence(
          withDelay(1400, withTiming(5, { duration: 220, easing: Easing.out(Easing.quad) })),
          withSpring(0, { damping: 8, stiffness: 220 }),
        ),
        -1,
      ),
    );
  }, [reduce, nudge]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.get() }] }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <View style={styles.brand}>
            <HazelFace size={34} />
            <Text style={styles.brandText}>hani</Text>
          </View>
          {page < last && (
            <Pressable onPress={leave} hitSlop={10} accessibilityRole="button" style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {PAGES.map((p, i) => (
            <PageView key={p.key} p={p} i={i} x={x} width={width} active={page === i} breathe={breathe} onRestore={restore} />
          ))}
        </Animated.ScrollView>

        <View style={styles.bottom}>
          {/* Progress you can see: an acorn fills for every page you reach. */}
          <View style={styles.steps} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
            {PAGES.map((p, i) => (
              <Step key={p.key} filled={i <= page} current={i === page} onPress={() => goTo(i)} />
            ))}
          </View>
          <Animated.View layout={LinearTransition.springify().damping(16)}>
            <Pressable
              onPress={() => (page < last ? goTo(page + 1) : finish())}
              style={({ pressed }) => [styles.next, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.nextText}>{page === last ? 'Start stashing' : 'Next'}</Text>
              <Animated.View style={arrow}>
                <Feather name={page === last ? 'check' : 'arrow-right'} size={18} color={colors.onHoney} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
      {leaving && <AcornBurst width={width} />}
    </Animated.View>
  );
}

function PageView({
  p,
  i,
  x,
  width,
  active,
  breathe,
  onRestore,
}: {
  p: Page;
  i: number;
  x: SharedValue<number>;
  width: number;
  active: boolean;
  breathe: SharedValue<number>;
  onRestore: () => void;
}) {
  // The picture drifts slower than the page and the words a touch faster: a little depth.
  const pic = useAnimatedStyle(() => {
    const d = x.get() / width - i;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: d * width * 0.35 },
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.86], Extrapolation.CLAMP) },
        { rotate: `${d * -6}deg` },
      ],
    };
  });
  const glow = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.get() * 0.06 }],
    opacity: 0.8 + breathe.get() * 0.2,
  }));
  const words = useAnimatedStyle(() => {
    const d = x.get() / width - i;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: -d * 40 }],
    };
  });

  const titleWords = p.title.split(' ');
  // Everything after the title waits for its last word.
  const after = 160 + titleWords.length * 55;

  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.picture, pic]}>
        <Animated.View style={[styles.glow, { backgroundColor: colors[p.tint] }, glow]} />
        <p.Scene active={active} />
      </Animated.View>
      <Animated.View style={[styles.words, words]}>
        {p.quip ? (
          <Reveal active={active} delay={0} pop style={styles.quip}>
            <Squirrel size={52} hopSignal={active ? p.key : 'away'} />
            <Bubble text={p.quip} />
          </Reveal>
        ) : null}
        {p.kicker ? (
          <Reveal active={active} delay={90} style={styles.kicker}>
            <Feather name="zap" size={12} color={isDark() ? '#9FCFA4' : colors.forest} />
            <Text style={styles.kickerText}>{p.kicker} · the science</Text>
          </Reveal>
        ) : null}
        <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={p.title}>
          {titleWords.map((w, k) => (
            <Reveal key={k} active={active} delay={160 + k * 55}>
              <Text style={styles.title}>{w} </Text>
            </Reveal>
          ))}
        </View>
        <Reveal active={active} delay={after}>
          <Text style={styles.body}>{p.body}</Text>
        </Reveal>
        {p.source ? (
          <Reveal active={active} delay={after + 120} style={styles.source}>
            <Feather name="book-open" size={12} color={colors.muted} />
            <Text style={styles.sourceText}>{p.source}</Text>
          </Reveal>
        ) : null}
        {p.restore ? (
          <Reveal active={active} delay={after + 160}>
            <Pressable
              onPress={onRestore}
              style={({ pressed }) => [styles.restore, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityHint="Choose a hani backup file to bring your stash over"
            >
              <Feather name="download" size={14} color={colors.inkSoft} />
              <Text style={styles.restoreText}>I have a backup</Text>
            </Pressable>
          </Reveal>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Rises (or pops) into place a moment after its page becomes active. */
function Reveal({
  active,
  delay,
  pop,
  style,
  children,
}: {
  active: boolean;
  delay: number;
  pop?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) v.set(1);
    else v.set(active ? withDelay(delay, withSpring(1, { damping: pop ? 11 : 18, stiffness: 170 })) : 0);
  }, [active, delay, pop, reduce, v]);
  const s = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.get() * 1.6),
    transform: pop ? [{ scale: 0.6 + v.get() * 0.4 }] : [{ translateY: (1 - v.get()) * 16 }],
  }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

/** One acorn of the progress row: fills with a pop when its page is reached. */
function Step({ filled, current, onPress }: { filled: boolean; current: boolean; onPress: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(
      filled
        ? withSequence(withTiming(1.45, { duration: 110 }), withSpring(current ? 1.18 : 1, { damping: 8, stiffness: 260 }))
        : withSpring(1),
    );
  }, [filled, current, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Pressable onPress={onPress} hitSlop={5} accessibilityRole="button">
      <Animated.View style={style}>
        <Acorn size={17} empty={!filled} emptyColor={colors.line} />
      </Animated.View>
    </Pressable>
  );
}

const BURST = 16;

/** Acorns thrown up from the bottom of the screen, falling back with gravity. */
function AcornBurst({ width }: { width: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 900, easing: Easing.linear }));
  }, [t]);
  return (
    <View style={styles.burst} pointerEvents="none">
      {Array.from({ length: BURST }, (_, i) => (
        <Particle key={i} i={i} t={t} width={width} />
      ))}
    </View>
  );
}

function Particle({ i, t, width }: { i: number; t: SharedValue<number>; width: number }) {
  // Spread in a fan; speeds and sizes vary by index so it doesn't look combed.
  const angle = (-155 + (130 * i) / (BURST - 1) + ((i * 37) % 11) - 5) * (Math.PI / 180);
  const speed = 760 + ((i * 53) % 7) * 70;
  const size = 16 + ((i * 29) % 5) * 4;
  const dir = i % 2 ? 1 : -1;
  const style = useAnimatedStyle(() => {
    const k = t.get();
    return {
      opacity: interpolate(k, [0, 0.05, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * speed * k * 0.55 },
        { translateY: Math.sin(angle) * speed * k + 1150 * k * k },
        { rotate: `${k * 540 * dir}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.particle, { left: width / 2 - size / 2 }, style]}>
      <Acorn size={size} />
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 6,
      height: 54,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    brandText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
    skip: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.chip },
    skipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },

    page: { flex: 1 },
    picture: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 240 },
    glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
    words: { paddingHorizontal: 26, paddingBottom: 8 },
    quip: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10, marginLeft: -6, transformOrigin: '10% 90%' },
    kicker: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      height: 26,
      paddingHorizontal: 11,
      borderRadius: 13,
      backgroundColor: colors.sageSoft,
      marginBottom: 12,
    },
    kickerText: { fontFamily: fonts.semibold, fontSize: 12, color: isDark() ? '#9FCFA4' : colors.forest, letterSpacing: 0.2 },
    titleRow: { flexDirection: 'row', flexWrap: 'wrap' },
    title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink },
    body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.inkSoft, marginTop: 10 },
    source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    restore: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 7,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.chip,
      marginTop: 16,
    },
    restoreText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
    sourceText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },

    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 10,
    },
    steps: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    next: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 54,
      paddingHorizontal: 24,
      borderRadius: 27,
      backgroundColor: colors.honey,
    },
    nextText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onHoney },
    pressed: { transform: [{ scale: 0.96 }] },

    burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    particle: { position: 'absolute', bottom: 70 },
  }),
);
