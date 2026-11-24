import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deviceStorage } from './storage';

/** The user's order for the home blocks (keys). Empty means the built-in order. */
type LayoutState = {
  order: string[];
  setOrder: (order: string[]) => void;
  /** Desktop: the sidebar is folded down to a strip of icons. */
  railOnly: boolean;
  setRailOnly: (v: boolean) => void;
};

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      order: [],
      setOrder: (order) => set({ order }),
      railOnly: false,
      setRailOnly: (railOnly) => set({ railOnly }),
    }),
    {
      name: 'hani.layout',
      version: 10,
      storage: deviceStorage,
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),
    },
  ),
);

/**
 * Blocks in the user's order. Blocks the saved order doesn't know yet (added in an
 * update) keep their built-in place at the end; keys that no longer exist are dropped.
 */
export function orderBlocks<T extends { key: string }>(blocks: T[], order: string[]): T[] {
  if (order.length === 0) return blocks;
  const rank = new Map(order.map((k, i) => [k, i]));
  return [...blocks].sort(
    (a, b) =>
      (rank.get(a.key) ?? order.length + blocks.indexOf(a)) - (rank.get(b.key) ?? order.length + blocks.indexOf(b)),
  );
}
