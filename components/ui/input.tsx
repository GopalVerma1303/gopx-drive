/**
 * Input Component - Atomic Design System
 * Text input with theme support
 */

import {
  getRadius,
  getShadow,
  getSpacing,
  platformStyle,
} from "@/lib/theme/styles";
import { useThemeColors } from "@/lib/theme/useTheme";
import { composeStyle } from "@/lib/utils";
import * as React from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

function Input({ style, editable, ...props }: TextInputProps) {
  const { colors } = useThemeColors();

  const baseStyle = {
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    color: colors.foreground,
    flexDirection: "row",
    height: 40,
    width: "100%",
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    borderRadius: getRadius("md"),
    paddingHorizontal: getSpacing(3),
    paddingVertical: getSpacing(1),
    fontSize: 16,
    lineHeight: 20,
    ...getShadow("sm"),
  };

  const disabledStyle =
    editable === false
      ? {
          opacity: 0.5,
          ...platformStyle({
            web: {
              // disabled:pointer-events-none, disabled:cursor-not-allowed handled by web
            },
          }),
        }
      : {};

  const platformSpecificStyle = platformStyle({
    web: {
      // placeholder:text-muted-foreground, selection:bg-primary, etc. handled by web
      outlineStyle: "none" as any,
    },
    native: {
      // placeholder:text-muted-foreground/50
    },
  });

  return (
    <TextInput
      style={composeStyle(
        baseStyle,
        disabledStyle,
        platformSpecificStyle,
        style
      )}
      editable={editable}
      placeholderTextColor={
        Platform.OS === "web"
          ? colors.mutedForeground
          : colors.mutedForeground + "80" // 50% opacity
      }
      {...props}
    />
  );
}

export { Input };
