import { useAuth } from "@/contexts/auth-context";
import { Navigation } from "@/components/navigation";
import { NavigationProvider, useNavigation } from "@/contexts/navigation-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View, Dimensions, Platform } from "react-native";
import { useEffect, useState } from "react";

function AppLayoutContent() {
  const { colors } = useThemeColors();
  const pathname = usePathname();
  const { isOpen, close } = useNavigation();
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

  const isSm = screenWidth < 768;
  const isMd = screenWidth >= 768 && screenWidth < 1024;
  const isLg = screenWidth >= 1024;
  const isNoteDetail = pathname?.includes("/note/") && pathname !== "/(app)/notes";

  // On small screens: bottom bar (absolute positioned)
  if (isSm) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Navigation component handles its own absolute positioning on sm */}
        {!isNoteDetail && <Navigation isOpen={isOpen} onClose={close} />}
        <View style={{ 
          flex: 1,
          paddingBottom: 70, // Add padding for bottom bar on small screens
        }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          />
        </View>
      </View>
    );
  }

  // On medium and large screens: use flex row layout with sidebar
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      {!isNoteDetail && <Navigation isOpen={isOpen} onClose={close} />}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        />
      </View>
    </View>
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const { colors } = useThemeColors();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <NavigationProvider>
      <AppLayoutContent />
    </NavigationProvider>
  );
}
