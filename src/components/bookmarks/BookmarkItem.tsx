import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { relativeDay } from '@/lib/format';
import { contextMenuProps } from '@/lib/useDesktop';
import type { Bookmark, BookmarkType, BookmarkView, Collection } from '@/store/bookmarks';
import { colors, fonts, isDark, themed } from '@/theme';

export const TYPE_ICON: Record<BookmarkType, React.ComponentProps<typeof Feather>['name']> = {
  link: 'link-2',
  article: 'file-text',
  video: 'play-circle',
  image: 'image',
  document: 'file',
};

/** Soft colour per site, so covers without an image still look distinct. */
const TINTS = ['#F3DDBE', '#DDE8CF', '#E5DAF0', '#D6E6EE', '#F2D9DC', '#E8E2D3'];
const TINTS_DARK = ['#3A2C1E', '#26321F', '#2E2638', '#1F2E35', '#362326', '#302A20'];
function tintFor(domain: string) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  const set = isDark() ? TINTS_DARK : TINTS;
  return set[h % set.length];
}

/** Site icon, or the site's first letter when it has none (or it fails to load). */
export function Favicon({ b, size = 18 }: { b: Pick<Bookmark, 'icon' | 'domain'>; size?: number }) {
  const [failed, setFailed] = useState(false);
  // No saved icon? Ask the site itself for its favicon (nobody else is told).
  const uri = b.icon ?? (b.domain.includes('.') ? `https://${b.domain}/favicon.ico` : undefined);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 4 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: colors.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.55, color: colors.onInk }}>
        {b.domain.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Preview image; falls back to a tinted tile with the site icon. */
export function Cover({
  b,
  style,
  iconSize = 28,
}: {
  b: Pick<Bookmark, 'cover' | 'icon' | 'domain' | 'type'>;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.cover, { backgroundColor: tintFor(b.domain) }, style]}>
      {b.cover && !failed ? (
        <Image source={{ uri: b.cover }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Favicon b={b} size={iconSize} />
      )}
      {b.type === 'video' && (
        <View style={styles.play}>
          <Feather name="play" size={iconSize * 0.5} color={colors.cream} />
        </View>
      )}
    </View>
  );
}

type Props = {
  b: Bookmark;
  view: BookmarkView;
  collection?: Collection;
  onOpen: () => void;
  onMenu: () => void;
  /** Cards across in the list (desktop fits more than the phone's two). */
  columns?: number;
  onToggleFavorite: () => void;
};

export function BookmarkItem({ b, view, collection, onOpen, onMenu, onToggleFavorite, columns = 1 }: Props) {
  // Equal shares of the row once there are more columns than the phone layout assumes.
  const share = { flexGrow: 0, flexShrink: 1, flexBasis: `${100 / columns}%` as const };
  const meta = (
    <View style={styles.meta}>
      {/* Without a preview image the cover already shows the site icon. */}
      {(b.cover || view === 'grid') && <Favicon b={b} size={14} />}
      <Text style={styles.metaText} numberOfLines={1}>
        {b.domain}
        {view !== 'grid' && ` · ${relativeDay(b.createdAt)}`}
      </Text>
      {collection && view !== 'grid' && (
        <View style={styles.collection}>
          <View style={[styles.dot, { backgroundColor: collection.color }]} />
          <Text style={styles.collectionText} numberOfLines={1}>
            {collection.title}
          </Text>
        </View>
      )}
    </View>
  );

  const star = (
    <Pressable
      onPress={onToggleFavorite}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={b.favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Feather name="star" size={17} color={b.favorite ? colors.honeyDeep : colors.faint} />
    </Pressable>
  );

  const tags =
    b.tags.length > 0 ? (
      <View style={styles.tags}>
        {b.tags.slice(0, 4).map((t) => (
          <Text key={t} style={styles.tag}>
            #{t}
          </Text>
        ))}
      </View>
    ) : null;

  const press = {
    onPress: onOpen,
    onLongPress: onMenu,
    ...contextMenuProps(onMenu),
    accessibilityRole: 'link' as const,
    accessibilityLabel: `${b.title}, ${b.domain}`,
    accessibilityHint: 'Opens the link. Hold for more.',
  };

  if (view === 'grid') {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LinearTransition} style={columns > 2 ? share : styles.gridCell}>
        <Pressable {...press} style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}>
          <Cover b={b} style={styles.gridCover} />
          <View style={styles.gridBody}>
            <Text style={styles.gridTitle} numberOfLines={2}>
              {b.title}
            </Text>
            <View style={styles.gridFoot}>
              {meta}
              {b.favorite && <Feather name="star" size={13} color={colors.honeyDeep} />}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  if (view === 'cards') {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LinearTransition} style={columns > 1 ? share : undefined}>
        <Pressable {...press} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <Cover b={b} style={styles.cardCover} iconSize={40} />
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {b.title}
              </Text>
              {star}
            </View>
            {b.excerpt ? (
              <Text style={styles.excerpt} numberOfLines={2}>
                {b.excerpt}
              </Text>
            ) : null}
            {b.note ? (
              <Text style={styles.note} numberOfLines={2}>
                {b.note}
              </Text>
            ) : null}
            {tags}
            {meta}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LinearTransition}>
      <Pressable {...press} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Cover b={b} style={styles.thumb} iconSize={22} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {b.title}
            </Text>
            {star}
          </View>
          {b.excerpt ? (
            <Text style={styles.excerpt} numberOfLines={1}>
              {b.excerpt}
            </Text>
          ) : null}
          {tags}
          {meta}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(42,29,20,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  thumb: { width: 58, height: 58, borderRadius: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  excerpt: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 3 },
  note: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSoft,
    marginTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.honey,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  tag: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    lineHeight: 22,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    overflow: 'hidden',
    color: colors.inkSoft,
    backgroundColor: colors.chip,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexShrink: 1 },
  metaText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  collection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    paddingLeft: 8,
    maxWidth: 120,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  collectionText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft },

  // Cards
  card: { borderRadius: 28, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  cardCover: { height: 150 },
  cardBody: { padding: 14, paddingTop: 12 },
  cardTitle: { flex: 1, fontFamily: fonts.displaySoft, fontSize: 17, lineHeight: 22, color: colors.ink },

  // Grid
  gridCell: { width: '48.5%' },
  gridCard: { borderRadius: 22, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  gridCover: { height: 96 },
  gridBody: { padding: 10, paddingTop: 8 },
  gridTitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.ink, minHeight: 36 },
  gridFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  }),
);
