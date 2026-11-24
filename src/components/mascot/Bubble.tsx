import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, themed } from '@/theme';

/** Speech bubble for Hazel. The tail points towards her: left by default, or down. */
export function Bubble({
  text,
  color = colors.surface,
  ink,
  tail = 'left',
}: {
  text: string;
  color?: string;
  /** Text colour; set it when `color` doesn't follow light/dark (e.g. a cream bubble). */
  ink?: string;
  tail?: 'left' | 'down';
}) {
  const down = tail === 'down';
  return (
    <View style={[styles.wrap, down && styles.wrapDown]}>
      {!down && <View style={[styles.tail, styles.tailLeft, { backgroundColor: color }]} />}
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={[styles.text, ink ? { color: ink } : null]}>{text}</Text>
      </View>
      {down && <View style={[styles.tail, styles.tailDown, { backgroundColor: color }]} />}
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  wrap: { flexShrink: 1, flexDirection: 'row', alignItems: 'center' },
  wrapDown: { flexDirection: 'column', alignItems: 'flex-end' },
  bubble: {
    flexShrink: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tail: { width: 11, height: 11, borderRadius: 2.5, transform: [{ rotate: '45deg' }] },
  tailLeft: { marginRight: -7 },
  tailDown: { marginTop: -7, marginRight: 30 },
  text: { fontFamily: fonts.displaySoft, fontSize: 14, color: colors.ink, lineHeight: 18 },
  }),
);
