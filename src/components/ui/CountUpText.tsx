import { Text, type TextProps } from 'react-native';

import { useCountUp } from '@/lib/useCountUp';

/**
 * A number that eases from its previous value to `value`. Only this Text re-renders
 * while it counts, not the screen around it.
 */
export function CountUpText({
  value,
  format,
  duration,
  ...props
}: TextProps & { value: number; format: (n: number) => string; duration?: number }) {
  const shown = useCountUp(value, duration);
  return <Text {...props}>{format(shown)}</Text>;
}
