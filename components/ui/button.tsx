/**
 * Button Component - Atomic Design System
 * Reusable button with variants and sizes
 */

import { TextStyleContext } from "@/components/ui/text";
import { composeStyle } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme/useTheme";
import {
  getRadius,
  getShadow,
  getSpacing,
  platformStyle,
} from "@/lib/theme/styles";
import { Platform, Pressable, type PressableProps, type ViewStyle } from "react-native";
import * as React from "react";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

export type ButtonSize = "default" | "sm" | "lg" | "xl" | "icon";

interface ButtonStyleProps {
  variant: ButtonVariant;
  size: ButtonSize;
  disabled?: boolean;
  colors: ReturnType<typeof useThemeColors>["colors"];
}

function getButtonStyles({
  variant,
  size,
  disabled,
  colors,
}: ButtonStyleProps): ViewStyle {
  const baseStyle: ViewStyle = {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: getSpacing(2),
    borderRadius: getRadius("md"),
    ...getShadow("sm"),
  };

  // Variant styles
  let variantStyle: ViewStyle = {};
  switch (variant) {
    case "default":
      variantStyle = {
        backgroundColor: colors.primary,
        ...platformStyle<ViewStyle>({
          web: {
            // hover:bg-primary/90 handled by web
          },
        }),
      };
      break;
    case "destructive":
      variantStyle = {
        backgroundColor: colors.destructive,
        ...platformStyle<ViewStyle>({
          web: {
            // hover:bg-destructive/90 handled by web
          },
        }),
      };
      break;
    case "outline":
      variantStyle = {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        ...platformStyle<ViewStyle>({
          web: {
            backgroundColor: colors.input + "4D", // 30% opacity
            borderColor: colors.input,
            // hover:bg-accent handled by web
          },
        }),
      };
      break;
    case "secondary":
      variantStyle = {
        backgroundColor: colors.secondary,
      };
      break;
    case "ghost":
      variantStyle = {
        backgroundColor: "transparent",
      };
      break;
    case "link":
      variantStyle = {
        backgroundColor: "transparent",
      };
      break;
  }

  // Size styles
  let sizeStyle: ViewStyle = {};
  switch (size) {
    case "sm":
      sizeStyle = {
        height: 36,
        gap: getSpacing(1.5),
        borderRadius: getRadius("md"),
        paddingHorizontal: getSpacing(3),
        ...platformStyle<ViewStyle>({
          web: {
            height: 32,
          },
        }),
      };
      break;
    case "lg":
      sizeStyle = {
        height: 44,
        borderRadius: getRadius("md"),
        paddingHorizontal: getSpacing(6),
        ...platformStyle<ViewStyle>({
          web: {
            height: 40,
          },
        }),
      };
      break;
    case "xl":
      sizeStyle = {
        height: 56,
        borderRadius: getRadius("2xl"),
        paddingHorizontal: getSpacing(6),
      };
      break;
    case "icon":
      sizeStyle = {
        height: 40,
        width: 40,
        ...platformStyle<ViewStyle>({
          web: {
            height: 36,
            width: 36,
          },
        }),
      };
      break;
    default:
      sizeStyle = {
        height: 40,
        paddingHorizontal: getSpacing(4),
        paddingVertical: getSpacing(2),
        ...platformStyle<ViewStyle>({
          web: {
            height: 36,
          },
        }),
      };
  }

  const disabledStyle: ViewStyle = disabled
    ? {
        opacity: 0.5,
      }
    : {};

  return composeStyle(baseStyle, variantStyle, sizeStyle, disabledStyle);
}

function getButtonTextStyles(
  variant: ButtonVariant,
  colors: ReturnType<typeof useThemeColors>["colors"]
): React.ComponentProps<typeof TextStyleContext.Provider>["value"] {
  const baseStyle: ViewStyle = {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
  };

  switch (variant) {
    case "default":
      return {
        ...baseStyle,
        color: colors.primaryForeground,
      };
    case "destructive":
      return {
        ...baseStyle,
        color: "#ffffff",
      };
    case "outline":
      return baseStyle;
    case "secondary":
      return {
        ...baseStyle,
        color: colors.secondaryForeground,
      };
    case "ghost":
      return baseStyle;
    case "link":
      return {
        ...baseStyle,
        color: colors.primary,
        textDecorationLine: "underline",
        textDecorationStyle: "solid",
        ...platformStyle<ViewStyle>({
          web: {
            // hover:underline handled by web
          },
        }),
      };
    default:
      return baseStyle;
  }
}

export interface ButtonProps extends Omit<PressableProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

function Button({
  variant = "default",
  size = "default",
  style,
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useThemeColors();
  const buttonStyle = getButtonStyles({ variant, size, disabled, colors });
  const textStyle = getButtonTextStyles(variant, colors);

  return (
    <TextStyleContext.Provider value={textStyle}>
      <Pressable
        style={composeStyle(buttonStyle, style)}
        role="button"
        disabled={disabled}
        {...props}
      />
    </TextStyleContext.Provider>
  );
}

export { Button };
