import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesktopPage } from '@/components/desktop/DesktopPage';

import { BLOCKS } from '@/blocks';
import { importFromFile } from '@/components/bookmarks/importFromFile';
import { plural, SORTS, VIEWS } from '@/components/bookmarks/meta';
import { Squirrel } from '@/components/mascot/Squirrel';
import { type IconName } from '@/components/ui/BottomDrawer';
import { ask } from '@/lib/ask';
import { CURRENCIES, dateKey, formatMoney } from '@/lib/format';
import { isLive, useBookmarks } from '@/store/bookmarks';
import { useExpenses } from '@/store/expenses';
import { orderBlocks, useLayout } from '@/store/layout';
import { useNotes } from '@/store/notes';
import { usePrefs, type ThemePref } from '@/store/prefs';
import { useTasks } from '@/store/tasks';
import { colors, fonts, isDark, themed } from '@/theme';

const tick = () => Haptics.selectionAsync().catch(() => {});
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

type SectionKey = 'general' | 'money' | 'tasks' | 'bookmarks' | 'notes';

const SECTIONS: { key: SectionKey; title: string; icon: IconName; color: string }[] = [
  { key: 'general', title: 'General', icon: 'sliders', color: '#1F4A36' },
  { key: 'money', title: 'Money', icon: 'credit-card', color: '#E08A32' },
  { key: 'tasks', title: 'Tasks', icon: 'check-circle', color: '#5E9A4E' },
  { key: 'bookmarks', title: 'Bookmarks', icon: 'bookmark', color: '#3F7C9E' },
  { key: 'notes', title: 'Notes', icon: 'edit-3', color: '#E9A52C' },
];

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
/** Swatches for the little theme previews: [ground, card, ink]. */
const LIGHT_SWATCH = ['#F7F0E2', '#FFFCF5', '#2A1D14'] as const;
const DARK_SWATCH = ['#18130F', '#2A211A', '#F3E9D8'] as const;

/**
 * Settings, opened by tapping Hazel on the dock. A strip of section tabs follows your
 * scroll (and jumps when tapped); each section opens with its own numbers, then its
 * options. Things you navigate to carry an arrow; things that act carry a button.
 */
const onWeb = Platform.OS === 'web';

