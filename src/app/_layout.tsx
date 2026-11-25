import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Intro } from '@/components/mascot/Intro';
import { DialogHost } from '@/components/ui/DialogHost';
import { MotionClock } from '@/lib/motion';
import { useIsDesktop } from '@/lib/useDesktop';
import { usePrefs } from '@/store/prefs';
import { applyTheme, colors, themed } from '@/theme';

// Keep the native splash (Hazel with her acorn) up until fonts are in; the in-app
// intro then takes over from the very same picture.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Phones: native form sheets that slide up. */
const phoneSheet = themed((colors) => ({
  presentation: 'formSheet' as const,
  // One height only: the sheet's content is laid out for its tallest stop, so with a
  // shorter first stop the footer (Save / Done) would start out below the screen.
  sheetAllowedDetents: [0.88],
  sheetGrabberVisible: true,
  sheetCornerRadius: 32,
  contentStyle: { backgroundColor: colors.bg },
}));

/** Desktop: forms float over home, which stays visible behind (see <Sheet />). */
const desktopSheet = {
  presentation: 'transparentModal' as const,
  contentStyle: { backgroundColor: 'transparent' },
};

export default function RootLayout() {
  const desktop = useIsDesktop();
  const sheet = desktop ? desktopSheet : phoneSheet;

  // Follow the chosen colour theme and the phone's light/dark setting. The palette swaps before anything below
  // renders, and the tree is redrawn (keyed by theme and scheme) so every screen picks it up.
  // The web build (desktop) stays light for now.
  const system = useColorScheme();
  const themePref = usePrefs((s) => s.theme);
  const wanted = themePref === 'system' ? system : themePref;
  const scheme = Platform.OS !== 'web' && wanted === 'dark' ? 'dark' : 'light';
  const palette = usePrefs((s) => s.palette);
  applyTheme(palette, scheme);
  const look = `${palette}-${scheme}`;
  useEffect(() => {
    // Behind the app: what shows during sheet transitions and the keyboard's slide.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [look]);

  const [loaded] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  // The launch animation plays once per cold start, on phones.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    // No intro on the web build: just let the splash go once fonts are ready.
    if (loaded && (desktop || Platform.OS === 'web')) SplashScreen.hide();
  }, [loaded, desktop]);

  if (!loaded) return null;
  const showIntro = intro && !desktop && Platform.OS !== 'web';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* The app draws edge to edge, so the window never resizes for the keyboard; this
          tracks it frame by frame instead (see Sheet, the note editor, the notes tree). */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      <MotionClock key={look}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="add-expense" options={sheet} />
          <Stack.Screen name="add-task" options={sheet} />
          <Stack.Screen name="add-bookmark" options={desktop ? sheet : { ...phoneSheet, sheetAllowedDetents: [0.94] }} />
          <Stack.Screen name="collection" options={sheet} />
          {/* Invisible stop: makes a blank note, then swaps to its editor. */}
          <Stack.Screen
            name="add-note"
            options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="note/[id]"
            options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.groundNotes } }}
          />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen
            name="budget"
            options={desktop ? sheet : { ...phoneSheet, sheetAllowedDetents: [0.94] }}
          />
        </Stack>
        <DialogHost />
        {showIntro && <Intro onReady={() => SplashScreen.hide()} onDone={() => setIntro(false)} />}
      </MotionClock>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
