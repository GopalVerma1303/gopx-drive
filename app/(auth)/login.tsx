"use client";

import { Stack, useRouter } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.replace("/(app)/notes");
    } catch (error: any) {
      Alert.alert(
        "Error",
        UI_DEV
          ? "This is a demo login. Any credentials will work."
          : error.message || "Failed to authenticate"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="flex-1 justify-center px-6">
            {/* Header */}
            <View className="items-center mb-8">
              <Text className="text-foreground text-4xl font-bold">
                Gopx Drive
              </Text>
              <Text className="text-foreground text-base">
                Your thoughts, organized
              </Text>
            </View>

            {/* Auth Card */}
            <Card className="bg-white/95 border-0 rounded-3xl">
              <CardHeader>
                <CardTitle>
                  <Text className="text-xl font-bold text-foreground">
                    {isSignUp ? "Create demo account" : "Welcome back"}
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
                    <Mail color="#667eea" size={20} />
                    <Input
                      className="flex-1 ml-3 border-0 bg-transparent h-full"
                      placeholder="you@example.com"
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
                    <Lock color="#667eea" size={20} />
                    <Input
                      className="flex-1 ml-3 border-0 bg-transparent h-full"
                      placeholder="Enter a password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      accessibilityLabelledBy="password"
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <Button
                  onPress={handleAuth}
                  className="h-14 rounded-2xl mt-2 bg-foreground"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="background" />
                  ) : (
                    <Text className="text-background font-semibold text-base">
                      {isSignUp
                        ? UI_DEV
                          ? "Create demo account"
                          : "Sign Up"
                        : UI_DEV
                          ? "Enter app"
                          : "Sign In"}
                    </Text>
                  )}
                </Button>

                {/* Toggle Sign Up / Sign In */}
                <Button
                  variant="link"
                  onPress={() => setIsSignUp(!isSignUp)}
                  className="py-3"
                >
                  <Text className="text-foreground text-sm font-medium">
                    {isSignUp
                      ? "Already have an account? Sign In"
                      : "Don't have an account? Sign Up"}
                  </Text>
                </Button>
              </CardContent>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
