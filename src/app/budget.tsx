import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { PillButton } from '@/components/ui/PillButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { ask } from '@/lib/ask';
import { formatMoney } from '@/lib/format';
import { placeFill, spentByPlace, useExpenses, type Place } from '@/store/expenses';
import { colors, fonts, themed } from '@/theme';

const parseAmount = (t: string) => parseFloat(t.replace(',', '.'));
const cleanAmount = (t: string) => t.replace(/[^0-9.,]/g, '');
const round2 = (n: number) => Math.round(n * 100) / 100;
const tick = () => Haptics.selectionAsync().catch(() => {});
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const LAYOUT = LinearTransition.springify().damping(19);

/**
 * Budget sheet. The month's budget sits in a forest card with a bar showing how much of
 * it is set aside for places. Below, each place is a row; tap one and it opens in place
 * for editing (or removing), and the last row adds a new one.
 */
export default function Budget() {
  const { monthlyBudget, setBudget, currency, places, expenses, addPlace, updatePlace, removePlace } =
    useExpenses();
  const [amount, setAmount] = useState(String(monthlyBudget));
  /** Which row is open for editing: a place id, 'new', or none. */
  const [editing, setEditing] = useState<string | null>(null);

  const money = (n: number) => formatMoney(n, currency);
  const symbol = formatMoney(0, currency).replace(/[\d.,\s]/g, '') || currency;
  const spent = useMemo(() => spentByPlace(expenses), [expenses]);
  const allocated = places.reduce((sum, p) => sum + p.amount, 0);

  const value = parseAmount(amount);
  const valid = Number.isFinite(value) && value >= 0;
  const budget = valid ? value : monthlyBudget;
  const free = budget - allocated;

  const open = (id: string | null) => {
    tick();
    setEditing(id);
  };

  const confirmRemove = (p: Place) =>
    ask(`Remove ${p.name}?`, 'Expenses tagged with it are kept, just untagged.', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePlace(p.id);
          setEditing(null);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const save = () => {
    if (!valid) return;
    setBudget(round2(value));
    success();
    router.back();
  };

  return (
    <Sheet
      kicker="Money"
      title="Budget"
      footer={<PillButton label="Done" icon="check" disabled={!valid} onPress={save} />}
    >
      {/* The month */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Budget for the month</Text>
            <View style={styles.amountRow}>
              <Text style={styles.symbol}>{symbol}</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(cleanAmount(t))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(255,244,223,0.4)"
                selectionColor={colors.honey}
                style={styles.amount}
                selectTextOnFocus
                accessibilityLabel="Monthly budget"
              />
            </View>
          </View>
        </View>

        {/* How the month is split: one stripe per place, the rest is free. */}
        <View style={styles.split} accessibilityLabel={`${money(allocated)} set aside for places`}>
          {places.map((p) => (
            <Animated.View key={p.id} layout={LAYOUT} style={[styles.splitPart, { flex: Math.max(p.amount, 0.0001), backgroundColor: placeFill(p) }]} />
          ))}
          {free > 0 && <Animated.View layout={LAYOUT} style={{ flex: free }} />}
        </View>
        <View style={styles.splitRow}>
          <Text style={styles.splitText}>{money(allocated)} set aside</Text>
          <Text style={[styles.splitText, free < 0 && styles.splitOver]}>
            {free < 0 ? `${money(-free)} over budget` : `${money(free)} free`}
          </Text>
        </View>

      </View>

      {/* Places */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Places</Text>
          <Text style={styles.sectionCount}>{places.length}</Text>
        </View>
        <Text style={styles.help}>
          Give a shop or habit its own slice. Tag an expense with it and it comes out of that slice.
        </Text>

        <View style={styles.card}>
          {places.map((p, i) => {
            const used = spent[p.id] ?? 0;
            const left = p.amount - used;
            const isOpen = editing === p.id;
            return (
              <Animated.View key={p.id} layout={LAYOUT} exiting={FadeOut.duration(140)}>
                {i > 0 && <View style={styles.line} />}
                {isOpen ? (
                  <PlaceEditor
                    place={p}
                    symbol={symbol}
                    onCancel={() => open(null)}
                    onRemove={() => confirmRemove(p)}
                    onSave={(d) => {
                      updatePlace(p.id, d);
                      success();
                      setEditing(null);
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => open(p.id)}
                    style={({ pressed }) => [styles.place, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}, ${money(used)} spent of ${money(p.amount)}. Tap to edit.`}
                  >
                    <View style={styles.placeTop}>
                      <View style={[styles.dot, { backgroundColor: placeFill(p) }]} />
                      <Text style={styles.placeName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[styles.placeLeft, left < 0 && { color: colors.danger }]}>
                        {left < 0 ? `${money(-left)} over` : `${money(left)} left`}
                      </Text>
                      <Feather name="edit-2" size={13} color={colors.faint} />
                    </View>
                    <ProgressBar
                      value={p.amount > 0 ? used / p.amount : 0}
                      color={left < 0 ? colors.danger : placeFill(p)}
                      track={colors.chip}
                      height={6}
                    />
                    <Text style={styles.placeMeta}>
                      {money(used)} spent of {money(p.amount)}
                    </Text>
                  </Pressable>
                )}
              </Animated.View>
            );
          })}

          <Animated.View layout={LAYOUT}>
            {places.length > 0 && <View style={styles.line} />}
            {editing === 'new' ? (
              <PlaceEditor
                symbol={symbol}
                onCancel={() => open(null)}
                onSave={(d) => {
                  addPlace(d);
                  success();
                  setEditing(null);
                }}
              />
            ) : (
              <Pressable
                onPress={() => open('new')}
                style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.addIcon}>
                  <Feather name="plus" size={16} color={colors.onHoney} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addText}>Add a place</Text>
                  {places.length === 0 && <Text style={styles.placeMeta}>The shops and spots you spend at most</Text>}
                </View>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </View>
    </Sheet>
  );
}

/** A place row opened up for typing: name, amount, and what to do with it. */
function PlaceEditor({
  place,
  symbol,
  onSave,
  onCancel,
  onRemove,
}: {
  place?: Place;
  symbol: string;
  onSave: (d: { name: string; amount: number }) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(place?.name ?? '');
  const [amount, setAmount] = useState(place ? String(place.amount) : '');
  const value = parseAmount(amount);
  const valid = name.trim().length > 0 && Number.isFinite(value) && value > 0;
  const submit = () => valid && onSave({ name: name.trim(), amount: round2(value) });

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.editor}>
      <View style={styles.inputs}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Place, e.g. FreshMart"
          placeholderTextColor={colors.faint}
          style={[styles.input, { flex: 1 }]}
          autoFocus
          returnKeyType="next"
          accessibilityLabel="Place name"
        />
        <View style={[styles.input, styles.amountBox]}>
          <Text style={styles.amountSymbol}>{symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(cleanAmount(t))}
            placeholder="0"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={styles.amountField}
            onSubmitEditing={submit}
            accessibilityLabel="Amount for this place"
          />
        </View>
      </View>
      <View style={styles.actions}>
        {onRemove && (
          <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Remove place">
            <Feather name="trash-2" size={16} color={colors.danger} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <PillButton label="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        <PillButton label={place ? 'Save' : 'Add place'} icon="check" size="sm" disabled={!valid} onPress={submit} />
      </View>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    hero: { backgroundColor: colors.forest, borderRadius: 32, borderCurve: 'continuous', padding: 18, gap: 12 },
    heroTop: { flexDirection: 'row', alignItems: 'center' },
    heroLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cream, opacity: 0.78 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    symbol: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, opacity: 0.7 },
    amount: { flex: 1, fontFamily: fonts.display, fontSize: 42, color: colors.cream, padding: 0, minHeight: 54 },
    split: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      gap: 2,
      backgroundColor: 'rgba(255,244,223,0.16)',
    },
    splitPart: { borderRadius: 3 },
    splitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
    splitText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.cream, opacity: 0.8 },
    splitOver: { color: '#FFB4A6', opacity: 1, fontFamily: fonts.semibold },

    section: { gap: 8 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
    sectionCount: {
      fontFamily: fonts.semibold,
      fontSize: 12.5,
      color: colors.inkSoft,
      backgroundColor: colors.chip,
      paddingHorizontal: 9,
      lineHeight: 24,
      height: 24,
      borderRadius: 12,
      overflow: 'hidden',
    },
    help: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.muted, paddingHorizontal: 4 },
    card: { backgroundColor: colors.surface, borderRadius: 30, borderCurve: 'continuous', padding: 8, marginTop: 4 },
    line: { height: 1, backgroundColor: colors.line, opacity: 0.7, marginHorizontal: 10 },
    pressed: { backgroundColor: colors.chip },

    place: { padding: 12, gap: 9, borderRadius: 22 },
    placeTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    placeName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
    placeLeft: { fontFamily: fonts.displaySoft, fontSize: 15, color: colors.ink },
    placeMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },

    addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 10, borderRadius: 22 },
    addIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.honey,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },

    editor: { padding: 8, gap: 10 },
    inputs: { flexDirection: 'row', gap: 8 },
    input: {
      height: 50,
      borderRadius: 25,
      paddingHorizontal: 16,
      backgroundColor: colors.bg,
      fontFamily: fonts.semibold,
      fontSize: 15.5,
      color: colors.ink,
    },
    amountBox: { width: 118, flexDirection: 'row', alignItems: 'center', gap: 4 },
    amountSymbol: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
    amountField: { flex: 1, fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink, padding: 0, height: '100%' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    removeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
