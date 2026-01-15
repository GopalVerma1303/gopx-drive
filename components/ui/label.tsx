/**
 * Label Component - Atomic Design System
 * Accessible label component
 */

import { composeStyle } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme/useTheme";
import { getSpacing, platformStyle } from "@/lib/theme/styles";
import * as LabelPrimitive from "@rn-primitives/label";
import { Platform, type TextStyle } from "react-native";
import * as React from "react";

function Label({
  style,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: LabelPrimitive.TextProps & {
  style?: TextStyle;
  disabled?: boolean;
}) {
  const { colors } = useThemeColors();

  const rootStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(2),
    ...platformStyle<typeof rootStyle>({
      web: {
        // cursor-default, leading-none, peer-disabled:cursor-not-allowed, etc. handled by web
      },
    }),
    ...(disabled && { opacity: 0.5 }),
  };

  const textStyle: TextStyle = {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "500",
    ...platformStyle<TextStyle>({
      web: {
        lineHeight: 1,
      },
    }),
  };

  return (
    <LabelPrimitive.Root
      style={rootStyle}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <LabelPrimitive.Text
        style={composeStyle(textStyle, style)}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}

export { Label };
