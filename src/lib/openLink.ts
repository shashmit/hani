import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { colors } from '@/theme';

/** Open a link in an in-app browser tab (a new browser tab on web/desktop). */
export async function openLink(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.forest,
      showTitle: true,
      enableBarCollapsing: true,
    });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
