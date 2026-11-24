import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AcornRow } from '@/components/acorns/Acorn';
import { Bubble } from '@/components/mascot/Bubble';
import { Squirrel } from '@/components/mascot/Squirrel';
import { DayStrip } from '@/components/tasks/DayStrip';
import { TaskNode } from '@/components/tasks/TaskNode';
import { addDays, dateKey, dayTitle } from '@/lib/format';
import { useTasks, type Task } from '@/store/tasks';
import { ask } from '@/lib/ask';
import { useBlockBottom } from '@/lib/blockSpace';
import { useIsDesktop } from '@/lib/useDesktop';
import { colors, fonts, isDark, themed } from '@/theme';

/**
 * Tasks as a day planner: pick a day on the strip, see that day's progress on the
 * dial, and work down a vertical list where any task can hold its own sub-tasks.
 */
export function TasksBlock() {
  const { tasks, selectedDate, setSelectedDate, toggleTask, removeTask, moveTask, bringOverdueTo } =
    useTasks();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const today = dateKey();
  const desktop = useIsDesktop();
  const bottom = useBlockBottom();

  // Children of every task, oldest first, so new sub-tasks appear at the bottom.
  const childrenById = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of [...tasks].sort((a, b) => a.createdAt - b.createdAt)) {
      if (!t.parentId) continue;
      const list = map.get(t.parentId) ?? [];
      list.push(t);
      map.set(t.parentId, list);
    }
    return map;
  }, [tasks]);

  // Top-level tasks of the selected day: unfinished first, then by when they were added.
  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentId && t.date === selectedDate)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt),
    [tasks, selectedDate],
  );

  const total = dayTasks.length;
  const done = dayTasks.filter((t) => t.done).length;
  const left = total - done;

  const overdue = useMemo(
    () => tasks.filter((t) => !t.parentId && !t.done && t.date < today).length,
    [tasks, today],
  );

  const toggle = (t: Task) => {
    Haptics.notificationAsync(
      t.done ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    toggleTask(t.id);
  };

  const collapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSub = (t: Task) => {
    // Make sure the new sub-task is visible when we come back.
    setCollapsed((prev) => {
      if (!prev.has(t.id)) return prev;
      const next = new Set(prev);
      next.delete(t.id);
      return next;
    });
    router.push({ pathname: '/add-task', params: { parentId: t.id } });
  };

  const menu = (t: Task, depth: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const subs = (childrenById.get(t.id) ?? []).length;
    const remove = {
      text: subs ? 'Delete with sub-tasks' : 'Delete',
      style: 'destructive' as const,
      onPress: () => removeTask(t.id),
    };
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    if (depth > 0) return ask(t.title, undefined, [remove, cancel]);
    // Top-level tasks can also hop to another day (their sub-tasks go with them).
    const target = t.date === today ? addDays(today, 1) : today;
    ask(t.title, undefined, [
      { text: `Move to ${dayTitle(target).toLowerCase()}`, onPress: () => moveTask(t.id, target) },
      remove,
      cancel,
    ]);
  };

  return (
    <View style={styles.root}>
      <DayStrip selected={selectedDate} onSelect={setSelectedDate} tasks={tasks} />

      <View style={styles.hero}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.day}>{dayTitle(selectedDate)}</Text>
          <View style={styles.bigRow}>
            <Text style={styles.big}>{total === 0 ? '0' : left === 0 ? done : left}</Text>
            <Text style={styles.bigUnit}>
              {total === 0 ? 'tasks' : left === 0 ? 'all done' : left === 1 ? 'task left' : 'tasks left'}
            </Text>
          </View>
          {total > 0 && (
            <View style={styles.snacks}>
              <AcornRow total={Math.min(total, SNACKS)} filled={Math.min(done, SNACKS)} size={17} />
              <Text style={styles.sub}>
                {done} of {total} done
              </Text>
            </View>
          )}
        </View>
        <View style={styles.hazel}>
          <Bubble text={taskMood(total, left)} tail="down" />
          <Squirrel size={78} hopSignal={done} acorn={done > 0} />
        </View>
      </View>

      {selectedDate === today && overdue > 0 && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Pressable
            style={styles.overdue}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              bringOverdueTo(today);
            }}
          >
            <Feather name="corner-down-right" size={15} color={colors.ink} />
            <Text style={styles.overdueText}>
              {overdue} unfinished from earlier {overdue === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.overdueAction}>Bring here</Text>
          </Pressable>
        </Animated.View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottom }]}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        {total === 0 && (
          <View style={styles.empty}>
            <Squirrel size={84} />
            <Text style={styles.emptyTitle}>A clear day</Text>
            <Text style={styles.emptyText}>
              Nothing planned for {dayTitle(selectedDate).toLowerCase()} yet.
            </Text>
          </View>
        )}

        {dayTasks.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition}
            style={[styles.card, t.done && styles.cardDone]}
          >
            <TaskNode
              task={t}
              depth={0}
              childrenById={childrenById}
              collapsed={collapsed}
              onToggle={toggle}
              onCollapse={collapse}
              onAddSub={addSub}
              onMenu={menu}
            />
          </Animated.View>
        ))}

        <Animated.View layout={LinearTransition}>
          <Pressable style={styles.add} onPress={() => router.push('/add-task')}>
            <Feather name="plus" size={16} color={colors.ink} />
            <Text style={styles.addText}>Add a task for {dayTitle(selectedDate).toLowerCase()}</Text>
          </Pressable>
          {total > 0 && (
            <Text style={styles.hint}>
              {desktop
                ? 'Click the circle to tick. + adds a sub-task. Right-click for more.'
                : 'Tap the circle to tick. + adds a sub-task. Hold for more.'}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** Most acorns shown in the day's snack row. */
const SNACKS = 8;

/** What Hazel says about the day. */
function taskMood(total: number, left: number) {
  if (total === 0) return 'Free day?';
  if (left === 0) return 'All stashed!';
  if (left === total) return 'Feed me tasks.';
  return left === 1 ? 'One to go!' : 'Keep going!';
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, gap: 12 },

  // Hero: no panel, just the day's number and Hazel on the ground
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4, paddingTop: 4 },
  day: { fontFamily: fonts.displaySoft, fontSize: 16, color: colors.forest },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  big: { fontFamily: fonts.display, fontSize: 60, color: colors.ink, lineHeight: 66 },
  bigUnit: { fontFamily: fonts.displaySoft, fontSize: 20, color: colors.ink },
  snacks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  hazel: { alignItems: 'flex-end', gap: 4 },

  overdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.honeySoft,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 46,
  },
  overdueText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  overdueAction: { fontFamily: fonts.displaySoft, fontSize: 14, color: colors.ink },

  list: { flex: 1, marginHorizontal: -20 },
  listContent: { paddingHorizontal: 20, paddingBottom: 96, gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  cardDone: { backgroundColor: isDark() ? 'rgba(37,29,23,0.55)' : 'rgba(255,252,245,0.5)' },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 26,
    backgroundColor: isDark() ? 'rgba(243,233,216,0.08)' : 'rgba(42,29,20,0.07)',
  },
  addText: { fontFamily: fonts.displaySoft, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 },

  empty: { alignItems: 'center', paddingVertical: 26, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  }),
);
