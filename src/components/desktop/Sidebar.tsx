import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { BlockDef } from '@/blocks';
import { HazelFace } from '@/components/mascot/HazelFace';
import { addDays, dateKey, isSameMonth } from '@/lib/format';
import { contextMenuProps } from '@/lib/useDesktop';
import { flattenCollections, isLive, scopeKey, useBookmarks, type BookmarkScope } from '@/store/bookmarks';
import { useExpenses } from '@/store/expenses';
import { useNotes } from '@/store/notes';
import { useTasks } from '@/store/tasks';
import { colors, fonts } from '@/theme';

import { useBookmarkActions } from '../bookmarks/useBookmarkActions';
import { DRAG_REGION, MOD, ON_BARK, RAIL_W, SIDEBAR_W, TOP_CLEAR } from './frame';

type Icon = ComponentProps<typeof Feather>['name'];
type Hover = { hovered?: boolean; pressed?: boolean };

/**
 * The window's left edge, drawn straight on the bark: the add button, the blocks, and
 * under the open block its own places to go (collections, days, recent notes). Folds
 * down to a strip of icons.
 */
export function Sidebar({
  blocks,
  index,
  onSelect,
  rail,
  onToggleRail,
  addKey,
  settings = false,
}: {
  blocks: BlockDef[];
  index: number;
  onSelect: (i: number) => void;
  rail: boolean;
  onToggleRail: () => void;
  addKey: Record<string, string>;
  /** Settings is open: its row is the lit one, and no block is. */
  settings?: boolean;
}) {
  const block = blocks[index] ?? blocks[0];
  const openSettings = () => {
    if (!settings) router.push('/settings');
  };
  const counts = useCounts();

  if (rail) {
    return (
      <View style={[styles.root, { width: RAIL_W }]}>
        <View style={styles.clear} {...DRAG_REGION} />
        <View style={styles.railBody}>
          <Pressable
            onPress={() => router.push(block.addRoute)}
            style={({ hovered }: Hover) => [styles.railAdd, hovered && styles.addHover]}
            accessibilityRole="button"
            accessibilityLabel={block.addLabel}
          >
            <Feather name="plus" size={20} color={colors.onHoney} />
          </Pressable>
          <View style={styles.railGap} />
          {blocks.map((b, i) => (
            <Pressable
              key={b.key}
              onPress={() => onSelect(i)}
              style={({ hovered }: Hover) => [styles.railItem, hovered && styles.hover, i === index && !settings && styles.railOn]}
              accessibilityRole="tab"
              aria-selected={i === index && !settings}
              accessibilityLabel={b.title}
            >
              <Feather name={b.icon} size={19} color={i === index && !settings ? colors.onHoney : ON_BARK.soft} />
            </Pressable>
          ))}
        </View>
        <View style={styles.railFoot}>
          <IconButton icon="settings" label="Settings" on={settings} onPress={openSettings} />
          <IconButton icon="sidebar" label="Show sidebar" onPress={onToggleRail} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { width: SIDEBAR_W }]}>
      <View style={[styles.clear, styles.clearRow]} {...DRAG_REGION}>
        <IconButton icon="sidebar" label={`Hide sidebar (${MOD}\\)`} onPress={onToggleRail} />
      </View>

      <View style={styles.brand} {...DRAG_REGION}>
        <HazelFace size={34} />
        <View pointerEvents="none">
          <Text style={styles.logo}>hani</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push(block.addRoute)}
        style={({ hovered }: Hover) => [styles.add, hovered && styles.addHover]}
        accessibilityRole="button"
        accessibilityLabel={block.addLabel}
      >
        <Feather name="plus" size={17} color={colors.onHoney} />
        <Text style={styles.addText}>{block.addLabel}</Text>
        {addKey[block.key] && <Text style={styles.addKey}>{`${MOD}${addKey[block.key]}`}</Text>}
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.nav} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Blocks</Text>
        {blocks.map((b, i) => {
          const on = i === index && !settings;
          return (
            <View key={b.key}>
              <Pressable
                onPress={() => onSelect(i)}
                style={({ hovered }: Hover) => [styles.row, hovered && !on && styles.hover, on && styles.rowOn]}
                accessibilityRole="tab"
                aria-selected={on}
                accessibilityLabel={`${b.title} (${MOD}${i + 1})`}
              >
                {({ hovered }: Hover) => (
                  <>
                    <Feather name={b.icon} size={17} color={on ? colors.onHoney : ON_BARK.soft} />
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{b.title}</Text>
                    <Text style={[styles.count, on && styles.countOn]}>
                      {hovered && !on ? `${MOD}${i + 1}` : counts[b.key] || ''}
                    </Text>
                  </>
                )}
              </Pressable>
              {on && (
                <Animated.View entering={FadeIn.duration(180)} style={styles.subs}>
                  {b.key === 'money' && <MoneySubs />}
                  {b.key === 'tasks' && <TaskSubs />}
                  {b.key === 'bookmarks' && <BookmarkSubs />}
                  {b.key === 'notes' && <NoteSubs />}
                </Animated.View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.foot}>
        <Pressable
          onPress={openSettings}
          style={({ hovered }: Hover) => [styles.row, hovered && !settings && styles.hover, settings && styles.rowOn]}
          accessibilityRole="button"
          aria-current={settings || undefined}
          accessibilityLabel="Settings"
        >
          <Feather name="settings" size={17} color={settings ? colors.onHoney : ON_BARK.soft} />
          <Text style={[styles.rowText, settings && styles.rowTextOn]}>Settings</Text>
          <Text style={[styles.count, settings && styles.countOn]}>{`${MOD},`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The number beside each block: what is waiting there. */
function useCounts(): Record<string, number> {
  const expenses = useExpenses((s) => s.expenses);
  const tasks = useTasks((s) => s.tasks);
  const bookmarks = useBookmarks((s) => s.bookmarks);
  const notes = useNotes((s) => s.notes);
  return useMemo(() => {
    const today = dateKey();
    return {
      money: expenses.filter((e) => isSameMonth(e.createdAt)).length,
      tasks: tasks.filter((t) => !t.parentId && !t.done && t.date <= today).length,
      bookmarks: bookmarks.filter(isLive).length,
      notes: notes.length,
    };
  }, [expenses, tasks, bookmarks, notes]);
}

function MoneySubs() {
  const places = useExpenses((s) => s.places);
  return (
    <>
      <Sub icon="sliders" label="Budget and places" hint={`${MOD}B`} onPress={() => router.push('/budget')} />
      {places.map((p) => (
        <Sub key={p.id} icon="map-pin" label={p.name} onPress={() => router.push('/budget')} />
      ))}
    </>
  );
}

function TaskSubs() {
  const tasks = useTasks((s) => s.tasks);
  const selected = useTasks((s) => s.selectedDate);
  const setSelected = useTasks((s) => s.setSelectedDate);
  const today = dateKey();
  const tomorrow = addDays(today, 1);
  const open = (day: string) => tasks.filter((t) => !t.parentId && !t.done && t.date === day).length;
  const overdue = tasks.filter((t) => !t.parentId && !t.done && t.date < today);
  // The day that has waited longest.
  const oldest = overdue.reduce((min, t) => (t.date < min ? t.date : min), today);
  return (
    <>
      <Sub icon="sun" label="Today" count={open(today)} on={selected === today} onPress={() => setSelected(today)} />
      <Sub
        icon="sunrise"
        label="Tomorrow"
        count={open(tomorrow)}
        on={selected === tomorrow}
        onPress={() => setSelected(tomorrow)}
      />
      {overdue.length > 0 && (
        <Sub
          icon="alert-circle"
          label="Overdue"
          count={overdue.length}
          on={selected < today}
          onPress={() => setSelected(oldest)}
        />
      )}
    </>
  );
}

function BookmarkSubs() {
  const { bookmarks, collections, scope, setScope, openCollections, toggleCollection } = useBookmarks();
  const { counts, collectionMenu } = useBookmarkActions();
  const live = useMemo(() => bookmarks.filter(isLive), [bookmarks]);
  const key = scopeKey(scope === 'home' ? 'all' : scope);
  const tree = useMemo(() => flattenCollections(collections), [collections]);
  const hasKids = useMemo(() => new Set(collections.map((c) => c.parentId).filter(Boolean)), [collections]);
  const byId = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  // A collection shows when every folder above it is unfolded.
  const visible = tree.filter(({ collection }) => {
    for (let p = collection.parentId; p; p = byId.get(p)?.parentId) if (!openCollections.includes(p)) return false;
    return true;
  });

  const system: { scope: BookmarkScope; icon: Icon; label: string; count: number }[] = [
    { scope: 'all', icon: 'archive', label: 'All items', count: live.length },
    { scope: 'unsorted', icon: 'inbox', label: 'Unsorted', count: live.filter((b) => !b.collectionId).length },
    { scope: 'favorites', icon: 'star', label: 'Favorites', count: live.filter((b) => b.favorite).length },
    { scope: 'trash', icon: 'trash-2', label: 'Trash', count: bookmarks.length - live.length },
  ];

  return (
    <>
      {system.map((s) => (
        <Sub
          key={scopeKey(s.scope)}
          icon={s.icon}
          label={s.label}
          count={s.count}
          on={key === s.scope}
          onPress={() => setScope(s.scope)}
        />
      ))}
      <View style={styles.subHead}>
        <Text style={styles.subLabel}>Collections</Text>
        <Pressable
          onPress={() => router.push('/collection')}
          style={({ hovered }: Hover) => [styles.tiny, hovered && styles.hover]}
          accessibilityRole="button"
          accessibilityLabel="New collection"
        >
          <Feather name="plus" size={14} color={ON_BARK.soft} />
        </Pressable>
      </View>
      {visible.length === 0 && <Text style={styles.none}>None yet</Text>}
      {visible.map(({ collection: c, depth }) => {
        const folded = hasKids.has(c.id) && !openCollections.includes(c.id);
        return (
          <Sub
            key={c.id}
            icon={c.icon}
            tint={c.color}
            label={c.title}
            count={counts.get(c.id) ?? 0}
            on={key === c.id}
            indent={depth}
            onPress={() => setScope({ collectionId: c.id })}
            onMenu={() => collectionMenu(c)}
            lead={
              hasKids.has(c.id) ? (
                <Pressable
                  onPress={() => toggleCollection(c.id)}
                  hitSlop={4}
                  accessibilityLabel={folded ? `Unfold ${c.title}` : `Fold ${c.title}`}
                >
                  <Feather name={folded ? 'chevron-right' : 'chevron-down'} size={13} color={ON_BARK.faint} />
                </Pressable>
              ) : undefined
            }
          />
        );
      })}
    </>
  );
}

function NoteSubs() {
  const notes = useNotes((s) => s.notes);
  // The note that is open in the editor, if one is.
  const pathname = usePathname();
  const openId = pathname.startsWith('/note/') ? decodeURIComponent(pathname.slice(6)) : null;
  const recent = useMemo(
    () => [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt).slice(0, 6),
    [notes],
  );
  if (recent.length === 0) return <Text style={styles.none}>No notes yet</Text>;
  return (
    <>
      {recent.map((n) => (
        <Sub
          key={n.id}
          icon={n.pinned ? 'bookmark' : 'file-text'}
          label={n.title || 'Untitled'}
          on={n.id === openId}
          onPress={() => {
            if (n.id === openId) return;
            // From one note to the next: swap, so Back still leads to the notes list.
            const to = { pathname: '/note/[id]' as const, params: { id: n.id } };
            if (openId) router.replace(to);
            else router.push(to);
          }}
        />
      ))}
    </>
  );
}

function Sub({
  icon,
  tint,
  label,
  count,
  hint,
  on,
  indent = 0,
  lead,
  onPress,
  onMenu,
}: {
  icon: Icon;
  tint?: string;
  label: string;
  count?: number;
  hint?: string;
  on?: boolean;
  indent?: number;
  lead?: ReactNode;
  onPress: () => void;
  onMenu?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: Hover) => [
        styles.sub,
        { paddingLeft: 10 + indent * 14 },
        hovered && !on && styles.hover,
        on && styles.subOn,
      ]}
      accessibilityRole="button"
      aria-current={on || undefined}
      accessibilityLabel={label}
      {...(onMenu ? contextMenuProps(onMenu) : null)}
    >
      <View style={styles.lead}>{lead}</View>
      {tint ? (
        <View style={[styles.swatch, { backgroundColor: tint }]}>
          <Feather name={icon} size={11} color="#FFF4DF" />
        </View>
      ) : (
        <Feather name={icon} size={14.5} color={on ? ON_BARK.text : ON_BARK.soft} />
      )}
      <Text style={[styles.subText, on && styles.subTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Text style={styles.subCount}>{hint}</Text> : count ? <Text style={styles.subCount}>{count}</Text> : null}
    </Pressable>
  );
}

function IconButton({ icon, label, on, onPress }: { icon: Icon; label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: Hover) => [styles.iconBtn, hovered && !on && styles.hover, on && styles.railOn]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={17} color={on ? colors.onHoney : ON_BARK.soft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 10 },
  clear: { height: TOP_CLEAR },
  clearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 },
  hover: { backgroundColor: ON_BARK.hover },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 16 },
  logo: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: ON_BARK.text },
  date: { fontFamily: fonts.medium, fontSize: 12, color: ON_BARK.faint },

  add: {
    marginHorizontal: 12,
    height: 44,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.honey,
  },
  addHover: { backgroundColor: colors.honeyDeep },
  addText: { flex: 1, fontFamily: fonts.displaySoft, fontSize: 15, color: colors.onHoney },
  addKey: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onHoney, opacity: 0.6 },

  nav: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 12, gap: 2 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ON_BARK.faint,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  row: {
    height: 38,
    borderRadius: 12,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 10,
  },
  rowOn: { backgroundColor: ON_BARK.text },
  rowText: { flex: 1, fontFamily: fonts.displaySoft, fontSize: 15, color: ON_BARK.soft },
  rowTextOn: { color: colors.onHoney },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: ON_BARK.faint },
  countOn: { color: colors.onHoney, opacity: 0.55 },

  // Places inside the open block hang off a thin line under its row.
  subs: {
    marginLeft: 18,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 6,
    borderLeftWidth: 1.5,
    borderLeftColor: ON_BARK.fill,
    gap: 1,
  },
  sub: {
    height: 31,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  subOn: { backgroundColor: ON_BARK.fill },
  lead: { width: 13, alignItems: 'center' },
  swatch: { width: 19, height: 19, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  subText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: ON_BARK.soft },
  subTextOn: { color: ON_BARK.text, fontFamily: fonts.semibold },
  subCount: { fontFamily: fonts.medium, fontSize: 11.5, color: ON_BARK.faint },
  subHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, paddingTop: 10, height: 36 },
  subLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ON_BARK.faint,
  },
  tiny: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  none: { fontFamily: fonts.medium, fontSize: 12.5, color: ON_BARK.faint, paddingLeft: 23, paddingVertical: 6 },

  foot: { paddingHorizontal: 12 },
  iconBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  railBody: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 4 },
  railAdd: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.honey,
  },
  railGap: { height: 12 },
  railItem: { width: 44, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  railOn: { backgroundColor: ON_BARK.text },
  railFoot: { alignItems: 'center', gap: 2 },
});
