import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { uid } from '@/lib/format';
import type { ImportedLink } from '@/lib/importBookmarks';
import { domainOf, guessType } from '@/lib/linkPreview';
import { deviceStorage } from './storage';

export type BookmarkType = 'link' | 'article' | 'video' | 'image' | 'document';

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  /** Preview image (og:image). */
  cover?: string;
  /** Site icon. */
  icon?: string;
  domain: string;
  type: BookmarkType;
  /** No collection = Unsorted. */
  collectionId?: string;
  tags: string[];
  favorite: boolean;
  note: string;
  createdAt: number;
  openedAt?: number;
  /** Set when moved to Trash; restoring clears it. */
  deletedAt?: number;
};

/** A named group of bookmarks. Collections nest through `parentId`. */
export type Collection = {
  id: string;
  title: string;
  color: string;
  icon: CollectionIcon;
  parentId?: string;
  createdAt: number;
};

export const COLLECTION_ICONS = [
  'folder',
  'book-open',
  'code',
  'film',
  'music',
  'shopping-bag',
  'coffee',
  'map-pin',
  'heart',
  'briefcase',
  'globe',
  'camera',
  'tool',
  'feather',
] as const;
export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export const COLLECTION_COLORS = [
  '#1F4A36',
  '#E08A32',
  '#C7475B',
  '#3F7C9E',
  '#7A5EA8',
  '#5E9A4E',
  '#B8542E',
  '#3F9A8C',
];

export type BookmarkView = 'list' | 'cards' | 'grid';
export type BookmarkSort = 'new' | 'old' | 'title' | 'site';

/**
 * What the Bookmarks block is showing: its home page (collections), everything,
 * Unsorted, Favorites, Trash, or one collection.
 */
export type BookmarkScope = 'home' | 'all' | 'unsorted' | 'favorites' | 'trash' | { collectionId: string };

type BookmarksState = {
  bookmarks: Bookmark[];
  collections: Collection[];
  view: BookmarkView;
  sort: BookmarkSort;
  /** Not saved: the block always opens on its home page. */
  scope: BookmarkScope;
  /** Collections unfolded in the home tree. */
  openCollections: string[];
  toggleCollection: (id: string, open?: boolean) => void;
  setScope: (scope: BookmarkScope) => void;
  setView: (view: BookmarkView) => void;
  setSort: (sort: BookmarkSort) => void;
  addBookmark: (b: Omit<Bookmark, 'id' | 'createdAt' | 'favorite'> & { favorite?: boolean }) => string;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) => void;
  /** Moves to Trash. */
  removeBookmark: (id: string) => void;
  restoreBookmark: (id: string) => void;
  /** Gone for good. */
  purgeBookmark: (id: string) => void;
  emptyTrash: () => void;
  /**
   * Adds links read from a file. Links already saved (same URL, not in Trash) are left
   * alone; collections named in the file are found by name or created, nested as given.
   */
  importLinks: (links: ImportedLink[]) => { added: number; duplicates: number; collections: number };
  toggleFavorite: (id: string) => void;
  markOpened: (id: string) => void;
  addCollection: (c: Pick<Collection, 'title' | 'color' | 'icon' | 'parentId'>) => string;
  updateCollection: (id: string, patch: Partial<Pick<Collection, 'title' | 'color' | 'icon' | 'parentId'>>) => void;
  /** Bookmarks inside go to Unsorted; sub-collections move up a level. */
  removeCollection: (id: string) => void;
};

export function scopeKey(scope: BookmarkScope) {
  return typeof scope === 'string' ? scope : scope.collectionId;
}

/** Not in Trash. */
export const isLive = (b: Bookmark) => !b.deletedAt;

/** Where "back" goes from a scope: a collection's parent, otherwise home. */
export function scopeParent(scope: BookmarkScope, collections: Collection[]): BookmarkScope {
  if (typeof scope === 'string') return 'home';
  const parentId = collections.find((c) => c.id === scope.collectionId)?.parentId;
  return parentId ? { collectionId: parentId } : 'home';
}

/** A collection and its parents, outermost first. */
export function collectionPath(collections: Collection[], id: string | undefined) {
  const path: Collection[] = [];
  let cur = id ? collections.find((c) => c.id === id) : undefined;
  while (cur && path.length < 20) {
    path.unshift(cur);
    cur = cur.parentId ? collections.find((c) => c.id === cur!.parentId) : undefined;
  }
  return path;
}

