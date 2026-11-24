import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { uid } from '@/lib/format';
import { deviceStorage } from './storage';

/** A folder of notes. Folders nest through `parentId` (no parent = top level). */
export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
};

/** A note ("file"): lives in one folder (or at the top level) and carries any number of tags. */
export type Note = {
  id: string;
  title: string;
  body: string;
  folderId?: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type NotesState = {
  folders: Folder[];
  notes: Note[];
  /** Folders shown expanded in the tree. */
  openFolders: string[];
  addFolder: (name: string, parentId?: string) => string;
  renameFolder: (id: string, name: string) => void;
  /** Delete a folder with everything inside it (sub-folders and their notes). */
  removeFolder: (id: string) => void;
  toggleFolder: (id: string, open?: boolean) => void;
  addNote: (n?: { folderId?: string; title?: string }) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'tags' | 'pinned'>>) => void;
  removeNote: (id: string) => void;
};

// ---- Tree helpers ----

/** Ids of `id` and every folder beneath it. */
export function folderSubtree(folders: Folder[], id: string) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Folder names from the top level down to `id`. */
export function folderPath(folders: Folder[], id?: string) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur && path.length < 20) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Every folder in tree order, with its depth (for pickers). */
export function flattenFolders(folders: Folder[], parentId?: string, depth = 0): { folder: Folder; depth: number }[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((f) => [{ folder: f, depth }, ...flattenFolders(folders, f.id, depth + 1)]);
}

/** Tags in use, most used first. */
export function tagCounts(notes: { tags: string[] }[]) {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Tidy a typed tag: lower case, no leading #, words joined with dashes. */
export function cleanTag(raw: string) {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 32);
}


export const useNotes = create<NotesState>()(
  persist(
    (set) => ({
      folders: [],
      notes: [],
      openFolders: ['f2'],
      addFolder: (name, parentId) => {
        const id = uid();
        set((s) => ({
          folders: [...s.folders, { id, name, parentId, createdAt: Date.now() }],
          // Open the parent so the new folder is visible.
          openFolders: parentId && !s.openFolders.includes(parentId) ? [...s.openFolders, parentId] : s.openFolders,
        }));
        return id;
      },
      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),
      removeFolder: (id) =>
        set((s) => {
          const gone = folderSubtree(s.folders, id);
          return {
            folders: s.folders.filter((f) => !gone.has(f.id)),
            notes: s.notes.filter((n) => !n.folderId || !gone.has(n.folderId)),
            openFolders: s.openFolders.filter((f) => !gone.has(f)),
          };
        }),
      toggleFolder: (id, open) =>
        set((s) => {
          const isOpen = s.openFolders.includes(id);
          const next = open ?? !isOpen;
          if (next === isOpen) return s;
          return { openFolders: next ? [...s.openFolders, id] : s.openFolders.filter((f) => f !== id) };
        }),
      addNote: (n) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          notes: [
            { id, title: n?.title ?? '', body: '', folderId: n?.folderId, tags: [], pinned: false, createdAt: now, updatedAt: now },
            ...s.notes,
          ],
          openFolders:
            n?.folderId && !s.openFolders.includes(n.folderId) ? [...s.openFolders, n.folderId] : s.openFolders,
        }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    {
      name: 'hani.notes',
      version: 10,
      storage: deviceStorage,
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),

      // A note left blank (say the app was closed mid-way through a new one) is dropped on load.
      merge: (saved, current) => {
        const s = { ...current, ...(saved as Partial<NotesState>) };
        return { ...s, notes: s.notes.filter((n) => n.title.trim() || n.body.trim() || n.tags.length) };
      },
    },
  ),
);
