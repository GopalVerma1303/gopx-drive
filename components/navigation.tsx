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
import { cn } from "@/lib/utils";

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
    <View
      className={cn(
        "flex",
        horizontal ? "flex-row items-center justify-around w-full py-1" : "flex-col items-stretch justify-start gap-1 py-[10px]"
      )}
      style={{
        backgroundColor: colors.background,
      }}
    >
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
            className={cn(
              "flex items-center rounded-lg",
              horizontal ? "flex-1 flex-col justify-center py-3 px-3 w-full" : "flex-row justify-start py-3 px-4 mx-2",
              iconOnly && !horizontal && "px-3 mx-0"
            )}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.accent : "transparent",
            })}
          >
            <Icon
              color={isActive ? colors.primary : colors.mutedForeground}
              size={horizontal ? 24 : (iconOnly ? 24 : 20)}
            />
            {!iconOnly && (
              <Text
                className={cn(
                  horizontal ? "ml-0 mt-1 text-[11px] text-center" : "ml-3 mt-0 text-[15px] text-left",
                  isActive ? "font-bold" : "font-normal"
                )}
                style={{
                  color: isActive ? colors.primary : colors.mutedForeground,
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
        className="absolute bottom-0 left-0 right-0 border-t elevation-10 z-[1000]"
        style={{
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
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
        className="w-16 h-full border-r"
        style={{
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          paddingTop: insets.top,
        }}
      >
        <View className="py-4 px-3 items-center">
          <Image source={transicon} style={{ width: 32, height: 32 }} resizeMode="contain" className="filter dark:invert" />
        </View>
        <View className="px-2">
          {renderNavItems(true, false)}
        </View>
      </View>
    );
  }

  // Large screens: Full sidebar (left side, always visible, part of flex layout)
  return (
    <View
      className="w-[240px] h-full border-r"
      style={{
        backgroundColor: colors.background,
        borderRightColor: colors.border,
        paddingTop: insets.top,
      }}
    >
      <View className="py-4 px-4">
        <View className="flex-row items-center mb-6 px-3 gap-[10px]">
          <Image source={transicon} style={{ width: 28, height: 28 }} resizeMode="contain" className="filter dark:invert" />
          <Text
            className="text-[20px] font-bold"
            style={{
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
      className="p-2 -ml-2 z-[10000]"
      style={({ pressed }: { pressed: boolean }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Menu color={colors.foreground} size={24} />
    </Pressable>
  );
}
