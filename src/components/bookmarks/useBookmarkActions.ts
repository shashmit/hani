import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Share } from 'react-native';

import { ask } from '@/lib/ask';
import { relativeDay } from '@/lib/format';
import { openLink } from '@/lib/openLink';
import {
  collectionPath,
  collectionSubtree,
  flattenCollections,
  isLive,
  useBookmarks,
  type Bookmark,
  type Collection,
} from '@/store/bookmarks';
import { plural } from './meta';

/**
 * What you can do to a bookmark or a collection (open, hold menus, trash), shared by the
 * Bookmarks home page and the collection pages so both behave the same.
 */
export function useBookmarkActions() {
  const {
    bookmarks,
    collections,
    setScope,
    toggleFavorite,
    updateBookmark,
    removeBookmark,
    restoreBookmark,
    purgeBookmark,
    markOpened,
    removeCollection,
  } = useBookmarks();

  /** Live links per collection, counting everything nested inside it. */
  const counts = useMemo(() => {
    const live = bookmarks.filter(isLive);
    const map = new Map<string, number>();
    for (const c of collections) {
      const ids = collectionSubtree(collections, c.id);
      map.set(c.id, live.filter((b) => b.collectionId && ids.has(b.collectionId)).length);
    }
    return map;
  }, [bookmarks, collections]);

  const pathOf = (c: Collection) =>
    collectionPath(collections, c.id)
      .map((x) => x.title)
      .join(' / ');

  const open = (b: Bookmark) => {
    markOpened(b.id);
    openLink(b.url);
  };

  const heavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

  const moveTo = (b: Bookmark) =>
    ask('Move to', b.title, [
      ...(b.collectionId ? [{ text: 'Unsorted', onPress: () => updateBookmark(b.id, { collectionId: undefined }) }] : []),
      ...flattenCollections(collections)
        .filter(({ collection }) => collection.id !== b.collectionId)
        .map(({ collection }) => ({
          text: pathOf(collection),
          onPress: () => updateBookmark(b.id, { collectionId: collection.id }),
        })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const bookmarkMenu = (b: Bookmark) => {
    heavy();
    ask(b.title, b.domain, [
      { text: 'Open', onPress: () => open(b) },
      { text: b.favorite ? 'Remove from favorites' : 'Add to favorites', onPress: () => toggleFavorite(b.id) },
      { text: 'Edit', onPress: () => router.push({ pathname: '/add-bookmark', params: { id: b.id } }) },
      { text: 'Move to…', onPress: () => moveTo(b) },
      {
        text: 'Copy link',
        onPress: () => {
          Clipboard.setStringAsync(b.url).catch(() => {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
      },
      { text: 'Share…', onPress: () => Share.share({ message: b.url, url: b.url }).catch(() => {}) },
      { text: 'Move to Trash', style: 'destructive', onPress: () => removeBookmark(b.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /** A link in Trash: bring it back, or delete it for good. */
  const trashMenu = (b: Bookmark) => {
    heavy();
    ask(b.title, b.deletedAt ? `Deleted ${relativeDay(b.deletedAt).toLowerCase()}` : b.domain, [
      {
        text: 'Restore',
        onPress: () => {
          restoreBookmark(b.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
      },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: () =>
          ask('Delete forever?', `${b.title} can't be brought back.`, [
            { text: 'Delete', style: 'destructive', onPress: () => purgeBookmark(b.id) },
            { text: 'Cancel', style: 'cancel' },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const collectionMenu = (c: Collection) => {
    heavy();
    const inside = collections.filter((x) => x.parentId === c.id).length;
    ask(c.title, [plural(counts.get(c.id) ?? 0, 'link'), inside ? plural(inside, 'folder') : ''].filter(Boolean).join(' · '), [
      { text: 'Open', onPress: () => setScope({ collectionId: c.id }) },
      { text: 'New collection inside', onPress: () => router.push({ pathname: '/collection', params: { parentId: c.id } }) },
      { text: 'Edit collection', onPress: () => router.push({ pathname: '/collection', params: { id: c.id } }) },
      {
        text: 'Delete collection',
        style: 'destructive',
        onPress: () =>
          ask(
            `Delete “${c.title}”?`,
            `Its links move to Unsorted${inside ? ' and the collections inside move up a level' : ''}. Nothing else is deleted.`,
            [
              { text: 'Delete', style: 'destructive', onPress: () => removeCollection(c.id) },
              { text: 'Cancel', style: 'cancel' },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { counts, pathOf, open, bookmarkMenu, trashMenu, collectionMenu };
}
