import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Acorn } from '@/components/acorns/Acorn';
import { useDialog } from '@/lib/ask';
import { useIsDesktop } from '@/lib/useDesktop';
import { colors, fonts } from '@/theme';

import { BACKDROP, DRAG_REGION, FRAME_PAD, LIGHTS_W, ON_BARK, PAGE_MAX, SHEET_RADIUS, TOP_CLEAR } from './frame';

/**
 * Frame for a full-screen route (e.g. the note editor) on desktop: the window's bark title
 * strip, which clears the macOS buttons and drags the window, and the page as one centred
 * sheet, the same size as the home sheets. Escape goes back.
 * On phones it renders the page as it is.
 */
export function DesktopPage({ ground = colors.bg, children }: { ground?: string; children: React.ReactNode }) {
  const desktop = useIsDesktop();
  const pathname = usePathname();

  // Bubble phase: drawers, dialogs and forms catch Escape first (capture) and stop it.
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || useDialog.getState().dialog) return;
      if (!router.canGoBack()) return;
      e.preventDefault();
      router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, pathname]);

  if (!desktop) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View style={styles.titleBar} {...DRAG_REGION}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ hovered }: { hovered?: boolean }) => [styles.back, hovered && styles.backHover]}
          accessibilityRole="button"
          accessibilityLabel="Back (Esc)"
        >
          <Feather name="arrow-left" size={15} color={ON_BARK.soft} />
          <Text style={styles.backText}>Back</Text>
          <Text style={styles.backKey}>Esc</Text>
        </Pressable>
        <View style={styles.brand} pointerEvents="none">
          <Acorn size={18} />
          <Text style={styles.logo}>hani</Text>
        </View>
      </View>
      <View style={styles.area}>
        <View style={[styles.sheet, { backgroundColor: ground }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKDROP, paddingBottom: FRAME_PAD },
  titleBar: {
    height: TOP_CLEAR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: LIGHTS_W,
    paddingRight: 20,
  },
  back: {
    height: 32,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  backHover: { backgroundColor: ON_BARK.hover },
  backText: { fontFamily: fonts.semibold, fontSize: 13.5, color: ON_BARK.text },
  backKey: { fontFamily: fonts.medium, fontSize: 11.5, color: ON_BARK.faint },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, color: ON_BARK.text },
  area: { flex: 1, alignItems: 'center', paddingHorizontal: FRAME_PAD },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: PAGE_MAX,
    borderRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