/** Ids of `id` and every collection nested under it. */
export function collectionSubtree(collections: Collection[], id: string) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of collections) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Every collection in tree order with its depth (for pickers). */
export function flattenCollections(
  collections: Collection[],
  parentId?: string,
  depth = 0,
): { collection: Collection; depth: number }[] {
  return collections
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((c) => [{ collection: c, depth }, ...flattenCollections(collections, c.id, depth + 1)]);
}

export const useBookmarks = create<BookmarksState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      collections: [],
      view: 'list',
      sort: 'new',
      scope: 'home',
      setScope: (scope) => set({ scope }),
      openCollections: [],
      toggleCollection: (id, open) =>
        set((s) => {
          const isOpen = s.openCollections.includes(id);
          const next = open ?? !isOpen;
          if (next === isOpen) return s;
          return { openCollections: next ? [...s.openCollections, id] : s.openCollections.filter((x) => x !== id) };
        }),
      setView: (view) => set({ view }),
      setSort: (sort) => set({ sort }),
      addBookmark: (b) => {
        const id = uid();
        set((s) => ({ bookmarks: [{ favorite: false, ...b, id, createdAt: Date.now() }, ...s.bookmarks] }));
        return id;
      },
      updateBookmark: (id, patch) =>
        set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBookmark: (id) =>
        set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, deletedAt: Date.now() } : b)) })),
      restoreBookmark: (id) =>
        set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, deletedAt: undefined } : b)) })),
      purgeBookmark: (id) => set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) })),
      emptyTrash: () => set((s) => ({ bookmarks: s.bookmarks.filter(isLive) })),
      importLinks: (links) => {
        const s = get();
        const collections = [...s.collections];
        const seen = new Set(s.bookmarks.filter(isLive).map((b) => b.url));
        const added: Bookmark[] = [];
        let duplicates = 0;
        let made = 0;
        const now = Date.now();

        // Walk (or build) the collection path, matching names without regard to case.
        const collectionFor = (path: string[]) => {
          let parentId: string | undefined;
          for (const name of path) {
            let c = collections.find((x) => x.parentId === parentId && x.title.toLowerCase() === name.toLowerCase());
            if (!c) {
              c = {
                id: uid(),
                title: name,
                color: COLLECTION_COLORS[collections.length % COLLECTION_COLORS.length],
                icon: 'folder',
                parentId,
                createdAt: now + made,
              };
              collections.push(c);
              made++;
            }
            parentId = c.id;
          }
          return parentId;
        };

        links.forEach((l, i) => {
          if (seen.has(l.url)) {
            duplicates++;
            return;
          }
          seen.add(l.url);
          added.push({
            id: uid(),
            url: l.url,
            title: l.title,
            excerpt: l.excerpt,
            cover: l.cover,
            domain: domainOf(l.url),
            type: guessType(l.url),
            collectionId: collectionFor(l.path),
            tags: l.tags,
            favorite: l.favorite,
            note: l.note,
            // Files without dates keep their order: first row newest.
            createdAt: l.createdAt ?? now - i,
          });
        });

        set({ collections, bookmarks: [...added, ...s.bookmarks] });
        return { added: added.length, duplicates, collections: made };
      },
      toggleFavorite: (id) =>
        set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, favorite: !b.favorite } : b)) })),
      markOpened: (id) =>
        set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, openedAt: Date.now() } : b)) })),
      addCollection: (c) => {
        const id = uid();
        set((s) => ({ collections: [...s.collections, { ...c, id, createdAt: Date.now() }] }));
        return id;
      },
      updateCollection: (id, patch) =>
        set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCollection: (id) =>
        set((s) => {
          const gone = s.collections.find((c) => c.id === id);
          return {
            collections: s.collections
              .filter((c) => c.id !== id)
              .map((c) => (c.parentId === id ? { ...c, parentId: gone?.parentId } : c)),
            bookmarks: s.bookmarks.map((b) => (b.collectionId === id ? { ...b, collectionId: undefined } : b)),
            scope:
              typeof s.scope !== 'string' && s.scope.collectionId === id
                ? gone?.parentId
                  ? { collectionId: gone.parentId }
                  : 'home'
                : s.scope,
            openCollections: s.openCollections.filter((x) => x !== id),
          };
        }),
    }),
    {
      name: 'hani.bookmarks',
      version: 10,
      storage: deviceStorage,
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),

      partialize: ({ scope: _scope, ...rest }) => rest,
    },
  ),
);
