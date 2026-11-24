import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/ExpenseRow';
import { Squirrel } from '@/components/mascot/Squirrel';
import { PanelSwipe, usePanelReveal, useSidePanel } from '@/components/SidePanel';
import { monthStats } from '@/components/MonthPlan';
import { ScrubChart, type ScrubPoint } from '@/components/ScrubChart';
import {
  BottomDrawer,
  DrawerSection,
  IconBadge,
  OptionRow,
  PickerDrawer,
  type PickerOption,
} from '@/components/ui/BottomDrawer';
import { CountUpText } from '@/components/ui/CountUpText';
import { Card } from '@/components/ui/Card';
import { ask } from '@/lib/ask';
import { dayLabel, formatMoney, isSameMonth, monthName } from '@/lib/format';
import { useIsDesktop } from '@/lib/useDesktop';
import { CATEGORIES, placeFill, useExpenses, type CategoryId, type Expense } from '@/store/expenses';
import { colors, fonts, themed } from '@/theme';

type Period = 'week' | 'month' | 'all';

/** Last seven days, today included. */
function inLastWeek(ts: number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  return ts >= start;
}

function inPeriod(ts: number, period: Period, ym: { y: number; m: number }) {
  if (period === 'week') return inLastWeek(ts);
  if (period === 'month') {
    const d = new Date(ts);
    return d.getFullYear() === ym.y && d.getMonth() === ym.m;
  }
  return true;
}

/**
 * All entries: the full expense history. Lives in the side panel to the right of home;
 * pulled in by swiping left on the Money block, pushed back by swiping right.
 *
 * Only the top bar stays put. The summary, search and filters scroll away with the list;
 * once they're gone the bar shows the total and what's filtered.
 */
