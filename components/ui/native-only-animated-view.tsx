import { cn } from '@/lib/utils';
import type { ViewProps } from 'react-native';
import Animated, { type BaseAnimationBuilder } from 'react-native-reanimated';

type NativeOnlyAnimatedViewProps = ViewProps & {
  entering?: BaseAnimationBuilder | typeof BaseAnimationBuilder;
  exiting?: BaseAnimationBuilder | typeof BaseAnimationBuilder;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Animated View component that only uses native animations.
 * On web, this should use the web-specific implementation.
 */
export function NativeOnlyAnimatedView({
  className,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      className={cn(className)}
      {...props}>
      {children}
    </Animated.View>
  );
}
