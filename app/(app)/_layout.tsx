import { DefaultAppHead } from "@/components/default-app-head";
import { Navigation } from "@/components/navigation";
import { useAuth } from "@/contexts/auth-context";
import { NavigationProvider, useNavigation } from "@/contexts/navigation-context";
import { ViewModeProvider } from "@/contexts/view-mode-context";
import { useThemeColors } from "@/lib/use-theme-colors";
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
        <DefaultAppHead />
        {/* Navigation component handles its own absolute positioning on sm */}
        {!isDetailPage && <Navigation isOpen={isOpen} onClose={close} />}
        <View style={{
          flex: 1,
        }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                flex: 1,
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
        <DefaultAppHead />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              flex: 1,
              backgroundColor: colors.background,
            },
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      <DefaultAppHead />
      <Navigation isOpen={isOpen} onClose={close} />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              flex: 1,
              backgroundColor: colors.background,
            },
          }}
        />
      </View>
    </View>
  );
}

/** Query key prefixes for user-scoped data. Invalidated after login so screens refetch. */
const USER_SCOPED_QUERY_KEYS = [
  "notes",
  "files",
  "events",
  "folders",
  "archivedNotes",
  "archivedFiles",
  "archivedFolders",
  "folderNotes",
  "folderFiles",
  "notes-sync-status",
  "notes-unsynced-ids",
  "attachments",
] as const;

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);
  const prevUserIdRef = useRef<string | null>(null);

  // After login (or user change), invalidate all user-scoped queries so every screen
  // refetches instead of showing empty until manual refresh.
  useEffect(() => {
    const userId = user?.id ?? null;
    if (userId && prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      USER_SCOPED_QUERY_KEYS.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    }
    if (!userId) {
      prevUserIdRef.current = null;
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    // When app comes to foreground (e.g. user switches browser tab back), do not
    // sync or invalidate notes — that was causing a Supabase notes request every time.
    // Rely on staleTime and pull-to-refresh for notes. Optionally refetch files/events
    // only if stale (reduces unnecessary API hits).
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
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
  }, [queryClient]);

  if (isLoading) {
    return (
      <>
        <DefaultAppHead />
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
      </>
    );
  }

  if (!user) {
    return (
      <>
        <DefaultAppHead />
        <Redirect href="/(auth)/login" />
      </>
    );
  }

  return (
    <NavigationProvider>
      <ViewModeProvider>
        <AppLayoutContent />
      </ViewModeProvider>
    </NavigationProvider>
  );
}
