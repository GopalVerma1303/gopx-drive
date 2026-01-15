"use client";

import { Stack, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
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
import { useAuth } from "@/contexts/auth-context";
import { UI_DEV } from "@/lib/config";
import { getRadius, getSpacing } from "@/lib/theme/styles";
import { useThemeColors } from "@/lib/use-theme-colors";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
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
      // Only route to notes if we have a verified session
      router.replace("/(app)/notes");
    } catch (error: any) {
      Alert.alert(
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: getSpacing(6),
          }}
        >
          <Card
            style={{
              borderWidth: 2,
              borderColor: colors.foreground + "0D", // 5% opacity
              alignSelf: "center",
              width: "100%",
              maxWidth: 512, // max-w-lg
              backgroundColor: colors.muted,
            }}
          >
            <CardHeader style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 9999,
                  backgroundColor: "#D1FAE5", // green-100
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: getSpacing(4),
                }}
              >
                <Mail color="#059669" size={32} />
              </View>
              <CardTitle>
                <Text
                  variant="h4"
                  style={{
                    color: colors.foreground,
                    textAlign: "center",
                  }}
                >
                  Check your email
                </Text>
              </CardTitle>
              <CardDescription>
                <Text
                  variant="small"
                  style={{
                    color: colors.mutedForeground,
                    textAlign: "center",
                    marginTop: getSpacing(2),
                  }}
                >
                  We've sent a verification link to{"\n"}
                  <Text style={{ fontWeight: "600", color: colors.foreground }}>
                    {email}
                  </Text>
                </Text>
              </CardDescription>
            </CardHeader>

            <CardContent style={{ gap: getSpacing(4) }}>
              <Text
                variant="small"
                style={{
                  color: colors.mutedForeground,
                  textAlign: "center",
                }}
              >
                Please check your inbox and click the verification link to
                activate your account. Once verified, you can sign in.
              </Text>

              <Button
                onPress={() => {
                  setShowVerificationMessage(false);
                  setIsSignUp(false);
                }}
                style={{
                  height: 56,
                  borderRadius: getRadius("2xl"),
                  marginTop: getSpacing(2),
                  backgroundColor: colors.foreground,
                }}
                size="xl"
              >
                <Text
                  style={{
                    color: colors.background,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  Back to Sign In
                </Text>
              </Button>

              <Text
                variant="small"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
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
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: getSpacing(6),
      }}
    >
      {/* Header */}
      <View style={{ alignItems: "center", marginBottom: getSpacing(8) }}>
        <Text
          variant="h1"
          style={{
            color: colors.foreground,
          }}
        >
          Gopx Drive
        </Text>
        <Text
          style={{
            color: colors.foreground,
          }}
        >
          Your files & folders, organized
        </Text>
      </View>

      {/* Auth Card */}
      <Card
        style={{
          borderWidth: 0,
          alignSelf: "center",
          width: "100%",
          maxWidth: "95%", // max-w-lg
          elevation: 0,
        }}
      >
        <CardHeader>
          <CardTitle>
            <Text
              variant="h4"
              style={{
                color: colors.foreground,
              }}
            >
              {isSignUp ? "Create new account" : "Welcome back"}
            </Text>
          </CardTitle>
          <CardDescription>
            <Text variant="small" style={{ color: colors.mutedForeground }}>
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

        <CardContent style={{ gap: getSpacing(4) }}>
          {/* Email Field */}
          <View style={{ gap: getSpacing(2) }}>
            <Label nativeID="email">Email</Label>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.muted,
                borderRadius: getRadius("2xl"),
                paddingHorizontal: getSpacing(4),
                height: 56,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Mail color={colors.mutedForeground} size={20} />
              <Input
                style={{
                  flex: 1,
                  marginLeft: getSpacing(3),
                  borderWidth: 0,
                  backgroundColor: "transparent",
                  height: "100%",
                }}
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
          <View style={{ gap: getSpacing(2) }}>
            <Label nativeID="password">Password</Label>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.muted,
                borderRadius: getRadius("2xl"),
                paddingHorizontal: getSpacing(4),
                height: 56,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Lock color={colors.mutedForeground} size={20} />
              <Input
                style={{
                  flex: 1,
                  marginLeft: getSpacing(3),
                  borderWidth: 0,
                  backgroundColor: "transparent",
                  height: "100%",
                }}
                placeholder="Enter a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                accessibilityLabelledBy="password"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ padding: getSpacing(2) }}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff color={colors.mutedForeground} size={20} />
                ) : (
                  <Eye color={colors.mutedForeground} size={20} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleAuth}
            style={{
              height: 56,
              borderRadius: getRadius("2xl"),
              marginTop: getSpacing(2),
              backgroundColor: colors.foreground,
            }}
            size="xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text
                style={{
                  color: colors.background,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
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
            style={{ paddingVertical: getSpacing(3) }}
          >
            <Text
              variant="small"
              style={{
                color: colors.foreground,
                fontWeight: "500",
              }}
            >
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
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>{authContent}</View>
      </KeyboardAvoidingView>
    </View>
  );
}
