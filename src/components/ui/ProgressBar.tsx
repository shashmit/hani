import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = {
  /** 0..1 (values above 1 are clamped and shown as "over"). */
  value: number;
  color: string;
  track: string;
  height?: number;
};

export function ProgressBar({ value, color, track, height = 6 }: Props) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSpring(Math.max(0, Math.min(1, value)), { damping: 18, stiffness: 120 });
  }, [value, v]);

  const fill = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: track, height, borderRadius: height }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height }, fill]}>
        <View style={[styles.knob, { backgroundColor: color, height: height + 8, marginTop: -4 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'visible' },
  fill: { height: '100%', alignItems: 'flex-end' },
  knob: { width: 3, borderRadius: 2 },
});
