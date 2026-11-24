import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Squirrel } from '@/components/mascot/Squirrel';
import { useDialog } from '@/lib/ask';
import { useIsDesktop } from '@/lib/useDesktop';
import { colors, fonts, themed } from '@/theme';

/**
 * Shared chrome for the form routes (add expense / add task / budget): a form sheet on
 * phones, a centred card over a dimmed backdrop on desktop (Escape or a click outside closes it).
 */
export function Sheet({
  title,
  kicker,
  children,
  footer,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const desktop = useIsDesktop();

  // Only the form on top (the focused screen) answers Escape; an open dialog answers first.
  useFocusEffect(
    useCallback(() => {
      if (!desktop) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || useDialog.getState().dialog) return;
        e.stopPropagation();
        router.back();
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }, [desktop]),
  );

  // Phones: the field you're typing in scrolls clear of the keyboard, and the footer
  // (the Save button) rides on top of the keyboard instead of hiding under it.
  const [footerH, setFooterH] = useState(84);
  // Android nudges the sheet up by some amount when the keyboard opens, so the footer
  // can't just be lifted by the keyboard's height. Instead: once the keyboard is up,
  // measure where the sheet's bottom edge really is and pad by exactly the part the
  // keyboard covers. Measured again a beat later, after the sheet has settled.
  const box = useRef<ComponentRef<typeof View>>(null);
  const [typing, setTyping] = useState(false);
  const pad = useSharedValue(0);
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setTyping(true);
      const keyboardTop = e.endCoordinates.screenY;
      const measure = () =>
        box.current?.measureInWindow((_x, y, _w, h) => {
          pad.set(withTiming(Math.max(0, y + h - keyboardTop), { duration: 140 }));
        });
      clear();
      measure();
      timers = [setTimeout(measure, 120), setTimeout(measure, 350)];
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      clear();
      setTyping(false);
      pad.set(withTiming(0, { duration: 140 }));
    });
    return () => {
      clear();
      show.remove();
      hide.remove();
    };
  }, [pad]);
  const padStyle = useAnimatedStyle(() => ({ paddingBottom: pad.get() }));

  const header = (
        <View style={styles.header}>
          <Squirrel size={46} acorn={false} />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={styles.close}
            hitSlop={8}
            accessibilityLabel="Close"
          >
            <Feather name="x" size={18} color={colors.forest} />
          </Pressable>
        </View>
  );

  if (!desktop) {
    return (
      <Animated.View ref={box} style={[{ flex: 1 }, padStyle]}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bottomOffset={footerH + 12}
          showsVerticalScrollIndicator={false}
        >
          {header}
          {children}
        </KeyboardAwareScrollView>
        <View style={[styles.footer, typing && styles.footerTyping]} onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}>
          {footer}
        </View>
      </Animated.View>
    );
  }

  const body = (
    <View style={styles.desktopBody}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </View>
  );

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close" />
      <Animated.View entering={FadeInDown.duration(220)} style={styles.card} role="dialog" aria-modal>
        {body}
      </Animated.View>
    </Animated.View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.forest }]}
    >
      {color && <View style={[styles.chipDot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, selected && { color: colors.cream }]}>{label}</Text>
    </Pressable>
  );
}

export const sheetStyles = themed((colors) =>
  StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 56,
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  }),
);

const styles = themed((colors) =>
  StyleSheet.create({
  content: { padding: 22, paddingTop: 28, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.forest },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 10 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 38,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  footer: { paddingHorizontal: 22, paddingBottom: 28, paddingTop: 8 },
  footerTyping: { paddingBottom: 10 },

  // Desktop: the form floats as a card in the middle of the window.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 29, 20, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: 520,
    maxWidth: '100%',
    maxHeight: '100%',
    backgroundColor: colors.bg,
    borderRadius: 32,
    overflow: 'hidden',
    boxShadow: '0px 40px 80px -24px rgba(42, 29, 20, 0.7)',
  },
  desktopBody: { flexShrink: 1, minHeight: 0 },
  }),
);
