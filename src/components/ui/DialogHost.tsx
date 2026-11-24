import { useEffect } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { Squirrel } from '@/components/mascot/Squirrel';
import { useDialog, type AskButton } from '@/lib/ask';
import { colors, fonts, themed } from '@/theme';

/** Renders dialogs opened with `ask()` on web/desktop. Mount once, above everything. */
export function DialogHost() {
  const { dialog, close } = useDialog();

  const choose = (b: AskButton) => {
    close();
    b.onPress?.();
  };

  // Escape cancels. Listens in the capture phase so an open form behind it doesn't also close.
  useEffect(() => {
    if (!dialog || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, close]);

  // Android back button cancels.
  useEffect(() => {
    if (!dialog || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [dialog, close]);

  if (!dialog) return null;

  // Cancel goes last, as a quiet button.
  const buttons = [...dialog.buttons].sort(
    (a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'),
  );

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <Animated.View entering={ZoomIn.duration(180)} style={styles.card} role="alertdialog" aria-modal>
        <View style={styles.head}>
          <Squirrel size={40} acorn={false} still />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {dialog.title}
            </Text>
            {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.buttons} bounces={false}>
          {buttons.map((b, i) => (
            <Pressable
              key={`${b.text}-${i}`}
              onPress={() => choose(b)}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.button,
                b.style === 'destructive' && styles.destructive,
                b.style === 'cancel' && styles.cancel,
                hovered && styles.hovered,
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  b.style === 'destructive' && { color: colors.danger },
                  b.style === 'cancel' && { color: colors.muted },
                ]}
              >
                {b.text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42, 29, 20, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    width: 360,
    maxWidth: '90%',
    backgroundColor: colors.bg,
    borderRadius: 28,
    padding: 18,
    gap: 16,
    boxShadow: '0px 30px 60px -20px rgba(42, 29, 20, 0.6)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, lineHeight: 22 },
  message: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 3 },
  scroll: { flexGrow: 0, maxHeight: 420 },
  buttons: { gap: 8 },
  button: {
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructive: { backgroundColor: colors.dangerSoft },
  cancel: { backgroundColor: 'transparent' },
  hovered: { opacity: 0.8 },
  buttonText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  }),
);
