import { Platform } from 'react-native';

import { isLive, useBookmarks } from '@/store/bookmarks';
import { useExpenses } from '@/store/expenses';
import { useLayout } from '@/store/layout';
import { useNotes } from '@/store/notes';
import { usePrefs } from '@/store/prefs';
import { useTasks } from '@/store/tasks';

/**
 * Backups: one JSON file holding everything hani keeps (money, tasks, bookmarks, notes,
 * block order, theme). The same file works on the phone and on the desktop app.
 *
 * Each store goes in as the data it saves on the device, with that store's version, so a
 * backup from an older hani runs through the store's own migration when it comes back.
 */
const FORMAT = 1;

type Plain = Record<string, unknown>;
type AnyStore = {
  getState: () => object;
  setState: (patch: Plain) => void;
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
    getOptions: () => {
      version?: number;
      partialize?: (state: never) => unknown;
      migrate?: (state: unknown, version: number) => unknown;
    };
  };
};

const STORES: Record<string, AnyStore> = {
  expenses: useExpenses,
  tasks: useTasks,
  bookmarks: useBookmarks,
  notes: useNotes,
  layout: useLayout,
  prefs: usePrefs,
};

/** Saved per device, not carried over: whether this device has seen the tour and how-to. */
const LEFT_OUT: Record<string, string[]> = { prefs: ['onboarded', 'guided'] };

export type BackupSummary = {
  expenses: number;
  places: number;
  tasks: number;
  links: number;
  collections: number;
  notes: number;
  folders: number;
};

export type Backup = {
  /** When the backup was made (ISO date), if the file says. */
  exportedAt?: string;
  summary: BackupSummary;
  stores: Record<string, Plain>;
};

const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);

function summarize(stores: Record<string, Plain | undefined>): BackupSummary {
  const links = stores.bookmarks?.bookmarks;
  return {
    expenses: count(stores.expenses?.expenses),
    places: count(stores.expenses?.places),
    tasks: count(stores.tasks?.tasks),
    links: Array.isArray(links) ? links.filter(isLive).length : 0,
    collections: count(stores.bookmarks?.collections),
    notes: count(stores.notes?.notes),
    folders: count(stores.notes?.folders),
  };
}

/** What a store saves on the device, as plain data. */
function snapshot(key: string): Plain {
  const store = STORES[key];
  const state = store.getState();
  const saved = store.persist.getOptions().partialize?.(state as never) ?? state;
  // Through JSON: drops the store's functions and anything else that can't be saved.
  const plain = JSON.parse(JSON.stringify(saved)) as Plain;
  for (const k of LEFT_OUT[key] ?? []) delete plain[k];
  return plain;
}

/** Resolves once everything saved on this device has been read in. */
export function whenLoaded() {
  return Promise.all(
    Object.values(STORES).map(
      (store) =>
        new Promise<void>((done) => {
          if (store.persist.hasHydrated()) return done();
          const stop = store.persist.onFinishHydration(() => {
            stop();
            done();
          });
        }),
    ),
  );
}

/** What is in the app right now. */
export function currentSummary(): BackupSummary {
  return summarize(Object.fromEntries(Object.keys(STORES).map((k) => [k, snapshot(k)])));
}

export function isEmpty(s: BackupSummary) {
  return Object.values(s).every((n) => n === 0);
}

/** The text of a backup file for everything in the app right now. */
export function makeBackup(now = new Date()): { name: string; text: string; summary: BackupSummary } {
  const stores: Record<string, { version: number; state: Plain }> = {};
  const plain: Record<string, Plain> = {};
  for (const key of Object.keys(STORES)) {
    plain[key] = snapshot(key);
    stores[key] = { version: STORES[key].persist.getOptions().version ?? 0, state: plain[key] };
  }
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    name: `hani-backup-${day}.json`,
    text: JSON.stringify({ app: 'hani', format: FORMAT, exportedAt: now.toISOString(), from: Platform.OS, stores }, null, 2),
    summary: summarize(plain),
  };
}

/** Same kind of value, so a damaged file can't put text where a list belongs. */
function sameKind(a: unknown, b: unknown) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && b.every((item) => typeof item === 'string' || isPlain(item));
  }
  return typeof a === typeof b && (a === null) === (b === null);
}

/**
 * Reads a backup file. Throws an Error with a message fit to show if the file is not a
 * hani backup or was made by a newer version of hani.
 */
export async function readBackup(text: string): Promise<Backup> {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('That file is not a hani backup.');
  }
  if (!isPlain(file) || file.app !== 'hani' || !isPlain(file.stores)) throw new Error('That file is not a hani backup.');
  const newer = new Error('That backup was made by a newer hani. Update the app, then try again.');
  if (typeof file.format !== 'number' || file.format > FORMAT) throw newer;

  const stores: Record<string, Plain> = {};
  for (const [key, store] of Object.entries(STORES)) {
    const entry = file.stores[key];
    if (!isPlain(entry) || !isPlain(entry.state)) continue;
    const { version = 0, migrate } = store.persist.getOptions();
    const from = typeof entry.version === 'number' ? entry.version : 0;
    if (from > version) throw newer;
    const state = from < version && migrate ? await migrate(entry.state, from) : entry.state;
    if (!isPlain(state)) continue;

    // Keep only what this store knows, and only if it is the right kind of value.
    const known = store.getState() as Plain;
    const clean: Plain = {};
    for (const [k, v] of Object.entries(state)) {
      if (LEFT_OUT[key]?.includes(k)) continue;
      if (k in known && typeof known[k] !== 'function' && sameKind(known[k], v)) clean[k] = v;
    }
    if (Object.keys(clean).length) stores[key] = clean;
  }
  if (Object.keys(stores).length === 0) throw new Error('That backup has nothing in it that this hani can read.');

  return { exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : undefined, summary: summarize(stores), stores };
}

/** Replaces what is in the app with the backup. Each store saves itself to the device. */
export function restoreBackup(backup: Backup) {
  for (const [key, state] of Object.entries(backup.stores)) {
    // Bookmarks reopen on their home page: the open one may not exist in the backup.
    STORES[key].setState(key === 'bookmarks' ? { ...state, scope: 'home' } : state);
  }
}
