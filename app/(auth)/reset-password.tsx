"use client";

import { Stack, useRouter } from "expo-router";
import { Eye, EyeOff, Lock } from "lucide-react-native";
import { useEffect, useState } from "react";
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
import { Loader } from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { THEME } from "@/lib/theme";

export default function ResetPasswordScreen() {
  const { alert } = useAlert();
  const { isRecoveringPassword, setIsRecoveringPassword, updatePassword } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If we aren't recovering, we shouldn't be here
  useEffect(() => {
    if (!isRecoveringPassword) {
      router.replace("/(auth)/login");
    }
  }, [isRecoveringPassword]);

  const handleSetNewPassword = async () => {
    if (!password || !confirmPassword) {
      alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      alert("Success", "Password updated successfully. Please sign in with your new password.");
      setIsRecoveringPassword(false);
      setPassword("");
      setConfirmPassword("");
      router.replace("/(auth)/login");
    } catch (error: any) {
      alert("Error", error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPasswordContent = (
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
              Set New Password
            </Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground text-sm">
              Please enter your new password below.
            </Text>
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          <View className="gap-2" key="new-password">
            <Label nativeID="password">New Password</Label>
            <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                className="p-2"
              >
                {showPassword ? (
                  <EyeOff color={THEME.light.mutedForeground} size={20} />
                ) : (
                  <Eye color={THEME.light.mutedForeground} size={20} />
                )}
              </Pressable>
            </View>
          </View>

          <View className="gap-2" key="confirm-new-password">
            <Label nativeID="confirmPassword">Confirm New Password</Label>
            <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleSetNewPassword}
            className="h-14 rounded-2xl mt-2 bg-foreground"
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-base">
                Update Password
              </Text>
            )}
          </Button>

          {/* Toggle View */}
          <View className="flex-row justify-center mt-2">
            <Pressable
              onPress={() => {
                setIsRecoveringPassword(false);
                router.replace("/(auth)/login");
              }}
              className="py-2"
            >
              <Text className="text-muted-foreground text-sm font-medium text-center">
                Cancel and go to Sign In
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
          {resetPasswordContent}
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
          {resetPasswordContent}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
