import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { ask } from '@/lib/ask';
import { currentSummary, isEmpty, makeBackup, readBackup, restoreBackup, type BackupSummary } from '@/lib/backup';
import { canShare, saveBackupFile, shareBackupFile } from '@/lib/backupFile';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const good = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const bad = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
const reason = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** "12 expenses, 4 tasks, 30 links and 2 notes", leaving out what there is none of. */
export function describe(s: BackupSummary) {
  const parts = [
    s.expenses ? plural(s.expenses, 'expense') : '',
    s.places ? plural(s.places, 'place') : '',
    s.tasks ? plural(s.tasks, 'task') : '',
    s.links ? plural(s.links, 'link') : '',
    s.collections ? plural(s.collections, 'collection') : '',
    s.notes ? plural(s.notes, 'note') : '',
    s.folders ? plural(s.folders, 'folder') : '',
  ].filter(Boolean);
  if (parts.length === 0) return 'nothing yet';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Saves everything in the app to a backup file you choose a place for. */
export function exportBackup() {
  const { name, text, summary } = makeBackup();
  const run = async (how: 'save' | 'share') => {
    try {
      if (how === 'share') return await shareBackupFile(name, text);
      if (!(await saveBackupFile(name, text))) return;
      good();
      ask('Backup saved', `${name} holds ${describe(summary)}. Keep it somewhere safe.`, [{ text: 'Done', style: 'cancel' }]);
    } catch (e) {
      bad();
      ask("Couldn't save the backup", reason(e, 'Something went wrong while writing the file.'), [{ text: 'OK', style: 'cancel' }]);
    }
  };
  if (!canShare) return void run('save');
  ask('Back up your stash', `One file with ${describe(summary)}.`, [
    { text: 'Save to a folder', onPress: () => void run('save') },
    { text: 'Send to another app', onPress: () => void run('share') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

/**
 * Lets you pick a backup file, shows what is in it, and puts it back on confirm. What is
 * in the app is replaced. `onDone` runs after a restore.
 */
export async function importBackup(onDone?: () => void) {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      // Android often reports JSON files under generic types, so stay permissive.
      type: ['application/json', 'text/*', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
    const backup = await readBackup(text);

    const made = backup.exportedAt ? new Date(backup.exportedAt) : null;
    const when = made && !Number.isNaN(made.getTime()) ? ` from ${made.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    const here = currentSummary();
    const replaces = isEmpty(here) ? '' : ` It replaces what is here now: ${describe(here)}.`;
    ask('Restore this backup?', `${asset.name}${when} holds ${describe(backup.summary)}.${replaces}`, [
      {
        text: 'Restore',
        style: isEmpty(here) ? 'default' : 'destructive',
        onPress: () => {
          restoreBackup(backup);
          good();
          onDone?.();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } catch (e) {
    bad();
    ask("Couldn't restore", reason(e, 'That file could not be read.'), [{ text: 'OK', style: 'cancel' }]);
  }
}
