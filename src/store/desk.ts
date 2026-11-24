import { create } from 'zustand';

/**
 * Desktop only, not saved: which block the window is on. Kept outside the home screen so
 * full pages (settings, a note) can show the same sidebar and send you back to a block.
 */
export const useDesk = create<{ block: string | null; setBlock: (key: string) => void }>()((set) => ({
  block: null,
  setBlock: (block) => set({ block }),
}));
