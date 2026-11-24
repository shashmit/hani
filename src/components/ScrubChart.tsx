import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fonts } from '@/theme';

export type ScrubPoint = {
  key: string;
  /** Shown while this point is under the marker, e.g. "Sat, Nov 21". */
  label: string;
  value: number;
  count: number;
};

const H = 64;
const tick = () => Haptics.selectionAsync().catch(() => {});

/**
 * Spending as a row of bars with a marker you can drag. Put a finger anywhere on it and
 * glide: the marker follows, and the line above reads out that day (or month) and what
 * was spent. Lives on the forest card, so it draws in cream and honey.
 */
export function ScrubChart({
  points,
  start,
  money,
  axis,
}: {
  points: ScrubPoint[];
  /** Index the marker starts on (today, usually). */
  start: number;
  money: (n: number) => string;
  /** Labels under the left edge, middle and right edge. */
  axis: [string, string, string];
}) {
  const n = points.length;
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), n - 1));
  const slot = width > 0 ? width / n : 0;
  const max = Math.max(...points.map((p) => p.value), 1);

  // Marker centre in px. Follows the finger exactly, then settles on its bar.
  const x = useSharedValue(-1);
  const current = useSharedValue(index);
  const held = useSharedValue(0);

  const pick = (i: number) => {
    tick();
    setIndex(i);
  };

  const move = (px: number) => {
    'worklet';
    if (slot <= 0) return;
    const clamped = Math.min(Math.max(px, slot / 2), width - slot / 2);
    x.set(clamped);
    const i = Math.min(n - 1, Math.max(0, Math.floor(px / slot)));
    if (i !== current.get()) {
      current.set(i);
      scheduleOnRN(pick, i);
    }
  };

  const pan = usePanGesture({
    // Sideways wins quickly (before the panel's swipe-to-close); up and down still scrolls.
    activeOffsetX: [-4, 4],
    failOffsetY: [-14, 14],
    onBegin: (e) => {
      'worklet';
      held.set(withSpring(1, { damping: 16, stiffness: 300 }));
      move(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      move(e.x);
    },
    onFinalize: () => {
      'worklet';
      held.set(withSpring(0, { damping: 16, stiffness: 300 }));
      if (slot > 0) x.set(withSpring((current.get() + 0.5) * slot, { damping: 18, stiffness: 260 }));
    },
  });

  const markerW = Math.max(slot, 14);
  const marker = useAnimatedStyle(() => {
    const centre = x.get() < 0 ? (current.get() + 0.5) * slot : x.get();
    return {
      opacity: slot > 0 ? 1 : 0,
      transform: [{ translateX: centre - markerW / 2 }, { scaleY: 1 + held.get() * 0.06 }],
    };
  });

  const p = points[index] ?? points[0];
  const step = (by: number) => {
    const i = Math.min(n - 1, Math.max(0, index + by));
    if (i === index) return;
    current.set(i);
    x.set(withSpring((i + 0.5) * slot, { damping: 18, stiffness: 260 }));
    pick(i);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Spending over time"
      accessibilityValue={{ text: `${p.label}: ${p.value > 0 ? money(p.value) : 'nothing spent'}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View style={styles.readout}>
        <Text style={styles.readLabel} numberOfLines={1}>
          {p.label}
        </Text>
        <Text style={styles.readValue} numberOfLines={1}>
          {p.value > 0 ? `${money(p.value)} · ${p.count} ${p.count === 1 ? 'entry' : 'entries'}` : 'Nothing spent'}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.touch} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.marker, { width: markerW }, marker]} />
          <View style={styles.bars} pointerEvents="none">
            {points.map((pt, i) => {
              const on = i === index;
              const h = pt.value > 0 ? Math.max(6, (pt.value / max) * (H - 10)) : 3;
              return (
                <View key={pt.key} style={styles.slot}>
                  <View
                    style={[
                      styles.bar,
                      { height: h, width: Math.min(Math.max(slot * 0.5, 3), 14) },
                      pt.value > 0 ? styles.barFull : styles.barEmpty,
                      on && styles.barOn,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </GestureDetector>

      <View style={styles.axis}>
        <Text style={styles.axisText}>{axis[0]}</Text>
        <Text style={styles.axisText}>{axis[1]}</Text>
        <Text style={styles.axisText}>{axis[2]}</Text>
      </View>
    </View>
  );
}

const CREAM = '#FFF4DF';
const HONEY = '#F6B845';

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  readLabel: { fontFamily: fonts.semibold, fontSize: 13.5, color: CREAM },
  readValue: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: CREAM, opacity: 0.85 },
  // Taller than the bars so it's an easy target for a thumb.
  touch: { height: H + 16, justifyContent: 'flex-end', paddingBottom: 6 },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: 'rgba(246,184,69,0.28)',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: H },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
  barFull: { backgroundColor: CREAM, opacity: 0.75 },
  barEmpty: { backgroundColor: CREAM, opacity: 0.28 },
  barOn: { backgroundColor: HONEY, opacity: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontFamily: fonts.medium, fontSize: 11.5, color: CREAM, opacity: 0.6 },
});
