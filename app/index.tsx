import { DefaultAppHead } from "@/components/default-app-head";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";

export default function Index() {
  const { user, isLoading, isRecoveringPassword } = useAuth();
  const { colors } = useThemeColors();

  if (isLoading) {
    return (
      <>
        <DefaultAppHead />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      </>
    );
  }

  if (user && !isRecoveringPassword) {
    // Authenticated: go straight to home
    return (
      <>
        <DefaultAppHead />
        <Redirect href="/(app)/home" />
      </>
    );
  }

  // Not authenticated: send to login
  return (
    <>
      <DefaultAppHead />
      <Redirect href="/(auth)/login" />
    </>
  );
}
