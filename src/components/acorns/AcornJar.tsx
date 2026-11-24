import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { themed } from '@/theme';
import { Acorn } from './Acorn';

/**
 * The stash: a jar that holds an acorn for every slice of budget still unspent.
 * Acorns drop in when the jar first appears and hop out as money is spent.
 */

const W = 112;
const H = 132;
const LID_H = 16;
const NECK_H = 8;
const ACORN = 21;
/** Acorns per row, bottom row first. */
const ROWS = [4, 3, 4, 3, 4];
export const JAR_CAPACITY = ROWS.reduce((a, b) => a + b, 0);

const SLOTS = ROWS.flatMap((n, row) => {
  const step = 24;
  const start = (W - (n - 1) * step - ACORN) / 2;
  return Array.from({ length: n }, (_, i) => ({ left: start + i * step, bottom: 8 + row * 18 }));
});

export function AcornJar({ ratio }: { /** Share of the budget left, 0..1. */ ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const count = clamped > 0 ? Math.max(1, Math.round(clamped * JAR_CAPACITY)) : 0;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Stash jar, ${Math.round(clamped * 100)} percent full`}
    >
      <View style={styles.lid} />
      <View style={styles.neck} />
      <View style={styles.glass}>
        {SLOTS.slice(0, count).map((slot, i) => (
          <Animated.View
            key={i}
            entering={FadeInUp.delay(120 + i * 35).springify().damping(13)}
            exiting={FadeOutUp.duration(220)}
            style={[styles.slot, slot]}
          >
            <Acorn size={ACORN} style={{ transform: [{ rotate: `${((i * 47) % 36) - 18}deg` }] }} />
          </Animated.View>
        ))}
        <View style={styles.shine} />
      </View>
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { width: W, height: H, alignItems: 'center' },
  lid: {
    width: W * 0.7,
    height: LID_H,
    backgroundColor: colors.honey,
    borderRadius: 7,
    zIndex: 1,
  },
  neck: { width: W * 0.58, height: NECK_H, backgroundColor: '#CFE0C4' },
  glass: {
    width: W,
    height: H - LID_H - NECK_H + 3,
    marginTop: -3,
    borderRadius: 30,
    borderCurve: 'continuous',
    backgroundColor: '#E6EFDB',
    overflow: 'hidden',
  },
  slot: { position: 'absolute' },
  shine: {
    position: 'absolute',
    left: 11,
    top: 14,
    width: 7,
    height: 38,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  }),
);
