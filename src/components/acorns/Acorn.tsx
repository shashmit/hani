import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

/**
 * A little acorn built from two flat shapes (cap + nut). `empty` draws it as a pale
 * silhouette in `emptyColor`, for the unfilled part of a meter.
 */
export function Acorn({
  size = 18,
  empty,
  emptyColor = 'rgba(42,29,20,0.13)',
  style,
}: {
  size?: number;
  empty?: boolean;
  emptyColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const h = size * 1.14;
  const capH = size * 0.42;
  const nutW = size * 0.78;
  return (
    <View style={[{ width: size, height: h, alignItems: 'center' }, style]}>
      <View
        style={{
          position: 'absolute',
          top: capH * 0.7,
          width: nutW,
          height: h - capH * 0.7,
          backgroundColor: empty ? emptyColor : colors.acorn,
          borderTopLeftRadius: nutW * 0.2,
          borderTopRightRadius: nutW * 0.2,
          borderBottomLeftRadius: nutW * 0.5,
          borderBottomRightRadius: nutW * 0.5,
        }}
      />
      <View
        style={{
          width: size,
          height: capH,
          backgroundColor: empty ? emptyColor : colors.acornCap,
          borderTopLeftRadius: size * 0.5,
          borderTopRightRadius: size * 0.5,
          borderBottomLeftRadius: size * 0.14,
          borderBottomRightRadius: size * 0.14,
        }}
      />
    </View>
  );
}

/** A row of acorns, the first `filled` of them solid. Used as a tiny meter. */
export function AcornRow({
  total,
  filled,
  size = 14,
  emptyColor,
}: {
  total: number;
  filled: number;
  size?: number;
  emptyColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.26 }}>
      {Array.from({ length: total }, (_, i) => (
        <Acorn key={i} size={size} empty={i >= filled} emptyColor={emptyColor} />
      ))}
    </View>
  );
}
