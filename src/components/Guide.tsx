import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { usePrefs, usePrefsReady } from '@/store/prefs';
import { fonts, themed } from '@/theme';

type Target = 'plus' | 'bar' | 'hazel';

type Step = {
  target: Target;
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
};

const SCRIM = 'rgba(18,12,8,0.74)';
const MOVE = { damping: 20, stiffness: 220, mass: 0.8 };

/**
 * The four things worth knowing, shown once on the home screen after the welcome tour:
 * add, move between blocks, jump or reorder, settings. Each step lights up the real
 * control in the dock. Tap anywhere for the next one; Skip ends it.
 */
export function Guide({
  width,
  height,
  dockY,
  pillWidth,
  nextTitle,
}: {
  width: number;
  height: number;
  /** Centre of the resting dock, from the top of the screen. */
  dockY: number;
  pillWidth: number;
  /** Name of the block one pull away. */
  nextTitle: string;
}) {
  const ready = usePrefsReady();
  const guided = usePrefs((s) => s.guided);
  const setGuided = usePrefs((s) => s.setGuided);
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(false);

  const wanted = ready && !guided;
  // Let the home screen settle before talking over it.
  useEffect(() => {
    if (!wanted) return;
    const t = setTimeout(() => {
      setStep(0);
      setShown(true);
    }, 700);
    return () => {
      clearTimeout(t);
      setShown(false);
    };
  }, [wanted]);

  const steps: Step[] = [
    { target: 'plus', icon: 'plus', title: 'Tap + to add', body: 'It adds to whichever block you are on.' },
    {
      target: 'bar',
      icon: 'chevrons-up',
      title: 'Pull the bar up',
      body: `Takes you to ${nextTitle}. Pull down to come back.`,
    },
    {
      target: 'bar',
      icon: 'menu',
      title: 'Hold the bar',
      body: 'Jump to any block, or drag the rows to change their order.',
    },
    {
      target: 'hazel',
      icon: 'settings',
      title: 'Tap Hazel for settings',
      body: 'Budget, currency, theme and import.',
    },
  ];

  // The lit-up hole: a see-through shape with a very thick scrim-coloured border.
  const edge = Math.max(width, height);
  const end = pillWidth / 2 - 28;
  const hole = (t: Target) =>
    t === 'bar'
      ? { cx: width / 2, w: pillWidth + 12, h: 68 }
      : { cx: width / 2 + (t === 'plus' ? end : -end), w: 54, h: 54 };

  const first = hole(steps[0].target);
  const cx = useSharedValue(first.cx);
  const w = useSharedValue(first.w);
  const h = useSharedValue(first.h);
  const pulse = useSharedValue(0);

  const target = steps[step].target;
  useEffect(() => {
    const to = hole(target);
    cx.set(withSpring(to.cx, MOVE));
    w.set(withSpring(to.w, MOVE));
    h.set(withSpring(to.h, MOVE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, width, pillWidth]);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [pulse]);

  const holeStyle = useAnimatedStyle(() => ({
    left: cx.get() - w.get() / 2 - edge,
    top: dockY - h.get() / 2 - edge,
    width: w.get() + edge * 2,
    height: h.get() + edge * 2,
    borderRadius: h.get() / 2 + edge,
  }));
  const ringStyle = useAnimatedStyle(() => {
    const grow = 3 + pulse.get() * 5;
    return {
      left: cx.get() - w.get() / 2 - grow,
      top: dockY - h.get() / 2 - grow,
      width: w.get() + grow * 2,
      height: h.get() + grow * 2,
      borderRadius: h.get() / 2 + grow,
      opacity: 1 - pulse.get() * 0.55,
    };
  });

  if (!wanted || !shown) return null;

  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setGuided(true);
  };
  const next = () => {
    if (step >= steps.length - 1) return done();
    Haptics.selectionAsync().catch(() => {});
    setStep(step + 1);
  };

  const s = steps[step];
  const lastStep = step === steps.length - 1;

  return (
    <Animated.View
      style={styles.root}
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(200)}
      accessibilityViewIsModal
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={next} accessibilityLabel="Next tip">
        <Animated.View style={[styles.hole, { borderWidth: edge }, holeStyle]} />
        <Animated.View style={[styles.ring, ringStyle]} />
      </Pressable>

      <View style={[styles.card, { bottom: height - dockY + 34 + 26 }]}>
        <Animated.View key={step} entering={FadeInDown.duration(240)} style={styles.row}>
          <View style={styles.badge}>
            <Feather name={s.icon} size={20} color={styles.badgeIcon.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        </Animated.View>

        <View style={styles.foot}>
          <View style={styles.dots} accessibilityLabel={`Tip ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>
          {!lastStep && (
            <Pressable onPress={done} hitSlop={10} accessibilityRole="button" style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
          <Pressable
            onPress={next}
            accessibilityRole="button"
            style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.nextText}>{lastStep ? 'Got it' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', zIndex: 50 },
    hole: { position: 'absolute', borderColor: SCRIM },
    ring: { position: 'absolute', borderWidth: 2, borderColor: colors.honey },
    card: {
      position: 'absolute',
      left: 18,
      right: 18,
      borderRadius: 26,
      borderCurve: 'continuous',
      backgroundColor: colors.surface,
      padding: 16,
      gap: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    badge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.honey,
    },
    badgeIcon: { color: colors.onHoney },
    title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.ink },
    body: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.muted, marginTop: 2 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted, opacity: 0.3 },
    dotOn: { width: 20, backgroundColor: colors.honeyDeep, opacity: 1 },
    skip: { paddingHorizontal: 12, paddingVertical: 10 },
    skipText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.muted },
    next: {
      minHeight: 44,
      paddingHorizontal: 22,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.honey,
    },
    nextText: { fontFamily: fonts.bold, fontSize: 15, color: colors.onHoney },
  }),
);
