import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fonts, themed } from '@/theme';
import { ACORN_ORIGIN, AcornLayer, FaceLayer, TeethLayer } from './HazelFace';

/** Matches the native splash: a 200dp image whose artwork spans 70% of it. */
const FACE = 140;

const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * Plays once at launch, picking up exactly where the native splash leaves off (Hazel
 * with her acorn, centred). She tosses the acorn up, "hani" rises in, the acorn spins
 * back down and she catches it (squash, little haptic tap), then the whole thing fades
 * into the app. Tap to skip. With reduced motion it just fades.
 */
export function Intro({ onReady, onDone }: { onReady?: () => void; onDone: () => void }) {
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const done = useRef(false);

  const fade = useSharedValue(1);
  const lift = useSharedValue(0);
  const word = useSharedValue(0);
  const acornY = useSharedValue(0);
  const spin = useSharedValue(0);
  const squash = useSharedValue(1);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const leave = (delay: number) => {
    fade.set(
      withDelay(
        delay,
        withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }, (fin) => {
          'worklet';
          if (fin) scheduleOnRN(finish);
        }),
      ),
    );
  };

  useEffect(() => {
    if (reduce) {
      word.set(1);
      leave(500);
      return;
    }
    const toss = -Math.min(300, height * 0.34);
    // Face settles a little higher to make room for the wordmark.
    lift.set(withDelay(120, withSpring(-34, { damping: 16, stiffness: 140 })));
    word.set(withDelay(260, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })));
    // Up with a flick, hang, then fall with gravity and land in her mouth.
    acornY.set(
      withDelay(
        220,
        withSequence(
          withTiming(toss, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 430, easing: Easing.in(Easing.quad) }, (fin) => {
            'worklet';
            if (!fin) return;
            scheduleOnRN(tick);
            squash.set(
              withSequence(withTiming(0.9, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 300 })),
            );
          }),
        ),
      ),
    );
    spin.set(withDelay(220, withTiming(2, { duration: 790, easing: Easing.inOut(Easing.quad) })));
    leave(1350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ scale: 1 + (1 - fade.get()) * 0.04 }],
  }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { scaleY: squash.get() }, { scaleX: 2 - squash.get() }],
  }));
  const acornStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: acornY.get() }, { rotate: `${spin.get() * 360}deg` }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.get(),
    transform: [{ translateY: (1 - word.get()) * 14 + lift.get() }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]} onLayout={onReady}>
      <Pressable style={styles.fill} onPress={() => leave(0)} accessibilityLabel="Skip intro">
        <Animated.View style={[styles.face, headStyle]}>
          <FaceLayer size={FACE} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.acornPivot, acornStyle]}>
            <AcornLayer size={FACE} />
          </Animated.View>
          <View style={StyleSheet.absoluteFill}>
            <TeethLayer size={FACE} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.wordWrap, wordStyle]}>
          <Text style={styles.word}>hani</Text>
          <Text style={styles.tag}>Hazel is minding your stash</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      zIndex: 100,
    },
    fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    face: { width: FACE, height: FACE, transformOrigin: '50% 90%' },
    acornPivot: { transformOrigin: `${ACORN_ORIGIN.x * 100}% ${ACORN_ORIGIN.y * 100}%` },
    wordWrap: { position: 'absolute', top: '50%', marginTop: FACE / 2 + 4, alignItems: 'center' },
    word: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.ink },
    tag: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: 2 },
  }),
);

