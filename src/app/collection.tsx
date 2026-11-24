import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PillButton } from '@/components/ui/PillButton';
import { Field, Sheet, sheetStyles } from '@/components/ui/Sheet';
import {
  COLLECTION_COLORS,
  COLLECTION_ICONS,
  collectionPath,
  collectionSubtree,
  flattenCollections,
  useBookmarks,
  type CollectionIcon,
} from '@/store/bookmarks';
import { useSettledFocus } from '@/lib/useSettledFocus';
import { colors, fonts, themed } from '@/theme';

/** New collection (optionally inside another with ?parentId=), or edit one with ?id=. */
export default function CollectionScreen() {
  const { id, parentId: parentParam } = useLocalSearchParams<{ id?: string; parentId?: string }>();
  const { collections, addCollection, updateCollection, setScope } = useBookmarks();
  const editing = id ? collections.find((c) => c.id === id) : undefined;
  const nameRef = useSettledFocus(!editing);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [color, setColor] = useState(editing?.color ?? COLLECTION_COLORS[collections.length % COLLECTION_COLORS.length]);
  const [icon, setIcon] = useState<CollectionIcon>(editing?.icon ?? 'folder');
  const [parentId, setParentId] = useState<string | undefined>(editing ? editing.parentId : parentParam);

  // Collections nest as deep as you like; one just can't go inside itself (or inside
  // anything already inside it).
  const own = editing ? collectionSubtree(collections, editing.id) : new Set<string>();
  const parents = flattenCollections(collections).filter(({ collection }) => !own.has(collection.id));
  const parentPath = collectionPath(collections, parentId);

  const valid = title.trim().length > 0;
  const save = () => {
    if (!valid) return;
    const fields = { title: title.trim(), color, icon, parentId };
    if (editing) updateCollection(editing.id, fields);
    else setScope({ collectionId: addCollection(fields) });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <Sheet
      kicker="Bookmarks"
      title={editing ? 'Edit collection' : 'New collection'}
      footer={<PillButton label={editing ? 'Save' : 'Create collection'} icon="check" disabled={!valid} onPress={save} />}
    >
      <View style={styles.nameRow}>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Feather name={icon} size={22} color={colors.cream} />
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Name, e.g. Read later"
          placeholderTextColor={colors.faint}
          style={[sheetStyles.input, { flex: 1 }]}
          ref={nameRef}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>

      <Field label="Colour">
        <View style={styles.swatches}>
          {COLLECTION_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: color === c }}
            />
          ))}
        </View>
      </Field>

      <Field label="Icon">
        <View style={styles.icons}>
          {COLLECTION_ICONS.map((name) => (
            <Pressable
              key={name}
              onPress={() => setIcon(name)}
              style={[styles.icon, icon === name && { backgroundColor: color }]}
              accessibilityLabel={`Icon ${name}`}
              accessibilityState={{ selected: icon === name }}
            >
              <Feather name={name} size={18} color={icon === name ? colors.cream : colors.ink} />
            </Pressable>
          ))}
        </View>
      </Field>

      {parents.length > 0 && (
        <Field label={parentPath.length ? `Inside ${parentPath.map((c) => c.title).join(' / ')}` : 'Inside'}>
          <View style={styles.parents}>
            <ParentRow label="My collections (top level)" icon="home" color={colors.forest} depth={0} on={!parentId} onPress={() => setParentId(undefined)} />
            {parents.map(({ collection: p, depth }) => (
              <ParentRow
                key={p.id}
                label={p.title}
                icon={p.icon}
                color={p.color}
                depth={depth + 1}
                on={parentId === p.id}
                onPress={() => setParentId(p.id)}
              />
            ))}
          </View>
        </Field>
      )}
    </Sheet>
  );
}

function ParentRow({
  label,
  icon,
  color,
  depth,
  on,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  depth: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[styles.parentRow, { marginLeft: depth * 18 }, on && styles.parentRowOn]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
    >
      <View style={[styles.parentIcon, { backgroundColor: on ? colors.cream : color }]}>
        <Feather name={icon} size={13} color={on ? color : colors.cream} />
      </View>
      <Text style={[styles.parentText, on && { color: colors.cream }]} numberOfLines={1}>
        {label}
      </Text>
      {on && <Feather name="check" size={16} color={colors.cream} />}
    </Pressable>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  parents: { gap: 4 },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 8,
    paddingRight: 14,
    borderRadius: 23,
    backgroundColor: colors.surface,
  },
  parentRowOn: { backgroundColor: colors.forest },
  parentIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  parentText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  swatchOn: { borderWidth: 3, borderColor: colors.surface, outlineWidth: 2, outlineColor: colors.ink },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  }),
);