export default function Settings() {
  const { theme, setTheme } = usePrefs();
  const { order, setOrder } = useLayout();
  const { currency, setCurrency, monthlyBudget, places, expenses } = useExpenses();
  const { tasks, bringOverdueTo, removeTask } = useTasks();
  const { bookmarks, collections, view, sort, setView, setSort, emptyTrash } = useBookmarks();
  const { notes, folders, openFolders, toggleFolder } = useNotes();

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabs = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const [active, setActive] = useState<SectionKey>('general');

  const jump = (key: SectionKey) => {
    tick();
    scroller.current?.scrollTo({ y: Math.max(0, (offsets.current[key] ?? 0) - 6), animated: true });
  };
  const onScrollY = (y: number) => {
    let now: SectionKey = 'general';
    for (const s of SECTIONS) if ((offsets.current[s.key] ?? Infinity) <= y + 120) now = s.key;
    if (now !== active) {
      setActive(now);
      tabs.current?.scrollTo({ x: Math.max(0, SECTIONS.findIndex((s) => s.key === now) * 96 - 60), animated: true });
    }
  };

  const blocks = orderBlocks(BLOCKS, order);
  const move = (i: number, by: number) => {
    const keys = blocks.map((b) => b.key);
    const j = i + by;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    tick();
    setOrder(keys);
  };

  const today = dateKey();
  const top = tasks.filter((t) => !t.parentId);
  const overdue = top.filter((t) => !t.done && t.date < today).length;
  const finished = top.filter((t) => t.done);
  const open = top.length - finished.length;
  const live = bookmarks.filter(isLive);
  const trashed = bookmarks.length - live.length;
  const sortLabel = SORTS.find((s) => s.sort === sort)!.label;

  const section = (key: SectionKey, i: number, stats: ReactNode, children: ReactNode) => {
    const s = SECTIONS.find((x) => x.key === key)!;
    return (
      <Animated.View
        entering={FadeInDown.delay(60 + i * 70).springify().damping(18)}
        onLayout={(e) => {
          offsets.current[key] = e.nativeEvent.layout.y;
        }}
        style={styles.section}
      >
        <View style={styles.sectionHead}>
          <View style={[styles.sectionBadge, { backgroundColor: s.color }]}>
            <Feather name={s.icon} size={15} color="#FFF4DF" />
          </View>
          <Text style={styles.sectionTitle}>{s.title}</Text>
        </View>
        <View style={styles.card}>
          {stats ? <View style={[styles.stats, { backgroundColor: tint(s.color) }]}>{stats}</View> : null}
          {children}
        </View>
      </Animated.View>
    );
  };

  return (
    <DesktopPage>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {!onWeb && (
          <Pressable onPress={() => router.back()} style={styles.round} hitSlop={8} accessibilityLabel="Back">
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Everything stays on this {onWeb ? 'computer' : 'phone'}</Text>
        </View>
        <Squirrel size={54} acorn hopSignal={active} />
      </View>

      <ScrollView
        ref={tabs}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {SECTIONS.map((s) => {
          const on = active === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => jump(s.key)}
              style={[styles.tab, on && { backgroundColor: s.color }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Feather name={s.icon} size={14} color={on ? '#FFF4DF' : colors.inkSoft} />
              <Text style={[styles.tabText, on && { color: '#FFF4DF' }]}>{s.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={48}
        onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
      >
        {section(
          'general',
          0,
          null,
          <>
            {/* The desktop app is light only for now, so it has no theme to choose. */}
            {!onWeb && (
              <>
                <Group label="Appearance" help="Auto follows your phone's light or dark theme.">
                  <View style={styles.themes}>
                    {THEMES.map((t) => (
                      <ThemeTile key={t.value} value={t.value} label={t.label} on={theme === t.value} onPress={() => setTheme(t.value)} />
                    ))}
                  </View>
                </Group>
                <Line />
              </>
            )}
            <Group label="Order of blocks" help={onWeb ? 'The order they take in the sidebar.' : 'The order you pull through with the dock.'}>
              <View style={styles.orderList}>
                {blocks.map((b, i) => (
                  <Animated.View key={b.key} layout={LinearTransition.springify().damping(18)} style={styles.orderRow}>
                    <View style={styles.orderNum}>
                      <Text style={styles.orderNumText}>{i + 1}</Text>
                    </View>
                    <Feather name={b.icon} size={16} color={colors.inkSoft} />
                    <Text style={styles.orderName}>{b.title}</Text>
                    <Pressable
                      onPress={() => move(i, -1)}
                      disabled={i === 0}
                      style={[styles.arrow, i === 0 && styles.arrowOff]}
                      hitSlop={4}
                      accessibilityLabel={`Move ${b.title} up`}
                    >
                      <Feather name="arrow-up" size={15} color={colors.ink} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === blocks.length - 1}
                      style={[styles.arrow, i === blocks.length - 1 && styles.arrowOff]}
                      hitSlop={4}
                      accessibilityLabel={`Move ${b.title} down`}
                    >
                      <Feather name="arrow-down" size={15} color={colors.ink} />
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Group>
            {!onWeb && (
              <>
                <Line />
                <Row
                  icon="play-circle"
                  label="Welcome tour"
                  meta="Hazel and the science behind hani"
                  onPress={() => router.push('/onboarding')}
                />
              </>
            )}
          </>,
        )}

        {section(
          'money',
          1,
          <>
            <Stat value={formatMoney(monthlyBudget, currency)} label="a month" />
            <Stat value={String(places.length)} label={places.length === 1 ? 'place' : 'places'} />
            <Stat value={String(expenses.length)} label={expenses.length === 1 ? 'entry' : 'entries'} />
          </>,
          <>
            <Group label="Currency">
              <View style={styles.choices}>
                {CURRENCIES.map((c) => {
                  const on = currency === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => {
                        tick();
                        setCurrency(c.code);
                      }}
                      style={[styles.choice, on && styles.choiceOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={c.name}
                    >
                      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{c.code}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Group>
            <Line />
            <Row icon="pie-chart" label="Budget and places" meta="Monthly budget, and one per place" onPress={() => router.push('/budget')} />
          </>,
        )}

        {section(
          'tasks',
          2,
          <>
            <Stat value={String(open)} label="open" />
            <Stat value={String(finished.length)} label="done" />
            <Stat value={String(overdue)} label="left behind" />
          </>,
          <>
            <Row
              icon="corner-down-right"
              label="Unfinished tasks"
              meta={overdue ? `${plural(overdue, 'task')} from earlier days` : 'Nothing left behind'}
              action="Bring to today"
              disabled={overdue === 0}
              onPress={() => {
                bringOverdueTo(today);
                success();
              }}
            />
            <Line />
            <Row
              icon="check-square"
              label="Finished tasks"
              meta={finished.length ? plural(finished.length, 'finished task') : 'None yet'}
              action="Clear"
              danger
              disabled={finished.length === 0}
              onPress={() =>
                ask('Clear finished tasks?', `${plural(finished.length, 'task')} and their sub-tasks will be deleted.`, [
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                      finished.forEach((t) => removeTask(t.id));
                      success();
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          </>,
        )}

        {section(
          'bookmarks',
          3,
          <>
            <Stat value={String(live.length)} label={live.length === 1 ? 'link' : 'links'} />
            <Stat value={String(collections.length)} label={collections.length === 1 ? 'collection' : 'collections'} />
            <Stat value={String(trashed)} label="in Trash" />
          </>,
          <>
            <Row
              icon="download"
              label="Import links"
              meta="A CSV or JSON file. Raindrop exports work."
              action="Choose file"
              onPress={importFromFile}
            />
            <Line />
            <Group label="Show links as">
              <View style={styles.choices}>
                {VIEWS.map((v) => {
                  const on = view === v.view;
                  return (
                    <Pressable
                      key={v.view}
                      onPress={() => {
                        tick();
                        setView(v.view);
                      }}
                      style={[styles.choice, on && styles.choiceOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Feather name={v.icon} size={15} color={on ? colors.cream : colors.ink} />
                      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{v.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Group>
            <Line />
            <Row
              icon="bar-chart-2"
              label="Sort links"
              value={sortLabel}
              onPress={() =>
                ask('Sort links', undefined, [
                  ...SORTS.map((s) => ({ text: `${s.sort === sort ? '✓  ' : ''}${s.label}`, onPress: () => setSort(s.sort) })),
                  { text: 'Cancel', style: 'cancel' as const },
                ])
              }
            />
            <Line />
            <Row
              icon="trash-2"
              label="Trash"
              meta={trashed ? plural(trashed, 'deleted link') : 'Empty'}
              action="Empty"
              danger
              disabled={trashed === 0}
              onPress={() =>
                ask('Empty Trash?', `${plural(trashed, 'link')} will be deleted for good.`, [
                  { text: 'Empty Trash', style: 'destructive', onPress: emptyTrash },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          </>,
        )}

        {section(
          'notes',
          4,
          <>
            <Stat value={String(notes.length)} label={notes.length === 1 ? 'note' : 'notes'} />
            <Stat value={String(folders.length)} label={folders.length === 1 ? 'folder' : 'folders'} />
            <Stat value={String(notes.filter((n) => n.pinned).length)} label="pinned" />
          </>,
          <Row
            icon="minimize-2"
            label="Folders"
            meta={openFolders.length ? `${plural(openFolders.length, 'folder')} open` : 'All folded'}
            action="Fold all"
            disabled={openFolders.length === 0}
            onPress={() => openFolders.forEach((id) => toggleFolder(id, false))}
          />,
        )}

        <Text style={styles.footer}>No account, no cloud. Made with acorns.</Text>
      </ScrollView>
    </SafeAreaView>
    </DesktopPage>
  );
}

/** Soft wash of a section's colour, for its numbers strip. */
function tint(color: string) {
  return `${color}${isDark() ? '2E' : '1C'}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Group({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const Line = () => <View style={styles.line} />;

/** A tiny picture of the app in that theme; Auto shows half and half. */
function ThemeTile({ value, label, on, onPress }: { value: ThemePref; label: string; on: boolean; onPress: () => void }) {
  const halves = value === 'system' ? [LIGHT_SWATCH, DARK_SWATCH] : [value === 'dark' ? DARK_SWATCH : LIGHT_SWATCH];
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={({ pressed }) => [styles.themeTile, on && styles.themeTileOn, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <View style={styles.preview}>
        {halves.map(([ground, card, ink], i) => (
          <View key={i} style={[styles.previewHalf, { backgroundColor: ground }]}>
            <View style={[styles.previewHero, { backgroundColor: '#1F4A36' }]} />
            <View style={[styles.previewCard, { backgroundColor: card }]}>
              <View style={[styles.previewInk, { backgroundColor: ink }]} />
            </View>
          </View>
        ))}
        <View style={styles.previewDot} />
      </View>
      <View style={styles.themeFoot}>
        <Text style={[styles.themeText, on && styles.themeTextOn]}>{label}</Text>
        {on && <Feather name="check" size={13} color={colors.cream} />}
      </View>
    </Pressable>
  );
}

/**
 * One setting. With `action` it does something and shows a button; with `value` it shows
 * the current choice; otherwise it goes somewhere and shows an arrow.
 */
function Row({
  icon,
  label,
  meta,
  value,
  action,
  danger,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  meta?: string;
  value?: string;
  action?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={`${label}${meta ? `, ${meta}` : ''}${action ? `. ${action}` : ''}`}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={16} color={colors.inkSoft} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {action ? (
        <View style={[styles.action, danger && styles.actionDanger, disabled && styles.actionOff]}>
          <Text style={[styles.actionText, danger && styles.actionTextDanger, disabled && styles.actionTextOff]}>{action}</Text>
        </View>
      ) : (
        <>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          <Feather name="chevron-right" size={17} color={colors.faint} />
        </>
      )}
    </Pressable>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
    subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },

    tabs: { flexGrow: 0, flexShrink: 0, height: 48, marginTop: 10 },
    tabsContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: colors.chip,
    },
    tabText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.inkSoft },

    content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48, gap: 26 },
    section: { gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
    sectionBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
    card: { backgroundColor: colors.surface, borderRadius: 30, borderCurve: 'continuous', padding: 8 },

    stats: { flexDirection: 'row', borderRadius: 22, borderCurve: 'continuous', paddingVertical: 14, marginBottom: 4 },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    statValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
    statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 1 },

    group: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 12, gap: 10 },
    label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, letterSpacing: 0.2 },
    help: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted },
    line: { height: 1, backgroundColor: colors.line, opacity: 0.7, marginLeft: 56, marginRight: 8 },

    themes: { flexDirection: 'row', gap: 8 },
    themeTile: { flex: 1, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.chip, padding: 6, gap: 6 },
    themeTileOn: { backgroundColor: colors.forest },
    preview: { height: 62, borderRadius: 15, overflow: 'hidden', flexDirection: 'row' },
    previewHalf: { flex: 1, padding: 6, gap: 5 },
    previewHero: { height: 18, borderRadius: 6 },
    previewCard: { flex: 1, borderRadius: 6, padding: 5, justifyContent: 'center' },
    previewInk: { height: 4, width: '60%', borderRadius: 2, opacity: 0.8 },
    previewDot: { position: 'absolute', right: 6, bottom: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#F6B845' },
    themeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 22 },
    themeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
    themeTextOn: { color: colors.cream },
    pressed: { transform: [{ scale: 0.97 }] },

    choices: { flexDirection: 'row', gap: 6 },
    choice: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.chip,
    },
    choiceOn: { backgroundColor: colors.forest },
    choiceText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    choiceTextOn: { color: colors.cream },

    orderList: { gap: 6 },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 48,
      paddingLeft: 8,
      paddingRight: 6,
      borderRadius: 24,
      backgroundColor: colors.bg,
    },
    orderNum: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    orderNumText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft },
    orderName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    arrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowOff: { opacity: 0.3 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 8, borderRadius: 22 },
    rowPressed: { backgroundColor: colors.chip },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
    rowMeta: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 1 },
    rowValue: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
    action: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.honey, justifyContent: 'center' },
    actionDanger: { backgroundColor: colors.dangerSoft },
    actionOff: { backgroundColor: colors.chip },
    actionText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.onHoney },
    actionTextDanger: { color: colors.danger },
    actionTextOff: { color: colors.faint },

    footer: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  }),
);
