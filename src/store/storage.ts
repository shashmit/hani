import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage } from 'zustand/middleware';

/** All app data lives on-device in SQLite (no accounts, no network). */
export const deviceStorage = createJSONStorage(() => Storage);
