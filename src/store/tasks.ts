import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { dateKey, uid } from '@/lib/format';
import { deviceStorage } from './storage';

export type Priority = 'low' | 'med' | 'high';

export const PRIORITIES: Record<Priority, { label: string; bg: string; fg: string }> = {
  low: { label: 'Low', bg: '#EEF6F1', fg: '#16794A' },
  med: { label: 'Medium', bg: '#FFF2E6', fg: '#B5541B' },
  high: { label: 'High', bg: '#F3E4E4', fg: '#8E1B17' },
};

/** Deepest level a sub-task can sit at (0 = top-level task, 2 = sub-sub-task). */
export const MAX_DEPTH = 2;

/**
 * A to-do planned on a day. Tasks form a tree through `parentId`: a task with a
 * `parentId` is a sub-task and always lives on the same day as its top-level task.
 */
export type Task = {
  id: string;
  title: string;
  priority: Priority;
  done: boolean;
  /** Day key, "YYYY-MM-DD". */
  date: string;
  parentId?: string;
  createdAt: number;
};

type TasksState = {
  tasks: Task[];
  /** Day shown on the Tasks block (not saved; always starts on today). */
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  addTask: (t: { title: string; priority: Priority; date: string; parentId?: string }) => void;
  /** Tick / untick a task. Sub-tasks follow their parent; parents follow their sub-tasks. */
  toggleTask: (id: string) => void;
  /** Remove a task and everything under it. */
  removeTask: (id: string) => void;
  /** Move a top-level task, with its whole sub-tree, to another day. */
  moveTask: (id: string, date: string) => void;
  /** Bring every unfinished top-level task from before `date` onto `date`. */
  bringOverdueTo: (date: string) => void;
};

// ---- Tree helpers ----

export function childrenOf(tasks: Task[], id: string) {
  return tasks.filter((t) => t.parentId === id);
}

/** Ids of `id` and everything beneath it. */
export function subtreeIds(tasks: Task[], id: string) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Share of a task that is complete, 0..1, counting its leaves (tasks with no sub-tasks). */
export function completion(tasks: Task[], task: Task): number {
  const kids = childrenOf(tasks, task.id);
  if (kids.length === 0) return task.done ? 1 : 0;
  return kids.reduce((sum, k) => sum + completion(tasks, k), 0) / kids.length;
}

/** After a change under `parentId`, make each ancestor "done" exactly when all its children are. */
function syncAncestors(tasks: Task[], parentId: string | undefined): Task[] {
  let next = tasks;
  let current = parentId;
  while (current) {
    const id = current;
    const kids = childrenOf(next, id);
    const allDone = kids.length > 0 && kids.every((k) => k.done);
    next = next.map((t) => (t.id === id ? { ...t, done: allDone } : t));
    current = next.find((t) => t.id === id)?.parentId;
  }
  return next;
}

// ---- Sample data for a fresh install ----

export const useTasks = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],
      selectedDate: dateKey(),
      setSelectedDate: (selectedDate) => set({ selectedDate }),

      addTask: ({ title, priority, date, parentId }) =>
        set((s) => {
          const parent = parentId ? s.tasks.find((t) => t.id === parentId) : undefined;
          const task: Task = {
            id: uid(),
            title,
            priority,
            done: false,
            // A sub-task always shares its parent's day.
            date: parent ? parent.date : date,
            parentId: parent?.id,
            createdAt: Date.now(),
          };
          // A new unfinished sub-task re-opens its (possibly finished) ancestors.
          return { tasks: syncAncestors([...s.tasks, task], parent?.id) };
        }),

      toggleTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const done = !task.done;
          const ids = subtreeIds(s.tasks, id);
          const next = s.tasks.map((t) => (ids.has(t.id) ? { ...t, done } : t));
          return { tasks: syncAncestors(next, task.parentId) };
        }),

      removeTask: (id) =>
        set((s) => {
          const ids = subtreeIds(s.tasks, id);
          return { tasks: s.tasks.filter((t) => !ids.has(t.id)) };
        }),

      moveTask: (id, date) =>
        set((s) => {
          const ids = subtreeIds(s.tasks, id);
          return { tasks: s.tasks.map((t) => (ids.has(t.id) ? { ...t, date } : t)) };
        }),

      bringOverdueTo: (date) =>
        set((s) => {
          const ids = new Set<string>();
          for (const t of s.tasks) {
            if (!t.parentId && !t.done && t.date < date) {
              subtreeIds(s.tasks, t.id).forEach((x) => ids.add(x));
            }
          }
          return { tasks: s.tasks.map((t) => (ids.has(t.id) ? { ...t, date } : t)) };
        }),
    }),
    {
      name: 'hani.tasks',
      version: 10,
      storage: deviceStorage,
      // The selected day is a view setting, not data.
      partialize: (s) => ({ tasks: s.tasks }),
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),
    },
  ),
);
