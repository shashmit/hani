import { createContext, useContext } from 'react';

/**
 * Room a block must leave under its scrolling content. The pager sets it per sheet:
 * a block with a dock resting along its bottom edge needs to clear it; the last block
 * has no dock below. Blocks can be reordered, so none of them can hard-code this.
 */
export const BlockSpace = createContext({ bottom: 96 });

export const useBlockBottom = () => useContext(BlockSpace).bottom;

/**
 * Whether this block is the one on screen. Lets a block claim the Android back button
 * (to step out of a sub-page) only while you're looking at it. True outside the pager.
 */
export const BlockActive = createContext(true);

export const useBlockActive = () => useContext(BlockActive);
