import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useIsDesktop } from '@/lib/useDesktop';
import { colors, fonts, themed } from '@/theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];

/** Slide the drawer away, then (optionally) do something once it's gone. */
export type CloseDrawer = (after?: () => void) => void;

const tick = () => Haptics.selectionAsync().catch(() => {});

/**
 * A sheet that rises from the bottom over everything (docks included, hence the Modal).
 * Put it away with a tap outside, a drag down on its top, the back button, or `close()`.
 * Mount it to open it; it calls `onClosed` when it has slid away so the owner can unmount it.
 */
type DrawerProps = {
  title: string;
  subtitle?: string;
  headerRight?: (close: CloseDrawer) => ReactNode;
  footer?: (close: CloseDrawer) => ReactNode;
  onClosed: () => void;
  children: (close: CloseDrawer) => ReactNode;
};

export function BottomDrawer(props: DrawerProps) {
  // Desktop windows are wide: the same content floats as a centred card instead.
  return useIsDesktop() ? <CardDrawer {...props} /> : <PhoneDrawer {...props} />;
}

function PhoneDrawer({ title, subtitle, headerRight, footer, onClosed, children }: DrawerProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(height);
  const closing = useSharedValue(false);

  useEffect(() => {
    y.set(withSpring(0, { damping: 26, stiffness: 260, mass: 0.9 }));
  }, [y]);

  const close: CloseDrawer = (then) => {
    if (closing.get()) return;
    closing.set(true);
    // Whatever comes next (a dialog, a new screen) waits until the drawer is gone.
    const done = () => {
      onClosed();
      if (then) setTimeout(then, 0);
    };
    y.set(
      withTiming(height, { duration: 220 }, (fin) => {
        'worklet';
        if (fin) scheduleOnRN(done);
      }),
    );
  };

  // Drag the top of the drawer down to put it away.
  const drag = usePanGesture({
    activeOffsetY: 6,
    onUpdate: (e) => {
      'worklet';
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 110 || e.velocityY > 900) {
        closing.set(true);
        y.set(
          withTiming(height, { duration: 200 }, (done) => {
            'worklet';
            if (done) scheduleOnRN(onClosed);
          }),
        );
      } else {
        y.set(withSpring(0, { damping: 26, stiffness: 300 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, height * 0.6], [1, 0], 'clamp'),
  }));

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: height * 0.82 }, sheetStyle]}
          accessibilityViewIsModal
        >
          <GestureDetector gesture={drag}>
            <View style={styles.top}>
              <View style={styles.grabber} />
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                {headerRight?.(close)}
                <Pressable onPress={() => close()} style={styles.closeBtn} hitSlop={8} accessibilityLabel="Close">
                  <Feather name="x" size={18} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {children(close)}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer(close)}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Small heading between groups of rows in a drawer. */
/**
 * Desktop: a card in the middle of the window over a dimmed backdrop, like the desktop
 * forms (see <Sheet />). Escape or a click outside puts it away.
 */
