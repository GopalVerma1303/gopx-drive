import splashIcon from "@/assets/images/splash-icon.png";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Redirect } from "expo-router";
import { Image, View } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { colors } = useThemeColors();

  // While we don't yet know if the user is authenticated, avoid showing
  // either the login screen or the notes screen. This prevents the
  // brief flash of the login route when a valid session exists.
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <Image
          source={splashIcon}
          style={{
            width: 160,
            height: 160,
            resizeMode: "contain",
            borderRadius: 30
          }}
        />
      </View>
    );
  }

  if (user) {
    // Authenticated: go straight to the main app (notes)
    return <Redirect href="/(app)/notes" />;
  }

  // Not authenticated: send to login
  return <Redirect href="/(auth)/login" />;
}