export function EntriesPanel() {
  const { close, docked } = useSidePanel();
  const desktop = useIsDesktop();
  const { expenses, places, currency, monthlyBudget, removeExpense } = useExpenses();
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  /** The month the "Month" view shows; starts on this one. */
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [picking, setPicking] = useState(false);
  const thisMonth = isSameMonth(new Date(ym.y, ym.m, 1).getTime());
  const monthTitle = new Date(ym.y, ym.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Spending per month ("2026-10" → total, count), for the month calendar.
  const monthTotals = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const d = new Date(e.createdAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const cur = totals.get(k) ?? { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count++;
      totals.set(k, cur);
    }
    return totals;
  }, [expenses]);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const list = useRef<SectionList<Expense, Section>>(null);

  const money = (n: number) => formatMoney(n, currency);
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // Everything in the period that matches the search; the place and category filters
  // narrow this further. Each filter row counts against the *other* filter, so its
  // numbers say what you'd get by tapping it.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (!inPeriod(e.createdAt, period, ym)) return false;
      if (!q) return true;
      const place = e.placeId ? (placeById.get(e.placeId)?.name ?? '') : '';
      return [e.title, CATEGORIES[e.category].label, place].some((s) => s.toLowerCase().includes(q));
    });
  }, [expenses, period, ym, query, placeById]);

  const filtered = useMemo(
    () =>
      base
        .filter((e) => (placeId ? e.placeId === placeId : true))
        .filter((e) => (category ? e.category === category : true))
        .sort((a, b) => b.createdAt - a.createdAt),
    [base, placeId, category],
  );

  const placeTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of base) {
      if (!e.placeId || (category && e.category !== category)) continue;
      m.set(e.placeId, (m.get(e.placeId) ?? 0) + e.amount);
    }
    return m;
  }, [base, category]);

  const categoryCounts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    for (const e of base) {
      if (placeId && e.placeId !== placeId) continue;
      m.set(e.category, (m.get(e.category) ?? 0) + 1);
    }
    return m;
  }, [base, placeId]);

  const sections = useMemo(() => groupByDay(filtered), [filtered]);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  const place = placeId ? placeById.get(placeId) : undefined;
  const narrowed = !!placeId || !!category || query.trim().length > 0;
  const periodLabel =
    period === 'week' ? 'this week' : period === 'month' ? `in ${monthName(new Date(ym.y, ym.m, 1).getTime())}` : 'all time';
  const filterSummary = [
    period === 'week' ? 'This week' : period === 'month' ? (thisMonth ? 'This month' : monthTitle) : 'All time',
    place?.name,
    category && CATEGORIES[category].label,
  ]
    .filter(Boolean)
    .join(' · ');

  // Which filter's bottom drawer is up.
  const [drawer, setDrawer] = useState<'places' | 'categories' | null>(null);
  const openDrawer = (d: 'places' | 'categories') => {
    Haptics.selectionAsync().catch(() => {});
    setDrawer(d);
  };

  const confirmDelete = (e: Expense) =>
    ask('Delete expense?', `${e.title} · ${money(e.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExpense(e.id) },
    ]);

  // The pieces arrive one after another as the panel fades in.
  const headerStyle = usePanelReveal(0);
  const cardStyle = usePanelReveal(1);
  const searchStyle = usePanelReveal(2);
  const filtersStyle = usePanelReveal(3);

  // Only options with entries (plus the picked one, kept first), biggest first.
  const shownPlaces = places
    .filter((p) => placeTotals.has(p.id) || p.id === placeId)
    .sort(
      (a, b) =>
        Number(b.id === placeId) - Number(a.id === placeId) ||
        (placeTotals.get(b.id) ?? 0) - (placeTotals.get(a.id) ?? 0),
    );
  const shownCategories = (Object.keys(CATEGORIES) as CategoryId[])
    .filter((c) => categoryCounts.has(c) || c === category)
    .sort(
      (a, b) =>
        Number(b === category) - Number(a === category) ||
        (categoryCounts.get(b) ?? 0) - (categoryCounts.get(a) ?? 0),
    );

  const placeOptions: PickerOption[] = shownPlaces.map((p) => ({
    key: p.id,
    label: p.name,
    meta: money(placeTotals.get(p.id) ?? 0),
    lead: <View style={[styles.optionLead, { backgroundColor: placeFill(p) }]} />,
  }));
  const categoryOptions: PickerOption[] = shownCategories.map((c) => {
    const look = CATEGORIES[c];
    const n = categoryCounts.get(c) ?? 0;
    return {
      key: c,
      label: look.label,
      meta: `${n} ${n === 1 ? 'entry' : 'entries'}`,
      lead: (
        <View style={[styles.optionLead, { backgroundColor: `${look.color}22` }]}>
          <Feather name={look.icon} size={16} color={look.color} />
        </View>
      ),
    };
  });
  // "All" rows: what you get with that filter off (the other one still applies).
  const placeSum = base.filter((e) => !category || e.category === category).reduce((n, e) => n + e.amount, 0);
  const categorySum = base.filter((e) => !placeId || e.placeId === placeId).length;

  // What the glide chart draws: the days of the month, the last 7 days, or the last 12 months.
  const series = useMemo(() => {
    const now = new Date();
    const dayLabel2 = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const points: ScrubPoint[] = [];
    const slot = new Map<string, number>();
    let start = 0;
    let axis: [string, string, string];
    if (period === 'all') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        slot.set(`${d.getFullYear()}-${d.getMonth()}`, points.length);
        points.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), value: 0, count: 0 });
      }
      start = 11;
      const f = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      axis = [f.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), 'by month', 'now'];
      for (const e of filtered) {
        const d = new Date(e.createdAt);
        const i = slot.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i !== undefined) {
          points[i].value += e.amount;
          points[i].count++;
        }
      }
    } else {
      const days: Date[] = [];
      if (period === 'week') {
        for (let i = 6; i >= 0; i--) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
        start = 6;
        axis = [days[0].toLocaleDateString('en-US', { weekday: 'short' }), 'last 7 days', 'today'];
      } else {
        const n = new Date(ym.y, ym.m + 1, 0).getDate();
        for (let d = 1; d <= n; d++) days.push(new Date(ym.y, ym.m, d));
        const isNow = ym.y === now.getFullYear() && ym.m === now.getMonth();
        start = isNow ? now.getDate() - 1 : 0;
        axis = ['1', String(Math.round(n / 2)), String(n)];
      }
      days.forEach((d) => {
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        slot.set(k, points.length);
        points.push({ key: k, label: dayLabel2(d), value: 0, count: 0 });
      });
      for (const e of filtered) {
        const d = new Date(e.createdAt);
        const i = slot.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        if (i !== undefined) {
          points[i].value += e.amount;
          points[i].count++;
        }
      }
    }
    return { points, start, axis };
  }, [filtered, period, ym]);

  // The month's plan rides in the green card, as long as nothing narrows the list.
  const plan = period === 'month' && !narrowed ? monthStats(expenses, monthlyBudget, ym.y, ym.m) : null;
  const planLine = !plan
    ? ''
    : monthlyBudget <= 0
      ? 'Set a budget to get a daily plan.'
      : !plan.current
        ? plan.left >= 0
          ? `${money(plan.left)} left over that month.`
          : `${money(-plan.left)} over budget that month.`
        : plan.left < 0
          ? `Budget used up, with ${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'} to go.`
          : `${money(plan.perDayLeft)} a day keeps you on budget for ${plan.daysLeft === 1 ? 'the last day' : `the ${plan.daysLeft} days left`}.`;

  const listHeader = (
    <View style={styles.headerStack}>
      <Animated.View style={cardStyle}>
        <Card color={colors.forest} padding={20} radius={34}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                Spent {periodLabel}
                {place ? ` at ${place.name}` : ''}
                {category ? ` on ${CATEGORIES[category].label.toLowerCase()}` : ''}
              </Text>
              <View style={styles.totalRow}>
                <CountUpText value={total} format={money} style={styles.total} numberOfLines={1} adjustsFontSizeToFit />
                <Text style={styles.totalSub}>
                  {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            </View>
            <Squirrel size={54} hopSignal={`${period}-${placeId}-${category}`} />
          </View>
          {plan && <Text style={styles.planLine}>{planLine}</Text>}
          {/* Glide a finger along it to read any day (or month). */}
          <View style={{ marginTop: 16 }}>
            <ScrubChart key={`${period}-${ym.y}-${ym.m}`} points={series.points} start={series.start} axis={series.axis} money={money} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View style={[styles.search, searchStyle]}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title, place or category"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </Animated.View>

      <Animated.View style={[styles.pills, filtersStyle]}>
        <Pill
          icon="calendar"
          label={period === 'week' ? 'Last 7 days' : period === 'all' ? 'All time' : thisMonth ? `This month` : monthTitle}
          strong
          onPress={() => setPicking(true)}
        />
        <Pill
          icon="map-pin"
          label={place ? place.name : 'Place'}
          dot={place ? placeFill(place) : undefined}
          picked={!!place}
          disabled={shownPlaces.length === 0 && !place}
          onPress={() => openDrawer('places')}
          onClear={() => setPlaceId(null)}
        />
        <Pill
          icon="tag"
          label={category ? CATEGORIES[category].label : 'Category'}
          dot={category ? CATEGORIES[category].color : undefined}
          picked={!!category}
          disabled={shownCategories.length === 0 && !category}
          onPress={() => openDrawer('categories')}
          onClear={() => setCategory(null)}
        />
      </Animated.View>

    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <PanelSwipe mode="close">
        <Animated.View style={[styles.header, scrolled && styles.headerScrolled, docked && styles.flush, headerStyle]}>
          {!docked && (
            <Pressable onPress={close} style={styles.round} hitSlop={8} accessibilityLabel="Back to Money">
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </Pressable>
          )}
          <Pressable
            style={{ flex: 1 }}
            // Tapping the bar brings the filters back.
            onPress={() => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true })}
            accessibilityRole="header"
            accessibilityHint={scrolled ? 'Scrolls back to the filters' : undefined}
          >
            {scrolled ? (
              <Animated.Text
                key="sum"
                entering={FadeIn.duration(160)}
                style={styles.kickerStrong}
                numberOfLines={1}
              >
                {money(total)} · {filterSummary}
              </Animated.Text>
            ) : (
              <Animated.Text key="kicker" entering={FadeIn.duration(160)} style={styles.kicker}>
                Money
              </Animated.Text>
            )}
            <Text style={styles.title}>All entries</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/add-expense')}
            style={[styles.round, styles.add]}
            hitSlop={8}
            accessibilityLabel="Add expense"
          >
            <Feather name="plus" size={20} color={colors.onHoney} />
          </Pressable>
        </Animated.View>
      </PanelSwipe>

      <PanelSwipe mode="close" style={{ flex: 1 }}>
        <SectionList
          ref={list}
          sections={sections}
          keyExtractor={(e) => e.id}
          stickySectionHeadersEnabled={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, docked && styles.flush]}
          scrollEventThrottle={32}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 170)}
          ListHeaderComponent={listHeader}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionTotal}>{money(section.total)}</Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.item,
                index === 0 && styles.itemFirst,
                index === section.data.length - 1 && styles.itemLast,
              ]}
            >
              <ExpenseRow
                e={item}
                place={item.placeId ? placeById.get(item.placeId) : undefined}
                money={money}
                timeOnly
                onLongPress={() => confirmDelete(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Squirrel size={90} />
              <Text style={styles.emptyTitle}>No entries here</Text>
              <Text style={styles.emptyText}>
                {narrowed ? 'Try another search or filter.' : 'Nothing logged yet. Hazel is guarding the acorns.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <Text style={styles.footer}>
                {docked ? 'Right-click an entry to delete it.' : desktop ? 'Right-click to delete. Esc for Money.' : 'Hold to delete. Swipe right for Money.'}
              </Text>
            ) : undefined
          }
        />
      </PanelSwipe>

      {picking && (
        <BottomDrawer title="Show" subtitle="A stretch of time, or any month of any year" onClosed={() => setPicking(false)}>
          {(close) => (
            <>
              <OptionRow
                lead={<IconBadge icon="clock" color={colors.acorn} />}
                label="Last 7 days"
                selected={period === 'week'}
                onPress={() => {
                  setPeriod('week');
                  close();
                }}
              />
              <OptionRow
                lead={<IconBadge icon="layers" color={colors.acorn} />}
                label="All time"
                meta={`${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}`}
                selected={period === 'all'}
                onPress={() => {
                  setPeriod('all');
                  close();
                }}
              />
              <DrawerSection title="Pick a month" />
              <MonthCalendar
                selected={period === 'month' ? ym : null}
                totals={monthTotals}
                money={money}
                onPick={(y, m) => {
                  setPeriod('month');
                  setYm({ y, m });
                  close();
                }}
              />
            </>
          )}
        </BottomDrawer>
      )}

      {drawer === 'places' && (
        <PickerDrawer
          title="Places"
          subtitle={`Where you spent ${periodLabel}`}
          allLabel="All places"
          allMeta={money(placeSum)}
          allIcon="map"
          options={placeOptions}
          selected={placeId}
          onSelect={setPlaceId}
          onClosed={() => setDrawer(null)}
        />
      )}
      {drawer === 'categories' && (
        <PickerDrawer
          title="Categories"
          subtitle={`What you spent on ${periodLabel}`}
          allLabel="All categories"
          allMeta={`${categorySum} ${categorySum === 1 ? 'entry' : 'entries'}`}
          allIcon="grid"
          options={categoryOptions}
          selected={category}
          onSelect={(k) => setCategory(k as CategoryId | null)}
          onClosed={() => setDrawer(null)}
        />
      )}
    </SafeAreaView>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Month-and-year picker: step through years with the arrows, tap a month. Months with
 * entries show their total; months that haven't happened yet can't be picked.
 */
function MonthCalendar({
  selected,
  totals,
  money,
  onPick,
}: {
  selected: { y: number; m: number } | null;
  totals: Map<string, { total: number; count: number }>;
  money: (n: number) => string;
  onPick: (y: number, m: number) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(selected?.y ?? now.getFullYear());
  const go = (by: number) => {
    Haptics.selectionAsync().catch(() => {});
    setYear((y) => Math.min(now.getFullYear(), Math.max(2000, y + by)));
  };
  return (
    <View style={styles.cal}>
      <View style={styles.calHead}>
        <Pressable onPress={() => go(-1)} style={styles.calNav} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Year ${year - 1}`}>
          <Feather name="chevron-left" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.calYear} accessibilityRole="header">
          {year}
        </Text>
        <Pressable
          onPress={() => go(1)}
          disabled={year >= now.getFullYear()}
          style={[styles.calNav, year >= now.getFullYear() && { opacity: 0.35 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Year ${year + 1}`}
        >
          <Feather name="chevron-right" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.calGrid}>
        {MONTHS.map((name, m) => {
          const future = year === now.getFullYear() && m > now.getMonth();
          const on = selected?.y === year && selected.m === m;
          const isNow = year === now.getFullYear() && m === now.getMonth();
          const t = totals.get(`${year}-${m}`);
          const full = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          return (
            <View key={name} style={styles.calCell}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onPick(year, m);
                }}
                disabled={future}
                style={({ pressed }) => [
                  styles.calMonth,
                  isNow && styles.calNow,
                  on && styles.calOn,
                  future && { opacity: 0.35 },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: future }}
                accessibilityLabel={`${full}${t ? `, ${money(t.total)} spent in ${t.count} ${t.count === 1 ? 'entry' : 'entries'}` : ', no entries'}`}
              >
                <Text style={[styles.calName, on && { color: colors.cream }]}>{name}</Text>
                <Text style={[styles.calTotal, on && { color: colors.cream, opacity: 0.85 }]} numberOfLines={1}>
                  {t ? money(t.total) : future ? '' : '–'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A compact control: opens a drawer; when something is picked it fills in and gets an x to clear. */
function Pill({
  icon,
  label,
  dot,
  picked,
  strong,
  disabled,
  onPress,
  onClear,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  /** Colour dot shown in place of the icon when picked. */
  dot?: string;
  picked?: boolean;
  /** The main pill (period): always filled. */
  strong?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const on = picked || strong;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [styles.pill, on && styles.pillOn, disabled && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.96 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Opens a list to choose from.`}
    >
      {dot ? <View style={[styles.pillDot, { backgroundColor: dot }]} /> : <Feather name={icon} size={14} color={on ? colors.cream : colors.inkSoft} />}
      <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {picked && onClear ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onClear();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
        >
          <Feather name="x" size={14} color={colors.cream} />
        </Pressable>
      ) : (
        <Feather name="chevron-down" size={14} color={on ? colors.cream : colors.muted} />
      )}
    </Pressable>
  );
}

type Section = { title: string; total: number; data: Expense[] };

function groupByDay(list: Expense[]) {
  const sections: Section[] = [];
  for (const e of list) {
    const title = dayLabel(e.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(e);
      last.total += e.amount;
    } else {
      sections.push({ title, total: e.amount, data: [e] });
    }
  }
  return sections;
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerScrolled: { boxShadow: '0px 10px 18px -16px rgba(42,29,20,0.5)' },
  kicker: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  kickerStrong: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { backgroundColor: colors.honey },

  headerStack: { gap: 12, paddingTop: 4 },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cream, opacity: 0.78 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  total: { flexShrink: 1, fontFamily: fonts.display, fontSize: 36, lineHeight: 44, color: colors.cream },
  totalSub: { fontFamily: fonts.medium, fontSize: 14, color: colors.cream, opacity: 0.78 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 26,
    paddingHorizontal: 18,
    height: 52,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, height: '100%' },

  cal: { paddingHorizontal: 4, paddingBottom: 8, gap: 10 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNav: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calYear: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  calCell: { width: '25%', padding: 4 },
  calMonth: {
    height: 62,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  calNow: { borderColor: colors.honey },
  calOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  calName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  calTotal: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  pillOn: { backgroundColor: colors.forest },
  pillDot: { width: 12, height: 12, borderRadius: 6 },
  pillText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  pillTextOn: { color: colors.cream },
  planLine: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.cream, opacity: 0.85, marginTop: 8 },
  optionLead: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 32 },
  // Docked beside Money on desktop: the workspace already supplies the margins.
  flush: { paddingHorizontal: 0 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontFamily: fonts.displaySoft, fontSize: 15, color: colors.ink },
  sectionTotal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  item: { backgroundColor: colors.surface, paddingHorizontal: 16 },
  itemFirst: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 6 },
  itemLast: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26, paddingBottom: 6 },
  empty: { alignItems: 'center', paddingTop: 36, gap: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textAlign: 'center' },
  footer: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 18,
  },
  }),
);
