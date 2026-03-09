"use client";

import { Stack } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  View,
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
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { UI_DEV } from "@/lib/config";
import { THEME } from "@/lib/theme";

export default function LoginScreen() {
  const { alert } = useAlert();
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      alert("Error", "Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        if (!UI_DEV) {
          setIsLoading(false);
          setShowVerificationMessage(true);
          return;
        }
      } else {
        await signIn(email, password);
      }
      // Auth layout will redirect to /home when user is set (avoids race where
      // home mounts before auth state is committed and queries stay disabled).
    } catch (error: any) {
      alert(
        "Error",
        UI_DEV
          ? "This is a new login. Any credentials will work."
          : error.message || "Failed to authenticate"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center px-6">
          <Card className="border-2 border-foreground/5 mx-auto w-full max-w-lg bg-muted">
            <CardHeader className="items-center">
              <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                <Mail className="text-green-600" size={32} />
              </View>
              <CardTitle>
                <Text className="text-xl font-bold text-foreground text-center">
                  Check your email
                </Text>
              </CardTitle>
              <CardDescription>
                <Text className="text-muted-foreground text-sm text-center mt-2">
                  We've sent a verification link to{"\n"}
                  <Text className="font-semibold text-foreground">{email}</Text>
                </Text>
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              <Text className="text-muted-foreground text-sm text-center">
                Please check your inbox and click the verification link to
                activate your account. Once verified, you can sign in.
              </Text>

              <Button
                onPress={() => {
                  setShowVerificationMessage(false);
                  setIsSignUp(false);
                }}
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

  const authContent = (
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
              {isSignUp ? "Create new account" : "Welcome back"}
            </Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground text-sm">
              {UI_DEV
                ? isSignUp
                  ? "Use any email & password to explore the app."
                  : "Sign in with any email and password to continue."
                : isSignUp
                  ? "Create a new account to get started."
                  : "Sign in to your account to continue."}
            </Text>
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          {/* Email Field */}
          <View className="gap-2">
            <Label nativeID="email">Email</Label>
            <View className="flex-row items-center bg-muted rounded-2xl px-4 h-14 border border-border">
              <Mail
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-3 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabelledBy="email"
              />
            </View>
          </View>

          {/* Password Field */}
          <View className="gap-2">
            <Label nativeID="password">Password</Label>
            <View className="flex-row items-center bg-muted rounded-2xl px-4 h-14 border border-border">
              <Lock
                className="text-muted-foreground"
                color={THEME.light.mutedForeground}
                size={20}
              />
              <Input
                className="flex-1 ml-3 border-0 bg-transparent h-full shadow-none"
                placeholder="Enter a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                accessibilityLabelledBy="password"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                className="p-2"
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff
                    className="text-muted-foreground"
                    color={THEME.light.mutedForeground}
                    size={20}
                  />
                ) : (
                  <Eye
                    className="text-muted-foreground"
                    color={THEME.light.mutedForeground}
                    size={20}
                  />
                )}
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleAuth}
            className="h-14 rounded-2xl mt-2 bg-foreground"
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="background" />
            ) : (
              <Text className="text-background font-semibold text-base">
                {isSignUp
                  ? UI_DEV
                    ? "Create new account"
                    : "Sign Up"
                  : UI_DEV
                    ? "Login"
                    : "Sign In"}
              </Text>
            )}
          </Button>

          {/* Toggle Sign Up / Sign In */}
          <Button
            variant="link"
            onPress={() => setIsSignUp(!isSignUp)}
            className="h-auto py-4"
          >
            <Text className="text-foreground text-sm font-medium leading-relaxed">
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Text>
          </Button>
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
          {authContent}
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
          {authContent}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
