import { cn } from '@/lib/utils';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

type NativeOnlyAnimatedViewProps = ViewProps & {
  entering?: unknown;
  exiting?: unknown;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Web implementation of NativeOnlyAnimatedView.
 * On web, we use CSS animations instead of react-native-reanimated,
 * so this is just a regular View.
 */
export function NativeOnlyAnimatedView({
  className,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  // On web, animations are handled by CSS/Tailwind classes
  // so we just render a regular View
  return (
    <View className={cn(className)} {...props}>
      {children}
    </View>
  );
}
