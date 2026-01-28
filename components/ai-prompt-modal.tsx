import { useThemeColors } from "@/lib/use-theme-colors";
import { BlurView } from "expo-blur";
import * as React from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

interface AIPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  initialPrompt?: string;
  isLoading?: boolean;
}

export function AIPromptModal({
  visible,
  onClose,
  onGenerate,
  initialPrompt = "",
  isLoading = false,
}: AIPromptModalProps) {
  const { colors } = useThemeColors();
  const [prompt, setPrompt] = React.useState(initialPrompt);

  React.useEffect(() => {
    if (visible) {
      setPrompt(initialPrompt);
    }
  }, [visible, initialPrompt]);

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
                    backgroundColor: prompt.trim() && !isLoading ? "#3b82f6" : colors.muted,
                    opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                  }}
                  onPress={handleGenerate}
                  disabled={!prompt.trim() || isLoading}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    {isLoading ? "Generating..." : "Generate"}
                  </Text>
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
                      backgroundColor: prompt.trim() && !isLoading ? "#3b82f6" : colors.muted,
                      opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                    }}
                    onPress={handleGenerate}
                    disabled={!prompt.trim() || isLoading}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {isLoading ? "Generating..." : "Generate"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}
    </>
  );
}
