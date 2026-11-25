import type { IconName } from '@/components/ui/BottomDrawer';
import type { BookmarkScope, BookmarkSort, BookmarkType, BookmarkView, Collection } from '@/store/bookmarks';
import { colors } from '@/theme';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const VIEWS: { view: BookmarkView; icon: IconName; label: string }[] = [
  { view: 'list', icon: 'list', label: 'List' },
  { view: 'cards', icon: 'square', label: 'Cards' },
  { view: 'grid', icon: 'grid', label: 'Grid' },
];

export const SORTS: { sort: BookmarkSort; label: string; icon: IconName }[] = [
  { sort: 'new', label: 'Newest first', icon: 'arrow-down' },
  { sort: 'old', label: 'Oldest first', icon: 'arrow-up' },
  { sort: 'title', label: 'Title A–Z', icon: 'type' },
  { sort: 'site', label: 'By site', icon: 'globe' },
];

/** Kinds of link, Raindrop-style, each with its own icon and colour. */
export const TYPES: { type: BookmarkType; label: string; icon: IconName; color: string }[] = [
  { type: 'article', label: 'Articles', icon: 'file-text', color: '#3F7C9E' },
  { type: 'video', label: 'Videos', icon: 'play-circle', color: '#C7475B' },
  { type: 'image', label: 'Images', icon: 'image', color: '#7A5EA8' },
  { type: 'document', label: 'Documents', icon: 'file', color: '#B8542E' },
  { type: 'link', label: 'Links', icon: 'link-2', color: '#1F4A36' },
];
export const typeInfo = (t: BookmarkType) => TYPES.find((x) => x.type === t)!;

export const TAG_COLOR = '#B07A1E';

/** The four places every bookmark can be seen from, besides your collections. Theme colours are read live. */
export const SYSTEM: Record<
  'all' | 'unsorted' | 'favorites' | 'trash',
  { name: string; blurb: string; icon: IconName; color: string }
> = {
  all: { name: 'All items', blurb: 'Every link you saved', icon: 'layers', get color() { return colors.forest; } },
  unsorted: { name: 'Unsorted', blurb: 'Not in a collection', icon: 'inbox', color: '#7B6A5C' },
  favorites: { name: 'Favorites', blurb: 'Starred links', icon: 'star', get color() { return colors.honeyDeep; } },
  trash: { name: 'Trash', blurb: 'Deleted links', icon: 'trash-2', color: '#B5483A' },
};

/** Name, icon and colour for whatever a scope points at. */
export function scopeLook(scope: BookmarkScope, collections: Collection[]) {
  if (scope === 'home') return { name: 'Bookmarks', icon: 'bookmark' as IconName, color: colors.forest };
  if (typeof scope === 'string') return SYSTEM[scope];
  const c = collections.find((x) => x.id === scope.collectionId);
  return c
    ? { name: c.title, icon: c.icon as IconName, color: c.color }
    : { name: SYSTEM.all.name, icon: SYSTEM.all.icon, color: SYSTEM.all.color };
}
