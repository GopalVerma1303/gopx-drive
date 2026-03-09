"use client";

import { Stack, useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";

export default function ForgotPasswordScreen() {
  const { alert } = useAlert();
  const { resetPassword } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      alert("Error", "Please enter your email to reset password");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
      alert("Success", "Password reset link sent to your email");
    } catch (error: any) {
      alert("Error", error.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPasswordContent = (
    <View className="px-6">
      {/* Header */}
      <View className="items-center mb-8 mt-12">
        <Text className="text-foreground text-4xl font-bold">Gopx Drive</Text>
        <Text className="text-foreground text-base">
          Your files & folders, organized
        </Text>
      </View>

      {/* Auth Card */}
      <Card className="border-0 mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            <Text className="text-xl font-bold text-foreground">
              Reset Password
            </Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground text-sm">
              Enter your email to receive a password reset link.
            </Text>
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          <View className="gap-2" key="reset-email">
            <Label nativeID="email">Email</Label>
            <View className="flex-row items-center bg-muted rounded-2xl px-4 h-14 border border-border">
              <Mail
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleResetPassword}
            className="h-14 rounded-2xl mt-2 bg-foreground"
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-base">
                Send Reset Link
              </Text>
            )}
          </Button>

          {/* Toggle View */}
          <View className="flex-row justify-center mt-2">
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              className="py-2"
            >
              <Text className="text-muted-foreground text-sm font-medium text-center">
                Back to Sign In
              </Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === "web" ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 40),
          }}
        >
          {forgotPasswordContent}
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 40),
          }}
        >
          {forgotPasswordContent}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
