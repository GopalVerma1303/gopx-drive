"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { uploadImageToNoteImages } from "@/lib/supabase-images";
import { useThemeColors } from "@/lib/use-theme-colors";
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
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={handleClose} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <View className="mb-5 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">
                  Insert Image
                </Text>
                <Pressable onPress={handleClose} className="p-1">
                  <X color={colors.foreground} size={20} />
                </Pressable>
              </View>

              {/* Alt Text Input */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-foreground">
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
              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-foreground">
                  Image Source
                </Text>
                <View className="mb-3 flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      setUploadMode("url");
                      setImageUrl("");
                    }}
                    className={`flex-1 items-center gap-2 rounded-lg border p-3 ${
                      uploadMode === "url"
                        ? "border-foreground bg-background"
                        : "border-border bg-transparent"
                    }`}
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
                      className={
                        uploadMode === "url"
                          ? "text-sm font-semibold text-foreground"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      Paste URL
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setUploadMode("upload");
                      setImageUrl("");
                    }}
                    className={`flex-1 items-center gap-2 rounded-lg border p-3 ${
                      uploadMode === "upload"
                        ? "border-foreground bg-background"
                        : "border-border bg-transparent"
                    }`}
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
                      className={
                        uploadMode === "upload"
                          ? "text-sm font-semibold text-foreground"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      Upload Image
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* URL Input or Upload Button */}
              {uploadMode === "url" ? (
                <View className="mb-5">
                  <Text className="mb-2 text-sm font-medium text-foreground">
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
                <View className="mb-5">
                  <Pressable
                    onPress={handleUploadImage}
                    disabled={uploading}
                    className={`min-h-[48px] items-center justify-center rounded-lg border border-border bg-background p-3 ${uploading ? "opacity-60" : ""}`}
                  >
                    {uploading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.foreground}
                      />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Upload color={colors.foreground} size={20} />
                        <Text className="text-sm font-medium text-foreground">
                          Choose Image
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  {imageUrl ? (
                    <Text
                      className="mt-2 text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      ✓ Image uploaded: {imageUrl.substring(0, 50)}...
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Action Buttons */}
              <View className="flex-row justify-end gap-3">
                <Pressable onPress={handleClose} className="px-4 py-2">
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleInsert}
                  disabled={!imageUrl.trim()}
                  className={`rounded-md px-4 py-2 ${imageUrl.trim() ? "opacity-100" : "opacity-40"}`}
                >
                  <Text className="font-semibold text-blue-500">
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
            className="flex-1"
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            enabled={keyboardVisible}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1">
                <Pressable className="absolute inset-0" onPress={handleClose} />
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
                  <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
                    <View className="mb-5 flex-row items-center justify-between">
                      <Text className="text-lg font-semibold text-foreground">
                        Insert Image
                      </Text>
                      <Pressable onPress={handleClose} className="p-1">
                        <X color={colors.foreground} size={20} />
                      </Pressable>
                    </View>

                    {/* Alt Text Input */}
                    <View className="mb-4">
                      <Text className="mb-2 text-sm font-medium text-foreground">
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
                    <View className="mb-4">
                      <Text className="mb-2 text-sm font-medium text-foreground">
                        Image Source
                      </Text>
                      <View className="mb-3 flex-row gap-2">
                        <Pressable
                          onPress={() => {
                            setUploadMode("url");
                            setImageUrl("");
                          }}
                          className={`flex-1 items-center gap-2 rounded-lg border p-3 ${
                            uploadMode === "url"
                              ? "border-foreground bg-background"
                              : "border-border bg-transparent"
                          }`}
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
                            className={
                              uploadMode === "url"
                                ? "text-sm font-semibold text-foreground"
                                : "text-sm text-muted-foreground"
                            }
                          >
                            Paste URL
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setUploadMode("upload");
                            setImageUrl("");
                          }}
                          className={`flex-1 items-center gap-2 rounded-lg border p-3 ${
                            uploadMode === "upload"
                              ? "border-foreground bg-background"
                              : "border-border bg-transparent"
                          }`}
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
                            className={
                              uploadMode === "upload"
                                ? "text-sm font-semibold text-foreground"
                                : "text-sm text-muted-foreground"
                            }
                          >
                            Upload Image
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* URL Input or Upload Button */}
                    {uploadMode === "url" ? (
                      <View className="mb-5">
                        <Text className="mb-2 text-sm font-medium text-foreground">
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
                      <View className="mb-5">
                        <Pressable
                          onPress={handleUploadImage}
                          disabled={uploading}
                          className={`min-h-[48px] items-center justify-center rounded-lg border border-border bg-background p-3 ${uploading ? "opacity-60" : ""}`}
                        >
                          {uploading ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.foreground}
                            />
                          ) : (
                            <View className="flex-row items-center gap-2">
                              <Upload color={colors.foreground} size={20} />
                              <Text className="text-sm font-medium text-foreground">
                                Choose Image
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        {imageUrl ? (
                          <Text
                            className="mt-2 text-xs text-muted-foreground"
                            numberOfLines={1}
                          >
                            ✓ Image uploaded: {imageUrl.substring(0, 50)}...
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View className="flex-row justify-end gap-3">
                      <Pressable onPress={handleClose} className="px-4 py-2">
                        <Text className="text-foreground">Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleInsert}
                        disabled={!imageUrl.trim()}
                        className={`rounded-md px-4 py-2 ${imageUrl.trim() ? "opacity-100" : "opacity-40"}`}
                      >
                        <Text className="font-semibold text-blue-500">
                          Insert
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}
