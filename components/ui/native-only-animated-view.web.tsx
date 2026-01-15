/**
 * Web implementation of NativeOnlyAnimatedView
 * On web, we use CSS animations instead of react-native-reanimated
 */

import { composeStyle } from "@/lib/utils";
import type { ViewProps, ViewStyle } from "react-native";
import { View } from "react-native";
import * as React from "react";

type NativeOnlyAnimatedViewProps = ViewProps & {
  entering?: unknown;
  exiting?: unknown;
  style?: ViewStyle;
  children?: React.ReactNode;
};

/**
 * Web implementation of NativeOnlyAnimatedView.
 * On web, animations are handled by CSS, so this is just a regular View.
 */
export function NativeOnlyAnimatedView({
  style,
  entering,
  exiting,
  children,
  ...props
}: NativeOnlyAnimatedViewProps) {
  // On web, animations are handled by CSS
  // so we just render a regular View
  return (
    <View style={composeStyle(style)} {...props}>
      {children}
    </View>
  );
}
