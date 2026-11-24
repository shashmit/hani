import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Phones can also hand the file to another app (Drive, mail, a chat with yourself). */
export const canShare = true;

/**
 * Lets you pick a folder and writes the backup into it. Resolves false if you back out
 * of the picker.
 */
export async function saveBackupFile(name: string, text: string): Promise<boolean> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (e instanceof Error && /cancel/i.test(e.message)) return false;
    throw e;
  }
  const file = folder.createFile(name, 'application/json');
  await file.write(text);
  return true;
}

/** Opens the share sheet with the backup file. */
export async function shareBackupFile(name: string, text: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your hani backup' });
}
