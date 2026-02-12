"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { uploadImageToNoteImages } from "@/lib/supabase-images";
import { useThemeColors } from "@/lib/use-theme-colors";
import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Link as LinkIcon, Upload, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

interface ImageInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}

export function ImageInsertModal({
  visible,
  onClose,
  onInsert,
}: ImageInsertModalProps) {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [altText, setAltText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      setAltText("");
      setImageUrl("");
      setUploadMode("url");
      setUploading(false);
    }
  }, [visible]);

  // Only enable KeyboardAvoidingView when keyboard is actually visible.
  // When keyboard closes, RN's KAV often leaves extra space / shifted layout;
  // disabling it on keyboardDidHide ensures the modal fills the screen again.
  useEffect(() => {
    if (Platform.OS === "web" || !visible) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleInsert = () => {
    if (!imageUrl.trim()) {
      Alert.alert("Error", "Please provide an image URL or upload an image");
      return;
    }

    const markdown = `![${altText}](${imageUrl})`;
    onInsert(markdown);

    // Reset form
    setAltText("");
    setImageUrl("");
    setUploadMode("url");
    setUploading(false);
    onClose();
  };

  const handleUploadImage = async () => {
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to upload images");
      return;
    }

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      setUploading(true);

      // Launch document picker with image filter
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !user) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];

      // Get file URI - handle different platforms
      // On web, expo-document-picker may return a File object directly
      let fileUri: string | globalThis.File = file.uri;
      if (Platform.OS === "web" && (file as any).file) {
        // On web, if file is a File object, use it directly
        fileUri = (file as any).file;
      }

      // Use file size from picker
      const fileSize = file.size || 0;

      // Determine MIME type
      let mimeType = file.mimeType || "image/jpeg";
      if (Platform.OS === "web" && fileUri instanceof globalThis.File) {
        mimeType = fileUri.type || mimeType;
      }

      // Upload to Supabase
      const uploadedUrl = await uploadImageToNoteImages({
        user_id: user.id,
        file: {
          uri: fileUri as any,
          name: file.name,
          type: mimeType,
          size: fileSize,
        },
      });

      setImageUrl(uploadedUrl);
      setUploading(false);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      setUploading(false);
      console.error("Upload error:", error);

      // Provide more helpful error messages
      let errorMessage = error.message || "Failed to upload image";

      if (errorMessage.includes("Network request failed") || errorMessage.includes("NetworkError")) {
        errorMessage = "Network request failed. Please check:\n\n1. Your internet connection\n2. The 'attachments' bucket exists in Supabase Storage\n3. Your Supabase credentials are correct\n\nSee SUPABASE_BUCKET_SETUP.md for setup instructions.";
      } else if (errorMessage.includes("Bucket not found") || errorMessage.includes("does not exist") || errorMessage.includes("404")) {
        // Check if error includes available buckets info
        if (errorMessage.includes("Available buckets:")) {
          errorMessage = errorMessage; // Keep the detailed message with available buckets
        } else {
          errorMessage = "The 'attachments' bucket doesn't exist (404). Please:\n\n1. Go to Supabase Dashboard → Storage\n2. Create a bucket named exactly 'attachments' (case-sensitive)\n3. Set it as Public\n\nSee SUPABASE_BUCKET_SETUP.md for detailed instructions.";
        }
      } else if (errorMessage.includes("new row violates row-level security") || errorMessage.includes("403")) {
        errorMessage = "Permission denied (403). Please check your Supabase Storage RLS policies. See SUPABASE_BUCKET_SETUP.md for setup instructions.";
      }

      Alert.alert("Upload Failed", errorMessage);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleClose = () => {
    setAltText("");
    setImageUrl("");
    setUploadMode("url");
    setUploading(false);
    onClose();
  };

  return (
    <>
      {Platform.OS === "web" ? (
        visible && (
          <View
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={handleClose}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <Text
                  className="text-lg font-semibold"
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                  }}
                >
                  Insert Image
                </Text>
                <Pressable onPress={handleClose} style={{ padding: 4 }}>
                  <X color={colors.foreground} size={20} />
                </Pressable>
              </View>

              {/* Alt Text Input */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Alt Text (Label)
                </Text>
                <Input
                  className="w-full"
                  placeholder="Enter alt text for the image"
                  value={altText}
                  onChangeText={setAltText}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Mode Selection */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Image Source
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setUploadMode("url");
                      setImageUrl("");
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor:
                        uploadMode === "url"
                          ? colors.foreground
                          : colors.border,
                      backgroundColor:
                        uploadMode === "url"
                          ? colors.background
                          : "transparent",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <LinkIcon
                      color={
                        uploadMode === "url"
                          ? colors.foreground
                          : colors.mutedForeground
                      }
                      size={20}
                    />
                    <Text
                      style={{
                        color:
                          uploadMode === "url"
                            ? colors.foreground
                            : colors.mutedForeground,
                        fontSize: 14,
                        fontWeight: uploadMode === "url" ? "600" : "400",
                      }}
                    >
                      Paste URL
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setUploadMode("upload");
                      setImageUrl("");
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor:
                        uploadMode === "upload"
                          ? colors.foreground
                          : colors.border,
                      backgroundColor:
                        uploadMode === "upload"
                          ? colors.background
                          : "transparent",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Upload
                      color={
                        uploadMode === "upload"
                          ? colors.foreground
                          : colors.mutedForeground
                      }
                      size={20}
                    />
                    <Text
                      style={{
                        color:
                          uploadMode === "upload"
                            ? colors.foreground
                            : colors.mutedForeground,
                        fontSize: 14,
                        fontWeight: uploadMode === "upload" ? "600" : "400",
                      }}
                    >
                      Upload Image
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* URL Input or Upload Button */}
              {uploadMode === "url" ? (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "500",
                      marginBottom: 8,
                    }}
                  >
                    Image URL
                  </Text>
                  <Input
                    className="w-full"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={{ marginBottom: 20 }}>
                  <Pressable
                    onPress={handleUploadImage}
                    disabled={uploading}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 48,
                      opacity: uploading ? 0.6 : 1,
                    }}
                  >
                    {uploading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.foreground}
                      />
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Upload color={colors.foreground} size={20} />
                        <Text
                          style={{
                            color: colors.foreground,
                            fontSize: 14,
                            fontWeight: "500",
                          }}
                        >
                          Choose Image
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  {imageUrl ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        marginTop: 8,
                      }}
                      numberOfLines={1}
                    >
                      ✓ Image uploaded: {imageUrl.substring(0, 50)}...
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Action Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={handleClose}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleInsert}
                  disabled={!imageUrl.trim()}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    opacity: imageUrl.trim() ? 1 : 0.4,
                  }}
                >
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontWeight: "600",
                    }}
                  >
                    Insert
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
          onRequestClose={handleClose}
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
                  onPress={handleClose}
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
                      maxWidth: 400,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 5,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 20,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 18,
                          fontWeight: "600",
                        }}
                      >
                        Insert Image
                      </Text>
                      <Pressable onPress={handleClose} style={{ padding: 4 }}>
                        <X color={colors.foreground} size={20} />
                      </Pressable>
                    </View>

                    {/* Alt Text Input */}
                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: "500",
                          marginBottom: 8,
                        }}
                      >
                        Alt Text (Label)
                      </Text>
                      <Input
                        className="w-full"
                        placeholder="Enter alt text for the image"
                        value={altText}
                        onChangeText={setAltText}
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>

                    {/* Mode Selection */}
                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: "500",
                          marginBottom: 8,
                        }}
                      >
                        Image Source
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            setUploadMode("url");
                            setImageUrl("");
                          }}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor:
                              uploadMode === "url"
                                ? colors.foreground
                                : colors.border,
                            backgroundColor:
                              uploadMode === "url"
                                ? colors.background
                                : "transparent",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <LinkIcon
                            color={
                              uploadMode === "url"
                                ? colors.foreground
                                : colors.mutedForeground
                            }
                            size={20}
                          />
                          <Text
                            style={{
                              color:
                                uploadMode === "url"
                                  ? colors.foreground
                                  : colors.mutedForeground,
                              fontSize: 14,
                              fontWeight: uploadMode === "url" ? "600" : "400",
                            }}
                          >
                            Paste URL
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setUploadMode("upload");
                            setImageUrl("");
                          }}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor:
                              uploadMode === "upload"
                                ? colors.foreground
                                : colors.border,
                            backgroundColor:
                              uploadMode === "upload"
                                ? colors.background
                                : "transparent",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Upload
                            color={
                              uploadMode === "upload"
                                ? colors.foreground
                                : colors.mutedForeground
                            }
                            size={20}
                          />
                          <Text
                            style={{
                              color:
                                uploadMode === "upload"
                                  ? colors.foreground
                                  : colors.mutedForeground,
                              fontSize: 14,
                              fontWeight: uploadMode === "upload" ? "600" : "400",
                            }}
                          >
                            Upload Image
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* URL Input or Upload Button */}
                    {uploadMode === "url" ? (
                      <View style={{ marginBottom: 20 }}>
                        <Text
                          style={{
                            color: colors.foreground,
                            fontSize: 14,
                            fontWeight: "500",
                            marginBottom: 8,
                          }}
                        >
                          Image URL
                        </Text>
                        <Input
                          className="w-full"
                          placeholder="https://example.com/image.jpg"
                          value={imageUrl}
                          onChangeText={setImageUrl}
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="url"
                          autoCapitalize="none"
                        />
                      </View>
                    ) : (
                      <View style={{ marginBottom: 20 }}>
                        <Pressable
                          onPress={handleUploadImage}
                          disabled={uploading}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 48,
                            opacity: uploading ? 0.6 : 1,
                          }}
                        >
                          {uploading ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.foreground}
                            />
                          ) : (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Upload color={colors.foreground} size={20} />
                              <Text
                                style={{
                                  color: colors.foreground,
                                  fontSize: 14,
                                  fontWeight: "500",
                                }}
                              >
                                Choose Image
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        {imageUrl ? (
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontSize: 12,
                              marginTop: 8,
                            }}
                            numberOfLines={1}
                          >
                            ✓ Image uploaded: {imageUrl.substring(0, 50)}...
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        gap: 12,
                      }}
                    >
                      <Pressable
                        onPress={handleClose}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: colors.foreground }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleInsert}
                        disabled={!imageUrl.trim()}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 6,
                          opacity: imageUrl.trim() ? 1 : 0.4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#3b82f6",
                            fontWeight: "600",
                          }}
                        >
                          Insert
                        </Text>
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
