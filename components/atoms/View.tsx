/**
 * Atomic View Component
 * Base building block for all layout components
 */

import { composeStyle } from "@/lib/utils";
import {
  type ViewProps as RNViewProps,
  View as RNView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as React from "react";

export interface ViewProps extends RNViewProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Atomic View component with enhanced style composition
 * Similar to Bluesky's atomic design approach
 */
export const View = React.forwardRef<RNView, ViewProps>(
  ({ style, ...props }, ref) => {
    return <RNView ref={ref} style={composeStyle(style)} {...props} />;
  }
);

View.displayName = "View";
