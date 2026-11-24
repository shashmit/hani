import { Platform, useWindowDimensions } from 'react-native';

/** Narrower than this, even the desktop app falls back to the phone layout. */
export const DESKTOP_MIN_WIDTH = 900;

/** True on the desktop app (and in a wide browser window): side-by-side blocks, modal forms. */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

/**
 * Right-click handler for web/desktop. Spread onto a Pressable or View; does nothing on phones,
 * where the same action is reached with a long press.
 */
export function contextMenuProps(onMenu: () => void): object {
  if (Platform.OS !== 'web') return {};
  return {
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      onMenu();
    },
  };
}
