import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors } from '@/theme';

/**
 * A soft tonal surface: flat fill, generous corners, no outline and no shadow.
 * Pressable cards shrink a touch under the finger and spring back.
 */

type Props = {
  color?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

const SPRING = { duration: 260, dampingRatio: 0.9 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  color = colors.surface,
  children,
  style,
  padding = 16,
  radius = 28,
  onPress,
  onLongPress,
  accessibilityLabel,
}: Props) {
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.035 }],
  }));
  const look = { backgroundColor: color, borderRadius: radius, borderCurve: 'continuous' as const, padding };

  if (!onPress && !onLongPress) return <Animated.View style={[look, style]}>{children}</Animated.View>;
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => pressed.set(withSpring(1, SPRING))}
      onPressOut={() => pressed.set(withSpring(0, SPRING))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[look, style, pressStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
