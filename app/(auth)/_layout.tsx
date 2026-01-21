import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
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

  if (user) {
    return <Redirect href="/(app)/notes" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
