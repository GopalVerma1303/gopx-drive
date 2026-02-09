import { Navigation } from "@/components/navigation";
import { useAuth } from "@/contexts/auth-context";
import { NavigationProvider, useNavigation } from "@/contexts/navigation-context";
import { syncNotesFromSupabase } from "@/lib/notes";
import { useThemeColors } from "@/lib/use-theme-colors";
import { invalidateNotesQueries, invalidateFilesQueries } from "@/lib/query-utils";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, AppStateStatus, Dimensions, Platform, View } from "react-native";

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
  const isDetailPage = isNoteDetail;

  // On small screens: bottom bar (absolute positioned)
  if (isSm) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Navigation component handles its own absolute positioning on sm */}
        {!isDetailPage && <Navigation isOpen={isOpen} onClose={close} />}
        <View style={{ 
          flex: 1,
          paddingBottom: isDetailPage ? 0 : 70, // Add padding for bottom bar on small screens only when navbar is visible
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

  // On medium and large screens: use flex row layout with sidebar when navbar is visible
  // When navbar is hidden, content should take full width
  if (isDetailPage) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      <Navigation isOpen={isOpen} onClose={close} />
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
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Only refetch stale queries when app comes to foreground (non-blocking)
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // Sync in background without blocking UI
        syncNotesFromSupabase(user?.id)?.then(() => {
          invalidateNotesQueries(queryClient, user?.id);
        }).catch(() => {
          // Sync failed, but UI already shows cached data
        });
        // Refetch queries in background (non-blocking) - batch refetch for efficiency
        Promise.all([
          queryClient.refetchQueries({
            queryKey: ["files"],
            type: "active",
            stale: true,
          }),
          queryClient.refetchQueries({
            queryKey: ["events"],
            type: "active",
            stale: true,
          }),
        ]).catch(() => {
          // Refetch failed, but UI already shows cached data
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient, user?.id]);

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
