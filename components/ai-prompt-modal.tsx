import { useThemeColors } from "@/lib/use-theme-colors";
import { BlurView } from "expo-blur";
import * as React from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Svg, { Defs, Stop, LinearGradient as SvgLinearGradient, Text as SvgText, TSpan } from "react-native-svg";

interface AIPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  initialPrompt?: string;
  isLoading?: boolean;
}

// Gradient text component for cross-platform gradient text
const GradientText = ({ children, style, disabled }: { children: React.ReactNode; style?: any; disabled?: boolean }) => {
  const { colors } = useThemeColors();
  const textRef = React.useRef<Text>(null);
  const [textLayout, setTextLayout] = React.useState({ width: 0, height: 0 });

  // Use a unique gradient ID to avoid conflicts - must be called before any conditional returns
  const gradientId = React.useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  const fontSize = style?.fontSize || 15;
  const fontWeight = style?.fontWeight || "700";
  const textString = typeof children === "string" ? children : String(children);

  if (Platform.OS === "web") {
    if (disabled) {
      return <Text style={[{ color: colors.mutedForeground, fontSize }, style]}>{children}</Text>;
    }
    return (
      <Text
        style={[
          style,
          {
            fontSize,
            fontWeight,
            background: "linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  // For native platforms, always use the same container structure to prevent layout shifts
  // Always render Text first for measurement, then overlay SVG when enabled
  return (
    <View
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Always render Text for consistent sizing - this prevents layout shift */}
      {/* Make text fully transparent when gradient is enabled (disabled=false) */}
      <Text
        ref={textRef}
        style={[
          style,
          {
            color: disabled ? colors.mutedForeground : "transparent",
            fontSize,
            fontWeight,
            letterSpacing: style?.letterSpacing || 0.1,
          },
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0 && (textLayout.width !== width || textLayout.height !== height)) {
            setTextLayout({ width, height });
          }
        }}
      >
        {children}
      </Text>

      {/* Overlay gradient SVG when enabled - uses same dimensions as Text */}
      {!disabled && textLayout.width > 0 && textLayout.height > 0 && (
        <Svg
          width={textLayout.width}
          height={textLayout.height}
          style={{ position: "absolute" }}
        >
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#ec4899" stopOpacity="1" />
              <Stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <SvgText
            x="0"
            y={fontSize + 1}
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={`url(#${gradientId})`}
            letterSpacing={style?.letterSpacing || 0.7}
          >
            <TSpan>{textString}</TSpan>
          </SvgText>
        </Svg>
      )}
    </View>
  );
};

export function AIPromptModal({
  visible,
  onClose,
  onGenerate,
  initialPrompt = "",
  isLoading = false,
}: AIPromptModalProps) {
  const { colors } = useThemeColors();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setPrompt(initialPrompt);
    } else {
      setKeyboardVisible(false);
    }
  }, [visible, initialPrompt]);

  // Only enable KeyboardAvoidingView when keyboard is actually visible.
  // When keyboard closes, RN's KAV often leaves extra space / shifted layout;
  // disabling it on keyboardDidHide ensures the modal fills the screen again.
  React.useEffect(() => {
    if (Platform.OS === "web" || !visible) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleGenerate = () => {
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <>
      {Platform.OS === "web" ? (
        visible && (
          <View
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              zIndex: 10000,
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={onClose}
            />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 500,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                AI Assistant
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                Enter your prompt to generate content. The AI will respond with markdown content only.
              </Text>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="What would you like to generate?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 6,
                  padding: 12,
                  color: colors.foreground,
                  fontSize: 14,
                  minHeight: 100,
                  textAlignVertical: "top",
                  marginBottom: 24,
                }}
                autoFocus
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                  }}
                  onPress={handleGenerate}
                  disabled={!prompt.trim() || isLoading}
                >
                  <GradientText
                    disabled={!prompt.trim() || isLoading}
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    {isLoading ? "Generating..." : "Generate"}
                  </GradientText>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            enabled={keyboardVisible}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              }}
            >
              <BlurView
                intensity={20}
                tint="dark"
                style={{
                  flex: 1,
                }}
              >
                <Pressable
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  onPress={onClose}
                />
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={{
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      padding: 24,
                      width: "100%",
                      maxWidth: 500,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 18,
                        fontWeight: "600",
                        marginBottom: 8,
                      }}
                    >
                      AI Assistant
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 14,
                        marginBottom: 16,
                      }}
                    >
                      Enter your prompt to generate content. The AI will respond with markdown content only.
                    </Text>
                    <TextInput
                      value={prompt}
                      onChangeText={setPrompt}
                      placeholder="What would you like to generate?"
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      numberOfLines={4}
                      style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 6,
                        padding: 12,
                        color: colors.foreground,
                        fontSize: 14,
                        minHeight: 100,
                        textAlignVertical: "top",
                        marginBottom: 24,
                      }}
                      autoFocus
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Pressable
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                        }}
                        onPress={onClose}
                        disabled={isLoading}
                      >
                        <Text style={{ color: colors.foreground }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 6,
                          opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                        }}
                        onPress={handleGenerate}
                        disabled={!prompt.trim() || isLoading}
                      >
                        <GradientText
                          disabled={!prompt.trim() || isLoading}
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                          }}
                        >
                          {isLoading ? "Generating..." : "Generate"}
                        </GradientText>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              </BlurView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}
