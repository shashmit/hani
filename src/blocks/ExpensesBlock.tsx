import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { ExpenseRow } from '@/components/ExpenseRow';
import { Squirrel } from '@/components/mascot/Squirrel';
import { PanelSwipe, usePanelExit, useSidePanel } from '@/components/SidePanel';
import { AcornRow } from '@/components/acorns/Acorn';
import { AcornJar } from '@/components/acorns/AcornJar';
import { Bubble } from '@/components/mascot/Bubble';
import { CountUpText } from '@/components/ui/CountUpText';
import { Card } from '@/components/ui/Card';
import { PillButton } from '@/components/ui/PillButton';
import {
  formatMoney,
  isSameMonth,
  monthName,
} from '@/lib/format';
import {
  placeFill,
  spentByPlace,
  useExpenses,
  type Expense,
  type Place,
} from '@/store/expenses';
import { ask } from '@/lib/ask';
import { useBlockBottom } from '@/lib/blockSpace';
import { useIsDesktop } from '@/lib/useDesktop';
import { colors, fonts, themed } from '@/theme';

export function ExpensesBlock() {
  const { expenses, places, monthlyBudget, currency, removeExpense } = useExpenses();

  const spent = useMemo(
    () => expenses.filter((e) => isSameMonth(e.createdAt)).reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );
  const left = monthlyBudget - spent;
  const money = useCallback((n: number) => formatMoney(n, currency), [currency]);
  const placeSpent = useMemo(() => spentByPlace(expenses), [expenses]);
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);


  // Swipe left (finger right → left) on the block pulls in the All entries panel.
  const { progress: panel, open, docked } = useSidePanel();
  const openAll = () => open('entries');
  const grabberStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panel.value, [0, 0.15], [1, 0], 'clamp'),
  }));
  // As the panel opens, the cards drift left by different amounts and fan out.
  const heroExit = usePanelExit(0);
  const placesExit = usePanelExit(1);
  const lowerExit = usePanelExit(2);

  const confirmDelete = (e: Expense) =>
    ask('Delete expense?', `${e.title} · ${money(e.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExpense(e.id) },
    ]);

  const desktop = useIsDesktop();
  const bottom = useBlockBottom();
  const count = useMemo(() => expenses.filter((e) => isSameMonth(e.createdAt)).length, [expenses]);

  const leftShare = monthlyBudget > 0 ? Math.max(0, left / monthlyBudget) : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Little handle on the right edge: "there is more this way" */}
      {!docked && <Animated.View pointerEvents="none" style={[styles.grabber, grabberStyle]} />}

      <View style={styles.root}>
        <Animated.View style={heroExit}>
          <PanelSwipe mode="open" panel="entries">
            {/* The jar stands taller than the panel, so the hero never reads as a plain box. */}
            <View style={styles.heroWrap}>
              <Card color={colors.forest} padding={20} radius={38}>
                <View style={styles.heroText}>
                  <Text style={styles.heroLabel}>
                    {left < 0 ? 'Over budget' : 'Left to spend'} in {monthName()}
                  </Text>
                  <CountUpText
                    value={left}
                    format={money}
                    style={styles.amount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text style={styles.heroSub}>
                    {money(spent)} spent of {money(monthlyBudget)}
                  </Text>
                </View>

                <View style={styles.hazel}>
                  <Squirrel size={60} hopSignal={count} />
                  <Bubble text={stashMood(leftShare, left < 0, count, monthlyBudget > 0)} color={colors.cream} ink={colors.onHoney} />
                </View>

                <View style={styles.actions}>
                  <PillButton
                    label="Add expense"
                    icon="plus"
                    onPress={() => router.push('/add-expense')}
                    style={{ flex: 1 }}
                  />
                  <PillButton label="Budget" variant="glass" icon="sliders" onPress={() => router.push('/budget')} />
                </View>
              </Card>
              <View style={styles.jar} pointerEvents="none">
                <AcornJar ratio={leftShare} />
              </View>
            </View>
          </PanelSwipe>
        </Animated.View>

        <Animated.View style={[placesExit, docked && styles.lower]}>
          <ScrollView
            // Beside the entries (desktop) the places wrap into rows and take the rest of
            // the column; on the phone they are one strip to flick through.
            horizontal={!docked}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={docked ? undefined : styles.placesStrip}
            contentContainerStyle={docked ? styles.placesWrap : styles.placesContent}
          >
            {places.map((p) => (
              <PlaceTile key={p.id} place={p} spent={placeSpent[p.id] ?? 0} money={money} />
            ))}
            <Card
              color={colors.chip}
              padding={12}
              radius={26}
              style={styles.addPlace}
              onPress={() => router.push('/budget')}
              accessibilityLabel={places.length ? 'Add place' : 'Budget a place'}
            >
              <View style={styles.addPlaceIcon}>
                <Feather name="plus" size={18} color={colors.ink} />
              </View>
              <Text style={styles.addPlaceText}>{places.length ? 'Add place' : 'Budget a place'}</Text>
            </Card>
          </ScrollView>
        </Animated.View>

        {!docked && <Animated.View style={[styles.lower, lowerExit]}>
          <PanelSwipe mode="open" panel="entries" style={styles.lower}>
            <View style={styles.recent}>
              <View style={styles.recentHead}>
                <Text style={styles.sectionTitle}>Recent</Text>
                <Pressable
                  onPress={openAll}
                  style={styles.seeAll}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`See all ${expenses.length} entries`}
                >
                  <Text style={styles.seeAllText}>{desktop ? 'See all' : `All ${expenses.length}`}</Text>
                  <Feather name="arrow-right" size={15} color={colors.ink} />
                </Pressable>
              </View>
              {expenses.length === 0 ? (
                <View style={styles.empty}>
                  <Squirrel size={70} />
                  <Text style={styles.emptyText}>No expenses yet. Hazel is guarding the acorns.</Text>
                </View>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  // Room so the last rows can scroll clear of the floating dock.
                  contentContainerStyle={{ paddingBottom: bottom }}
                >
                  {expenses.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      e={e}
                      place={e.placeId ? placeById.get(e.placeId) : undefined}
                      money={money}
                      onLongPress={() => confirmDelete(e)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          </PanelSwipe>
        </Animated.View>}
      </View>
    </View>
  );
}

/** What Hazel says about the stash. */
function stashMood(share: number, over: boolean, count: number, hasBudget: boolean) {
  if (!hasBudget) return count === 0 ? 'Set a budget to start!' : 'No budget set yet.';
  if (over) return 'We dug too deep!';
  if (count === 0) return 'Jar is full. Nice.';
  if (share > 0.6) return 'Plenty stashed!';
  if (share > 0.3) return 'Doing fine.';
  if (share > 0.1) return 'Getting low…';
  return 'Nearly out!';
}

const METER = 6;

function PlaceTile({
  place,
  spent,
  money,
}: {
  place: Place;
  spent: number;
  money: (n: number) => string;
}) {
  const left = place.amount - spent;
  const over = left < 0;
  const share = place.amount > 0 ? Math.max(0, left / place.amount) : 0;
  return (
    <Card
      color={over ? colors.dangerSoft : colors.surface}
      padding={14}
      radius={26}
      style={styles.placeTile}
      onPress={() => router.push('/budget')}
      accessibilityLabel={`${place.name}, ${over ? 'over budget' : `${money(left)} left`}`}
    >
      <View style={styles.placeHead}>
        <View style={[styles.placeDot, { backgroundColor: placeFill(place) }]} />
        <Text style={styles.placeName} numberOfLines={1}>
          {place.name}
        </Text>
      </View>
      <CountUpText
        value={Math.abs(left)}
        format={money}
        style={[styles.placeLeft, over && { color: colors.danger }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text style={styles.placeLeftLabel}>{over ? 'over budget' : `left of ${money(place.amount)}`}</Text>
      <View style={styles.placeMeter}>
        <AcornRow total={METER} filled={over ? 0 : Math.max(share > 0 ? 1 : 0, Math.round(share * METER))} />
      </View>
    </Card>
  );
}

/** How far the jar rises above the top edge of the hero panel. */
const JAR_POP = 30;

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, gap: 14 },
  lower: { flex: 1 },

  // Hero: the stash
  heroWrap: { paddingTop: JAR_POP },
  jar: { position: 'absolute', top: 0, right: 18 },
  heroText: { paddingRight: 116, alignItems: 'flex-start' },
  heroLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cream, opacity: 0.78 },
  amount: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 50,
    color: colors.cream,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.cream, opacity: 0.78 },
  hazel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },

  // Places
  placesStrip: { flexGrow: 0, marginHorizontal: -20 },
  placesContent: { gap: 10, paddingHorizontal: 20 },
  placesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
  placeTile: { width: 152, height: 122 },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeDot: { width: 9, height: 9, borderRadius: 5 },
  placeName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
  placeLeft: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: colors.ink, marginTop: 4 },
  placeLeftLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  placeMeter: { marginTop: 'auto' },
  addPlace: { width: 108, height: 122, alignItems: 'center', justifyContent: 'center', gap: 8 },
  addPlaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlaceText: { fontFamily: fonts.displaySoft, fontSize: 14, color: colors.ink, textAlign: 'center' },

  // Right-edge handle hinting at the side panel
  grabber: {
    position: 'absolute',
    right: -14,
    top: '24%',
    width: 5,
    height: 46,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.22,
    zIndex: 2,
  },

  // Recent: rows sit straight on the ground, no container
  recent: { flex: 1, minHeight: 120 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 34,
  },
  seeAllText: { fontFamily: fonts.displaySoft, fontSize: 14, color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  }),
);
