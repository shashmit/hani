import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBlockActive } from '@/lib/blockSpace';

import { addDays, dateKey, keyToDate } from '@/lib/format';
import type { Task } from '@/store/tasks';
import { colors, fonts, themed } from '@/theme';

const CELL_W = 50;
const GAP = 4;
/** How many days are shown before and after today. */
const DAYS_BACK = 14;
const DAYS_AHEAD = 45;

type Props = {
  selected: string;
  onSelect: (key: string) => void;
  tasks: Task[];
};

/** Scrollable row of days. Starts with today near the left; dots mark days that have tasks. */
export function DayStrip({ selected, onSelect, tasks }: Props) {
  const today = dateKey();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positioned = useRef(false);
  // Phones lay out every block at once; only the web build hides the ones off screen.
  const active = useBlockActive();
  const onScreen = Platform.OS !== 'web' || active;

  const days = useMemo(
    () => Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) => addDays(today, i - DAYS_BACK)),
    [today],
  );

  // Per day: does it have top-level tasks, and are they all done?
  const marks = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (t.parentId) continue;
      const m = map.get(t.date) ?? { total: 0, done: 0 };
      m.total += 1;
      if (t.done) m.done += 1;
      map.set(t.date, m);
    }
    return map;
  }, [tasks]);

  // Open with yesterday as the first visible day, so today sits second from the left.
  const startX = (DAYS_BACK - 1) * (CELL_W + GAP);

  // On desktop every block stays mounted but only one is shown: place the strip the first
  // time Tasks actually comes on screen.
  useEffect(() => {
    if (!onScreen || positioned.current) return;
    const id = requestAnimationFrame(() => {
      positioned.current = true;
      scroll.current?.scrollTo({ x: startX, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [onScreen, startX]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Jump to today once the row has been laid out (works on every platform).
        onContentSizeChange={() => {
          // A hidden strip (desktop, another block showing) can't scroll yet; see below.
          if (positioned.current || !onScreen) return;
          positioned.current = true;
          scroll.current?.scrollTo({ x: startX, animated: false });
        }}
        contentContainerStyle={styles.content}
      >
        {days.map((key) => {
          const d = keyToDate(key);
          const isSelected = key === selected;
          const isToday = key === today;
          const mark = marks.get(key);
          const first = d.getDate() === 1;
          return (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelect(key);
              }}
              style={[styles.cell, isSelected && styles.cellSelected]}
              accessibilityRole="button"
              accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-selected={isSelected}
            >
              <Text style={[styles.weekday, isToday && styles.todayText, isSelected && styles.onSelected]}>
                {first ? d.toLocaleDateString('en-US', { month: 'short' }) : d.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.number, isToday && styles.todayText, isSelected && styles.onSelected]}>
                {d.getDate()}
              </Text>
              <View
                style={[
                  styles.dot,
                  mark && { backgroundColor: mark.done === mark.total ? colors.moss : colors.acorn },
                  mark && isSelected && { backgroundColor: colors.honey },
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  // No container: the days sit on the ground and only the chosen one is filled.
  wrap: { marginHorizontal: -20 },
  content: { paddingHorizontal: 20, paddingVertical: 2, gap: GAP },
  cell: {
    width: CELL_W,
    height: 66,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  cellSelected: { backgroundColor: colors.forest },
  weekday: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  number: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  todayText: { color: '#B5631A' },
  onSelected: { color: colors.cream },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2, backgroundColor: 'transparent' },
  }),
);
