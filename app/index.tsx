import { DefaultAppHead } from "@/components/default-app-head";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { colors } = useThemeColors();

  // While we don't yet know if the user is authenticated, avoid showing
  // either the login screen or the notes screen. This prevents the
  // brief flash of the login route when a valid session exists.
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

  if (user) {
    // Authenticated: go straight to the main app (notes)
    return (
      <>
        <DefaultAppHead />
        <Redirect href="/(app)/notes" />
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
