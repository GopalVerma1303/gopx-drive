"use client";

import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { Text } from "@/components/ui/text";
import { useAlert } from "@/contexts/alert-context";
import { useAuth } from "@/contexts/auth-context";
import { UI_DEV } from "@/lib/config";
import { THEME } from "@/lib/theme";

export default function LoginScreen() {
  const { alert } = useAlert();
  const { signIn, signUp, isRecoveringPassword, setIsRecoveringPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { type } = useLocalSearchParams<{ type: string }>();
  const [isResetPassword, setIsResetPassword] = useState(false);

  const { resetPassword, updatePassword } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isRecoveringPassword) {
      setIsResetPassword(true);
      setIsForgotPassword(false);
      setIsSignUp(false);
    }
  }, [isRecoveringPassword]);

  const handleAuth = async () => {
    if (!email || !password) {
      alert("Error", "Please enter both email and password");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      alert("Error", "Passwords do not match");
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
    } catch (error: any) {
      alert("Error", error.message || "Failed to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

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
      setIsForgotPassword(false);
    } catch (error: any) {
      alert("Error", error.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

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
      setIsResetPassword(false);
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

  if (showVerificationMessage) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center px-6">
          <Card className="border-2 border-border mx-auto w-full max-w-lg bg-muted">
            <CardHeader className="items-center">
              <View className="w-16 h-16 items-center justify-center">
                <Mail className="text-foreground" size={32} />
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
              {isResetPassword
                ? "Set New Password"
                : isForgotPassword
                  ? "Reset Password"
                  : isSignUp
                    ? "Create new account"
                    : "Welcome back"}
            </Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground text-sm">
              {isResetPassword
                ? "Please enter your new password below."
                : isForgotPassword
                  ? "Enter your email to receive a password reset link."
                  : UI_DEV
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
          {!isResetPassword && (
            <View className="gap-2">
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
                  accessibilityLabelledBy="email"
                />
              </View>
            </View>
          )}

          {(!isForgotPassword || isResetPassword) && (
            <View className="gap-2">
              <Label nativeID="password">
                {isResetPassword ? "New Password" : "Password"}
              </Label>
              <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
                <Lock
                  className="text-muted-foreground"
                  color={THEME.light.mutedForeground}
                  size={20}
                />
                <Input
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                  placeholder={isResetPassword ? "Enter new password" : "Enter your password"}
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
          )}

          {(isSignUp || isResetPassword) && (
            <View className="gap-2">
              <Label nativeID="confirmPassword">
                {isResetPassword ? "Confirm New Password" : "Confirm Password"}
              </Label>
              <View className="flex-row items-center bg-muted rounded-2xl pl-4 pr-2 h-14 border border-border">
                <Lock
                  className="text-muted-foreground"
                  color={THEME.light.mutedForeground}
                  size={20}
                />
                <Input
                  className="flex-1 ml-2 border-0 bg-transparent h-full shadow-none"
                  placeholder={isResetPassword ? "Repeat new password" : "Confirm your password"}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  accessibilityLabelledBy="confirmPassword"
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
          )}

          {!isSignUp && !isForgotPassword && (
            <Pressable
              onPress={() => setIsForgotPassword(true)}
              className="self-end"
              hitSlop={8}
            >
              <Text className="text-blue-500 text-sm font-medium">Forgot Password?</Text>
            </Pressable>
          )}

          {/* Submit Button */}
          <Button
            onPress={
              isResetPassword
                ? handleSetNewPassword
                : isForgotPassword
                  ? handleResetPassword
                  : handleAuth
            }
            className="h-14 rounded-2xl mt-2 bg-foreground"
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="background" />
            ) : (
              <Text className="text-background font-semibold text-base">
                {isResetPassword
                  ? "Update Password"
                  : isForgotPassword
                    ? "Send Reset Link"
                    : isSignUp
                      ? "Sign Up"
                      : "Sign In"}
              </Text>
            )}
          </Button>

          {/* Toggle View */}
          <View className="flex-row justify-center mt-2">
            <Pressable
              onPress={() => {
                if (isResetPassword) {
                  setIsResetPassword(false);
                  setIsRecoveringPassword(false);
                  router.replace("/(auth)/login");
                } else if (isForgotPassword) {
                  setIsForgotPassword(false);
                } else {
                  setIsSignUp(!isSignUp);
                }
              }}
              className="py-2"
            >
              <Text className="text-muted-foreground text-sm font-medium text-center">
                {isResetPassword
                  ? "Cancel and go to Sign In"
                  : isForgotPassword
                    ? "Back to Sign In"
                    : isSignUp
                      ? "Already have an account? Sign In"
                      : "Don't have an account? Sign Up"}
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
