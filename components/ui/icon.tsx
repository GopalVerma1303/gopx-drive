/**
 * Icon Component - Atomic Design System
 * Wrapper for Lucide icons with theme support
 */

import { useThemeColors } from "@/lib/theme/useTheme";
import type { LucideIcon, LucideProps } from "lucide-react-native";
import * as React from "react";

export interface IconProps extends Omit<LucideProps, "color"> {
  as: LucideIcon;
  color?: string;
  size?: number;
}

/**
 * Icon component with theme-aware colors
 * Replaces NativeWind's cssInterop approach
 */
function Icon({ as: IconComponent, color, size = 14, ...props }: IconProps) {
  const { colors } = useThemeColors();
  const iconColor = color ?? colors.foreground;

  return <IconComponent color={iconColor} size={size} {...props} />;
}

export { Icon };
