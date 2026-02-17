"use client";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { ArrowUp, Bot, Loader2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const API_BASE_URL = "http://localhost:3001";

export default function ChatScreen() {
  const { colors } = useThemeColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Get first letter of email for avatar
  const userInitial = user?.email?.[0]?.toUpperCase() || "U";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const dotAnimations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, streamingContent]);

  // Animate typing indicator dots
  useEffect(() => {
    if (isLoading && !streamingContent) {
      const animateDots = () => {
        const animations = dotAnimations.map((anim, index) =>
          Animated.sequence([
            Animated.delay(index * 150),
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
        Animated.loop(Animated.parallel(animations)).start();
      };
      animateDots();
    } else {
      dotAnimations.forEach((anim) => anim.setValue(0));
    }
  }, [isLoading, streamingContent]);

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedInput,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setIsLoading(true);
    setStreamingContent("");

    // Haptic feedback
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingContent(fullResponse);
              } else if (data.done) {
                // Stream complete - add assistant message
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: fullResponse,
                  timestamp: new Date(),
                };
                setMessages([...newMessages, assistantMessage]);
                setStreamingContent("");
                setIsLoading(false);
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setError(error instanceof Error ? error.message : "Failed to send message");
      setIsLoading(false);
      setStreamingContent("");
    }
  };


  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Centered Container */}
        <View
          className="px-4"
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {/* Hero Section - Content Wrapper */}
          <View
            className="w-full max-w-2xl items-center"
            style={{ flexShrink: 1 }}
          >
            {/* Gopx AI Title */}
            <View className="items-center">
              <Text
                variant="h1"
                className="text-center"
                style={{ color: colors.foreground }}
              >
                Gopx AI
              </Text>
            </View>

            {/* Chat Container */}
            <View className="w-full">
              {/* Messages List */}
              <ScrollView
                ref={scrollViewRef}
                style={{ maxHeight: 400 }}
                contentContainerStyle={{
                  paddingTop: 16,
                  paddingBottom: 16,
                  paddingHorizontal: 16,
                }}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((message) => (
                  <View
                    key={message.id}
                    className={cn(
                      "mb-4 flex-row",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <View
                        className="mr-2 h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.primary + "20" }}
                      >
                        <Bot size={16} color={colors.primary} strokeWidth={2} />
                      </View>
                    )}
                    <View
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "rounded-tr-sm"
                          : "rounded-tl-sm"
                      )}
                      style={{
                        backgroundColor:
                          message.role === "user" ? colors.primary : colors.card,
                        borderWidth: message.role === "assistant" ? 1 : 0,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        className="text-base leading-6"
                        style={{
                          color:
                            message.role === "user"
                              ? colors.primaryForeground
                              : colors.foreground,
                        }}
                      >
                        {message.content}
                      </Text>
                    </View>
                    {message.role === "user" && (
                      <View
                        className="ml-2 h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: colors.primaryForeground }}
                        >
                          {userInitial}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}

                {/* Streaming message */}
                {isLoading && streamingContent && (
                  <View className="mb-4 flex-row justify-start">
                    <View
                      className="mr-2 h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <Bot size={16} color={colors.primary} strokeWidth={2} />
                    </View>
                    <View
                      className="max-w-[80%] rounded-2xl rounded-tl-sm border px-4 py-3"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        className="text-base leading-6"
                        style={{ color: colors.foreground }}
                      >
                        {streamingContent}
                      </Text>
                      <Text
                        className="text-base leading-6 opacity-50"
                        style={{ color: colors.foreground }}
                      >
                        ▊
                      </Text>
                    </View>
                  </View>
                )}

                {/* Typing indicator */}
                {isLoading && !streamingContent && (
                  <View className="mb-4 flex-row justify-start">
                    <View
                      className="mr-2 h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <Bot size={16} color={colors.primary} strokeWidth={2} />
                    </View>
                    <View
                      className="rounded-2xl rounded-tl-sm border px-4 py-3"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <View className="flex-row items-center gap-1.5">
                        {dotAnimations.map((anim, index) => (
                          <Animated.View
                            key={index}
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: colors.mutedForeground,
                              opacity: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.3, 1],
                              }),
                              transform: [
                                {
                                  translateY: anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                  }),
                                },
                              ],
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Error message */}
                {error && (
                  <View
                    className="mb-4 rounded-lg border px-4 py-3"
                    style={{
                      backgroundColor: colors.destructive + "20",
                      borderColor: colors.destructive + "50",
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{ color: colors.destructive }}
                    >
                      {error}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Input Area */}
              <View
                className="px-4 pb-2 pt-3"
                style={{
                  backgroundColor: colors.background,
                  paddingBottom: Math.max(insets.bottom, 12),
                }}
              >
                <View
                  className="flex-row items-start rounded-2xl border border-border bg-muted px-4 py-3 min-h-[96px] gap-2"
                >
                  <TextInput
                    ref={inputRef}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask anything. Type @ for sources and / for shortcuts."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    maxLength={2000}
                    editable={!isLoading}
                    className="flex-1 text-base leading-6 border-0 bg-transparent px-0 shadow-none focus:outline-none focus:ring-0"
                    style={{
                      color: colors.foreground,
                      maxHeight: 120,
                      minHeight: 24,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }}
                    onSubmitEditing={() => {
                      if (!isLoading && input.trim()) {
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    onPress={sendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="h-8 w-8 rounded-full shrink-0 mt-auto mb-0.5"
                    style={{
                      backgroundColor: colors.primary,
                    }}
                  >
                    {isLoading ? (
                      <Loader2 size={16} color={colors.primaryForeground} />
                    ) : (
                      <ArrowUp size={16} color={colors.primaryForeground} />
                    )}
                  </Button>
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
