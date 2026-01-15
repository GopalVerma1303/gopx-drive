/**
 * Text Component - Atomic Design System
 * Reusable text component with variant support
 */

import { composeStyle } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme/useTheme";
import {
  createTextStyle,
  getRadius,
  getSpacing,
  platformStyle,
} from "@/lib/theme/styles";
import * as Slot from "@rn-primitives/slot";
import * as React from "react";
import { Platform, Text as RNText, type Role, type TextStyle } from "react-native";

export type TextVariant =
  | "default"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "blockquote"
  | "code"
  | "lead"
  | "large"
  | "small"
  | "muted";

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  blockquote: Platform.select({ web: "blockquote" as Role }),
  code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
};

// Style context for nested text styling
const TextStyleContext = React.createContext<TextStyle | undefined>(undefined);

function getTextVariantStyles(
  variant: TextVariant,
  colors: ReturnType<typeof useThemeColors>["colors"]
): TextStyle {
  const baseStyle: TextStyle = {
    color: colors.foreground,
    ...createTextStyle("base"),
  };

  switch (variant) {
    case "h1":
      return {
        ...baseStyle,
        ...createTextStyle("4xl", {
          weight: "extrabold",
          letterSpacing: "tight",
        }),
        textAlign: "center",
        ...platformStyle<TextStyle>({
          web: {
            // scroll-m-20, text-balance - handled by web styles
          },
        }),
      };
    case "h2":
      return {
        ...baseStyle,
        ...createTextStyle("3xl", {
          weight: "semibold",
          letterSpacing: "tight",
        }),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: getSpacing(2),
        ...platformStyle<TextStyle>({
          web: {
            // scroll-m-20, first:mt-0 - handled by web styles
          },
        }),
      };
    case "h3":
      return {
        ...baseStyle,
        ...createTextStyle("2xl", {
          weight: "semibold",
          letterSpacing: "tight",
        }),
        ...platformStyle<TextStyle>({
          web: {
            // scroll-m-20 - handled by web styles
          },
        }),
      };
    case "h4":
      return {
        ...baseStyle,
        ...createTextStyle("xl", {
          weight: "semibold",
          letterSpacing: "tight",
        }),
        ...platformStyle<TextStyle>({
          web: {
            // scroll-m-20 - handled by web styles
          },
        }),
      };
    case "p":
      return {
        ...baseStyle,
        marginTop: getSpacing(3),
        lineHeight: createTextStyle("base").fontSize! * 1.75,
        ...platformStyle<TextStyle>({
          web: {
            marginTop: getSpacing(6),
          },
        }),
      };
    case "blockquote":
      return {
        ...baseStyle,
        marginTop: getSpacing(4),
        borderLeftWidth: 2,
        borderLeftColor: colors.border,
        paddingLeft: getSpacing(3),
        fontStyle: "italic",
        ...platformStyle<TextStyle>({
          web: {
            marginTop: getSpacing(6),
            paddingLeft: getSpacing(6),
          },
        }),
      };
    case "code":
      return {
        ...baseStyle,
        backgroundColor: colors.muted,
        ...createTextStyle("sm", {
          weight: "semibold",
        }),
        fontFamily: Platform.select({ ios: "Courier", android: "monospace", web: "monospace" }),
        borderRadius: getRadius("sm"),
        paddingHorizontal: 3,
        paddingVertical: 2,
      };
    case "lead":
      return {
        ...baseStyle,
        color: colors.mutedForeground,
        ...createTextStyle("xl"),
      };
    case "large":
      return {
        ...baseStyle,
        ...createTextStyle("lg", {
          weight: "semibold",
        }),
      };
    case "small":
      return {
        ...baseStyle,
        ...createTextStyle("sm", {
          weight: "medium",
          lineHeight: "none",
        }),
      };
    case "muted":
      return {
        ...baseStyle,
        color: colors.mutedForeground,
        ...createTextStyle("sm"),
      };
    default:
      return baseStyle;
  }
}

export interface TextProps extends React.ComponentProps<typeof RNText> {
  variant?: TextVariant;
  asChild?: boolean;
  style?: TextStyle;
}

function Text({
  variant = "default",
  asChild = false,
  style,
  ...props
}: TextProps) {
  const { colors } = useThemeColors();
  const contextStyle = React.useContext(TextStyleContext);
  const variantStyle = getTextVariantStyles(variant, colors);

  const Component = asChild ? Slot.Text : RNText;
  const finalStyle = composeStyle(variantStyle, contextStyle, style);

  return (
    <Component
      style={finalStyle}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextStyleContext };
