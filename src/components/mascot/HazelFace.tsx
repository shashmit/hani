import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Hazel head-on, the app icon's artwork (100x100 artboard). Split into layers so the
 * acorn can fly on its own (see Intro): face → acorn → teeth. The teeth sit on top so
 * that when the acorn is caught, they bite into its cap.
 */

const FUR = '#C8642B';
const FUR_LIGHT = '#E08A4A';
const CREAM = '#F6DDBE';
const PINK = '#F2A7A0';
const TOP = '#D47437';

export function FaceLayer({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M25.5 40 C 19 27 19.5 13 24 6.5 C 33 10.5 41 19 44.5 30 Z" fill={FUR} />
      <Path d="M74.5 40 C 81 27 80.5 13 76 6.5 C 67 10.5 59 19 55.5 30 Z" fill={FUR} />
      <Path d="M28.5 34 C 25.5 25 25.8 17 27.6 13 C 33 16.5 37.5 22 40 29 Z" fill={PINK} />
      <Path d="M71.5 34 C 74.5 25 74.2 17 72.4 13 C 67 16.5 62.5 22 60 29 Z" fill={PINK} />
      <Ellipse cx={50} cy={50} rx={31.5} ry={28.5} fill={FUR} />
      <Ellipse cx={50} cy={34} rx={14} ry={6} fill={TOP} opacity={0.45} />
      <Circle cx={30.5} cy={61} r={14.5} fill={FUR_LIGHT} />
      <Circle cx={69.5} cy={61} r={14.5} fill={FUR_LIGHT} />
      <Ellipse cx={50} cy={63.5} rx={16.5} ry={12} fill={CREAM} />
      <Circle cx={26.5} cy={56.5} r={4.4} fill={PINK} opacity={0.9} />
      <Circle cx={73.5} cy={56.5} r={4.4} fill={PINK} opacity={0.9} />
      <Ellipse cx={39} cy={46} rx={4.4} ry={5.5} fill="#16121F" />
      <Ellipse cx={61} cy={46} rx={4.4} ry={5.5} fill="#16121F" />
      <Circle cx={40.7} cy={43.8} r={1.7} fill="#fff" />
      <Circle cx={62.7} cy={43.8} r={1.7} fill="#fff" />
      <Path d="M46.3 54.6 Q50 52 53.7 54.6 Q52.2 57.8 50 58.2 Q47.8 57.8 46.3 54.6 Z" fill="#3A1E12" />
      {/* Mouth, seen while the acorn is away */}
      <Path d="M44 66 Q50 71 56 66" stroke="#3A1E12" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** The acorn, drawn in the same 100x100 box at its resting spot in the mouth. */
export function AcornLayer({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="rotate(-12 50 74)">
        <Ellipse cx={50} cy={76} rx={13} ry={11} fill="#B5672F" />
        <Ellipse cx={45.5} cy={77} rx={3.6} ry={5} fill="#CF8247" opacity={0.75} />
        <Path d="M35.6 71.5 C 36.5 61 63.5 61 64.4 71.5 C 56 75 44 75 35.6 71.5 Z" fill="#6E4220" />
        <Path
          d="M40 67 L 44 71 M46 65 L 50 70.5 M52 65 L 56 70.5 M58 66.5 L 61 70"
          stroke="#53311A"
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

export function TeethLayer({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={46.9} y={58.4} width={2.9} height={4.4} rx={0.9} fill="#FFFDF8" />
      <Rect x={50.2} y={58.4} width={2.9} height={4.4} rx={0.9} fill="#FFFDF8" />
    </Svg>
  );
}

/** Where the acorn rests, as a fraction of the box (for pivoting it as it spins). */
export const ACORN_ORIGIN = { x: 0.5, y: 0.72 };

/** Static Hazel with her acorn: the app icon, in-app. */
export function HazelFace({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="Hazel">
      <FaceLayer size={size} />
      <View style={StyleSheet.absoluteFill}>
        <AcornLayer size={size} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <TeethLayer size={size} />
      </View>
    </View>
  );
}
