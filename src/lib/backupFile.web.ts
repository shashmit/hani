import { isTauri } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export const canShare = false;

/**
 * Desktop app: asks where to save, then writes the backup there. Resolves false if you
 * close the save window. Plain browser preview: downloads the file.
 */
export async function saveBackupFile(name: string, text: string): Promise<boolean> {
  if (isTauri()) {
    const path = await save({ defaultPath: name, filters: [{ name: 'hani backup', extensions: ['json'] }] });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function shareBackupFile(name: string, text: string) {
  await saveBackupFile(name, text);
}
