/**
 * Style Utilities - Convert theme tokens to React Native styles
 */

import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { opacity, radius, shadows, spacing, typography } from "./tokens";

// Helper to get spacing value
export function getSpacing(value: keyof typeof spacing | number): number {
  if (typeof value === "number") return value;
  return spacing[value];
}

// Helper to get radius value
export function getRadius(value: keyof typeof radius | number): number {
  if (typeof value === "number") return value;
  return radius[value];
}

// Helper to get opacity value
export function getOpacity(value: keyof typeof opacity | number): number {
  if (typeof value === "number") return value;
  return opacity[value];
}

// Create shadow style
export function getShadow(
  size: keyof typeof shadows = "default"
): ViewStyle {
  return shadows[size];
}

// Create text style from variant
export function createTextStyle(
  variant: keyof typeof typography.fontSize = "base",
  options?: {
    weight?: keyof typeof typography.fontWeight;
    lineHeight?: keyof typeof typography.lineHeight;
    letterSpacing?: keyof typeof typography.letterSpacing;
  }
): TextStyle {
  return {
    fontSize: typography.fontSize[variant],
    fontWeight: options?.weight
      ? typography.fontWeight[options.weight]
      : typography.fontWeight.normal,
    lineHeight:
      typography.fontSize[variant] *
      (options?.lineHeight
        ? typography.lineHeight[options.lineHeight]
        : typography.lineHeight.normal),
    letterSpacing: options?.letterSpacing
      ? typography.letterSpacing[options.letterSpacing]
      : typography.letterSpacing.normal,
  };
}

// Style composition helper
export function composeStyles<T extends ViewStyle | TextStyle>(
  ...styles: (T | undefined | null | false)[]
): T {
  return Object.assign({}, ...styles.filter(Boolean)) as T;
}

// Platform-specific style helper
export function platformStyle<T extends ViewStyle | TextStyle>(style: {
  web?: T;
  native?: T;
  default?: T;
}): T | undefined {
  if (Platform.OS === "web") {
    return style.web ?? style.default;
  }
  return style.native ?? style.default;
}
