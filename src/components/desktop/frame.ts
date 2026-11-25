/** Shared look of the desktop window: bark frame, sidebar on the bark, one rounded workspace. */

/** Marks an element as a handle for moving the Tauri window (web-only `dataSet` → `data-*`). */
export const DRAG_REGION = { dataSet: { tauriDragRegion: '' } } as object;

/** Strip at the top of the sidebar that clears the macOS window buttons. */
export const TOP_CLEAR = 52;
/** Room for the macOS window buttons when something sits beside them. */
export const LIGHTS_W = 92;

export const SIDEBAR_W = 264;
/** The sidebar folded down to icons. Wide enough to hold the macOS window buttons with room either side. */
export const RAIL_W = 88;
/** Bark showing around the workspace. */
export const FRAME_PAD = 10;
export const SHEET_RADIUS = 26;

/** Widest the content of a full-page route (e.g. the note editor) runs inside the workspace. */
export const PAGE_MAX = 760;

/** Keyboard shortcut letter for each block's add button. */
export const ADD_KEY: Record<string, string> = { money: 'E', tasks: 'T', bookmarks: 'L', notes: 'N' };

export const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
export const MOD = IS_MAC ? '⌘' : 'Ctrl ';

/** Cream on bark, at a few strengths. */
export const ON_BARK = {
  text: '#FFF4DF',
  soft: 'rgba(255,244,223,0.66)',
  faint: 'rgba(255,244,223,0.4)',
  hover: 'rgba(255,244,223,0.08)',
  fill: 'rgba(255,244,223,0.12)',
};
