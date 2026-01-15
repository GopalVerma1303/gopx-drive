/**
 * Card Component - Atomic Design System
 * Container component for card-based layouts
 */

import { Text, TextStyleContext } from "@/components/ui/text";
import { composeStyle } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme/useTheme";
import {
  getRadius,
  getShadow,
  getSpacing,
} from "@/lib/theme/styles";
import { View, type ViewProps, type ViewStyle } from "react-native";
import * as React from "react";

function Card({ style, ...props }: ViewProps) {
  const { colors } = useThemeColors();
  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "column",
    gap: getSpacing(6),
    borderRadius: getRadius("xl"),
    paddingVertical: getSpacing(6),
    ...getShadow("sm"),
  };

  return (
    <TextStyleContext.Provider
      value={{
        color: colors.cardForeground,
      }}
    >
      <View style={composeStyle(cardStyle, style)} {...props} />
    </TextStyleContext.Provider>
  );
}

function CardHeader({ style, ...props }: ViewProps) {
  const headerStyle: ViewStyle = {
    flexDirection: "column",
    gap: getSpacing(1.5),
    paddingHorizontal: getSpacing(6),
  };

  return <View style={composeStyle(headerStyle, style)} {...props} />;
}

function CardTitle({
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  const titleStyle: ViewStyle = {
    fontWeight: "600",
    lineHeight: 1,
  };

  return (
    <Text
      role="heading"
      aria-level={3}
      style={composeStyle(titleStyle, style)}
      {...props}
    />
  );
}

function CardDescription({
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { colors } = useThemeColors();
  const descriptionStyle: ViewStyle = {
    color: colors.mutedForeground,
    fontSize: 14,
  };

  return <Text style={composeStyle(descriptionStyle, style)} {...props} />;
}

function CardContent({ style, ...props }: ViewProps) {
  const contentStyle: ViewStyle = {
    paddingHorizontal: getSpacing(6),
  };

  return <View style={composeStyle(contentStyle, style)} {...props} />;
}

function CardFooter({ style, ...props }: ViewProps) {
  const footerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: getSpacing(6),
  };

  return <View style={composeStyle(footerStyle, style)} {...props} />;
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
