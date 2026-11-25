import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PillButton } from '@/components/ui/PillButton';
import { Chip, Field, Sheet, sheetStyles } from '@/components/ui/Sheet';
import { addDays, dateKey, dayTitle } from '@/lib/format';
import { useSettledFocus } from '@/lib/useSettledFocus';
import { PRIORITIES, useTasks, type Priority } from '@/store/tasks';
import { colors, fonts, themed } from '@/theme';

/**
 * New task, or (when opened with ?parentId=) a new sub-task under an existing task.
 * "Add another" keeps the sheet open so a list of sub-tasks can be typed in one go.
 */
export default function AddTask() {
  const { parentId } = useLocalSearchParams<{ parentId?: string }>();
  const { tasks, addTask, selectedDate } = useTasks();
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined;

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(parent?.priority ?? 'med');
  const [date, setDate] = useState(selectedDate);
  const [added, setAdded] = useState(0);
  const input = useSettledFocus();

  const today = dateKey();
  // Offer today, tomorrow and whichever day is open on the Tasks block.
  const dayChoices = [...new Set([today, addDays(today, 1), selectedDate])].sort();

  const valid = title.trim().length > 0;

  const save = (keepOpen: boolean) => {
    if (!valid) return;
    addTask({ title: title.trim(), priority, date, parentId: parent?.id });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!keepOpen) return router.back();
    setTitle('');
    setAdded((n) => n + 1);
    input.current?.focus();
  };

  return (
    <Sheet
      kicker="Tasks"
      title={parent ? 'New sub-task' : 'New task'}
      footer={
        <View style={styles.footer}>
          <PillButton
            label="Add another"
            variant="ghost"
            icon="plus"
            disabled={!valid}
            onPress={() => save(true)}
            style={{ flex: 1 }}
          />
          <PillButton
            label={added > 0 && !valid ? 'Done' : 'Add'}
            icon="check"
            disabled={!valid && added === 0}
            onPress={() => (valid ? save(false) : router.back())}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      {parent && (
        <View style={styles.parent}>
          <Feather name="corner-down-right" size={16} color={colors.forestInk} />
          <View style={{ flex: 1 }}>
            <Text style={styles.parentLabel}>Under</Text>
            <Text style={styles.parentTitle} numberOfLines={2}>
              {parent.title}
            </Text>
          </View>
          {added > 0 && <Text style={styles.added}>{added} added</Text>}
        </View>
      )}

      <Field label={parent ? 'Sub-task' : 'What needs doing?'}>
        <TextInput
          ref={input}
          value={title}
          onChangeText={setTitle}
          placeholder={parent ? 'e.g. Book tickets' : 'e.g. Pay electricity bill'}
          placeholderTextColor={colors.faint}
          style={sheetStyles.input}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => save(Boolean(parent))}
        />
      </Field>

      {!parent && (
        <>
          <Field label="Day">
            <View style={sheetStyles.chips}>
              {dayChoices.map((d) => (
                <Chip key={d} label={dayTitle(d)} selected={date === d} onPress={() => setDate(d)} />
              ))}
            </View>
          </Field>

          <Field label="Priority">
            <View style={sheetStyles.chips}>
              {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                <Chip
                  key={p}
                  label={PRIORITIES[p].label}
                  color={PRIORITIES[p].fg}
                  selected={priority === p}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          </Field>
        </>
      )}
    </Sheet>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  footer: { flexDirection: 'row', gap: 10 },
  parent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.sageSoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  parentLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.forest },
  parentTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 2 },
  added: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.forest },
  }),
);
