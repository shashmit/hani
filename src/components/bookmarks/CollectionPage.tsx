import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookmarkItem } from '@/components/bookmarks/BookmarkItem';
import { Squirrel } from '@/components/mascot/Squirrel';
import {
  BottomDrawer,
  DrawerSection,
  FilterButton,
  IconBadge,
  OptionRow,
  PickedLead,
  PickerDrawer,
} from '@/components/ui/BottomDrawer';
import { ask } from '@/lib/ask';
import { useBlockBottom } from '@/lib/blockSpace';
import { useIsDesktop } from '@/lib/useDesktop';
import {
  collectionPath,
  collectionSubtree,
  flattenCollections,
  isLive,
  scopeParent,
  useBookmarks,
  type Bookmark,
  type BookmarkScope,
  type BookmarkSort,
  type BookmarkType,
} from '@/store/bookmarks';
import { tagCounts } from '@/store/notes';
import { colors, fonts, themed } from '@/theme';
import { plural, scopeLook, SORTS, SYSTEM, TAG_COLOR, TYPES, typeInfo, VIEWS } from './meta';
import { useBookmarkActions } from './useBookmarkActions';

type Drawer = 'jump' | 'type' | 'tags' | 'display' | null;

/**
 * One place's links: All items, Unsorted, Favorites, Trash, or a collection (with the
 * collections inside it on top). Back steps up to the parent collection, then home.
 * Search, then Type and Tags (tags combine: a link must carry every one picked) narrow
 * the list; Display sets view and sort. Every count says what picking it would show.
 */
