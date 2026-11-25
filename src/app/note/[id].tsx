import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesktopPage } from '@/components/desktop/DesktopPage';
import { useIsDesktop } from '@/lib/useDesktop';
import { ask } from '@/lib/ask';
import { relativeDay } from '@/lib/format';
import { useSettledFocus } from '@/lib/useSettledFocus';
import { cleanTag, flattenFolders, folderPath, tagCounts, useNotes } from '@/store/notes';
import { colors, fonts, themed } from '@/theme';

/**
 * One note. Everything saves as you type. The path at the top shows (and changes) its
 * folder; tags sit under the title. Leaving a note with nothing in it throws it away.
 */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const desktop = useIsDesktop();
  const { notes, folders, updateNote, removeNote } = useNotes();
  const note = notes.find((n) => n.id === id);

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  // A brand-new note opens with the cursor in its title.
  const [fresh] = useState(!note?.title && !note?.body);
  const titleRef = useSettledFocus(fresh);
  const [tagDraft, setTagDraft] = useState('');
  const [tagFocus, setTagFocus] = useState(false);
  const [picking, setPicking] = useState(false);

  // Save typing a moment after it stops (and once more on the way out).
  const latest = useRef({ title, body });
  useEffect(() => {
    latest.current = { title, body };
  }, [title, body]);
  useEffect(() => {
    if (!note) return;
    if (title === note.title && body === note.body) return;
    const t = setTimeout(() => updateNote(note.id, { title, body }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);
  useEffect(
    () => () => {
      const n = useNotes.getState().notes.find((x) => x.id === id);
      if (!n) return;
      const { title: t, body: b } = latest.current;
      if (!t.trim() && !b.trim() && n.tags.length === 0) removeNote(n.id);
      else if (t !== n.title || b !== n.body) updateNote(n.id, { title: t, body: b });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const allTags = useMemo(() => tagCounts(notes).map(([t]) => t), [notes]);
  if (!note) {
    return (
      <DesktopPage ground={colors.groundNotes} block="notes" back="Notes">
        <SafeAreaView style={styles.root}>
          <Text style={styles.missing}>This note is gone.</Text>
        </SafeAreaView>
      </DesktopPage>
    );
  }

  const path = folderPath(folders, note.folderId);
  const draft = cleanTag(tagDraft);
  const suggestions = allTags.filter((t) => !note.tags.includes(t) && (!draft || t.includes(draft))).slice(0, 8);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  const addTag = (raw: string) => {
    const t = cleanTag(raw);
    setTagDraft('');
    if (!t || note.tags.includes(t)) return;
    Haptics.selectionAsync().catch(() => {});
    updateNote(note.id, { tags: [...note.tags, t] });
  };
  const removeTag = (t: string) => updateNote(note.id, { tags: note.tags.filter((x) => x !== t) });

  const menu = () =>
    ask(title || 'Untitled', undefined, [
      { text: note.pinned ? 'Unpin' : 'Pin to top', onPress: () => updateNote(note.id, { pinned: !note.pinned }) },
      {
        text: 'Delete note',
        style: 'destructive',
        onPress: () => {
          removeNote(note.id);
          router.back();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <DesktopPage
      ground={colors.groundNotes}
      block="notes"
      back="Notes"
      title={title || 'Untitled'}
      note={path.map((f) => f.name).join(' / ') || undefined}
    >
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <View style={styles.bar}>
          {/* On desktop the window's title strip already leads back. */}
          {!desktop && (
            <Pressable onPress={() => router.back()} style={styles.round} hitSlop={8} accessibilityLabel="Back to notes">
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setPicking((p) => !p)}
            style={styles.path}
            accessibilityRole="button"
            accessibilityLabel={`Folder: ${path.map((f) => f.name).join(', ') || 'top level'}. Tap to move.`}
          >
            <Feather name="folder" size={14} color={colors.acornCap} />
            <Text style={styles.pathText} numberOfLines={1}>
              {['Notes', ...path.map((f) => f.name)].join('  /  ')}
            </Text>
            <Feather name={picking ? 'chevron-up' : 'chevron-down'} size={15} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => updateNote(note.id, { pinned: !note.pinned })}
            style={[styles.round, note.pinned && styles.roundOn]}
            hitSlop={8}
            accessibilityLabel={note.pinned ? 'Unpin' : 'Pin to top'}
          >
            <Feather name="bookmark" size={17} color={note.pinned ? colors.cream : colors.ink} />
          </Pressable>
          <Pressable onPress={menu} style={styles.round} hitSlop={8} accessibilityLabel="More">
            <Feather name="more-horizontal" size={18} color={colors.ink} />
          </Pressable>
        </View>

        {picking && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.picker}>
            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
              {[{ id: undefined, name: 'Top level', depth: 0 }, ...flattenFolders(folders).map(({ folder, depth }) => ({ id: folder.id as string | undefined, name: folder.name, depth: depth + 1 }))].map(
                (f) => {
                  const here = f.id === note.folderId;
                  return (
                    <Pressable
                      key={f.id ?? 'top'}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        updateNote(note.id, { folderId: f.id });
                        setPicking(false);
                      }}
                      style={[styles.pickRow, { paddingLeft: 14 + f.depth * 18 }, here && styles.pickRowOn]}
                    >
                      <Feather name={f.id ? 'folder' : 'home'} size={15} color={here ? colors.cream : colors.acornCap} />
                      <Text style={[styles.pickText, here && { color: colors.cream }]}>{f.name}</Text>
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Keeps the line you're typing above the keyboard (and above the word count
            riding on top of it), however long the note gets. */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bottomOffset={56}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.faint}
            style={styles.title}
            multiline
            ref={titleRef}
            submitBehavior="submit"
            returnKeyType="next"
          />

          <Animated.View layout={LinearTransition} style={styles.tags}>
            {note.tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => removeTag(t)}
                style={styles.tag}
                accessibilityLabel={`Tag ${t}, tap to remove`}
              >
                <Text style={styles.tagText}>#{t}</Text>
                <Feather name="x" size={12} color={colors.forestInk} />
              </Pressable>
            ))}
            <TextInput
              value={tagDraft}
              onChangeText={(t) => (/[,\s]$/.test(t) ? addTag(t) : setTagDraft(t))}
              onSubmitEditing={() => addTag(tagDraft)}
              onFocus={() => setTagFocus(true)}
              onBlur={() => {
                setTagFocus(false);
                if (tagDraft.trim()) addTag(tagDraft);
              }}
              placeholder={note.tags.length ? '+ tag' : '+ Add tags'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              submitBehavior="submit"
              returnKeyType="done"
              style={styles.tagInput}
            />
          </Animated.View>
          {tagFocus && suggestions.length > 0 && (
            <Animated.View entering={FadeIn.duration(140)} style={styles.suggest}>
              {suggestions.map((t) => (
                <Pressable key={t} onPress={() => addTag(t)} style={styles.suggestTag}>
                  <Text style={styles.suggestText}>#{t}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Start writing…"
            placeholderTextColor={colors.faint}
            style={styles.body}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </KeyboardAwareScrollView>

        <KeyboardStickyView>
          <Text style={styles.meta}>
            Edited {relativeDay(note.updatedAt).toLowerCase()} · {words} {words === 1 ? 'word' : 'words'}
          </Text>
        </KeyboardStickyView>
      </View>
    </SafeAreaView>
    </DesktopPage>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.groundNotes },
  missing: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 80 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOn: { backgroundColor: colors.forest },
  path: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: colors.chip,
  },
  pathText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.inkSoft },
  picker: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 6,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingRight: 14, marginHorizontal: 6, borderRadius: 16 },
  pickRowOn: { backgroundColor: colors.forest },
  pickText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },

  page: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 40 },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    padding: 0,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: colors.sageSoft,
  },
  tagText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  tagInput: {
    minWidth: 90,
    height: 30,
    paddingVertical: 0,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.ink,
  },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestTag: { height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.chip, justifyContent: 'center' },
  suggestText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },
  body: {
    marginTop: 18,
    minHeight: 300,
    fontFamily: fonts.regular,
    fontSize: 16.5,
    lineHeight: 25,
    color: colors.ink,
    padding: 0,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 8,
    // Floats over the page while the keyboard is up.
    backgroundColor: colors.groundNotes,
  },
  }),
);
