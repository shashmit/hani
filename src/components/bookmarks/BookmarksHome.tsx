import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { BookmarkItem } from '@/components/bookmarks/BookmarkItem';
import { Squirrel } from '@/components/mascot/Squirrel';
import { IconBadge } from '@/components/ui/BottomDrawer';
import { useBlockBottom } from '@/lib/blockSpace';
import { useIsDesktop } from '@/lib/useDesktop';
import { isLive, useBookmarks, type BookmarkScope, type Collection } from '@/store/bookmarks';
import { colors, fonts, themed } from '@/theme';
import { plural, SYSTEM } from './meta';
import { useBookmarkActions } from './useBookmarkActions';

const RECENT = 4;

/**
 * The Bookmarks home page: the four built-in places (All items, Unsorted, Favorites,
 * Trash), then your collections as a tree you can fold open (collections hold links and
 * more collections, as deep as you like), then what you saved last. Searching here looks
 * through every link and every collection name.
 */
export function BookmarksHome() {
  const { bookmarks, collections, setScope, openCollections, toggleCollection, toggleFavorite } = useBookmarks();
  const { counts, pathOf, open, bookmarkMenu, collectionMenu } = useBookmarkActions();
  const desktop = useIsDesktop();
  const bottom = useBlockBottom();
  const [query, setQuery] = useState('');

  const live = useMemo(() => bookmarks.filter(isLive), [bookmarks]);
  const trashed = bookmarks.length - live.length;
  const byId = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const childrenOf = (id?: string) =>
    collections.filter((c) => c.parentId === id).sort((a, b) => a.createdAt - b.createdAt);

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? live
            .filter((b) => [b.title, b.excerpt, b.url, b.note, ...b.tags].some((s) => s.toLowerCase().includes(q)))
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [live, q],
  );
  const matchingCollections = q ? collections.filter((c) => c.title.toLowerCase().includes(q)) : [];
  // eslint-disable-next-line react-hooks/purity
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = live.filter((b) => b.createdAt >= weekAgo).length;
  const recent = useMemo(() => [...live].sort((a, b) => b.createdAt - a.createdAt).slice(0, RECENT), [live]);

  const go = (s: BookmarkScope) => {
    Haptics.selectionAsync().catch(() => {});
    setScope(s);
  };

  const tiles: { scope: 'all' | 'unsorted' | 'favorites' | 'trash'; count: number }[] = [
    { scope: 'all', count: live.length },
    { scope: 'unsorted', count: live.filter((b) => !b.collectionId).length },
    { scope: 'favorites', count: live.filter((b) => b.favorite).length },
    { scope: 'trash', count: trashed },
  ];

  const header = q ? (
    <View style={styles.stack}>
      {matchingCollections.length > 0 && (
        <>
          <Text style={styles.section}>Collections</Text>
          {matchingCollections.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => go({ collectionId: c.id })}
              onLongPress={() => collectionMenu(c)}
              style={({ pressed }) => [styles.node, pressed && styles.pressed]}
            >
              <IconBadge icon={c.icon} color={c.color} solid size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.nodeTitle} numberOfLines={1}>
                  {c.title}
                </Text>
                <Text style={styles.nodeMeta} numberOfLines={1}>
                  {c.parentId ? pathOf(byId.get(c.parentId)!) : 'My collections'} · {plural(counts.get(c.id) ?? 0, 'link')}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </>
      )}
      <Text style={styles.section}>{plural(results.length, 'link')}</Text>
    </View>
  ) : (
    <View style={styles.stack}>
      {/* Everything at a glance: the whole stash, with the three side doors under it. */}
      <Pressable
        onPress={() => go('all')}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`All items, ${plural(live.length, 'link')}`}
      >
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>All items</Text>
            <View style={styles.heroCountRow}>
              <Text style={styles.heroCount}>{live.length}</Text>
              <Text style={styles.heroUnit}>{live.length === 1 ? 'link saved' : 'links saved'}</Text>
            </View>
            <Text style={styles.heroSub}>
              {thisWeek > 0 ? `${thisWeek} added this week` : 'Nothing new this week'}
            </Text>
          </View>
          <View style={styles.heroArrow}>
            <Feather name="arrow-up-right" size={20} color={colors.onHoney} />
          </View>
        </View>
        <View style={styles.doors}>
          {tiles
            .filter((t) => t.scope !== 'all')
            .map(({ scope, count }) => (
              <Pressable
                key={scope}
                onPress={() => go(scope)}
                style={({ pressed }) => [styles.door, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`${SYSTEM[scope].name}, ${plural(count, 'link')}`}
              >
                <Feather name={SYSTEM[scope].icon} size={14} color={colors.cream} />
                <Text style={styles.doorName} numberOfLines={1}>
                  {SYSTEM[scope].name}
                </Text>
                <Text style={styles.doorCount}>{count}</Text>
              </Pressable>
            ))}
        </View>
      </Pressable>

      <View style={styles.sectionRow}>
        <Text style={styles.heading}>My collections</Text>
        <Pressable
          onPress={() => router.push('/collection')}
          style={styles.newPill}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="New collection"
        >
          <Feather name="plus" size={14} color={colors.ink} />
          <Text style={styles.newText}>New</Text>
        </Pressable>
      </View>

      {collections.length === 0 ? (
        <Pressable onPress={() => router.push('/collection')} style={styles.emptyTree}>
          <IconBadge icon="folder-plus" color={colors.forest} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nodeTitle}>Start a collection</Text>
            <Text style={styles.nodeMeta}>Group links by topic. Collections can hold more collections.</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.tree}>
          {childrenOf(undefined).map((c, i) => (
            <CollectionNode
              key={c.id}
              first={i === 0}
              c={c}
              depth={0}
              childrenOf={childrenOf}
              counts={counts}
              openIds={openCollections}
              onToggle={toggleCollection}
              onOpen={(id) => go({ collectionId: id })}
              onMenu={collectionMenu}
            />
          ))}
        </View>
      )}

      {recent.length > 0 && <Text style={[styles.heading, { marginTop: 10, paddingHorizontal: 4 }]}>Recently saved</Text>}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bookmarks</Text>
          <Text style={styles.sub}>
            {plural(live.length, 'link')} · {plural(collections.length, 'collection')}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/collection')}
          style={[styles.round, styles.roundHoney]}
          hitSlop={6}
          accessibilityLabel="New collection"
        >
          <Feather name="folder-plus" size={18} color={colors.onHoney} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search links and collections"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={q ? results : recent}
        keyExtractor={(b) => b.id}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottom }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <BookmarkItem
            b={item}
            view="list"
            collection={item.collectionId ? byId.get(item.collectionId) : undefined}
            onOpen={() => open(item)}
            onMenu={() => bookmarkMenu(item)}
            onToggleFavorite={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggleFavorite(item.id);
            }}
          />
        )}
        ListEmptyComponent={
          q && matchingCollections.length === 0 ? (
            <View style={styles.empty}>
              <Squirrel size={80} />
              <Text style={styles.emptyTitle}>Nothing found</Text>
              <Text style={styles.emptyText}>No link or collection matches “{query.trim()}”.</Text>
            </View>
          ) : !q && live.length === 0 ? (
            <View style={styles.empty}>
              <Squirrel size={80} />
              <Text style={styles.emptyTitle}>No links yet</Text>
              <Text style={styles.emptyText}>
                {desktop ? 'Copy a link anywhere, then click + Add bookmark.' : 'Copy a link anywhere, then tap + on the dock.'}
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          !q && collections.length > 0 ? (
            <Text style={styles.hint}>
              {desktop ? 'Right-click a collection to edit or nest it.' : 'Hold a collection to edit it or add one inside.'}
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}

/** One collection in the tree, with its own collections folded underneath. */
function CollectionNode({
  c,
  depth,
  first,
  childrenOf,
  counts,
  openIds,
  onToggle,
  onOpen,
  onMenu,
}: {
  c: Collection;
  depth: number;
  /** First row of the card: no divider above it. */
  first?: boolean;
  childrenOf: (id?: string) => Collection[];
  counts: Map<string, number>;
  openIds: string[];
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onMenu: (c: Collection) => void;
}) {
  const kids = childrenOf(c.id);
  const isOpen = kids.length > 0 && openIds.includes(c.id);

  return (
    <View>
      {depth === 0 && !first && <View style={styles.divider} />}
      <Pressable
        onPress={() => onOpen(c.id)}
        onLongPress={() => onMenu(c)}
        style={({ pressed }) => [styles.node, depth > 0 && styles.nodeNested, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${c.title}, ${plural(counts.get(c.id) ?? 0, 'link')}${kids.length ? `, ${plural(kids.length, 'collection')} inside` : ''}`}
      >
        <IconBadge icon={c.icon} color={c.color} solid size={depth ? 32 : 36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nodeTitle} numberOfLines={1}>
            {c.title}
          </Text>
          {kids.length > 0 && <Text style={styles.nodeMeta}>{plural(kids.length, 'folder')} inside</Text>}
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{counts.get(c.id) ?? 0}</Text>
        </View>
        {kids.length > 0 ? (
          // Folds the collections inside open or shut; the rest of the row opens it.
          <Caret
            open={isOpen}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggle(c.id);
            }}
          />
        ) : (
          <Feather name="chevron-right" size={18} color={colors.faint} style={styles.leafArrow} />
        )}
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.branch}>
          {kids.map((k) => (
            <CollectionNode
              key={k.id}
              c={k}
              depth={depth + 1}
              childrenOf={childrenOf}
              counts={counts}
              openIds={openIds}
              onToggle={onToggle}
              onOpen={onOpen}
              onMenu={onMenu}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

/** Fold arrow that turns as its branch opens. */
function Caret({ open, onPress }: { open: boolean; onPress: () => void }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, { damping: 18, stiffness: 260 }));
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.caret}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Fold' : 'Unfold'}
      accessibilityState={{ expanded: open }}
    >
      <Animated.View style={style}>
        <Feather name="chevron-down" size={18} color={colors.ink} />
      </Animated.View>
    </Pressable>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundHoney: { backgroundColor: colors.honey },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 25,
    paddingHorizontal: 18,
    height: 50,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, height: '100%' },

  list: { flex: 1, marginHorizontal: -20 },
  listContent: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  stack: { gap: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },

  hero: { backgroundColor: colors.forest, borderRadius: 32, borderCurve: 'continuous', padding: 18, gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cream, opacity: 0.78 },
  heroCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  heroCount: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, color: colors.cream },
  heroUnit: { fontFamily: fonts.displaySoft, fontSize: 17, color: colors.cream },
  heroSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.cream, opacity: 0.7 },
  heroArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.honey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doors: { flexDirection: 'row', gap: 8 },
  door: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 11,
    borderRadius: 21,
    backgroundColor: 'rgba(255,244,223,0.14)',
  },
  doorName: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.cream },
  doorCount: { fontFamily: fonts.display, fontSize: 14, color: colors.cream },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, opacity: 0.7, marginLeft: 58, marginRight: 10 },
  countPill: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48.5%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tileCount: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  tileName: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
  tileBlurb: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, marginTop: 1 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  newPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: colors.chip,
  },
  newText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },

  tree: { backgroundColor: colors.surface, borderRadius: 30, borderCurve: 'continuous', padding: 6 },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  nodeNested: { minHeight: 52 },
  branch: { marginLeft: 26, paddingLeft: 6, marginBottom: 4, borderLeftWidth: 2, borderLeftColor: colors.line },
  caret: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafArrow: { width: 34, textAlign: 'center' },
  nodeTitle: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
  nodeMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  emptyTree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },

  empty: { alignItems: 'center', paddingTop: 28, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 },
  }),
);
