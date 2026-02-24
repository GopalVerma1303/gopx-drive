import { useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExternalLink, X } from "lucide-react-native";

import { getFileDownloadUrl } from "@/lib/files";
import type { File as FileRecord } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { Text } from "@/components/ui/text";

// WebView is native-only; avoid importing on web to prevent native-module errors
const WebView =
  Platform.OS === "web"
    ? null
    : require("react-native-webview").WebView;

const getPreviewUrlForWebView = (rawUrl: string, fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const viewableDocs = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  if (viewableDocs.includes(ext)) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(rawUrl)}&embedded=false`;
  }
  return rawUrl;
};

export function useFilePreview() {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRawUrl, setPreviewRawUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);

  const handleFilePress = async (file: FileRecord) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const downloadUrl = await getFileDownloadUrl(file.file_path);

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.open(downloadUrl, "_blank");
        }
      } else {
        setPreviewFileName(file.name);
        setPreviewRawUrl(downloadUrl);
        setPreviewUrl(getPreviewUrlForWebView(downloadUrl, file.name));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to open file");
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewRawUrl(null);
    setPreviewFileName(null);
  };

  const PreviewModal =
    Platform.OS !== "web" && previewUrl !== null ? (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePreview}
      >
        <View className="flex-1 bg-background">
          {/* Header — aligned with Files screen preview styling */}
          <View
            style={{
              width: "100%",
              paddingTop: insets.top,
              backgroundColor: colors.background,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 56,
                paddingHorizontal: 6,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  paddingLeft: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    color: colors.foreground,
                    flex: 1,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {previewFileName ?? "Preview"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  marginLeft: 16,
                  paddingRight: 8,
                }}
              >
                <Pressable
                  onPress={() => {
                    const url = previewRawUrl ?? previewUrl;
                    if (url) Linking.openURL(url);
                  }}
                  style={{ paddingVertical: 8 }}
                >
                  <ExternalLink color={colors.foreground} size={22} />
                </Pressable>
                <Pressable onPress={closePreview} style={{ paddingVertical: 8 }}>
                  <X color={colors.foreground} size={24} />
                </Pressable>
              </View>
            </View>
          </View>
          {WebView ? (
            <WebView
              source={{ uri: previewUrl }}
              style={{ flex: 1 }}
              onError={() => {
                Alert.alert("Error", "Failed to load preview");
                closePreview();
              }}
            />
          ) : null}
        </View>
      </Modal>
    ) : null;

  return {
    handleFilePress,
    PreviewModal,
    closePreview,
  };
}
