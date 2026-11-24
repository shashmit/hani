import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { useMotionClock } from '@/lib/motion';

/**
 * Hazel — the hani squirrel.
 *
 * Built from stacked SVG layers (all sharing a 100x100 viewBox) so each part can be
 * animated independently with Reanimated transforms:
 *   tail (sways)  →  body  →  head (tilts, eyes blink)  →  front (scarf, acorn, paws)
 * The whole rig hops when `hopSignal` changes or when tapped.
 */

const FUR = '#C8642B';
const FUR_LIGHT = '#E08A4A';
const FUR_DARK = '#A84F1F';
const CREAM = '#F6DDBE';
const PINK = '#F2A7A0';
const BROWN = '#3A1E12';
const SCARF = '#C7475B';
const ACORN = '#9C5A2E';
const ACORN_CAP = '#6E4220';

/** Tail sways once each way per period. */
const TAIL_PERIOD = 3600;
/** Head: still for 1.8s, tilts over 0.5s, holds 1.4s, returns over 0.5s. */
const HEAD_PERIOD = 4200;

function easeInOutQuad(x: number) {
  'worklet';
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function headTilt(time: number) {
  'worklet';
  const c = time % HEAD_PERIOD;
  if (c < 1800) return 0;
  if (c < 2300) return easeInOutQuad((c - 1800) / 500);
  if (c < 3700) return 1;
  return 1 - easeInOutQuad((c - 3700) / 500);
}

type Props = {
  size?: number;
  /** Change this value (e.g. a counter or page index) to make the squirrel hop. */
  hopSignal?: number | string;
  /** Show the acorn it's holding. */
  acorn?: boolean;
  /** Disable idle motion (tail sway, head tilt, blinking). */
  still?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Squirrel({ size = 96, hopSignal, acorn = true, still, onPress, style }: Props) {
  const reduceMotion = useReducedMotion();
  const idle = !still && !reduceMotion;

  const clock = useMotionClock();
  const blink = useSharedValue(1);
  const hopY = useSharedValue(0);
  const squash = useSharedValue(1);

  // Blinking at slightly random intervals so it feels alive.
  useEffect(() => {
    if (!idle) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        blink.value = withSequence(
          withTiming(0.1, { duration: 70 }),
          withTiming(1, { duration: 110 }),
        );
        schedule();
      }, 2200 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [idle, blink]);

  const hop = () => {
    if (reduceMotion) return;
    squash.value = withSequence(
      withTiming(0.86, { duration: 90 }),
      withSpring(1, { damping: 6, stiffness: 260 }),
    );
    hopY.value = withSequence(
      withDelay(60, withTiming(-size * 0.28, { duration: 180, easing: Easing.out(Easing.quad) })),
      withSpring(0, { damping: 9, stiffness: 220 }),
    );
  };

  useEffect(() => {
    if (hopSignal !== undefined) hop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopSignal]);

  const rigStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: hopY.value },
      { scaleY: squash.value },
      { scaleX: 2 - squash.value },
    ],
  }));
  // Idle loops run off the surrounding <MotionClock>, so they pause with their surface.
  const tailStyle = useAnimatedStyle(() => {
    const sway = idle ? Math.sin((2 * Math.PI * clock.get()) / TAIL_PERIOD) : 0;
    return { transform: [{ rotate: `${sway * 6}deg` }] };
  });
  const headStyle = useAnimatedStyle(() => {
    const tilt = idle ? headTilt(clock.get()) : 0;
    return { transform: [{ rotate: `${tilt * -8}deg` }] };
  });
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));

  const box = { width: size, height: size };

  const rig = (
    <Animated.View style={[box, styles.rig, rigStyle]}>
      {/* Tail */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.tailPivot, tailStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M48 90 C 22 94 4 78 6 54 C 7 32 20 10 42 9 C 58 9 66 22 60 33 C 56 40 50 40 47 46 C 43 56 44 70 54 80 Z"
            fill={FUR}
          />
          <Path
            d="M42 82 C 25 82 14 70 15 54 C 16 36 27 19 42 17 C 51 16 57 22 55 28 C 47 24 38 30 35 42 C 31 58 34 72 46 80 Z"
            fill={FUR_LIGHT}
          />
        </Svg>
      </Animated.View>

      {/* Body */}
      <Svg style={StyleSheet.absoluteFill} width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx={51} cy={91} rx={8} ry={4} fill={FUR_DARK} />
        <Ellipse cx={71} cy={91} rx={8} ry={4} fill={FUR_DARK} />
        <Ellipse cx={61} cy={72} rx={18} ry={20} fill={FUR} />
        <Ellipse cx={62} cy={75} rx={11} ry={14} fill={CREAM} />
      </Svg>

      {/* Head */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.headPivot, headStyle]}>
        <Svg style={StyleSheet.absoluteFill} width={size} height={size} viewBox="0 0 100 100">
          <Path d="M47 33 L 46 17 L 56 27 Z" fill={FUR} />
          <Path d="M49 29 L 48.5 21 L 54 26 Z" fill={PINK} />
          <Path d="M68 26 L 76 13 L 78 29 Z" fill={FUR} />
          <Path d="M71 26 L 75.5 18 L 76.5 27 Z" fill={PINK} />
          <Circle cx={62} cy={42} r={17} fill={FUR} />
          <Ellipse cx={64} cy={50} rx={10} ry={7.5} fill={CREAM} />
          <Circle cx={52} cy={48} r={3} fill={PINK} opacity={0.8} />
          <Circle cx={75} cy={48} r={3} fill={PINK} opacity={0.8} />
          <Ellipse cx={63} cy={47} rx={2.2} ry={1.6} fill={BROWN} />
          <Path
            d="M60 51 Q 63 53.5 66 51"
            stroke={BROWN}
            strokeWidth={1.1}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <Eye x={56} y={40} style={eyeStyle} />
        <Eye x={70} y={40} style={eyeStyle} />
      </Animated.View>

      {/* Front: scarf, acorn, paws */}
      <Svg style={StyleSheet.absoluteFill} width={size} height={size} viewBox="0 0 100 100">
        <Path d="M47 56 Q 62 63 77 56 L 77 61 Q 62 68 47 61 Z" fill={SCARF} />
        <Path d="M70 60 L 74 72 L 68 71 Z" fill={SCARF} />
        {acorn && (
          <>
            <Ellipse cx={62} cy={74} rx={6} ry={7} fill={ACORN} />
            <Path d="M55 70 Q 62 63 69 70 Q 62 72 55 70 Z" fill={ACORN_CAP} />
            <Rect x={61.3} y={64} width={1.4} height={3} rx={0.7} fill={BROWN} />
          </>
        )}
        <Ellipse cx={55} cy={73} rx={3.5} ry={3} fill={FUR_DARK} />
        <Ellipse cx={69} cy={73} rx={3.5} ry={3} fill={FUR_DARK} />
      </Svg>
    </Animated.View>
  );

  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel="Hazel the squirrel"
      onPress={() => {
        hop();
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[box, style]}
    >
      {rig}
    </Pressable>
  );
}

/** Eyes are plain Views (not SVG) so blinking is a cheap native scaleY transform. */
function Eye({ x, y, style }: { x: number; y: number; style: object }) {
  // Ellipse rx 2.6 / ry 3.2 in viewBox units → percentages of the box.
  return (
    <Animated.View
      style={[
        styles.eye,
        { left: `${x - 2.6}%`, top: `${y - 3.2}%`, width: '5.2%', height: '6.4%' },
        style,
      ]}
    >
      <View style={styles.eyeShine} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rig: { transformOrigin: '50% 100%' },
  tailPivot: { transformOrigin: '50% 85%' },
  headPivot: { transformOrigin: '62% 58%' },
  eye: {
    position: 'absolute',
    backgroundColor: '#16121F',
    borderRadius: 999,
  },
  eyeShine: {
    position: 'absolute',
    right: '12%',
    top: '14%',
    width: '36%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
});
