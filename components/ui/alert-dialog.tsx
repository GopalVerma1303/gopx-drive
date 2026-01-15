/**
 * Alert Dialog Component - Atomic Design System
 * Modal dialog for alerts and confirmations
 */

import { TextStyleContext } from "@/components/ui/text";
import {
  getRadius,
  getShadow,
  getSpacing,
  platformStyle,
} from "@/lib/theme/styles";
import { useThemeColors } from "@/lib/theme/useTheme";
import { composeStyle } from "@/lib/utils";
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import * as React from "react";
import {
  Platform,
  View,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { FadeIn, FadeOut } from "react-native-reanimated";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { NativeOnlyAnimatedView } from "./native-only-animated-view";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function AlertDialogOverlay({
  style,
  children,
  ...props
}: Omit<AlertDialogPrimitive.OverlayProps, "asChild"> &
  React.RefAttributes<AlertDialogPrimitive.OverlayRef> & {
    children?: React.ReactNode;
    style?: ViewStyle;
  }) {
  const overlayStyle: ViewStyle = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: getSpacing(2),
    ...platformStyle<ViewStyle>({
      web: {
        position: "fixed",
        // animate-in fade-in-0 handled by animations
      },
    }),
  };

  return (
    <FullWindowOverlay>
      <AlertDialogPrimitive.Overlay
        style={composeStyle(overlayStyle, style)}
        {...props}
      >
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).delay(50)}
          exiting={FadeOut.duration(150)}
        >
          {children}
        </NativeOnlyAnimatedView>
      </AlertDialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}

function AlertDialogContent({
  style,
  portalHost,
  children,
  ...props
}: Omit<AlertDialogPrimitive.ContentProps, "asChild"> &
  React.RefAttributes<AlertDialogPrimitive.ContentRef> & {
    portalHost?: string;
    children?: React.ReactNode;
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();

  const contentStyle: ViewStyle = {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 50,
    flexDirection: "column",
    width: "100%",
    gap: getSpacing(4),
    borderRadius: getRadius("lg"),
    padding: getSpacing(6),
    ...getShadow("lg"),
    ...platformStyle<ViewStyle>({
      web: {
        maxWidth: 512, // sm:max-w-lg
        // animate-in fade-in-0 zoom-in-95 duration-200 handled by animations
      },
      native: {
        maxWidth: "95%", // Approximate calc(100% - 2rem)
      },
    }),
  };

  const wrappedChildren = (
    <View style={{ flexDirection: "column", gap: getSpacing(4) }}>
      {children}
    </View>
  );

  return (
    <AlertDialogPortal hostName={portalHost}>
      <AlertDialogOverlay>
        <AlertDialogPrimitive.Content
          style={composeStyle(contentStyle, style)}
          {...props}
        >
          {wrappedChildren}
        </AlertDialogPrimitive.Content>
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ style, ...props }: ViewProps) {
  const { colors } = useThemeColors();

  const headerStyle: ViewStyle = {
    flexDirection: "column",
    gap: getSpacing(2),
    ...platformStyle<ViewStyle>({
      native: {
        alignItems: "center", // text-center
      },
    }),
  };

  const textStyle: TextStyle =
    platformStyle<TextStyle>({
      web: {
        textAlign: "left",
      },
      native: {
        textAlign: "center",
      },
    }) || {};

  return (
    <TextStyleContext.Provider value={textStyle}>
      <View style={composeStyle(headerStyle, style)} {...props} />
    </TextStyleContext.Provider>
  );
}

function AlertDialogFooter({ style, ...props }: ViewProps) {
  const footerStyle: ViewStyle = {
    flexDirection: "column-reverse",
    gap: getSpacing(2),
    ...platformStyle<ViewStyle>({
      web: {
        flexDirection: "row",
        justifyContent: "flex-end",
      },
    }),
  };

  return <View style={composeStyle(footerStyle, style)} {...props} />;
}

function AlertDialogTitle({
  style,
  ...props
}: AlertDialogPrimitive.TitleProps &
  React.RefAttributes<AlertDialogPrimitive.TitleRef> & {
    style?: TextStyle;
  }) {
  const { colors } = useThemeColors();

  const titleStyle: TextStyle = {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "600",
  };

  return (
    <AlertDialogPrimitive.Title
      style={composeStyle(titleStyle, style)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  style,
  ...props
}: AlertDialogPrimitive.DescriptionProps &
  React.RefAttributes<AlertDialogPrimitive.DescriptionRef> & {
    style?: TextStyle;
  }) {
  const { colors } = useThemeColors();

  const descriptionStyle: TextStyle = {
    color: colors.mutedForeground,
    fontSize: 14,
  };

  return (
    <AlertDialogPrimitive.Description
      style={composeStyle(descriptionStyle, style)}
      {...props}
    />
  );
}

function AlertDialogAction({
  style,
  ...props
}: AlertDialogPrimitive.ActionProps &
  React.RefAttributes<AlertDialogPrimitive.ActionRef> & {
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();
  const buttonStyle = React.useMemo(() => {
    const baseStyle: ViewStyle = {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: getSpacing(2),
      borderRadius: getRadius("md"),
      height: 40,
      paddingHorizontal: getSpacing(4),
      paddingVertical: getSpacing(2),
      backgroundColor: colors.primary,
      ...getShadow("sm"),
    };
    return composeStyle(baseStyle, style);
  }, [colors, style]);

  const textStyle: TextStyle = {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primaryForeground,
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <AlertDialogPrimitive.Action style={buttonStyle} {...props} />
    </TextStyleContext.Provider>
  );
}

function AlertDialogCancel({
  style,
  ...props
}: AlertDialogPrimitive.CancelProps &
  React.RefAttributes<AlertDialogPrimitive.CancelRef> & {
    style?: ViewStyle;
  }) {
  const { colors } = useThemeColors();
  const buttonStyle = React.useMemo(() => {
    const baseStyle: ViewStyle = {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: getSpacing(2),
      borderRadius: getRadius("md"),
      height: 40,
      paddingHorizontal: getSpacing(4),
      paddingVertical: getSpacing(2),
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      ...getShadow("sm"),
    };
    return composeStyle(baseStyle, style);
  }, [colors, style]);

  const textStyle: TextStyle = {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
  };

  return (
    <TextStyleContext.Provider value={textStyle}>
      <AlertDialogPrimitive.Cancel style={buttonStyle} {...props} />
    </TextStyleContext.Provider>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
