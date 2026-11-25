import { Appearance, Platform } from 'react-native';

/**
 * Woodland palette: warm oat grounds, bark-brown ink, one deep forest surface for the
 * hero, and acorn/honey accents. Nothing is outlined; depth comes from tone alone.
 *
 * At night it turns to a woodland after dark: bark-brown grounds, cream ink, the same
 * forest and honey. The app follows the phone's light/dark setting (see app/_layout).
 *
 * Woodland is the first of several colour themes (see THEMES). The others keep its key
 * names, so `forest` is always "the hero colour" and `honey` "the accent", whatever
 * colour they are in that theme.
 */
const woodlandLight = {
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
  /** The hero colour as text or an icon on a ground: lightens at night so it stays readable. */
  forestInk: '#1F4A36',
  cream: '#FFF4DF',
  sageSoft: '#DDE8CF',

  // The dark frame: behind the sheets, on the dock, around the desktop window
  backdrop: '#2A1D14',
  /** A row lifted off the backdrop (dragging in the dock's menu). */
  backdropLift: '#3A2A1F',

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

export type Palette = { [K in keyof typeof woodlandLight]: string };

const woodlandDark: Palette = {
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
  forestInk: '#9FCFA4',
  cream: '#FFF4DF',
  sageSoft: '#22332A',

  // A touch lighter than the grounds, so the dock still lifts off them.
  backdrop: '#30241B',
  backdropLift: '#3F3025',

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
export type ThemeName = 'woodland' | 'sagebrush' | 'rosehip' | 'heather' | 'tidepool' | 'clay';

type Theme = { key: ThemeName; name: string; light: Palette; dark: Palette };

/** A colour theme: Woodland with its grounds, ink, hero, frame and accent swapped. */
const tint = (key: ThemeName, name: string, light: Partial<Palette>, dark: Partial<Palette>): Theme => ({
  key,
  name,
  light: { ...woodlandLight, ...light, bg: light.ground ?? woodlandLight.bg },
  dark: { ...woodlandDark, ...dark, bg: dark.ground ?? woodlandDark.bg },
});

/**
 * Every colour theme, in the order Settings shows them. Each has a day and a night
 * palette. The little pictures (acorns, Hazel) and the colours you give your own things
 * (places, collections) stay the same in all of them.
 */
export const THEMES: Theme[] = [
  { key: 'woodland', name: 'Woodland', light: woodlandLight, dark: woodlandDark },

  // Soft grey-green, like the underside of a sage leaf, with butter yellow.
  tint(
    'sagebrush',
    'Sagebrush',
    {
      ground: '#EFF2E7',
      groundTasks: '#E6EDDD',
      groundBookmarks: '#E5EDEA',
      groundNotes: '#F1F1E6',
      surface: '#FBFCF6',
      chip: '#DFE6D4',
      line: '#D5DDC9',
      ink: '#1F2A22',
      inkSoft: '#43524A',
      muted: '#5F6D65',
      faint: '#A3AFA4',
      onInk: '#F4F7EC',
      forest: '#3F5F4C',
      forestSoft: '#4F705C',
      forestInk: '#3F5F4C',
      sageSoft: '#D5E3CF',
      backdrop: '#1E2A23',
      backdropLift: '#2B3A31',
      honey: '#F1C56B',
      honeyDeep: '#E0AE48',
      honeySoft: '#F6E9C4',
    },
    {
      ground: '#131814',
      groundTasks: '#111A14',
      groundBookmarks: '#111918',
      groundNotes: '#161812',
      surface: '#1E2620',
      chip: '#29332B',
      line: '#323D34',
      ink: '#E9F0E4',
      inkSoft: '#C6D2C4',
      muted: '#94A296',
      faint: '#5F6C62',
      onInk: '#151B17',
      forest: '#476B56',
      forestSoft: '#557B65',
      forestInk: '#A9D3B4',
      sageSoft: '#22332A',
      backdrop: '#232D26',
      backdropLift: '#313D34',
      honey: '#F1C56B',
      honeyDeep: '#E8B955',
      honeySoft: '#383219',
    },
  ),

  // Dusty pink and deep rose, with a peach accent.
  tint(
    'rosehip',
    'Rosehip',
    {
      ground: '#F9EEEC',
      groundTasks: '#F6EAEE',
      groundBookmarks: '#F3ECF0',
      groundNotes: '#F9F0EA',
      surface: '#FFFAF8',
      chip: '#F1DEDC',
      line: '#E9D3D1',
      ink: '#34201F',
      inkSoft: '#5E4543',
      muted: '#775D5B',
      faint: '#BBA5A3',
      onInk: '#FFF1EC',
      forest: '#84434F',
      forestSoft: '#96545F',
      forestInk: '#84434F',
      sageSoft: '#F3D9DC',
      backdrop: '#2F1B20',
      backdropLift: '#402830',
      honey: '#F7BFA6',
      honeyDeep: '#EDA283',
      honeySoft: '#FBE3D8',
    },
    {
      ground: '#1A1213',
      groundTasks: '#1A1216',
      groundBookmarks: '#181318',
      groundNotes: '#1C1411',
      surface: '#271B1D',
      chip: '#342527',
      line: '#3F2D30',
      ink: '#F5E6E3',
      inkSoft: '#DBC5C2',
      muted: '#AB9391',
      faint: '#73605F',
      onInk: '#1E1415',
      forest: '#8C4A56',
      forestSoft: '#9D5A66',
      forestInk: '#EFB3BD',
      sageSoft: '#3A2429',
      backdrop: '#33232A',
      backdropLift: '#43303A',
      honey: '#F7BFA6',
      honeyDeep: '#F0AE93',
      honeySoft: '#3D2820',
    },
  ),

  // Lavender hills at dusk, with gold.
  tint(
    'heather',
    'Heather',
    {
      ground: '#F2EFF7',
      groundTasks: '#ECEBF6',
      groundBookmarks: '#EAEEF5',
      groundNotes: '#F4EFF3',
      surface: '#FDFBFF',
      chip: '#E3DEEF',
      line: '#D9D3E7',
      ink: '#241E33',
      inkSoft: '#4A4260',
      muted: '#665C7A',
      faint: '#ABA3BC',
      onInk: '#F6F1FF',
      forest: '#54467F',
      forestSoft: '#655790',
      forestInk: '#54467F',
      sageSoft: '#DFD8F0',
      backdrop: '#211B30',
      backdropLift: '#302843',
      honey: '#F3C25B',
      honeyDeep: '#E4AC3C',
      honeySoft: '#F9EBC6',
    },
    {
      ground: '#15121C',
      groundTasks: '#13121E',
      groundBookmarks: '#12141D',
      groundNotes: '#18131A',
      surface: '#201C2B',
      chip: '#2B2639',
      line: '#352F45',
      ink: '#ECE7F7',
      inkSoft: '#CBC4DC',
      muted: '#9B93AE',
      faint: '#655E77',
      onInk: '#17141F',
      forest: '#5F5092',
      forestSoft: '#6F60A3',
      forestInk: '#C5B8F0',
      sageSoft: '#2A2440',
      backdrop: '#272136',
      backdropLift: '#352E48',
      honey: '#F3C25B',
      honeyDeep: '#EBB648',
      honeySoft: '#3A2F18',
    },
  ),

  // Sea-pool blue-green, with warm sand.
  tint(
    'tidepool',
    'Tidepool',
    {
      ground: '#EBF2F3',
      groundTasks: '#E6F1EC',
      groundBookmarks: '#E4EDF3',
      groundNotes: '#EFF1EC',
      surface: '#FAFDFD',
      chip: '#D9E6E8',
      line: '#CDDDE0',
      ink: '#162830',
      inkSoft: '#3B525A',
      muted: '#566C74',
      faint: '#9DB0B6',
      onInk: '#EFF9FA',
      forest: '#1E5568',
      forestSoft: '#2C667A',
      forestInk: '#1E5568',
      sageSoft: '#CFE4E8',
      backdrop: '#13262D',
      backdropLift: '#20363E',
      honey: '#F6B56A',
      honeyDeep: '#E99C48',
      honeySoft: '#FBE6CB',
    },
    {
      ground: '#0F1719',
      groundTasks: '#0F1916',
      groundBookmarks: '#0E161B',
      groundNotes: '#131815',
      surface: '#18262A',
      chip: '#223238',
      line: '#2B3D43',
      ink: '#E4F0F2',
      inkSoft: '#C0D2D6',
      muted: '#8FA5AB',
      faint: '#586B71',
      onInk: '#11191C',
      forest: '#2A6C82',
      forestSoft: '#377C93',
      forestInk: '#9FD3E2',
      sageSoft: '#1B3239',
      backdrop: '#1B2D34',
      backdropLift: '#293D45',
      honey: '#F6B56A',
      honeyDeep: '#EFA857',
      honeySoft: '#3B2C18',
    },
  ),

  // Fired terracotta on warm plaster.
  tint(
    'clay',
    'Clay',
    {
      ground: '#F7EDE3',
      groundTasks: '#F2EEDD',
      groundBookmarks: '#F0ECE6',
      groundNotes: '#F8EFE0',
      surface: '#FFFBF5',
      chip: '#EFDFCF',
      line: '#E7D4C2',
      ink: '#2F1D15',
      inkSoft: '#5B4336',
      muted: '#755C4E',
      faint: '#B9A494',
      onInk: '#FFF2E4',
      forest: '#8F4426',
      forestSoft: '#A2553A',
      forestInk: '#8F4426',
      sageSoft: '#F3DCCB',
      backdrop: '#2C1A13',
      backdropLift: '#3D271E',
      honey: '#F5BE55',
      honeyDeep: '#E6A738',
      honeySoft: '#FAE8C0',
    },
    {
      ground: '#19120E',
      groundTasks: '#18150E',
      groundBookmarks: '#171412',
      groundNotes: '#1C150E',
      surface: '#261C16',
      chip: '#33261D',
      line: '#3E2F25',
      ink: '#F5E8DA',
      inkSoft: '#DAC7B4',
      muted: '#A99483',
      faint: '#726052',
      onInk: '#1D1510',
      forest: '#9A4C2C',
      forestSoft: '#AC5E3F',
      forestInk: '#F0B08F',
      sageSoft: '#3A251A',
      backdrop: '#32221A',
      backdropLift: '#412F25',
      honey: '#F5BE55',
      honeyDeep: '#EDB245',
      honeySoft: '#3A2D16',
    },
  ),
];

/** The theme by that name; Woodland if the name is unknown (say, from a newer backup). */
export const themeNamed = (name: string) => THEMES.find((t) => t.key === name) ?? THEMES[0];

// The web build (desktop) stays light for now; phones follow the system.
let scheme: Scheme = Platform.OS !== 'web' && Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
let theme: ThemeName = 'woodland';

/**
 * The live palette. Read it at render time (`colors.ink`), not into module-level
 * constants: its values swap when the theme changes or the phone goes light or dark.
 */
export const colors: Palette = { ...themeNamed(theme)[scheme] };

export const isDark = () => scheme === 'dark';

const rebuilders: (() => void)[] = [];

/**
 * A style sheet (or any object) built from the palette, rebuilt in place when the
 * palette changes. Use it like StyleSheet.create:
 *   const styles = themed((colors) => StyleSheet.create({ ... }));
 */
export function themed<T extends object>(make: (c: Palette) => T): T {
  const target = make(colors);
  rebuilders.push(() => Object.assign(target, make(colors)));
  return target;
}

/** Switch palettes. Call before rendering the tree that should use the new one. */
export function applyTheme(name: string, next: Scheme) {
  const wanted = themeNamed(name);
  if (wanted.key === theme && next === scheme) return;
  theme = wanted.key;
  scheme = next;
  Object.assign(colors, wanted[next]);
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
