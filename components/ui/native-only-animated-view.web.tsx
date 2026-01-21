import { cn } from '@/lib/utils';
import React from 'react';
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
 * However, we still need to ensure single child for compatibility with Radix UI Slot.
 */
export function NativeOnlyAnimatedView({
  className,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  // Always wrap children in a View to ensure single child
  // This is necessary because Radix UI Slot uses React.Children.only
  const wrappedChildren = children != null ? <View>{children}</View> : null;

  // On web, animations are handled by CSS/Tailwind classes
  // so we just render a regular View
  return (
    <View className={cn(className)} {...props}>
      {wrappedChildren}
    </View>
  );
}
