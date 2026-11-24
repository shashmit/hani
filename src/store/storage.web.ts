import { isTauri } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Desktop app (Tauri): data lives in `hani.json` in the app's data folder on this
 * machine. Plain browser preview: localStorage. Phones use on-device SQLite (storage.ts).
 */
function desktopStorage(): StateStorage<Promise<void> | void> {
  const store = new LazyStore('hani.json', { autoSave: false });
  return {
    getItem: async (name) => (await store.get<string>(name)) ?? null,
    setItem: async (name, value) => {
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name) => {
      await store.delete(name);
      await store.save();
    },
  };
}

export const deviceStorage = createJSONStorage<unknown, Promise<void> | void>(() => (isTauri() ? desktopStorage() : localStorage));