export function CollectionPage() {
  const { bookmarks, collections, view, sort, scope, setScope, setView, setSort, toggleFavorite, emptyTrash } =
    useBookmarks();
  const { counts, open, bookmarkMenu, trashMenu, collectionMenu } = useBookmarkActions();
  const desktop = useIsDesktop();
  const bottom = useBlockBottom();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<BookmarkType | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<Drawer>(null);
  // Phones show two cards across; a desktop window fits as many as it has room for.
  const [listW, setListW] = useState(0);

  const byId = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const active = typeof scope === 'string' ? undefined : byId.get(scope.collectionId);
  const trash = scope === 'trash';
  const look = scopeLook(scope, collections);
  const crumbs = active ? collectionPath(collections, active.parentId) : [];
  const live = useMemo(() => bookmarks.filter(isLive), [bookmarks]);
  const trashedCount = bookmarks.length - live.length;

  const inScope = useMemo(() => {
    if (scope === 'trash') return bookmarks.filter((b) => !isLive(b));
    if (scope === 'all' || scope === 'home') return live;
    if (scope === 'unsorted') return live.filter((b) => !b.collectionId);
    if (scope === 'favorites') return live.filter((b) => b.favorite);
    const ids = collectionSubtree(collections, scope.collectionId);
    return live.filter((b) => b.collectionId && ids.has(b.collectionId));
  }, [bookmarks, live, collections, scope]);

  const q = query.trim().toLowerCase();
  const searched = useMemo(
    () =>
      q
        ? inScope.filter((b) => [b.title, b.excerpt, b.url, b.note, ...b.tags].some((s) => s.toLowerCase().includes(q)))
        : inScope,
    [inScope, q],
  );

  // Each filter counts with the *other* one applied, so it says what you'd get.
  const typeCounts = useMemo(() => {
    const m = new Map<BookmarkType, number>();
    for (const b of searched) if (tags.every((t) => b.tags.includes(t))) m.set(b.type, (m.get(b.type) ?? 0) + 1);
    return m;
  }, [searched, tags]);
  const tagFacet = useMemo(
    () => tagCounts(searched.filter((b) => (!type || b.type === type) && tags.every((t) => b.tags.includes(t)))),
    [searched, type, tags],
  );

  const shown = useMemo(() => {
    const list = searched.filter((b) => (!type || b.type === type) && tags.every((t) => b.tags.includes(t)));
    if (trash) return list.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    const cmp: Record<BookmarkSort, (a: Bookmark, b: Bookmark) => number> = {
      new: (a, b) => b.createdAt - a.createdAt,
      old: (a, b) => a.createdAt - b.createdAt,
      title: (a, b) => a.title.localeCompare(b.title),
      site: (a, b) => a.domain.localeCompare(b.domain) || b.createdAt - a.createdAt,
    };
    return list.sort(cmp[sort]);
  }, [searched, type, tags, sort, trash]);

  const shownTypes = TYPES.filter((t) => typeCounts.has(t.type) || t.type === type);
  const shownTags = [
    ...tags.map((t) => [t, tagFacet.find(([x]) => x === t)?.[1] ?? 0] as const),
    ...tagFacet.filter(([t]) => !tags.includes(t)),
  ];
  const filtering = !!type || tags.length > 0 || q.length > 0;
  const children = active
    ? collections.filter((c) => c.parentId === active.id).sort((a, b) => a.createdAt - b.createdAt)
    : [];
  const sortLabel = trash ? 'Last deleted first' : SORTS.find((s) => s.sort === sort)!.label;

  const back = () => {
    Haptics.selectionAsync().catch(() => {});
    setScope(scopeParent(scope, collections));
  };
  const go = (s: BookmarkScope) => {
    Haptics.selectionAsync().catch(() => {});
    setScope(s);
  };
  const clearFilters = () => {
    Haptics.selectionAsync().catch(() => {});
    setType(null);
    setTags([]);
    setQuery('');
  };
  const confirmEmpty = () =>
    ask('Empty Trash?', `${plural(trashedCount, 'link')} will be deleted for good.`, [
      { text: 'Empty Trash', style: 'destructive', onPress: emptyTrash },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const grid = !trash && view === 'grid';
  const columns = !grid ? (desktop && !trash && view === 'cards' && listW >= 760 ? 2 : 1) : desktop ? Math.max(2, Math.floor(listW / 250)) : 2;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {/* On desktop the sidebar is the way around; only nested collections step back. */}
        {(!desktop || active?.parentId) && (
          <Pressable onPress={back} style={styles.round} hitSlop={6} accessibilityLabel="Back">
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setDrawer('jump')}
          style={({ pressed }) => [styles.switcher, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`${look.name}. Go somewhere else`}
        >
          <IconBadge icon={look.icon} color={look.color} solid size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kicker} numberOfLines={1}>
              {crumbs.length ? crumbs.map((c) => c.title).join(' / ') : 'Bookmarks'}
            </Text>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {look.name}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.ink} />
            </View>
          </View>
        </Pressable>
        {active && (
          <Pressable onPress={() => collectionMenu(active)} style={styles.round} hitSlop={6} accessibilityLabel="Collection options">
            <Feather name="more-horizontal" size={18} color={colors.ink} />
          </Pressable>
        )}
        {trash ? (
          trashedCount > 0 && (
            <Pressable onPress={confirmEmpty} style={styles.emptyBtn} hitSlop={6} accessibilityRole="button">
              <Text style={styles.emptyBtnText}>Empty</Text>
            </Pressable>
          )
        ) : (
          <Pressable
            onPress={() => setDrawer('display')}
            style={styles.round}
            hitSlop={6}
            accessibilityLabel={`Display: ${view}, ${sortLabel}`}
          >
            <Feather name="sliders" size={17} color={colors.ink} />
          </Pressable>
        )}
      </View>

      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${look.name.toLowerCase()}`}
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

      {!trash && (
        <View style={styles.filterRow}>
          <FilterButton
            title="Type"
            icon="filter"
            count={shownTypes.length}
            onOpen={() => setDrawer('type')}
            picked={
              type
                ? {
                    label: typeInfo(type).label,
                    lead: <PickedLead color={typeInfo(type).color} icon={typeInfo(type).icon} />,
                    onClear: () => setType(null),
                  }
                : undefined
            }
          />
          <FilterButton
            title="Tags"
            icon="hash"
            count={shownTags.length}
            onOpen={() => setDrawer('tags')}
            picked={
              tags.length > 0
                ? {
                    label: `#${tags[0]}${tags.length > 1 ? ` +${tags.length - 1}` : ''}`,
                    lead: <PickedLead color={TAG_COLOR} icon="hash" />,
                    onClear: () => setTags([]),
                  }
                : undefined
            }
          />
        </View>
      )}

      <FlatList
        key={trash ? 'trash' : `${view}-${columns}`}
        data={shown}
        keyExtractor={(b) => b.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? (grid && columns === 2 ? styles.gridRow : styles.gridRowWide) : undefined}
        onLayout={(e) => setListW(e.nativeEvent.layout.width)}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottom }, !trash && view === 'grid' && { gap: 10 }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <BookmarkItem
            b={item}
            view={trash ? 'list' : view}
            columns={columns}
            // Say where a link lives when that isn't obvious from where you are.
            collection={
              item.collectionId && !(active && item.collectionId === active.id) && scope !== 'unsorted'
                ? byId.get(item.collectionId)
                : undefined
            }
            onOpen={() => (trash ? trashMenu(item) : open(item))}
            onMenu={() => (trash ? trashMenu(item) : bookmarkMenu(item))}
            onToggleFavorite={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggleFavorite(item.id);
            }}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHead}>
            {active && (
              <View style={styles.inside}>
                {children.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => go({ collectionId: c.id })}
                    onLongPress={() => collectionMenu(c)}
                    style={({ pressed }) => [styles.folder, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.title}, ${plural(counts.get(c.id) ?? 0, 'link')}`}
                  >
                    <IconBadge icon={c.icon} color={c.color} solid size={30} />
                    <Text style={styles.folderText} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <Text style={styles.folderCount}>{counts.get(c.id) ?? 0}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => router.push({ pathname: '/collection', params: { parentId: active.id } })}
                  style={({ pressed }) => [styles.folder, styles.folderNew, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`New collection inside ${active.title}`}
                >
                  <Feather name="folder-plus" size={16} color={colors.forest} />
                  <Text style={[styles.folderText, { color: colors.forest }]}>
                    {children.length ? 'New' : 'New collection inside'}
                  </Text>
                </Pressable>
              </View>
            )}
            {(shown.length > 0 || filtering) && (
              <View style={styles.resultRow}>
                <Text style={styles.count}>
                  {plural(shown.length, 'link')} · {sortLabel}
                </Text>
                {filtering && (
                  <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)}>
                    <Pressable onPress={clearFilters} hitSlop={8} style={styles.clear} accessibilityRole="button">
                      <Feather name="x" size={12} color={colors.forest} />
                      <Text style={styles.clearText}>Clear filters</Text>
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Squirrel size={84} />
            <Text style={styles.emptyTitle}>
              {filtering ? 'Nothing matches' : trash ? 'Trash is empty' : 'No links here yet'}
            </Text>
            <Text style={styles.emptyText}>
              {filtering
                ? 'Try another search, type or tag.'
                : trash
                  ? 'Links you delete wait here, so you can bring them back.'
                  : desktop
                    ? 'Copy a link anywhere, then click + Add bookmark.'
                    : 'Copy a link anywhere, then tap + on the dock.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          shown.length > 0 ? (
            <Text style={styles.hint}>
              {trash
                ? 'Tap a link to restore it or delete it for good.'
                : desktop
                  ? 'Click to open. Right-click for more.'
                  : 'Tap to open. Hold for more.'}
            </Text>
          ) : undefined
        }
      />

      {drawer === 'jump' && (
        <BottomDrawer
          title="Go to"
          subtitle={`${plural(live.length, 'link')} in ${plural(collections.length, 'collection')}`}
          onClosed={() => setDrawer(null)}
          headerRight={(close) => (
            <Pressable
              onPress={() => close(() => router.push('/collection'))}
              style={styles.newBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="New collection"
            >
              <Feather name="plus" size={15} color={colors.onHoney} />
              <Text style={styles.newText}>New</Text>
            </Pressable>
          )}
        >
          {(close) => {
            // Move once the drawer has slid away, so the new page arrives on a clear screen.
            const to = (s: BookmarkScope) => close(() => setScope(s));
            const isScope = (s: BookmarkScope) =>
              typeof s === 'string' ? scope === s : typeof scope !== 'string' && scope.collectionId === s.collectionId;
            const sys = (['all', 'unsorted', 'favorites', 'trash'] as const).map((k) => ({
              k,
              n:
                k === 'all'
                  ? live.length
                  : k === 'unsorted'
                    ? live.filter((b) => !b.collectionId).length
                    : k === 'favorites'
                      ? live.filter((b) => b.favorite).length
                      : trashedCount,
            }));
            return (
              <>
                <OptionRow
                  lead={<IconBadge icon="home" color={colors.forest} />}
                  label="Bookmarks home"
                  meta="Your collections at a glance"
                  selected={false}
                  onPress={() => to('home')}
                />
                {sys.map(({ k, n }) => (
                  <OptionRow
                    key={k}
                    lead={<IconBadge icon={SYSTEM[k].icon} color={SYSTEM[k].color} />}
                    label={SYSTEM[k].name}
                    meta={plural(n, 'link')}
                    selected={isScope(k)}
                    onPress={() => to(k)}
                  />
                ))}
                <DrawerSection title="My collections" />
                {flattenCollections(collections).map(({ collection: c, depth }) => (
                  <OptionRow
                    key={c.id}
                    indent={depth}
                    lead={<IconBadge icon={c.icon} color={c.color} solid size={depth ? 34 : 40} />}
                    label={c.title}
                    meta={plural(counts.get(c.id) ?? 0, 'link')}
                    selected={isScope({ collectionId: c.id })}
                    onPress={() => to({ collectionId: c.id })}
                    onLongPress={() => close(() => collectionMenu(c))}
                  />
                ))}
                {collections.length === 0 && (
                  <Text style={styles.drawerNote}>No collections yet. Tap New to start one.</Text>
                )}
              </>
            );
          }}
        </BottomDrawer>
      )}

      {drawer === 'type' && (
        <PickerDrawer
          title="Type"
          subtitle={`What kind of link, in ${look.name.toLowerCase()}`}
          allLabel="All types"
          allMeta={plural([...typeCounts.values()].reduce((a, b) => a + b, 0), 'link')}
          allIcon="box"
          options={shownTypes.map((t) => ({
            key: t.type,
            label: t.label,
            meta: plural(typeCounts.get(t.type) ?? 0, 'link'),
            lead: <IconBadge icon={t.icon} color={t.color} />,
          }))}
          selected={type}
          onSelect={(k) => setType(k as BookmarkType | null)}
          onClosed={() => setDrawer(null)}
        />
      )}

      {drawer === 'tags' && (
        <BottomDrawer
          title="Tags"
          subtitle="Pick several to narrow down: links need every one"
          onClosed={() => setDrawer(null)}
          headerRight={() =>
            tags.length > 0 ? (
              <Pressable onPress={() => setTags([])} style={styles.newBtn} hitSlop={6} accessibilityRole="button">
                <Text style={styles.newText}>Clear</Text>
              </Pressable>
            ) : null
          }
          footer={(close) => (
            <Pressable
              onPress={() => close()}
              style={({ pressed }) => [styles.showBtn, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
            >
              <Text style={styles.showText}>Show {plural(shown.length, 'link')}</Text>
            </Pressable>
          )}
        >
          {() => (
            <>
              {shownTags.map(([t, n]) => {
                const on = tags.includes(t);
                return (
                  <OptionRow
                    key={t}
                    multi
                    lead={<IconBadge icon="hash" color={TAG_COLOR} />}
                    label={t}
                    meta={plural(n, 'link')}
                    selected={on}
                    onPress={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  />
                );
              })}
              {shownTags.length === 0 && (
                <Text style={styles.drawerNote}>No tags here yet. Add some when you save a link.</Text>
              )}
            </>
          )}
        </BottomDrawer>
      )}

      {drawer === 'display' && (
        <BottomDrawer
          title="Display"
          subtitle="How links are laid out and ordered"
          onClosed={() => setDrawer(null)}
          footer={(close) => (
            <Pressable onPress={() => close()} style={styles.showBtn} accessibilityRole="button">
              <Text style={styles.showText}>Done</Text>
            </Pressable>
          )}
        >
          {() => (
            <>
              <DrawerSection title="View" />
              <View style={styles.views}>
                {VIEWS.map((v) => {
                  const on = v.view === view;
                  return (
                    <Pressable
                      key={v.view}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setView(v.view);
                      }}
                      style={[styles.viewCard, on && styles.viewCardOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Feather name={v.icon} size={22} color={on ? colors.cream : colors.ink} />
                      <Text style={[styles.viewText, on && { color: colors.cream }]}>{v.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <DrawerSection title="Sort by" />
              {SORTS.map((s) => (
                <OptionRow
                  key={s.sort}
                  lead={<IconBadge icon={s.icon} color={colors.forest} />}
                  label={s.label}
                  selected={s.sort === sort}
                  onPress={() => setSort(s.sort)}
                />
              ))}
            </>
          )}
        </BottomDrawer>
      )}
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switcher: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flexShrink: 1, fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: colors.ink },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },

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
  filterRow: { flexDirection: 'row', gap: 10 },

  list: { flex: 1, marginHorizontal: -20 },
  listContent: { paddingHorizontal: 20, paddingTop: 2, gap: 10 },
  gridRow: { justifyContent: 'space-between' },
  gridRowWide: { gap: 12 },
  listHead: { gap: 10 },
  inside: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  folder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    maxWidth: '100%',
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 21,
    backgroundColor: colors.surface,
  },
  folderNew: { paddingLeft: 14, backgroundColor: colors.sageSoft },
  folderText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  folderCount: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 26,
    paddingHorizontal: 4,
  },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.sageSoft,
  },
  clearText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.forest },
  empty: { alignItems: 'center', paddingTop: 36, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 },

  // Drawers
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.honey,
  },
  newText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onHoney },
  drawerNote: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  showBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.cream },
  views: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  viewCard: {
    flex: 1,
    height: 76,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewCardOn: { backgroundColor: colors.forest },
  viewText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  }),
);
