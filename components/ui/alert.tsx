/**
 * Alert Component - Atomic Design System
 * Alert component with icon and variants
 */

import { Icon } from "@/components/ui/icon";
import { Text, TextStyleContext } from "@/components/ui/text";
import { composeStyle } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme/useTheme";
import {
  getRadius,
  getSpacing,
} from "@/lib/theme/styles";
import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

export interface AlertProps extends ViewProps {
  variant?: "default" | "destructive";
  icon: LucideIcon;
  iconStyle?: ViewStyle;
  children?: React.ReactNode;
}

function Alert({
  variant = "default",
  icon,
  iconStyle,
  style,
  children,
  ...props
}: AlertProps) {
  const { colors } = useThemeColors();

  const alertStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
    width: "100%",
    borderRadius: getRadius("lg"),
    paddingHorizontal: getSpacing(4),
    paddingBottom: getSpacing(2),
    paddingTop: getSpacing(3.5),
  };

  const textStyle: ViewStyle = {
    fontSize: 14,
    color: variant === "destructive" ? colors.destructive : colors.foreground,
  };

  const iconContainerStyle: ViewStyle = {
    position: "absolute",
    left: getSpacing(3.5),
    top: getSpacing(3),
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <View
        role="alert"
        style={composeStyle(alertStyle, style)}
        {...props}
      >
        <View style={composeStyle(iconContainerStyle, iconStyle)}>
          <Icon
            as={icon}
            size={16}
            color={variant === "destructive" ? colors.destructive : colors.foreground}
          />
        </View>
        {children}
      </View>
    </TextStyleContext.Provider>
  );
}

function AlertTitle({
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  const titleStyle: ViewStyle = {
    marginBottom: getSpacing(1),
    marginLeft: getSpacing(0.5),
    minHeight: 16,
    paddingLeft: getSpacing(6),
    fontWeight: "500",
    lineHeight: 1,
    letterSpacing: -0.25,
  };

  return <Text style={composeStyle(titleStyle, style)} {...props} />;
}

function AlertDescription({
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { colors } = useThemeColors();
  const textStyle = React.useContext(TextStyleContext);

  const descriptionStyle: ViewStyle = {
    color: textStyle?.color === colors.destructive
      ? colors.destructive + "E6" // 90% opacity
      : colors.mutedForeground,
    marginLeft: getSpacing(0.5),
    paddingBottom: getSpacing(1.5),
    paddingLeft: getSpacing(6),
    fontSize: 14,
    lineHeight: 1.625,
  };

  return <Text style={composeStyle(descriptionStyle, style)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
