"use client";

import { Stack, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
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
import { UI_DEV } from "@/lib/config";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";

export default function SignupScreen() {
  const { alert } = useAlert();
  const { signUp } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      setIsLoading(false);
      setShowVerificationMessage(true);
      return;
    } catch (error: any) {
      alert("Error", error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center px-6">
          <Card className="border-2 border-border mx-auto w-full max-w-lg bg-muted">
            <CardHeader className="items-center">
              <View className="w-16 h-16 items-center justify-center">
                <Mail color={colors.foreground} size={32} />
              </View>
              <CardTitle>
                <Text className="text-xl font-bold text-foreground text-center">
                  Check your email
                </Text>
              </CardTitle>
              <CardDescription className="flex flex-col items-center justify-center">
                <Text className="text-muted-foreground text-sm text-center mt-2">
                  We've sent a verification link to{"\n"}
                </Text>
                <Text className="font-semibold text-foreground">{email}</Text>
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              <Text className="text-muted-foreground text-sm text-center">
                Please check your inbox and click the verification link to
                activate your account. Once verified, you can sign in.
              </Text>

              <Button
                onPress={() => router.replace("/(auth)/login")}
                className="h-14 rounded-2xl mt-2 bg-foreground"
                size="xl"
              >
                <Text className="text-background font-semibold text-base">
                  Back to Sign In
                </Text>
              </Button>

              <Text className="text-muted-foreground text-xs text-center">
                Didn't receive the email? Check your spam folder or try signing
                up again.
              </Text>
            </CardContent>
          </Card>
        </View>
      </View>
    );
  }

  const signupContent = (
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
              Create new account
            </Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground text-sm">
              {UI_DEV
                ? "Use any email & password to explore the app."
                : "Create a new account to get started."}
            </Text>
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          <View className="gap-2" key="signup-email">
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

          <View className="gap-2" key="signup-password">
            <Label nativeID="password">Password</Label>
            <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter your password"
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

          <View className="gap-2" key="signup-confirm-password">
            <Label nativeID="confirmPassword">Confirm Password</Label>
            <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="p-2"
              >
                {showConfirmPassword ? (
                  <EyeOff color={THEME.light.mutedForeground} size={20} />
                ) : (
                  <Eye color={THEME.light.mutedForeground} size={20} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleSignup}
            className="h-14 rounded-2xl mt-2 bg-foreground"
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-base">
                Sign Up
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
                Already have an account? Sign In
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
          {signupContent}
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
          {signupContent}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
