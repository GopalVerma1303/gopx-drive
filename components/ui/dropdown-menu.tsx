/**
 * Dropdown Menu Component - Atomic Design System
 * Dropdown menu with theme support
 */

import { Icon } from "@/components/ui/icon";
import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { TextStyleContext } from "@/components/ui/text";
import {
  getRadius,
  getShadow,
  getSpacing,
  platformStyle,
} from "@/lib/theme/styles";
import { useThemeColors } from "@/lib/theme/useTheme";
import { composeStyle } from "@/lib/utils";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react-native";
import * as React from "react";
import {
  Platform,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { FadeIn } from "react-native-reanimated";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

function DropdownMenuSubTrigger({
  style,
  inset,
  children,
  iconStyle,
  ...props
}: DropdownMenuPrimitive.SubTriggerProps &
  React.RefAttributes<DropdownMenuPrimitive.SubTriggerRef> & {
    children?: React.ReactNode;
    iconStyle?: ViewStyle;
    inset?: boolean;
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();
  const { open } = DropdownMenuPrimitive.useSubContext();
  const icon =
    Platform.OS === "web" ? ChevronRight : open ? ChevronUp : ChevronDown;

  const triggerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: getRadius("sm"),
    paddingHorizontal: getSpacing(2),
    paddingVertical: getSpacing(2),
    backgroundColor: open ? colors.accent : "transparent",
    ...platformStyle<ViewStyle>({
      web: {
        paddingVertical: getSpacing(1.5),
        // focus:bg-accent, cursor-default, outline-none handled by web
      },
    }),
    ...(inset && { paddingLeft: getSpacing(8) }),
  };

  const textStyle: TextStyle = {
    fontSize: 14,
    color: open ? colors.accentForeground : colors.foreground,
    ...platformStyle<TextStyle>({
      web: {
        // select-none handled by web
      },
    }),
  };

  const iconContainerStyle: ViewStyle = {
    marginLeft: "auto",
    width: 16,
    height: 16,
    flexShrink: 0,
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <DropdownMenuPrimitive.SubTrigger
        style={composeStyle(triggerStyle, style)}
        {...props}
      >
        <>{children}</>
        <View style={composeStyle(iconContainerStyle, iconStyle)}>
          <Icon as={icon} size={16} color={colors.foreground} />
        </View>
      </DropdownMenuPrimitive.SubTrigger>
    </TextStyleContext.Provider>
  );
}

function DropdownMenuSubContent({
  style,
  ...props
}: DropdownMenuPrimitive.SubContentProps &
  React.RefAttributes<DropdownMenuPrimitive.SubContentRef> & {
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();

  const contentStyle: ViewStyle = {
    backgroundColor: colors.popover,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    borderRadius: getRadius("md"),
    padding: getSpacing(1),
    ...getShadow("lg"),
    ...platformStyle<ViewStyle>({
      web: {
        zIndex: 50,
        minWidth: 128, // min-w-[8rem]
        // animate-in animations handled by animations
      },
    }),
  };

  return (
    <NativeOnlyAnimatedView entering={FadeIn}>
      <DropdownMenuPrimitive.SubContent
        style={composeStyle(contentStyle, style)}
        {...props}
      />
    </NativeOnlyAnimatedView>
  );
}

const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function DropdownMenuContent({
  style,
  overlayStyle,
  portalHost,
  ...props
}: DropdownMenuPrimitive.ContentProps &
  React.RefAttributes<DropdownMenuPrimitive.ContentRef> & {
    overlayStyle?: StyleProp<ViewStyle>;
    portalHost?: string;
  }) {
  const { colors } = useThemeColors();

  const contentStyle: ViewStyle = {
    backgroundColor: colors.popover,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 128, // min-w-[8rem]
    overflow: "hidden",
    borderRadius: getRadius("md"),
    padding: getSpacing(1),
    ...getShadow("lg"),
    ...platformStyle<ViewStyle>({
      web: {
        zIndex: 50,
        // animate-in animations handled by animations
      },
    }),
  };

  const textStyle: TextStyle = {
    color: colors.popoverForeground,
  };

  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DropdownMenuPrimitive.Overlay
          style={
            overlayStyle
              ? StyleSheet.flatten([
                  StyleSheet.absoluteFill,
                  overlayStyle as typeof StyleSheet.absoluteFill,
                ])
              : StyleSheet.absoluteFill
          }
        >
          <NativeOnlyAnimatedView entering={FadeIn}>
            <TextStyleContext.Provider value={textStyle}>
              <DropdownMenuPrimitive.Content
                style={composeStyle(contentStyle, style)}
                {...props}
              />
            </TextStyleContext.Provider>
          </NativeOnlyAnimatedView>
        </DropdownMenuPrimitive.Overlay>
      </FullWindowOverlay>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  style,
  inset,
  variant,
  ...props
}: DropdownMenuPrimitive.ItemProps &
  React.RefAttributes<DropdownMenuPrimitive.ItemRef> & {
    style?: ViewStyle;
    inset?: boolean;
    variant?: "default" | "destructive";
  }) {
  const { colors } = useThemeColors();

  const itemStyle: ViewStyle = {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(2),
    borderRadius: getRadius("sm"),
    paddingHorizontal: getSpacing(2),
    paddingVertical: getSpacing(2),
    backgroundColor: "transparent",
    ...platformStyle<ViewStyle>({
      web: {
        paddingVertical: getSpacing(1.5),
        // focus:bg-accent, cursor-default, outline-none handled by web
      },
    }),
    ...(variant === "destructive" && {
      backgroundColor: "transparent",
    }),
    ...(inset && { paddingLeft: getSpacing(8) }),
    ...(props.disabled && { opacity: 0.5 }),
  };

  const textStyle: TextStyle = {
    fontSize: 14,
    color:
      variant === "destructive" ? colors.destructive : colors.popoverForeground,
    ...platformStyle<TextStyle>({
      web: {
        // select-none handled by web
      },
    }),
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <DropdownMenuPrimitive.Item
        style={composeStyle(itemStyle, style)}
        {...props}
      />
    </TextStyleContext.Provider>
  );
}

function DropdownMenuCheckboxItem({
  style,
  children,
  ...props
}: DropdownMenuPrimitive.CheckboxItemProps &
  React.RefAttributes<DropdownMenuPrimitive.CheckboxItemRef> & {
    children?: React.ReactNode;
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();

  const itemStyle: ViewStyle = {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(2),
    borderRadius: getRadius("sm"),
    paddingVertical: getSpacing(2),
    paddingLeft: getSpacing(8),
    paddingRight: getSpacing(2),
    ...platformStyle<ViewStyle>({
      web: {
        paddingVertical: getSpacing(1.5),
        // focus:bg-accent, cursor-default, outline-none handled by web
      },
    }),
    ...(props.disabled && { opacity: 0.5 }),
  };

  const textStyle: TextStyle = {
    fontSize: 14,
    color: colors.popoverForeground,
    ...platformStyle<TextStyle>({
      web: {
        // select-none handled by web
      },
    }),
  };

  const indicatorStyle: ViewStyle = {
    position: "absolute",
    left: getSpacing(2),
    flexDirection: "row",
    height: 14,
    width: 14,
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <DropdownMenuPrimitive.CheckboxItem
        style={composeStyle(itemStyle, style)}
        {...props}
      >
        <View style={indicatorStyle}>
          <DropdownMenuPrimitive.ItemIndicator>
            <Icon as={Check} size={16} color={colors.foreground} />
          </DropdownMenuPrimitive.ItemIndicator>
        </View>
        <>{children}</>
      </DropdownMenuPrimitive.CheckboxItem>
    </TextStyleContext.Provider>
  );
}

function DropdownMenuRadioItem({
  style,
  children,
  ...props
}: DropdownMenuPrimitive.RadioItemProps &
  React.RefAttributes<DropdownMenuPrimitive.RadioItemRef> & {
    children?: React.ReactNode;
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();

  const itemStyle: ViewStyle = {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(2),
    borderRadius: getRadius("sm"),
    paddingVertical: getSpacing(2),
    paddingLeft: getSpacing(8),
    paddingRight: getSpacing(2),
    ...platformStyle<ViewStyle>({
      web: {
        paddingVertical: getSpacing(1.5),
        // focus:bg-accent, cursor-default, outline-none handled by web
      },
    }),
    ...(props.disabled && { opacity: 0.5 }),
  };

  const textStyle: TextStyle = {
    fontSize: 14,
    color: colors.popoverForeground,
    ...platformStyle<TextStyle>({
      web: {
        // select-none handled by web
      },
    }),
  };

  const indicatorStyle: ViewStyle = {
    position: "absolute",
    left: getSpacing(2),
    flexDirection: "row",
    height: 14,
    width: 14,
    alignItems: "center",
    justifyContent: "center",
  };

  const dotStyle: ViewStyle = {
    backgroundColor: colors.foreground,
    height: 8,
    width: 8,
    borderRadius: 9999,
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <DropdownMenuPrimitive.RadioItem
        style={composeStyle(itemStyle, style)}
        {...props}
      >
        <View style={indicatorStyle}>
          <DropdownMenuPrimitive.ItemIndicator>
            <View style={dotStyle} />
          </DropdownMenuPrimitive.ItemIndicator>
        </View>
        <>{children}</>
      </DropdownMenuPrimitive.RadioItem>
    </TextStyleContext.Provider>
  );
}

function DropdownMenuLabel({
  style,
  inset,
  ...props
}: DropdownMenuPrimitive.LabelProps &
  React.RefAttributes<DropdownMenuPrimitive.LabelRef> & {
    style?: TextStyle;
    inset?: boolean;
  }) {
  const { colors } = useThemeColors();

  const labelStyle: TextStyle = {
    color: colors.foreground,
    paddingHorizontal: getSpacing(2),
    paddingVertical: getSpacing(2),
    fontSize: 14,
    fontWeight: "500",
    ...platformStyle<TextStyle>({
      web: {
        paddingVertical: getSpacing(1.5),
      },
    }),
    ...(inset && { paddingLeft: getSpacing(8) }),
  };

  return (
    <DropdownMenuPrimitive.Label
      style={composeStyle(labelStyle, style)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  style,
  ...props
}: DropdownMenuPrimitive.SeparatorProps &
  React.RefAttributes<DropdownMenuPrimitive.SeparatorRef> & {
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();

  const separatorStyle: ViewStyle = {
    backgroundColor: colors.border,
    marginHorizontal: -getSpacing(1),
    marginVertical: getSpacing(1),
    height: 1,
  };

  return (
    <DropdownMenuPrimitive.Separator
      style={composeStyle(separatorStyle, style)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  style,
  ...props
}: TextProps & React.RefAttributes<Text> & { style?: TextStyle }) {
  const { colors } = useThemeColors();

  const shortcutStyle: TextStyle = {
    color: colors.mutedForeground,
    marginLeft: "auto",
    fontSize: 12,
    letterSpacing: 4,
  };

  return <Text style={composeStyle(shortcutStyle, style)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