function CardDrawer({ title, subtitle, headerRight, footer, onClosed, children }: DrawerProps) {
  const { height } = useWindowDimensions();
  const shown = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    shown.set(withTiming(1, { duration: 200 }));
  }, [shown]);

  const close = useCallback<CloseDrawer>(
    (then) => {
      if (closing.get()) return;
      closing.set(true);
      const done = () => {
        onClosed();
        if (then) setTimeout(then, 0);
      };
      shown.set(
        withTiming(0, { duration: 150 }, (fin) => {
          'worklet';
          if (fin) scheduleOnRN(done);
        }),
      );
    },
    [closing, shown, onClosed],
  );

  // Escape closes the card first, before anything underneath (forms, side panels) hears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: interpolate(shown.get(), [0, 1], [14, 0]) }],
  }));

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()}>
      <View style={styles.cardRoot}>
        <Animated.View style={[styles.backdrop, styles.cardBackdrop, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[styles.card, { maxHeight: height * 0.8 }, cardStyle]} role="dialog" aria-modal>
          <View style={[styles.head, styles.cardHead]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {headerRight?.(close)}
            <Pressable onPress={() => close()} style={styles.closeBtn} hitSlop={8} accessibilityLabel="Close">
              <Feather name="x" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children(close)}
          </ScrollView>
          {footer ? <View style={[styles.footer, styles.cardFooter]}>{footer(close)}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function DrawerSection({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

/** Round tinted badge holding an icon; the lead of most rows. */
export function IconBadge({
  icon,
  color,
  solid,
  size = 40,
}: {
  icon: IconName;
  color: string;
  /** Filled with the colour (icon in cream) instead of a soft tint. */
  solid?: boolean;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: solid ? color : `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={size * 0.42} color={solid ? colors.cream : color} />
    </View>
  );
}

/** One choice in a drawer: lead, label and detail, with a radio or checkbox. */
export function OptionRow({
  lead,
  label,
  meta,
  selected,
  multi,
  action,
  indent = 0,
  onPress,
  onLongPress,
}: {
  lead?: ReactNode;
  label: string;
  meta?: string;
  selected: boolean;
  /** Checkbox (pick several) instead of a radio. */
  multi?: boolean;
  /** Does something rather than picks something: shows an arrow instead of a radio. */
  action?: boolean;
  /** Nesting depth, for trees. */
  indent?: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.option,
        indent > 0 && { marginLeft: indent * 22 },
        selected && styles.optionOn,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole={action ? 'button' : multi ? 'checkbox' : 'radio'}
      accessibilityState={action ? undefined : { checked: selected }}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
    >
      {indent > 0 && <Feather name="corner-down-right" size={14} color={colors.faint} style={styles.elbow} />}
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.optionLabel} numberOfLines={1}>
          {label}
        </Text>
        {meta ? <Text style={styles.optionMeta}>{meta}</Text> : null}
      </View>
      {action ? (
        <Feather name="chevron-right" size={18} color={colors.muted} />
      ) : (
        <View style={[multi ? styles.box : styles.radio, selected && styles.markOn]}>
          {selected && <Feather name="check" size={14} color={colors.cream} />}
        </View>
      )}
    </Pressable>
  );
}

export type PickerOption = { key: string; label: string; meta?: string; lead?: ReactNode };

/**
 * Single choice from a list, with an "All" row on top. Picking applies it and closes.
 */
export function PickerDrawer({
  title,
  subtitle,
  allLabel,
  allMeta,
  allIcon,
  options,
  selected,
  onSelect,
  onClosed,
}: {
  title: string;
  subtitle?: string;
  allLabel: string;
  allMeta?: string;
  allIcon: IconName;
  options: PickerOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  onClosed: () => void;
}) {
  return (
    <BottomDrawer title={title} subtitle={subtitle} onClosed={onClosed}>
      {(close) => (
        <>
          <OptionRow
            lead={<IconBadge icon={allIcon} color={colors.forest} />}
            label={allLabel}
            meta={allMeta}
            selected={selected === null}
            onPress={() => {
              onSelect(null);
              close();
            }}
          />
          {options.map((o) => (
            <OptionRow
              key={o.key}
              lead={o.lead}
              label={o.label}
              meta={o.meta}
              selected={o.key === selected}
              onPress={() => {
                onSelect(o.key);
                close();
              }}
            />
          ))}
        </>
      )}
    </BottomDrawer>
  );
}

/**
 * A filter button that opens a drawer. Shows what's picked; its little x clears it
 * without opening anything. Two of these sit side by side under a search bar.
 */
export function FilterButton({
  title,
  icon,
  count,
  picked,
  onOpen,
}: {
  title: string;
  icon: IconName;
  /** How many options there are to pick from. */
  count: number;
  picked?: { label: string; lead: ReactNode; onClear: () => void };
  onOpen: () => void;
}) {
  const empty = count === 0 && !picked;
  return (
    <Pressable
      onPress={() => {
        tick();
        onOpen();
      }}
      disabled={empty}
      style={({ pressed }) => [
        styles.fbtn,
        picked && styles.fbtnOn,
        empty && { opacity: 0.5 },
        pressed && styles.fbtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${picked ? picked.label : 'all'}. Opens a list to choose from.`}
    >
      {picked ? (
        picked.lead
      ) : (
        <View style={styles.fbtnIcon}>
          <Feather name={icon} size={15} color={colors.forestInk} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.fbtnLabel, picked && styles.fbtnLabelOn]}>{title}</Text>
        <Text style={[styles.fbtnValue, picked && styles.fbtnValueOn]} numberOfLines={1}>
          {picked ? picked.label : empty ? 'None here' : `All · ${count}`}
        </Text>
      </View>
      {picked ? (
        <Pressable
          onPress={() => {
            tick();
            picked.onClear();
          }}
          hitSlop={10}
          style={styles.fbtnClear}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${title.toLowerCase()}`}
        >
          <Feather name="x" size={13} color={colors.cream} />
        </Pressable>
      ) : (
        <Feather name="chevron-down" size={17} color={colors.muted} />
      )}
    </Pressable>
  );
}

/** Lead for a picked FilterButton: a 36pt badge. */
export function PickedLead({ color, icon }: { color: string; icon?: IconName }) {
  return (
    <View style={[styles.pickedLead, { backgroundColor: color }]}>
      {icon ? <Feather name={icon} size={14} color={colors.cream} /> : null}
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42,29,20,0.38)',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderCurve: 'continuous',
    boxShadow: '0px -12px 32px -12px rgba(42,29,20,0.35)',
  },
  top: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.faint },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4, gap: 2 },
  footer: { paddingHorizontal: 16, paddingTop: 10 },

  // Desktop card
  cardRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cardBackdrop: { backgroundColor: 'rgba(42,29,20,0.5)' },
  card: {
    width: 480,
    maxWidth: '100%',
    backgroundColor: colors.bg,
    borderRadius: 32,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0px 40px 80px -24px rgba(42,29,20,0.7)',
  },
  cardHead: { marginTop: 0, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 8 },
  cardFooter: { paddingBottom: 18 },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, letterSpacing: 0.2 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  optionOn: { backgroundColor: colors.surface },
  elbow: { marginLeft: -6, marginRight: -4 },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  optionMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: colors.forest },

  fbtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 60,
    paddingLeft: 9,
    paddingRight: 12,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  fbtnOn: { backgroundColor: colors.forest },
  fbtnPressed: { transform: [{ scale: 0.97 }] },
  fbtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbtnLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  fbtnLabelOn: { color: 'rgba(255,244,223,0.7)' },
  fbtnValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 1 },
  fbtnValueOn: { color: colors.cream },
  fbtnClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,244,223,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedLead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  }),
);
