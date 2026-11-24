import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { contextMenuProps } from '@/lib/useDesktop';
import { MAX_DEPTH, PRIORITIES, type Task } from '@/store/tasks';
import { colors, fonts, isDark, themed } from '@/theme';

type Props = {
  task: Task;
  depth: number;
  /** Children of each task id, in display order. */
  childrenById: Map<string, Task[]>;
  collapsed: Set<string>;
  onToggle: (task: Task) => void;
  onCollapse: (id: string) => void;
  onAddSub: (task: Task) => void;
  onMenu: (task: Task, depth: number) => void;
};

/** One task row plus, underneath and indented along a guide line, its sub-tasks. */
export function TaskNode(props: Props) {
  const { task, depth, childrenById, collapsed, onToggle, onCollapse, onAddSub, onMenu } = props;
  const kids = childrenById.get(task.id) ?? [];
  const hasKids = kids.length > 0;
  const isCollapsed = collapsed.has(task.id);
  const doneKids = kids.filter((k) => k.done).length;
  const p = PRIORITIES[task.priority];
  const top = depth === 0;

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} layout={LinearTransition}>
      <Pressable
        onPress={() => (hasKids ? onCollapse(task.id) : onToggle(task))}
        onLongPress={() => onMenu(task, depth)}
        {...contextMenuProps(() => onMenu(task, depth))}
        style={styles.row}
      >
        <Pressable
          onPress={() => onToggle(task)}
          hitSlop={8}
          accessibilityRole="checkbox"
          aria-checked={task.done}
          accessibilityLabel={task.title}
          style={[
            styles.check,
            !top && styles.checkSmall,
                        task.done && styles.checkDone,
          ]}
        >
          {task.done && (
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Feather name="check" size={top ? 15 : 12} color={colors.cream} />
            </Animated.View>
          )}
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, !top && styles.titleSub, task.done && styles.titleDone]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {(top || hasKids) && (
            <View style={styles.meta}>
              {top && (
                <View style={[styles.priority, { backgroundColor: PRIORITY_LOOK[task.priority].bg }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_LOOK[task.priority].fg }]}>{p.label}</Text>
                </View>
              )}
              {hasKids && (
                <Text style={styles.count}>
                  {doneKids}/{kids.length} done
                </Text>
              )}
            </View>
          )}
        </View>

        {depth < MAX_DEPTH && (
          <Pressable
            onPress={() => onAddSub(task)}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={`Add sub-task to ${task.title}`}
          >
            <Feather name="plus" size={15} color={colors.ink} />
          </Pressable>
        )}
        {hasKids && (
          <Feather
            name={isCollapsed ? 'chevron-right' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        )}
      </Pressable>

      {hasKids && !isCollapsed && (
        <View style={[styles.children, !top && styles.childrenSub]}>
          {kids.map((k) => (
            <TaskNode key={k.id} {...props} task={k} depth={depth + 1} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const PRIORITY_LOOK = themed((colors) => ({
  low: { bg: colors.sageSoft, fg: isDark() ? '#9FCFA4' : colors.forest },
  med: { bg: colors.honeySoft, fg: isDark() ? '#F3C46A' : '#7A4A00' },
  high: { bg: colors.dangerSoft, fg: isDark() ? '#F29A8B' : '#93261A' },
}));

const styles = themed((colors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#A39484',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSmall: { width: 23, height: 23, borderRadius: 12 },
  checkDone: { backgroundColor: colors.forest, borderColor: colors.forest },
  title: { fontFamily: fonts.displaySoft, fontSize: 17, color: colors.ink, lineHeight: 22 },
  titleSub: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.inkSoft },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  priority: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  priorityText: { fontFamily: fonts.bold, fontSize: 11.5 },
  count: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sub-tasks hang off a guide line that drops from the centre of the parent's checkbox.
  children: {
    marginLeft: 13,
    paddingLeft: 18,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
  },
  childrenSub: { marginLeft: 10, paddingLeft: 16 },
  }),
);
