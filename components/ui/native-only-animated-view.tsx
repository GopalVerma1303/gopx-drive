/**
 * Native Only Animated View Component
 * Animated View that only uses native animations
 */

import { composeStyle } from "@/lib/utils";
import type { ViewProps, ViewStyle } from "react-native";
import { View } from "react-native";
import * as React from "react";

// Use a type-only import to avoid runtime issues
type BaseAnimationBuilder = any;

type NativeOnlyAnimatedViewProps = ViewProps & {
  entering?: BaseAnimationBuilder;
  exiting?: BaseAnimationBuilder;
  style?: ViewStyle;
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
  style,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  const AnimatedView = getAnimatedView();

  // Fallback to regular View if Reanimated is not available
  if (!AnimatedView) {
    return (
      <View style={composeStyle(style)} {...props}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedView
      entering={entering}
      exiting={exiting}
      style={composeStyle(style)}
      {...props}
    >
      {children}
    </AnimatedView>
  );
}
