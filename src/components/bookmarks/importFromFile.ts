import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { ask } from '@/lib/ask';
import { parseImport } from '@/lib/importBookmarks';
import { isLive, useBookmarks } from '@/store/bookmarks';
import { plural } from './meta';

/** Lets you pick a CSV or JSON file, shows what's in it, and imports on confirm. */
export async function importFromFile() {
  let name = '';
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      // Android often reports CSV/JSON files under generic types, so stay permissive.
      type: ['text/*', 'application/json', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    name = asset.name;
    const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
    const { links, skipped } = parseImport(text, name);

    const { bookmarks, importLinks } = useBookmarks.getState();
    const saved = new Set(bookmarks.filter(isLive).map((b) => b.url));
    const fresh = new Set(links.map((l) => l.url).filter((u) => !saved.has(u))).size;
    const dupes = links.length - fresh;
    const folders = new Set(links.filter((l) => l.path.length).map((l) => l.path.join(' / '))).size;

    if (fresh === 0) {
      ask('Nothing new to import', `All ${plural(links.length, 'link')} in ${name} are already saved.`, [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    const details = [
      folders ? `They are sorted into ${plural(folders, 'collection')}.` : 'They will land in Unsorted.',
      dupes ? `${plural(dupes, 'link')} already saved will be skipped.` : '',
      skipped ? `${plural(skipped, 'row')} without a usable link will be left out.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    ask(`Import ${plural(fresh, 'link')}?`, `From ${name}. ${details}`, [
      {
        text: `Import ${plural(fresh, 'link')}`,
        onPress: () => {
          const r = importLinks(links);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          ask(
            'Imported',
            `${plural(r.added, 'link')} added${r.collections ? `, ${plural(r.collections, 'new collection')} created` : ''}.`,
            [{ text: 'Done', style: 'cancel' }],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } catch (e) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    ask("Couldn't import", e instanceof Error && e.message ? e.message : `${name || 'That file'} could not be read.`, [
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
