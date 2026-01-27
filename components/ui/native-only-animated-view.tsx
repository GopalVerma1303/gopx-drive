import { cn } from "@/lib/utils";
import React from "react";
import type { ViewProps } from "react-native";
import { View } from "react-native";

// Use a type-only import to avoid runtime issues
type BaseAnimationBuilder = any;

type NativeOnlyAnimatedViewProps = ViewProps & {
  entering?: BaseAnimationBuilder;
  exiting?: BaseAnimationBuilder;
  className?: string;
  children?: React.ReactNode;
};

// Lazy load Reanimated to avoid initialization crashes
let AnimatedModule: any = null;
let AnimatedViewComponent: any = null;

function getAnimatedView() {
  if (AnimatedViewComponent) {
    return AnimatedViewComponent;
  }

  try {
    // Try to require Reanimated - this may throw if not properly initialized
    const Reanimated = require("react-native-reanimated");
    const Animated = Reanimated?.default || Reanimated;

    if (Animated && Animated.View) {
      AnimatedModule = Animated;
      AnimatedViewComponent = Animated.View;
      return AnimatedViewComponent;
    }
  } catch (error) {
    // Reanimated not available or failed to initialize
    // Will use fallback View
  }

  return null;
}

/**
 * Animated View component that only uses native animations.
 * On web, this should use the web-specific implementation.
 * Falls back to regular View if Reanimated is not available.
 */
export function NativeOnlyAnimatedView({
  className,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  const AnimatedView = getAnimatedView();

  // Always wrap children in a View to ensure single child for React.Children.only
  // This is necessary because AnimatedView from react-native-reanimated uses React.Children.only
  // which requires exactly one React element child
  // The wrapper View is transparent and doesn't affect layout
  const wrappedChildren = children != null ? <View>{children}</View> : null;

  // Fallback to regular View if Reanimated is not available
  if (!AnimatedView) {
    return (
      <View className={cn(className)} {...props}>
        {wrappedChildren}
      </View>
    );
  }

  return (
    <AnimatedView
      entering={entering}
      exiting={exiting}
      className={cn(className)}
      {...props}
    >
      {wrappedChildren}
    </AnimatedView>
  );
}
