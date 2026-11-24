import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { PillButton } from '@/components/ui/PillButton';
import { Chip, Field, Sheet, sheetStyles } from '@/components/ui/Sheet';
import { formatMoney } from '@/lib/format';
import { useSettledFocus } from '@/lib/useSettledFocus';
import { CATEGORIES, placeFill, spentByPlace, useExpenses, type CategoryId } from '@/store/expenses';
import { colors, fonts, themed } from '@/theme';

export default function AddExpense() {
  const { addExpense, currency, places, expenses } = useExpenses();
  const amountRef = useSettledFocus();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryId>('food');
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);

  const value = parseFloat(amount.replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0;

  const spent = useMemo(() => spentByPlace(expenses), [expenses]);
  const place = places.find((p) => p.id === placeId);
  const placeLeft = place ? place.amount - (spent[place.id] ?? 0) : 0;
  const placeAfter = placeLeft - (valid ? value : 0);
  const money = (n: number) => formatMoney(n, currency);

  const save = () => {
    if (!valid) return;
    addExpense({
      amount: Math.round(value * 100) / 100,
      title: title.trim() || place?.name || CATEGORIES[category].label,
      category,
      placeId,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <Sheet
      kicker="Money"
      title="New expense"
      footer={<PillButton label="Add expense" icon="check" disabled={!valid} onPress={save} />}
    >
      <Card color={colors.forest} padding={0} radius={30}>
        <View style={styles.amountRow}>
        <Text style={styles.currency}>{currency}</Text>
        <TextInput
          ref={amountRef}
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ''))}
          placeholder="0.00"
          placeholderTextColor="rgba(255,244,223,0.4)"
          selectionColor={colors.honey}
          keyboardType="decimal-pad"
          style={styles.amount}
        />
        </View>
      </Card>

      <Field label="What was it?">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Lunch with team"
          placeholderTextColor={colors.faint}
          style={sheetStyles.input}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </Field>

      <Field label="Category">
        <View style={sheetStyles.chips}>
          {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => (
            <Chip
              key={id}
              label={CATEGORIES[id].label}
              color={CATEGORIES[id].color}
              selected={category === id}
              onPress={() => setCategory(id)}
            />
          ))}
        </View>
      </Field>

      <Field label="Place (optional)">
        <View style={sheetStyles.chips}>
          <Chip label="None" selected={!placeId} onPress={() => setPlaceId(undefined)} />
          {places.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              color={placeFill(p)}
              selected={placeId === p.id}
              onPress={() => setPlaceId(p.id)}
            />
          ))}
          <Chip label="+ New place" selected={false} onPress={() => router.push('/budget')} />
        </View>
        {place && (
          <View style={styles.placeInfo}>
            <Text style={styles.placeInfoText}>
              {money(placeLeft)} left at {place.name}
            </Text>
            {valid && (
              <Text style={[styles.placeInfoText, styles.placeAfter, placeAfter < 0 && styles.over]}>
                {placeAfter < 0 ? `→ ${money(-placeAfter)} over` : `→ ${money(placeAfter)} after this`}
              </Text>
            )}
          </View>
        )}
      </Field>
    </Sheet>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  placeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.sageSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  placeInfoText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  placeAfter: { fontFamily: fonts.bold },
  over: { color: colors.danger },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  currency: { fontFamily: fonts.displaySoft, fontSize: 16, color: colors.cream, opacity: 0.78 },
  amount: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.cream,
    letterSpacing: -1,
    paddingVertical: 6,
  },
  }),
);
