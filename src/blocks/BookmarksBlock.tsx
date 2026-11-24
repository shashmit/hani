import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { BookmarksHome } from '@/components/bookmarks/BookmarksHome';
import { CollectionPage } from '@/components/bookmarks/CollectionPage';
import { useDialog } from '@/lib/ask';
import { useBlockActive } from '@/lib/blockSpace';
import { useIsDesktop } from '@/lib/useDesktop';
import { scopeKey, scopeParent, useBookmarks } from '@/store/bookmarks';

/**
 * Bookmarks, Raindrop-style. Opens on a home page of collections (All items, Unsorted,
 * Favorites, Trash, and your own collection tree); tap one to see its links. Back
 * (button or Android back) steps up a collection at a time, then home.
 */
export function BookmarksBlock() {
  const scope = useBookmarks((s) => s.scope);
  const collections = useBookmarks((s) => s.collections);
  const setScope = useBookmarks((s) => s.setScope);
  const onScreen = useBlockActive();
  const desktop = useIsDesktop();
  const pathname = usePathname();

  // Android back climbs out of a collection, but only while you're looking at Bookmarks.
  useEffect(() => {
    if (!onScreen || scope === 'home') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setScope(scopeParent(scope, collections));
      return true;
    });
    return () => sub.remove();
  }, [onScreen, scope, collections, setScope]);

  // Desktop: Esc does the same. Bubble phase on purpose: drawers, forms, dialogs and side
  // panels catch Esc first (capture + stopPropagation), so they close before this fires.
  useEffect(() => {
    if (!desktop || !onScreen || scope === 'home' || pathname !== '/' || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || useDialog.getState().dialog) return;
      setScope(scopeParent(scope, collections));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, onScreen, scope, collections, setScope, pathname]);

  // Desktop has the collections in the sidebar, so there is no home page: it opens on everything.
  const home = scope === 'home' && !desktop;
  useEffect(() => {
    if (desktop && scope === 'home') setScope('all');
  }, [desktop, scope, setScope]);
  return (
    <Animated.View
      // A fresh page per place: search and filters start clean in each one.
      key={scopeKey(scope)}
      entering={home ? FadeInLeft.duration(220) : FadeInRight.duration(220)}
      style={styles.page}
    >
      {home ? <BookmarksHome /> : <CollectionPage />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
