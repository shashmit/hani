import { create } from 'zustand';

export type AskButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AskDialog = { title: string; message?: string; buttons: AskButton[] };

/** The dialog currently shown on web/desktop (rendered by <DialogHost />). */
export const useDialog = create<{ dialog: AskDialog | null; close: () => void }>()((set) => ({
  dialog: null,
  close: () => set({ dialog: null }),
}));

/**
 * Ask the user to pick an action, in hani's own dialog (rendered by <DialogHost />) on
 * every platform: it matches the app and, unlike Android's alert, takes any number of
 * buttons.
 */
export function ask(title: string, message: string | undefined, buttons: AskButton[]) {
  useDialog.setState({ dialog: { title, message, buttons } });
}
