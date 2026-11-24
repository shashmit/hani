import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { fonts, radius, themed } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
  /** honey: main action. dark: main action on light ground. ghost: quiet. glass: quiet, on the forest hero. */
  variant?: 'honey' | 'ghost' | 'dark' | 'glass';
  icon?: React.ComponentProps<typeof Feather>['name'];
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: ViewStyle;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { duration: 240, dampingRatio: 0.9 };

export function PillButton({
  label,
  onPress,
  variant = 'honey',
  icon,
  size = 'md',
  disabled,
  style,
}: Props) {
  const v = VARIANTS[variant];
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.04 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => pressed.set(withSpring(1, SPRING))}
      onPressOut={() => pressed.set(withSpring(0, SPRING))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: v.bg },
        disabled && { opacity: 0.4 },
        animated,
        style,
      ]}
    >
      {icon && <Feather name={icon} size={size === 'sm' ? 14 : 16} color={v.fg} />}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: v.fg }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const VARIANTS = themed(
  (colors): Record<NonNullable<Props['variant']>, { bg: string; fg: string }> => ({
    honey: { bg: colors.honey, fg: colors.onHoney },
    ghost: { bg: colors.chip, fg: colors.ink },
    dark: { bg: colors.ink, fg: colors.onInk },
    glass: { bg: 'rgba(255,244,223,0.14)', fg: colors.cream },
  }),
);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.pill,
  },
  md: { height: 52, paddingHorizontal: 22 },
  sm: { height: 38, paddingHorizontal: 16 },
  label: { fontFamily: fonts.displaySoft, fontSize: 16.5 },
  labelSm: { fontSize: 14 },
});
