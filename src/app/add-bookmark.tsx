import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Cover } from '@/components/bookmarks/BookmarkItem';
import { PillButton } from '@/components/ui/PillButton';
import { Chip, Field, Sheet, sheetStyles } from '@/components/ui/Sheet';
import { domainOf, fetchPreview, guessType, normalizeUrl, type LinkPreview } from '@/lib/linkPreview';
import { useSettledFocus } from '@/lib/useSettledFocus';
import { flattenCollections, useBookmarks } from '@/store/bookmarks';
import { cleanTag, tagCounts } from '@/store/notes';
import { colors, fonts, themed } from '@/theme';

/**
 * Save a link (or edit one with ?id=). A link already on the clipboard is filled in;
 * the page's own title, description and image are read in as a preview.
 */
export default function AddBookmark() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { bookmarks, collections, scope, addBookmark, updateBookmark } = useBookmarks();
  const editing = id ? bookmarks.find((b) => b.id === id) : undefined;

  const [url, setUrl] = useState(editing?.url ?? '');
  // Straight into the link field, unless one was pasted in from the clipboard first.
  const urlRef = useSettledFocus(!editing && !url);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(!!editing);
  const [preview, setPreview] = useState<LinkPreview | null>(
    editing
      ? { title: editing.title, excerpt: editing.excerpt, cover: editing.cover, icon: editing.icon, type: editing.type }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [collectionId, setCollectionId] = useState<string | undefined>(
    editing ? editing.collectionId : typeof scope === 'string' ? undefined : scope.collectionId,
  );
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [note, setNote] = useState(editing?.note ?? '');
  const [favorite, setFavorite] = useState(editing?.favorite ?? scope === 'favorites');

  const full = normalizeUrl(url);
  const duplicate = full ? bookmarks.find((b) => !b.deletedAt && b.url === full && b.id !== editing?.id) : undefined;

  // New bookmark: offer whatever link is on the clipboard.
  useEffect(() => {
    if (editing) return;
    Clipboard.getStringAsync()
      .then((text) => {
        const link = normalizeUrl(text ?? '');
        if (link && !bookmarks.some((b) => !b.deletedAt && b.url === link)) setUrl((cur) => cur || link);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read the page once the link stops changing.
  useEffect(() => {
    if (!full || (editing && full === editing.url)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetchPreview(full, ctrl.signal)
        .then((p) => {
          setPreview(p);
          if (!titleTouched) setTitle(p.title);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setPreview({ title: domainOf(full), excerpt: '', type: guessType(full) });
          if (!titleTouched) setTitle(domainOf(full));
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  const knownTags = useMemo(() => tagCounts(bookmarks).map(([t]) => t), [bookmarks]);
  const draft = cleanTag(tagDraft);
  const suggestions = knownTags.filter((t) => !tags.includes(t) && (!draft || t.includes(draft))).slice(0, 8);

  const addTag = (raw: string) => {
    const t = cleanTag(raw);
    setTagDraft('');
    if (t && !tags.includes(t)) setTags([...tags, t]);
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const link = normalizeUrl(text ?? '');
    if (link) {
      Haptics.selectionAsync().catch(() => {});
      setUrl(link);
    }
  };

  const valid = !!full;
  const save = () => {
    if (!full) return;
    const pendingTag = cleanTag(tagDraft);
    const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
    const fields = {
      url: full,
      title: title.trim() || preview?.title || domainOf(full),
      excerpt: preview?.excerpt ?? '',
      cover: preview?.cover,
      icon: preview?.icon,
      domain: domainOf(full),
      type: preview?.type ?? guessType(full),
      collectionId,
      tags: finalTags,
      note: note.trim(),
      favorite,
    };
    if (editing) updateBookmark(editing.id, fields);
    else addBookmark(fields);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const domain = full ? domainOf(full) : '';

  return (
    <Sheet
      kicker="Bookmarks"
      title={editing ? 'Edit bookmark' : 'Save a link'}
      footer={<PillButton label={editing ? 'Save changes' : 'Save bookmark'} icon="check" disabled={!valid} onPress={save} />}
    >
      <Field label="Link">
        <View style={styles.urlRow}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            placeholderTextColor={colors.faint}
            style={[sheetStyles.input, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            ref={urlRef}
            returnKeyType="done"
          />
          <Pressable onPress={paste} style={styles.paste} accessibilityRole="button" accessibilityLabel="Paste link">
            <Feather name="clipboard" size={16} color={colors.ink} />
            <Text style={styles.pasteText}>Paste</Text>
          </Pressable>
        </View>
        {url.trim().length > 0 && !full && <Text style={styles.warn}>That doesn’t look like a link yet.</Text>}
        {duplicate && (
          <Text style={styles.warn}>
            Already saved{duplicate.collectionId ? ` in ${collections.find((c) => c.id === duplicate.collectionId)?.title}` : ''}.
          </Text>
        )}
      </Field>

      {full && (
        <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={styles.preview}>
          <Cover
            b={{ cover: preview?.cover, icon: preview?.icon, domain, type: preview?.type ?? guessType(full) }}
            style={styles.previewCover}
            iconSize={36}
          />
          <View style={styles.previewBody}>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={colors.forest} />
                <Text style={styles.loadingText}>Hazel is fetching the page…</Text>
              </View>
            ) : (
              <>
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    setTitleTouched(true);
                  }}
                  placeholder="Title"
                  placeholderTextColor={colors.faint}
                  style={styles.previewTitle}
                  multiline
                />
                {preview?.excerpt ? (
                  <Text style={styles.previewExcerpt} numberOfLines={3}>
                    {preview.excerpt}
                  </Text>
                ) : null}
              </>
            )}
            <Text style={styles.previewDomain}>{domain}</Text>
          </View>
        </Animated.View>
      )}

      <Field label="Collection">
        <View style={sheetStyles.chips}>
          <Chip label="Unsorted" selected={!collectionId} onPress={() => setCollectionId(undefined)} />
          {flattenCollections(collections).map(({ collection: c, depth }) => (
            <Chip
              key={c.id}
              label={depth ? `↳ ${c.title}` : c.title}
              color={c.color}
              selected={collectionId === c.id}
              onPress={() => setCollectionId(c.id)}
            />
          ))}
          <Chip label="+ New" selected={false} onPress={() => router.push('/collection')} />
        </View>
      </Field>

      <Field label="Tags">
        <View style={styles.tags}>
          {tags.map((t) => (
            <Pressable key={t} onPress={() => setTags(tags.filter((x) => x !== t))} style={styles.tag}>
              <Text style={styles.tagText}>#{t}</Text>
              <Feather name="x" size={12} color={colors.forest} />
            </Pressable>
          ))}
          <TextInput
            value={tagDraft}
            onChangeText={(t) => (/[,\s]$/.test(t) ? addTag(t) : setTagDraft(t))}
            onSubmitEditing={() => addTag(tagDraft)}
            placeholder="Add a tag"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            submitBehavior="submit"
            style={styles.tagInput}
          />
        </View>
        {suggestions.length > 0 && (
          <View style={styles.suggest}>
            {suggestions.map((t) => (
              <Pressable key={t} onPress={() => addTag(t)} style={styles.suggestTag}>
                <Text style={styles.suggestText}>#{t}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Field>

      <Field label="Note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Why you saved it (optional)"
          placeholderTextColor={colors.faint}
          style={[sheetStyles.input, styles.note]}
          multiline
          textAlignVertical="top"
        />
      </Field>

      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setFavorite(!favorite);
        }}
        style={[styles.fav, favorite && styles.favOn]}
        accessibilityRole="switch"
        accessibilityState={{ checked: favorite }}
      >
        <Feather name="star" size={17} color={favorite ? colors.onHoney : colors.muted} />
        <Text style={[styles.favText, favorite && { color: colors.onHoney }]}>{favorite ? 'In favorites' : 'Add to favorites'}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.chip,
  },
  pasteText: { fontFamily: fonts.displaySoft, fontSize: 14.5, color: colors.ink },
  warn: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },

  preview: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 24, backgroundColor: colors.surface },
  previewCover: { width: 88, height: 88, borderRadius: 18 },
  previewBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  previewTitle: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 20, color: colors.ink, padding: 0 },
  previewExcerpt: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 3 },
  previewDomain: { fontFamily: fonts.semibold, fontSize: 12, color: colors.forest, marginTop: 5 },

  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
    backgroundColor: colors.sageSoft,
  },
  tagText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  tagInput: { flex: 1, minWidth: 100, height: 32, paddingVertical: 0, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestTag: { height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.chip, justifyContent: 'center' },
  suggestText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },
  note: { height: 92, paddingTop: 16, fontSize: 15 },
  fav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: colors.chip,
    alignSelf: 'flex-start',
  },
  favOn: { backgroundColor: colors.honey },
  favText: { fontFamily: fonts.displaySoft, fontSize: 15, color: colors.ink },
  }),
);
