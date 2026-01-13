import { useAuth } from "@/contexts/auth-context";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)/notes" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
