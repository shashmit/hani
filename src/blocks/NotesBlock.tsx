import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Squirrel } from '@/components/mascot/Squirrel';
import { ask } from '@/lib/ask';
import { relativeDay } from '@/lib/format';
import { useBlockBottom } from '@/lib/blockSpace';
import { contextMenuProps, useIsDesktop } from '@/lib/useDesktop';
import {
  flattenFolders,
  folderPath,
  folderSubtree,
  tagCounts,
  useNotes,
  type Folder,
  type Note,
} from '@/store/notes';
import { colors, fonts, isDark, themed } from '@/theme';

/**
 * Notes block: a tree of folders holding notes ("files") and more folders. Tap a folder to
 * fold it open or shut; hold anything for more. Tags cut across folders: pick one up
 * top (or search) and the tree turns into a flat list of matches.
 */
export function NotesBlock() {
  const desktop = useIsDesktop();
  const bottom = useBlockBottom();
  const { folders, notes, addFolder, addNote } = useNotes();
  const [query, setQuery] = useState('');
  const [picked, setTag] = useState<string | null>(null);
  /** Folder whose name is being typed (new or renamed). */
  const [naming, setNaming] = useState<string | null>(null);

  const tags = useMemo(() => tagCounts(notes), [notes]);
  // A tag filter lapses once no note carries that tag any more.
  const tag = picked && tags.some(([t]) => t === picked) ? picked : null;

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || tag !== null;
  const results = useMemo(() => {
    if (!filtering) return [];
    return notes
      .filter((n) => (tag ? n.tags.includes(tag) : true))
      .filter((n) => !q || [n.title, n.body, ...n.tags].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, tag, q, filtering]);

  const pinned = useMemo(
    () => notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );
  const topFolders = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );
  const looseNotes = useMemo(
    () => notes.filter((n) => !n.folderId).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  const newNote = (folderId?: string) => {
    const id = addNote({ folderId });
    router.push({ pathname: '/note/[id]', params: { id } });
  };
  const newFolder = (parentId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNaming(addFolder('New folder', parentId));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notes</Text>
          <Text style={styles.sub}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {folders.length}{' '}
            {folders.length === 1 ? 'folder' : 'folders'}
          </Text>
        </View>
        <Pressable onPress={() => newFolder()} style={styles.round} hitSlop={8} accessibilityLabel="New folder">
          <Feather name="folder-plus" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {tags.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsScroll}
            contentContainerStyle={styles.tags}
            keyboardShouldPersistTaps="handled"
          >
            {tags.map(([t, n]) => {
              const on = tag === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTag(on ? null : t);
                  }}
                  style={[styles.tag, on && styles.tagOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>#{t}</Text>
                  <Text style={[styles.tagCount, on && styles.tagTextOn]}>{n}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Renaming a folder low in the tree scrolls it clear of the keyboard. */}
      <KeyboardAwareScrollView
            bottomOffset={24}
            style={{ flex: 1 }}
            nestedScrollEnabled
            contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {filtering ? (
              <>
                <Text style={styles.section}>
                  {results.length} {results.length === 1 ? 'note' : 'notes'}
                  {tag ? ` tagged #${tag}` : ''}
                  {q ? ` matching “${query.trim()}”` : ''}
                </Text>
                {results.map((n) => (
                  <NoteRow key={n.id} note={n} depth={0} showPath />
                ))}
                {results.length === 0 && <Empty title="Nothing found" text="Try another word or tag." />}
              </>
            ) : (
              <>
                {pinned.length > 0 && (
                  <>
                    <Text style={styles.section}>Pinned</Text>
                    {pinned.map((n) => (
                      <NoteRow key={`pin-${n.id}`} note={n} depth={0} showPath />
                    ))}
                    <Text style={[styles.section, { marginTop: 18 }]}>All notes</Text>
                  </>
                )}
                {topFolders.map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    depth={0}
                    naming={naming}
                    setNaming={setNaming}
                    onNewNote={newNote}
                    onNewFolder={newFolder}
                  />
                ))}
                {looseNotes.map((n) => (
                  <NoteRow key={n.id} note={n} depth={0} />
                ))}
                {folders.length === 0 && notes.length === 0 && (
                  <Empty
                    title="No notes yet"
                    text={desktop ? 'Click + New note, or start a folder.' : 'Tap + on the dock for a note, or start a folder.'}
                  />
                )}
                <Text style={styles.footer}>
                  {desktop
                    ? 'Click a folder to open it. Right-click a folder or note for more.'
                    : 'Tap a folder to open it. Hold a folder or note for more.'}
                </Text>
              </>
            )}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Squirrel size={84} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/** Notes and folders inside a folder, counted all the way down. */
function useFolderCount(folderId: string) {
  return useNotes((s) => {
    const ids = folderSubtree(s.folders, folderId);
    return s.notes.filter((n) => n.folderId && ids.has(n.folderId)).length;
  });
}

function FolderNode({
  folder,
  depth,
  naming,
  setNaming,
  onNewNote,
  onNewFolder,
}: {
  folder: Folder;
  depth: number;
  naming: string | null;
  setNaming: (id: string | null) => void;
  onNewNote: (folderId?: string) => void;
  onNewFolder: (parentId?: string) => void;
}) {
  const { folders, notes, openFolders, toggleFolder, renameFolder, removeFolder } = useNotes();
  const open = openFolders.includes(folder.id);
  const count = useFolderCount(folder.id);
  const subfolders = folders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = notes.filter((n) => n.folderId === folder.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const isNaming = naming === folder.id;

  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, { duration: 320, dampingRatio: 0.8 }));
  }, [open, turn]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 90}deg` }] }));

  const menu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    ask(folder.name, undefined, [
      { text: 'New note here', onPress: () => onNewNote(folder.id) },
      { text: 'New folder inside', onPress: () => onNewFolder(folder.id) },
      { text: 'Rename', onPress: () => setNaming(folder.id) },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () =>
          count > 0 || subfolders.length > 0
            ? ask(
                `Delete “${folder.name}”?`,
                `Everything inside goes too: ${count} ${count === 1 ? 'note' : 'notes'}${
                  subfolders.length ? ' and its folders' : ''
                }.`,
                [
                  { text: 'Delete all', style: 'destructive', onPress: () => removeFolder(folder.id) },
                  { text: 'Cancel', style: 'cancel' },
                ],
              )
            : removeFolder(folder.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const finishNaming = (text: string) => {
    const name = text.trim();
    if (name) renameFolder(folder.id, name);
    setNaming(null);
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LinearTransition}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          toggleFolder(folder.id);
        }}
        onLongPress={menu}
        {...contextMenuProps(menu)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Folder ${folder.name}, ${count} notes`}
      >
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Animated.View>
        <View style={[styles.folderIcon, open && styles.folderIconOpen]}>
          <Feather name="folder" size={16} color={open ? colors.onHoney : colors.acornCap} />
        </View>
        {isNaming ? (
          <TextInput
            autoFocus
            defaultValue={folder.name}
            selectTextOnFocus
            onSubmitEditing={(e) => finishNaming(e.nativeEvent.text)}
            onEndEditing={(e) => finishNaming(e.nativeEvent.text)}
            returnKeyType="done"
            style={[styles.folderName, styles.nameInput]}
          />
        ) : (
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
        )}
        <Text style={styles.count}>{count}</Text>
        <Pressable
          onPress={() => onNewNote(folder.id)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={`New note in ${folder.name}`}
        >
          <Feather name="plus" size={15} color={colors.ink} />
        </Pressable>
      </Pressable>

      {open && (
        <View style={styles.children}>
          {subfolders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              naming={naming}
              setNaming={setNaming}
              onNewNote={onNewNote}
              onNewFolder={onNewFolder}
            />
          ))}
          {files.map((n) => (
            <NoteRow key={n.id} note={n} depth={depth + 1} />
          ))}
          {subfolders.length === 0 && files.length === 0 && (
            <Animated.Text entering={FadeIn} style={styles.emptyFolder}>
              Empty folder
            </Animated.Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function NoteRow({ note, depth, showPath }: { note: Note; depth: number; showPath?: boolean }) {
  const { folders, updateNote, removeNote } = useNotes();
  const path = showPath ? folderPath(folders, note.folderId).map((f) => f.name) : [];
  const firstLine = note.body.split('\n').find((l) => l.trim()) ?? '';

  const moveTo = () =>
    ask('Move to', note.title || 'Untitled', [
      { text: 'Top level', onPress: () => updateNote(note.id, { folderId: undefined }) },
      ...flattenFolders(folders)
        .filter(({ folder }) => folder.id !== note.folderId)
        .map(({ folder }) => ({
          text: folderPath(folders, folder.id)
            .map((f) => f.name)
            .join(' / '),
          onPress: () => updateNote(note.id, { folderId: folder.id }),
        })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const menu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    ask(note.title || 'Untitled', undefined, [
      { text: note.pinned ? 'Unpin' : 'Pin to top', onPress: () => updateNote(note.id, { pinned: !note.pinned }) },
      { text: 'Move to…', onPress: moveTo },
      { text: 'Delete note', style: 'destructive', onPress: () => removeNote(note.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LinearTransition}>
      <Pressable
        onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
        onLongPress={menu}
        {...contextMenuProps(menu)}
        style={({ pressed }) => [styles.row, styles.noteRow, depth === 0 && styles.noteTop, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Note ${note.title || 'Untitled'}`}
      >
        <View style={styles.fileIcon}>
          <Feather name="file-text" size={15} color={colors.inkSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.noteTitleRow}>
            <Text style={[styles.noteTitle, !note.title && styles.untitled]} numberOfLines={1}>
              {note.title || 'Untitled'}
            </Text>
            {note.pinned && <Feather name="bookmark" size={12} color={colors.acorn} />}
          </View>
          <Text style={styles.noteMeta} numberOfLines={1}>
            {path.length > 0 ? `${path.join(' / ')} · ` : ''}
            {relativeDay(note.updatedAt)}
            {firstLine ? ` · ${firstLine}` : ''}
          </Text>
          {note.tags.length > 0 && (
            <View style={styles.noteTags}>
              {note.tags.slice(0, 4).map((t) => (
                <Text key={t} style={styles.noteTag}>
                  #{t}
                </Text>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 12,
  },
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

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 26,
    paddingHorizontal: 18,
    height: 50,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, height: '100%' },

  tagsScroll: { flexGrow: 0, marginTop: 12, marginHorizontal: -20 },
  tags: { gap: 8, paddingHorizontal: 20 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.chip,
  },
  tagOn: { backgroundColor: colors.forest },
  tagText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  tagCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tagTextOn: { color: colors.cream },

  list: { paddingHorizontal: 0, paddingTop: 14, paddingBottom: 40 },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 8,
    borderRadius: 18,
  },
  rowPressed: { backgroundColor: isDark() ? 'rgba(243,233,216,0.07)' : 'rgba(42,29,20,0.06)' },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.honeySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderIconOpen: { backgroundColor: colors.honey },
  folderName: { flex: 1, fontFamily: fonts.displaySoft, fontSize: 16.5, color: colors.ink },
  nameInput: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, minWidth: 16, textAlign: 'right' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Contents hang off a guide line that drops from the folder's chevron.
  children: {
    marginLeft: 15,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
  },
  noteRow: { paddingVertical: 8, alignItems: 'flex-start' },
  // Top-level notes line their icon up with folder icons (past the chevron column).
  noteTop: { paddingLeft: 34 },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
  untitled: { color: colors.muted },
  noteMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  noteTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  noteTag: { fontFamily: fonts.semibold, fontSize: 12, color: colors.forest },
  emptyFolder: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.faint,
    paddingVertical: 10,
    paddingLeft: 10,
  },

  empty: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  footer: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 22 },
  }),
);
