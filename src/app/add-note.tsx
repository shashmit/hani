import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { useNotes } from '@/store/notes';

/**
 * The dock's + on Notes: makes a blank note and swaps straight to its editor.
 * (Leaving the editor with nothing written throws the note away again.)
 */
export default function AddNote() {
  const made = useRef(false);
  useEffect(() => {
    if (made.current) return;
    made.current = true;
    const id = useNotes.getState().addNote({});
    router.replace({ pathname: '/note/[id]', params: { id } });
  }, []);
  return <View />;
}
