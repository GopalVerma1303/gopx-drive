/**
 * Utility Functions
 * Replaces clsx/tailwind-merge with style composition utilities
 */

import {
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  StyleSheet,
} from "react-native";

// Style composition helper - replaces cn() function
export function composeStyle<T extends ViewStyle | TextStyle>(
  ...styles: (StyleProp<T> | undefined | null | false)[]
): T {
  const validStyles = styles.filter(
    (style): style is StyleProp<T> => style != null && style !== false
  );
  return StyleSheet.flatten(validStyles) as T;
}

// Alias for backward compatibility during migration
export const cn = composeStyle;

// Type helper for style arrays
export type StyleArray<T extends ViewStyle | TextStyle> = Array<
  StyleProp<T> | undefined | null | false
>;
