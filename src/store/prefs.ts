import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ThemeName } from '@/theme';

import { deviceStorage } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

type PrefsState = {
  /** Finished (or skipped) the first-run tour. */
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  /** Seen (or skipped) the short how-to on the home screen. */
  guided: boolean;
  setGuided: (v: boolean) => void;
  /** Light, dark, or whatever the phone is set to. */
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  /** Which colour theme (Woodland, Sagebrush, ...). */
  palette: ThemeName;
  setPalette: (p: ThemeName) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),
      guided: false,
      setGuided: (guided) => set({ guided }),
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      palette: 'woodland',
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'hani.prefs',
      version: 10,
      storage: deviceStorage,
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),
    },
  ),
);

/** False until saved prefs have loaded from the device (so we don't flash the tour). */
export function usePrefsReady() {
  return useSyncExternalStore(
    (onChange) => usePrefs.persist.onFinishHydration(onChange),
    () => usePrefs.persist.hasHydrated(),
    () => true,
  );
}
