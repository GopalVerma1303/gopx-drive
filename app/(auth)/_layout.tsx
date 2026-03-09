import { DefaultAppHead } from "@/components/default-app-head";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

export default function AuthLayout() {
  const { user, isLoading, isRecoveringPassword } = useAuth();
  const { colors } = useThemeColors();
  const router = useRouter();

  useEffect(() => {
    if (isRecoveringPassword) {
      router.replace("/(auth)/reset-password");
    }
  }, [isRecoveringPassword]);

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

  if (user && !isRecoveringPassword) {
    return (
      <>
        <DefaultAppHead />
        <Redirect href="/(app)/home" />
      </>
    );
  }

  return (
    <>
      <DefaultAppHead />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
