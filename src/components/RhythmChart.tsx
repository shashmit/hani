import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle } from 'react-native-reanimated';

import { useMotionClock, wave } from '@/lib/motion';
import type { Expense } from '@/store/expenses';
import { fonts } from '@/theme';

const MAX_DOTS = 6;
const DOT = 4;
const GAP = 3;

type Props = {
  /** Expenses to plot; only the current month's are used. */
  expenses: Expense[];
  /** Colour of dots on days with spending. */
  accent?: string;
  /** Colour of text and base dots. */
  ink?: string;
};

/**
 * "Spending rhythm": one column of dots per day of the month. Taller columns = more
 * money spent that day. Today's column glows; columns rise in one after another.
 */
export function RhythmChart({ expenses, accent = '#F2C4FF', ink = '#FFFFFF' }: Props) {
  const [width, setWidth] = useState(0);
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();

  const dots = useMemo(() => {
    const perDay = new Array<number>(days + 1).fill(0);
    for (const e of expenses) {
      const d = new Date(e.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        perDay[d.getDate()] += e.amount;
      }
    }
    const max = Math.max(...perDay, 0);
    return perDay.map((v) => (v > 0 && max > 0 ? Math.max(1, Math.round((v / max) * MAX_DOTS)) : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, days]);

  const col = width > 0 ? width / days : 0;
  const labels = [1, 15, today, days].filter((d, i, a) => a.indexOf(d) === i);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.plot, { height: (MAX_DOTS + 1) * (DOT + GAP) + 6 }]}>
        {col > 0 &&
          Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const n = dots[day];
            const future = day > today;
            return (
              <View key={day} style={[styles.col, { width: col }]}>
                {day === today && <TodayGlow color={accent} />}
                <Animated.View
                  key={`${day}-${n}`}
                  entering={FadeInDown.delay(i * 14).duration(380)}
                  style={styles.stack}
                >
                  {Array.from({ length: n }, (_, k) => (
                    <View
                      key={k}
                      style={[
                        styles.dot,
                        { backgroundColor: day === today ? ink : accent, opacity: 0.55 + (0.45 * (k + 1)) / n },
                      ]}
                    />
                  ))}
                  <View
                    style={[styles.dot, { backgroundColor: ink, opacity: future ? 0.18 : 0.45 }]}
                  />
                </Animated.View>
              </View>
            );
          })}
      </View>
      <View style={styles.labels}>
        {col > 0 &&
          labels.map((d) => (
            <Text
              key={d}
              style={[
                styles.label,
                { color: ink, left: (d - 0.5) * col - 24, opacity: d === today ? 1 : 0.65 },
                d === today && styles.labelToday,
              ]}
            >
              {d === today ? 'today' : d}
            </Text>
          ))}
      </View>
    </View>
  );
}

function TodayGlow({ color }: { color: string }) {
  const clock = useMotionClock();
  // Breathes between 0.18 and 0.45 opacity, 2.6s per breath, while its surface is live.
  const style = useAnimatedStyle(() => ({ opacity: 0.18 + 0.27 * wave(clock.get(), 2600) }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { backgroundColor: color, boxShadow: `0px 0px 12px 2px ${color}` }, style]}
    />
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  stack: { alignItems: 'center', gap: GAP },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  glow: {
    position: 'absolute',
    bottom: -3,
    width: DOT + 6,
    top: 0,
    borderRadius: 6,
    opacity: 0.4,
  },
  labels: { height: 16, marginTop: 6 },
  label: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  labelToday: { fontFamily: fonts.bold },
});
