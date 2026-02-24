"use client";

import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import { Calendar, FileText, Files, Folder, Home, Menu, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./ui/text";

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScreenSize = "sm" | "md" | "lg";

function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        const width = window.innerWidth;
        if (width >= 1024) return "lg";
        if (width >= 768) return "md";
        return "sm";
      }
    }
    const { width } = Dimensions.get("window");
    if (width >= 1024) return "lg";
    if (width >= 768) return "md";
    return "sm";
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => {
        const width = window.innerWidth;
        if (width >= 1024) setScreenSize("lg");
        else if (width >= 768) setScreenSize("md");
        else setScreenSize("sm");
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    } else {
      const subscription = Dimensions.addEventListener("change", ({ window }) => {
        const width = window.width;
        if (width >= 1024) setScreenSize("lg");
        else if (width >= 768) setScreenSize("md");
        else setScreenSize("sm");
      });

      return () => subscription?.remove();
    }
  }, []);

  return screenSize;
}

interface NavItem {
  label: string;
  icon: typeof FileText;
  href: string;
  /** Extra path prefixes that make this item active (e.g. folder detail under Folders). */
  activePathPrefixes?: string[];
}

const transicon = require("@/assets/images/transicon.png");

const navItems: NavItem[] = [
  { label: "Home", icon: Home, href: "/(app)/home" },
  { label: "Folders", icon: Folder, href: "/(app)/folders", activePathPrefixes: ["/folder/", "/(app)/folder/"] },
  { label: "Notes", icon: FileText, href: "/(app)/notes", activePathPrefixes: ["/note/", "/(app)/note/"] },
  { label: "Files", icon: Files, href: "/(app)/files" },
  { label: "Calendar", icon: Calendar, href: "/(app)/calendar" },
  {
    label: "Settings",
    icon: Settings,
    href: "/(app)/settings",
    activePathPrefixes: [
      "/settings/",
      "/(app)/settings/",
      "/(app)/archive",
      "/(app)/toolbar-order",
      "/archive",
      "/toolbar-order",
    ],
  },
];

export function Navigation({ isOpen, onClose }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const screenSize = useScreenSize();

  const isLg = screenSize === "lg";
  const isMd = screenSize === "md";
  const isSm = screenSize === "sm";

  // No need to close on route change for md screens since sidebar is always visible

  const handleNavPress = (href: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(href as any);
  };

  // Render navigation items
  const renderNavItems = (iconOnly: boolean = false, horizontal: boolean = false) => (
    <View style={{
      flexDirection: horizontal ? "row" : "column",
      gap: horizontal ? 0 : 4,
      alignItems: horizontal ? "center" : "stretch",
      justifyContent: horizontal ? "space-around" : "flex-start",
      ...(horizontal && { width: "100%" }),
      backgroundColor: colors.background,
      paddingVertical: horizontal ? 12 : 10,
    }}>
      {navItems.map((item) => {
        const Icon = item.icon;

        // Extract the final route segment (e.g., "/(app)/notes" -> "notes")
        const getFinalSegment = (path: string) => {
          if (!path) return "";
          const segments = path.split("/").filter(Boolean);
          // Find the last segment that's not a route group (doesn't start with "(")
          for (let i = segments.length - 1; i >= 0; i--) {
            if (segments[i] && !segments[i].startsWith("(") && !segments[i].endsWith(")")) {
              return segments[i];
            }
          }
          return segments[segments.length - 1] || "";
        };

        const currentSegment = getFinalSegment(pathname || "");
        const itemSegment = getFinalSegment(item.href);
        const path = pathname || "";

        // Check if active: direct match, nested under href, or under a parent path prefix (e.g. /folder/xyz -> Folders)
        const isActive =
          path === item.href ||
          (path && path.startsWith(item.href + "/")) ||
          (currentSegment && itemSegment && currentSegment === itemSegment) ||
          (item.activePathPrefixes?.some((prefix) => path.startsWith(prefix)));

        return (
          <Pressable
            key={item.href}
            {...(horizontal && { hitSlop: { top: 10, bottom: 10, left: 20, right: 20 } })}
            onPress={() => handleNavPress(item.href)}
            style={({ pressed }) => ({
              flex: horizontal ? 1 : undefined,
              flexDirection: horizontal ? "column" : "row",
              alignItems: "center",
              justifyContent: horizontal ? "center" : "flex-start",
              paddingVertical: horizontal ? 14 : 12,
              paddingHorizontal: horizontal ? 12 : (iconOnly ? 12 : 16),
              borderRadius: 8,
              backgroundColor: pressed ? colors.accent : "transparent",
              marginHorizontal: iconOnly ? 0 : 8,
              ...(horizontal && { width: "100%" }),

            })}
          >
            <Icon
              color={isActive ? colors.primary : colors.mutedForeground}
              size={horizontal ? 24 : (iconOnly ? 24 : 20)}
            />
            {!iconOnly && (
              <Text
                style={{
                  marginLeft: horizontal ? 0 : 12,
                  marginTop: horizontal ? 4 : 0,
                  fontSize: horizontal ? 11 : 15,
                  fontWeight: isActive ? "700" : "400",
                  color: isActive ? colors.primary : colors.mutedForeground,
                  textAlign: horizontal ? "center" : "left",
                }}
              >
                {item.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // Small screens: Bottom bar (absolute positioned)
  if (isSm) {
    return (
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          elevation: 10,
          zIndex: 1000,
        }}
      >
        {renderNavItems(true, true)}
      </View>
    );
  }

  // Medium screens: Icon-only sidebar (left side, always visible) — logo only at top
  if (isMd) {
    return (
      <View
        style={{
          width: 64,
          height: "100%",
          backgroundColor: colors.background,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          paddingTop: insets.top,
        }}
      >
        <View style={{ paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}>
          <Image source={transicon} style={{ width: 32, height: 32 }} resizeMode="contain" className="filter dark:invert" />
        </View>
        <View style={{ paddingHorizontal: 8 }}>
          {renderNavItems(true, false)}
        </View>
      </View>
    );
  }

  // Large screens: Full sidebar (left side, always visible, part of flex layout)
  return (
    <View
      style={{
        width: 240,
        height: "100%",
        backgroundColor: colors.background,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingTop: insets.top,
      }}
    >
      <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, paddingHorizontal: 12, gap: 10 }}>
          <Image source={transicon} style={{ width: 28, height: 28 }} resizeMode="contain" className="filter dark:invert" />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.foreground,
            }}
          >
            Gopx Drive
          </Text>
        </View>
        {renderNavItems(false, false)}
      </View>
    </View>
  );
}

export function NavigationToggle({ onPress }: { onPress: () => void }) {
  const { colors } = useThemeColors();
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => {
        if (typeof window !== "undefined") {
          setScreenWidth(window.innerWidth);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    } else {
      const subscription = Dimensions.addEventListener("change", ({ window }) => {
        setScreenWidth(window.width);
      });
      return () => subscription?.remove();
    }
  }, []);

  // Toggle is not needed anymore since:
  // - sm: bottom bar (always visible)
  // - md: icon-only sidebar (always visible)
  // - lg: full sidebar (always visible)
  // This component is kept for backward compatibility but should not be used
  const shouldShow = false;

  if (!shouldShow) {
    return null;
  }

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={({ pressed }) => ({
        padding: 8,
        marginLeft: -8,
        opacity: pressed ? 0.7 : 1,
        zIndex: 10000,
      })}
    >
      <Menu color={colors.foreground} size={24} />
    </Pressable>
  );
}
