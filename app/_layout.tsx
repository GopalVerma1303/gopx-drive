"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Alert, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Handle deep links for email verification
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleURL(initialUrl);
      }
    };

    const handleURL = async (url: string) => {
      try {
        const parsed = Linking.parse(url);

        // Check for error parameters in URL (Supabase auth errors)
        if (parsed.queryParams?.error) {
          const error = parsed.queryParams.error as string;
          const errorCode = parsed.queryParams.error_code as string;
          const errorDescription = parsed.queryParams
            .error_description as string;

          if (error === "access_denied" || errorCode === "otp_expired") {
            Alert.alert(
              "Verification Link Expired",
              errorDescription?.replace(/\+/g, " ") ||
                "The email verification link has expired. Please request a new verification email.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    // Navigate to login if not already there
                    const isOnAuthScreen = segments.some(
                      (seg) => seg === "login" || seg.includes("auth")
                    );
                    if (!isOnAuthScreen) {
                      router.replace("/(auth)/login" as any);
                    }
                  },
                },
              ]
            );
            return;
          }
        }

        // Supabase automatically handles email verification links when detectSessionInUrl is enabled
        // The session will be updated via onAuthStateChange in auth-context
        // We just need to handle errors and show success messages

        // Check if this is a Supabase auth callback
        if (url.includes("#access_token") || url.includes("type=email")) {
          // Give Supabase a moment to process the URL
          setTimeout(async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user?.email_confirmed_at) {
              Alert.alert(
                "Email Verified",
                "Your email has been verified successfully!",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // The auth context will handle routing automatically
                    },
                  },
                ]
              );
            }
          }, 1000);
        }
      } catch (error) {
        console.error("Error handling URL:", error);
      }
    };

    // Handle initial URL
    handleInitialURL();

    // Listen for incoming URLs
    const subscription = Linking.addEventListener("url", (event) => {
      handleURL(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [router, segments]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          } as any,
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            color: colors.foreground,
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <AuthProvider>
            <ThemeProvider>
              <RootLayoutNav />
              <PortalHost />
            </ThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
