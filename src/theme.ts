import { Appearance, Platform } from 'react-native';

/**
 * Woodland palette: warm oat grounds, bark-brown ink, one deep forest surface for the
 * hero, and acorn/honey accents. Nothing is outlined; depth comes from tone alone.
 *
 * At night it turns to a woodland after dark: bark-brown grounds, cream ink, the same
 * forest and honey. The app follows the phone's light/dark setting (see app/_layout).
 */
const light = {
  // Grounds (sheet backgrounds) and raised surfaces
  ground: '#F7F0E2',
  groundTasks: '#EBF0DE',
  groundBookmarks: '#E9EEEC',
  groundNotes: '#F3EEE2',
  bg: '#F7F0E2',
  surface: '#FFFCF5',
  chip: '#EEE4D2',
  line: '#E6DBC8',

  // Text
  ink: '#2A1D14',
  inkSoft: '#57463A',
  muted: '#726154',
  faint: '#B3A595',
  /** Text and icons on an `ink` background (dark pills, letter badges). */
  onInk: '#FFF4DF',

  // Hero surface and what sits on it
  forest: '#1F4A36',
  forestSoft: '#2C5C45',
  cream: '#FFF4DF',
  sageSoft: '#DDE8CF',

  // Accents
  honey: '#F6B845',
  honeyDeep: '#E9A52C',
  honeySoft: '#FBE7BC',
  /** Text and icons on honey: stays dark in both themes. */
  onHoney: '#2A1D14',
  acorn: '#E08A32',
  acornCap: '#8A5527',
  moss: '#5E9A4E',
  berry: '#C7475B',

  danger: '#B3261E',
  dangerSoft: '#F7DFD8',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  ground: '#18130F',
  groundTasks: '#141A14',
  groundBookmarks: '#131918',
  groundNotes: '#1B1611',
  bg: '#18130F',
  surface: '#251D17',
  chip: '#31281F',
  line: '#3B3027',

  ink: '#F3E9D8',
  inkSoft: '#D7C8B3',
  muted: '#A6968A',
  faint: '#6F6257',
  onInk: '#1C1611',

  forest: '#2F6B4E',
  forestSoft: '#3A7A5B',
  cream: '#FFF4DF',
  sageSoft: '#22332A',

  honey: '#F6B845',
  honeyDeep: '#F0AE38',
  honeySoft: '#3A2E17',
  onHoney: '#2A1D14',
  acorn: '#E89545',
  acornCap: '#C98A55',
  moss: '#6FAE5E',
  berry: '#D9606F',

  danger: '#EC7A68',
  dangerSoft: '#3D211C',
};

export type Scheme = 'light' | 'dark';
// The web build (desktop) stays light for now; phones follow the system.
let scheme: Scheme = Platform.OS !== 'web' && Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

/**
 * The live palette. Read it at render time (`colors.ink`), not into module-level
 * constants: its values swap when the phone switches between light and dark.
 */
export const colors: Palette = { ...(scheme === 'dark' ? dark : light) };

export const isDark = () => scheme === 'dark';

const rebuilders: (() => void)[] = [];

/**
 * A style sheet (or any object) built from the palette, rebuilt in place when the
 * scheme changes. Use it like StyleSheet.create:
 *   const styles = themed((colors) => StyleSheet.create({ ... }));
 */
export function themed<T extends object>(make: (c: Palette) => T): T {
  const target = make(colors);
  rebuilders.push(() => Object.assign(target, make(colors)));
  return target;
}

/** Switch palettes. Call before rendering the tree that should use the new one. */
export function applyScheme(next: Scheme) {
  if (next === scheme) return;
  scheme = next;
  Object.assign(colors, next === 'dark' ? dark : light);
  for (const rebuild of rebuilders) rebuild();
}

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  /** Rounded display face for big numbers and titles. */
  display: 'Fredoka_700Bold',
  displaySoft: 'Fredoka_600SemiBold',
} as const;

export const radius = {
  card: 30,
  pill: 999,
} as const;
