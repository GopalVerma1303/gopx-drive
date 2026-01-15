/**
 * Atomic Text Component
 * Base building block for all text components
 */

import { composeStyle } from "@/lib/utils";
import * as React from "react";
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle,
} from "react-native";

export interface TextProps extends RNTextProps {
  style?: StyleProp<TextStyle>;
}

/**
 * Atomic Text component with enhanced style composition
 * Similar to Bluesky's atomic design approach
 */
export const Text = React.forwardRef<RNText, TextProps>(
  ({ style, ...props }, ref) => {
    return <RNText ref={ref} style={composeStyle(style)} {...props} />;
  }
);

Text.displayName = "Text";
