import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { Expense } from '@/store/expenses';
import { colors, fonts, isDark, themed } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const tick = () => Haptics.selectionAsync().catch(() => {});

/** 1234 → "1.2k", 62.3 → "62". Small enough to sit under a day number. */
function compact(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** The numbers behind a month: what was spent, the pace, and what's left per day. */
export function monthStats(expenses: Expense[], budget: number, year: number, month: number) {
  const now = new Date();
  const days = new Date(year, month + 1, 0).getDate();
  const current = year === now.getFullYear() && month === now.getMonth();
  const today = current ? now.getDate() : days;
  let spent = 0;
  for (const e of expenses) {
    const d = new Date(e.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month) spent += e.amount;
  }
  const left = budget - spent;
  const daysLeft = days - today + 1; // today still counts
  const average = spent / Math.max(1, today);
  return {
    current,
    spent,
    left,
    daysLeft,
    average,
    projected: average * days,
    perDayLeft: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0,
  };
}

/**
 * The month as a plan: what a day can cost for the budget to last, how the month is
 * going, and a calendar where every day shows what was spent (tinted by whether it was
 * under or over the daily pace). Tap a day for its total. The owner picks the month.
 */
export function MonthPlan({
  expenses,
  budget,
  money,
  year,
  month,
  summary = true,
}: {
  expenses: Expense[];
  /** Show the headline and figures above the calendar (off when the owner shows them itself). */
  summary?: boolean;
  /** Which month to show (month is 0-11). */
  year: number;
  month: number;
  /** The monthly budget (0 = none set). */
  budget: number;
  money: (n: number) => string;
}) {
  const now = new Date();
  const [picked, setPicked] = useState<number | null>(null);
  /** The calendar stays folded until asked for. */
  const [open, setOpen] = useState(false);

  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const current = year === now.getFullYear() && month === now.getMonth();
  const today = current ? now.getDate() : days;

  // What each day of the month cost. (A month of entries is small; no need to cache.)
  const perDay = new Array<number>(days + 1).fill(0);
  const counts = new Array<number>(days + 1).fill(0);
  let spent = 0;
  for (const e of expenses) {
    const d = new Date(e.createdAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    perDay[d.getDate()] += e.amount;
    counts[d.getDate()]++;
    spent += e.amount;
  }

  const left = budget - spent;
  const daysLeft = days - today + 1; // today still counts
  const pace = budget > 0 ? budget / days : 0;
  const perDayLeft = daysLeft > 0 ? Math.max(0, left) / daysLeft : 0;
  const average = spent / Math.max(1, today);
  const projected = average * days;
  const maxDay = Math.max(...perDay, 1);

  // Monday-first grid: blanks before day 1.
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [...new Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const tintFor = (d: number) => {
    const v = perDay[d];
    if (v <= 0) return undefined;
    if (pace > 0) {
      if (v > pace * 2) return colors.dangerSoft;
      if (v > pace) return colors.honeySoft;
      return colors.sageSoft;
    }
    // No budget: shade by how big the day was.
    return v > maxDay * 0.6 ? colors.honeySoft : colors.sageSoft;
  };

  const shown = picked ?? (current ? now.getDate() : null);
  const shownDate = shown ? new Date(year, month, shown) : null;

  let headline: string;
  let detail: string;
  if (budget <= 0) {
    headline = money(spent);
    detail = current ? 'spent so far. Set a budget to get a daily plan.' : 'spent that month.';
  } else if (current) {
    headline = money(perDayLeft);
    detail =
      left < 0
        ? `a day: the budget is used up, with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go.`
        : `a day keeps you on budget for the ${daysLeft === 1 ? 'last day' : `${daysLeft} days left`}.`;
  } else {
    headline = money(Math.abs(left));
    detail = left >= 0 ? 'left over that month.' : 'over budget that month.';
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {summary && (
          <>
            <View style={styles.plan}>
              <Text style={styles.planValue} numberOfLines={1} adjustsFontSizeToFit>
                {headline}
              </Text>
              <Text style={styles.planText}>{detail}</Text>
            </View>

            <View style={styles.stats}>
              <Stat label="Spent" value={money(spent)} />
              <Stat label="A day, so far" value={money(average)} />
              {current && budget > 0 ? (
                <Stat
                  label="Heading for"
                  value={money(projected)}
                  tone={projected > budget ? 'bad' : 'good'}
                />
              ) : (
                <Stat label="Biggest day" value={money(Math.max(...perDay))} />
              )}
            </View>
          </>
        )}

        <Pressable
          onPress={() => {
            tick();
            setOpen((o) => !o);
          }}
          style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Feather name="calendar" size={15} color={colors.ink} />
          <Text style={styles.toggleText}>{open ? 'Hide calendar' : 'Day by day'}</Text>
          <View style={{ flex: 1 }} />
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.muted} />
        </Pressable>

        {open && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`b${i}`} style={styles.cell} />;
              const future = current && d > now.getDate();
              const isToday = current && d === now.getDate();
              const on = shown === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    tick();
                    setPicked(d);
                  }}
                  disabled={future}
                  style={styles.cell}
                  accessibilityRole="button"
                  accessibilityLabel={`${d}, ${perDay[d] > 0 ? money(perDay[d]) : 'nothing'} spent`}
                  accessibilityState={{ selected: on }}
                >
                  <View
                    style={[
                      styles.day,
                      { backgroundColor: tintFor(d) },
                      isToday && styles.dayToday,
                      on && styles.dayOn,
                      future && styles.dayFuture,
                    ]}
                  >
                    <Text style={[styles.dayNum, on && styles.dayNumOn]}>{d}</Text>
                    <Text style={[styles.dayAmt, on && styles.dayAmtOn]} numberOfLines={1}>
                      {perDay[d] > 0 ? compact(perDay[d]) : future ? '' : '·'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {shownDate && shown ? (
            <Animated.View key={`${month}-${shown}`} entering={FadeIn.duration(160)} style={styles.dayLine}>
              <Feather name="calendar" size={14} color={colors.muted} />
              <Text style={styles.dayLineText}>
                {shownDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.dayLineValue}>
                {perDay[shown] > 0
                  ? `${money(perDay[shown])} · ${counts[shown]} ${counts[shown] === 1 ? 'entry' : 'entries'}`
                  : 'Nothing spent'}
              </Text>
            </Animated.View>
          ) : null}

          {pace > 0 && (
            <View style={styles.legend}>
              <Dot color={colors.sageSoft} label={`Up to ${money(pace)} a day`} />
              <Dot color={colors.honeySoft} label="Over" />
              <Dot color={colors.dangerSoft} label="Double" />
            </View>
          )}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, tone === 'bad' && { color: colors.danger }, tone === 'good' && { color: isDark() ? '#9FCFA4' : colors.forest }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
    root: { gap: 8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    title: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
    switcher: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nav: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navOff: { opacity: 0.35 },
    month: { minWidth: 44, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },

    card: { backgroundColor: colors.surface, borderRadius: 30, borderCurve: 'continuous', padding: 14, gap: 12 },
    plan: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
    planValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink },
    planText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft },

    stats: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 20, paddingVertical: 10 },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    statValue: { fontFamily: fonts.displaySoft, fontSize: 16, color: colors.ink },
    statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, marginTop: 1 },

    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: colors.chip,
    },
    toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    calendar: { gap: 12 },
    week: { flexDirection: 'row', marginBottom: -6 },
    weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11.5, color: colors.faint },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, padding: 2 },
    day: { height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dayToday: { borderWidth: 2, borderColor: colors.honey },
    dayOn: { backgroundColor: colors.forest },
    dayFuture: { opacity: 0.35 },
    dayNum: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
    dayNumOn: { color: colors.cream },
    dayAmt: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, marginTop: -1 },
    dayAmtOn: { color: colors.cream, opacity: 0.85 },

    dayLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: colors.bg,
    },
    dayLineText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
    dayLineValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  }),
);
