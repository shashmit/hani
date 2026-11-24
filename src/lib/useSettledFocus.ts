import { useEffect, useRef, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

/** Roughly how long a form sheet or page takes to slide into place. */
const SETTLE_MS = 420;

/**
 * Focuses a field once its screen has finished sliding in, instead of `autoFocus`.
 *
 * With `autoFocus` the keyboard opens while the sheet is still rising, so the keyboard
 * avoidance measures the field mid-flight (low on the screen, "under" the keyboard) and
 * scrolls the form to the wrong place. Waiting until the sheet is settled keeps the
 * form where it belongs, with the field and the keyboard both in view.
 *
 * Returns the ref to put on the TextInput. `when` is read when the screen opens (and
 * again if it changes, e.g. a link pasted in before the delay cancels the focus).
 */
export function useSettledFocus(when = true) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (!when) return;
    const t = setTimeout(() => ref.current?.focus(), SETTLE_MS);
    return () => clearTimeout(t);
  }, [when]);
  return ref;
}
