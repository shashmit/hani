import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { relativeDay } from '@/lib/format';
import { contextMenuProps } from '@/lib/useDesktop';
import { CATEGORIES, type Expense, type Place } from '@/store/expenses';
import { fonts, themed } from '@/theme';

type Props = {
  e: Expense;
  place?: Place;
  money: (n: number) => string;
  onLongPress?: () => void;
  /** Show only the time (used when rows are already grouped by day). */
  timeOnly?: boolean;
};

export function ExpenseRow({ e, place, money, onLongPress, timeOnly }: Props) {
  const cat = CATEGORIES[e.category];
  const when = timeOnly
    ? new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : relativeDay(e.createdAt);
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
      <Pressable
        onLongPress={onLongPress}
        {...(onLongPress ? contextMenuProps(onLongPress) : {})}
        style={styles.row}
      >
        <View style={[styles.icon, { backgroundColor: cat.color + '26' }]}>
          <Feather name={cat.icon} size={17} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {e.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {place ? (
              <Text style={styles.place}>{place.name} · </Text>
            ) : (
              `${cat.label} · `
            )}
            {when}
          </Text>
        </View>
        <Text style={styles.amount}>−{money(e.amount)}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 2 },
  place: { fontFamily: fonts.semibold, color: colors.inkSoft },
  amount: { fontFamily: fonts.displaySoft, fontSize: 16, color: colors.ink },
  }),
);
